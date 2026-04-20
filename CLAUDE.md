# CLAUDE.md — Sim Governance Protocol Mode

## What we're building
Adding governance protocol composition to Sim's existing workflow canvas. Governance CP blocks (8 types) coexist with automation blocks on the same canvas. CP blocks are deterministic (enforced by Precepto's engine). Automation blocks are standard Sim execution.

## Architecture
- Governance blocks defined in `apps/sim/blocks/blocks/governance/`
- Governance logic (validation, export, executor) in `apps/sim/lib/governance/`
- Governance-specific UI components in `apps/sim/components/governance/`
- Design docs in `docs/`

## Key docs
- `docs/governance-protocol-mode.md` — full design spec
- `docs/governance-mode-architect-review.md` — architect review
- `docs/governance-implementation-analysis.md` — Sim codebase analysis
- `docs/phase-a-brief.md` — Phase A detailed brief
- `GOVERNANCE-MODE-ARCHITECTURE.md` — Sim architecture analysis
- `GOVERNANCE-MODE-UI.md` — Sim UI architecture analysis

## Block system
Blocks are defined in `apps/sim/blocks/blocks/` and registered in `apps/sim/blocks/registry.ts`.
Each governance block follows `BlockConfig` interface from `apps/sim/blocks/types.ts`.
Use `category: 'blocks'` with governance tags for toolbar grouping.

## Hard constraints
1. Enforcement boundary is deterministic, never ML
2. IGSL schema is the source of truth
3. DRY_RUN only for Phase A-D (all 12 weeks)
4. One canvas, mixed blocks — no separate "protocol mode"

## Color system
DECIDE #3B82F6, ATTEST #14B8A6, APPEAL #F59E0B, CLOSE #64748B,
REMEDY #F97316, DELEGATE #8B5CF6, OVERRIDE #EF4444, EVOLVE #10B981

## Precepto integration
- Types: copied from @precepto/types into lib/governance/types.ts (Phase A)
- API: HTTP to Precepto enforcement endpoint (Phase B)
- Gate evaluators: pure functions, can run client-side (from @precepto/precepto-core)

## Commands
- `bun install` — install dependencies
- `bun run dev` — development server
- `bun run build` — production build
