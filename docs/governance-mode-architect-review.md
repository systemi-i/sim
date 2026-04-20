# Governance Protocol Mode — Architect Review

**Reviewed by:** Senior Software Architect (subagent: gov-mode-review)  
**Date:** April 2026  
**Documents reviewed:**
- `docs/governance-protocol-mode.md` — design spec under review
- `GOVERNANCE-MODE-ARCHITECTURE.md` — Sim architecture analysis
- `GOVERNANCE-MODE-UI.md` — Sim UI architecture analysis
- `igsl-spec/spec/v1.2/igsl-v1.2-digest.yaml` — governance grammar spec
- `precepto/docs/roadmap-beta.md` — the original build roadmap

**Verdict:** Build it, with revisions. The core approach is sound. Five structural gaps need resolution before Phase 2. Several IGSL compliance issues need patching. The 8-week estimate is optimistic by roughly 20-30%.

---

## 1. Architecture Soundness — 7/10

### What's Right

The enforcement boundary is sacred and the design respects it. `GovernanceCPBlockHandler` calls Precepto, never an LLM. The execution flow is conceptually correct: automation blocks gather → CP block builds `CommitmentSubmission` → Precepto evaluates six gates deterministically → receipt flows downstream. Registering the handler before `GenericBlockHandler` with first-match-wins is the right pattern. The block registry extension via a new `'governance'` `IntegrationTag` is clean and zero-friction.

The decision to store CP block state in Sim's existing `workflow_blocks.subBlocks` JSONB column is correct — no new Sim DB tables needed for MVP. Receipts living in Precepto is architecturally clean.

The design is additive. Almost all changes are new files. The modifications to existing files (`workflow-block.tsx`, `workflow-edge.tsx`, `panel.tsx`, `registry.ts`, `handlers/registry.ts`) are surgical and low-risk.

### Structural Gap 1: GovernedContext is never created

**This is the most serious oversight in the design.** The CP block executor builds a `CommitmentSubmission` and calls `PreceptoClient.submitCommitment(cpId, submission)`, but a `CommitmentSubmission` is evaluated inside a `GovernedContext`. There is no `context_id` anywhere in the block config, the handler, or the execution flow.

Without a `GovernedContext`, Precepto cannot:
- Chain receipts (receipts belong to a context)
- Track `CommitmentPointState` across a workflow execution
- Evaluate `DependencyGateConfig` (depends on prior CPs being COMMITTED in the same context)

**How does a context get created?** Before the first CP block executes. But nothing in the design specifies when, how, or by whom. The trigger block? A dedicated CP context block? A workflow-level setting? This is load-bearing and must be specified.

**Concrete gap:** Precepto's submit endpoint is `/v1/commitment-points/:cpId/submissions` but the submission must reference a context. The submission schema requires `commitment_point_id` and derives the context from it, or the endpoint includes a context — the design doesn't show this. Either way, `context_id` must enter the execution flow somewhere.

**Recommended fix:** Add a hidden `context_id` that is populated at workflow execution start. Two options:
- Option A: The first CP block creates the context on Precepto (`POST /v1/contexts`) and stores the `context_id` in `ExecutionContext`. Subsequent CP blocks in the same execution share it.
- Option B: A dedicated "Open Case" block (or workflow trigger config) creates the Precepto context before any CP block runs.

Option A is lower friction for MVP. Option B is more explicit. Either way, document it in the spec before Phase 2.

### Structural Gap 2: `canHandle()` checks the wrong field

```typescript
canHandle(block: SerializedBlock): boolean {
  return isCPBlock(block.metadata?.id ?? '')
}
```

In Sim's execution engine, `SerializedBlock.metadata?.id` is not the block's type — it's the block's instance ID (UUID). The block type is stored at `block.type` or equivalent. Cross-referencing `BlockExecutor` and the handler patterns in the codebase: handlers typically check `block.metadata?.id` for specific block IDs (like `trigger`, `condition`) that are type identifiers by convention, not instance UUIDs. For custom governance blocks, `block.type` (the registry key like `governance_decide`) is what needs to be checked.

Verify against Sim's actual `SerializedBlock` type. If `metadata.id` is the type key, the code is fine. If it's the instance UUID, this is a silent bug that causes all CP blocks to fall through to `GenericBlockHandler`.

