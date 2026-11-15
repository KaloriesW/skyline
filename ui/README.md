# ui/

UI design for **Skyline**, a Taiwan-focused weather app built for the hackathon.

- **Design canvas (Claude Design):** https://claude.ai/artifact/LV5MG4J2AGih4Ew2fPBuC5. It's private until you share it from the page's Share menu.
- **Planning notes:** [PLANNING.md](PLANNING.md)
- **Clickable HTML mockup:** [mockup/index.html](mockup/index.html). It's a single file with no build step.
- **MCP server:** [mcp/](mcp/README.md) lets Claude, ChatGPT, Cursor or any MCP client use Skyline's weather tools.

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
  - Taiwan postal codes (`408` → 南屯區, `406` → 北屯區; 5-digit codes and addresses starting with a code work too) and district names in English or 中文
  - universities by name or short form (`NTU`, `NYCU`, `清華大學`)
  - "Search worldwide" for anything else (uses the free Open-Meteo geocoding API)
  - "Use my location" (browser GPS)
- Locations chosen automatically (typed coordinates, "Use my location") are named by district, e.g. "South District · Taichung · 402 南區". A university, airport or landmark is used as the name only when you pick it.
- The chosen location sets the skyline, the nearest data source, and the "you" pin on prediction maps. Places outside Taiwan get a generic skyline and a Taiwan-only note.
- Home: use the **Demo** picker to switch the sky. Under **All stats → Customize**, you can drag, resize, hide and restore tiles.
- Settings actually work: pinned count and order, accent color, risk scale, background, tile style, fonts, corner radius, skyline, map base, reduce motion and °C/°F. They're saved in the browser.
- 中文 / English switches the whole interface to Traditional Chinese, except the canned AI answers, which stay in English.
- Turning off a data source in Settings (PM2.5 model, landslide model, typhoon warnings, Windy map) hides the tiles and prediction cards it powers.

- **Maps:** prediction maps are real, zoomable maps, either the live Windy embed or Leaflet on Esri satellite imagery with our colored overlay. The Home "Live map" tile is a live Windy map.
- **Sky:** clouds, rain and lightning are drawn on a canvas. You get layered clouds, rain at three depths with wind and splashes, branching lightning that lights the clouds, and lit windows at night. Lightning flashes at most twice per strike, with 3.5 seconds or more between strikes. Reduce motion turns all of it off.
- **Ask AI** can use your own model (Settings → AI assistant):
  - **OpenAI-compatible:** OpenAI, OpenRouter, Ollama, LM Studio, or any `/v1/chat/completions` server.
  - **Claude:** uses the official Anthropic SDK, with Claude Opus 5.5 by default.
  - Keys stay in the browser and go only to the provider you choose. The model gets the same Skyline data the screens show for your location.

All values are sample data for layout only.
