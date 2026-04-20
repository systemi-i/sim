# CLAUDE.md — Sim Governance Protocol Mode

## What we're building

Adding governance protocol composition to Sim's existing workflow canvas. 8 governance CP block types coexist with automation blocks on the same canvas. CP blocks are deterministic (enforced by Precepto's engine). Automation blocks are standard Sim execution.

**One canvas, mixed blocks.** No separate "protocol mode." Governance and automation side by side.

## Current state

- ✅ DECIDE block spike working (`blocks/blocks/governance/decide.tsx`) — registered, compiles, app runs
- ✅ Types stubbed (`lib/governance/types.ts`) — CommitmentType, GateType, Receipt, CommitmentSubmission, etc.
- ✅ Colors defined (`lib/governance/colors.ts`) — 8 CP type colors + backgrounds
- ✅ Validator, exporter, executor stubs in place
- ⬜ 7 remaining CP blocks (ATTEST, APPEAL, CLOSE, REMEDY, DELEGATE, OVERRIDE, EVOLVE)
- ⬜ Visual treatment (ring borders, CP badges)
- ⬜ Multiple input handles
- ⬜ Edge relationship metadata
- ⬜ IGSL validation engine
- ⬜ IGSL JSON export
- ⬜ Dev environment (DB + auth for browser testing)

## Architecture — READ THESE

| Document | Path | What it covers |
|----------|------|----------------|
| **Phase A brief** | `docs/phase-a-brief.md` | Week-by-week build spec. START HERE for implementation. |
| **Implementation analysis** | `docs/governance-implementation-analysis.md` | What Sim supports, how to implement each feature, file paths, LOC estimates |
| **Design spec** | `docs/governance-protocol-mode.md` | Full design spec with code examples |
| **Architect review** | `docs/governance-mode-architect-review.md` | Review with 5 gaps (all fixed in design spec) |
| **Sim architecture** | `GOVERNANCE-MODE-ARCHITECTURE.md` | Block system, execution engine, tools, DB, stores, subflows, copilot |
| **Sim UI architecture** | `GOVERNANCE-MODE-UI.md` | Components, panel editor, sub-block types, stores, hooks |

## Directory structure

```
apps/sim/
├── blocks/
│   ├── blocks/
│   │   └── governance/         # ← Governance block definitions
│   │       └── decide.tsx      # ← DECIDE block (spike, working)
│   ├── registry.ts             # ← Register blocks here
│   └── types.ts                # ← BlockConfig, SubBlockType, etc.
├── lib/
│   └── governance/             # ← Governance logic
│       ├── types.ts            # ← IGSL types (copied from Precepto)
│       ├── colors.ts           # ← CP type colors
│       ├── validator.ts        # ← IGSL validation engine (stub)
│       ├── export.ts           # ← IGSL JSON export (stub)
│       └── executor.ts         # ← Governance block executor (stub)
├── components/
│   └── governance/             # ← Governance-specific UI components (icons, badges)
└── app/workspace/[workspaceId]/w/[workflowId]/
    └── components/
        ├── workflow-block/      # ← Block rendering (modify for visual treatment)
        └── workflow-edge/       # ← Edge rendering (modify for relationship styles)
```

## How Sim blocks work

1. **Define** a block: export a `BlockConfig` object (see `decide.tsx` for reference)
2. **Register** it: import in `registry.ts`, add to `registry` object
3. **Done** — it appears in the block menu and canvas

Key interfaces (from `blocks/types.ts`):
- `BlockConfig` — block definition (type, name, icon, subBlocks, inputs, outputs)
- `SubBlockConfig` — panel editor field (id, type, title, options, condition)
- `SubBlockType` — valid field types: `short-input`, `long-input`, `dropdown`, `table`, `code`, `text`, `switch`, etc.
- Dropdown options: `[{label: string, id: string}]`
- Table columns: `string[]`
- Conditional visibility: `condition: { field: string, value: string }`

## How to add a governance block

Copy `decide.tsx` as template, change:
- `type`: `'governance_attest'`, `'governance_appeal'`, etc.
- `name`: display name
- `bgColor`: from `colors.ts` 
- Sub-blocks: adjust defaults per CP type
- Register in `registry.ts`

## Color system

```
DECIDE:   #3B82F6 (blue)     bg: #EFF6FF
ATTEST:   #14B8A6 (teal)     bg: #F0FDFA
APPEAL:   #F59E0B (amber)    bg: #FFFBEB
CLOSE:    #64748B (slate)    bg: #F8FAFC
REMEDY:   #F97316 (orange)   bg: #FFF7ED
DELEGATE: #8B5CF6 (purple)   bg: #F5F3FF
OVERRIDE: #EF4444 (red)      bg: #FEF2F2
EVOLVE:   #10B981 (emerald)  bg: #ECFDF5
```

## Hard constraints (NON-NEGOTIABLE)

1. **Enforcement boundary is deterministic, never ML.** Agents gather evidence, the engine evaluates gates. No LLM makes enforcement decisions.
2. **IGSL schema is the source of truth.** The protocol encoding defines governance logic.
3. **DRY_RUN only** for all development phases. All receipts tagged non-binding.
4. **One canvas, mixed blocks.** No separate "protocol mode" toggle.

## Key implementation notes (from codebase analysis)

- **Block type field**: handlers use `block.metadata?.id` (NOT `block.type`) to identify blocks
- **Sub-blocks**: `table` supports multi-column dynamic rows ✅, `condition` field works for visibility ✅
- **Categories**: use `category: 'blocks'` (not a new category) to avoid toolbar changes
- **Block IDs**: UUIDs, stable across saves, regenerated on copy/paste → use dedicated `cp_id` sub-block
- **Edge metadata**: `workflow_edges` table has no metadata column → encode relationship in `sourceHandle` string for Phase A
- **Multiple handles**: not native — requires ~100-200 LOC changes to `workflow-block.tsx`
- **Executor**: implement `BlockHandler` interface (`canHandle` + `execute`), register before `GenericBlockHandler`
- **Protocol settings**: use singleton `governance_protocol_header` block on canvas

## Precepto integration (Phase B)

- Types copied from `@precepto/types` (in `lib/governance/types.ts`)
- Gate evaluators are pure functions, zero DB dependency — can run client-side
- Single enforcement endpoint: `POST /v1/cases/:id/commitments`
- Receipt chain: SHA-256 hash chain, genesis = `"GENESIS"`

## Linear issues

Project: "Sim — Governance Protocol Mode"
- III-201: Dev environment setup
- III-187 to III-200: Phase A (14 issues, Week 1-3)

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Dev server (localhost:3000)
bun run build        # Production build
```
