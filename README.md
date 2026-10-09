# Farm Boundary Tracker

Private farm boundary tracking web app with GPS point capture, survey records, area calculation, reports, and installable mobile web app support.

## Features

- Register and login screen for app entry
- Live GPS permission and current location marker
- Survey number selection
- Add current GPS point
- Close boundary and calculate approximate area
- Survey records view
- Report summary copy
- GeoJSON polygon import
- Install/Add to Home Screen support
- Offline app shell through service worker

## Important Notes

This app is for field guidance and planning only. Phone GPS is not survey-grade. For legal boundary confirmation, use official land records such as RTC, Tippan, Akarband, or a licensed surveyor.

The current free web version stores demo login and boundary records in the browser local storage. For real multi-user cloud accounts, connect Firebase/Auth or a backend database before public production use.

## Run Locally

Open `index.html` in a browser, or serve the folder with a local static server.

Example:

```bash
npx serve .
```

## Files

- `index.html` - app shell and screens
- `styles.css` - responsive mobile-first styling
- `app.js` - GPS, auth demo, boundary, records, and reports logic
- `manifest.webmanifest` - installable web app metadata
- `sw.js` - offline app-shell cache
