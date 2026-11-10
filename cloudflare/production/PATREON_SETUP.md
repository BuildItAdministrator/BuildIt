# Patreon membership integration — development version

Implemented in the production Worker source; **not deployed or tested with a live Patreon account**.
Use only the separate `buildit-app` Worker and `buildit-production` D1 database.
Do not modify the existing website, auth-test Worker, or Nitrado Worker.

## Account flow

Customers sign in with Discord, select **Connect Patreon**, authorize Patreon,
and return to the account page. Premium then unlocks their own Nitrado connection
and tools. One Patreon identity can be linked to only one Discord account.
There is deliberately no self-service transfer between Discord accounts.

Entitlement requires the configured campaign, an explicitly allowed currently
entitled tier, a positive entitled amount, and last charge status `Paid`.
Declined, refunded, free, and unrecognized memberships cannot unlock tools.
A former/cancelled member retains access only while Patreon still returns a
paid entitled tier. Trials and gifts without a successful charge are excluded
from this first version; do not offer these until their policy is implemented.

Access is checked on protected requests, with a maximum five-minute cache.
There is no webhook or background job in this version. After cache expiry,
verification failures deny access. Token refresh is automatic and serialized.
Tokens are encrypted with the existing encryption key under a separate Patreon
user context. Patreon tokens, email addresses and client secrets are never
returned to the browser. No additional email scope is requested.

## Setup

1. Register an API v2 client at https://www.patreon.com/portal/registration/register-clients
   from the creator account that owns Build It!++.
2. Register the exact callback:
   `https://app.builditplus.net/api/patreon/callback`.
   This hostname must first be configured on the isolated `buildit-app` Worker.
3. Apply `schema.sql` followed by `patreon-schema.sql` to **buildit-production only**.
   Existing Gumroad records can remain. They do not grant access in Patreon mode.
4. Set the following variables and secrets on **buildit-app only**:

| Name | Type | Value |
| --- | --- | --- |
| BILLING_PROVIDER | Text | `patreon` |
| PATREON_CLIENT_ID | Text | Registered v2 client ID |
| PATREON_CLIENT_SECRET | Secret | Registered client secret |
| PATREON_REDIRECT_URI | Text | Exact callback above |
| PATREON_CAMPAIGN_ID | Text | Numeric Build It!++ campaign ID |
| PATREON_TIER_IDS | Text | Comma-separated numeric IDs of paid tiers granting access |
| PATREON_PAGE_URL | Text | Public HTTPS Patreon creator/membership page |
| NITRADO_ENCRYPTION_KEY | Secret | Existing valid 32-byte base64 encryption key; do not rotate casually |

Keep the existing Discord and Nitrado OAuth settings and DB/assets bindings.
Gumroad settings/tables are not required in Patreon mode. The default remains
Gumroad until `BILLING_PROVIDER=patreon` is explicitly set. Do not switch an
existing paying service without considering its existing customers.

Use the creator's API credentials privately to find campaign and tier IDs through
`GET https://www.patreon.com/api/oauth2/v2/campaigns?include=tiers` if needed.
Do not paste secrets into chat, GitHub, screenshots or source code.
The app checks IDs, not a hardcoded price. Configure the intended €5.99/month
membership in Patreon and confirm the checkout price before launch.

## Validation before release

Run `node --test cloudflare/production/*.test.cjs`.
Then test the real callback and membership fields on the isolated Worker:
paid member, wrong tier, nonmember, cancelled-but-still-entitled, expired,
declined payment, repeated callback and attempted duplicate Discord binding.
Confirm refresh behavior and access loss after the five-minute cache expires.
Test Nitrado reads/writes with the selected customer's service.
No live payment, real OAuth callback or browser flow has yet been verified.

Reference: https://docs.patreon.com/ (API v2 identity, memberships, OAuth).
