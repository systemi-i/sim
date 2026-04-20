# Phase A Brief — Compose (Weeks 1–3)

**Date:** 2026-04-20  
**Status:** AUTHORITATIVE — cut Linear issues from this document.  
**Scope:** Week-by-week specification for Phase A of the merged roadmap.  
**Outcome:** Governance CP blocks on Sim's canvas. Real-time IGSL validation. IGSL JSON export. `GovernanceCPBlockHandler` stub wired. Sim fork deployed and rebranded.

**Source documents read:**
- `precepto/docs/roadmap-merged.md` — high-level 12-week plan
- `sim/docs/governance-protocol-mode.md` — Plan B design spec
- `sim/docs/governance-mode-architect-review.md` — architect review (7/10, 5 P1 fixes)
- `sim/docs/governance-implementation-analysis.md` — Sim codebase analysis
- `precepto/docs/reusable-for-sim.md` — Precepto reusable components

---

## Implementation Findings (Reference Throughout)

These findings from the Sim codebase analysis are referenced throughout the week specs. Read this section before starting.

| Finding | What it means |
|---|---|
| `table` sub-block supports multi-column ✅ | `columns: ['Field Name', 'Type', 'Required']` works as-is. Value stored as `string[][]`. No new sub-block type needed for gate config tables. |
| Conditional sub-blocks via `condition` field ✅ | `condition: { field: 'authority_model', value: 'JOINT' }` is fully supported. Use for all gate sections. Reduces visual noise. |
| Use `category: 'blocks'` with `tags: ['governance']` ✅ | Do NOT add a new `BlockCategory`. Use `category: 'blocks'` + extend `IntegrationTag` with `'governance'`. Toolbar renders all `category: 'blocks'` entries; no toolbar code changes needed. |
| `cp_id` as dedicated sub-block field ✅ | Do NOT use Sim's internal block UUID as the Precepto CP ID. Add a dedicated `cp_id` sub-block (`type: 'short-input'`). This field is not remapped on copy/paste. Add `CP_ID_DUPLICATE` validation rule (BLOCK severity). |
| `canHandle()` checks `block.type`, not `block.metadata?.id` | The governance spec had a bug here. `block.type` is the registry key (`'governance_decide'`). `block.metadata?.id` is the instance UUID. Use `isCPBlock(block.type)` in `canHandle()`. |
| Multiple named input handles: medium effort | ~100–200 LOC change to `workflow-block.tsx`. Conditioned on `isCPBlock()`. Register additional `<Handle type='target' id='evidence_in' .../>` per handle type. Update `EdgeConstructor` to wire named inputs into `DAGNode.incomingEdges`. |
| Protocol Header block as singleton ✅ | `singleInstance: true` on `BlockConfig`. Zero DB changes. Block outputs `protocolName`, `jurisdiction`, `version`, `lifecycle` via standard resolver syntax `<Protocol.jurisdiction>`. |
| Gate evaluators are pure functions (REASONING, RECOURSE, VERSION) | Copy these 3 gate files into Sim for client-side validation preview. AUTHORITY, EVIDENCE, DEPENDENCY need mock deps for preview (real evaluation is server-side via Precepto API). |
| Precepto has no named IGSL validation codes yet | Sim's `validation-rules.ts` will be the **first** implementation of named IGSL validation codes. The codes in the spec (`DEPENDENCY_APPEALS_INVALID_TARGET`, etc.) are from the IGSL v1.2 digest. Implement them faithfully. |
| Edge relationship persistence: use handle-encoding for Phase A | Add `metadata jsonb` to `workflowEdges` table in Phase B. For Phase A, encode relationship type in `sourceHandle` string: `source-depends_on`, `source-appeals`. Zero DB migration required. |
| `EVOLVE` block: `hideFromToolbar: true` | EVOLVE is IGSL-noncompliant as designed (architect review Issue 1). Include block definition for completeness but hide from toolbar. Specify in comments why. Revisit post-demo. |

---

## Week 1: Foundation + Governance Blocks on Canvas

**Theme:** MCP spike + 8 CP block definitions + visual identity + Protocol Header + `ExecutorAdapter`.

---

### W1.1 — MCP Spike (Day 1, 0.5–1 day)

**Goal:** Prove Precepto works as a governance API over MCP before anything else.

**Steps:**
1. Register Precepto's `/mcp` as an MCP server in a Sim workspace.
2. Run the DRY_RUN roundtrip: `precepto_get_briefing → precepto_preflight → precepto_submit_commitment`.
3. If this fails, stop Phase A and investigate.

**Files to modify:**
- Sim workspace MCP config (wherever MCP servers are registered — check `lib/mcp/` or workspace settings)

**Success:** `precepto_submit_commitment` returns a DRY_RUN receipt object (not `SUBMIT_VIA_REST`).

---

### W1.2 — Fix `precepto_submit_commitment` (Day 1, 0.5 day)

**Goal:** The MCP tool actually submits; it does not return a stub string.

**File:** `precepto/apps/api/src/mcp/tools/submit_commitment.ts` (or equivalent)

**Change:** Wire the handler to call `submitCommitment()` in `services/commitment.ts` instead of returning `SUBMIT_VIA_REST`.

**Success:** MCP tool call returns a proper receipt with `content_hash`, `gate_results`, `outcome`.

---

### W1.3 — `ExecutorAdapter` Interface + `AnthropicDirectAdapter` (Days 2–4, 2.5 days)

**Goal:** Wrap `invokeAgentForCP()` in a typed adapter interface so Phase B can swap `anthropic-direct` for `sim-workflow` via config.

**Files to create/modify:**

```
packages/types/src/executor-adapter.ts   ← new: ExecutorAdapter interface
apps/api/src/execution/
  anthropic-direct-adapter.ts            ← new: AnthropicDirectAdapter implements ExecutorAdapter
  executor-factory.ts                    ← new or modify: builds adapter from agent_configs.executor_type
```

**Interface:**

```typescript
// packages/types/src/executor-adapter.ts

export interface ExecutorAdapter {
  execute(params: CPExecutionParams): Promise<CPExecutionResult>
}

export interface CPExecutionParams {
  cpId: string
  caseId: string
  workflowRunId?: string
  agentConfig: AgentConfig
}

export interface CPExecutionResult {
  status: 'completed' | 'failed' | 'pending'
  proposedOutcome?: string
  evidenceCollected?: Record<string, unknown>
  error?: string
}
```

**`agent_configs` table migration:**

```sql
-- precepto: migration file
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS executor_type TEXT NOT NULL DEFAULT 'anthropic-direct';

-- Seed existing CPs
UPDATE agent_configs SET executor_type = 'anthropic-direct' WHERE executor_type IS NULL;
```

**Success:** `AnthropicDirectAdapter` runs existing `invokeAgentForCP()` flow unchanged; execution tests pass.

---

### W1.4 — 8 CP Block Definitions (Days 2–5)

**Goal:** All 8 CP block types defined and registered in Sim's block registry.

#### File structure to create

