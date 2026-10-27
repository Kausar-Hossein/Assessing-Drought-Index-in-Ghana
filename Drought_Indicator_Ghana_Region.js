/************************************************************
*   Multi-Index Drought Script (NO ERRORS VERSION)
*   SPEI (12-month), SPI, VCI, TCI, VHI
*   Annual maps + time-series charts over your AOI
************************************************************/

/************* 1. USER INPUTS ********************************/

// TODO: change this to your AOI asset (uploaded shapefile)
var AOI = ee.FeatureCollection('projects/chrome-setup-423916-t1/assets/Ghana_AOI');

// Years per index (limited by dataset availability)
var speiStartYear = 1960;
var speiEndYear   = 2024;   // SPEIbase currently up to ~2023

var spiStartYear  = 1981;   // CHIRPS starts at 1981
var spiEndYear    = 2024;

var vciTciStartYear = 2000; // MODIS starts 2000
var vciTciEndYear   = 2024;

// Common color palette for drought-style maps
var droughtPalette = ['8b0000','ff0000','ffff00','00ff00','008000'];


/************* 2. SPEI (12-month) from SPEIbase *************/
/* Dataset: CSIC/SPEI/2_10
 * Band: SPEI_12_month
 */

var speiIC = ee.ImageCollection('CSIC/SPEI/2_10')
  .select('SPEI_12_month')
  .filterBounds(AOI)
  .filterDate(speiStartYear + '-01-01', speiEndYear + '-12-31');

var speiYears = ee.List.sequence(speiStartYear, speiEndYear);

var SPEI_annual = ee.ImageCollection(speiYears.map(function(y) {
  y = ee.Number(y);
  var img = speiIC
    .filter(ee.Filter.calendarRange(y, y, 'year'))
    .mean()
    .rename('SPEI')
    .clip(AOI)
    .set('year', y);
  return img;
}));


/************* 3. SPI from CHIRPS precipitation *************/
/* Dataset: UCSB-CHG/CHIRPS/DAILY
 * Approach: annual rainfall -> z-score (standardized anomaly)
 */

var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterBounds(AOI)
  .filterDate(spiStartYear + '-01-01', spiEndYear + '-12-31');

var spiYears = ee.List.sequence(spiStartYear, spiEndYear);

// Annual total precipitation
var chirpsAnnual = ee.ImageCollection(spiYears.map(function(y) {
  y = ee.Number(y);
  var img = chirps
    .filter(ee.Filter.calendarRange(y, y, 'year'))
    .sum()
    .rename('precip')
    .clip(AOI)
    .set('year', y);
  return img;
}));

// Long-term mean & std dev of annual rainfall
var chirpsMean = chirpsAnnual.mean(); // band: precip
var chirpsStd  = chirpsAnnual
  .reduce(ee.Reducer.stdDev())
  .rename('precip'); // rename so bands match for division

// SPI = (P_year - mean) / std
var SPI_annual = ee.ImageCollection(chirpsAnnual.map(function(img) {
  var z = img
    .subtract(chirpsMean)
    .divide(chirpsStd)
    .rename('SPI') // final band name
    .clip(AOI)
    .set('year', img.get('year'));
  return z;
}));


/************* 4. VCI from MODIS NDVI ***********************/
/* Dataset: MODIS/061/MOD13A2
 * Band: NDVI (scale 0.0001)
 * VCI = (NDVI - NDVImin) / (NDVImax - NDVImin)
 */

var ndviIC = ee.ImageCollection('MODIS/061/MOD13A2')
  .select('NDVI')
  .filterBounds(AOI)
  .filterDate(vciTciStartYear + '-01-01', vciTciEndYear + '-12-31');

// Apply scale factor 0.0001
var ndviScaled = ndviIC.map(function(img) {
  return img.multiply(0.0001).copyProperties(img, img.propertyNames());
});

// Long-term NDVI min & max
var ndviStats = ndviScaled.reduce(ee.Reducer.minMax());  // NDVI_min, NDVI_max

var vciYears = ee.List.sequence(vciTciStartYear, vciTciEndYear);