### Structural Gap 3: `proposed_outcome` is always 'APPROVED'

```typescript
outcome: params.proposed_outcome ?? 'APPROVED',
```

The `DecideBlock` (and all other CP blocks) has no `proposed_outcome` sub-block. This means every `CommitmentSubmission` will have `outcome: 'APPROVED'` unless something sets `proposed_outcome` at runtime. For autonomous workflows, the outcome must be determined by what the automation blocks produce — not hardcoded. An AI Agent gathering evidence and reasoning should determine the proposed outcome; a HITL block where the officer clicks "Approve" or "Reject" should set it.

**Fix:** Add `proposed_outcome` as a sub-block on CP blocks (a short-input with `{{<upstream.output>}}` interpolation support) or derive it from the `authority_in` input. Document the mechanism clearly — this is a core part of how CP blocks work.

### Structural Gap 4: DRY_RUN mode is never passed to Precepto

The roadmap is explicit: "DRY_RUN only for the entire 12 weeks." The design never mentions how DRY_RUN mode propagates to Precepto submissions. Precepto's `governed_contexts.mode` distinguishes DRY_RUN from LIVE. The `CommitmentSubmission` payload or the context creation call must carry this flag. Without it, the demo runs in LIVE mode — which the roadmap explicitly prohibits.

**Fix:** Add `execution_mode: ctx.env.PRECEPTO_EXECUTION_MODE ?? 'DRY_RUN'` to either the context creation step or the submission payload, and document it in §6.

### Structural Gap 5: Actor identity is unspecified

`authority_in` is described as "actor identity and role context from upstream automation blocks" but the IGSL schema requires `ActorIdentity` with specific fields (`actor_id`, `actor_type`, `actor_role`, `identity_verification_method`, `credential_ref`). The design shows `inputs.authority_in` as a generic `json` input — it doesn't specify what JSON structure is required.

For the demo, who is the actor? The currently logged-in Sim user? A hardcoded service account? For HITL-driven workflows, the officer who approved. For automated workflows, the AI agent. These are different actor identity structures.

**Fix:** Add an `ActorIdentityResolver` to the handler that maps from: (a) `ctx.actorIdentity` (Sim user context) for MANUAL flows, (b) `inputs.authority_in` for flows where an upstream HITL block provides identity, (c) a configured service account for AUTOMATED flows. Document the expected shape of `authority_in`.

### DB Migration Assessment

The `governance_decisions` table in Precepto's DB (§11.2) is described as a "fire-and-forget write" that is "non-fatal if it fails." For a governance audit trail, silent write failures are unacceptable. Either:
1. Make it non-fatal for the workflow but logged and alertable (add a failed-write counter to the governance health indicator)
2. Or acknowledge that Precepto's receipt chain IS the audit trail and this table is a denormalization for query convenience — in which case, clarify that in the spec and move it to Phase 4 where it belongs

The table itself is correctly designed and the schema looks sound.

---

## 2. Feasibility Assessment — 6/10

### Can the 8-week plan be executed as written?

Partially. Phase 1 (canvas + visual system) is well-scoped and achievable in 2 weeks. Phase 4 (copilot + scaffolding) is actually straightforward — mostly prompt engineering and tool call wiring, likely faster than estimated. Phases 2 and 3 are where the plan comes apart.

### What's Underestimated

**Phase 2, Week 3 (execution):** The handler is well-specified but the `GovernedContext` creation gap (Structural Gap 1) will surface immediately when testing. Finding and resolving this takes 1-2 days beyond what's budgeted. The `CommitmentSubmission` type mapping from sub-block values is also non-trivial — the `buildEvidenceMap()` function needs to handle all 8 CP types, each with different evidence requirements.

**Phase 2, Week 4 (IGSL validation + export):** The design lists 13 validation rules. Implementing `checkCircularDependencies()` for a CP DAG is non-trivial (topological sort + cycle detection). The IGSL exporter (`igsl-exporter.ts`) must produce a valid `ProtocolVersion` JSON with ~30 required fields, many of which have no corresponding sub-block (e.g., `institution_id`, `protocol_id`, `retention_policy`, `domain_context`). The exporter will need either hardcoded defaults or a workflow-level configuration surface. This is likely a full 5-day week on its own, not split with validation.

