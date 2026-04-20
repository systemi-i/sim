# Rebrand Audit: Sim → Precepto

**Date:** 2026-04-20  
**Author:** Pepe (subagent)  
**Status:** AUTHORITATIVE — use this document to plan and execute the rebrand sprint  
**Scope:** All UI surfaces in `apps/sim/` fork — navigation, branding, colors, typography, pages, canvas, auth, landing

---

## 1. Executive Summary

Sim is well-structured for white-labeling. The fork already has an `ee/whitelabeling/` module backed by environment variables (`NEXT_PUBLIC_BRAND_*`) that covers the name, logo, wordmark, favicon, and primary/accent colors in the app shell. The landing page and marketing copy are **not** covered by this system and must be replaced entirely.

### What Needs to Change

| Category | Scope | Effort |
|---|---|---|
| **Brand name ("Sim" → "Precepto")** | ~301 occurrences across `.tsx`/`.ts` files | Medium — mostly config + targeted string replacements |
| **Logo / Wordmark** | Custom `<Sim>` icon component + wordmark image | Low — replace via env var or swap component |
| **Primary color (purple → blue)** | Single CSS var override or env var | Low — 1 env var change |
| **Font (Season Sans → Inter)** | `apps/sim/app/_styles/fonts/` + tailwind config | Low — swap font import |
| **Sidebar labels** | 6 renames + 3 new items | Low — source edits only |
| **Landing page** | Full rewrite needed — Precepto is private, not public SaaS | Medium — entire marketing site |
| **Metadata / SEO** | Titles, descriptions, OG tags, structured data | Low — change brand config |
| **Canvas terminology** | "Workflow" → "Protocol" in UI text | Medium — affects many components |
| **Auth pages** | Logo + name only | Low |
| **New surfaces** | Cases, Inbox, Metrics, Audit Trail | **High** — net-new development |
| **Settings strings** | "Sim Keys", "Sim Mailer", "Sim Request ID" | Low — targeted replacements |

### Estimated Total Rebrand Sprint

- **Surface renaming + branding config:** ~1 week (part of Week 1 roadmap)
- **Landing page replacement:** ~3 days (replace with a placeholder or Precepto-specific landing)
- **New surfaces (Cases, Inbox, Metrics, Audit Trail):** per roadmap Phases B–D, not in rebrand sprint

### Recommended Week 1 Order

1. Set env vars for name, logo, wordmark, primary color — instant app-shell rebrand
2. Swap font to Inter
3. Update `lib/branding/defaults.ts` — all brand config falls through here
4. Edit sidebar labels
5. Replace landing page with Precepto holding page
6. Sweep remaining "Sim" string literals in UI copy

---

## 2. Sidebar Navigation

### Current Structure (from `sidebar.tsx`)

The sidebar renders three groups:

**Top Nav** (always visible, above workspace section)
| Current ID | Current Label | Icon | Route |
|---|---|---|---|
| `home` | Home | `Home` | `/workspace/{id}/home` |
| `search` | Search | `Search` | (modal, no route) |

**Workspace Section** (labeled "Workspace" in sidebar heading)
| Current ID | Current Label | Icon | Route |
|---|---|---|---|
| `tables` | Tables | `Table` | `/workspace/{id}/tables` |
| `files` | Files | `File` | `/workspace/{id}/files` |
| `knowledge-base` | Knowledge Base | `Database` | `/workspace/{id}/knowledge` |
| `scheduled-tasks` | Scheduled Tasks | `Calendar` | `/workspace/{id}/scheduled-tasks` |
| `logs` | Logs | `Library` | `/workspace/{id}/logs` |

**Scrollable Section** (inside the scroll area)
| Section | Label | Notes |
|---|---|---|
| `All tasks` | "All tasks" (section heading) | Lists task items (Blimp icon) |
| `Workflows` | "Workflows" (section heading) | Lists workflow items |

**Footer**
| Current ID | Current Label | Icon | Route |
|---|---|---|---|
| `settings` | Settings | `Settings` | `/workspace/{id}/settings/*` |
| Help | Help | `HelpCircle` | (dropdown: Docs, Report issue, Tour) |

---

### Full Mapping: Sim → Precepto

