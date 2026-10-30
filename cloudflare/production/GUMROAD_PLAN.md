# Build It!++ payment plan: Gumroad — 30-day software access

Status: design proposal, not yet implemented or deployed. Existing Stripe sandbox and all Nitrado tools remain unchanged.

## Product and customer journey

- **Product:** Build It!++ Premium, 30 days' access to the Build It!++ website tools, **NOT** Nitrado servers or hosting.
- **Price:** EUR 4.99, one-time purchase, **no automatic renewal**.
- Customer signs in to Build It!++ with Discord and buys the product via a Gumroad checkout link.
- Gumroad issues a **license key** in the purchase receipt. The customer enters this in their Build It!++ account page.
- Cloudflare Worker checks Gumroad's **official License Verify API** server-side with the configured `product_id`; use `increment_uses_count=false`.
- Accept only a paid, non-refunded, non-disputed, non-chargebacked purchase of our configured product. Never grant access just because a client claims payment or has a receipt screenshot.
- Link each Gumroad sale ID/license key to **one Discord user ID** in an isolated production D1 database. Store a keyed hash of the license key, not the raw key, except where a securely encrypted value is necessary for later Gumroad checks.
- Set entitlement expiry from the verified original sale timestamp plus 30*24 hours. A license should not gain 30 new days each time it is redeemed.
- On new purchase, expiry should extend according to a documented renewal policy; never re-use a previously redeemed sale to extend access.
- A customer can read their expiry date on /account. Access to /app and write API denied automatically after expiry.
- Consider real-time/license-status revalidation with caching and a documented revoke/refund mechanism. If Gumroad verification is unavailable, fail closed for new redemptions.
- Verify the same sale cannot be claimed on two Discord accounts (atomic D1 uniqueness constraint).
- The Nitrado OAuth service remains scoped to each logged-in Discord user. An expired entitlement revokes tool access, but never modifies their actual Nitrado server files.

## Official references

- License API, per-product identity, `increment_uses_count`, refunded/disputed fields:
  https://gumroad.com/help/article/76-license-keys
- Gumroad Individual seller / payout verification:
  https://gumroad.com/help/article/260-your-payout-settings-page
- Gumroad current processing/transaction fees:
  https://gumroad.com/help/article/66-gumroads-fees
- Gumroad prohibited external services / software guidance:
  https://gumroad.com/help/article/155-things-you-cant-sell-on-gumroad
- Gumroad Merchant of Record tax policy:
  https://gumroad.com/pricing

## Launch blockers (do NOT activate checkout until these are resolved)

- [ ] Gumroad seller signup and payout settings completed as **Individual**, without falsely claiming a KvK registration
- [ ] Seller understands Gumroad bank payout for Netherlands may still require **photo ID / national identity** verification via Stripe; this platform is **not** a way to avoid KYC
- [ ] Confirm with Gumroad Support that off-platform access to our **original SaaS/software tools** via license-key activation is permitted under current products policy
- [ ] Review fees: direct sales have 10% + USD 0.50 Gumroad fee, PLUS separate card processing (e.g. 2.9% + USD 0.30), which is material for EUR 4.99
- [ ] Decide how Gumroad displays VAT/total and how EUR 4.99 is communicated (Merchant of Record handles applicable sales taxes, not seller income tax)
- [ ] User creates a **one-time digital software product** (not Membership) and adds Gumroad's built-in License Key block. Product is not publicly offered until policy reviewed
- [ ] Confirm live product **product ID** and public buy URL (neither is a credential)
- [ ] Add production D1 schema with unique Gumroad sale / license bindings and expiry
- [ ] Implement server-side redemption, product verification, refund/dispute checks, account UI, expiry and renewal; no reliance on webhook without a secure authenticated/verified method
- [ ] Verify two-user isolation, replay of purchase, refunded purchase and expired license tests
- [ ] Privacy, Terms, cancellation/withdrawal, refund, support, consumer rights and local tax / KvK obligations reviewed
- [ ] Bind separate production Cloudflare Worker and D1; do NOT modify `buildit-auth-test` or `buildit-nitrado-logs`
- [ ] Run a real purchase and access test before opening sales

## Stripe status

The `cloudflare/production/worker.js` file on `launch-prep` is a **previous Stripe Live implementation**, not the chosen Gumroad integration. Do not deploy it as Gumroad checkout. Keep the existing functioning Stripe sandbox separate until Gumroad access has been fully built and tested.

## Personal data

Do not request/put Gumroad seller passport/BSN, bank data, licenses, access tokens or credentials in GitHub or ChatGPT. Seller payout verification happens solely inside Gumroad's own interface.