**Phase 3, Week 5 (gate handle polish):** The `useGateStatus(blockId)` hook — "real-time gate evaluation status from Precepto (via preflight call after evidence-in changes)" — is expensive to implement correctly. Preflight calls on every evidence-in change creates a hot polling loop against Precepto. This needs debouncing, error handling, and connection state management. Cut this from MVP and add it in Phase 4 or post-demo.

### What's Overestimated

Phase 4 copilot work is estimated at 2 weeks but could likely be done in 1.5 weeks. The Anthropic SDK integration is straightforward, the tool call handlers are well-specified, and the pattern scaffold functions are repetitive work once you have the first one.

The 8 SVG icons (§4.1) are listed as Week 1 work. If exact paths are TBD with design, this is actually a 0.5-day task to stub with placeholders and a separate design handoff task. Don't let icon polish block the smoke tests.

### Technical Risks Not Addressed

1. **Precepto availability during development.** Phase 2 requires a running Precepto instance to smoke-test CP block execution. If Precepto is unreliable or has API instability during Weeks 3-4, Phase 2 will slip. The design should include a mock `PreceptoClient` that returns stubbed COMMITTED/BLOCKED responses for local development.

2. **Type compatibility between Sim and Precepto.** The `CommitmentSubmission`, `CommitmentResponse`, and `Receipt` types defined in `executor/handlers/governance/types.ts` must exactly match Precepto's API contract. Any drift (field name differences, optional vs required, enum casing) causes silent bugs or runtime errors. These types should be auto-generated from Precepto's OpenAPI spec or shared from a `@precepto/types` package.

3. **The MCP/HTTP duality.** The roadmap's Agent Studio uses MCP tools (`precepto_get_briefing`, `precepto_preflight`, `precepto_submit_commitment`) for automation blocks to call Precepto. The design doc's CP block handler uses direct HTTP (`PreceptoClient`). This creates two Precepto integration paths in the same codebase. For the demo, this is fine. But it means type drift risks apply doubly, and any Precepto API changes need to be propagated to both integration points. Consider whether `GovernanceCPBlockHandler` could use the MCP tools internally rather than raw HTTP — this would keep one integration path but requires the MCP connection to be available in the executor context.

---

## 3. IGSL Compliance — 6/10

### What the Block Model Gets Right

- All 8 CP types from the IGSL `CommitmentType` enum are represented correctly
- The 6-gate structure (AUTHORITY, EVIDENCE, REASONING, DEPENDENCY, VERSION, RECOURSE) maps to the `authority_model` / `evidence_requirements` / `reasoning_required` / `activation` / `allowed_outcomes` / `recourse_paths` sub-blocks
- The `authority_model` enum values match IGSL exactly (SINGLE, ALTERNATIVE, JOINT, DELEGATED, ATTRIBUTE_DETERMINED)
- The `automation_level` enum values match IGSL exactly
- The `attestation_level` ladder (ASSERTED → ANCHORED) is represented in the evidence table
- The `appeals_cp_id` mechanism maps to IGSL's `CommitmentDependency { relationship: 'APPEALS' }`
- The `accountability_actor` field for AUTOMATED CPs is present and maps correctly

### IGSL Compliance Issues