| Current Label | Current Route | Action | New Label | New Route | Rationale |
|---|---|---|---|---|---|
| **Home** | `/home` | **Rename** | **Protocols** | `/protocols` or keep `/home` (redirect) | Home is generic; "Protocols" is the primary workspace concept |
| **Search** | (modal) | **Keep** | Search | — | Universal — no change needed |
| **Tables** | `/tables` | **Rename + Group** | **Institution > Data** | `/tables` (keep route) | Rename tab label; group under "Institution" section heading |
| **Files** | `/files` | **Rename + Group** | **Institution > Documents** | `/files` | Same page, renamed label |
| **Knowledge Base** | `/knowledge` | **Rename + Group** | **Institution > Knowledge** | `/knowledge` | Fits institution model |
| **Scheduled Tasks** | `/scheduled-tasks` | **Rename** | **Agents** | `/scheduled-tasks` (keep) or `/agents` | Tasks → Agents aligns with roadmap terminology |
| **Logs** | `/logs` | **Rename** | **Audit Trail** | `/logs` (extend this page) | Logs → Audit Trail; this page is extended by the receipt chain viewer |
| **Settings** | `/settings` | **Keep** | Settings | — | No change |
| **Help** | (dropdown) | **Keep/Update** | Help | — | Update Docs link to precepto docs when available |
| **"All tasks"** section | `/task/{id}` | **Rename section** | **Cases** | `/cases` (new route) or keep task route | "Tasks" in Sim = conversational agent tasks. In Precepto these map to **Cases** (GovernedContexts) |
| **"Workflows"** section | `/w/{id}` | **Rename section** | **Protocols** | `/w/{id}` (keep route) | The list of workflow canvases = Protocol list |
| **NEW: Inbox** | — | **Add** | **Inbox** | `/inbox` | Pending HITL decisions awaiting operator action |
| **NEW: Metrics** | — | **Add** | **Metrics** | `/metrics` | Protocol performance dashboard |

### New Governance Sidebar Section

After the "Institution" group, add a **"Governance"** section:

```
── Governance ──────────────────────
  Cases            /cases
  Inbox            /inbox
  Audit Trail      /logs (extended)
  Metrics          /metrics
```

### Notes on "Workspace" Section Label

The "Workspace" heading in the sidebar should become **"Institution"** to match the governance data model. The section heading is rendered as:
```tsx
<div className='font-base text-[var(--text-icon)] text-small'>Workspace</div>
```
Location: `sidebar.tsx` ~line 1065

---

## 3. Branding Inventory

Every location where "Sim" appears as a brand name (not code symbol), with recommended replacement.

### 3.1 Core Brand Config (HIGH PRIORITY — change first)

| File | Current Value | New Value |
|---|---|---|
| `apps/sim/lib/branding/defaults.ts` | `name: 'Sim'` | `name: 'Precepto'` |
| `apps/sim/lib/branding/defaults.ts` | `supportEmail: 'help@sim.ai'` | `supportEmail: 'help@precepto.io'` (or TBD) |
| `apps/sim/lib/branding/defaults.ts` | `primaryColor: '#701ffc'` | `primaryColor: '#1D4ED8'` (see §4) |
| `apps/sim/lib/branding/defaults.ts` | `primaryHoverColor: '#802fff'` | `primaryHoverColor: '#1E40AF'` |
| `apps/sim/lib/branding/defaults.ts` | `accentColor: '#9d54ff'` | `accentColor: '#3B82F6'` |

> **Shortcut:** All of the above can also be set via env vars at runtime:  
> `NEXT_PUBLIC_BRAND_NAME=Precepto`, `NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#1D4ED8`, etc.

### 3.2 Logo and Icons

| File | Current | Action |
|---|---|---|
| `apps/sim/app/workspace/[workspaceId]/w/components/sidebar/sidebar.tsx` | `<Sim>` icon component (collapsed state), `<Wordmark>` component (expanded) | Replace via `brand.logoUrl` / `brand.wordmarkUrl` env vars — the sidebar already supports this |
| `apps/sim/public/logo/` | Sim logo assets | Replace all files with Precepto assets |
| `apps/sim/public/favicon/` | Sim favicon files | Replace with Precepto favicon |
| `apps/sim/public/icon.svg` | Sim icon SVG | Replace |
| `apps/sim/public/manifest.webmanifest` | (contains Sim branding) | Update name, icons |

### 3.3 Metadata / SEO

