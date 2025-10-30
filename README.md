# oura-over-time

A visually pleasant health dashboard for viewing wellness data over time, featuring GitHub-style contribution graphs.

## Features

- **Sleep Tracking** 💤 - Visualize daily sleep quality over the past year
- **Activity Tracking** 🏃 - Track physical activity and exercise patterns
- **Meditation Tracking** 🧘 - Monitor mindfulness and meditation practice

## Quick Start

Simply open `index.html` in your web browser:

```bash
# Using Python's built-in server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

Or just double-click `index.html` to open it directly in your browser.

## Dashboard Preview

The dashboard displays three yearly contribution graphs similar to GitHub's contribution graph:
- Each small square represents one day
- Colors indicate activity levels (0-4), with darker colors showing more activity
- Hover over any square to see the date and level
- Graphs span a full year from the current date

### Color Schemes
- **Sleep**: Blue gradient (light to dark blue)
- **Activity**: Green gradient (light to dark green)
- **Meditation**: Purple gradient (light to dark purple)

## Current Implementation

The dashboard currently uses **placeholder random data** for demonstration purposes. The graphs are fully functional and ready to be connected to real health data sources.

## Next Steps

To integrate real data:
1. Replace the `generatePlaceholderData()` function in `script.js` with your actual data source
2. Update the data format to match: `{ date: Date, level: 0-4 }`
3. Connect to Oura API or other health data providers

## Technologies Used

- Pure HTML, CSS, and JavaScript
- No external dependencies
- Responsive design
- Modern gradient styling