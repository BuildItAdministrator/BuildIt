# Build It!++ — DayZ Console Tools Roadmap

Screenshot inventory received on 2026-10-28: **53 tools** shown in the DayZBoosterZ tools catalog.
This is a functional roadmap, NOT a claim that all 53 tools are already implemented.
We are independently implementing supported capabilities, not copying vendor code or branding.

## Server-first integration shipped (14 connected tools)

Server Tools now reads existing mission files directly through the authenticated Nitrado Worker, rather than asking users to upload a local file. An edit requires **Preview** and one explicit **Apply to Nitrado** confirmation. The Worker checks the file's original SHA-256, creates and verifies a backup, writes the new bytes and verifies the remote file. Read-only checkers never upload.

Connected tools:

- XML Validator — select and validate an existing Nitrado XML file.
- JSON Validator — select and validate an existing Nitrado JSON file.
- Types Booster — multiply a selected numeric field in live `db/types.xml`.
- Types Reducer — reduce a selected numeric field in live `db/types.xml`.
- Advanced Types Editor — set a selected field, optionally filtered by classname.
- Lifetime Reducer — adjust lifetimes in live `db/types.xml`.
- Tier Booster — multiply nominal for entries explicitly tagged Tier1–Tier4 (does not guess custom tier aliases).
- Classname Finder — search actual live types.xml classnames and nominal/min counts.
- Spawnable Types Adjuster — edit existing attachment/cargo chance attributes for exactly one classname without touching other entries.
- Globals Configurator — edit one existing numeric `db/globals.xml` variable, preserving type and unrelated XML.
- Messages Generator — safely append a repeating notification to existing `db/messages.xml` or `messages.xml`.
- Event Conflict Check — read live `db/events.xml`, detect duplicates and basic min/max mistakes.
- Spawnable Duplicate Checker — analyze live `cfgspawnabletypes.xml`.
- SpawnObject Duplicate Checker — analyze an existing JSON Object Spawner in the mission.

**Not yet connected:** JSON Splitter. It would need to create and register multiple new files; the existing Worker has only a restricted create-file endpoint for `custom/builditlootdrop.json`. It is still available as a pure transformation helper for later use, but is not falsely advertised as an integrated tool. The other 39 catalog entries are planned or have only partial existing capability.

**Current restrictions:** The deployed Worker must expose `/api/files/list`, `/api/files/read` and `/api/files/write` with the existing MAP_SYNC_KEY/MAP_WRITE_KEY protections. Only Chernarus mission paths are discovered. Build It!++ now validates server tool payloads up to 4 MB. The deployed Worker must ALSO increase `MAX_FILE_BYTES` from `512 * 1024` to `4 * 1024 * 1024`; until that deployment, files larger than 512 KB still cannot be read/edited. Keep the separate File Manager's older local editor safeguards. This does not remove Worker authentication, SHA checks, or verified backups. The tools do not restart Nitrado servers automatically. Not all DayZBoosterZ tools have meaningful PS5 equivalents; identify those explicitly rather than faking script mods.

**Safety controls:** No write before confirm, no local-file imports, no unverified create operations, source-byte preservation for XML fields, comment protection, strict JSON/XML validation, fresh hash checks, automatic verified backup, and no password persistence.

## Existing, partially overlapping Build It!++ capabilities

- Events Organizer → existing Event Manager can compose and publish events, but is not a full events.xml organizer.
- Build A Vehicle → existing Event Manager provides vehicle spawn placement, but not the complete vehicle-attachment builder.
- Existing map, custom bases sync, Nitrado file manager, log viewer and filters, loot JSON generator are separate established features, not counted as the 8 fully completed screenshot tools.

## Remaining screenshot inventory, by area

### Configuration / gameplay
- Day/Night Calculator
- Weather Manager
- Gameplay Generator
- Messages Generator
- Globals Configurator
- Nitrado Settings Generator

### Validation / file management
- Mission Validator ZIP
- Spawnable Duplicate Checker
- SpawnObject Duplicate Checker

### Loot / types / economy
- Tier Booster
- Types Organizer
- Spawnable Types Adjuster
- Classname Finder
- Ignore List Generator
- Loot & Proxy Calculator

### Events / vehicles
- Events Organizer (partial)
- Build A Vehicle (partial)
- Event Group Calculator
- Vehicle Event Remover
- Gas Zone Generator
- Horde Generator
- NPC Generator
- Airstrike Generator

### Map / object conversion
- Spawn Point Generator
- Loot Exclusion Zone Generator
- INIT.C To ObjectSpawner
- SpawnObject Converter
- MapGroupPos Converter
- MapGroupPos To SpawnObject
- PRA Converter
- Object To MapGroupPos Converter
- SpawnObject Mover
- SpawnObject Organizer
- JSON To Init.c Converter
- Underground Areas
- Environment Exclusion Generator
- Territory Zone Creator
- MapGroupPos Organizer
- Build Relocator
- Sky Writing Generator
- SpawnObject Heatmap

### Equipment / effects
- Loadout Generator
- Weapon Blueprint Generator
- Bag Fill Generator
- CfgEffect Converter

## Technical boundaries and acceptance criteria

1. **Platform:** Vanilla DayZ PlayStation 5 community server, hosted on Nitrado. Do not promise arbitrary workshop mods, scripting/AI through init.c, or live server runtime spawning without an official supported configuration mechanism. PC-oriented converters may offer offline conversions but must be labeled as not deployable to PS5 when appropriate.
2. **Format:** Use official Bohemia Interactive CE/XML and cfggameplay / Object Spawner schemas where available. Avoid made-up classname and file parameters. Object-spawner JSON paths in Nitrado console missions use `custom/<filename>.json`, e.g. `custom/builditlootdrop.json`.
3. **Safety:** Before any live upload, validate syntax and file-specific invariants; read the current server version; hash-check before write; take and verify backups; confirm explicitly; verify post-upload bytes. Never silently replace, delete, or format unrelated server files.
4. **UI:** Reuse one compact searchable Server Tools panel, no dead launch buttons. Mark unimplemented tools `Planned`, existing partial matches `Partly available`. Preserve mobile layout and light/dark themes.
5. **Integration:** Prefer safe imports from the existing Nitrado File Manager for read-only preview; add audited writes only for validated, explicitly supported file types. Never put Nitrado credentials in frontend/source control.
6. **Tests:** Add Playwright tests for conversions, malformed content, full file preservation, file size bounds, network failure and UI keyboard interaction. The initial new tests have been committed; a full browser test run is still pending.
7. **Licensing:** Reimplement functionality independently. Do not copy DayZBoosterZ's private source, CSS, images, logo, proprietary design or text.

## Suggested next implementation batches

1. Complete Mission Validator ZIP, Types Organizer, Ignore List Generator and upgrade the Worker for safe >512 KB reads/writes.
2. Add Day/Night Calculator, Weather Manager, Gameplay Generator and full message-schedule management.
3. Add Loadout Generator, Weapon Blueprint Generator, Bag Fill Generator and full Build A Vehicle.
4. Build map-related object converters, SpawnObject Mover/Organizer, coordinate transforms, heatmap and relocator.
5. Finish spawn/loot-zone management, message creator, gas effects and CE-based event tooling.
6. Evaluate features requiring unsupported console scripts (NPC/Airstrike/INIT.C); provide explicitly labeled safe alternatives if a faithful console implementation is not possible.

Official references:
- https://community.bistudio.com/wiki/DayZ:Gameplay_Settings
- https://community.bistudio.com/wiki/DayZ:Object_Spawner
- https://dayzboosterz.com/wiki/page/how-to-add-object-spawner-files