| File | Current | Action |
|---|---|---|
| `apps/sim/ee/whitelabeling/metadata.ts` | Title template: `%s \| ${brand.name}` | Auto-updates once brand.name = Precepto |
| `apps/sim/ee/whitelabeling/metadata.ts` | description: "Sim is the open-source AI workspace..." | Replace with Precepto description |
| `apps/sim/ee/whitelabeling/metadata.ts` | keywords: `['AI workspace', 'AI agent builder', ...]` | Replace with governance keywords |
| `apps/sim/ee/whitelabeling/metadata.ts` | `twitter.creator: '@simdotai'` | Replace with `@precepto` or remove |
| `apps/sim/ee/whitelabeling/metadata.ts` | `twitter.site: '@simdotai'` | Replace |
| `apps/sim/ee/whitelabeling/metadata.ts` | `msapplication-TileColor: '#701FFC'` | Replace with Precepto blue |
| `apps/sim/ee/whitelabeling/metadata.ts` | `generateStructuredData()` — `name: 'Sim'` + description | Replace entirely |
| `apps/sim/app/(landing)/layout.tsx` | manifest, icons | Inherits from layout — update assets |

### 3.4 "Powered by Sim" Footer

| File | Current | Action |
|---|---|---|
| `apps/sim/app/form/[identifier]/components/powered-by-sim.tsx` | "Powered by" + Sim logo image | Either remove, or replace with "Powered by Precepto" |

### 3.5 Settings UI Strings

| File | String | Replace With |
|---|---|---|
| `settings/[section]/page.tsx:16` | `apikeys: 'Sim Keys'` | `'Precepto Keys'` |
| `settings/components/inbox/inbox.tsx:35` | `'Sim Mailer requires...'` | `'Precepto Mailer requires...'` |
| `settings/components/inbox/inbox.tsx:38` | `'...let Sim work...'` | `'...let Precepto work...'` |
| `settings/components/inbox/inbox-settings-tab.tsx:102` | `"Sim's email"` | `"Precepto's email"` |
| `settings/components/api-keys/api-keys.tsx` | Multiple "Sim keys" / "Sim key" references (~8) | "Precepto key(s)" |
| `settings/components/api-keys/create-api-key-modal.tsx` | "Sim key" references (~8) | "Precepto key" |
| `settings/components/mothership/mothership.tsx:690` | `'Sim Request ID'` | `'Precepto Request ID'` |
| `settings/components/general/general.tsx:466` | `'...improve Sim. You can opt-out...'` | `'...improve Precepto...'` |
| `settings/components/workflow-mcp-servers.tsx:466` | `<ButtonGroupItem value='sim'>Sim</ButtonGroupItem>` | Evaluate — this may be a protocol type selector |
| `settings/components/workflow-mcp-servers.tsx:909` | `'...your Sim API key...'` | `'...your Precepto API key...'` |

### 3.6 Home Page (Workspace)

| File | String | Replace With |
|---|---|---|
| `home/components/user-input/animated-placeholder-effect.tsx:16` | `'Send message to Sim'` | `'Send message to Precepto'` |
| `home/components/user-input/plus-menu-dropdown.tsx:209` | `<Sim>` icon | Replace icon or use Precepto logo |

### 3.7 Chat / Embed

| File | String | Replace With |
|---|---|---|
| `app/chat/components/header/header.tsx:67` | `aria-label='Sim home'` | `aria-label='Precepto home'` |
| `app/chat/components/header/header.tsx:71` | `alt='Sim'` | `alt='Precepto'` |

### 3.8 Landing Page (see §9 for full treatment)

All `docs.sim.ai`, `status.sim.ai`, `sim.ai`, `@simdotai`, `simstudioai` references in footer/navbar — replace or remove entirely (Precepto is not a public SaaS product in this phase).

---

## 4. Color Theme Analysis + Precepto Recommendation

### Current Sim Palette

| Role | Light | Dark | CSS Var |
|---|---|---|---|
| **Primary brand** | `#701ffc` (purple) | `#701ffc` | `--brand` |
| **Brand hover** | `#802fff` | `#802fff` | `--brand-hover` |
| **Brand accent** | `#9d54ff` | `#9d54ff` | `--brand-accent` |
| **Secondary** | `#33b4ff` (blue) | `#33b4ff` | `--brand-secondary` |
| **Success/accent** | `#33c482` (green) | `#33c482` | `--brand-accent` (context) |
| **Background** | `#fefefe` | `#1b1b1b` | `--bg` |
| **Surface 1** | `#f9f9f9` | `#1e1e1e` | `--surface-1` |
| **Surface 2** | `#ffffff` | `#232323` | `--surface-2` |
| **Text primary** | `#1a1a1a` | `#e6e6e6` | `--text-primary` |
| **Knowledge** | `#00b0b0` (teal) | same | `--brand-knowledge` |