var VCI_annual = ee.ImageCollection(vciYears.map(function(y) {
  y = ee.Number(y);
  var ndviYear = ndviScaled
    .filter(ee.Filter.calendarRange(y, y, 'year'))
    .mean()
    .clip(AOI);

  var vci = ndviYear
    .subtract(ndviStats.select('NDVI_min'))
    .divide(ndviStats.select('NDVI_max')
            .subtract(ndviStats.select('NDVI_min')))
    .rename('VCI')
    .set('year', y);

  return vci;
}));


/************* 5. TCI from MODIS LST ***********************/
/* Dataset: MODIS/061/MOD11A2
 * Band: LST_Day_1km (scale 0.02, Kelvin → °C)
 * TCI = (LSTmax - LST) / (LSTmax - LSTmin)
 */

var lstIC = ee.ImageCollection('MODIS/061/MOD11A2')
  .select('LST_Day_1km')
  .filterBounds(AOI)
  .filterDate(vciTciStartYear + '-01-01', vciTciEndYear + '-12-31');

// Scale: 0.02 and convert to °C
var lstC = lstIC.map(function(img) {
  return img
    .multiply(0.02)
    .subtract(273.15)
    .copyProperties(img, img.propertyNames());
});

// Long-term LST min & max
var lstStats = lstC.reduce(ee.Reducer.minMax()); // LST_Day_1km_min, _max

var TCI_annual = ee.ImageCollection(vciYears.map(function(y) {
  y = ee.Number(y);
  var lstYear = lstC
    .filter(ee.Filter.calendarRange(y, y, 'year'))
    .mean()
    .clip(AOI);

  var tci = lstStats.select('LST_Day_1km_max')
    .subtract(lstYear)
    .divide(
      lstStats.select('LST_Day_1km_max')
        .subtract(lstStats.select('LST_Day_1km_min'))
    )
    .rename('TCI')
    .set('year', y);

  return tci;
}));


/************* 6. VHI = 0.5 * (VCI + TCI) ******************/

var VHI_annual = ee.ImageCollection(vciYears.map(function(y) {
  y = ee.Number(y);
  var vci = VCI_annual.filter(ee.Filter.eq('year', y)).first();
  var tci = TCI_annual.filter(ee.Filter.eq('year', y)).first();

  var vhi = vci
    .add(tci)
    .multiply(0.5)
    .rename('VHI')
    .set('year', y);

  return vhi;
}));


/************* 7. Time-series charts ************************/

function chartIndex(imgCollection, bandName, title, scale) {
  scale = scale || 10000;

  var stats = imgCollection.map(function(img) {
    var val = img.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: AOI,
      scale: scale,
      maxPixels: 1e13
    }).get(bandName);

    return ee.Feature(null, {
      'year': img.get('year'),
      'value': val
    });
  });

  var chart = ui.Chart.feature.byFeature(stats, 'year', 'value')
    .setChartType('LineChart')
    .setOptions({
      title: title,
      hAxis: {title: 'Year'},
      vAxis: {title: bandName},
      lineWidth: 2,
      pointSize: 3
    });

  print(chart);
}

// Charts (you’ll see them in the Console)
chartIndex(SPEI_annual, 'SPEI', 'Annual SPEI (12-month)', 55000);
chartIndex(SPI_annual,  'SPI',  'Annual SPI (CHIRPS)',    5500);
chartIndex(VCI_annual,  'VCI',  'Annual VCI (MODIS NDVI)', 1000);
chartIndex(TCI_annual,  'TCI',  'Annual TCI (MODIS LST)',  1000);
chartIndex(VHI_annual,  'VHI',  'Annual VHI',              1000);


/************* 8. Example map layers ************************/

Map.centerObject(AOI, 7);

var spei2020 = SPEI_annual.filter(ee.Filter.eq('year', 2020)).first();
Map.addLayer(
  spei2020,
  {min: -2, max: 2, palette: droughtPalette},
  'SPEI 12-month (2020)'
);

var vhi2020 = VHI_annual.filter(ee.Filter.eq('year', 2020)).first();
Map.addLayer(
  vhi2020,
  {min: 0, max: 1, palette: ['red','yellow','green']},
  'VHI (2020)'
);


/************* 9. OPTIONAL: Export annual maps **************/

/* ⚠️ Uncomment the blocks below if you want to export.
 * This will create one Export task per year per index.
 */

