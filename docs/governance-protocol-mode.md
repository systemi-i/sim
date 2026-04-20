# Governance Protocol Mode — Design Specification

**Status:** Draft — April 2026  
**Audience:** Engineers building governance protocol mode into Sim  
**Repo:** `systemi-i/sim` (fork of `simstudio-ai/sim`)  
**Related:** `GOVERNANCE-MODE-ARCHITECTURE.md`, `GOVERNANCE-MODE-UI.md`, `precepto/docs/sim-platform-architecture-v2.md`

---

## Table of Contents

1. [What We're Building](#1-what-were-building)
2. [Core Concept: One Canvas, Mixed Blocks](#2-core-concept-one-canvas-mixed-blocks)
3. [CP Block Definitions](#3-cp-block-definitions)
4. [CP Block Visual System](#4-cp-block-visual-system)
5. [Gate Handles: Connecting Automation to CP Gates](#5-gate-handles-connecting-automation-to-cp-gates)
6. [Enforcement Integration](#6-enforcement-integration)
7. [IGSL Validation Layer](#7-igsl-validation-layer)
8. [IGSL Export](#8-igsl-export)
9. [Governance Copilot](#9-governance-copilot)
10. [Module Scaffolding](#10-module-scaffolding)
11. [Database Changes](#11-database-changes)
12. [Phased Implementation Plan](#12-phased-implementation-plan)
13. [File Map: What Exists vs. What's New](#13-file-map-what-exists-vs-whats-new)
14. [Open Questions](#14-open-questions)

---

## 1. What We're Building

Governance protocol mode adds a new class of blocks to Sim's canvas: **Commitment Point (CP) blocks**. These are the eight primitive institutional acts defined by IGSL v1.2 — DECIDE, ATTEST, APPEAL, CLOSE, REMEDY, DELEGATE, OVERRIDE, EVOLVE.

CP blocks are not automation blocks. They don't call Slack or run a function. They call Precepto's enforcement engine, which evaluates a submission against six deterministic gates (AUTHORITY, EVIDENCE, REASONING, DEPENDENCY, VERSION, RECOURSE) and returns a receipt. The receipt is hash-chained, immutable, and constitutes institutional proof that the commitment was made correctly.

Automation blocks (Slack, Gmail, API, HITL, Agent, etc.) feed *into* CP blocks via gate handles — they gather evidence, verify authority, notify parties. The CP block is the enforcement point. The automation blocks are the implementation.

**The core bet:** prove that governance CP blocks and automation blocks can coexist on the same canvas with clear visual distinction, and that running a workflow naturally threads through Precepto's enforcement engine at each CP block.

**Sacred boundary (from the architecture):** Agent gathers. Engine decides. The CP block executor never calls an LLM. It calls Precepto. Automation blocks provide the inputs. Precepto provides the verdict.

---

## 2. Core Concept: One Canvas, Mixed Blocks

### 2.1 The Canvas

Governance CP blocks and Sim automation blocks coexist on the **same React Flow canvas**, the same workflow state, and the same execution engine. There is no mode toggle, no layer switch, no separate canvas. One view. Everything visible.

A protocol workflow might look like:

```
[Slack: Notify applicant] ──→ [DECIDE: Eligibility] ──→ [Gmail: Decision letter]
                                      ↑
[API: Cadastre lookup] ──────────────┘ (evidence-in handle)
[HITL: Officer review] ──────────────┘ (authority-in handle)
```

The DECIDE block sits between automation blocks like any other block in the graph. It receives inputs from upstream blocks via its gate handles, calls Precepto, and emits outputs downstream.

### 2.2 Visual Distinction

CP blocks are visually distinct from automation blocks. The distinction is immediate — you should be able to glance at a workflow and know which blocks are governance enforcement points.

**CP block visual identity:**
- `bgColor`: Blue family — `#3B82F6` (base), with type-specific shades (see §4)
- Border: `2px solid` with a slightly darker shade of the block color (automation blocks have `1px solid var(--border)`)
- Badge: A small `CP` pill badge in the block header, top-right of the icon area
- Icon: Custom SVG per CP type (8 new icons, see §4)
- Shape: Standard React Flow `workflowBlock` node — same rectangular shape, no custom node type needed for MVP (a hexagonal or diamond shape is a future UX optimization)

**Automation block visual identity:** Unchanged. Existing colors, existing treatment.

**Edge treatment:** Edges from automation blocks → CP gate handles render in `var(--workflow-edge)` as normal. The gate handle endpoints on CP blocks are color-coded per gate type (see §5).

### 2.3 What Doesn't Change

Everything about the existing canvas remains unchanged:

- React Flow setup in `workflow.tsx` — no new node types for MVP
- `WorkflowBlock` component — CP blocks render through the same component
- `useWorkflowStore`, `useSubBlockStore`, `useExecutionStore` — no new stores for MVP
- Block registry pattern — CP blocks are just new entries in `registry.ts`
- Execution engine — CP blocks get a new handler, not a new engine
- Panel editor — CP blocks open the same right-side panel with their `subBlocks`
- Toolbar — CP blocks appear under a new "Governance" section automatically

---

## 3. CP Block Definitions

### 3.1 File Structure

```
apps/sim/blocks/blocks/
├── governance/
│   ├── index.ts              ← barrel export for all 8 CP blocks
│   ├── decide.ts
│   ├── attest.ts
│   ├── appeal.ts
│   ├── close.ts
│   ├── remedy.ts
│   ├── delegate.ts
│   ├── override.ts
│   └── evolve.ts
```

Register all in `apps/sim/blocks/registry.ts`:

```typescript
// apps/sim/blocks/registry.ts — add to imports
import {
  DecideBlock,
  AttestBlock,
  AppealBlock,
  CloseBlock,
  RemedyBlock,
  DelegateBlock,
  OverrideBlock,
  EvolveBlock,
} from './blocks/governance'

// Add to registry object
governance_decide: DecideBlock,
governance_attest: AttestBlock,
governance_appeal: AppealBlock,
governance_close: CloseBlock,
governance_remedy: RemedyBlock,
governance_delegate: DelegateBlock,
governance_override: OverrideBlock,
governance_evolve: EvolveBlock,
```

### 3.2 New `BlockCategory` and `IntegrationTag`

Add `'governance'` to the `IntegrationTag` union in `apps/sim/blocks/types.ts`:

```typescript
// apps/sim/blocks/types.ts
export type IntegrationTag =
  | 'ai'
  | 'communication'
  | 'databases'
  | 'data-transformation'
  | 'storage'
  | 'productivity'
  | 'developer-tools'
  | 'finance'
  | 'crm'
  | 'governance'   // ← ADD
```

CP blocks use `category: 'blocks'` (they are workflow primitives, not integration tools) and `integrationType: 'governance'`. This causes them to appear under a "Governance" section in the block toolbar automatically — no toolbar code changes needed.

### 3.3 The `DecideBlock` (Reference Implementation)

```typescript
// apps/sim/blocks/blocks/governance/decide.ts
import { DecideIcon } from '@/components/icons/governance'
import type { BlockConfig } from '@/blocks/types'

export const DecideBlock: BlockConfig = {
  type: 'governance_decide',
  name: 'Decide',
  description: 'A discretionary institutional decision requiring authority evaluation and evidence review. Calls Precepto enforcement engine; produces a hash-chained receipt.',
  longDescription: `
## Decide (IGSL DECIDE)

The Decide block represents a binding institutional determination — a point where an authorised actor commits to an outcome after evaluating evidence and reasoning.

**What it does at runtime:**
1. Receives evidence and authority context from connected automation blocks
2. Packages a CommitmentSubmission (evidence_entries, actor_id, outcome, reasoning)
3. Submits to Precepto's enforcement engine via HTTP
4. Precepto evaluates six gates deterministically (no LLM) and returns a receipt
5. The receipt (outcome_token, gate_results, blocked_gates) flows downstream

**Sacred rule:** This block never uses an LLM to make decisions. Agents gather. Precepto decides.
  `,
  bestPractices: `
IGSL DECIDE blocks require:
- authority_model set (SINGLE, JOINT, DELEGATED, ALTERNATIVE, or ATTRIBUTE_DETERMINED)
- At least one evidence requirement defined
- allowed_outcomes with at least one outcome token
- A recourse path for adverse outcomes (IGSL RECOURSE gate requirement)

For JOINT authority: set quorum to the minimum number of distinct actors required.
For DELEGATED authority: ensure a DELEGATE CP precedes this block in the dependency chain.
For automated decisions (automation_level: AUTOMATED): set accountability_actor to the human accountable role.
  `,
  category: 'blocks',
  integrationType: 'governance',
  bgColor: '#3B82F6',
  icon: DecideIcon,
  subBlocks: [
    // ── Identity ────────────────────────────────────────────────────
    {
      id: 'cp_name',
      title: 'Commitment Point Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g. Eligibility Determination',
      required: true,
    },
    {
      id: 'cp_description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'What institutional act does this commitment point represent?',
    },

    // ── Authority Gate ───────────────────────────────────────────────
    {
      id: 'authority_model',
      title: 'Authority Model',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'Single (one authorised actor)', id: 'SINGLE' },
        { label: 'Alternative (interchangeable actors)', id: 'ALTERNATIVE' },
        { label: 'Joint (quorum required)', id: 'JOINT' },
        { label: 'Delegated (via prior DELEGATE CP)', id: 'DELEGATED' },
        { label: 'Attribute Determined (dynamic role)', id: 'ATTRIBUTE_DETERMINED' },
      ],
      defaultValue: 'SINGLE',
    },
    {
      id: 'authority_roles',
      title: 'Required Roles',
      type: 'table',
      columns: ['Role Name'],
      tooltip: 'Actor must hold at least one of these roles.',
      condition: { field: 'authority_model', value: ['SINGLE', 'ALTERNATIVE', 'JOINT'] },
    },
    {
      id: 'authority_quorum',
      title: 'Quorum (distinct actors)',
      type: 'short-input',
      placeholder: 'e.g. 2',
      condition: { field: 'authority_model', value: 'JOINT' },
      tooltip: 'Minimum number of distinct actors who must each hold an authorised role.',
    },
    {
      id: 'authority_delegation_scope',
      title: 'Delegation Scope',
      type: 'short-input',
      placeholder: 'e.g. financial_approval',
      condition: { field: 'authority_model', value: 'DELEGATED' },
    },
    {
      id: 'accountability_actor',
      title: 'Accountability Actor (for automated decisions)',
      type: 'short-input',
      placeholder: 'Role or actor ID responsible for automated outcomes',
      condition: { field: 'automation_level', value: 'AUTOMATED' },
      tooltip: 'IGSL v1.2 requires an accountable human when automation_level is AUTOMATED.',
    },

    // ── Automation Level ─────────────────────────────────────────────
    {
      id: 'automation_level',
      title: 'Automation Level',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'Manual (human decides)', id: 'MANUAL' },
        { label: 'AI Assisted (AI supports, human decides)', id: 'AI_ASSISTED' },
        { label: 'AI Oversight (AI decides, human can override)', id: 'AI_OVERSIGHT' },
        { label: 'Automated (no human in loop)', id: 'AUTOMATED' },
      ],
      defaultValue: 'AI_ASSISTED',
    },

    // ── Evidence Gate ────────────────────────────────────────────────
    {
      id: 'evidence_requirements',
      title: 'Required Evidence',
      type: 'table',
      columns: ['Field Name', 'Type', 'Required', 'Attestation Level'],
      tooltip: 'Evidence that must be present in the submission. Field names must match what automation blocks provide via evidence-in connections.',
      required: true,
    },

    // ── Temporal Conditions ──────────────────────────────────────────
    {
      id: 'deadline_enabled',
      title: 'Deadline',
      type: 'switch',
      defaultValue: false,
    },
    {
      id: 'deadline_duration',
      title: 'Deadline Duration',
      type: 'short-input',
      placeholder: 'ISO 8601 duration, e.g. P30D',
      condition: { field: 'deadline_enabled', value: true },
    },
    {
      id: 'auto_resolve',
      title: 'Auto-resolve on timeout',
      type: 'dropdown',
      options: [
        { label: 'No — block until manually resolved', id: 'false' },
        { label: 'AUTO_APPROVE — automatically approve', id: 'AUTO_APPROVE' },
        { label: 'DEEMED_REFUSAL — treat silence as refusal', id: 'DEEMED_REFUSAL' },
        { label: 'AUTO_CLOSE — close the case', id: 'AUTO_CLOSE' },
      ],
      defaultValue: 'false',
      condition: { field: 'deadline_enabled', value: true },
      tooltip: 'AUTO_APPROVE is only valid with direction=INSTITUTIONAL (IGSL validation code TEMPORAL_AUTO_APPROVE_CITIZEN_DIRECTION).',
    },
    {
      id: 'temporal_direction',
      title: 'Direction',
      type: 'dropdown',
      options: [
        { label: 'Institutional (institution acts)', id: 'INSTITUTIONAL' },
        { label: 'Citizen (citizen acts)', id: 'CITIZEN' },
      ],
      condition: { field: 'auto_resolve', value: ['AUTO_APPROVE', 'DEEMED_REFUSAL', 'AUTO_CLOSE'] },
    },

    // ── Outcomes ─────────────────────────────────────────────────────
    {
      id: 'allowed_outcomes',
      title: 'Allowed Outcomes',
      type: 'table',
      columns: ['Token', 'Label', 'Is Adverse'],
      tooltip: 'The set of valid outcome tokens this CP can produce. Include AUTO_APPROVE/DEEMED_REFUSAL/AUTO_CLOSE if using auto-resolve.',
      required: true,
    },

    // ── Recourse Gate ────────────────────────────────────────────────
    {
      id: 'recourse_paths',
      title: 'Recourse Paths',
      type: 'table',
      columns: ['For Outcomes', 'Via CP ID', 'Window', 'Remedial Powers'],
      tooltip: 'Required by IGSL for any outcome that is adverse. "Via CP ID" can reference an APPEAL block downstream.',
    },

    // ── Proposed Outcome ─────────────────────────────────────────────
    {
      id: 'proposed_outcome',
      title: 'Proposed Outcome',
      type: 'short-input',
      layout: 'full',
      description: 'The outcome token being proposed (e.g., APPROVED, DENIED). Set by the submitting actor or automation. For AUTOMATED CPs, wire this from the upstream automation block output using {{<block.output>}} interpolation. For MANUAL/SUPERVISED CPs, this comes from the human via a connected HITL block. The CP block executor reads this field directly for the CommitmentSubmission.',
      placeholder: 'e.g. APPROVED or {{<upstream_block.outcome>}}',
      required: true,
    },

    // ── Produces (IGSL v1.2) ─────────────────────────────────────────
    {
      id: 'produces',
      title: 'Produces',
      type: 'table',
      columns: ['Output Type', 'Available To (CP IDs)'],
      tooltip: 'IGSL v1.2: declare what structural output this CP makes available downstream.',
    },

    // ── Reasoning Gate ───────────────────────────────────────────────
    {
      id: 'reasoning_required',
      title: 'Reasoning Required',
      type: 'switch',
      defaultValue: false,
    },
    {
      id: 'reasoning_privilege',
      title: 'Reasoning Privilege',
      type: 'dropdown',
      options: [
        { label: 'None (public)', id: 'NONE' },
        { label: 'Work Product', id: 'WORK_PRODUCT' },
        { label: 'Attorney-Client', id: 'ATTORNEY_CLIENT' },
      ],
      defaultValue: 'NONE',
      condition: { field: 'reasoning_required', value: true },
    },
  ],
  inputs: {
    evidence_in: {
      type: 'json',
      description: 'Evidence object from upstream automation blocks. Keys must match evidence_requirements field names.',
    },
    authority_in: {
      type: 'json',
      description: 'Actor identity and role context from upstream automation blocks.',
    },
    activation: {
      type: 'json',
      description: 'Activation signal from upstream CP blocks (dependency satisfaction).',
    },
  },
  outputs: {
    receipt: {
      type: 'json',
      description: 'Full Precepto enforcement receipt. Contains content_hash, gate_results, outcome, timestamp.',
    },
    outcome_token: {
      type: 'string',
      description: 'The committed outcome token (e.g. "APPROVED", "REJECTED", "DEEMED_REFUSAL").',
    },
    blocked_gates: {
      type: 'json',
      description: 'Array of gate types that blocked, if any. Non-empty means the submission was rejected.',
    },
    receipt_hash: {
      type: 'string',
      description: 'SHA-256 content hash of the receipt. Use to reference this commitment from downstream blocks.',
    },
  },
  tools: {
    access: [],  // CP blocks do not use the GenericBlockHandler tool path
  },
}
```

### 3.4 All Eight CP Block Types

Each block follows the same pattern as DECIDE. Below are the type-specific differences.

| Block Type | `type` key | `bgColor` | Key Differences from DECIDE |
|---|---|---|---|
| **DECIDE** | `governance_decide` | `#3B82F6` | Reference implementation above |
| **ATTEST** | `governance_attest` | `#6366F1` | No `allowed_outcomes` table (produces ATTESTATION); `attestation_level` dropdown (ASSERTED → ANCHORED); `attestation_scope` text field |
| **APPEAL** | `governance_appeal` | `#8B5CF6` | Adds `appeals_cp_id` field (ID of DECIDE/ATTEST/DELEGATE being appealed — drives IGSL DEPENDENCY_APPEAL_MISSING_RELATIONSHIP validation); multi-tier depth display |
| **CLOSE** | `governance_close` | `#64748B` | Minimal config — produces CLOSURE; no recourse paths; `close_reason` dropdown (COMPLETED, WITHDRAWN, EXPIRED, ADMINISTRATIVE) |
| **REMEDY** | `governance_remedy` | `#F59E0B` | `remedy_type` (CORRECTION, COMPENSATION, REVERSAL); references prior DECIDE CP that failed; `remedy_actions` table |
| **DELEGATE** | `governance_delegate` | `#10B981` | `delegatee_roles` table; `delegation_scope` text; `delegation_depth_limit` number; produces DECISION (the delegation itself is a binding act) |
| **OVERRIDE** | `governance_override` | `#EF4444` | `overrides_cp_id` (the CP being overridden); `override_authority` (must be stronger than original); `override_justification` long-input (required) |
| **EVOLVE** | `governance_evolve` | `#EC4899` | `proposed_changes` long-input; `version_bump` dropdown (MAJOR, MINOR, PATCH); no receipt output (EVOLVE does not produce a commitment receipt — it triggers a protocol version change) |

### 3.5 Shared Sub-Blocks (All CP Types)

In addition to type-specific sub-blocks, every CP block definition includes these two shared sub-blocks:

**`proposed_outcome`** (see §3.3 for full definition) — the outcome token being proposed. For AUTOMATED CPs, wired from upstream automation output. For MANUAL/SUPERVISED CPs, from the HITL block.

**`actor_identity_config`** — actor configuration for AUTOMATED and DELEGATED CPs:

```typescript
// Add to every CP block's subBlocks array:
{
  id: 'actor_identity_config',
  title: 'Actor Identity (Automated)',
  type: 'short-input',
  placeholder: 'Role or service account for automated submissions',
  condition: { field: 'automation_level', value: ['AUTOMATED', 'AI_OVERSIGHT'] },
  tooltip: 'For MANUAL/AI_ASSISTED flows, actor identity is resolved from the connected HITL block or the authenticated Sim user (Better Auth session). For AUTOMATED flows, set the accountable role here. See §6.5 for the GovernanceActorIdentity interface.',
},
```

For MANUAL and AI_ASSISTED flows, actor identity is derived automatically from the authenticated user's role mapping (the Authority layer from the harness stack) — no manual config needed.

---

### 3.6 Shared CP Utilities

```typescript
// apps/sim/blocks/blocks/governance/utils.ts

export const CP_TYPES = [
  'governance_decide',
  'governance_attest',
  'governance_appeal',
  'governance_close',
  'governance_remedy',
  'governance_delegate',
  'governance_override',
  'governance_evolve',
] as const

export type CPBlockType = typeof CP_TYPES[number]

export function isCPBlock(type: string): type is CPBlockType {
  return (CP_TYPES as readonly string[]).includes(type)
}

export const CP_IGSL_TYPE_MAP: Record<CPBlockType, string> = {
  governance_decide: 'DECIDE',
  governance_attest: 'ATTEST',
  governance_appeal: 'APPEAL',
  governance_close: 'CLOSE',
  governance_remedy: 'REMEDY',
  governance_delegate: 'DELEGATE',
  governance_override: 'OVERRIDE',
  governance_evolve: 'EVOLVE',
}
```

---

## 4. CP Block Visual System

### 4.1 Icons

Create 8 SVG icon components in `apps/sim/components/icons/governance/`:

```
apps/sim/components/icons/governance/
├── index.ts        ← barrel export
├── decide.tsx      ← Gavel / checkmark-in-circle
├── attest.tsx      ← Certificate / stamp
├── appeal.tsx      ← Arrow-up / scale-of-justice
├── close.tsx       ← Lock / archive
├── remedy.tsx      ← Wrench / bandage
├── delegate.tsx    ← Arrow-forward-person
├── override.tsx    ← Lightning / override-arrow
└── evolve.tsx      ← Refresh-protocol / gear-upgrade
```

Each icon follows the existing pattern: a React component accepting `SVGProps<SVGSVGElement>`:

```typescript
// apps/sim/components/icons/governance/decide.tsx
export const DecideIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Gavel shape — final authority */}
    <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z" />
  </svg>
)
```

Exact paths TBD with design. The semantic intention for each:

| CP Type | Icon Semantic | Visual Concept |
|---|---|---|
| DECIDE | Final authority / binding determination | Gavel |
| ATTEST | Certification / proof of fact | Certificate with seal |
| APPEAL | Challenge / reconsideration | Scale with arrow |
| CLOSE | Case termination | Lock / archive box |
| REMEDY | Correction / repair | Wrench or bandage |
| DELEGATE | Authority transfer | Person-to-person arrow |
| OVERRIDE | Stronger authority prevails | Lightning bolt |
| EVOLVE | Protocol self-modification | Gear with refresh arrow |

### 4.2 Visual Treatment in `WorkflowBlock`

The `WorkflowBlock` component (`components/workflow-block/workflow-block.tsx`) already reads `bgColor` from the block config and applies it to the header. For CP blocks, add a visual marker in the block header:

```typescript
// In workflow-block.tsx — in the header render section
// Find where block name and icon render, add CP badge alongside:

{isCPBlock(data.type) && (
  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded
                   bg-white/20 text-white tracking-wider">
    CP
  </span>
)}
```

Additionally, apply a distinctive border to CP blocks:

```typescript
// In the outer container className (alongside existing focus ring, diff, lock classes):
isCPBlock(data.type) && 'ring-2 ring-blue-400/60 ring-offset-1'
```

The `isCPBlock` utility (`blocks/blocks/governance/utils.ts`) is imported and used here.

### 4.3 Color Reference

```
DECIDE    #3B82F6  blue-500     — primary decision authority
ATTEST    #6366F1  indigo-500   — certification/verification
APPEAL    #8B5CF6  violet-500   — challenge/recourse
CLOSE     #64748B  slate-500    — terminal/archive
REMEDY    #F59E0B  amber-500    — correction/repair
DELEGATE  #10B981  emerald-500  — authority transfer
OVERRIDE  #EF4444  red-500      — override/stronger authority
EVOLVE    #EC4899  pink-500     — protocol evolution
```

All are in the Tailwind standard palette — no custom tokens needed.

---

## 5. Gate Handles: Connecting Automation to CP Gates

### 5.1 Gate Handle Design

CP blocks expose named connection handles per gate — `evidence-in`, `authority-in`, `activation`. These allow automation blocks upstream to explicitly wire their outputs to the governance gate they're satisfying.

At MVP, three input handles per CP block:

| Handle ID | Gate | What connects to it |
|---|---|---|
| `evidence-in` | EVIDENCE gate | API blocks, document lookups, form inputs, Agent blocks gathering evidence |
| `authority-in` | AUTHORITY gate | HITL blocks (who approved), OAuth-identity blocks, credential verifiers |
| `activation` | DEPENDENCY gate | Upstream CP blocks (receipt output → this block's activation input) |

One standard output handle for normal flow, plus gate-result-specific outputs:

| Handle ID | What it carries |
|---|---|
| `source` (default) | Full receipt object — for downstream CPs and notification blocks |
| `outcome` | Outcome token string — for condition blocks branching on APPROVED/REJECTED |
| `blocked` | Blocked gate details — routes to error/recovery automation blocks |

### 5.2 Handle Registration

Sim registers dynamic handles via the block's `inputs` and `outputs` schema. The `WorkflowBlock` component renders `Handle` components based on the block's inputs/outputs. CP blocks declare their handles in the `BlockConfig.inputs` / `BlockConfig.outputs` fields (already shown in §3.3).

For MVP, the standard left/right horizontal handle layout works fine. The gate-handle labels appear as tooltip text when the user hovers over a handle.

Future UX enhancement (Phase 4+): Group handles visually with gate-type color coding (evidence-in in amber, authority-in in green, activation in blue).

### 5.3 Connecting Automation to Gates

A typical pattern — using existing Sim blocks:

```
[API Block: GET /cadastre/:parcel_id]
  output.data ──────────────────────────→ [DECIDE: Eligibility].evidence-in

[HITL Block: Officer Review]
  output.approved_by ───────────────────→ [DECIDE: Eligibility].authority-in

[DECIDE: Pre-screening] (upstream CP)
  output.receipt ───────────────────────→ [DECIDE: Eligibility].activation
```

The CP block executor reads all three inputs when it fires, packages them into a `CommitmentSubmission`, and sends to Precepto.

### 5.4 Edge Labels

Add label support to `WorkflowEdge` for edges connecting to CP gate handles. When an edge's `targetHandle` is one of `['evidence-in', 'authority-in', 'activation']`, render a small label on the edge:

```typescript
// In workflow-edge.tsx
const GATE_HANDLE_LABELS: Record<string, string> = {
  'evidence-in': 'evidence',
  'authority-in': 'authority',
  'activation': 'depends on',
}

// In the edge SVG render:
{GATE_HANDLE_LABELS[data.targetHandle] && (
  <EdgeLabelRenderer>
    <div className="text-[9px] text-muted-foreground bg-background/80 px-1 rounded">
      {GATE_HANDLE_LABELS[data.targetHandle]}
    </div>
  </EdgeLabelRenderer>
)}
```

---

## 6. Enforcement Integration

### 6.0 GovernedContext Creation Flow

A `GovernedContext` in Precepto is the container for all receipts in a single case (one instance of a protocol running for one subject). Every `CommitmentSubmission` must reference a `context_id` — without it, Precepto cannot chain receipts, evaluate dependency gates, or track `CommitmentPointState` across the workflow execution.

#### When Is a Context Created?

For MVP, the context is created **automatically on the first CP block execution** in a given workflow run, if no `context_id` already exists in the execution's variables:

```typescript
// At the top of GovernanceCPBlockHandler.execute():
let contextId = ctx.variables?.['governed_context_id'] as string | undefined

if (!contextId) {
  // First CP block in this execution — create the Precepto context
  const context = await client.createContext({
    protocol_version_id: params.protocol_version_id,
    execution_mode: 'DRY_RUN',   // hardcoded for MVP (see DRY_RUN note in §6.1)
    subject_ref: ctx.workflowExecutionId,
  })
  contextId = context.id
  // Store in workflow execution variables so all subsequent CP blocks share it
  ctx.variables = { ...ctx.variables, governed_context_id: contextId }
}
```

#### How `context_id` Flows Through the Workflow

1. **Trigger fires** — a new workflow execution starts. No `governed_context_id` in execution variables yet.
2. **First CP block executes** — `GovernanceCPBlockHandler` calls `createContext()` on Precepto. The returned `context_id` is written to `ctx.variables['governed_context_id']`.
3. **Subsequent CP blocks** — each reads `governed_context_id` from `ctx.variables`. No new context is created; all blocks share the same context.
4. **All receipts** in the execution are chained within this context. Precepto links them, evaluates dependency gates across them, and builds the full audit trail.

#### Future: “Start Case” Trigger Block (Post-MVP)

For post-MVP, a dedicated **Start Case** trigger block will create the Precepto context explicitly before any CP block executes. This makes context creation visible on the canvas and allows the operator to configure context-level settings (subject identity, protocol version, retention policy) in a panel editor. For MVP, implicit creation on first CP execution is sufficient.

#### Context Lifecycle (MVP)

- **Created:** On first CP block execution in a workflow run (implicitly)
- **Active:** For the duration of that workflow execution
- **Archived:** Never explicitly in MVP — Precepto manages context lifecycle independently
- **Reopened:** Not supported in MVP

See Open Question Q6 (§14) for the full lifecycle discussion.

---

### 6.1 The CP Block Executor

CP blocks get a dedicated `GovernanceCPBlockHandler` in the Sim executor. This handler does **not** call any LLM. It calls Precepto's enforcement engine via HTTP.

```
apps/sim/executor/handlers/governance/
├── governance-cp-handler.ts    ← the handler
├── precepto-client.ts          ← thin HTTP client wrapping Precepto API
└── types.ts                    ← CommitmentSubmission, EnforcementReceipt types
```

#### `governance-cp-handler.ts`

```typescript
// apps/sim/executor/handlers/governance/governance-cp-handler.ts

import type { BlockHandler, BlockOutput, SerializedBlock } from '@/executor/types'
import type { ExecutionContext } from '@/executor/types'
import { isCPBlock, CP_IGSL_TYPE_MAP } from '@/blocks/blocks/governance/utils'
import { PreceptoClient } from './precepto-client'
import type { CommitmentSubmission, GovernanceActorIdentity } from './types'

export class GovernanceCPBlockHandler implements BlockHandler {
  // DRY_RUN is hardcoded for the entire MVP period.
  // All receipts are tagged DRY_RUN per roadmap constraint.
  // Remove this flag when transitioning to production enforcement.
  private readonly DRY_RUN = true

  canHandle(block: SerializedBlock): boolean {
    // block.type is the registry key (e.g. 'governance_decide') — NOT block.metadata?.id (instance UUID)
    // Use isCPBlock() which checks against the CP_TYPES set, or use block.type.startsWith('governance_')
    return isCPBlock(block.type)
  }

  async execute(
    ctx: ExecutionContext,
    block: SerializedBlock,
    inputs: Record<string, unknown>
  ): Promise<BlockOutput> {
    const params = block.config.params
    // block.type is the registry key (e.g. 'governance_decide') — correct field for CP type lookup
    const commitmentType = CP_IGSL_TYPE_MAP[block.type as CPBlockType]

    // Resolve the GovernedContext for this execution (see §6.0)
    const contextId = ctx.variables?.['governed_context_id'] as string | undefined

    // Build the CommitmentSubmission from resolved inputs + block config
    const submission: CommitmentSubmission = {
      commitment_point_id: params.cp_id,     // Precepto CP ID linked to this block
      context_id: contextId,                 // GovernedContext — links all receipts in this case
      actor_identity: inputs.authority_in as GovernanceActorIdentity ?? ctx.actorIdentity,
      outcome: params.proposed_outcome,      // set via proposed_outcome sub-block or upstream automation
      evidence: this.buildEvidenceMap(inputs.evidence_in, params.evidence_requirements),
      reasoning_text: inputs.reasoning_text as string ?? null,
      reasoning_privilege: params.reasoning_privilege ?? 'NONE',
      dry_run: this.DRY_RUN,               // tagged DRY_RUN for entire MVP period
    }

    // Call Precepto enforcement engine
    const client = new PreceptoClient(ctx.env.PRECEPTO_API_URL, ctx.env.PRECEPTO_API_KEY)

    let response: CommitmentResponse
    try {
      response = await client.submitCommitment(params.cp_id, submission)
    } catch (err) {
      throw new Error(`Precepto enforcement engine unreachable: ${err}`)
    }

    if (response.status === 'COMMITTED') {
      return {
        receipt: response.receipt,
        outcome_token: response.receipt.outcome,
        blocked_gates: [],
        receipt_hash: response.receipt.content_hash,
      }
    }

    if (response.status === 'BLOCKED') {
      // Return blocked output — downstream "blocked" handle edge handles recovery
      return {
        receipt: null,
        outcome_token: null,
        blocked_gates: response.failed_gates,
        gate_details: response.blocked_details,
        error: `CP blocked: gates failed: ${response.failed_gates.join(', ')}`,
      }
    }

    if (response.status === 'FINALIZING') {
      // Signing requirement unmet — return _pauseMetadata for Sim's pause mechanism
      // The HITL block pattern handles finalization approval
      return {
        _pauseMetadata: {
          contextId: `finalize-${block.id}-${Date.now()}`,
          type: 'governance_finalization',
          message: 'Commitment requires finalization (signing). Waiting for authorized signatures.',
          cpId: params.cp_id,
        },
      }
    }

    throw new Error(`Unexpected Precepto response status: ${response.status}`)
  }

  private buildEvidenceMap(
    evidenceIn: unknown,
    requirements: EvidenceRequirement[]
  ): Record<string, SubmittedEvidenceValue> {
    const raw = (evidenceIn ?? {}) as Record<string, unknown>
    const result: Record<string, SubmittedEvidenceValue> = {}
    for (const req of requirements ?? []) {
      if (raw[req.field_name] !== undefined) {
        result[req.field_name] = {
          value: raw[req.field_name],
          attestation_level: req.attestation_level ?? 'ASSERTED',
        }
      }
    }
    return result
  }
}
```

#### Register the handler

```typescript
// apps/sim/executor/handlers/registry.ts
// Add BEFORE GenericBlockHandler (first-match-wins):

import { GovernanceCPBlockHandler } from './governance/governance-cp-handler'

export function getAllHandlers(): BlockHandler[] {
  return [
    new TriggerBlockHandler(),
    new FunctionBlockHandler(),
    new ApiBlockHandler(),
    new ConditionBlockHandler(),
    new RouterBlockHandler(),
    new ResponseBlockHandler(),
    new HumanInTheLoopBlockHandler(),
    new GovernanceCPBlockHandler(),   // ← ADD before GenericBlockHandler
    new AgentBlockHandler(),
    new MothershipBlockHandler(),
    new VariablesBlockHandler(),
    new WorkflowBlockHandler(),
    new WaitBlockHandler(),
    new EvaluatorBlockHandler(),
    new CredentialBlockHandler(),
    new GenericBlockHandler(),        // fallback
  ]
}
```

### 6.2 Precepto Client

```typescript
// apps/sim/executor/handlers/governance/precepto-client.ts

export class PreceptoClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async submitCommitment(
    cpId: string,
    submission: CommitmentSubmission
  ): Promise<CommitmentResponse> {
    const res = await fetch(
      `${this.baseUrl}/v1/commitment-points/${cpId}/submissions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Precepto ${res.status}: ${text}`)
    }
    return res.json() as Promise<CommitmentResponse>
  }

  async preflight(
    cpId: string,
    submission: Partial<CommitmentSubmission>
  ): Promise<PreflightResult> {
    const res = await fetch(`${this.baseUrl}/v1/commitment-points/${cpId}/preflight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Precepto preflight ${res.status}: ${text}`)
    }
    return res.json() as Promise<PreflightResult>
  }
}
```

Environment variables to add to `.env.local` / Vercel / Railway:

```
PRECEPTO_API_URL=https://precepto-api.railway.app
PRECEPTO_API_KEY=<workspace-scoped key from Precepto mcp_api_keys table>
```

### 6.3 Actor Identity

#### Interface

```typescript
// apps/sim/executor/handlers/governance/types.ts

interface GovernanceActorIdentity {
  actor_id: string              // User ID from Sim's auth (Better Auth)
  role: string                  // Institutional role (e.g., 'technical_reviewer')
  verification_method: 'PLATFORM_AUTH' | 'DELEGATED' | 'ATTESTED'
  delegation_chain?: string[]   // If acting on behalf of another actor
}
```

#### Resolution in the Handler

The handler resolves actor identity from three sources, in priority order:

1. **`inputs.authority_in`** — an upstream HITL block or identity block explicitly provides the actor. Used for MANUAL and SUPERVISED workflows where the approving officer is known at runtime. The `authority_in` input is expected to conform to `GovernanceActorIdentity`.
2. **`ctx.userId` (Sim auth session)** — for AI_ASSISTED workflows, the logged-in Sim user is the accountable actor. Verification method: `PLATFORM_AUTH`.
3. **`params.actor_identity_config` (block config)** — for AUTOMATED workflows, a configured service account or role string. Verification method: `ATTESTED`.

Upstream blocks (HITL, OAuth, credential verifiers) connected to the `authority-in` gate handle must produce a `GovernanceActorIdentity`-shaped JSON object.

---

### 6.4 Execution Flow (End-to-End)

```
1. Workflow runs. DAG reaches a CP block node.
2. BlockExecutor.execute() is called.
3. findHandler() → GovernanceCPBlockHandler.canHandle() returns true.
   (Checks block.type via isCPBlock() — NOT block.metadata?.id)
4. resolver.resolveInputs() resolves upstream outputs:
     - inputs.evidence_in  ← output of API block connected to evidence-in handle
     - inputs.authority_in ← output of HITL block connected to authority-in handle (GovernanceActorIdentity)
     - inputs.activation   ← output of upstream CP's receipt connected to activation handle
5. GovernanceCPBlockHandler.execute() runs:
     a. Resolves or creates GovernedContext (see §6.0) — stores context_id in ctx.variables
     b. Builds CommitmentSubmission from resolved inputs + block subBlock values
        (including proposed_outcome, context_id, dry_run: true)
     c. Calls PreceptoClient.submitCommitment()
     d. Precepto evaluates 6 gates deterministically (no LLM)
     e. Returns COMMITTED | BLOCKED | FINALIZING
6. On COMMITTED:
     - outputs: { receipt, outcome_token, blocked_gates: [], receipt_hash }
     - EdgeManager routes downstream based on outcome_token
     - Downstream condition/router blocks can branch on outcome_token value
7. On BLOCKED:
     - outputs: { receipt: null, blocked_gates: [...], gate_details: {...} }
     - If a "blocked" handle edge exists → routes to recovery automation blocks
     - If no "blocked" handle edge → executor throws, marks execution failed
8. On FINALIZING:
     - Returns _pauseMetadata → execution pauses (Sim's existing pause/resume infra)
     - HITL or signature-collection block handles finalization
```

### 6.5 Linking Sim Blocks to Precepto CPs

Each CP block has a hidden `cp_id` sub-block — the Precepto commitment point ID that this Sim block enforces through:

```typescript
// Add to every CP block's subBlocks array:
{
  id: 'cp_id',
  title: 'Precepto CP ID',
  type: 'short-input',
  hidden: false,   // visible — operator must link it to a Precepto CP
  placeholder: 'e.g. cp_01HXYZ...',
  tooltip: 'The Precepto commitment_point.id that this block submits to. Get this from Protocol Studio or the Precepto API.',
  required: true,
},
```

For now this is a manual text field. In Phase 4, the governance copilot can auto-populate it when scaffolding from a Precepto protocol. In a future version, a `protocol-cp-selector` sub-block type could let the user browse Precepto protocols and select a CP — but this is not MVP scope.

---

## 7. IGSL Validation Layer

### 7.1 What Gets Validated

Real-time structural validation runs on the canvas, checking the governance protocol graph against IGSL v1.2 rules. Validation is client-side (no server round-trip) using the IGSL v1.2 rule set.

**Validation scope:** Only CP blocks and edges between CP blocks. Automation blocks are not validated by IGSL rules.

**Validated rules (MVP — BLOCK severity codes first, then WARN):**

| IGSL Code | Severity | Rule |
|---|---|---|
| `DEPENDENCY_APPEALS_INVALID_TARGET` | BLOCK | APPEAL block's `appeals_cp_id` targets a CLOSE or EVOLVE block |
| `GATE_MISSING_REQUIRED_GATE` | BLOCK | CP block has no evidence requirements defined |
| `TEMPORAL_AUTO_RESOLVE_MISSING_OUTCOME` | BLOCK | `auto_resolve` is set but no `default_outcome` defined |
| `LIFECYCLE_RECURRING_NO_TRIGGER` | BLOCK | (Future: when protocol lifecycle is RECURRING) |
| `TOPOLOGY_MISSING_ENTRY_POINT` | BLOCK | No CP block is reachable from the workflow start |
| `REFERENCE_CIRCULAR_DEPENDENCY` | BLOCK | CP dependency graph has a cycle |
| `DEPENDENCY_APPEAL_MISSING_RELATIONSHIP` | WARN | APPEAL block has no `appeals_cp_id` set |
| `DEPENDENCY_MULTITIER_APPEALS` | WARN | APPEAL → APPEAL chain depth > 3 |
| `OVERRIDE_MISSING_TARGET` | WARN | OVERRIDE block has no dependency on a DECIDE or ATTEST block |
| `TOPOLOGY_ISOLATED_COMMITMENT_POINT` | WARN | CP block has no edges to/from other CP blocks |
| `TEMPORAL_DEEMED_REFUSAL_NO_APPEAL_PATH` | WARN | DECIDE with `DEEMED_REFUSAL` auto-resolve has no downstream APPEAL |
| `AUTHORITY_AUTOMATED_NO_ACCOUNTABILITY` | WARN | AUTOMATED CP has no `accountability_actor` |
| `PRODUCES_MISSING` | WARN | CP block has no `produces` entries (v1.2 annotation) |

### 7.2 Validator Implementation

```
apps/sim/lib/workflows/governance/
├── validate-protocol.ts     ← main validator — call this from the canvas hook
├── validation-rules.ts      ← individual rule functions
├── igsl-types.ts            ← ValidationIssue, ValidationSeverity types
└── index.ts                 ← barrel export
```

```typescript
// apps/sim/lib/workflows/governance/validate-protocol.ts

import type { BlockState } from '@/stores/workflows/workflow/types'
import type { Edge } from 'reactflow'
import { isCPBlock, CP_IGSL_TYPE_MAP } from '@/blocks/blocks/governance/utils'
import * as rules from './validation-rules'

export interface ValidationIssue {
  code: string
  severity: 'BLOCK' | 'WARN' | 'INFO'
  message: string
  blockId?: string         // which CP block the issue is on
  path?: string
}

export function validateProtocol(
  blocks: Record<string, BlockState>,
  edges: Edge[]
): ValidationIssue[] {
  const cpBlocks = Object.values(blocks).filter(b => isCPBlock(b.type))
  const cpEdges = edges.filter(e => {
    const src = blocks[e.source]
    const tgt = blocks[e.target]
    return src && tgt && isCPBlock(src.type) && isCPBlock(tgt.type)
  })

  const issues: ValidationIssue[] = []

  // BLOCK-severity rules
  issues.push(...rules.checkAppealTargets(cpBlocks, blocks))
  issues.push(...rules.checkEvidenceRequired(cpBlocks))
  issues.push(...rules.checkAutoResolveOutcome(cpBlocks))
  issues.push(...rules.checkEntryPoint(cpBlocks, cpEdges))
  issues.push(...rules.checkCircularDependencies(cpBlocks, cpEdges))

  // WARN-severity rules
  issues.push(...rules.checkAppealRelationship(cpBlocks))
  issues.push(...rules.checkMultiTierAppeals(cpBlocks, cpEdges))
  issues.push(...rules.checkOverrideTarget(cpBlocks, cpEdges))
  issues.push(...rules.checkIsolatedCPs(cpBlocks, cpEdges))
  issues.push(...rules.checkDeemedRefusalAppealPath(cpBlocks, cpEdges))
  issues.push(...rules.checkAutomatedAccountability(cpBlocks))

  return issues
}
```

### 7.3 Validation Display

**On-canvas validation indicators** (rendered in `WorkflowBlock`):

```typescript
// In workflow-block.tsx — add after importing the validation hook:

const validationIssues = useGovernanceValidation()   // see §7.4
const blockIssues = isCPBlock(data.type)
  ? validationIssues.filter(i => i.blockId === id)
  : []
const hasBlockError = blockIssues.some(i => i.severity === 'BLOCK')
const hasBlockWarn  = blockIssues.some(i => i.severity === 'WARN')

// In the outer container className:
hasBlockError && 'ring-2 ring-red-500',
hasBlockWarn  && !hasBlockError && 'ring-2 ring-yellow-400',

// Bottom of block body — issue count badge:
{blockIssues.length > 0 && (
  <Tooltip content={blockIssues.map(i => `[${i.severity}] ${i.message}`).join('\n')}>
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium',
      hasBlockError ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
    )}>
      {blockIssues.length} issue{blockIssues.length > 1 ? 's' : ''}
    </span>
  </Tooltip>
)}
```

**Validation panel** — a linter-style panel showing all issues across the workflow. Placed in the panel (right sidebar) as a new tab: `Protocol` alongside `Editor | Toolbar | Copilot | Deploy`.

```
Panel tabs: Editor | Toolbar | Protocol | Copilot | Deploy
```

The `Protocol` tab renders:

- Summary: "2 errors, 3 warnings" with colored counts
- Issue list: each issue has severity badge, IGSL code, message, and a "Jump to block" button
- Export button: disabled when any BLOCK-severity issues exist (see §8)

### 7.4 Validation Hook

```typescript
// apps/sim/app/workspace/[workspaceId]/w/[workflowId]/hooks/use-governance-validation.ts

export function useGovernanceValidation(): ValidationIssue[] {
  const blocks = useWorkflowStore(s => s.blocks)
  const edges  = useWorkflowStore(s => s.edges)

  return useMemo(
    () => validateProtocol(blocks, edges),
    [blocks, edges]
  )
}
```

Called once at the workflow canvas level, result passed down or read from a context. Runs on every block/edge change — validation is fast (< 5ms for typical protocol graphs of 10-20 CPs).

---

## 8. IGSL Export

### 8.1 What Export Does

The Protocol Layer of a workflow can be exported as a valid IGSL v1.2 JSON encoding. Export:

1. Reads all CP blocks from `useWorkflowStore`
2. Reads edges between CP blocks
3. Reads each CP block's `subBlocks` values from `useSubBlockStore`
4. Assembles a `ProtocolVersion` JSON object conforming to `igsl-v1.2-schema.json`
5. Validates: if any BLOCK-severity issues exist, export is disabled
6. Downloads as `<workflow-name>-igsl.json`

Export is **protocol layer only** — automation blocks are excluded from the IGSL export. The exported JSON is portable: any institution with a Precepto instance can import it.

### 8.2 Exporter Implementation

```
apps/sim/lib/workflows/governance/
└── igsl-exporter.ts
```

```typescript
// apps/sim/lib/workflows/governance/igsl-exporter.ts

export function exportToIGSL(
  workflowId: string,
  workflowName: string,
  blocks: Record<string, BlockState>,
  edges: Edge[],
  subBlockValues: Record<string, Record<string, unknown>>
): ProtocolVersion {
  const cpBlocks = Object.values(blocks).filter(b => isCPBlock(b.type))
  const cpEdges  = edges.filter(e =>
    isCPBlock(blocks[e.source]?.type) && isCPBlock(blocks[e.target]?.type)
  )

  const commitmentPoints: CommitmentPoint[] = cpBlocks.map((block, idx) => {
    const vals = subBlockValues[block.id] ?? {}
    return {
      id: vals.cp_id as string || block.id,   // prefer Precepto CP ID if linked
      protocol_version_id: '',                // filled after POST /v1/protocols
      name: vals.cp_name as string ?? block.name,
      description: { default_locale: 'en', default: vals.cp_description as string ?? '' },
      commitment_type: CP_IGSL_TYPE_MAP[block.type as CPBlockType],
      sequence_order: idx,
      authority_config: buildAuthorityConfig(vals),
      evidence_config: buildEvidenceConfig(vals),
      reasoning_config: buildReasoningConfig(vals),
      dependency_config: buildDependencyConfig(block.id, cpEdges),
      version_config: { required: true, allowed_model_versions: null },
      recourse_config: buildRecourseConfig(vals),
      automation_level: vals.automation_level as AutomationLevel ?? 'AI_ASSISTED',
      signing_requirement: 'NONE',
      allowed_outcomes: buildOutcomes(vals),
      outcome_overrides: {},
      metadata: { sim_block_id: block.id, sim_workflow_id: workflowId },
      produces: buildProduces(vals),
    }
  })

  const topology: ProtocolTopology = {
    nodes: cpBlocks.map(b => ({
      commitment_point_id: (subBlockValues[b.id]?.cp_id as string) || b.id,
      commitment_type: CP_IGSL_TYPE_MAP[b.type as CPBlockType],
      institutional_function_effect: null,
    })),
    edges: cpEdges.map(e => ({
      from_id: (subBlockValues[e.source]?.cp_id as string) || e.source,
      to_id:   (subBlockValues[e.target]?.cp_id as string) || e.target,
      type: e.targetHandle === 'activation'
        ? 'DEPENDS_ON'
        : e.data?.relationship ?? 'DEPENDS_ON',
      condition: null,
    })),
    properties: computeTopologyProperties(cpBlocks, cpEdges),
  }

  return {
    id: '',    // assigned by Precepto on import
    protocol_id: '',
    parent_version_id: null,
    version_label: '0.1.0',
    status: 'DRAFT',
    commitment_points: commitmentPoints,
    cross_case_rules: [],
    temporal_constraints: [],
    evidence_definitions: null,
    topology,
    domain_context: null,
    retention_policy: { id: 'default', default_retention: 'P7Y', partition_strategy: 'NONE', jurisdiction_rules: null },
    published_at: null,
    published_by: null,
    adoption_receipt_hash: null,
    amendment_notes: `Exported from Sim workflow: ${workflowName}`,
    created_at: new Date().toISOString(),
    description: { default_locale: 'en', default: `Protocol exported from Sim workflow "${workflowName}"` },
    igsl_version: '1.2',
    lifecycle: { type: 'DISCRETE' },
    external_bonds: null,
  }
}
```

### 8.3 Export UI

In the `Protocol` tab of the panel:

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={hasBlockLevelIssues}
  onClick={() => {
    const pv = exportToIGSL(workflowId, workflowName, blocks, edges, subBlockValues)
    const blob = new Blob([JSON.stringify(pv, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}-igsl.json`
    a.click()
    URL.revokeObjectURL(url)
  }}
>
  Export IGSL JSON
</Button>
{hasBlockLevelIssues && (
  <p className="text-xs text-destructive mt-1">
    Fix all errors before exporting
  </p>
)}
```

---

## 9. Governance Copilot

### 9.1 Overview

The governance copilot is **our own LLM assistant** — not Sim's Mothership copilot. It is tailored specifically for protocol design: it knows IGSL v1.2, knows the 8 CP types, knows the 7 confirmed patterns, and can scaffold, validate, and explain governance protocols.

It uses the same `edit_workflow` tool pattern as Sim's existing copilot (Mothership), so it can manipulate the canvas: add CP blocks, configure their sub-blocks, draw edges between them.

It lives in the same right-side panel `Copilot` tab, but powered by our own API endpoint that maintains governance-specific context.

### 9.2 System Context

The copilot sends the following in its system context on every request:

1. **IGSL v1.2 digest** — the full `igsl-v1.2-digest.yaml` content, pre-loaded on the server
2. **Reference manual overview** — the 8 CP types, 6 modules, 7 patterns, 15 agent architectures
3. **Current workflow state** — the CP blocks present, their config, the edges between them
4. **Current validation issues** — any IGSL errors/warnings so the copilot can explain and fix them

This context is large (~10K tokens). The server-side copilot route assembles it once per session.

### 9.3 API Endpoint

```
apps/sim/app/api/governance-copilot/route.ts
```

```typescript
// apps/sim/app/api/governance-copilot/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { IGSL_DIGEST } from '@/lib/workflows/governance/igsl-digest'       // pre-loaded YAML as string
import { REFERENCE_OVERVIEW } from '@/lib/workflows/governance/reference'  // reference/index.md as string

export async function POST(req: Request) {
  const { messages, workflowState, validationIssues } = await req.json()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are a governance protocol design assistant for Sim.
You help users design IGSL-compliant governance protocols by working with CP blocks on the Sim canvas.

## IGSL v1.2 Specification (Digest)
${IGSL_DIGEST}

## Reference Manual
${REFERENCE_OVERVIEW}

## Current Workflow CP Blocks
${JSON.stringify(workflowState.cpBlocks, null, 2)}

## Current Validation Issues
${JSON.stringify(validationIssues, null, 2)}

## Your Capabilities
You can:
1. Explain CP types, gate requirements, and IGSL rules
2. Diagnose validation issues and suggest fixes
3. Scaffold new CP blocks using the add_governance_blocks tool
4. Recommend patterns for given governance requirements
5. Explain what automation blocks should connect to which gate handles

## Rules
- Never suggest bypassing a gate requirement
- Respect IGSL v1.2 validation codes — if you suggest a structure, it must pass validation
- Be concrete: when suggesting edits, use tool calls, not just descriptions
- Keep responses short unless the user asks for detail
`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools: [
      {
        name: 'add_governance_blocks',
        description: 'Add CP blocks and edges to the workflow canvas',
        input_schema: {
          type: 'object',
          properties: {
            blocks: {
              type: 'array',
              items: { /* BlockConfig subset */ },
            },
            edges: {
              type: 'array',
              items: { /* edge spec */ },
            },
          },
        },
      },
      {
        name: 'scaffold_pattern',
        description: 'Scaffold a named governance pattern onto the canvas',
        input_schema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              enum: [
                'permissioning_chain',
                'conditionality_loop',
                'deliberative_sequence',
                'competitive_allocation',
                'sequential_adjudication',
                'simple_certification',
                'surge_protocol',
              ],
            },
          },
          required: ['pattern'],
        },
      },
    ],
  })

  return Response.json(response)
}
```

### 9.4 Pattern Templates

Seven pattern templates (matching the confirmed patterns from the reference manual):

```
apps/sim/lib/workflows/governance/patterns/
├── index.ts
├── permissioning-chain.ts      ← ATTEST → DECIDE → DECIDE → APPEAL → CLOSE
├── conditionality-loop.ts      ← DECIDE (condition) → loop body → CLOSE or REMEDY
├── deliberative-sequence.ts    ← ATTEST → ATTEST → DECIDE (quorum)
├── competitive-allocation.ts   ← multiple DECIDE (parallel) → CLOSE
├── sequential-adjudication.ts  ← DECIDE → APPEAL → APPEAL (multi-tier)
├── simple-certification.ts     ← ATTEST → CLOSE
└── surge-protocol.ts           ← DECIDE (expedited) → ATTEST → OVERRIDE window
```

Each pattern exports a function returning `{ blocks: BlockState[], edges: Edge[] }` — the set of pre-configured CP blocks with appropriate gate configs, ready for `batchAddBlocks()`.

```typescript
// apps/sim/lib/workflows/governance/patterns/permissioning-chain.ts

export function scaffoldPermissioningChain(basePosition: { x: number; y: number }) {
  const SPACING = 300
  const blocks: Partial<BlockState>[] = [
    {
      type: 'governance_attest',
      name: 'Initial Attestation',
      position: { x: basePosition.x, y: basePosition.y },
      subBlocks: {
        cp_name: { value: 'Eligibility Attestation' },
        automation_level: { value: 'MANUAL' },
        evidence_requirements: {
          value: [{ field_name: 'identity_doc', type: 'document', required: 'true', attestation_level: 'VERIFIED' }]
        },
      },
    },
    {
      type: 'governance_decide',
      name: 'Primary Decision',
      position: { x: basePosition.x + SPACING, y: basePosition.y },
      subBlocks: {
        cp_name: { value: 'Permit Decision' },
        authority_model: { value: 'SINGLE' },
        automation_level: { value: 'AI_ASSISTED' },
      },
    },
    {
      type: 'governance_appeal',
      name: 'Appeal Review',
      position: { x: basePosition.x + SPACING * 2, y: basePosition.y },
      subBlocks: {
        cp_name: { value: 'First-Tier Appeal' },
        automation_level: { value: 'MANUAL' },
      },
    },
    {
      type: 'governance_close',
      name: 'Case Closure',
      position: { x: basePosition.x + SPACING * 3, y: basePosition.y },
      subBlocks: {
        cp_name: { value: 'Case Closed' },
        close_reason: { value: 'COMPLETED' },
      },
    },
  ]
  // ... edges array ...
  return { blocks, edges }
}
```

### 9.5 Copilot UI Integration

The governance copilot reuses Sim's existing `Copilot` panel tab (`components/panel/components/copilot/`). The copilot component detects when the active workflow contains CP blocks and switches to the governance copilot endpoint instead of Mothership.

```typescript
// In the Copilot component:
const hasCPBlocks = Object.values(blocks).some(b => isCPBlock(b.type))
const copilotEndpoint = hasCPBlocks
  ? '/api/governance-copilot'
  : '/api/copilot'   // existing Mothership copilot
```

This means no new UI component is needed — the same chat interface, same tool-call rendering, just a different backend endpoint for governance workflows.

---

## 10. Module Scaffolding

### 10.1 What's a Module

A module is a cluster of CPs serving a common institutional sub-function. The six modules from the reference manual:

| Module | Function | Typical CPs |
|---|---|---|
| **Register** | Enrolment, intake, identity | ATTEST, DELEGATE |
| **Authorise** | Permission granting, licensing | DECIDE, ATTEST |
| **Resolve** | Appeals, disputes, reviews | APPEAL, DECIDE, CLOSE |
| **Enforce** | Sanctions, remedies, overrides | OVERRIDE, REMEDY, CLOSE |
| **Transfer** | Asset, benefit, or authority transfer | DECIDE, DELEGATE, CLOSE |
| **Allocate** | Competitive or quota-based allocation | multiple DECIDE, CLOSE |

### 10.2 MVP: Module Scaffolding via Copilot

For MVP, module scaffolding is delivered via the governance copilot's `scaffold_pattern` tool. When the user says "add a Resolve module" or clicks a module template in the copilot UI, the copilot calls `scaffold_pattern` with the appropriate pattern.

### 10.3 Future: Module Container (Post-MVP)

A visual container node grouping CPs into a labeled module (like Sim's Loop/Parallel containers). Not in scope for Phases 1-4. When built, it would follow the `SubflowNodeComponent` pattern:

```typescript
// future — not MVP
// apps/sim/blocks/blocks/governance_module.ts

// workflow.tsx nodeTypes:
const nodeTypes: NodeTypes = {
  workflowBlock: WorkflowBlock,
  noteBlock: NoteBlock,
  subflowNode: SubflowNodeComponent,
  governanceModule: GovernanceModuleNode,   // future
}
```

---

## 11. Database Changes

### 11.1 No Schema Changes for Sim's DB (MVP)

CP block state is stored in Sim's existing `workflow_blocks` table — `type`, `subBlocks` (jsonb), `outputs` (jsonb) — exactly like any other block. No new columns or tables needed in Sim's database for MVP.

Execution receipts are stored in Precepto's database (Precepto owns the receipt chain). Sim's `workflow_execution_logs.executionData` captures the CP block's output (the receipt object) as part of the normal block log — this is sufficient for Sim's execution history surface.

### 11.2 Precepto DB: `governance_decisions` Table (Recommended, Phase 2)

For a durable, queryable governance audit trail independent of Sim's execution logs, add a `governance_decisions` table in Precepto's DB:

```sql
-- In Precepto's database
-- File: apps/api/src/db/migrations/YYYYMMDD_governance_decisions.sql

CREATE TABLE governance_decisions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sim_workflow_id   TEXT NOT NULL,
  sim_execution_id  TEXT NOT NULL,
  sim_block_id      TEXT NOT NULL,
  precepto_cp_id    TEXT REFERENCES commitment_points(id),
  precepto_context_id TEXT REFERENCES governed_contexts(id),
  commitment_type   TEXT NOT NULL CHECK (commitment_type IN (
                      'DECIDE','ATTEST','APPEAL','CLOSE',
                      'REMEDY','DELEGATE','OVERRIDE','EVOLVE')),
  outcome_token     TEXT,
  receipt_hash      TEXT,
  blocked_gates     JSONB,
  gate_results      JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at      TIMESTAMPTZ
);

CREATE INDEX governance_decisions_workflow_idx ON governance_decisions(sim_workflow_id);
CREATE INDEX governance_decisions_execution_idx ON governance_decisions(sim_execution_id);
```

The `GovernanceCPBlockHandler` writes a row to this table (via `PrecepsoClient`) after every committed receipt. This is a fire-and-forget write — non-fatal if it fails.

### 11.3 Environment Configuration

```
# apps/sim/.env.local — add:
PRECEPTO_API_URL=https://precepto-api.railway.app
PRECEPTO_API_KEY=<workspace-scoped API key>
ANTHROPIC_API_KEY=<for governance copilot>
```

The `PRECEPTO_API_KEY` is a workspace-scoped key from Precepto's `mcp_api_keys` table, tied to one institution. In a multi-workspace setup, the key would be stored per workspace in Sim's `workspaceBYOKKeys` table and resolved at execution time — but for MVP with one institution, an env var is sufficient.

---

## 12. Phased Implementation Plan

### Phase 1 — Compose (Weeks 1–3)

**Goal:** Design governance protocols visually on Sim’s canvas, export valid IGSL.

- [ ] 8 governance block type definitions (all CP types) — start with `decide.ts` as reference, replicate for the other 7
- [ ] Register all 8 blocks in `blocks/registry.ts` with `category: 'governance'`
- [ ] Add `'governance'` to `IntegrationTag` union in `blocks/types.ts`
- [ ] 8 governance icons (SVG) in `components/icons/governance/`
- [ ] Panel editors with gate config sub-blocks (including `proposed_outcome` and `actor_identity_config`)
- [ ] IGSL validation layer — real-time grammar checks on canvas (`validate-protocol.ts` + `validation-rules.ts`)
- [ ] IGSL JSON export from canvas (`igsl-exporter.ts`)
- [ ] Governance section in block menu/toolbar (auto-grouped via `integrationType: 'governance'`)
- [ ] Visual treatment: blue color family, CP badge, distinctive 2px ring border
- [ ] Create `utils.ts` with `isCPBlock()`, `CP_IGSL_TYPE_MAP`, `CP_TYPES`
- [ ] Add `Protocol` tab to panel with validation issue list and Export button
- [ ] Smoke test: governance blocks appear in toolbar under “Governance” section
- [ ] Smoke test: panel editor opens and shows all sub-blocks correctly
- [ ] Smoke test: can draw an edge from API block output to DECIDE `evidence-in` handle
- [ ] Smoke test: create a DECIDE block with missing evidence requirements → red ring appears
- [ ] Smoke test: fix all issues → Export button becomes enabled → download valid JSON

**🏁 Demo milestone:** “I designed a building permit protocol on a canvas and exported valid IGSL v1.2 JSON”

---

### Phase 2 — Execute (Weeks 4–6)

**Goal:** Composed protocols actually run through Precepto’s enforcement engine.

- [ ] Governance block executor (`GovernanceCPBlockHandler`) in `executor/handlers/governance/`
- [ ] Precepto client integration (HTTP) — `precepto-client.ts` + `types.ts` (CommitmentSubmission, CommitmentResponse, GovernanceActorIdentity)
- [ ] GovernedContext creation flow: start case → get `context_id` → store in `ctx.variables['governed_context_id']` (see §6.0)
- [ ] Gate handle system: `evidence-in`, `authority-in`, `activation` connection points + edge labels in `workflow-edge.tsx`
- [ ] Automation blocks wire to CP gate handles
- [ ] Receipt flow: `outcome_token`, `gate_results`, `blocked_gates` downstream
- [ ] DRY_RUN mode enforced — `dry_run: true` hardcoded in `GovernanceCPBlockHandler` for entire MVP period
- [ ] Actor identity resolved from Sim auth → Precepto submission (see §6.3 `GovernanceActorIdentity`)
- [ ] Register handler in `executor/handlers/registry.ts` before `GenericBlockHandler`
- [ ] Add `PRECEPTO_API_URL` + `PRECEPTO_API_KEY` env vars
- [ ] Smoke test: run a workflow with a DECIDE block → calls Precepto → returns a receipt (DRY_RUN)
- [ ] Smoke test: BLOCKED response from Precepto routes to “blocked” handle correctly
- [ ] Smoke test: APPEAL block has `appeals_cp_id` → correct DEPENDENCY gate evaluation
- [ ] Integration test: full workflow (Slack + API → DECIDE → Gmail) runs end-to-end in DRY_RUN

**🏁 Demo milestone:** “A case runs end-to-end, enforcement engine evaluates every gate, receipts chain correctly”

---

### Phase 3 — Assist (Weeks 7–8)

**Goal:** AI helps compose protocols, pattern templates scaffold instantly.

- [ ] Governance copilot (Anthropic-backed, not Mothership) — `app/api/governance-copilot/route.ts`
- [ ] IGSL v1.2 digest + reference manual pre-loaded in copilot server context
- [ ] `add_governance_blocks` tool call: adds CP blocks + edges to canvas via `batchAddBlocks()`
- [ ] `scaffold_pattern` tool call: scaffolds one of 7 named governance patterns
- [ ] 7 pattern templates from reference manual: Permissioning Chain, Conditionality Loop, Deliberative Sequence, Competitive Allocation, Sequential Adjudication, Simple Certification, Surge Protocol
- [ ] Module scaffolding: grouped CP blocks from pattern templates
- [ ] Wire Copilot tab to governance endpoint when CP blocks present
- [ ] Pattern template quick-access buttons in the Protocol tab
- [ ] Copilot explains validation issues and suggests fixes
- [ ] Smoke test: “Build a simple certification protocol” → copilot scaffolds ATTEST → CLOSE
- [ ] Demo run: encode a Permissioning Chain from scratch using only the copilot

**🏁 Demo milestone:** “I said ‘build me a conditionality loop for cash transfers’ and it scaffolded the protocol”

---

## 13. File Map: What Exists vs. What's New

### Existing Files — Modified

| File | Change |
|---|---|
| `apps/sim/blocks/types.ts` | Add `'governance'` to `IntegrationTag` |
| `apps/sim/blocks/registry.ts` | Import and register 8 governance blocks |
| `apps/sim/executor/handlers/registry.ts` | Register `GovernanceCPBlockHandler` before `GenericBlockHandler` |
| `apps/sim/app/.../workflow-block/workflow-block.tsx` | Add CP badge, ring border, validation indicators |
| `apps/sim/app/.../workflow-edge/workflow-edge.tsx` | Add gate handle edge labels |
| `apps/sim/app/.../panel/panel.tsx` | Add `Protocol` tab |
| `apps/sim/app/.../block-menu/block-menu.tsx` | Add "View Receipt" and "Run Preflight" items for CP blocks |
| `apps/sim/app/.../components/panel/components/copilot/` | Route to governance copilot endpoint when CP blocks present |

### New Files — Created

```
apps/sim/
├── blocks/blocks/governance/
│   ├── index.ts
│   ├── utils.ts              ← isCPBlock, CP_IGSL_TYPE_MAP, CP_TYPES
│   ├── decide.ts
│   ├── attest.ts
│   ├── appeal.ts
│   ├── close.ts
│   ├── remedy.ts
│   ├── delegate.ts
│   ├── override.ts
│   └── evolve.ts
│
├── components/icons/governance/
│   ├── index.ts
│   ├── decide.tsx
│   ├── attest.tsx
│   ├── appeal.tsx
│   ├── close.tsx
│   ├── remedy.tsx
│   ├── delegate.tsx
│   ├── override.tsx
│   └── evolve.tsx
│
├── executor/handlers/governance/
│   ├── governance-cp-handler.ts    ← the block handler
│   ├── precepto-client.ts          ← HTTP client
│   └── types.ts                    ← CommitmentSubmission, CommitmentResponse, etc.
│
├── lib/workflows/governance/
│   ├── index.ts
│   ├── validate-protocol.ts        ← main validator
│   ├── validation-rules.ts         ← individual rule functions
│   ├── igsl-exporter.ts            ← protocol layer → IGSL JSON
│   ├── igsl-digest.ts              ← pre-loaded IGSL v1.2 digest (server constant)
│   ├── reference.ts                ← pre-loaded reference manual (server constant)
│   ├── igsl-types.ts               ← ValidationIssue, ProtocolVersion, etc.
│   └── patterns/
│       ├── index.ts
│       ├── permissioning-chain.ts
│       ├── conditionality-loop.ts
│       ├── deliberative-sequence.ts
│       ├── competitive-allocation.ts
│       ├── sequential-adjudication.ts
│       ├── simple-certification.ts
│       └── surge-protocol.ts
│
├── app/workspace/[workspaceId]/w/[workflowId]/
│   ├── hooks/
│   │   ├── use-governance-validation.ts
│   │   ├── use-governance-blocks.ts
│   │   └── use-gate-status.ts
│   └── components/panel/components/
│       └── protocol/
│           ├── protocol-tab.tsx    ← validation panel + export button
│           └── issue-list.tsx      ← individual issue items
│
└── app/api/governance-copilot/
    └── route.ts                    ← governance copilot API endpoint
```

### Not Modified

Everything else in Sim stays unchanged. The execution engine, DAG builder, edge manager, loop/parallel orchestrators, undo/redo, real-time collaboration, auth, workspace management — all untouched. CP blocks are just another block type from the engine's perspective.

---

## 14. Open Questions

These are decisions that need to be made before or during implementation. They don't block Phase 1 but need resolution by Phase 2.

### Q1: How does a CP block know its Precepto `commitment_point_id`?

**Current approach:** `cp_id` sub-block — operator manually enters the Precepto CP ID.

**Options:**
- A. Manual entry (MVP — simplest)
- B. `protocol-cp-selector` sub-block type — dropdown that fetches Precepto protocols/CPs via API
- C. Copilot auto-populates when scaffolding from a Precepto protocol

**Recommendation:** Start with A for Phase 1-2. Add B or C in Phase 4.

---

### Q2: What happens when a CP block fires but there's no `cp_id` set?

**Options:**
- A. Execution fails with a clear error: "This governance block is not linked to a Precepto CP"
- B. Execution skips the Precepto call and produces a synthetic "unlinked" receipt (development mode only)
- C. A validation error prevents execution (BLOCK-severity validation issue for missing `cp_id`)

**Recommendation:** C — add `cp_id` to the validation rules as a BLOCK-severity issue. Prevents silent failures.

---

### Q3: Does the governance copilot have access to the user's Precepto instance?

If yes, the copilot could read existing protocols from Precepto and scaffold based on them. If no, it's purely grammar-aware (knows IGSL structure) but not instance-aware (doesn't know your actual CPs).

**Recommendation for MVP:** No — copilot is grammar-aware only. The `cp_id` linking is done manually by the engineer. Instance-awareness is Phase 4+.

---

### Q4: How are governance workflows discovered in the Sim UI?

**Options:**
- A. Any workflow can contain CP blocks — no special discovery
- B. A "Governance Protocols" section in the sidebar showing workflows that contain CP blocks
- C. A separate workflow type (`type: 'governance'`) with its own route

**Recommendation:** A for Phase 1-2. Add B (sidebar governance section) in Phase 4 as part of the broader governance navigation from `sim-platform-architecture-v2.md`.

---

### Q5: Multi-institution: which Precepto institution does a CP block submit to?

For the current MVP (one workspace = one institution), this is resolved by the `PRECEPTO_API_KEY` env var, which is scoped to one institution. Multi-institution is deferred to after the demo.

When multi-institution support is added, the API key will need to be resolved per workspace via Sim's `workspaceBYOKKeys` table — the handler reads the key from workspace environment variables rather than global env.

---

### Q6: GovernedContext lifecycle — when is a context created, archived, reopened?

**Current approach for MVP:** Created implicitly on first CP block execution in a workflow run (see §6.0). Never explicitly archived. Precepto manages context lifecycle independently.

**Open decisions:**
- Should a context be explicitly closed (archived) when a CLOSE CP block commits? Or is archival always Precepto-side?
- Can a case be reopened (e.g., after a successful APPEAL)? What does “reopening” mean at the `GovernedContext` level — a new context, or a state transition on the existing one?
- Should `context_id` be surfaced in Sim’s execution history UI so operators can trace a case across multiple workflow executions?

**Recommendation for MVP:** Created on first CP execution, never archived from Sim’s side. Revisit archival and reopen semantics after the demo when real case management patterns emerge.

---

*Last updated: April 2026. This document is the build spec; cut Linear issues from it.*