### Color Override Mechanism

Colors can be overridden **two ways**:

1. **Env vars** (runtime, no code change):
   - `NEXT_PUBLIC_BRAND_PRIMARY_COLOR` → sets `--brand`, `--brand-accent`, auth buttons
   - `NEXT_PUBLIC_BRAND_PRIMARY_HOVER_COLOR` → sets `--brand-hover`, `--brand-accent-hover`
   - `NEXT_PUBLIC_BRAND_ACCENT_COLOR` → sets `--brand-link`
   - `NEXT_PUBLIC_BRAND_BACKGROUND_COLOR` → affects dark/light detection

2. **Per-org theme** via `generateOrgThemeCSS()` in `ee/whitelabeling/org-branding-utils.ts` — stored in DB, applied at request time

### Recommended Precepto Palette

Precepto is an **institutional governance platform** — the palette should convey authority, precision, and trust. Navy/indigo blues replace the playful purple; warm amber replaces vibrant green for cautionary/decision states.

| Role | Light | Dark | CSS Var Override |
|---|---|---|---|
| **Primary brand** | `#1D4ED8` (institutional blue) | `#2563EB` | `NEXT_PUBLIC_BRAND_PRIMARY_COLOR` |
| **Brand hover** | `#1E40AF` | `#1D4ED8` | `NEXT_PUBLIC_BRAND_PRIMARY_HOVER_COLOR` |
| **Brand accent** | `#3B82F6` (mid-blue; matches CP block color) | `#60A5FA` | `NEXT_PUBLIC_BRAND_ACCENT_COLOR` |
| **Secondary** | `#64748B` (slate; neutral authority) | `#94A3B8` | keep `--brand-secondary` |
| **Success** | `#059669` (emerald) | `#34D399` | via CSS |
| **Warning/Decision** | `#D97706` (amber — decision states) | `#FBBF24` | via CSS |
| **CP block color** | `#3B82F6` (from governance spec §4) | same | inline |
| **Background** | `#FAFAFA` | `#0F172A` (navy-dark) | `NEXT_PUBLIC_BRAND_BACKGROUND_COLOR` |

> **Note:** The CP block blue (`#3B82F6`) intentionally matches the brand accent — this creates visual coherence between the primary brand and governance enforcement points.

### Where Colors Are Defined

1. `apps/sim/app/_styles/globals.css` — all CSS vars (primary source, ~420 lines)
2. `apps/sim/lib/branding/defaults.ts` — default brand config fed into env-var system
3. `apps/sim/ee/whitelabeling/inject-theme.ts` — translates env vars into CSS var overrides
4. `tailwind.config.ts` — font families, custom font sizes, spacing; **colors are not hardcoded here** (uses HSL CSS vars instead)

---

## 5. Typography

### Current Fonts

| Font | Role | CSS Var | Where Defined |
|---|---|---|---|
| **Season Sans** (`--font-season`) | Primary UI font, headings, display text | `font-season` | `apps/sim/app/_styles/fonts/season/season.ts` |
| **Martian Mono** (`--font-martian-mono`) | Code, technical accents, landing page code blocks | `font-mono` | `apps/sim/app/_styles/fonts/martian-mono/martian-mono.ts` |
| **System font stack** | Body text fallback | `font-body` in tailwind | `tailwind.config.ts` |

### Where Applied

- `apps/sim/app/layout.tsx`: `<body className="${season.variable} font-season">` — Season is the default everywhere
- `apps/sim/app/(landing)/layout.tsx`: Adds both `season.variable` and `martianMono.variable` to landing subtree
- `tailwind.config.ts`: `fontFamily.season` and `fontFamily.mono` definitions
- Body font stack: `ui-sans-serif, -apple-system, system-ui, Segoe UI...` (standard system fonts)

### Recommendation for Precepto

The roadmap design spec calls for **Inter** as the primary font. This is an excellent choice for institutional software — it's legible at small sizes, widely recognized as "serious software", and has strong tabular number support (important for metrics/receipts).

**Changes needed:**

1. Add Inter to `apps/sim/app/_styles/fonts/inter/inter.ts` (or load via `next/font/google`)
2. Replace `font-season` → `font-inter` in `apps/sim/app/layout.tsx`
3. Update `tailwind.config.ts` `fontFamily.season` → `fontFamily.sans` or add `fontFamily.inter`
4. Keep Martian Mono for code/technical accents — still appropriate for receipt hashes, IGSL JSON display

