# Drought Analysis Using Google Earth Engine and TerraClimate

This project examines annual and monthly dry and wet conditions using TerraClimate precipitation and potential evapotranspiration data in Google Earth Engine.

The analysis covers **2010–2022**, using **1981–2022** as the baseline period. Users can adapt the workflow to their own study area.

## Methodology Note

Although the code labels its outputs SPI and SPEI, it calculates **standardized anomalies (z-scores)** rather than conventional, probability-distribution-based SPI and SPEI.

The results should therefore be interpreted as relative indicators of precipitation and climatic-water-balance departures from the baseline mean.

## Data

| Property | Description |
|---|---|
| Dataset | TerraClimate |
| Earth Engine collection | `IDAHO_EPSCOR/TERRACLIMATE` |
| Precipitation | Monthly `pr`, in millimetres |
| Potential evapotranspiration | Monthly `pet`, scaled by `0.1` to millimetres |
| Climatic water balance | Precipitation minus PET |
| Approximate spatial resolution | 4.6 km |
| Analysis period | 2010–2022 |
| Baseline period | 1981–2022 |
| Study area | User-defined boundary named `roi` |

## Features

- Annual precipitation standardized-anomaly maps.
- Annual climatic-water-balance standardized-anomaly maps.
- Monthly charts using a configurable accumulation period, set to 3 months by default.
- Additional rolling 12-month anomaly charts.
- Combined charts distinguishing positive and negative anomalies.
- CSV export of regional monthly 12-month anomaly values.

The current script does not include annual CSV or GeoTIFF exports.

## Requirements

- Google Earth Engine access.
- An Earth Engine-enabled Google Cloud project.
- A study-area geometry or boundary asset.
- Google Drive access for exporting results.

The workflow uses the Earth Engine JavaScript API and runs in the browser-based Code Editor.

## How to Run

1. Open the [Google Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Create a new script and paste the contents of `groundwater_analysis.js`.
3. Draw or import your study-area boundary.
4. Rename the imported variable `roi`.
5. Define the study area according to the object type.

For a geometry:

```javascript
var studyArea = roi;
```

For a FeatureCollection:

```javascript
var studyArea = roi.geometry();
```

6. Review the analysis settings.
7. If the pasted code ends with a standalone `groundwater_analysis.js` line, delete that line.
8. Click **Run**.
9. View annual maps in the **Layers** panel and charts in the **Console**.
10. Open **Tasks** and run the CSV export task.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `analysisStartYear` | `2010` | First analysis year |
| `analysisEndYear` | `2022` | Last analysis year |
| `baselineStartYear` | `1981` | First baseline year |
| `baselineEndYear` | `2022` | Last baseline year |
| `accumulationMonths` | `3` | Main rolling accumulation window |
| `chartScale` | `10000` | Regional reduction scale in metres |
| `accumulationMonths12` | `12` | Additional accumulation window |
| `chartScale12` | `10000` | Regional reduction scale for 12-month analysis |
| `exportFolder` | `GEE_SPI_SPEI_2010_2022` | Google Drive output folder |

When changing the analysis period, also update hardcoded chart titles and export filenames where necessary. Ensure sufficient input data are available for all baseline and rolling windows.

## Calculation

### Annual Analysis

Monthly precipitation and scaled PET are summed for each calendar year.

```text
Climatic water balance = Precipitation − PET
```

Annual values are standardized against pixel-specific baseline statistics:

```text
Precipitation anomaly = (P − baseline mean P) / baseline standard deviation P

Water-balance anomaly = (WB − baseline mean WB) / baseline standard deviation WB
```

### Monthly Analysis

The script calculates rolling precipitation and water-balance totals.

Baseline statistics are calculated separately for each calendar month to account for seasonality. For example, January-ending windows are compared with January-ending windows in the baseline period.

Pixel-level anomalies are then averaged across the study area for the charts.

### Interpretation

| Value | Interpretation |
|---|---|
| Negative | Below-baseline precipitation or climatic water balance |
| Near zero | Close to the baseline mean |
| Positive | Above-baseline precipitation or climatic water balance |

Map and chart displays use a fixed range of approximately **−3 to +3**. Values outside this range may be visually saturated or fall outside the chart view.

## CSV Output

The export task is named:

```text
Monthly_SPI12_SPEI12_2010_2022
```

| Column | Description |
|---|---|
| `date` | Window-ending month, represented by its first day |
| `date_label` | Month and year label |
| `year` | Calendar year |
| `month` | Calendar month |
| `SPI12` | Regional mean 12-month precipitation standardized anomaly |
| `SPEI12` | Regional mean 12-month water-balance standardized anomaly |

## Limitations

- The calculated indices are z-score approximations, not conventional statistical SPI/SPEI.
- Standard drought severity thresholds should not be applied without validation.
- The script does not directly measure groundwater, streamflow, or observed drought impacts.
- Regional means depend on the study boundary and reduction scale.
- Input-month completeness is not explicitly checked.
- Pixels with zero baseline standard deviation are masked.
- Monthly rows with missing regional values are excluded.
- Large study areas may encounter Earth Engine processing limits.
- The opening code comments mention some exports that are not implemented in this version.

## References

- [TerraClimate Dataset](https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE)
- [Google Earth Engine Documentation](https://developers.google.com/earth-engine/guides)
- [Earth Engine Code Editor](https://code.earthengine.google.com/)

## Author

**Md. Kausar Hossein**

[GitHub](https://github.com/Kausar-Hossein)
