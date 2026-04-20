# Agent Onboarding — Sim Governance Protocol Mode

You are building governance protocol composition into Sim, an open-source AI workflow platform. This is a real product — not a prototype, not a toy. Your work will be used by institutional designers to compose governance protocols that are enforced deterministically.

## What you're building

Sim has a canvas where users drag blocks (Slack, Gmail, AI, APIs) and connect them into workflows. You are adding **8 new governance block types** that represent institutional commitment points (CPs) — the building blocks of governance processes. These blocks coexist with automation blocks on the same canvas.

A user composes a governance protocol by placing CP blocks (DECIDE, ATTEST, APPEAL, CLOSE, REMEDY, DELEGATE, OVERRIDE, EVOLVE), configuring their gates (who has authority, what evidence is required, what outcomes are allowed), connecting them with typed dependency edges, and exporting valid IGSL v1.2 JSON.

## The sacred constraint

**The enforcement boundary is deterministic, never ML.** Governance blocks route through a separate enforcement engine (Precepto) that evaluates gates with pure functions. No LLM ever makes an enforcement decision. Agents gather evidence and submit — the engine decides. This is non-negotiable.

## Your first steps

1. Read `CLAUDE.md` — architecture index, directory map, implementation notes
2. Read `docs/phase-a-brief.md` — your week-by-week build spec
3. Read `apps/sim/blocks/blocks/governance/decide.tsx` — working DECIDE block (your template)
4. Read `docs/governance-implementation-analysis.md` — what Sim supports, exact file paths

## The working spike

There is already a working DECIDE block at `apps/sim/blocks/blocks/governance/decide.tsx`. It:
- Is registered in `apps/sim/blocks/registry.ts`
- Compiles cleanly (`bun run dev` starts with 0 errors)
- Has sub-blocks: cp_id, cp_name, authority_model (dropdown), evidence_requirements (table), allowed_outcomes (table), proposed_outcome
- Has typed inputs (evidence_in, authority_in, activation) and outputs (receipt, outcome_token, blocked_gates)

**Use this as your template for all other blocks.**

## Build order

Follow this sequence — each step builds on the previous:

### Week 1: Blocks on Canvas
1. **III-201** — Set up dev environment (DB + auth for browser testing)
2. **III-188** — Block infrastructure (directories, IntegrationType.Governance)
3. **III-187** — DECIDE block is done (spike). Verify it renders in browser after III-201.
4. **III-189** — Remaining 7 CP blocks (copy DECIDE, adjust per-type defaults)
5. **III-190** — 8 SVG icons
6. **III-191** — Protocol Header singleton block
7. **III-192** — Visual treatment (ring borders, CP badges on workflow-block.tsx)

### Week 2: Gates + Edges + Handles
8. **III-193** — Complete gate configuration sub-blocks (verify all 6 gates on every block)
9. **III-194** — Edge relationship metadata (DEPENDS_ON/APPEALS via sourceHandle encoding)
10. **III-196** — v1.2 feature verification (produces, lifecycle, external_bonds)
11. **III-195** — Multiple named input handles (~100-200 LOC in workflow-block.tsx)

### Week 3: Validation + Export + Test
12. **III-197** — IGSL validation engine (13 codes, real-time on canvas)
13. **III-198** — IGSL JSON export (ProtocolVersion assembly, schema validation)
14. **III-199** — Governance block executor stub (mock receipts, DRY_RUN)
15. **III-200** — Acid test: Carta de Agua protocol on canvas → validates → exports → matches reference

## Key implementation details you'll need

### Block definitions
- File pattern: `apps/sim/blocks/blocks/governance/{type}.tsx`
- Export: `GovernanceDecideBlock`, `GovernanceAttestBlock`, etc.
- Register in: `apps/sim/blocks/registry.ts`
- Use `category: 'blocks'` (NOT a new category)
- Sub-block types available: `short-input`, `long-input`, `dropdown`, `table`, `code`, `text`, `switch`
- Dropdown options: `[{label: string, id: string}]`
- Table columns: `string[]` (each row is an array of strings)
- Conditional visibility: `condition: { field: 'other_sub_block_id', value: 'some_value' }`

### Visual treatment
- Target: `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/workflow-block.tsx`
- Detect governance: `data.type.startsWith('governance_')`
- Apply: 2px ring border in CP type color, "CP" badge, type-colored header

### Edge metadata
- Target: `workflow-edge.tsx` + workflow store
- Encode relationship in `sourceHandle` string (no DB migration in Phase A)
- Auto-detect: connection to APPEAL block → APPEALS relationship

### Multiple input handles
- Target: `workflow-block.tsx`
- ~100-200 LOC changes
- Governance blocks get 3 left-side handles (evidence, authority, activation) + 3 right-side handles (receipt, outcome, blocked)
- Non-governance blocks unchanged

### Validation
- File: `apps/sim/lib/governance/validator.ts`
- Reads canvas state (blocks + edges from Zustand store)
- Returns `ValidationCode[]` from `lib/governance/types.ts`
- 13 codes: 7 BLOCK severity, 6 WARN severity
- Renders: red/yellow ring on affected blocks + error panel

### Export
- File: `apps/sim/lib/governance/export.ts`
- Reads all governance blocks + edges → assembles IGSL `ProtocolVersion` JSON
- Validates against bundled JSON Schema
- Export button: only enabled when 0 BLOCK errors

### Executor stub
- File: `apps/sim/lib/governance/executor.ts` (stub exists, needs rewrite)
- Must implement `BlockHandler` interface from `apps/sim/executor/handlers/`
- Use `block.metadata?.id` for `canHandle()` (NOT `block.type`)
- Config values at `block.config.params.{sub_block_id}`
- Phase A: return mock receipt. Phase B: call Precepto API.

## Color palette

| CP Type | Color | Background |
|---------|-------|------------|
| DECIDE | #3B82F6 | #EFF6FF |
| ATTEST | #14B8A6 | #F0FDFA |
| APPEAL | #F59E0B | #FFFBEB |
| CLOSE | #64748B | #F8FAFC |
| REMEDY | #F97316 | #FFF7ED |
| DELEGATE | #8B5CF6 | #F5F3FF |
| OVERRIDE | #EF4444 | #FEF2F2 |
| EVOLVE | #10B981 | #ECFDF5 |

## The acid test (your definition of done)

Compose the Carta de Agua protocol (9 CPs) on the canvas:
1. Place Protocol Header + 9 CP blocks matching `/Users/pepe/igsl-spec/examples/carta-de-agua-v1.2.json`
2. Configure all gates
3. Draw dependency edges with correct relationships
4. Validation: 0 BLOCK errors
5. Export IGSL JSON → structurally matches the reference
6. Wire a Slack block to one CP's evidence_in handle

If that works, Phase A is done.

## What NOT to do

- Don't modify Sim's existing block rendering for non-governance blocks
- Don't add a database migration in Phase A (edge metadata via sourceHandle encoding)
- Don't build the enforcement engine (Phase B)
- Don't build the copilot (Phase C)
- Don't add dark mode
- Don't add i18n
- Don't optimize for production (this is demo-grade)
- Don't change Sim's auth, DB schema, or deployment