```ts
// Example: apps/sim/app/_styles/fonts/inter/inter.ts
import { Inter } from 'next/font/google'
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})
```

---

## 6. Page-by-Page Audit

All pages under `apps/sim/app/workspace/[workspaceId]/`.

| Route | Current Metadata Title | Current Page Heading | Recommended New Title | Content Notes |
|---|---|---|---|---|
| `/home` | `Home` | Home (Mothership chat + task list) | `Protocols` | Repurpose as protocol library/launcher. Mothership → Governance Copilot. Tasks → Cases |
| `/tables` | `Tables` | Tables | `Data` | Keep table functionality; rename nav label only |
| `/tables/[id]` | (inherits Tables) | — | `Data: {table name}` | Same |
| `/files` | `Files` | Files | `Documents` | Keep file functionality; rename nav label |
| `/files/[id]` | (inherits Files) | — | `Documents: {file name}` | Same |
| `/knowledge` | `Knowledge Base` | Knowledge Base | `Knowledge` | Rename nav label |
| `/knowledge/[id]` | (inherits KB) | — | `Knowledge: {kb name}` | Same |
| `/scheduled-tasks` | `Scheduled Tasks` | Scheduled Tasks | `Agents` | Rename; content stays |
| `/logs` | `Logs` | Logs | `Audit Trail` | Extends with receipt chain viewer (Phase B) |
| `/settings/*` | `Settings` | Settings | `Settings` | Keep; update string literals (§3.5) |
| `/w/[workflowId]` | `Workflow` | (canvas) | `Protocol` | Rename page metadata; canvas label changes (§7) |
| `/task/[taskId]` | (task view) | (task) | `Case` | Tasks = Cases in Precepto model |
| `/templates` | `Templates` | Templates | `Protocol Templates` | Keep/rename section |
| **NEW** `/cases` | — | — | `Cases` | New surface — Phase B |
| **NEW** `/inbox` | — | — | `Inbox` | New surface — Phase B |
| **NEW** `/metrics` | — | — | `Metrics` | New surface — Phase D |

---

## 7. Canvas / Workflow Editor Changes

Source: `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/`

### Terminology Changes

| Current | New | Location |
|---|---|---|
| "New workflow" (sidebar button) | "New Protocol" | `sidebar.tsx` ~line 1178: `label: 'New workflow'` |
| "Workflows" (section heading) | "Protocols" | `sidebar.tsx` ~line 1108 |
| "Import workflow" (dropdown item) | "Import protocol" | `sidebar.tsx` ~line 1167 |
| "Creating workflow..." (loading) | "Creating protocol..." | `sidebar.tsx` |
| `workflowsPrimaryAction.label` | "New Protocol" | `sidebar.tsx` ~line 1134 |
| "Delete Workflow" (modal title) | "Delete Protocol" | `sidebar/components/workflow-list/components/delete-modal/delete-modal.tsx` |
| "Delete Workflows" (multi) | "Delete Protocols" | same |
| `page.tsx` metadata title `'Workflow'` | `'Protocol'` | `w/[workflowId]/page.tsx` |

### New Canvas Features (Not Rebrand — Per Roadmap)

These are build tasks, not renaming:
- **"Governance" section** in block toolbar — CP blocks (DECIDE, ATTEST, APPEAL, CLOSE, REMEDY, DELEGATE, OVERRIDE, EVOLVE)
- **Protocol Header block** (singleton) in toolbar
- **IGSL validation badge** on canvas toolbar
- **"Export IGSL JSON"** button in Protocol panel tab
- **Gate handles** on CP blocks (`evidence-in`, `authority-in`, `activation`)
- **"Run Protocol"** button behavior (replaces/extends "Run Workflow")

### Toolbar Sections to Add

The existing toolbar renders blocks grouped by category. Add `"Governance"` as a new top-level category containing all 8 CP block types. This is a code change, not a rename.

---

## 8. Auth & Onboarding Pages

Source: `apps/sim/app/(auth)/`

### Auth Layout

`apps/sim/app/(auth)/auth-layout-client.tsx`:
- Uses landing `<Navbar logoOnly />` — so the logo shown on auth pages is the **same** as the landing navbar logo
- Font: `font-season` applied to the auth wrapper — change to Inter

### Login / Sign-Up Pages

