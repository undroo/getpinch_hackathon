# RetainIQ+ — Visual Design Specification

> **Purpose:** Source of truth for AI mockups and UI implementation. Describes look, feel, layout, and component behavior for the gym-owner retention dashboard.
>
> **Product:** RetainIQ+ — *Keep members at the gym with the right price — before they cancel.*
>
> **Audience for mockups:** Primary — gym owner / ops manager (Alex). Secondary — member offer page (`/offer/[token]`) for Pinch confirmation. Desktop-first for owner; member page must work on mobile.

---

## 1. Design Direction

### Brand & style

The brand personality is **professional, precise, and high-performance**, tailored for the Premium B2B SaaS market. It prioritizes clarity and efficiency, evoking technological sophistication and reliability.

The design style is **Corporate Modern with Minimalist influences**. Clean aesthetic with generous whitespace, subtle depth through shadows, and a sophisticated color palette. The interface avoids unnecessary ornamentation, focusing on data density and user flow.

**Branding is strictly typographic** — there is no logo icon. The wordmark **RetainIQ+** integrates directly into the system's high-end typography (`IQ+` in Iris Purple).

| Attribute | Target |
|---|---|
| Tone | Confident, analytical, calm under pressure |
| Density | Medium-high — lots of numbers, still scannable |
| Motion | Minimal; loading skeletons and badge pulse on Critical only |
| Personality | Precision instrument, not playful |

### What to avoid

- Bright gym-neon gradients, muscle imagery, stock photos of treadmills
- Dark "command center" themes — this is a light, premium B2B surface
- Overly decorative illustrations or logo icons
- Gradient primary buttons (use solid Iris Purple)

---

## 2. Color System

### Core palette (light theme — primary)

Foundation rests on a **soft white-to-grey gradient background** with **cool-toned neutrals**. Cards use pure white to pop against the subtle background.

| Token | Hex | Usage |
|---|---|---|
| `background` / `bg-base` | `#FBF8FE` | Page background (surface) |
| `bg-surface` | `#FFFFFF` | Cards, sidebar, table containers |
| `bg-elevated` | `#F6F2F8` | Hover states, sidebar active, dropdown base |
| `surface-container` | `#F0EDF2` | Gradient end, inset panels |
| `surface-container-high` | `#EAE7ED` | Unknown tier badge bg |
| `border-subtle` | `#E4E1E7` | Card borders, table dividers |
| `border-card` | `#E2E2E9` | Level 1 elevation border (spec) |
| `border-focus` | `#5442DE` | Input focus, active chip border |
| `text-primary` / `on-surface` | `#1B1B1F` | Headings, primary labels |
| `text-secondary` / `on-surface-variant` | `#474555` | Descriptions, column headers |
| `text-muted` / `outline` | `#787586` | Timestamps, helper text |
| `brand-primary` / `primary` | `#5442DE` | Iris Purple — CTAs, active nav, links |
| `primary-container` | `#6D5EF8` | Emphasized primary surfaces |
| `brand-secondary` / `secondary` | `#006D36` | Soft Emerald Green — success, positive metrics |
| `secondary-container` | `#83FBA5` | Success badge backgrounds |
| `tertiary` | `#934900` | Offered/pending status |
| `tertiary-container` | `#B85D00` | Tertiary emphasis |
| `error` | `#BA1A1A` | Failed status, destructive |
| `error-container` | `#FFDAD6` | Critical tier badge bg |
| `outline-variant` | `#C8C4D8` | Unknown tier border |

### Risk tier colors (semantic — consistent everywhere)

Tier colors must read instantly on light backgrounds. Use **badge + left border + dot** together.

| Tier | Label | Background | Text / border | Glow (optional) |
|---|---|---|---|---|
| **Critical** | High cancel risk | `#FFDAD6` | `#93000A` / `#BA1A1A` | `0 0 8px rgba(186,26,26,0.15)` |
| **Slipping** | Likely to leave | `#FFDCC6` | `#713700` / `#934900` | `0 0 8px rgba(147,73,0,0.12)` |
| **Healthy** | Low churn risk | `#83FBA5` | `#00743A` / `#006D36` | none |
| **Watch** | At risk (watch) | `#F0EDF2` | `#474555` / `#787586` | none |
| **Unknown** | Insufficient data | `#EAE7ED` | `#787586` / `#C8C4D8` | none |