```
apps/sim/blocks/blocks/governance/
├── index.ts              ← barrel export for all 8 blocks
├── utils.ts              ← isCPBlock(), CP_IGSL_TYPE_MAP, CP_TYPES
├── decide.ts             ← reference implementation
├── attest.ts
├── appeal.ts
├── close.ts
├── remedy.ts
├── delegate.ts
├── override.ts
└── evolve.ts             ← hidden from toolbar
```

#### `utils.ts` (create this first)

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
  governance_decide:   'DECIDE',
  governance_attest:   'ATTEST',
  governance_appeal:   'APPEAL',
  governance_close:    'CLOSE',
  governance_remedy:   'REMEDY',
  governance_delegate: 'DELEGATE',
  governance_override: 'OVERRIDE',
  governance_evolve:   'EVOLVE',
}
```

#### Registry changes

**File to modify:** `apps/sim/blocks/types.ts`

```typescript
// Add 'governance' to IntegrationTag union:
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

**File to modify:** `apps/sim/blocks/registry.ts`

```typescript
// Add imports:
import {
  DecideBlock, AttestBlock, AppealBlock, CloseBlock,
  RemedyBlock, DelegateBlock, OverrideBlock, EvolveBlock,
} from './blocks/governance'

// Add to registry object:
governance_decide:   DecideBlock,
governance_attest:   AttestBlock,
governance_appeal:   AppealBlock,
governance_close:    CloseBlock,
governance_remedy:   RemedyBlock,
governance_delegate: DelegateBlock,
governance_override: OverrideBlock,
governance_evolve:   EvolveBlock,
```

#### Block config pattern (use for all 8 types)

Every CP block config MUST include:

```typescript
// Shared fields on every CP block:
{
  type: 'governance_<type>',           // e.g. 'governance_decide'
  name: '<Type>',                      // e.g. 'Decide'
  category: 'blocks',                  // NOT 'governance' — use tags instead
  integrationType: 'governance',       // causes auto-grouping in toolbar
  bgColor: '<type-specific hex>',      // see color table below
  icon: <TypeIcon>,                    // from components/icons/governance/
  hideFromToolbar: false,              // true for EVOLVE only
  
  // Sub-blocks common to ALL CP types (add to every block's subBlocks array):
  // 1. cp_id          — Precepto CP ID (short-input, required, visible)
  // 2. cp_name        — human name (short-input, required)
  // 3. cp_description — (long-input, optional)
  // 4. proposed_outcome — outcome token being proposed (short-input, required)
  //                       supports {{<upstream.output>}} interpolation
  // 5. actor_identity_config — (short-input, conditional on automation_level: AUTOMATED)
  // 6. automation_level — dropdown (MANUAL/AI_ASSISTED/AI_OVERSIGHT/AUTOMATED)
  // 7. produces       — table (Output Type, Available To)
  // 8. version_config — (switch: require version pinning)
}
```

**Color table:**

| Block | Key | bgColor |
|---|---|---|
| DECIDE | `governance_decide` | `#3B82F6` (blue-500) |
| ATTEST | `governance_attest` | `#6366F1` (indigo-500) |
| APPEAL | `governance_appeal` | `#8B5CF6` (violet-500) |
| CLOSE | `governance_close` | `#64748B` (slate-500) |
| REMEDY | `governance_remedy` | `#F59E0B` (amber-500) |
| DELEGATE | `governance_delegate` | `#10B981` (emerald-500) |
| OVERRIDE | `governance_override` | `#EF4444` (red-500) |
| EVOLVE | `governance_evolve` | `#EC4899` (pink-500), hidden |

#### Type-specific sub-blocks (what each block adds beyond the shared set)

| Block | Authority | Evidence | Key differences |
|---|---|---|---|
| **DECIDE** | `authority_model` dropdown + `authority_roles` table + `authority_quorum` + `authority_delegation_scope` | `evidence_requirements` table (required) | `allowed_outcomes` table; `recourse_paths` table; `deadline_enabled/duration/auto_resolve/temporal_direction`; `reasoning_required/privilege` |
| **ATTEST** | Same as DECIDE | Same | No `allowed_outcomes` (produces ATTESTATION); `attestation_level` dropdown (ASSERTED/VERIFIED/ANCHORED); `attestation_scope` short-input |
| **APPEAL** | Same as DECIDE | Same | `appeals_cp_id` short-input (ID of CP being appealed, required for validation); inherit DECIDE structure otherwise |
| **CLOSE** | Minimal | None | `close_reason` dropdown (COMPLETED/WITHDRAWN/EXPIRED/ADMINISTRATIVE); `allowed_outcomes` table (COMPLETED/WITHDRAWN/EXPIRED/ADMINISTRATIVE); no recourse paths |
| **REMEDY** | Same as DECIDE | Same | `remedy_type` dropdown (CORRECTION/COMPENSATION/REVERSAL); `remedied_cp_id` short-input; `remedy_actions` table |
| **DELEGATE** | `delegatee_roles` table; `delegation_scope` short-input; `delegation_depth_limit` number | None required | Produces DECISION (delegation is a binding act) |
| **OVERRIDE** | `override_authority` (must be stronger than original) | None required | `overrides_cp_id` short-input; `override_justification` long-input (required) |
| **EVOLVE** | Same as DECIDE | None required | `proposed_changes` long-input; `version_bump` dropdown (MAJOR/MINOR/PATCH); `hideFromToolbar: true`; comment explaining why hidden |

#### Block inputs/outputs (all CP types)

```typescript
// Every CP block declares these inputs and outputs:
inputs: {
  evidence_in: {
    type: 'json',
    description: 'Evidence object from upstream automation blocks. Keys must match evidence_requirements field names.',
  },
  authority_in: {
    type: 'json',
    description: 'GovernanceActorIdentity from upstream HITL or identity blocks.',
  },
  activation: {
    type: 'json',
    description: 'Receipt from upstream CP blocks (dependency satisfaction).',
  },
},
outputs: {
  receipt:        { type: 'json',   description: 'Full Precepto enforcement receipt.' },
  outcome_token:  { type: 'string', description: 'The committed outcome token.' },
  blocked_gates:  { type: 'json',   description: 'Array of gate types that blocked, if any.' },
  receipt_hash:   { type: 'string', description: 'SHA-256 content hash of the receipt.' },
},
tools: {
  access: [],   // CP blocks do NOT use the GenericBlockHandler tool path
},
```

**Files to modify:** `decide.ts` is the reference implementation (see governance-protocol-mode.md §3.3 for the full example). Replicate the pattern for the other 7 types, applying the type-specific differences above.

---

### W1.5 — CP Icons (8 SVGs) (Day 4, 0.5 day)

**Goal:** 8 SVG icon components for the governance block types.

**Files to create:**

```
apps/sim/components/icons/governance/
├── index.ts         ← barrel export
├── decide.tsx       ← Gavel
├── attest.tsx       ← Certificate with seal
├── appeal.tsx       ← Scale with arrow
├── close.tsx        ← Lock / archive box
├── remedy.tsx       ← Wrench
├── delegate.tsx     ← Person-to-person arrow
├── override.tsx     ← Lightning bolt
└── evolve.tsx       ← Gear with refresh arrow
```