| Page | Title | Branding Elements | Action |
|---|---|---|---|
| `/login` | (inherits from metadata) | Landing Navbar with logo | Update logo via brand config |
| `/signup` | `Sign Up` | Landing Navbar with logo | Update logo; check form copy |
| `/verify` | `Verify` | Navbar logo | Update |
| `/sso` | SSO | Navbar logo | Update |
| `/reset-password` | (reset) | Navbar logo | Update |

### Support Footer

`apps/sim/app/(auth)/components/support-footer.tsx`:
- Uses `brandConfig.supportEmail` — auto-updates from brand config
- Text: "Need help? Contact support" — fine to keep

### Onboarding / Workspace Creation

The workspace creation flow (part of `useWorkspaceManagement`) shows generic workspace UI. The terminology "workspace" stays at the data layer but:
- **Display label:** "workspace" may remain internally; externally Precepto will call this the **institution workspace**
- No auth-specific copy mentioning "Sim" detected in auth forms directly

---

## 9. Landing Page

Source: `apps/sim/app/(landing)/`

### Current Content

| Section | Current Copy | Status |
|---|---|---|
| **Hero H1** | "Build AI Agents" | **Replace** |
| **Hero subheading** | "Sim is the AI Workspace for Agent Builders" | **Replace** |
| **meta itemProp name** | "Sim — The AI Workspace \| Build, Deploy & Manage AI Agents" | **Replace** |
| **Navbar links** | Docs, Blog, Integrations, Models, Pricing | **Remove/Replace** — Precepto is not public SaaS |
| **Footer** | Sim brand + all `docs.sim.ai` / `sim.ai` links | **Replace entirely** |
| **Footer social links** | `@simdotai`, LinkedIn `simstudioai`, GitHub `simstudioai/sim` | **Replace** |
| **Structured data** | Schema.org SoftwareApplication named "Sim" | **Replace** |
| **Blog, Changelog, Models, Integrations** | Sim-specific content pages | **Remove from Precepto fork** |

### Recommendation

**Option A (Sprint-safe):** Replace the landing page with a **Precepto holding page** — minimal page with logo, tagline, and a "Request Access" CTA. Remove all marketing sections. This is 1–2 hours of work.

**Option B (Full rewrite):** Write governance-focused landing page. Lower priority during 12-week sprint — internal beta doesn't need a public landing.

**Recommended:** Option A for Week 1. The landing page at root `/` should redirect to `/login` for the internal beta, or show a minimal "Precepto — Governance Protocol Platform" holding page.

### Landing Page Subsections to Remove for Precepto Fork

- `app/(landing)/blog/` — remove or redirect
- `app/(landing)/models/` — remove (Sim-specific)
- `app/(landing)/integrations/` — remove
- `app/(landing)/changelog/` — remove
- `app/(landing)/pricing/` component in landing.tsx — remove
- `app/(landing)/landing.tsx` — replace with Precepto landing or redirect

---

## 10. New Surfaces Needed

These do not exist in Sim and must be built. This is the main development work beyond renaming.

### 10.1 Cases Page — `/cases`

**What it is:** A list of `GovernedContext` records — one row per case run through a protocol.

**MVP components:**
- `CasesTable` — filterable list with columns: Case ID, Protocol, Status, Opened, Last Activity
- `CaseDetail` — individual case view with timeline of CP block executions
- Status filters: Active, Pending Decision, Resolved, Failed
- Link to Audit Trail for each case

**Route:** `/workspace/[workspaceId]/cases`
**Sidebar:** Under "Governance" section, below Protocols

### 10.2 Inbox — `/inbox`

**What it is:** Pending HITL (Human-in-the-Loop) decisions awaiting operator action.

**MVP components:**
- `DecisionPanel` — list of pending decisions, sorted by urgency
- `AgentNarrativeCard` — AI-generated summary of the context requiring decision
- `CommitmentTimeline` — shows what happened before this decision point
- Accept / Reject / Escalate actions
- Filter by protocol type, CP block type (DECIDE, APPEAL, etc.)

**Route:** `/workspace/[workspaceId]/inbox`
**Sidebar:** Under "Governance" section, first item (highest urgency surface)

### 10.3 Metrics Dashboard — `/metrics`

**What it is:** Protocol performance intelligence (Act 5 of investor demo).

**MVP components:**
- Override rate by CP block type
- Time-per-CP (average execution time per commitment point)
- Gate-failure distribution (which gate fails most: AUTHORITY, EVIDENCE, etc.)
- Cost per case (token cost + time)
- Filter by date range and protocol
- Charts: `recharts` or similar (Sim likely already has charting deps)