// ---- SPEI exports ----
// speiYears.getInfo().forEach(function(y) {
//   var img = SPEI_annual.filter(ee.Filter.eq('year', y)).first();
//   Export.image.toDrive({
//     image: img,
//     description: 'SPEI_' + y,
//     folder: 'SPEI_Maps',
//     region: AOI.geometry(),
//     scale: 55000,
//     maxPixels: 1e13
//   });
// });

// ---- SPI exports ----
// spiYears.getInfo().forEach(function(y) {
//   var img = SPI_annual.filter(ee.Filter.eq('year', y)).first();
//   Export.image.toDrive({
//     image: img,
//     description: 'SPI_' + y,
//     folder: 'SPI_Maps',
//     region: AOI.geometry(),
//     scale: 5500,
//     maxPixels: 1e13
//   });
// });

// ---- VCI/TCI/VHI exports ----
// vciYears.getInfo().forEach(function(y) {
//   var vci = VCI_annual.filter(ee.Filter.eq('year', y)).first();
//   var tci = TCI_annual.filter(ee.Filter.eq('year', y)).first();
//   var vhi = VHI_annual.filter(ee.Filter.eq('year', y)).first();
//
//   Export.image.toDrive({
//     image: vci,
//     description: 'VCI_' + y,
//     folder: 'VCI_Maps',
//     region: AOI.geometry(),
//     scale: 1000,
//     maxPixels: 1e13
//   });
//
//   Export.image.toDrive({
//     image: tci,
//     description: 'TCI_' + y,
//     folder: 'TCI_Maps',
//     region: AOI.geometry(),
//     scale: 1000,
//     maxPixels: 1e13
//   });
//
//   Export.image.toDrive({
//     image: vhi,
//     description: 'VHI_' + y,
//     folder: 'VHI_Maps',
//     region: AOI.geometry(),
//     scale: 1000,
//     maxPixels: 1e13
//   });
// });

// //////////
/************************************************************
*   10. AUTO EXPORT ALL DROUGHT MAPS YEAR-WISE (NEW BLOCK)
************************************************************/

// ------- EXPORT SPEI -------
speiYears.getInfo().forEach(function(y) {
  var img = SPEI_annual.filter(ee.Filter.eq('year', y)).first();

  Export.image.toDrive({
    image: img,
    description: 'SPEI_' + y,
    folder: 'SPEI_Maps',
    fileNamePrefix: 'SPEI_' + y,
    region: AOI.geometry(),
    scale: 55000,   // TerraClimate pixel size
    maxPixels: 1e13
  });
});

// ------- EXPORT SPI -------
spiYears.getInfo().forEach(function(y) {
  var img = SPI_annual.filter(ee.Filter.eq('year', y)).first();

  Export.image.toDrive({
    image: img,
    description: 'SPI_' + y,
    folder: 'SPI_Maps',
    fileNamePrefix: 'SPI_' + y,
    region: AOI.geometry(),
    scale: 5500,   // CHIRPS daily ~0.05 deg (~5km)
    maxPixels: 1e13
  });
});

// ------- EXPORT VCI -------
vciYears.getInfo().forEach(function(y) {
  var img = VCI_annual.filter(ee.Filter.eq('year', y)).first();

  Export.image.toDrive({
    image: img,
    description: 'VCI_' + y,
    folder: 'VCI_Maps',
    fileNamePrefix: 'VCI_' + y,
    region: AOI.geometry(),
    scale: 1000,  // MODIS 1km
    maxPixels: 1e13
  });
});

// ------- EXPORT TCI -------
vciYears.getInfo().forEach(function(y) {
  var img = TCI_annual.filter(ee.Filter.eq('year', y)).first();

  Export.image.toDrive({
    image: img,
    description: 'TCI_' + y,
    folder: 'TCI_Maps',
    fileNamePrefix: 'TCI_' + y,
    region: AOI.geometry(),
    scale: 1000,
    maxPixels: 1e13
  });
});

// ------- EXPORT VHI -------
vciYears.getInfo().forEach(function(y) {
  var img = VHI_annual.filter(ee.Filter.eq('year', y)).first();

  Export.image.toDrive({
    image: img,
    description: 'VHI_' + y,
    folder: 'VHI_Maps',
    fileNamePrefix: 'VHI_' + y,
    region: AOI.geometry(),
    scale: 1000,
    maxPixels: 1e13
  });
});