### Status colors (interventions log)

| Status | Color |
|---|---|
| `applied` | Secondary green (`#006D36`) |
| `offered` | Tertiary amber (`#934900`) — sent, awaiting member Pinch confirm |
| `pending` | Tertiary amber (`#934900`) — legacy alias; prefer `offered` |
| `failed` | Error red (`#BA1A1A`) |

---

## 3. Typography

**Geist** exclusively. Geist's technical, monolinear construction reinforces the precise nature of the platform.

| Role | Token | Size / weight | Line height | Notes |
|---|---|---|---|---|
| **Display** | `display-lg` | 48px / 600 | 56px | Letter-spacing `-0.02em` |
| **Page title** | `headline-lg` | 32px / 600 | 40px | Letter-spacing `-0.01em` |
| **Page title (mobile)** | `headline-lg-mobile` | 24px / 600 | 32px | |
| **Section heading** | `headline-md` | 24px / 500 | 32px | |
| **Body large** | `body-lg` | 18px / 400 | 28px | |
| **Body** | `body-md` | 16px / 400 | 24px | Default UI text |
| **Body small** | `body-sm` | 14px / 400 | 20px | Table data, descriptions |
| **Label** | `label-md` | 14px / 500 | 16px | Letter-spacing `0.01em` |
| **Label small** | `label-sm` | 12px / 600 | 14px | Column headers, badges |
| **Metrics / KPI** | — | 36–48px / 600–700 | | Tabular nums on stat cards |
| **Code / IDs** | Geist Mono | 12–13px | | Pinch payer IDs, offer URLs |

Headlines use tighter letter spacing and semi-bold weights. Labels use medium or semi-bold weights so metadata doesn't disappear against subtle backgrounds.

---

## 4. Layout & Shell

### Grid & spacing

Fluid grid built on an **8px base unit**.

| Breakpoint | Columns | Margins | Gutters |
|---|---|---|---|
| Desktop (1440px+) | 12 | 32px | 24px |
| Tablet (768–1439px) | 8 | 24px | 24px |
| Mobile (<768px) | 4 | 16px | 16px |

Vertical rhythm: 8, 16, 24, 32, 48, 64px increments.

### App chrome

```
┌──────────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)          │  MAIN CONTENT (fluid, max ~1280px)   │
│  ─────────────────        │                                      │
│  RetainIQ+                │  Breadcrumb / page title             │
│  Demo Gym badge           │  Optional subtitle                   │
│                           │                                      │
│  ● Overview               │  ┌─────────┐ ┌─────────┐ ...       │
│  ○ Members                │  │ Stat    │ │ Stat    │           │
│  ○ Actions                │  └─────────┘ └─────────┘           │
│                           │                                      │
│  ─────────────────        │  [ Primary content area ]            │
│  Powered by Pinch         │                                      │
└──────────────────────────────────────────────────────────────────┘
```

- **Sidebar:** Fixed left, white `bg-surface`, right border `border-subtle`. Active nav: left 2px `brand-primary` bar + `bg-elevated`.
- **Top bar (mobile):** Hamburger + typographic wordmark only.
- **Content padding:** 32px desktop, 16px mobile.
- **Max content width:** 1280px centered in main pane.

### Background

Soft **white-to-grey vertical gradient** from `#FBF8FE` to `#F0EDF2` — premium feel, reduces screen fatigue in data-heavy views. No dot grid.

### Logo treatment

- Wordmark: **Retain** in `text-primary`; **IQ+** in `brand-primary` (Iris Purple).
- No icon, no mark — typographic only.

---

## 5. Core Components

### Stat cards (Overview)

Four cards in a row (wrap on tablet):

| Card | Icon | Example value | Subtext |
|---|---|---|---|
| Critical | Alert triangle | **15** | Needs action today |
| Slipping | Trend down | **25** | Likely to leave |
| Healthy | Check circle | **60** | Low churn risk |
| Unknown | Help circle | **5** | New / no data |

