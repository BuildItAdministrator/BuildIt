# Build It!++ — Production launch (DO NOT USE TEST SECRETS)

Production is `https://app.builditplus.net` on a NEW Cloudflare Worker
`buildit-app`, with a NEW D1 database `buildit-production`.
The test Worker `buildit-auth-test`, existing Nitrado Worker `buildit-nitrado-logs`
and the production site `builditplus.net` must remain untouched until go-live.

## Readiness status

- [x] Dedicated GitHub branch: `launch-prep`
- [x] Dedicated production Worker source: `cloudflare/production/worker.js`
- [x] Live-only Stripe API and webhook event guards in production source
- [x] Separate, empty production D1 schema: `cloudflare/production/schema.sql`
- [x] Launch regressions: `node --test cloudflare/production/security.test.cjs`
- [ ] **NEW D1 database `buildit-production`**, run schema, paste its ID into branch-root `wrangler.jsonc`
- [ ] Verify GitHub Actions launch checks are green
- [ ] NEW `buildit-app` Worker connected to GitHub `launch-prep` (builds disabled until configuration is complete)
- [ ] Cloudflare DNS zone `builditplus.net` active; custom domain `app.builditplus.net` on **buildit-app** (no conflicting CNAME)
- [ ] Discord OAuth redirect: `https://app.builditplus.net/api/auth/callback`
- [ ] Nitrado production OAuth app redirect: `https://app.builditplus.net/api/nitrado/callback`
- [ ] Production Cloudflare secrets/vars added (below)
- [ ] Stripe live business activated, product and monthly price created, customer portal configured
- [ ] Stripe **live** webhook endpoint and correct event subscription configured
- [ ] Real low-cost payment trial: authorize, receipt, webhook, Premium, Nitrado, cancel, expiry/failed payment behavior
- [ ] Security regression tests with two segregated user contexts; external review before scaling
- [ ] Consumer-facing Terms, Privacy Notice, support contact and cancellation/refund information published
- [ ] Public `builditplus.net` landing page links to production app; remove old client-side password gate only once ready
- [ ] DNS, backups, rollback and monitoring verified

## Required Cloudflare production secrets

Do NOT paste secrets in GitHub, support chats, screenshots, README or logs.
Create them under the `buildit-app` Worker only.

| Cloudflare variable | Type | Value |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Text | Discord application ID |
| `DISCORD_CLIENT_SECRET` | Secret | Discord application secret |
| `DISCORD_REDIRECT_URI` | Text | `https://app.builditplus.net/api/auth/callback` |
| `NITRADO_CLIENT_ID` | Text | Production Nitrado OAuth application ID |
| `NITRADO_CLIENT_SECRET` | Secret | Production Nitrado OAuth application secret |
| `NITRADO_REDIRECT_URI` | Text | `https://app.builditplus.net/api/nitrado/callback` |
| `NITRADO_ENCRYPTION_KEY` | Secret | New 32-byte random key encoded in Base64; back up securely |
| `STRIPE_SECRET_KEY` | Secret | **LIVE** key starting `sk_live_` |
| `STRIPE_PRICE_ID` | Text | **LIVE** monthly `price_...` ID (EUR 4.99/month, tax presentation decided) |
| `STRIPE_WEBHOOK_SECRET` | Secret | **LIVE** endpoint `whsec_...` secret |

## Stripe production webhook

URL: `https://app.builditplus.net/api/stripe/webhook`

Event types implemented:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Never** reuse test-mode Stripe API keys, Price IDs, webhooks, customer IDs or
subscription rows in this database. A live Price ID needs to exist in live mode.
The Worker rejects test keys and test events. Price and tax configuration
must match the price displayed in the app.

## Cloudflare deployment setup

In GitHub `launch-prep`, root `wrangler.jsonc` contains a deliberate
`REPLACE_WITH_NEW_PRODUCTION_D1_DATABASE_ID` placeholder.
This makes production deployment impossible until a **separate** D1 is ready.

After filling that placeholder:
1. Create/select `buildit-app` in Workers & Pages.
2. Connect repository `BuildItAdministrator/BuildIt` branch `launch-prep`.
3. Keep automatic builds DISABLED until all production settings and secrets
   are present. The root Wrangler config uses `npx wrangler deploy`.
4. Verify the deploy target name is exactly `buildit-app`, and DB binding
   `DB` points to `buildit-production`, not `buildit-auth-test`.
5. Enable automatic builds only after all checks have passed. Verify initial
   deployment and do NOT direct paying customers to it yet.
6. Configure a custom domain after confirming the Cloudflare zone. The
   domain must resolve to `buildit-app`, not the old site or logs Worker.
7. After a successful first real payment and server read/write test,
   consider updating the main site to add the customer login link.

## Important

The Stripe test subscription from the staging database will **not**
grant access in production. A fresh real payment will be required for a
normal production customer; use separate staff entitlement handling if needed.
The existing server files are real: any upload on the new production Worker
writes to the selected Nitrado server. Keep backups and use deliberate
confirmations. Do not assume staging simulation tests prove two-user isolation
on real Nitrado accounts.