**Pattern:** Each icon is a React component accepting `SVGProps<SVGSVGElement>`. Use semantic SVG paths — exact paths can be polished in Phase D. For Week 1, stub with appropriate Lucide icon paths or simple geometric placeholders that are semantically correct. Do not block smoke tests on icon polish.

```typescript
// Example pattern:
export const DecideIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {/* Gavel — binding authority */}
    <path d="M14 2L16 8H22L17 12L19 18L14 14L9 18L11 12L6 8H12L14 2Z" />
  </svg>
)
```

---

### W1.6 — Protocol Header Block (Day 5, 0.5 day)

**Goal:** A singleton block for protocol-level settings that anchors the workflow's governance identity.

**File to create:** `apps/sim/blocks/blocks/governance/protocol-header.ts`

```typescript
export const GovernanceProtocolHeaderBlock: BlockConfig = {
  type: 'governance_protocol_header',
  name: 'Protocol',
  description: 'Governance protocol metadata. One per workflow.',
  category: 'blocks',
  integrationType: 'governance',
  bgColor: '#1e40af',          // dark blue — authority
  icon: ProtocolHeaderIcon,
  singleInstance: true,         // only one allowed per workflow
  subBlocks: [
    { id: 'protocolName', type: 'short-input', title: 'Protocol Name', required: true,
      placeholder: 'e.g. Carta de Agua — Water Permit' },
    { id: 'jurisdiction', type: 'short-input', title: 'Jurisdiction',
      placeholder: 'e.g. CR (Costa Rica)' },
    { id: 'version', type: 'short-input', title: 'Version', defaultValue: '0.1.0',
      placeholder: 'Semver: 0.1.0' },
    { id: 'lifecycle', type: 'dropdown', title: 'Lifecycle Type',
      options: [
        { label: 'Discrete (single-pass, CLOSE terminates)', id: 'DISCRETE' },
        { label: 'Recurring (repeats on schedule)', id: 'RECURRING' },
        { label: 'Perpetual (open-ended)', id: 'PERPETUAL' },
      ],
      defaultValue: 'DISCRETE' },
    { id: 'institutionId', type: 'short-input', title: 'Institution ID',
      placeholder: 'Precepto institution UUID', required: true },
    { id: 'description', type: 'long-input', title: 'Protocol Description' },
  ],
  tools: { access: [] },
  inputs: {},
  outputs: {
    protocolName:  'string',
    jurisdiction:  'string',
    version:       'string',
    lifecycle:     'string',
    institutionId: 'string',
  },
}
```

**File to modify:** `apps/sim/blocks/registry.ts` — add `governance_protocol_header: GovernanceProtocolHeaderBlock`.

**Downstream use:** CP blocks can reference `<Protocol.jurisdiction>`, `<Protocol.institutionId>` etc. via the standard resolver. The IGSL exporter reads these from the Protocol Header block's sub-block values.

---

### Week 1 Smoke Tests

- [ ] Governance CP blocks appear in Sim toolbar under "Governance" section (auto-grouped via `integrationType: 'governance'`)
- [ ] Panel editor opens and shows correct sub-blocks for each CP type
- [ ] DECIDE block panel shows authority, evidence, recourse, temporal, and outcome sections
- [ ] Protocol Header block appears in toolbar; only one can be added per workflow
- [ ] `isCPBlock('governance_decide')` returns `true`; `isCPBlock('api')` returns `false`

---

## Week 2: Visual Treatment + Gate Configuration + Named Handles

**Theme:** Visual identity on the canvas. Full gate sub-block set. Named input handles. Rebrand.

---

### W2.1 — Rebrand Sim Shell (Days 1–2, 2 days)

**Goal:** The product looks like ours from Day 1. Essential for investor demo.

**Files to modify:**
- Sim's whitelabel config (wherever logo/name/colours are set — check `apps/sim/lib/config/` or `apps/sim/app/layout.tsx`)
- Sidebar navigation: strip Workflows/Marketplace/Models/Integrations/API Playground
- Sidebar navigation: add Protocols, Cases, Inbox, Agents, Audit (empty routes for now; filled in Phase B)

**Sim has whitelabel infrastructure — use it.** Do not rebuild the sidebar from scratch.

---

### W2.2 — Visual Treatment in `workflow-block.tsx` (Day 2, 0.5 day)

**Goal:** CP blocks are visually distinct on the canvas at a glance.

**File to modify:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/workflow-block.tsx`

**Changes:**

```typescript
// 1. Import isCPBlock:
import { isCPBlock } from '@/blocks/blocks/governance/utils'

// 2. CP badge in block header (add alongside block name/icon):
{isCPBlock(data.type) && (
  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded
                   bg-white/20 text-white tracking-wider">
    CP
  </span>
)}

// 3. Distinctive border on CP block container (add to outer container className):
isCPBlock(data.type) && 'ring-2 ring-blue-400/60 ring-offset-1'
```

Note: The blue ring is the default CP treatment. The IGSL validation layer (Week 3) will override this with red or yellow rings when issues are present.

---

### W2.3 — Gate Configuration Sub-Blocks (Days 2–4, 3 days)

**Goal:** Every CP block's panel shows the full gate configuration UI, using conditional sub-blocks to reduce noise.

**Implementation finding:** Use `condition` field on `SubBlockConfig` for conditional visibility. Use `table` sub-block for multi-column gate config tables. No new sub-block types needed.

#### Sub-blocks to add to each CP type:

**AUTHORITY gate (all decision-type CPs: DECIDE, APPEAL, DELEGATE, OVERRIDE, REMEDY):**

```typescript
// Already in W1.4 spec; verify these exist with conditions:
{ id: 'authority_model', type: 'dropdown', required: true,
  options: ['SINGLE','ALTERNATIVE','JOINT','DELEGATED','ATTRIBUTE_DETERMINED'] }
{ id: 'authority_roles', type: 'table', columns: ['Role Name'],
  condition: { field: 'authority_model', value: ['SINGLE','ALTERNATIVE','JOINT'] } }
{ id: 'authority_quorum', type: 'short-input',
  condition: { field: 'authority_model', value: 'JOINT' } }
{ id: 'authority_delegation_scope', type: 'short-input',
  condition: { field: 'authority_model', value: 'DELEGATED' } }
```

**EVIDENCE gate (DECIDE, ATTEST, APPEAL):**

```typescript
{ id: 'evidence_requirements', type: 'table',
  columns: ['Field Name', 'Type', 'Required', 'Attestation Level'],
  required: true }
```

**REASONING gate (all CPs, optional):**

```typescript
{ id: 'reasoning_required', type: 'switch', defaultValue: false }
{ id: 'reasoning_privilege', type: 'dropdown',
  options: ['NONE','WORK_PRODUCT','ATTORNEY_CLIENT'],
  condition: { field: 'reasoning_required', value: true } }
{ id: 'reasoning_allowed_privileges', type: 'table',
  columns: ['Privilege Level'],
  condition: { field: 'reasoning_required', value: true },
  tooltip: 'IGSL requires an array of allowed privileges.' }