**Route:** `/workspace/[workspaceId]/metrics`
**Sidebar:** Under "Governance" section, last item

### 10.4 Audit Trail — `/logs` (extended)

**What it is:** Extension of the existing Logs page with a **receipt chain viewer**.

**New components to add to existing Logs page:**
- `ReceiptChainPanel` — shows hash-chained receipts for a case
- Receipt detail view: canonical IGSL JSON, content hash, `previous_hash` linkage
- Public share link generation for individual receipts
- Filter by case ID, protocol, date range

**Route:** Extends `/workspace/[workspaceId]/logs` — no new route needed
**Note:** The existing Logs page already shows execution logs. The audit trail view is a new tab or filter mode on the same route.

### 10.5 Governance Sidebar Section

The new sidebar section structure (implementation detail for `sidebar.tsx`):

```tsx
// New governance section in workspaceNavItems
const governanceNavItems = [
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox, // new icon needed
    href: `/workspace/${workspaceId}/inbox`,
  },
  {
    id: 'cases',
    label: 'Cases',
    icon: ClipboardList, // or custom
    href: `/workspace/${workspaceId}/cases`,
  },
  {
    id: 'audit-trail',
    label: 'Audit Trail',
    icon: Library, // reuse existing
    href: `/workspace/${workspaceId}/logs`,
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart, // new icon needed
    href: `/workspace/${workspaceId}/metrics`,
  },
]
```

Add a new section heading `"Governance"` in the sidebar above this group, parallel to the "Workspace" section.

---

## 11. White-Label Capabilities

### What Sim Already Supports (via `ee/whitelabeling/`)

Sim has a **well-designed whitelabeling system** that covers most of the brand surface:

| Feature | Mechanism | Coverage |
|---|---|---|
| **App name** | `NEXT_PUBLIC_BRAND_NAME` env var | Sidebar logo tooltip, metadata title, auth footer |
| **Logo URL** | `NEXT_PUBLIC_BRAND_LOGO_URL` | Sidebar (collapsed icon), chat header, auth navbar |
| **Wordmark URL** | `NEXT_PUBLIC_BRAND_WORDMARK_URL` | Sidebar (expanded logo link) |
| **Favicon URL** | `NEXT_PUBLIC_BRAND_FAVICON_URL` | Browser tab favicon |
| **Primary color** | `NEXT_PUBLIC_BRAND_PRIMARY_COLOR` | `--brand`, `--brand-accent`, auth buttons |
| **Primary hover color** | `NEXT_PUBLIC_BRAND_PRIMARY_HOVER_COLOR` | `--brand-hover`, `--brand-accent-hover` |
| **Accent color** | `NEXT_PUBLIC_BRAND_ACCENT_COLOR` | `--brand-link` |
| **Support email** | `NEXT_PUBLIC_SUPPORT_EMAIL` | Auth support footer |
| **Docs URL** | `NEXT_PUBLIC_DOCUMENTATION_URL` | Replaces docs.sim.ai links |
| **Terms URL** | `NEXT_PUBLIC_TERMS_URL` | Footer / auth |
| **Privacy URL** | `NEXT_PUBLIC_PRIVACY_URL` | Footer / auth |
| **Custom CSS URL** | `NEXT_PUBLIC_CUSTOM_CSS_URL` | Injected stylesheet override |
| **Per-org theme** | `generateOrgThemeCSS()` + DB `orgBrandingSettings` | Per-workspace color overrides |
| **Whitelabeling settings UI** | `ee/whitelabeling/components/whitelabeling-settings.tsx` | In-app settings panel for orgs |

### What IS Covered by Config (no code changes)

- App name everywhere the `brand.name` / `brandConfig.name` is used
- Logo in sidebar, auth, chat
- Brand colors site-wide
- Support email in auth footer
- Docs / terms / privacy links

### What Is NOT Covered by Config (requires code changes)

| Issue | Location |
|---|---|
| Hardcoded "Sim" in metadata strings (description, keywords, structured data) | `ee/whitelabeling/metadata.ts` |
| `@simdotai` Twitter handle in metadata | `ee/whitelabeling/metadata.ts` |
| "Powered by Sim" component | `app/form/[identifier]/components/powered-by-sim.tsx` |
| Sidebar section labels ("Workspace", "All tasks", "Workflows") | `sidebar.tsx` |
| Workflow/task terminology throughout the UI | Multiple files |
| Landing page content | `app/(landing)/` |
| Page metadata titles (Home, Logs, Scheduled Tasks, etc.) | Each `page.tsx` |
| Settings strings ("Sim Keys", "Sim Mailer", etc.) | Settings components |
| `lib/branding/defaults.ts` fallback values | Fallback values in source |

