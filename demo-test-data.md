# RetainIQ+ demo test data

Quick reference for live demo flows: owner dashboard → send flex offer → member confirm with Pinch.

Last synced from the current Supabase seed + Pinch sandbox setup.

---

## Local URLs

| Service | URL |
|---|---|
| Owner app | http://localhost:3000 |
| API | http://localhost:8000 |
| API health | http://localhost:8000/health |
| Members list | http://localhost:3000/members |

Set in `apps/api/.env` and `apps/web/.env`:

- `WEB_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`

---

## Pinch sandbox IDs

Configured in `apps/api/.env` (secrets stay in `.env` — do not commit).

| Setting | Value | Notes |
|---|---|---|
| `PINCH_BASE_URL` | `https://api.getpinch.com.au/test` | Test mode |
| `PINCH_MERCHANT_ID` | `app_test_fGC66Tz2Cy9u1D` | OAuth client ID |
| `PINCH_STANDARD_PLAN_ID` | `pln_NNeAScECSrVM1u` | RetainIQ+ Standard v1 ($89/mo) |
| `PINCH_HOLD_PLAN_ID` | `pln_5QvgWJa0BRHvI7` | RetainIQ+ Hold / Flex v1 ($10/mo base) |
| `PINCH_PAYER_SARAH` | `pyr_Uo8cU03lDnqupk` | Sarah Chen |
| `PINCH_PAYER_MARCUS` | `pyr_Mtt2mQwHjxGpDK` | Marcus Webb |
| `PINCH_PAYER_AVERY` | `pyr_fFZuCmwXVmcNiX` | Avery Davis |

Re-run sandbox wiring if IDs drift:

```bash
cd apps/api
source .venv/bin/activate
python -m scripts.setup_pinch_sandbox --clear-interventions
```

---

## Primary demo personas

Fixed UUIDs — stable across re-seeds.

| Name | Risk tier | Phone | Member ID | Pinch payer | Live send? |
|---|---|---|---|---|---|
| **Sarah Chen** | Critical | `+61400101001` | `11111111-1111-1111-1111-111111111101` | `pyr_Uo8cU03lDnqupk` | Yes |
| **Marcus Webb** | Slipping | `+61400101002` | `11111111-1111-1111-1111-111111111102` | `pyr_Mtt2mQwHjxGpDK` | Yes |
| **Jamie Torres** | Healthy (applied flex) | `+61400101003` | `11111111-1111-1111-1111-111111111103` | *(not wired)* | No — show “already applied” / interventions history |

**Story beats**

- **Sarah** — ghosted ~24 days; best “critical → send flex plan” narrative.
- **Marcus** — slipping ~16 days; good secondary send demo.
- **Jamie** — already on flex (`applied` intervention); use on Interventions page to show completed outcome.

Direct member links:

- Sarah: http://localhost:3000/members/11111111-1111-1111-1111-111111111101
- Marcus: http://localhost:3000/members/11111111-1111-1111-1111-111111111102
- Jamie: http://localhost:3000/members/11111111-1111-1111-1111-111111111103

---

## Extra members wired to Pinch

Created by `setup_pinch_sandbox.py` for bulk critical/slipping coverage. All have active Standard subscriptions in Pinch.

| Name | Risk tier | Phone | Member ID | Pinch payer | Send status |
|---|---|---|---|---|---|
| Avery Davis | Critical | `+61400000007` | `25a6d34c-46bc-4a4d-984e-121d47aeb9dd` | `pyr_fFZuCmwXVmcNiX` | Available |

**Avery Davis — expected metrics (fixed demo persona)**

| Metric | Value |
|---|---|
| Days since last visit | ~37 |
| Churn probability | ~90% |
| Expected leave | **1 mo** (from 60d P via exponential survival) |
| Flex stay | ~6 mo |
| Flex structure | $10/wk + $6.67/visit (cap $35/wk) |
| Expected bill | ~$16.67/wk at 1 visit/wk |
| LTV | ~$130 |
| 12-mo value improvement | ~$300 |

Direct link: http://localhost:3000/members/25a6d34c-46bc-4a4d-984e-121d47aeb9dd

| Blake Rodriguez | Critical | `+61400000008` | `387da4d3-05b1-4737-ad94-86f24e16b1e0` | `pyr_klqNEdgAa6VcXt` | **Already offered** — use another member for a fresh send |
| Cameron Martinez | Critical | `+61400000009` | `f3efd8a5-b0e1-44d3-8e99-f236892ca625` | `pyr_OVdLuMyJ5JGzzP` | Available |
| Drew Lee | Slipping | `+61400000010` | `2bd2e347-6dea-4617-998f-66101678d9a6` | `pyr_wic38SgqTH1eWE` | Available |
| Elliot Walker | Slipping | `+61400000011` | `57beec03-1cef-44e5-9acd-c204210d61b0` | `pyr_5ZoP2ktmd6HOHi` | Available |

