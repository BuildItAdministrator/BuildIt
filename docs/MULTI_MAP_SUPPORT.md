# Multi-map support

The map selector supports Chernarus (15360 m), Livonia (12800 m), Nasdara (16384 m) and Sakhal (15360 m). Select the world running on the connected server, then choose **Apply map**. The page reloads to clear coordinate selections, imported documents, previews and cached mission paths. Export unsaved editor changes first. Active server requests block map changes.

Selections are browser-local per Nitrado service (production) or Worker/server profile (legacy). Event drafts are partitioned by profile and world. Existing unscoped drafts migrate only to Chernarus. This is manual selection, not automatic detection of the server's running mission. An installed mission directory alone does not prove that it is active.

Mission discovery searches FTP and NoFTP roots for the selected world only, in `dayzps_missions` and `mpmissions`. Mission names are `dayzOffline.chernarusplus`, `dayzOffline.enoch`, `dayzOffline.nasdara`, and `dayzOffline.sakhal`. The production Worker's custom JSON streaming and loot-file creation allow these four worlds, preserving user-root and write checks. Existing auth-test and Nitrado bridge Workers are unchanged; legacy deployments need equivalent server-side support before new-map writes will work.

Chernarus retains its existing XAM tiles and local labels. Other worlds use the official dzbot SDK viewer under the Leaflet tool overlays, with synchronized world coordinates and zoom, satellite/topographic switching and SDK place search. Tiles and labels remain on the provider's servers; Build It does not mirror them. Visible dzbot attribution is retained. Availability depends on the provider and a network connection. See https://developers.dzbot.de/map/ and https://dzbot.de/legal/map-sdk-terms.

## Validation

- `node --test cloudflare/production/*.test.cjs tests/multi-map.unit.cjs`: 36 passing tests, including world boundaries, coordinate round trips, loot spread at edges, server/world separation and the production file-creation allowlist.
- Syntax checks on JavaScript and inline scripts; `git diff --check`.
- Browser preview: Chernarus regression view; Livonia satellite and labels; Nasdara satellite, search/zoom and style toggle; Sakhal topographic and labels.
- No live Nitrado writes or Cloudflare deployment performed. Verify one known in-game coordinate and a test-server file operation per world before customer rollout. The full existing Playwright suite was not run locally.
