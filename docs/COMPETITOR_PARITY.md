# BuildItPlus: feature-parity audit and release checklist
Updated: 2026-10-30 | Branch: `launch-prep` | **No customer deployment**

This document records what we know from BuildItPlus source code and public competitor feature pages.
"Existing" means a code path was found, **not** that it has been end-to-end tested against a live Nitrado server.
No competitor feature should be advertised as supported until a real test passes.

## Feature matrix

| Capability | Current BuildItPlus status | Release verification |
|---|---|---|
| Direct Nitrado file browse, read, write | Existing connected bridge | Test each operation with a disposable test server, wrong permissions, concurrent file changes |
| XML / JSON validation | Existing | Test malformed encoding, duplicate declarations and large files |
| Chernarus map and event markers | Existing | Test map selection, scale, devices and coordinates |
| Event creator and event-spawn editing | Existing in Event Manager | Test full fresh-server mission cycle and restart |
| Vehicle spawn and attachments | Existing separately | Test classnames, completeness and event-spawn names |
| Horde generator | Existing | Confirm territory format and server behavior |
| Weather and gameplay settings | Existing, individual fields | Check supported options for current DayZ release |
| Messages generator | Existing | Confirm restart warning messages on console |
| Types / economy editing | Existing | Test size limits and preservation of unrelated entries |
| Player spawn point editing | Existing | Test fresh-spawn replacement does not unintentionally append |
| Loadout editor | **Partial**: adds existing cargo to a registered preset | Build full item/slot/attachment workflow and validate preset linkage |
| Map object placement and rotation | **Partial**: mover, relocator and spawn-object tools | Build full placement tool including altitude and rotation |
| Logs and activity viewer | Existing | Test log parsing and player mapping |
| Multi-server profiles | Existing | Test isolation, server switches, permissions |
| Day / night planner | **Added**: read-only calculator | Confirm values with server configuration; seasonal daylight is approximate |
| Server Doctor | **Added**: read-only multi-file validation | Test valid/invalid mission file sets against Nitrado |
| Comprehensive change history / one-click rollback | **Missing** | Persist secure revisions and verify rollback without data loss |
| Scheduled multi-file event bundles / expiry | **Missing** | Add transactional plan, restart guidance, rollback and automated tests |
| Full-server first-run setup wizard | **Missing** | Implement deterministic presets with preview across all touched files |
| Multi-map support (Livonia, Sakhal etc.) | **Missing** in this Chernarus-focused UI | Test geometry and tiles per supported map |
| Discord killfeed and automated channels | **Missing** | Evaluate gateway/webhook policy, user consent and monitoring costs |
| Real-time player presence / leaderboard | **Missing** | Confirm data sources and privacy/retention |
| Nitrado server settings, whitelist and bans | **Missing** | Permission-scoped API integration and tests |
| Team accounts, roles, audit logs | **Missing** | Explicit permissions, separated tenants, security review |
| Mission comparison with official DayZ baseline | **Missing** | Versioned official baselines, safe diff previews |
| Smart loot simulation and economy comparisons | **Missing** | Specify measurable algorithm and validate against DayZ behavior |
| Modded PC traders / Expansion and PC-only mods | **Not in PS5 scope** | Only consider if expanding to PC; cannot promise on console |

## Competitors reviewed (public marketing pages; verify live behaviors separately)

- Law's KillFeed: https://dayzbot.com/tools
- Dayz Code: https://dayzcode.com/
- Skynet / Killfeed tools: https://www.killfeed.com/tools/
- DZconfig: https://dzconfig.com/

## Priority development plan

1. **Release safety:** Fix remaining UI issues, verify Nitrado OAuth/permissions across multiple users, confirm no credential fields are exposed, test map picking, server switching, file writes, and mobile layout; no production deploy before tests.
2. **Data safety:** Add local/remote file diffs, durable versioning, restore verification, explicit scope of multi-file changes.
3. **Connected workflows:** Complete Server Setup Wizard, multi-file event builder and coordinated publish.
4. **Operational tools:** Server settings, monitoring, optional Discord integration with privacy and scope controls.
5. **Expansion:** Additional DayZ maps, then optional PC-specific mods/other games only with validated demand.

## Must-pass acceptance tests for UI overhaul

- Log in and out using the existing gate; no shell is reachable before authentication.
- Open/close Map, Server Tools, Events, Logs, Files, Layers, Servers, Day / Night planner, Server Doctor.
- File Manager opens from the Files navigation link; its existing edit, preview and save flow works.
- All existing Server Tools search and render correctly; Ctrl/Cmd+K search launches the correct tool.
- Event placement mode lets the user select a map point and cancel with the existing cancel toolbar.
- No unintended writes occur from navigation, palette search, doctor scan or time planning.
- Layout remains navigable on desktop, iPhone and iPad; accessibility and keyboard tests.
- Nitrado wrong-account, permission denied, missing mission, stale file, upload error and concurrent edit tests.
- Do not deploy while a major flow remains untested or failing.

## Scope safety

Changes in this batch were made only to `launch-prep`.
The existing production site, test Worker, Nitrado Worker, configuration secrets and server files were not edited by this batch.