**Recommended for live send demo today:** Sarah Chen or Cameron Martinez (critical, no blocking intervention).

---

## Offers (API slugs)

| Slug | UI name | Use in demo |
|---|---|---|
| `hold_plan` | Flex Plan | **Yes** — MVP plan switch (base + per visit) |
| `winback_link` | Win-back | No — not the MVP flex product |
| `loyalty_plan` | Loyalty Discount | No — healthy tier only |

Preview/send API example:

```bash
curl -X POST "http://localhost:8000/api/v1/members/11111111-1111-1111-1111-111111111101/interventions/preview" \
  -H "Content-Type: application/json" \
  -d '{"offer_slug":"hold_plan"}'

curl -X POST "http://localhost:8000/api/v1/members/11111111-1111-1111-1111-111111111101/interventions" \
  -H "Content-Type: application/json" \
  -d '{"offer_slug":"hold_plan","confirmed":true}'
```

---

## Member offer flow (after send)

1. Owner sends offer → gets RetainIQ+ link: `http://localhost:3000/offer/{token}`
2. Member opens link → **Confirm with Pinch** → hosted checkout
3. Pinch redirects to: `http://localhost:3000/offer/{token}/complete`
4. API cancels Standard sub and creates Hold/Flex sub

**Active offer (Blake Rodriguez):**

- Offer page: http://localhost:3000/offer/UNmSRvByJkr1WGMUa6gIKylo98MqzUvs
- Complete URL: http://localhost:3000/offer/UNmSRvByJkr1WGMUa6gIKylo98MqzUvs/complete

---

## Pinch sandbox dummy payment data

Use these on the **hosted Pinch checkout** when a member clicks **Confirm with Pinch** on an offer page.  
Base URL must be test mode: `https://api.getpinch.com.au/test` (already set in `apps/api/.env`).

Docs: [Pinch test and live mode](https://docs.getpinch.com.au/docs/test-and-live-mode)

### Bank account (direct debit)

Any realistic-looking AU BSB + account number works in test mode. Pinch documents these two explicitly:

| Label | BSB | Account number | Account name |
|---|---|---|---|
| Generic test | `000-000` or `000000` | `0000000000` | Any name (e.g. Sarah Chen) |
| Alternate test | `000-001` or `000001` | `1234567890` | Any name |

**What our demo payers already have on file** (created by `setup_pinch_sandbox.py` when wiring Pinch):

| Field | Value |
|---|---|
| BSB | `000000` |
| Account number | `123456789` |
| Account name | Member’s full name (e.g. `Sarah Chen`, `Marcus Webb`) |

If checkout asks for BSB with a hyphen, use `000-000`. Without hyphen, `000000` is fine.

### Credit card

Any **future** expiry date and any CVC work with these numbers:

| Card number | Type | Region |
|---|---|---|
| `4242424242424242` | Visa | Australia |
| `4000000360000006` | Visa | Australia |
| `4012888888881881` | Visa | Australia |
| `378282246310005` | AMEX | Australia |
| `4111111111111111` | Visa | New Zealand |
| `5105105105105100` | Mastercard | New Zealand |

Example if the form asks for separate fields:

| Field | Example value |
|---|---|
| Card number | `4242424242424242` |
| Expiry | `12/30` (any future month/year) |
| CVC | `123` (any 3 digits; 4 for AMEX) |
| Name on card | Member’s name |

### Which method to pick on the offer page?

Payment links are created with both methods enabled:

- **Bank account** — direct debit; matches how sandbox payers were seeded
- **Credit card** — realtime; good for a quick demo if DDR/agreement steps feel heavy

Neither charges a real bank or card in test mode.

---

## Members without Pinch (UI-only)

~400 generated members use phones `+614000004` … `+614000407` (pattern: `+61400` + zero-padded index).

Most have `pinch_payer_id = NULL` or `REPLACE_PAYER_*` placeholders. They appear in the dashboard but **Send offer** is blocked with “Pinch payer not linked” unless you run `setup_pinch_sandbox.py`.

---

## Reset / refresh demo data

```bash
# Reseed Postgres (~407 members, personas, check-ins)
cd apps/api && source .venv/bin/activate
python -m scripts.seed_demo_data --yes

# Wire Pinch plans/payers + clear stale interventions on demo members
python -m scripts.setup_pinch_sandbox --clear-interventions

# Smoke checks
python -m scripts.smoke_pinch
python -m scripts.smoke_regression
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 502 on send | Pinch API error (e.g. missing `allowedPaymentMethods`) | Fixed in `pinch_client.py`; restart API |
| 409 “offer already sent” | Member has `offered` or `applied` intervention | Use another member or `--clear-interventions` |
| Preview works, send blocked | No `pinch_payer_id` on member | Run `setup_pinch_sandbox.py` |
| Demo mode (no Pinch) | Missing `PINCH_MERCHANT_ID` or `PINCH_API_KEY` | Fill both in `apps/api/.env` |