- Card: white `bg-surface`, 1px `#E2E2E9` border, 16px radius (`rounded-lg`), 20–24px padding.
- Large number uses tier color for Critical/Slipping/Healthy; Unknown uses muted gray.
- Critical card: subtle red outer glow.

### Data table

- Header row: uppercase labels, `text-secondary`, 11px, letter-spacing `0.05em`.
- Row height: 52–56px.
- **Left accent:** 3px vertical bar in tier color on each row.
- Hover: very light grey `#F8F8FA` / `bg-elevated`.
- Row dividers: 1px light grey.
- Sortable columns show chevron; default sort: severity (Critical first).

### Tier badge

Pill shape (`rounded-full`), 12px font, 600 weight, 4px vertical / 10px horizontal padding.

Example: `Critical` on `#FFDAD6` with `#93000A` text and 1px `#BA1A1A` border.

### Buttons

| Type | Style |
|---|---|
| **Primary** | Iris Purple (`#5442DE`) fill, white text, 8px radius |
| **Success** | Soft Emerald Green (`#006D36`) fill, white text |
| **Secondary** | Transparent, `border-subtle` border, `text-primary` |
| **Ghost** | No fill, Iris Purple or neutral text, subtle border on hover |
| **Destructive** | Red outline only — rarely used |

Primary CTA copy: **Send pricing offer**, **Preview in Pinch**, **Copy offer link**, **Confirm with Pinch** (member).

### Input fields

- Default: white background, 1px light grey border, 8px radius.
- Focus: 1px Iris Purple border with subtle 2px purple outer glow (low opacity).
- Icons: minimalist line icons (2px stroke) in medium grey.

### Chips & tags

Soft, desaturated accent backgrounds (e.g. light purple bg with dark purple text for active filters). Height 24px or 32px; full pill radius.

### Modal (Send offer)

- Overlay: `rgba(0,0,0,0.4)` with slight blur.
- Panel: white `bg-surface`, 480px max-width, 16px radius, popover shadow.
- Sections: Offer title → description → Pinch preview box (mono amounts) → Cancel / **Send offer**.
- Preview box: inset panel `bg-elevated`, border `border-subtle`.
- Success: green check + "Offer sent — share this link" + URL field + **Copy offer link**.

### Empty & error states

- Empty table: centered icon (inbox), "No members match this filter", secondary button to clear filters.
- Pinch error: red alert banner inside modal.

---

## 6. Screen Specifications (for mockups)

### 6.1 Overview — `/`

**Hero strip**

- Title: **Retention pricing overview**
- Subtitle: "RetainIQ+ Demo Gym · 105 members scored · 40 expected to leave"
- Right-aligned: muted "Scored on demand"

**Tier stat cards** (see §5) — Critical card slightly emphasized.

**Attendance charts** (2-column row) — Mixpanel-style metric cards between KPIs and the table:
- **Overall attendance** — large 30-day check-in total + daily bar chart (`brand-primary` bars).
- **Peak hours** — busiest hour headline + 24-hour histogram; peak bar emphasized.

**"Needs attention" table** — 5–8 rows; Sarah Chen first (Critical). View links in Iris Purple.

---

### 6.2 Members list — `/members`

Search, filter chips (active chip: light purple bg + purple text), sort dropdown. Full tier-colored badge table on white cards.

---

### 6.3 Member detail — `/members/[id]`

Two-column layout: check-in chart left, flex offer card right. Primary CTA: solid Iris Purple **Preview & send pricing offer**.

---

### 6.4 Flex Plans log — `/actions`

Card-style audit rows. Filter tabs: All | Offered | Applied | Failed.

---

### 6.5 Member offer — `/offer/[token]`

No owner shell. Typographic **RetainIQ+** wordmark + gym name. Primary CTA: **Confirm with Pinch** (solid purple). Light gradient background.

---

## 7. Iconography & data viz

- **Icons:** Lucide-style, 2px stroke, 16–20px. Minimalist line icons, open-ended shapes.
- **Charts:** Minimal bar charts. Active bars: `brand-primary` at 75–85% opacity; inactive: `border-subtle`.
- **Sparklines:** 1px line, tier-colored where relevant.

---

## 8. Spacing & elevation