```

**DEPENDENCY gate (all CPs — expressed via canvas edges, but also configurable):**

```typescript
{ id: 'dependency_required_outcomes', type: 'table',
  columns: ['Prior CP ID', 'Required Outcome'],
  tooltip: 'Which outcomes of upstream CPs must have occurred for this gate to pass. Populated automatically when activation edges are drawn.' }
```

**RECOURSE gate (DECIDE, ATTEST — required for adverse outcomes):**

```typescript
{ id: 'recourse_paths', type: 'table',
  columns: ['For Outcomes', 'Via CP ID', 'Window (ISO 8601)', 'Remedial Powers'] }
```

**VERSION gate (all CPs):**

```typescript
{ id: 'version_pin_required', type: 'switch', defaultValue: false,
  tooltip: 'Require actor to declare specific AI model version used.' }
{ id: 'version_allowed_models', type: 'table',
  columns: ['Model ID', 'Version Range'],
  condition: { field: 'version_pin_required', value: true } }
```

**TEMPORAL conditions (DECIDE, ATTEST):**

```typescript
{ id: 'deadline_enabled', type: 'switch', defaultValue: false }
{ id: 'deadline_duration', type: 'short-input', placeholder: 'ISO 8601, e.g. P30D',
  condition: { field: 'deadline_enabled', value: true } }
{ id: 'auto_resolve', type: 'dropdown',
  options: ['false','AUTO_APPROVE','DEEMED_REFUSAL','AUTO_CLOSE'],
  condition: { field: 'deadline_enabled', value: true } }
{ id: 'temporal_direction', type: 'dropdown',
  options: ['INSTITUTIONAL','CITIZEN'],
  condition: { field: 'auto_resolve', value: ['AUTO_APPROVE','DEEMED_REFUSAL','AUTO_CLOSE'] } }
```

**v1.2 features (all CPs):**

```typescript
{ id: 'produces', type: 'table',
  columns: ['Output Type', 'Available To (CP IDs)'],
  tooltip: 'IGSL v1.2: declare what structural output this CP makes available downstream.' }
{ id: 'lifecycle_type', type: 'dropdown',
  options: ['DISCRETE','RECURRING','PERPETUAL'],
  defaultValue: 'DISCRETE',
  tooltip: 'Inherited from Protocol Header by default.' }
```

---

### W2.4 — Multiple Named Input Handles (Days 4–5, ~100–200 LOC)

**Goal:** CP blocks expose `evidence-in`, `authority-in`, and `activation` as distinct connection points on the left side of the block. Automation blocks can wire to specific gates.

**File to modify:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/workflow-block.tsx`

**Pattern:** Same as condition/router dynamic source handles but for target handles.

```typescript
// In workflow-block.tsx — conditional named target handles for CP blocks:
{isCPBlock(data.type) && (
  <>
    <Handle
      type="target"
      id="evidence_in"
      position={Position.Left}
      style={{ top: '30%' }}
      className="governance-handle-evidence"
    />
    <Handle
      type="target"
      id="authority_in"
      position={Position.Left}
      style={{ top: '50%' }}
      className="governance-handle-authority"
    />
    <Handle
      type="target"
      id="activation"
      position={Position.Left}
      style={{ top: '70%' }}
      className="governance-handle-activation"
    />
  </>
)}
// Keep the default 'target' handle for non-CP block connections
```

**File to modify:** `apps/sim/executor/dag/construction/edges.ts` (or equivalent)

Add passthrough case so that `evidence_in`, `authority_in`, and `activation` target handles are wired into `DAGNode.incomingEdges` and the resolver can provide named inputs to the CP block handler.

**File to modify:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-edge/workflow-edge.tsx`

```typescript
// Gate handle edge labels — add to WorkflowEdge render:
const GATE_HANDLE_LABELS: Record<string, string> = {
  'evidence_in':  'evidence',
  'authority_in': 'authority',
  'activation':   'depends on',
}

// When an edge targets one of these handles, render a label:
{GATE_HANDLE_LABELS[data.targetHandle] && (
  <EdgeLabelRenderer>
    <div className="text-[9px] text-muted-foreground bg-background/80 px-1 rounded pointer-events-none">
      {GATE_HANDLE_LABELS[data.targetHandle]}
    </div>
  </EdgeLabelRenderer>
)}
```

**Edge relationship encoding for Phase A (zero DB migration):**  
Encode relationship type in `sourceHandle` string: `source-depends_on`, `source-appeals`. Extend `WorkflowEdge` renderer to read `sourceHandle` prefix and apply visual style:

```typescript
// In WorkflowEdge:
const isAppealsEdge = edge.sourceHandle?.startsWith('source-appeals')
const isDependsOnEdge = edge.sourceHandle?.startsWith('source-depends_on')

if (isAppealsEdge) {
  color = '#8B5CF6'         // violet — appeals relationship
  strokeDasharray = '6,3'
}
if (isDependsOnEdge) {
  color = '#3B82F6'         // blue — dependency
}
```

DB migration for `metadata jsonb` on `workflow_edges` table is a Phase B item.

---

### Week 2 Smoke Tests

- [ ] Sim shell shows our product name, logo, colours
- [ ] Governance sidebar shows: Protocols, Cases, Inbox, Agents, Audit (empty for now)
- [ ] CP badge appears in block header (white "CP" pill)
- [ ] `ring-2 ring-blue-400/60` visible on CP blocks; automation blocks unchanged
- [ ] DECIDE block panel: can configure authority model → JOINT → quorum field appears
- [ ] DECIDE block panel: evidence requirements table accepts 3-row add/remove
- [ ] Evidence-in, authority-in, and activation handles visible on left side of DECIDE block
- [ ] Drawing an edge from an API block to evidence-in shows "evidence" label on the edge
- [ ] Drawing a CP receipt output to another CP's activation shows "depends on" label

---

## Week 3: Validation + Export + Stubs

**Theme:** IGSL validation engine. IGSL JSON export. `GovernanceCPBlockHandler` and `PreceptoClient` stubs. Identity bridge. Acid test.

---

### W3.1 — IGSL Validation Engine (Days 1–2, 2 days)

**Goal:** Real-time structural validation on the canvas. 13+ IGSL codes. Red/yellow rings on CP blocks.

**Files to create:**

```
apps/sim/lib/workflows/governance/
├── index.ts
├── validate-protocol.ts      ← main validator entry point
├── validation-rules.ts       ← individual rule functions
└── igsl-types.ts             ← ValidationIssue, ValidationSeverity types
```

**Key reference:** Precepto has no named IGSL validation codes yet. Sim's implementation is the first. Use codes from the IGSL v1.2 digest faithfully.

#### `igsl-types.ts`

```typescript
export type ValidationSeverity = 'BLOCK' | 'WARN' | 'INFO'

