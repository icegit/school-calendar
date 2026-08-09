# School calendar

A dependency-free, responsive school-year calendar generated from `ToHTML.xlsx`. It displays the 2026/2027 school year on desktop and mobile, with green weekends and holidays, red exam weeks, orange family events, blue confirmed public events, cool-gray hold markers for unconfirmed dates, and a lighter gray treatment for past dates. Clicking or tapping any date opens a detail panel.

## Preview locally

The page loads its dates from JSON, so serve the folder instead of opening `index.html` directly:

```powershell
cd C:\Users\AhmetUcar\Repos\personal\school-calendar
python -m http.server 8000
```

Then open `http://localhost:8000`. Do not open `index.html` directly: browsers block local HTML files from fetching the JSON calendar data. Press `Ctrl+C` in the terminal to stop the server.

## Add another school year

1. Copy `data/2026-2027.json` to a new file such as `data/2027-2028.json`.
2. Change the year metadata, month range, and events. Event start and end dates are inclusive.
3. Add the new file to `data/years.json`. The bottom school-year selector will update automatically.

Every event requires a `location`. The `notes`, `url`, and `linkLabel` fields are optional:

```json
{
  "id": "autumn-holiday",
  "title": "Herfstvakantie",
  "start": "2026-10-10",
  "end": "2026-10-18",
  "category": "holiday",
  "location": "Texel",
  "notes": "Ferry departs at 10:30.",
  "url": "https://example.com/booking",
  "linkLabel": "Open booking"
}
```

## GitHub Pages

The included workflow deploys the repository as a static GitHub Pages site whenever `main` is updated. In the repository settings, choose **GitHub Actions** as the Pages source if it is not selected automatically.
