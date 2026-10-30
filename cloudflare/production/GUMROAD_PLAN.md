# Build It!++ — Gumroad Membership launch integration

**Chosen model (2026-10-30):** Gumroad **Membership** sold by an **Individual** seller.
This supersedes the earlier proposal for one-time 30-day license purchases.

**Product:** Paid recurring access to Build It!++ website software tools.
Customers use **their own Nitrado account/server**. Build It!++ does not sell
or host game servers.

**Pricing:** EUR 5.99/month for Build It!++ Premium (seller-confirmed on 2026-10-30),
chosen to account for Gumroad transaction fees. Gumroad also currently displays
quarterly, 6-month, yearly and 2-yearly membership tiers: verify whether to
retain them and confirm their prices before publishing. The app must reflect
the actual Gumroad price and never claim "one-time" or "no renewal" for Membership.

**Seller status:** Gumroad Individual is supported without business-registration
documents according to Gumroad's payout guidance, but identity verification for
bank payouts may still require personal ID and national ID details; operating a
commercial business can separately trigger Dutch KvK/tax obligations.

## Customer journey

1. Customer signs in to Build It!++ with Discord.
2. Customer purchases a Gumroad Membership at the declared recurring rate.
3. Customer receives a Gumroad-generated **license key**, enters it in
   `/account` to link the membership to their Discord identity.
4. Cloudflare Worker calls Gumroad **license verify API** with the exact product ID
   and the license key, with `increment_uses_count=false`.
5. Grant Premium **while the verified membership is active**. Never assume
   `sale_timestamp + 30 days` for subscriptions.
6. A Gumroad cancellation leaves access until membership end. Gumroad's
   `subscription_cancelled_at`, `subscription_ended_at` and
   `subscription_failed_at` are **membership end dates**; terminate when
   the applicable timestamp is reached, or if verification says otherwise.
7. Refunds, disputes and chargebacks block new redemptions and revoke
   access per verified provider status and refund policy.
8. Member can manage/cancel on Gumroad. Website shows link to Gumroad
   membership management and access status.
9. One Gumroad subscription/license can bind to **only one** Discord user.
   Use DB uniqueness, same-transaction writes, and per-user authorization.
10. Verify entitlement server-side on tool access, with a bounded verification
    cache and fail-closed policy once verification is stale; do not trust
    browser state. Keep encrypted key for rechecks, not plaintext.
11. Access to the user's Nitrado server follows the same selected-service,
    OAuth and verified-owner checks already in the Stage 4 Worker.

## Technical notes

- License keys are supported on Gumroad Membership tiers, including via the
  Content tab. Keep multi-seat option disabled for one Discord user per license.
- Gumroad's license-verify response can include `subscription_id`,
  `recurrence`, `subscription_cancelled_at`, `subscription_ended_at`,
  `subscription_failed_at`, `refunded`, `disputed`, `chargebacked`.
- Renewal **does not change** original `sale_timestamp` or `created_at`.
- A license key may stay enabled after a subscription ended; rely on verified
  subscription end status, not just `success:true`.
- No Gumroad API secrets in client JavaScript. Public product ID can be
  configured on production Worker as `GUMROAD_PRODUCT_ID`; seller account
  access tokens are not needed for the documented license verify endpoint.
- **Do not deploy** the current `cloudflare/production/worker.js` as a Gumroad
  implementation: it still contains the previous Stripe Live workflow.

## Before publishing

- [ ] Gumroad approves software access delivered outside Gumroad under
      its current prohibited-services policy
- [ ] Seller's payout settings configured honestly as Individual and any
      required verification fulfilled
- [x] Monthly recurring price agreed: **EUR 5.99/month**
- [ ] Decide whether longer-term membership pricing/frequencies remain offered
- [ ] Gumroad Membership tier enabled and license-key block saved
- [ ] Get public Gumroad product ID and purchase link
- [ ] Finish production D1 setup independent of sandbox
- [ ] Implement real Gumroad membership verification and unique Discord binding
- [ ] Implement server-side renewal/cancel/end/failed payment/refund enforcement
- [ ] Build account UI: redeem, active status, manage/cancel membership
- [ ] Add tests for two users, stale verification, replayed/reassigned
      licenses, cancellations within paid period and failed renewals
- [ ] Real purchase + cancellation flow tested; no self-purchases for testing,
      Gumroad recommends its test purchase feature
- [ ] Confirm privacy, consumer terms and Dutch business/tax compliance

## Vendor documentation

- Gumroad memberships: https://gumroad.com/help/article/82-membership-products
- License-key state & subscription end timestamps: https://gumroad.com/help/article/76-license-keys
- Individual seller / KYC: https://gumroad.com/help/article/260-your-payout-settings-page
- Gumroad product rules: https://gumroad.com/help/article/155-things-you-cant-sell-on-gumroad
- Gumroad fees: https://gumroad.com/pricing

**Deployment discipline:** Changes are only on `launch-prep`.
Do not modify the live `main` website, the production Nitrado logs Worker,
or the working `auth-test-deploy` Stripe sandbox.