export interface ValidationIssue {
  code: string                    // IGSL validation code, e.g. 'DEPENDENCY_APPEALS_INVALID_TARGET'
  severity: ValidationSeverity
  message: string                 // human-readable explanation
  blockId?: string                // which CP block the issue is on
  path?: string                   // sub-path within block config, e.g. 'evidence_requirements'
}
```

#### `validate-protocol.ts`

```typescript
// Main validator — called from useGovernanceValidation() hook
export function validateProtocol(
  blocks: Record<string, BlockState>,
  edges: Edge[]
): ValidationIssue[] {
  const cpBlocks = Object.values(blocks).filter(b => isCPBlock(b.type))
  const cpEdges = edges.filter(e =>
    isCPBlock(blocks[e.source]?.type) && isCPBlock(blocks[e.target]?.type)
  )

  return [
    // BLOCK severity (export disabled, red ring):
    ...rules.checkAppealTargets(cpBlocks, blocks),
    ...rules.checkEvidenceRequired(cpBlocks),
    ...rules.checkAutoResolveOutcome(cpBlocks),
    ...rules.checkEntryPoint(cpBlocks, cpEdges),
    ...rules.checkCircularDependencies(cpBlocks, cpEdges),
    ...rules.checkDuplicateCpIds(cpBlocks),
    ...rules.checkMissingCpId(cpBlocks),

    // WARN severity (yellow ring):
    ...rules.checkAppealRelationship(cpBlocks),
    ...rules.checkMultiTierAppeals(cpBlocks, cpEdges),
    ...rules.checkOverrideTarget(cpBlocks, cpEdges),
    ...rules.checkIsolatedCPs(cpBlocks, cpEdges),
    ...rules.checkDeemedRefusalAppealPath(cpBlocks, cpEdges),
    ...rules.checkAutomatedAccountability(cpBlocks),
    ...rules.checkDiscreteNoClose(cpBlocks),
    ...rules.checkAutoApproveWithCitizenDirection(cpBlocks),
    ...rules.checkMissingTerminalPoint(cpBlocks, cpEdges),
  ]
}
```

#### Validation rules (implement in `validation-rules.ts`)

| IGSL Code | Severity | Rule implementation |
|---|---|---|
| `DEPENDENCY_APPEALS_INVALID_TARGET` | BLOCK | APPEAL block's `appeals_cp_id` references a CLOSE or EVOLVE block — invalid target |
| `GATE_EVIDENCE_REQUIREMENTS_EMPTY` | BLOCK | DECIDE/ATTEST/APPEAL block has empty `evidence_requirements` table |
| `TEMPORAL_AUTO_RESOLVE_MISSING_OUTCOME` | BLOCK | `auto_resolve` is set but `allowed_outcomes` has no matching auto-resolve outcome token |
| `TOPOLOGY_MISSING_ENTRY_POINT` | BLOCK | No CP block is reachable from the workflow start node |
| `REFERENCE_CIRCULAR_DEPENDENCY` | BLOCK | CP dependency graph has a cycle (topological sort + cycle detection) |
| `CP_ID_DUPLICATE` | BLOCK | Two CP blocks have the same `cp_id` value |
| `CP_ID_MISSING` | BLOCK | CP block has empty `cp_id` field — will fail at execution time |
| `DEPENDENCY_APPEAL_MISSING_RELATIONSHIP` | WARN | APPEAL block has no `appeals_cp_id` set |
| `DEPENDENCY_MULTITIER_APPEALS` | WARN | APPEAL → APPEAL chain depth > 3 |
| `OVERRIDE_MISSING_TARGET` | WARN | OVERRIDE block has no dependency edge to a DECIDE or ATTEST block |
| `TOPOLOGY_ISOLATED_COMMITMENT_POINT` | WARN | CP block has no edges to/from other CP blocks |
| `TEMPORAL_DEEMED_REFUSAL_NO_APPEAL_PATH` | WARN | DECIDE with `DEEMED_REFUSAL` auto-resolve has no downstream APPEAL CP |
| `AUTHORITY_AUTOMATED_NO_ACCOUNTABILITY` | WARN | AUTOMATED CP has no `accountability_actor` field set |
| `LIFECYCLE_DISCRETE_NO_CLOSE` | WARN | DISCRETE protocol (from Protocol Header) has no CLOSE block |
| `TEMPORAL_AUTO_APPROVE_CITIZEN_DIRECTION` | WARN | AUTO_APPROVE combined with `temporal_direction: CITIZEN` — should be INSTITUTIONAL |
| `TOPOLOGY_MISSING_TERMINAL_POINT` | WARN | No terminal CP (CLOSE or functionally terminal OVERRIDE/REMEDY at end of chain) |

#### Validation hook

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

#### On-canvas validation display

**File to modify:** `workflow-block.tsx`

```typescript
// Read validation results from hook (call at workflow canvas level, pass down via context):
const validationIssues = useGovernanceValidation()
const blockIssues = isCPBlock(data.type)
  ? validationIssues.filter(i => i.blockId === id)
  : []
const hasBlockError = blockIssues.some(i => i.severity === 'BLOCK')
const hasBlockWarn  = blockIssues.some(i => i.severity === 'WARN')

// Override the default CP ring with validation color:
isCPBlock(data.type) && hasBlockError && 'ring-2 ring-red-500',
isCPBlock(data.type) && hasBlockWarn && !hasBlockError && 'ring-2 ring-yellow-400',
isCPBlock(data.type) && !hasBlockError && !hasBlockWarn && 'ring-2 ring-blue-400/60',

// Issue count badge at bottom of block:
{blockIssues.length > 0 && (
  <Tooltip content={blockIssues.map(i => `[${i.severity}] ${i.code}: ${i.message}`).join('\n')}>
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium mt-1',
      hasBlockError ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
    )}>
      {blockIssues.length} issue{blockIssues.length > 1 ? 's' : ''}
    </span>
  </Tooltip>
)}
```

#### Protocol tab in panel

**File to modify:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/panel/panel.tsx`

Add a "Protocol" tab alongside Editor | Toolbar | Copilot | Deploy:

```typescript
// New Protocol tab content:
// - Issue count summary: "2 errors, 3 warnings" with color badges
// - Issue list: severity badge + IGSL code + message + "Jump to block" button
//   (implement jump via reactflow's fitView({ nodes: [blockId] }) or setCenter())
// - Export IGSL JSON button (disabled when any BLOCK-severity issue exists)
```

**Files to create:** `apps/sim/app/workspace/.../components/panel/components/protocol/protocol-tab.tsx`

---

### W3.2 — IGSL JSON Export (Days 2–3, 1.5 days)

**Goal:** Export the protocol layer of the workflow as a valid `ProtocolVersion` JSON, suitable for import into any Precepto instance.

**File to create:** `apps/sim/lib/workflows/governance/igsl-exporter.ts`

**What it reads:**
- All CP blocks from `useWorkflowStore` (filtered by `isCPBlock()`)
- Edges between CP blocks
- Protocol Header block sub-block values (name, jurisdiction, version, lifecycle)
- Each CP block's sub-block values from `useSubBlockStore`

