# RetainIQ+ — Project Status

> **Last updated:** 2026-07-25 (Pinch OAuth client + sandbox setup script — needs `PINCH_MERCHANT_ID` to go live)
>
> **Product:** Gym retention pricing engine — detect churn risk, recommend variable pricing, send for member Pinch confirmation.
>
> **Docs:** [product.md](product.md) · [requirements.md](requirements.md) · [design.md](design.md) · [agent.md](agent.md)

---

## At a glance

| | |
|---|---|
| **Phase** | **Phase 4 — Polish** (Pinch sandbox + E2E) |
| **Demo-ready?** | Partial — frontend analytics wired to API; Pinch not configured |
| **Web dev server** | Running (`npm run dev` in `apps/web`) |
| **API server** | Running — Postgres connected |
| **Pinch** | Partial — `PINCH_API_KEY` set; add `PINCH_MERCHANT_ID` then run `setup_pinch_sandbox.py` |

---

## What to do next

Priority order for demo-ready MVP. Full detail in [requirements.md §0.5](requirements.md).

| # | Task | Status |
|---|---|---|
| 1 | Start Postgres — `docker compose up -d postgres`; verify `/health` → `database: connected` | ✅ |
| 2 | **Wire frontend to API insights (FR-017)** — consume `insights` + `value_projection`; remove `buildMemberInsight()` heuristics | ✅ |
| 3 | **Render `FlexPlanValueChart`** — member detail (at-risk), apply modal preview, Flex Plans row expand | ✅ |
| 4 | **Send offer + member confirm** — `offered`/`offer_token`, `/offer/[token]`, complete → plan switch | ✅ |
| 5 | **Pinch sandbox setup** — OAuth creds, `setup_pinch_sandbox.py`, plans + payers | ⚠️ Blocked on `PINCH_MERCHANT_ID` |
| 6 | **Update seed** — optional `PINCH_*` env vars preserve real IDs across re-seed | ✅ |
| 7 | **E2E smoke** — Sarah send → offer page → Pinch confirm → Flex Plans `applied` | ❌ |
| 8 | **Demo rehearsal** — 3-minute script (requirements §17) | ❌ |

### FR-017 checklist (frontend)

- [x] Extend `MemberDetail` type + `getMember()` in `lib/api.ts` for `insights` and `value_projection`
- [x] Member detail page uses API `insights` instead of `buildMemberInsight(member)`
- [x] `FlexPlanValueChart` on at-risk member detail when offer + projection exist
- [x] Value projection in apply-offer modal preview step
- [x] Expandable chart on Flex Plans `/actions` rows

---

## Definition of done (hackathon MVP)

From [requirements.md §17](requirements.md):

- [ ] Dashboard loads seeded members with correct tier counts
- [x] Member detail shows **API-driven** churn probability, LTV, and value projection (not client heuristics)
- [ ] At least one live Pinch plan switch succeeds in sandbox
- [ ] At least one live Pinch payment link is generated
- [ ] Interventions log reflects applied actions
- [x] No Pinch secrets in frontend bundle
- [ ] 3-minute demo script completable without manual DB edits

---

## Component status

### Documentation

| Item | Status | Notes |
|---|---|---|
| product.md | ✅ Done | Product vision |
| requirements.md | ✅ Done | Source of truth; §0 updated with FR-017 done |
| design.md | ✅ Done | UI spec (dark SaaS theme) |
| status.md | ✅ Done | This file |
| agent.md | ✅ Done | Agent instructions |

### Database (`supabase/`)

| Item | Status | Notes |
|---|---|---|
| Schema migration | ✅ Done | `001_initial_schema.sql` + `002_offer_token.sql` |
| Seed data | ⚠️ Partial | ~100 members; Pinch IDs are `REPLACE_*` placeholders |
| Docker Compose | ✅ Done | Postgres on port 54322, auto-runs migration + seed |
| Postgres running | ✅ Running | API health returns `database: connected` |

### Backend (`apps/api/`)

| Item | Status | Notes |
|---|---|---|
| FastAPI scaffold | ✅ Done | `/health`, CORS, lazy DB pool |
| Risk scorer | ✅ Done | `services/scorer.py` |
| Regression insights | ✅ Done | `services/regression.py` — churn %, engagement, LTV, risk factors |
| Per-member pricing | ✅ Done | `services/pricing.py` — $30/week → base + per-entry flex |
| Value projection | ✅ Done | Flex monthly = base + expected_visits × per_entry |
| `GET /members` | ✅ Done | Summary counts, tier filter, sort |
| `GET /members/{id}` | ✅ Done | `insights`, `pricing_breakdown`, `value_projection`, suggested offer |
| `POST .../interventions/preview` | ✅ Done | Dynamic amount + `pricing_breakdown` + projection |
| `POST .../interventions` | ✅ Done | **Send** → `offered` + `offer_token` + payment link |
| `GET/POST /offers/{token}` | ✅ Done | Public offer + complete (plan switch) |
| `GET /interventions` | ✅ Done | Amount + `offer_url` + value_projection |
| Pinch client | ✅ Done | OAuth + `pinch-version`; `setup_pinch_sandbox.py`, `smoke_pinch.py` |
| `WEB_APP_URL` | ✅ Done | Builds offer + Pinch return URLs |
| Regression smoke | ✅ Done | `python -m scripts.smoke_regression` |
| Pinch sandbox + live test | ⚠️ Blocked | Need `PINCH_MERCHANT_ID` (Application ID from portal) |

