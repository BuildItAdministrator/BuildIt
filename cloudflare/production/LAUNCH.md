# Build It!++ — Gumroad Membership launch checklist

**Status:** code is implemented on GitHub branch `launch-prep`, **NOT DEPLOYED**.
Never apply this Wrangler config to the existing `buildit-auth-test` Worker,
`buildit-nitrado-logs` Worker, or live `builditplus.net` site.

## Product and billing

- Gumroad seller: Individual.
- Product: **Build It!++ Premium** = recurring **€5.99/month** Membership.
- This sells access to the **Build It!++ website tools only**. Customers use
  their own separately purchased Nitrado server; server hosting is not included.
- The other membership intervals visible in Gumroad should be reviewed or disabled.
- License keys are enabled; **multi-seat licenses disabled**.
- Each license is verified against Gumroad server-side and permanently bound to
  one Discord user and one Gumroad sale ID in D1.
- Gumroad's cancellation/ended/failed timestamps are **paid membership end
  dates**, not necessarily cancellation request dates. Valid pre-end access remains.
- Premium is checked every 5 minutes (cached). Unverifiable or revoked licenses
  are denied; refunds, disputes, chargebacks and expired memberships fail closed.

## Mandatory launch preparations

- [x] Gumroad license verification + Discord redemption UI built on launch-prep
- [x] Nitrado OAuth and server ownership check integrated with Gumroad Premium
- [x] Former production Stripe checkout and webhook routes disabled and dead
      Stripe backend code removed (Stripe sandbox unchanged)
- [x] Unique sale and license bindings; encrypted Gumroad keys and abuse throttle
- [x] Regression fixtures and GitHub Action added
- [ ] Check GitHub Actions reports the security tests passing
- [ ] Ask Gumroad Support to confirm that access to original web-based DayZ
      server management **software tools** through Gumroad Membership licensing
      is permitted under their off-platform-service restrictions
- [ ] Finish Individual payout verification; payout KYC may still request ID
- [ ] Confirm membership product is published and that **€5.99/month** is the
      desired recurring tier, rather than an unintended annual/quarterly offer
- [ ] Confirm user-facing support information, Terms, privacy and tax/KvK
      compliance; Gumroad being merchant of record does not eliminate income tax
- [ ] Create new Cloudflare D1 database `buildit-production` and run both
      SQL files, in order:
      `cloudflare/production/schema.sql`,
      `cloudflare/production/gumroad-schema.sql`
- [ ] Replace `REPLACE_WITH_NEW_PRODUCTION_D1_DATABASE_ID` in the
      **launch-prep** root `wrangler.jsonc` with the new D1 UUID
- [ ] Create a separate Cloudflare Worker named **buildit-app** with GitHub
      branch **launch-prep**. Leave builds disabled until setup is complete
- [ ] Bind hostname **app.builditplus.net** to buildit-app (Cloudflare zone);
      do not overwrite the root website or existing production log Worker
- [ ] Set all Cloudflare production secrets/variables below
- [ ] Add app callback URL to Discord and Nitrado OAuth application settings
- [ ] Safely enable auto-build on the isolated production Worker
- [ ] Test Gumroad membership redemption (and invalid/duplicate keys),
      sign-in, Nitrado server selection, file read/write and renewal/cancellation
- [ ] Verify paid access in production, only then add login link to root website

## Cloudflare production Worker environment

Use Worker **buildit-app** only. Do not place secret values in GitHub,
screenshots, chat messages or your website source.

| Variable | Type | Required value |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Text | Discord app ID |
| `DISCORD_CLIENT_SECRET` | Secret | Discord app client secret |
| `DISCORD_REDIRECT_URI` | Text | `https://app.builditplus.net/api/auth/callback` |
| `NITRADO_CLIENT_ID` | Text | Nitrado app client ID |
| `NITRADO_CLIENT_SECRET` | Secret | Nitrado app client secret |
| `NITRADO_REDIRECT_URI` | Text | `https://app.builditplus.net/api/nitrado/callback` |
| `NITRADO_ENCRYPTION_KEY` | Secret | Base64 of **32 new random bytes**; securely back up |
| `GUMROAD_PRODUCT_ID` | Text | Product ID copied from Gumroad's license key block |
| `GUMROAD_BUY_URL` | Text | Public Gumroad URL, e.g. `https://seller.gumroad.com/l/product` |

No Stripe settings are required for this Gumroad production Worker.

## Database and code files

- `cloudflare/production/worker.js`: OAuth, Gumroad verification,
  member entitlement, Nitrado API and authenticated web tools
- `cloudflare/production/schema.sql`: users, sessions and Nitrado OAuth tables
  (plus dormant historical Stripe schema tables; not used by this implementation)
- `cloudflare/production/gumroad-schema.sql`: D1 memberships, unique sale/key
  binding, encrypted license and redemption throttling
- `cloudflare/production/security.test.cjs`: no-credential regression tests
- `wrangler.jsonc`: deliberately invalid D1 ID until setup is complete,
  with `name=buildit-app`, GitHub branch `launch-prep`, and secured static assets

CI: `node --test cloudflare/production/security.test.cjs`

## Important limitations

- This is an integration implementation, **not a successful live payment
  or deployed production service**. No paid customer has been tested.
- A live purchase cannot be verified without configuring the actual
  Gumroad Product ID, public checkout URL, production D1 and OAuth callbacks.
- License invalidation may be delayed up to five minutes by the bounded cache;
  network errors deny new verification access.
- For privacy, no Gumroad buyer email is stored or logged by the entitlement
  Worker; the seller keeps financial obligations through Gumroad.
