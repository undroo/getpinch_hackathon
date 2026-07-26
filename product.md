# RetainIQ+ — Product Vision

> **Implementation details:** See [requirements.md](requirements.md) and [design.md](design.md).

---

**Product name:** RetainIQ+

**Tagline:** Keep members at the gym with the right price — before they cancel.

## Value proposition

Gyms lose revenue when members quietly disengage and then cancel. By the time an owner hears about it, the member has already decided to leave.

RetainIQ+ identifies members who are **expected to leave** and helps gym owners respond with **variable pricing offers** — delivered through Pinch Payments — that make staying more attractive than cancelling.

The product is not a general engagement platform, loyalty program, or outreach tool. It is a **retention pricing engine**: detect churn risk, recommend a price adjustment, send it for the member to accept via Pinch.

## How it works

```
┌─────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│   Gym check-in data     │      │   RetainIQ+ churn score  │      │  Pinch Payments         │
│   (seeded in MVP)       │─────►│   + flex pricing engine   │─────►│  (confirm + plan switch)│
└─────────────────────────┘      └───────────────────────────┘      └─────────────────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         ▼                                           ▼
               ┌───────────────────────┐               ┌───────────────────────────┐
               │   Gym owner dashboard │               │   Member offer page       │
               │   (preview & send)    │──────────────►│   /offer/[token] → Pinch  │
               └───────────────────────┘               └───────────────────────────┘
```

1. **Detect** — Rule-based churn scoring flags members whose visit pattern suggests they are likely to cancel.
2. **Price** — For each at-risk member, compute a **flex plan**: dynamic monthly base + per-entry charge, anchored to a $30/week unlimited rate, sized for casual visitors (not power users).
3. **Send** — The owner previews the flex offer and sends a tokenized link. The member opens `/offer/[token]`, reviews terms, and **confirms with Get Pinch payments**. Only then does RetainIQ+ switch the subscription. The gym cannot silently apply the plan.

## Core capabilities (MVP)

### Churn detection

- Ingest check-in frequency and recency.
- Score members into risk tiers so owners know **who is expected to leave**.

### Flex plans (via Pinch)

When a member is at risk of leaving, RetainIQ+ recommends a **flex plan** — not a flat fee and not a one-off discount:

| Component | Meaning |
|---|---|
| **Base** | Dynamic **weekly** fee (lower when churn risk is higher) |
| **Per entry** | Dynamic charge per visit |
| **Max cap** | Weekly bill ceiling — always ≥ $30/week unlimited |
| **Break-even** | Visits/week where flex ≈ unlimited — above that (until cap), power users prefer unlimited |

Both Critical and Slipping get the same flex shape; amounts differ per member from churn probability, quit/retention estimates, and recent visits. Flex is cheaper than unlimited for casual cadence and more expensive for high visit frequency.

Offers are **pricing interventions**, not generic nudges. The goal is always the same: give the member a financially viable reason to stay — and require their Pinch confirmation before billing changes.

## Explicitly out of scope

These are deferred to keep the hackathon focused on retention pricing:

- Loyalty rewards for already-engaged members
- SMS / WhatsApp / email outreach agents (owner copies the offer link)
- Automated offer send without owner approval
- Silent gym-side plan switches without member Pinch confirmation
- ML churn models
- Real gym CRM integrations (Mindbody, PushPress)
- Accounting sync (Xero, MYOB, QuickBooks)
- Failed-payment recovery flows
- Full member self-serve portal (login, history, manage membership) — **tokenized `/offer/[token]` is in MVP**
- Owner-editable base/entry fields (amounts are system-computed in MVP)
- One-off win-back payment links as the product offer (MVP flex is base + per entry; Pinch links deliver confirmation)
- Live Pinch per-visit metering (economics in RetainIQ+; Pinch bills the base plan after confirm)

## Success metric

A member who would have cancelled instead **accepts** a flex pricing offer on Pinch and remains on a paid membership — measured through Pinch confirmation completion and the resulting flex subscription.