**Issue 1: EVOLVE produces no receipt — this violates IGSL.** The design doc says EVOLVE has "no receipt output (EVOLVE does not produce a commitment receipt — it triggers a protocol version change)." This is incorrect. The IGSL spec is unambiguous: "Temporal effects that produce binding consequences MUST generate a receipt (actor_type=SYSTEM)." EVOLVE is a `CommitmentType` — it is a binding institutional act. The fact that `typical_produces: null` in the digest means the OUTPUT TYPE is not a standard DECISION/ATTESTATION/CLOSURE (it's a version modification), not that no receipt is issued. The EVOLVE block executor must obtain a receipt from Precepto and expose it downstream.

**Issue 2: `required_outcomes` missing from DEPENDENCY gate.** The IGSL `CommitmentDependency` schema has `required_outcomes: OutcomeToken[] | null` — which outcome(s) of the prior CP must have occurred for this dependency to be satisfied. The design's `activation` handle connects a CP receipt to the upstream CP, but there's no way to configure `required_outcomes` in the panel. Without it, the DEPENDENCY gate accepts any outcome from the upstream CP (including REJECTED), which is almost certainly wrong for most protocols.

**Fix:** Add a `dependency_required_outcomes` sub-block (table or multi-select) that appears when an `activation` edge is connected. This is critical for IGSL compliance.

**Issue 3: VERSION gate configuration missing from all CP blocks.** The IGSL `VersionGateConfig` has `required: boolean` and `allowed_model_versions: string[] | null`. The IGSL exporter hardcodes `{ required: true, allowed_model_versions: null }` for all blocks. This is a reasonable default but operators should be able to pin AI model versions per CP. Add an advanced sub-block for this in Phase 3 or later.

**Issue 4: CLOSE block needs `allowed_outcomes`.** The IGSL spec states "Any CP using `outcome_overrides` or `for_outcomes` MUST declare `allowed_outcomes`." More importantly, CLOSE produces a CLOSURE receipt which has an `outcome` field. The design shows `close_reason` (COMPLETED/WITHDRAWN/EXPIRED/ADMINISTRATIVE) but no `allowed_outcomes` table. The exporter will produce a CLOSE CP with `allowed_outcomes: null`, which may fail IGSL validation on `SCHEMA_MISSING_REQUIRED_FIELD` depending on Precepto's enforcement.

**Issue 5: Validation code set is incomplete.** The following IGSL v1.2 validation codes are in the spec but not in the design doc's validator:

| Missing Code | Severity | Why It Matters |
|---|---|---|
| `LIFECYCLE_DISCRETE_NO_CLOSE` | WARN | DISCRETE protocols without a CLOSE CP should warn — this is a common structural mistake |
| `TEMPORAL_AUTO_RESOLVE_UNEXPECTED_APPROVE` | WARN | AUTO_APPROVE on non-DECIDE/ATTEST CPs is semantically wrong |
| `TEMPORAL_MISSING_DIRECTION` | WARN | `auto_resolve=true` without `direction` is underspecified |
| `TEMPORAL_AUTO_APPROVE_CITIZEN_DIRECTION` | WARN | Mentioned in a tooltip but not implemented as a validation rule |
| `TEMPORAL_DEEMED_REFUSAL_CITIZEN_DIRECTION` | WARN | Same gap |
| `TOPOLOGY_MISSING_TERMINAL_POINT` | WARN | No terminal CP (CLOSE or functionally terminal) |

**Issue 6: `GATE_MISSING_REQUIRED_GATE` is misapplied.** The design maps this code to "CP block has no evidence requirements defined." But the IGSL spec's definition is "One of the six canonical gates absent when required." These are different. The evidence-requirements check is more precisely represented by a custom rule (e.g., `EVIDENCE_REQUIREMENTS_EMPTY`). Use the correct validation code for the correct condition; don't repurpose it.

**Issue 7: REASONING gate sub-fields incomplete.** IGSL's `ReasoningGateConfig` requires `required: boolean`, `require_reasoning_text: boolean`, and `allowed_privileges: ReasoningPrivilege[]` (an array, not a single value). The DECIDE block has `reasoning_required: switch` and `reasoning_privilege: dropdown` (single value). For IGSL compliance, the exporter needs to handle `allowed_privileges` as an array. Add `reasoning_allowed_privileges` as a multi-select or the exporter must wrap the single value in an array.

### Can the Export Produce Valid IGSL JSON?

With the issues above resolved: mostly yes, for L1/L2 compliance. The exporter will produce a valid `ProtocolVersion` structure with the 8 CPs, topology, and dependency graph. It will fail validation on:
- EVOLVE CPs (no receipt → can't be published)
- CLOSE CPs (missing `allowed_outcomes`)
- Any CP with `required_outcomes` needed for DEPENDENCY gates
- Missing `igsl_version: "1.2"` field (the exporter sets this correctly as a string — just verify the field name matches `ProtocolVersion.igsl_version`)

---

## 4. Integration Risk — 7/10 (higher = lower risk)

### Sim Integration: Lower Risk than It Looks

The design is correctly additive. New files dominate; modifications to existing files are surgical. The riskiest single change is `workflow-block.tsx` (1600+ lines), but the proposed additions are all conditional on `isCPBlock()` and add at most ~20 lines of JSX. The `panel.tsx` tab addition follows established patterns.

Handler registration before `GenericBlockHandler` is safe — the handler list is checked in order, first-match-wins, and `isCPBlock()` is a precise discriminator.

The toolbox extension via a new `IntegrationTag` is exactly the right pattern — no toolbar code changes needed.

**Upstream merge risk:** The roadmap explicitly freezes Sim at current SHA for 12 weeks. This is correct and this decision should not be revisited. The design doc doesn't need to re-litigate it, but it should explicitly reference the freeze.

### Precepto Integration: Moderate Risk

The Precepto HTTP client is thin and well-specified (`submitCommitment`, `preflight`). The risk is type contract drift between the types defined in `executor/handlers/governance/types.ts` and Precepto's actual API responses. The `CommitmentResponse` type in the design doc matches the IGSL `CommitmentResponse` schema, which matches what Precepto should return. This is a documentation risk, not an architectural risk.

**Note the typo:** The client class is named `PrecepsoClient` (transposition: Precep**so** instead of Precep**to**). Fix this before code review.

**The two-path problem:** Automation blocks in Agent Studio use Precepto via MCP tools. CP block execution uses Precepto via direct HTTP. This is an intentional architectural difference — MCP is for LLM-orchestrated tool calls; direct HTTP is for deterministic enforcement. This distinction is correct and should be explicitly documented, not left implicit.

### Copilot Replacement: Works

The approach — detecting CP blocks and switching to `/api/governance-copilot` — is clean. The same chat UI, different backend endpoint. The Anthropic SDK integration is straightforward. The main risk is context window size: the system prompt includes the full IGSL digest (~10K tokens) plus the reference manual. With claude-opus-4-5's context window, this is fine. Watch for latency on first-message (cold start with a large system prompt).

One concern: the copilot prompt says "Use the `add_governance_blocks` tool, not just descriptions" and the tool call handler client-side calls `batchAddBlocks()`. But `batchAddBlocks()` requires specific `BlockState` structure. The LLM must produce exactly the right shape. Include a few-shot example of a correct tool call in the system prompt — don't rely on the type schema alone.

---

## 5. UX Coherence — 7/10

### What Works Well

The unified canvas is the right decision. Forcing users to context-switch between a "Protocol Studio" canvas and an "Agent Studio" canvas for what is fundamentally one workflow breaks the mental model. One canvas, everything visible.

The visual distinction is well-designed: blue family colors, `CP` badge, `2px ring` border. These are sufficient to differentiate CP blocks from automation blocks at a glance without being obtrusive.

The gate handle labels ("evidence", "authority", "depends on") on edges are a significant UX win for non-technical users trying to understand why blocks are connected.

The Protocol tab with validation issue list and Export button is the right place for governance-specific functionality without cluttering the main Editor.

### UX Gaps

**Gap 1: `cp_id` is a developer concept in a designer tool.** The mandatory `cp_id` text field ("Enter the Precepto CP ID, e.g. cp_01HXYZ...") is the most significant UX failure in the design. An institutional protocol designer cannot be expected to look up a Precepto commitment point UUID and paste it into a text field. This is acknowledged in Open Question Q1 and deferred to Phase 4. For the demo (engineers only), this is acceptable. For any institutional user, it's a blocker. Make Phase 4's priority #1 the CP selector widget, not the copilot pattern templates.

**Gap 2: Outcome-based routing has no standard pattern.** A CP block produces an `outcome_token` (e.g., "APPROVED", "REJECTED"). To branch on this downstream, a user must add a Condition block and write `<DECIDE_Eligibility.outcome_token> === 'APPROVED'`. Non-technical designers won't know to do this. The design should include a standard "CP Outcome Router" pattern (in the copilot's `scaffold_pattern` tool list or as an 8th pattern template) that auto-generates the condition block when a CP block has multiple outcomes. Alternatively, CP blocks could have explicit `output.outcome` handle splitting (one handle per declared `allowed_outcomes` token) — more complex to implement but far more intuitive.

**Gap 3: BLOCKED state UX is underspecified.** When Precepto returns BLOCKED, the `blocked_gates` output flows to a "blocked" handle. But what does the user connect to that handle? The design says "routes to error/recovery automation blocks" but doesn't show any pattern. A governance protocol has specific recovery actions per gate failure — AUTHORITY failure means re-route to correct authority; EVIDENCE failure means gather missing evidence. The design should include at least one complete BLOCKED recovery example.

**Gap 4: "Jump to block" requires navigation implementation.** The Protocol tab's issue list has a "Jump to block" button per issue. This requires implementing canvas navigation (pan + zoom to a specific node). Sim likely has `fitView({ nodes: [id] })` or `setCenter()` available from React Flow. This is a small but non-trivial addition not accounted for in the Phase 2 estimate.

**Gap 5: The 5-tab panel is crowded.** `Editor | Toolbar | Protocol | Copilot | Deploy` — five tabs in a narrow panel. On smaller screens, these will overflow or abbreviate. The Protocol tab's validate-and-export functionality could alternatively live as a floating panel or as a section within the Deploy tab (since IGSL export is conceptually a pre-deploy step). Consider this before committing to the 5-tab layout.

---

## 6. What's Missing

### Critical Gaps

**1. GovernedContext lifecycle** (see Structural Gap 1 above — the biggest missing piece). Who creates the context? When? How does `context_id` enter the executor? What happens to an incomplete context if the workflow fails mid-execution? What's the cleanup/retry story?

**2. DRY_RUN passthrough** (see Structural Gap 4). The roadmap is explicit about DRY_RUN-only for 12 weeks. The spec never mentions it.

**3. Complete EVOLVE block specification.** EVOLVE is architecturally special — it modifies the governing protocol itself. The design gives it a minimal spec and says it produces no receipt. This is IGSL-noncompliant and logistically unclear. What does EVOLVE actually DO in the Precepto API? Trigger a new `ProtocolVersion`? Require a quorum? Emit a receipt with `commitment_type: EVOLVE`? This block needs a complete spec before implementation.

**4. Mock PreceptoClient for local development.** Without Precepto available, Phase 2 development is blocked. Add a mock client that can be swapped in via env var (`PRECEPTO_MOCK=true`) returning realistic COMMITTED/BLOCKED/FINALIZING responses. This is a 0.5-day addition that unblocks local iteration.

**5. Protocol version binding at context creation.** When a GovernedContext is created in Precepto, it's pinned to a specific `protocol_version_id` — immutable for its lifetime. The workflow's CP blocks each have a `cp_id` linking to a Precepto CP, which belongs to a protocol version. If the operator updates the Precepto protocol (new version) after creating cases, existing cases stay on the old version. This is correct IGSL behavior, but the UX implications (stale `cp_id` references, version mismatches) need to be documented.

### Edge Cases Not Addressed

- **What if `cp_id` is blank at execution time?** Open Question Q2 recommends a BLOCK-severity validation rule, which is correct. But what error message does the user see? The error should be "This CP block is not linked to a Precepto commitment point. Open the block and set the Precepto CP ID." Make this explicit.
- **What if two CP blocks have the same `cp_id`?** IGSL allows only one COMMITTED receipt per CP per context. Duplicate `cp_id` usage in a single workflow would cause the second CP block's submission to fail (the first is already COMMITTED). Add a validation rule: `CP_ID_DUPLICATE` (BLOCK severity).
- **Parallel CP block execution.** Sim's parallel orchestrator can run multiple blocks concurrently. If two CP blocks execute in parallel and both submit to Precepto simultaneously, there could be a race condition on the receipt chain (which receipt's `previous_hash` is which?). Precepto's enforcement engine likely serializes this at the DB level, but test it explicitly.
- **FINALIZING state and signing.** The design mentions `_pauseMetadata` for FINALIZING and says "HITL or signature-collection block handles finalization." But what does "finalization" mean in Sim's UI? Which block does the approver use? How does the finalization resume endpoint work? This needs a concrete implementation path.