**What it produces:** A `ProtocolVersion` JSON object with:
- `commitment_points[]` — one per CP block, assembled from sub-block values
- `topology` — nodes + edges (CP-to-CP edges only, with relationship types)
- Protocol metadata from Protocol Header block
- `igsl_version: '1.2'`
- `status: 'DRAFT'`
- `created_at` timestamp

**Builder functions to implement:**

```typescript
// Each returns the relevant IGSL config object from sub-block values:
function buildAuthorityConfig(vals: Record<string, unknown>): AuthorityGateConfig
function buildEvidenceConfig(vals: Record<string, unknown>): EvidenceGateConfig
function buildReasoningConfig(vals: Record<string, unknown>): ReasoningGateConfig
function buildDependencyConfig(blockId: string, cpEdges: Edge[]): DependencyGateConfig
function buildRecourseConfig(vals: Record<string, unknown>): RecourseGateConfig
function buildVersionConfig(vals: Record<string, unknown>): VersionGateConfig
function buildOutcomes(vals: Record<string, unknown>): string[]
function buildProduces(vals: Record<string, unknown>): ProducesEntry[]
function computeTopologyProperties(cpBlocks: BlockState[], cpEdges: Edge[]): TopologyProperties
```

**Key rules:**
- Export is CP blocks only — automation blocks excluded
- `cp_id` from sub-block is preferred as the IGSL commitment point ID; if missing, use block UUID (will trigger `CP_ID_MISSING` validation BLOCK anyway)
- Topology edges: `targetHandle === 'activation'` → `type: 'DEPENDS_ON'`; `sourceHandle?.startsWith('source-appeals')` → `type: 'APPEALS'`
- Export button triggers file download: `<workflowName>-igsl.json`
- Export blocked by any BLOCK-severity validation issue

**Types to reference:** Import from Precepto's `@precepto/types` package OR copy relevant types into `apps/sim/lib/workflows/governance/igsl-types.ts`. Phase A recommendation: copy and freeze (Option C from `reusable-for-sim.md §4`). Phase B: use shared package.

---

### W3.3 — `GovernanceCPBlockHandler` + `PreceptoClient` (Days 3–4, 1.5 days)

**Goal:** Working handler stub that calls Precepto via direct HTTP. Mock client for local development. All 5 architect P1 fixes implemented.

**Files to create:**

```
apps/sim/executor/handlers/governance/
├── governance-cp-handler.ts    ← handler
├── precepto-client.ts          ← real HTTP client
├── precepto-client-mock.ts     ← mock client (swapped in via PRECEPTO_MOCK=true)
└── types.ts                    ← CommitmentSubmission, CommitmentResponse, GovernanceActorIdentity
```

#### `types.ts` — types to copy from Precepto

```typescript
// Copy these from packages/types/src/enforcement.ts and protocol.ts:
// (Option C: copy + freeze — replace with shared package in Phase B)

export interface CommitmentSubmission {
  commitment_point_id: string
  context_id: string            // GovernedContext ID — links all receipts in a case
  actor_id: string
  actor_type: 'HUMAN' | 'AI_AGENT' | 'SYSTEM'
  actor_role: string
  outcome: string
  evidence: Record<string, { value: unknown; attestation_level: string }>
  reasoning_text?: string | null
  reasoning_privilege?: 'NONE' | 'WORK_PRODUCT' | 'ATTORNEY_CLIENT'
  dry_run: true                 // hardcoded for all MVP submissions
  idempotency_key?: string
}

export interface GovernanceActorIdentity {
  actor_id: string
  role: string
  verification_method: 'PLATFORM_AUTH' | 'DELEGATED' | 'ATTESTED'
  delegation_chain?: string[]
}

export interface CommitmentResponse {
  status: 'COMMITTED' | 'BLOCKED' | 'FINALIZING'
  receipt?: {
    content_hash: string
    previous_hash: string
    chain_position: number
    outcome: string
    all_gates_passed: boolean
    gate_results: Record<string, unknown>
    is_dry_run: true
    recorded_at: string
  }
  failed_gates?: string[]
  blocked_details?: Record<string, unknown>
}

export interface EvidenceRequirement {
  field_name: string
  type: string
  required: string    // 'true' | 'false' (table value is string[][])
  attestation_level: string
}
```

#### `governance-cp-handler.ts` — key implementation details

```typescript
export class GovernanceCPBlockHandler implements BlockHandler {
  // DRY_RUN hardcoded for entire MVP period:
  private readonly DRY_RUN = true as const

  canHandle(block: SerializedBlock): boolean {
    // CRITICAL: use block.type (registry key), NOT block.metadata?.id (instance UUID)
    // isCPBlock checks against CP_TYPES set (governance_decide, governance_attest, ...)
    return isCPBlock(block.type)
  }

  async execute(ctx: ExecutionContext, block: SerializedBlock, inputs: Record<string, unknown>): Promise<BlockOutput> {
    const params = block.config.params
    const commitmentType = CP_IGSL_TYPE_MAP[block.type as CPBlockType]

    // ── P1 Fix: GovernedContext creation (architect review Structural Gap 1) ──
    let contextId = ctx.variables?.['governed_context_id'] as string | undefined
    if (!contextId) {
      // First CP block in this execution — create the Precepto context
      const context = await client.createContext({
        protocol_version_id: params.protocol_version_id ?? 'unknown',
        execution_mode: 'DRY_RUN',   // hardcoded
        subject_ref: ctx.workflowExecutionId,
      })
      contextId = context.id
      ctx.variables = { ...ctx.variables, governed_context_id: contextId }
    }

    // ── P1 Fix: proposed_outcome (architect review Structural Gap 3) ──
    // Read from proposed_outcome sub-block (supports {{<upstream.output>}} interpolation)
    // The resolver has already substituted template references by the time execute() is called
    const proposedOutcome = params.proposed_outcome as string
    if (!proposedOutcome) {
      throw new Error(`CP block "${block.metadata?.name}" has no proposed_outcome configured. ` +
        `For automated CPs: wire from upstream block output. For manual CPs: wire from HITL block.`)
    }

    // ── P1 Fix: actor identity (architect review Structural Gap 5) ──
    // Priority: authority_in handle → ctx.userId → actor_identity_config param
    const actorIdentity = this.resolveActorIdentity(inputs, params, ctx)

    // ── P1 Fix: DRY_RUN passthrough (architect review Structural Gap 4) ──
    // dry_run: true hardcoded — never reads from env in MVP

    const submission: CommitmentSubmission = {
      commitment_point_id: params.cp_id,
      context_id: contextId,
      actor_id: actorIdentity.actor_id,
      actor_type: actorIdentity.actor_type ?? 'HUMAN',
      actor_role: actorIdentity.role,
      outcome: proposedOutcome,
      evidence: this.buildEvidenceMap(inputs.evidence_in, params.evidence_requirements),
      reasoning_text: (inputs.reasoning_text as string) ?? null,
      reasoning_privilege: params.reasoning_privilege ?? 'NONE',
      dry_run: this.DRY_RUN,
    }

    const useMock = process.env.PRECEPTO_MOCK === 'true'
    const client = useMock
      ? new PreceptoClientMock()
      : new PreceptoClient(process.env.PRECEPTO_API_URL!, process.env.PRECEPTO_API_KEY!)

    const response = await client.submitCommitment(params.cp_id, submission)

    // ... handle COMMITTED / BLOCKED / FINALIZING responses
  }

  private resolveActorIdentity(
    inputs: Record<string, unknown>,
    params: Record<string, unknown>,
    ctx: ExecutionContext
  ): GovernanceActorIdentity {
    // Priority 1: authority_in handle provides actor (HITL/identity blocks)
    if (inputs.authority_in && typeof inputs.authority_in === 'object') {
      return inputs.authority_in as GovernanceActorIdentity
    }
    // Priority 2: AUTOMATED/AI_OVERSIGHT — use configured service account
    if (['AUTOMATED', 'AI_OVERSIGHT'].includes(params.automation_level as string)) {
      return {
        actor_id: params.actor_identity_config as string ?? 'system',
        role: params.actor_identity_config as string ?? 'system',
        verification_method: 'ATTESTED',
      }
    }
    // Priority 3: authenticated Sim user (MANUAL/AI_ASSISTED)
    return {
      actor_id: ctx.userId ?? 'unknown',
      role: 'authenticated_user',
      verification_method: 'PLATFORM_AUTH',
    }
  }
}
```

