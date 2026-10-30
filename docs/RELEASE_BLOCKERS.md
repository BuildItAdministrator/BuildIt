# BuildItPlus — customer release blockers (2026-10-30)

**Status: do not deploy `launch-prep` to customers.**

## Security blockers — highest priority

1. **Authentication:** The current static HTML access gate in `index.html` checks a client-visible SHA-256 password digest and a browser session flag. This is not secure server-side authentication or authorization. A customer release must enforce authenticated sessions and authorization in the Cloudflare Worker on every protected request, regardless of UI state.
2. **Multitenant separation:** Nitrado tokens, server IDs and worker endpoints must be bound to the authenticated user/account on the server. Users must not be able to supply a different tenant's server ID to read or edit files. Add cross-user tests for read/write, permission revocation and session expiry.
3. **Credential handling:** Current profile code stores Worker access keys in browser localStorage. For a paid multi-user product, do not rely on localStorage to protect write-capable credentials. Prefer short-lived, scoped server-side sessions and secure token storage.
4. **Public source:** Repository metadata currently reports public visibility. Treat all client-side source and embedded constants as public. Never ship credentials or authorization secrets in static files.
5. **Production deployment isolation:** Keep existing website, test Worker and Nitrado Worker untouched while preparing separate `buildit-app` production infrastructure. Do not perform a production migration until reviewed, authorized and tested.

## Functionality blockers

- New responsive UI and existing Nitrado flows require full desktop/mobile browser runs. Playwright smoke suite is committed under `tests/`, and isolated GitHub Actions configuration is under `.github/workflows/ui-smoke.yml`; **creating tests is not proof they passed**.
- Test OAuth/identity recovery, different Nitrado server accounts, permission denied, blank files, malformed XML/JSON, failures during upload, stale source hash, server switching mid-write.
- Review the multi-file Event Manager and Spawn tools with a test server. A browser-safe preview alone does not validate actual DayZ game behavior.
- Implement durable audit history and rollback before enabling scheduled automated server edits.
- Verify supported maps, console limitations, cost of logs/cron/sync and platform terms before expanding to broad customer use.

## Tests to confirm in release report

- Static/lint and source checks: pass/fail with execution log.
- Chrome desktop, mobile viewports: pass/fail with screenshot evidence.
- Nitrado disposable test account: verified read, preview, write and post-write content/hash; no accidental writes.
- Dedicated second user/account: cannot read or write first user's Nitrado files.
- All checkout, access revocation, refund and subscription webhooks tested in test environment, never in customer production.

This file is an engineering checklist, not a claim that all the tests above have already passed.