### Failure Modes Not Considered

- **Precepto 429 (rate limit).** The `PreceptoClient` has a 30-second timeout but no retry logic. For a governance enforcement engine, a 429 should pause execution and retry, not fail the workflow. Add retry-with-backoff to `PreceptoClient`.
- **Precepto network partition during receipt write.** If Precepto's DB write succeeds but the HTTP response is lost, the CP block sees an error and may retry — submitting the same commitment twice. Precepto's enforcement engine must be idempotent (same submission hash = same receipt). Verify this with the Precepto team and document the idempotency guarantee.
- **Validation hook performance with large graphs.** The design says "validation is fast (< 5ms for typical protocol graphs of 10-20 CPs)." The `checkCircularDependencies()` function on a 20-CP graph with complex edges is O(V+E), so this claim is likely correct. But `checkDeemedRefusalAppealPath()` requires traversing the CP edge graph looking for downstream APPEAL blocks — this could be O(V²) in worst case. Benchmark before shipping Phase 2.

---

## 7. Recommended Changes

### Priority 1 — Fix Before Phase 2 (Correctness Blockers)

**P1.1 — Specify GovernedContext creation.** Add §6.0 "Context Lifecycle" to the spec. Define: who creates the context (recommend: the first CP block creates it if none exists for this `workflowExecutionId`), what `context_id` field goes where in `ExecutionContext`, and how CP blocks downstream in the same execution find it. Code: `PreceptoClient` needs a `createContext(protocolId, protocolVersionId, executionMode)` method; `GovernanceCPBlockHandler` needs context creation logic at the head of `execute()`.