#### Register handler

**File to modify:** `apps/sim/executor/handlers/registry.ts`

```typescript
import { GovernanceCPBlockHandler } from './governance/governance-cp-handler'

// Add BEFORE GenericBlockHandler (first-match-wins):
export function getAllHandlers(): BlockHandler[] {
  return [
    new TriggerBlockHandler(),
    // ... other handlers ...
    new GovernanceCPBlockHandler(),   // ← ADD BEFORE GenericBlockHandler
    new GenericBlockHandler(),        // fallback
  ]
}
```

#### Mock client

```typescript
// apps/sim/executor/handlers/governance/precepto-client-mock.ts
// Use via PRECEPTO_MOCK=true env var — unblocks local development
// without a running Precepto instance

export class PreceptoClientMock {
  async createContext(params: unknown) {
    return { id: `mock-ctx-${Date.now()}`, status: 'ACTIVE' }
  }

  async submitCommitment(cpId: string, submission: CommitmentSubmission): Promise<CommitmentResponse> {
    // Configurable: set PRECEPTO_MOCK_RESULT='BLOCKED' to test failure paths
    const result = process.env.PRECEPTO_MOCK_RESULT ?? 'COMMITTED'
    if (result === 'BLOCKED') {
      return {
        status: 'BLOCKED',
        failed_gates: ['EVIDENCE'],
        blocked_details: { EVIDENCE: { failure_reason: 'Mock: evidence field missing' } },
      }
    }
    return {
      status: 'COMMITTED',
      receipt: {
        content_hash: `mock-hash-${Date.now()}`,
        previous_hash: 'GENESIS',
        chain_position: 0,
        outcome: submission.outcome,
        all_gates_passed: true,
        gate_results: {},
        is_dry_run: true,
        recorded_at: new Date().toISOString(),
      },
    }
  }
}
```

---

### W3.4 — `identity_bridge` Table + Lazy Provisioning (Day 4, 1 day)

**Goal:** Maps Sim users to Precepto actors. Required for actor identity in non-automated CP blocks.

**File to create (Precepto DB migration):**

```sql
-- precepto/apps/api/src/db/migrations/YYYYMMDD_identity_bridge.sql

CREATE TABLE IF NOT EXISTS identity_bridge (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sim_user_id     TEXT NOT NULL,
  sim_workspace_id TEXT NOT NULL,
  precepto_actor_id TEXT NOT NULL REFERENCES actors(id),
  institution_id  TEXT NOT NULL REFERENCES institutions(id),
  provisioned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sim_user_id, sim_workspace_id)
);

CREATE INDEX identity_bridge_sim_user_idx ON identity_bridge(sim_user_id, sim_workspace_id);
```

**Precepto client addition:** Add `resolveActor(simUserId, simWorkspaceId)` method that uses `INSERT ... ON CONFLICT (sim_user_id, sim_workspace_id) DO UPDATE SET provisioned_at = now() RETURNING *`. Fine for single-workspace demo; no advisory lock needed.

**Usage in handler:** When `verification_method === 'PLATFORM_AUTH'`, the handler optionally calls `resolveActor` to get the Precepto-native `actor_id`. For MVP, `ctx.userId` directly as actor_id is acceptable for DRY_RUN receipts.

---

### W3.5 — Acid Test: Carta de Agua (Day 5, 1 day)

**Goal:** Validate the entire Phase A pipeline against the reference protocol.

**What to build for the test:**
1. Open a new Sim workflow
2. Add Protocol Header block: name="Carta de Agua", jurisdiction="CR", lifecycle="DISCRETE"
3. Add 4 CP blocks: ATTEST (Technical Attestation), DECIDE (Eligibility Decision), DECIDE (Board Approval), CLOSE (Case Closed)
4. Wire activation edges: ATTEST → DECIDE#1 → DECIDE#2 → CLOSE
5. Configure DECIDE#1: `authority_model=SINGLE`, `authority_roles=[technical_director]`, `evidence_requirements=[{water_availability_report, document, true, VERIFIED}, {property_cadastral_map, document, true, ASSERTED}]`, `allowed_outcomes=[APPROVED, DENIED]`, `recourse_paths=[{for: DENIED, via: appeal_cp_id, window: P15D}]`
6. Verify: Protocol tab shows 0 BLOCK issues
7. Click Export IGSL JSON → file downloads
8. Compare exported JSON against reference structure from Precepto seed data (`apps/api/src/db/seeds/carta-de-agua.ts` `buildGateConfigs()`)

**Success criteria:**
- Export produces valid IGSL v1.2 JSON structure
- `commitment_points` array has 4 entries
- Topology has 3 edges (ATTEST→DECIDE, DECIDE→DECIDE, DECIDE→CLOSE), all `type: 'DEPENDS_ON'`
- DECIDE#1's `evidence_config.expression` reflects the two evidence requirements
- Authority config reflects `authority_model: 'SINGLE'`, `roles: ['technical_director']`

---

### Week 3 Smoke Tests

- [ ] DECIDE block with missing `evidence_requirements` → red ring appears
- [ ] Fix requirements → yellow rings (warnings only) → Export button enabled
- [ ] Export downloads a JSON file with `igsl_version: '1.2'`
- [ ] `GovernanceCPBlockHandler.canHandle({ type: 'governance_decide', ... })` returns `true`
- [ ] `GovernanceCPBlockHandler.canHandle({ type: 'api', ... })` returns `false`
- [ ] With `PRECEPTO_MOCK=true`: run a minimal workflow with a DECIDE block → receives mock COMMITTED receipt → `outcome_token` flows downstream
- [ ] With `PRECEPTO_MOCK=true` + `PRECEPTO_MOCK_RESULT=BLOCKED`: DECIDE block returns `blocked_gates: ['EVIDENCE']`
- [ ] Acid test: Carta de Agua on canvas → validates → exports → matches reference structure