### Frontend (`apps/web/`)

| Item | Status | Notes |
|---|---|---|
| App shell + nav | ✅ Done | Sidebar skipped on `/offer/*` |
| Overview `/` | ✅ Wired | `GET /members` |
| Members list `/members` | ✅ Wired | API fetch + client-side search/tier filter |
| Member detail `/members/[id]` | ✅ Wired | `$X/wk + $Y/visit` + Send Offer |
| Send offer modal | ✅ Wired | Success = copy `/offer/...` link |
| Member offer `/offer/[token]` | ✅ Wired | Confirm with Pinch CTA |
| Offer complete page | ✅ Wired | Completes intervention after Pinch return |
| Actions `/actions` | ✅ Wired | Offered/Applied tabs + copy link |
| `FlexPlanValueChart` | ✅ Wired | Detail, modal, Flex Plans expand |
| API client (`lib/api.ts`) | ✅ Done | Send + getOffer + completeOffer |

### Pinch sandbox (manual setup)

| Item | Status | Notes |
|---|---|---|
| Sandbox secret key | ✅ Set | `PINCH_API_KEY` (sk_test_...) in `.env` |
| Sandbox merchant/app ID | ❌ Missing | Add `PINCH_MERCHANT_ID` from Pinch Developer Portal → API Keys |
| Standard + Hold plans | ❌ Not created | Run `.venv/bin/python -m scripts.setup_pinch_sandbox` after merchant ID |
| Test payers + subs | ❌ Not created | Created by setup script |
| Seed ID env vars | ✅ Done | `PINCH_STANDARD_PLAN_ID`, `PINCH_HOLD_PLAN_ID`, `PINCH_PAYER_*` |
| Pinch smoke tests | ⚠️ Partial | `smoke_pinch.py` skips until merchant ID set |

### Deployment

| Item | Status | Notes |
|---|---|---|
| Vercel (web) | ❌ Not deployed | |
| Railway/Render (API) | ❌ Not deployed | |
| Supabase hosted DB | ❌ Not set up | Local Docker only for now |
| Webhook endpoint | ❌ Not configured | Optional for MVP |

---

## Known issues

1. **`PINCH_MERCHANT_ID` missing** — Pinch OAuth requires Application/Merchant ID + secret key. Without it, flex signup runs in demo mode (no live Pinch hosted confirm URL).
2. **Seed payer IDs** — DB still has `REPLACE_*` until setup script runs with valid OAuth creds.
3. **Loyalty offer in seed** — `loyalty_plan` row exists but is out of MVP scope (ignore or remove later).

---

## Demo script checklist

- [ ] Open overview — tier counts look realistic (~15 Critical, ~25 Slipping)
- [ ] Filter Critical → click Sarah Chen
- [ ] Member detail — 24 days inactive, regression churn %, LTV, computed flex amount + pricing rationale + value chart
- [ ] Preview & Send → copy `/offer/...` link; Flex Plans shows `offered`
- [ ] Open offer link → Confirm with Pinch → complete → status `applied`
- [ ] Marcus Webb → send flex offer (optionally leave as `offered`)
- [ ] Jamie Torres (Healthy) — no pricing offer shown

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-25 | **Pinch live wiring:** OAuth in `pinch_client.py`; `setup_pinch_sandbox.py` + `smoke_pinch.py`; seed preserves `PINCH_*` IDs; `_resolve_hold_plan_id` skips `REPLACE_*`; demo mode requires both merchant ID + secret. |
| 2026-07-25 | Created `status.md` and `agent.md`. Documented current state: backend ~90%, frontend UI done on dummy data, Pinch/DB not connected. |
| 2026-07-25 | Fixed `.gitignore` — removed bare `lib/` rule that blocked `apps/web/src/lib/` from git. |
| 2026-07-25 | Wired frontend to API: added `lib/api.ts`, removed `dummy-data.ts`, renamed `/interventions` → `/actions` (Flex Plans page), connected apply modal to Pinch endpoints. |
| 2026-07-25 | Backend analytics: `regression.py` + LTV; `GET /members/{id}` returns `insights`/`value_projection`; preview includes projection; smoke via `scripts/smoke_regression.py`. |
| 2026-07-25 | Updated requirements §0 + status with next steps: FR-017 frontend wiring, Postgres, Pinch sandbox, E2E demo. |
| 2026-07-25 | **FR-017 done:** frontend consumes API `insights`/`value_projection`; `FlexPlanValueChart` on detail, apply modal, Flex Plans expand; removed `buildMemberInsight` heuristics. |
| 2026-07-25 | **Dynamic flex pricing:** `pricing.py` computes per-member hold/win-back from quit + flex retention; docs/API/UI show `pricing_breakdown`; smoke shows distinct Sarah/Marcus amounts. |
| 2026-07-25 | **Base + per-entry flex:** anchored to $30/week; Critical+Slipping both get flex (no one-off win-back); UI shows `$X/mo + $Y/visit` and break-even. |
| 2026-07-25 | **Weekly flex + max cap:** prices are $/wk + $/visit with `max_cap_weekly_cents` always ≥ $30/wk; UI/docs updated. |

---

*Agents: update this file after every meaningful change. See [agent.md](agent.md).*