**P1.2 — Fix `canHandle()` field reference.** Verify `block.metadata?.id` is the block type key (not instance UUID) in Sim's `SerializedBlock`. If it's the instance UUID, change to `block.type`. This is a potential silent catastrophic bug.

**P1.3 — Specify `proposed_outcome` mechanism.** Add `proposed_outcome` as a `short-input` sub-block to all CP blocks that produce DECISION receipts (DECIDE, DELEGATE, APPEAL, REMEDY, OVERRIDE), supporting `{{<upstream.output>}}` interpolation. Remove the hardcoded `'APPROVED'` default. Document: for AI-driven workflows, the Agent block should output the proposed outcome; for HITL workflows, the HITL block's approval/rejection drives it.

**P1.4 — Add DRY_RUN passthrough.** Add `execution_mode` to the context creation call (`'DRY_RUN' | 'LIVE'`), defaulting to `process.env.PRECEPTO_EXECUTION_MODE ?? 'DRY_RUN'`. Document in §6.3 with the other env vars.

**P1.5 — Specify actor identity resolution.** Add `ActorIdentityResolver` to the handler. Define three cases: (a) `inputs.authority_in` provided → use as `ActorIdentity`; (b) no `authority_in` and `automation_level === 'AUTOMATED'` → build system actor from `params.accountability_actor`; (c) neither → use `ctx.userId` as human actor with SESSION_AUTH verification. Document the expected shape of `authority_in` JSON in the `evidence-in` / `authority-in` handle descriptions.

