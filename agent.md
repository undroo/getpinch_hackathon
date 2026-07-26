# RetainIQ+ — Agent Instructions

Instructions for AI coding agents working on this hackathon repo.

---

## Before you start

1. Read [status.md](status.md) — current blockers, what's done, what's next.
2. Read [requirements.md](requirements.md) for MVP scope and API contract.
3. Read [design.md](design.md) when touching UI.
4. Do **not** expand scope into out-of-scope items listed in requirements.md §3 (ML, auto-deploy, CRM integrations, loyalty, SMS, etc.) unless the user explicitly asks.

---

## Project layout

```
/
├── apps/
│   ├── api/          # FastAPI — scoring, members, interventions, Pinch client
│   └── web/          # Next.js 15 — owner dashboard
├── supabase/
│   ├── migrations/   # Postgres schema
│   └── seed.sql      # ~100 demo members (Pinch IDs need real sandbox values)
├── product.md        # Vision
├── requirements.md   # MVP spec (source of truth)
├── design.md         # UI spec
├── status.md         # Live project tracker — KEEP UPDATED
├── agent.md          # This file
└── docker-compose.yml
```

### Key paths

| Area | Path |
|---|---|
| Risk scoring rules | `apps/api/app/services/scorer.py` |
| Per-member flex pricing | `apps/api/app/services/pricing.py` |
| Value projection | `apps/api/app/services/value_projection.py` |
| Members API | `apps/api/app/routers/members.py` |
| Apply / interventions API | `apps/api/app/routers/interventions.py` |
| Pinch HTTP client | `apps/api/app/services/pinch_client.py` |
| Frontend dummy data (replace me) | `apps/web/src/lib/dummy-data.ts` |
| Frontend types | `apps/web/src/lib/types.ts` |
| Apply modal | `apps/web/src/components/apply-offer-modal.tsx` |

### Local dev

```bash
# Postgres (from repo root)
docker compose up -d postgres

# API (from apps/api)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Web (from apps/web)
npm run dev
```

Env files: `apps/api/.env`, `apps/web/.env` (see `.env.example` in each app).

---

## Mandatory: update status.md

**After every session where you make changes**, update [status.md](status.md):

1. Set **Last updated** date at the top.
2. Update **At a glance** (phase, demo-ready, server status if you verified).
3. Flip component rows from ❌/⚠️ to ✅ when completed.
4. Update **Definition of done** checkboxes when criteria are met.
5. Add a row to **Changelog** with date + one-line summary of what changed.
6. Remove resolved items from **Known issues**; add new blockers you discover.
7. Adjust **Critical path** if priorities shifted.

### Changelog format

```markdown
| 2026-07-25 | Wired overview page to GET /members; removed dummy-data from page.tsx |
```

Be specific: mention files, endpoints, or features — not vague "made progress".

### When NOT to skip the update

- Any code change (API, web, schema, seed)
- Env / Pinch / DB setup steps completed
- Bug fixes or refactors that affect demo flow
- Deployment or infrastructure changes

If you only answered a question with no code changes, do not update status.md.

---

## Build priorities (in order)

1. **Infrastructure** — Postgres up, API health green, Pinch key set
2. **Pinch sandbox** — plans, payers, subscriptions; real IDs in DB/seed
3. **Frontend ↔ API** — replace `dummy-data` with `lib/api.ts` fetch calls
4. **Apply flow E2E** — preview + confirm modal calls real Pinch via API
5. **Demo polish** — rehearse script, fix edge cases, optional deploy

---

## Implementation rules

### Scope

- MVP = rule-based churn scoring + owner dashboard + manual Pinch flex pricing.
- Offers for **Critical and Slipping**: flex plan = **base + per entry** (no one-off win-back). Both map to `hold_plan` plan_switch.
- Pricing is **weekly**: base/wk + per visit, with `max_cap_weekly_cents` always ≥ $30/week (`apps/api/app/services/pricing.py`).
- API returns `pricing_breakdown` with `base_weekly_cents`, `per_entry_cents`, `max_cap_weekly_cents`, `estimated_weekly_cents`.
- Pinch secrets **server-side only** — never `NEXT_PUBLIC_PINCH_*`.

### Code style

- Match existing patterns in each app.
- Minimal diffs — don't refactor unrelated code.
- Don't add tests unless asked.
- Don't commit unless the user asks.

### API contract

Base path: `/api/v1`. See requirements.md §14 for request/response shapes.

Apply flow for flex: cancel active subscription → create subscription on Hold/Flex plan for the **base** fee (Pinch has no "switch plan" API). Per-entry is RetainIQ+ economics only in MVP.

### Frontend

- Stack: Next.js 15 App Router, Tailwind, shadcn/ui, dark theme from design.md.
- `NEXT_PUBLIC_API_URL` points to FastAPI (default `http://localhost:8000/api/v1`).
- Multi-tier filter on members page: API supports single `risk_tier` param — filter client-side or extend API.

### Database

- Seed has `REPLACE_*` placeholders for Pinch IDs until sandbox is configured.
- `loyalty_plan` in seed is out of MVP scope — do not build UI for it.

### Gitignore

Root `.gitignore` previously had bare `lib/` (Python artifact) which ignored `apps/web/src/lib/`. **Fixed 2026-07-25** — use scoped paths like `apps/api/lib/` if needed.

---

## Pinch sandbox checklist

When setting up Pinch (requirements.md §12):

1. Get test API key → `PINCH_API_KEY` in `apps/api/.env`
2. Create **RetainIQ+ Standard v1** (~$89/mo) and **RetainIQ+ Hold v1** ($10/mo) plans
3. Create payers + active Standard subscriptions for demo members (Sarah Chen, Marcus Webb, + others)
4. Update `gym_config` and `members.pinch_payer_id` with real IDs
5. Smoke test: list subs, calculated-payments preview, payment link, cancel + recreate

---

## Success = demo script works

The hackathon is done when requirements.md §17 demo script runs end-to-end in under 3 minutes with live Pinch sandbox calls — no manual DB edits mid-demo.

Track progress in [status.md](status.md).
