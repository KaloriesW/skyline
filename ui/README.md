# ui/

UI design for **Skyline**, a Taiwan-focused weather app built for the hackathon.

- **Design canvas (Claude Design):** https://claude.ai/artifact/LV5MG4J2AGih4Ew2fPBuC5. It's private until you share it from the page's Share menu.
- **Planning notes:** [PLANNING.md](PLANNING.md)
- **Clickable HTML mockup:** [mockup/index.html](mockup/index.html). It's a single file with no build step.

## Using the design
- Press Play on a desktop artboard to click through it. The nav links connect Home, Predictions, and AI Assistant.
- On Home, **Edit tiles** turns on customize mode, where you can remove tiles or reset the layout. Use the Tweaks panel to switch the sky mood (day, sunset, night, rain).
- On Predictions, switch layers (PM2.5, landslide, climate) and drag the forecast-time slider.
- On the AI Assistant, the suggested prompts and the Ask box add messages to the chat.

## Running the HTML mockup
Serve the folder (hash links don't work from some file previews):

```bash
python3 -m http.server 8765 --directory ui/mockup
```

Then open http://localhost:8765.

- **Search** (top bar button, `/`, or ⌘K / Ctrl+K) accepts:
  - place names in English or 中文
  - coordinates: decimal (`25.03, 121.56`), degrees/minutes/seconds (`23°58′N 121°36′E`), or `lat: … lon: …`
  - IATA (`TPE`) and ICAO (`RCTP`) airport codes
  - universities by name or short form (`NTU`, `NYCU`, `清華大學`)
  - "Search worldwide" for anything else (uses the free Open-Meteo geocoding API)
  - "Use my location" (browser GPS)
- The chosen location sets the skyline, the nearest data source, and the "you" pin on prediction maps. Places outside Taiwan get a generic skyline and a Taiwan-only note.
- Home: use the **Demo** picker to switch the sky. Under **All stats → Customize**, you can drag, resize, hide and restore tiles.
- Settings actually work: pinned count and order, accent color, risk scale, background, tile style, fonts, corner radius, skyline, map base, reduce motion and °C/°F. They're saved in the browser.
- 中文 / English switches the whole interface to Traditional Chinese, except the canned AI answers, which stay in English.
- Turning off a data source in Settings (PM2.5 model, landslide model, typhoon warnings, Windy map) hides the tiles and prediction cards it powers.

All values are sample data for layout only.