### Priority 2 — Fix Before Phase 2 Demo (IGSL Correctness)

**P2.1 — Fix EVOLVE block.** Either: (a) specify that EVOLVE submits to Precepto and obtains a receipt (correct IGSL behavior), or (b) if EVOLVE is out of scope for Phase 1-4, mark the block `hideFromToolbar: true` and document why. Do not ship a block that silently violates IGSL.

**P2.2 — Add `required_outcomes` to DEPENDENCY gate.** Add a `dependency_required_outcomes` sub-block (multi-select or table) that appears when an `activation` edge is connected. Populate in the IGSL exporter's `buildDependencyConfig()`.

**P2.3 — Fix CLOSE block `allowed_outcomes`.** Add an `allowed_outcomes` table sub-block to the CLOSE block. Default values: COMPLETED, WITHDRAWN, EXPIRED, ADMINISTRATIVE (matching `close_reason`). Export these as `allowed_outcomes` in the IGSL exporter.

**P2.4 — Add missing validation codes.** Add to `validation-rules.ts`:
- `checkDiscreteNoClose()` → `LIFECYCLE_DISCRETE_NO_CLOSE` (WARN)
- `checkAutoApproveOnNonDecide()` → `TEMPORAL_AUTO_RESOLVE_UNEXPECTED_APPROVE` (WARN)
- `checkAutoResolveMissingDirection()` → `TEMPORAL_MISSING_DIRECTION` (WARN)
- `checkAutoApproveWithCitizenDirection()` → `TEMPORAL_AUTO_APPROVE_CITIZEN_DIRECTION` (WARN)
- `checkDeemedRefusalWithCitizenDirection()` → `TEMPORAL_DEEMED_REFUSAL_CITIZEN_DIRECTION` (WARN)
- `checkDuplicateCpIds()` → custom `CP_ID_DUPLICATE` (BLOCK)

