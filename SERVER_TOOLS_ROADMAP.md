# Build It!++ — Server Tools

## Current live catalog: 34 tools

Only implemented Nitrado-connected tools appear in the Server Tools panel. The other 19 entries from the original 53-tool screenshot inventory are hidden entirely.

### Config & gameplay

- Weather Manager
- Gameplay Generator
- Messages Generator
- Globals Configurator

### Validation & files

- XML Validator
- JSON Validator
- Event Conflict Check
- Spawnable Duplicate Checker
- SpawnObject Duplicate Checker

### Loot & economy

- Types Booster
- Types Reducer
- Advanced Types Editor
- Lifetime Reducer
- Tier Booster
- Types Organizer
- Spawnable Types Adjuster
- Classname Finder
- Ignore List Generator
- Loot & Proxy Calculator

### Events & vehicles

- Events Organizer
- Event Group Calculator
- Gas Zone Generator
- Horde Generator
- Vehicle Spawn
- Lootdrop Spawn

### World & map

- Spawn Point Generator
- SpawnObject Mover
- SpawnObject Organizer
- Underground Areas
- Build Relocator
- SpawnObject Heatmap

### Equipment & effects

- Loadout Generator
- Weapon Blueprint Generator
- Bag Fill Generator

## Server-first workflow

Connect the existing Cloudflare Worker, select a tool, read the live file, preview, and explicitly confirm the edit while the game server is stopped. The Worker checks the current SHA-256, creates and verifies a backup, writes, and verifies the file contents. No manual XML or JSON upload is needed. Read-only analyzers never write.

## Supported scope and conditions

- Existing Chernarus PS5 mission files only; the worker can create the dedicated lootdrop file, but not arbitrarily named files.
- Large files require the separately deployed Cloudflare Worker with MAX_FILE_BYTES set to 4 MB.
- Loadout Generator edits cargo in an existing preset registered in cfggameplay.json. It does not create missing presets.
- Gas zones clone an existing static contaminated zone. Infected hordes use an existing zombie territory type.
- Player spawns are inserted into an existing named group, not outside it.
- Build relocation and object placement preserve existing Y elevations; inspect terrain and avoid slopes.
- Equipment editing confirms item and parent classnames exist in the server's types.xml.
- This is vanilla console configuration editing, not a PlayStation Steam Workshop mod installer.
- Some editors offer narrower scope than commercial tools, for example numeric event adjustments and one loadout cargo item.
- Source syntax and isolated transformation tests were checked. Live Nitrado writes and the complete browser suite have not been verified in this chat.

## Excluded entries

The 19 unimplemented or unsafe options were removed from the website catalog rather than leaving misleading dead buttons. They need unsupported scripts, unverified game schemas, or worker capabilities not yet deployed.

## References

- https://community.bistudio.com/wiki/DayZ:Gameplay_Settings
- https://community.bistudio.com/wiki/DayZ:Weather_Configuration
- https://community.bistudio.com/wiki/DayZ:Object_Spawner
- https://community.bistudio.com/wiki/DayZ:Contaminated_Areas_Configuration
- https://community.bistudio.com/wiki/DayZ:Spawning_Gear_Configuration
- https://github.com/BohemiaInteractive/DayZ-Central-Economy
