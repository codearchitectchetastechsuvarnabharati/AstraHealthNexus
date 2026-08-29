<!-- codeauthor chetas karnam -->
# API Reference

## Endpoints

- GET /api/health — health check
- GET /api/dashboard — returns a dashboard snapshot assembled from public ISS and NOAA data
- GET /api/alerts — returns derived alert events and anomaly summaries

## Data Sources
- ISS position: https://api.wheretheiss.at/v1/satellites/25544
- Space weather: https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