**P2.5 — Fix `GATE_MISSING_REQUIRED_GATE` misuse.** Rename the evidence-requirements-empty check to a custom code (e.g., `EVIDENCE_CONFIG_EMPTY`) or use the `GATE_INVALID_CONFIGURATION` code. Reserve `GATE_MISSING_REQUIRED_GATE` for its correct use: any of the six gate configs missing from the `CommitmentPoint`.

### Priority 3 — Before Phase 2 Ship (Developer Experience)

**P3.1 — Add mock PreceptoClient.** `executor/handlers/governance/precepto-client-mock.ts` — swap in via `ctx.env.PRECEPTO_MOCK === 'true'`. Returns configurable COMMITTED/BLOCKED/FINALIZING responses. Unblocks local development and allows testing all execution paths without a running Precepto instance.

**P3.2 — Fix `PrecepsoClient` typo.** Rename to `PreceptoClient` throughout. Minor but embarrassing in code review.

**P3.3 — Clarify the MCP/HTTP duality.** Add a note in §6.1 explaining: "Automation blocks use Precepto via MCP tools (agent-driven, LLM-orchestrated). CP block execution uses Precepto via direct HTTP (deterministic enforcement, not LLM-orchestrated). This is intentional and correct. The HTTP client is not a replacement for MCP tools — it is a separate, deterministic execution path."

**P3.4 — Add idempotency note.** In §6.2, document: "Precepto's enforcement engine must be idempotent: re-submitting a `CommitmentSubmission` with the same content hash should return the same receipt rather than creating a duplicate. Verify this guarantee with the Precepto API before Phase 2."

### Priority 4 — Phase 3-4 (Polish)

**P4.1 — Cut `useGateStatus` from Phase 3.** The real-time preflight-on-evidence-change hook is premature optimization. Defer to post-demo. Replace with a manual "Run Preflight" button in the block menu (already specified in Phase 3 Week 6) — much simpler and sufficient for the demo.

**P4.2 — Add CP outcome router pattern.** Add an 8th pattern to `scaffold_pattern` tool: `cp_outcome_branch` — scaffolds a CP block + a Condition block pre-configured with `outcome_token` branching. This closes the "how do non-technical users branch on CP outcomes" gap.

**P4.3 — Make CP selector widget the Phase 4 priority.** The `cp_id` manual text field is the biggest UX gap for institutional users. Before pattern templates and copilot polish, ship a `protocol-cp-selector` sub-block that fetches Precepto protocols/CPs and presents a dropdown. This is more impactful for demo readiness than the copilot improvements.

**P4.4 — Move `governance_decisions` table to Phase 4 or cut.** The Precepto receipt chain IS the audit trail. This table is a query optimization. Cut from Phase 2 scope; revisit in Phase 4 if query performance on receipts is actually a problem.

---

## 8. Summary Scores

| Dimension | Score | Notes |
|---|---|---|
| Architecture Soundness | **7/10** | Sacred boundary respected. Five structural gaps must close before Phase 2. |
| Feasibility | **6/10** | Phase 1 solid. Phase 2 underestimated by ~30%. Phase 4 overestimated. |
| IGSL Compliance | **6/10** | 8 CP types correct. 7 compliance issues. Exporter mostly sound but incomplete. |
| Integration Risk | **7/10** | Additive Sim changes are low-risk. MCP/HTTP duality is manageable. Type drift is the main risk. |
| UX Coherence | **7/10** | Visual system is strong. `cp_id` UX, outcome routing, and BLOCKED recovery need work. |

**Overall: 7/10 — Build it with revisions.**

The design demonstrates genuine architectural discipline: the enforcement boundary is sacred, the execution model is clean, and the additive approach to modifying Sim is correct. The gaps are real but addressable. Priority 1 changes must happen before Phase 2 or the executor will not work. Priority 2 changes must happen before the IGSL export can produce valid, publishable protocols. Priority 3-4 are polish that can be phased.

The 8-week estimate is achievable but tight. Budget for ~10 weeks if you're doing Priority 1+2 alongside Phases 1-2. The copilot work in Phase 4 can compress if needed.

---

*Review complete. Cut issues from this doc as Linear tasks against the `systemi-i/sim` governance milestone.*
