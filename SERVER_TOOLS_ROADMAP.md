# Build It!++ — DayZ Console Tools Roadmap

Screenshot inventory received on 2026-10-28: **53 tools** shown in the DayZBoosterZ tools catalog.
This is a functional roadmap, NOT a claim that all 53 tools are already implemented.
We are independently implementing supported capabilities, not copying vendor code or branding.

## Phase 1 — shipped in repository (8 functional tools)

- XML Validator — checks well-formed XML and DayZ root expectations
- JSON Validator — checks JSON; validates Object Spawner positions and flags exact-position duplicate objects
- JSON Splitter — splits JSON arrays and vanilla DayZ Object Spawner Objects arrays, preserving metadata
- Types Booster — multiply chosen numeric field in types.xml
- Types Reducer — reduce chosen numeric field in types.xml
- Advanced Types Editor — set a chosen numeric field, optionally restricted to a classname
- Lifetime Reducer — scale lifetime of type entries
- Event Conflict Check — report repeated event names and impossible min/max settings

These tools operate on local imported/pasted file content, not on live Nitrado. They do not automatically upload changes. Users review and upload via the existing File Manager. The editable XML operations preserve untouched source bytes, existing whitespace, and XML declarations; full XML parsing is used for validation.

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

1. Complete Mission Validator ZIP, Spawnable/SpawnObject duplicate checks, Types Organizer and Ignore List Generator.
2. Add Day/Night Calculator, Weather Manager, Globals Configurator and Gameplay Generator.
3. Add Loadout Generator, Weapon Blueprint Generator, Bag Fill Generator and full Build A Vehicle.
4. Build map-related object converters, SpawnObject Mover/Organizer, coordinate transforms, heatmap and relocator.
5. Finish spawn/loot-zone management, message creator, gas effects and CE-based event tooling.
6. Evaluate features requiring unsupported console scripts (NPC/Airstrike/INIT.C); provide explicitly labeled safe alternatives if a faithful console implementation is not possible.

Official references:
- https://community.bistudio.com/wiki/DayZ:Gameplay_Settings
- https://community.bistudio.com/wiki/DayZ:Object_Spawner
- https://dayzboosterz.com/wiki/page/how-to-add-object-spawner-files
