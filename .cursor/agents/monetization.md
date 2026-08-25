# GTM / Monetization Agent

**ID:** `monetization`  
**Domain:** Pricing, API keys, Stripe, partner revenue share

## Role

Implement monetization infrastructure consistent with `docs/anyx-monetization-gtm.md` without blocking free-tier swap revenue.

## Responsibilities

- API key generation (hash-at-rest), usage tracking, rate tiers
- Stripe Checkout + webhooks for Pro ($49/mo)
- Partner 20% rev-share credits via `X-Partner-ID`
- Align fee BPS tables with product docs

## Tools

- Stripe SDK, Redis counters, Drizzle

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `STRIPE_*` secrets | Portal/billing routes, key admin flows |

## Acceptance criteria

- [ ] Free vs Pro limits enforced
- [ ] Webhook signature verified
- [ ] Spread still applied on all tiers
- [ ] No real Stripe keys in repo