| Token | Value |
|---|---|
| Space base | 8px (xs: 4, sm: 12, md: 24, lg: 48, xl: 80) |
| Button / input radius | 8px (`rounded-md`) |
| Card radius | 16px (`rounded-lg`) |
| Modal radius | 16px |
| Badge / chip radius | 9999px (full pill) |
| Shadow card | `0 1px 2px rgba(0,0,0,0.04)` + 1px border |
| Shadow popover | `0 4px 20px rgba(0,0,0,0.05)` |
| Shadow modal | `0 25px 50px rgba(0,0,0,0.12)` |

### Elevation levels

| Level | Treatment |
|---|---|
| 0 — Background | Soft white-to-grey gradient |
| 1 — Cards | Pure white + 1px `#E2E2E9` border |
| 2 — Popovers | White + diffused shadow |
| Interaction | Hover: slightly increased shadow or Iris Purple border tint |

---

## 9. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| ≥1280px | Sidebar + two-column member detail |
| 768–1279px | Sidebar collapses; stat cards 2×2 |
| <768px | Hamburger drawer; tables horizontal scroll; stack member detail |

---

## 10. AI mockup generation prompts

### Master style suffix (append to all prompts)

> Light premium B2B SaaS dashboard UI, Iris Purple (#5442DE) and Soft Emerald Green accents, Geist font, soft white-to-grey gradient background, white cards with subtle borders, crisp data tables, semantic red/amber/green risk badges on light backgrounds, no gym photography, no logo icons, typographic RetainIQ+ wordmark, professional corporate modern aesthetic, high fidelity, Figma-style mockup, 1440×900.

### Prompt A — Overview dashboard

> RetainIQ+ gym retention pricing overview. Left sidebar, typographic wordmark. Four KPI stat cards: Critical 15, Slipping 25, Healthy 60, Unknown 5. "Needs attention" table below. Light theme, Iris Purple accents, white cards on soft gradient background.

### Prompt B — Members list

> RetainIQ+ members list. Search, purple active filter chips, white data table with tier pills. Light corporate modern B2B SaaS.

### Prompt C — Member detail + offer card

> RetainIQ+ member detail for Sarah Chen, Critical badge, check-in chart, flex offer card with solid purple Send button. Light premium dashboard.

### Prompt D — Send offer modal

> Modal on light dashboard. "Send Flex Plan", Pinch preview, Cancel and Send offer. RetainIQ+ branding, solid Iris Purple primary button.

### Prompt E — Flex Plans log

> RetainIQ+ audit log. Green applied and amber offered badges. White card rows, light sidebar.

### Prompt F — Member offer page

> RetainIQ+ member offer page, no sidebar. Typographic wordmark, flex plan summary, Confirm with Pinch purple button. Mobile-friendly light layout.

---

## 11. Implementation mapping

When building in `apps/web`:

- **Stack:** Next.js 15 + Tailwind + shadcn/ui
- **CSS variables:** Map §2 tokens to `:root` in `globals.css` (keep semantic names: `bg-base`, `brand-primary`, etc.)
- **Tier utilities:** `tier-critical`, `tier-slipping`, etc. as component classes in `globals.css`
- **Fonts:** `geist` package — Geist Sans (+ Geist Mono for IDs)
- **Background:** `.bg-surface-gradient` utility replaces dark dot grid

### shadcn components

| UI need | Component |
|---|---|
| Table | `Table`, `TableHeader`, `TableRow` |
| Filters | `Select`, `Badge`, `Input` |
| Modal | `Dialog` |
| Buttons | `Button` — primary solid purple, success emerald |
| Stats | `Card`, `CardHeader`, `CardContent` |
| Toast | `Sonner` — light theme |

---

## 12. Demo polish checklist

- [ ] Critical count on overview matches table (e.g. 15)
- [ ] Sarah Chen visible as first Critical row everywhere
- [ ] Tier colors consistent across overview, members, detail
- [ ] "Powered by Pinch" subtle footer in sidebar
- [ ] No lorem ipsum — use realistic gym member names from seed data
- [ ] Primary actions use solid Iris Purple button, not gradient
- [ ] Typographic RetainIQ+ wordmark — no logo icon

---

*Version 2.0 — RetainIQ+ light theme. Aligned with [requirements.md](requirements.md) §15 UI Specification.*