---

## Definition of Done (Phase A)

- [ ] **Block registry:** All 8 CP block types registered. Appear in Sim toolbar under "Governance" section (via `integrationType: 'governance'`). EVOLVE hidden (`hideFromToolbar: true`).
- [ ] **Visual identity:** CP badge visible in all CP block headers. Blue `ring-2` default. Red ring on BLOCK-severity issues. Yellow ring on WARN-only issues.
- [ ] **Gate sub-blocks:** Every gate (AUTHORITY, EVIDENCE, REASONING, DEPENDENCY, RECOURSE, VERSION) has configurable sub-blocks on the relevant CP types. Conditional sub-blocks show/hide correctly.
- [ ] **Named handles:** `evidence-in`, `authority-in`, `activation` handles visible and connectable on CP blocks. Edge labels ("evidence", "authority", "depends on") render correctly.
- [ ] **Protocol Header:** Singleton block for protocol-level settings. Outputs accessible from CP blocks.
- [ ] **Validation:** 13+ IGSL codes implemented. Protocol tab shows issue list. Export button disabled when BLOCK issues exist.
- [ ] **Export:** IGSL JSON export produces valid `ProtocolVersion` structure. Acid test passes against Carta de Agua reference.
- [ ] **Handler stub:** `GovernanceCPBlockHandler` registered before `GenericBlockHandler`. `canHandle()` uses `block.type`. All 5 P1 architect fixes implemented (GovernedContext, `proposed_outcome`, DRY_RUN hardcoded, actor identity resolver, `canHandle()` field). Mock client works via `PRECEPTO_MOCK=true`.

---

## Known Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP spike fails (Day 1) | Low | High | Both sides already exist. If it fails, fall back to direct HTTP (`anthropic-direct`) for Phase B; MCP integration becomes Phase C work. |
| `workflow-block.tsx` named handle changes break existing blocks | Medium | Medium | Gate handle additions are conditional on `isCPBlock()`. Existing blocks unaffected. Run Sim's full block test suite after W2.4. |
| IGSL exporter produces structurally invalid JSON | Medium | Medium | Validate against Carta de Agua reference (`reusable-for-sim.md §6`). Use Precepto's seed `buildGateConfigs()` output as test fixture. |
| Type drift between copied Precepto types and live API | Medium | Low for Phase A | Phase A uses mock client; type drift is a Phase B issue. Add `// TODO: replace with @precepto/types` comments to all copied types. |
| `checkCircularDependencies()` performance on large graphs | Low | Low | O(V+E) topological sort is fast for 10–20 CP graphs. Benchmark if needed; add `useMemo` with stable key if slow. |
| Icon polish delays Week 1 smoke tests | Medium | Low | Use geometric SVG stubs in Week 1. Real icon design is a Phase D polish item. Do not let design block implementation. |
| EVOLVE block IGSL compliance | Known issue | Low | `hideFromToolbar: true` prevents use. Document the compliance issue in a comment. Revisit post-demo. |
| Protocol Header block accidentally deleted by user | Low | Medium | `singleInstance: true` prevents adding a second one but doesn't prevent deletion. Add a warning toast if user attempts to delete the Protocol Header. Phase B can add a soft-lock. |

---

## File Checklist for Linear

Cut one Linear issue per group below. Each group is 0.5–2 days of work.

**Week 1:**
- [ ] `[A1.1]` MCP spike — register Precepto `/mcp`, DRY_RUN roundtrip
- [ ] `[A1.2]` Fix `precepto_submit_commitment` MCP tool
- [ ] `[A1.3]` `ExecutorAdapter` interface + `AnthropicDirectAdapter` + `agent_configs` migration
- [ ] `[A1.4a]` `utils.ts`: `isCPBlock`, `CP_IGSL_TYPE_MAP`, `CP_TYPES`
- [ ] `[A1.4b]` 8 CP block definitions: `decide.ts` through `evolve.ts` (reference: `governance-protocol-mode.md §3`)
- [ ] `[A1.4c]` Registry changes: `IntegrationTag` + `registry.ts` imports
- [ ] `[A1.5]` 8 governance icons (SVG stubs in `components/icons/governance/`)
- [ ] `[A1.6]` Protocol Header block (`governance_protocol_header`, `singleInstance: true`)

**Week 2:**
- [ ] `[A2.1]` Rebrand Sim shell (name, logo, colours, sidebar navigation)
- [ ] `[A2.2]` Visual treatment in `workflow-block.tsx` (CP badge, ring-2 border)
- [ ] `[A2.3a]` Gate sub-blocks: AUTHORITY + EVIDENCE groups on all relevant CP types
- [ ] `[A2.3b]` Gate sub-blocks: REASONING + DEPENDENCY + RECOURSE + VERSION + TEMPORAL + v1.2 features
- [ ] `[A2.4a]` Multiple named input handles: `evidence_in`, `authority_in`, `activation` in `workflow-block.tsx`
- [ ] `[A2.4b]` DAG edge wiring for named handles in `edges.ts`
- [ ] `[A2.4c]` Gate handle edge labels in `workflow-edge.tsx`
- [ ] `[A2.4d]` Edge relationship encoding in `sourceHandle` + visual style in `workflow-edge.tsx`

**Week 3:**
- [ ] `[A3.1a]` IGSL validation: `igsl-types.ts` + `validate-protocol.ts` + BLOCK-severity rules
- [ ] `[A3.1b]` IGSL validation: WARN-severity rules
- [ ] `[A3.1c]` Validation display: on-canvas rings + Protocol tab in panel
- [ ] `[A3.1d]` Validation hook: `use-governance-validation.ts`
- [ ] `[A3.2]` IGSL export: `igsl-exporter.ts` + builder functions + Protocol tab export button
- [ ] `[A3.3a]` `types.ts`: copied CommitmentSubmission, CommitmentResponse, GovernanceActorIdentity
- [ ] `[A3.3b]` `precepto-client.ts`: real HTTP client (`submitCommitment`, `createContext`, `preflight`)
- [ ] `[A3.3c]` `precepto-client-mock.ts`: mock client (COMMITTED/BLOCKED/FINALIZING configurable)
- [ ] `[A3.3d]` `governance-cp-handler.ts`: handler with all 5 P1 fixes
- [ ] `[A3.3e]` Register handler in `handlers/registry.ts` before `GenericBlockHandler`
- [ ] `[A3.4]` `identity_bridge` table migration + `resolveActor()` in PreceptoClient
- [ ] `[A3.5]` Acid test: Carta de Agua on canvas → validates → exports → matches reference

---

*Phase A brief v1. Cut Linear issues from the checklist above. Revise at Phase A exit.*