### Verdict

**~60% of the rebrand can be done via environment variables** (name, logo, colors, support links).  
The remaining **~40% requires targeted source code changes** (~50–100 string replacements across ~20 files).  
The white-label system is solid — this fork simply needs to be configured and the hardcoded fallback strings updated.

---

## 12. Prioritized Action Items

### 🔴 P0 — Do First (Week 1, Day 1–2): Config + Instant Rebrand

1. **Set `.env.local` env vars:**
   ```
   NEXT_PUBLIC_BRAND_NAME=Precepto
   NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#1D4ED8
   NEXT_PUBLIC_BRAND_PRIMARY_HOVER_COLOR=#1E40AF
   NEXT_PUBLIC_BRAND_ACCENT_COLOR=#3B82F6
   ```
   → Instantly rebrand name and colors everywhere `useBrandConfig()` / `getBrandConfig()` is called.

2. **Update `apps/sim/lib/branding/defaults.ts`:**
   - `name: 'Precepto'`
   - `supportEmail: 'help@precepto.io'` (or TBD)
   - Update default colors

3. **Replace logo assets:**
   - Upload Precepto logo to `public/logo/`
   - Set `NEXT_PUBLIC_BRAND_LOGO_URL` and `NEXT_PUBLIC_BRAND_WORDMARK_URL` to asset URLs
   - Or replace `public/icon.svg` and `public/logo/` directly

4. **Swap font: Season Sans → Inter**
   - Create `apps/sim/app/_styles/fonts/inter/inter.ts`
   - Update `apps/sim/app/layout.tsx` body className
   - Update `tailwind.config.ts` fontFamily

### 🟠 P1 — This Week: Sidebar + Terminology

5. **Rename sidebar labels** in `sidebar.tsx`:
   - "Workspace" section heading → "Institution"
   - "All tasks" section heading → "Cases"  
   - "Workflows" section heading → "Protocols"
   - `topNavItems[0].label` "Home" → "Protocols"
   - `workspaceNavItems[3].label` "Scheduled Tasks" → "Agents"
   - `workspaceNavItems[4].label` "Logs" → "Audit Trail"
   - `workflowsPrimaryAction.label` "New workflow" → "New Protocol"
   - Import workflow dropdown → "Import protocol"

6. **Add "Governance" section to sidebar:**
   - Add new `governanceNavItems` array
   - Add "Governance" section heading between Workspace and scroll section
   - Items: Inbox (`/inbox`), Cases (`/cases`), Audit Trail (`/logs`), Metrics (`/metrics`)
   - These routes can 404 for now — the sidebar items can be marked `comingSoon` or disabled

7. **Update page metadata titles** (all `page.tsx` files):
   - `Home` → `Protocols`
   - `Logs` → `Audit Trail`
   - `Scheduled Tasks` → `Agents`
   - `Knowledge Base` → `Knowledge`
   - `Workflow` → `Protocol`

### 🟡 P2 — This Week: String Sweeps

8. **Sweep settings strings** (§3.5):
   - "Sim Keys" → "Precepto Keys"
   - "Sim Mailer" → "Precepto Mailer"
   - "Sim key(s)" → "Precepto key(s)"
   - etc.

9. **Update metadata in `ee/whitelabeling/metadata.ts`**:
   - Replace description, keywords, Twitter handle
   - Replace structured data

10. **Replace "Powered by Sim"** in `app/form/[identifier]/components/powered-by-sim.tsx`:
    - Replace with "Powered by Precepto" or remove

11. **Update home page copy** in animated-placeholder: "Send message to Precepto"

### 🟢 P3 — This Week: Landing Page

12. **Replace landing page** with Precepto holding page:
    - Simple hero: "Precepto — Governance Protocol Platform"
    - "Request Access" CTA
    - Or redirect `/` → `/login`
    - Remove or keep-but-hide: blog, models, integrations, changelog, pricing sections

### 🔵 P4 — Per Roadmap Phases: New Surfaces

13. **Phase B:** Build Cases page (`/cases`), Inbox (`/inbox`), Audit Trail extension
14. **Phase D:** Build Metrics dashboard (`/metrics`)
15. **Phase A:** CP blocks in canvas (Governance toolbar section)

---

*End of Audit*
