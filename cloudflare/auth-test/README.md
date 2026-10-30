# Build It!++ — isolated Cloudflare test Worker

This directory is for **buildit-auth-test only**, not the live Pages website
and not **buildit-nitrado-logs**.

- `worker.js`: Stage 4 Worker source.
- `wrangler.jsonc`: Wrangler deployment configuration.
- Git branch: `auth-test-deploy` (kept separate from site branch `main`).

## Safety steps before enabling builds

1. Replace the `database_id` placeholder with the **existing** D1
   `buildit-auth-test` Database ID. **Never** omit the ID: doing so
   could provision a second empty D1 database.
2. Verify the Cloudflare Worker has a `DB` binding to this same D1 database.
3. Verify all existing Discord, Stripe and Nitrado secrets/vars are still
   configured on **buildit-auth-test** (do not put their values in GitHub).
4. Keep `keep_vars: true` to retain dashboard variables.
5. In Cloudflare build settings for the existing `buildit-auth-test` Worker:
   - Production branch: `auth-test-deploy`
   - Build command: *(empty)*
   - Deploy command: `npx wrangler deploy` (uses the root `wrangler.jsonc` on this isolated branch).
   - Turn **Disable builds OFF** once the build settings and D1 binding are verified.
6. After updating settings, enable builds and trigger a test deployment
   by pushing a new commit to this branch.
7. Test Discord login, subscription status, Nitrado account connection,
   service selection, and read-only File Manager before any uploads.

The Worker contains the Stage 4 test implementation. It has **not** yet been
validated end to end against live Cloudflare and Nitrado services.

## First connected Git build

- Branch: `auth-test-deploy` (NOT `main`).
- Deploy target: `buildit-auth-test`.
- Staging D1 database ID is configured in the branch-root `wrangler.jsonc`.
- First build was triggered by this documentation-only change; runtime code was unchanged.
- The Cloudflare build result must be checked in the Cloudflare dashboard.
