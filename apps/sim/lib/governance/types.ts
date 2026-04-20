// Types copied from @precepto/types for governance mode
// TODO: Share via package in Phase B

export type CommitmentType = 'DECIDE' | 'ATTEST' | 'APPEAL' | 'CLOSE' | 'REMEDY' | 'DELEGATE' | 'OVERRIDE' | 'EVOLVE';

export type GateType = 'authority' | 'evidence' | 'reasoning' | 'dependency' | 'version' | 'recourse';

export type AuthorityModel = 'SINGLE' | 'ALTERNATIVE' | 'JOINT' | 'DELEGATED' | 'ATTRIBUTE_DETERMINED' | 'UNKNOWN';

export type AutomationLevel = 'AUTOMATED' | 'ASSISTED' | 'SUPERVISED' | 'MANUAL';

export type SigningRequirement = 'NONE' | 'DIGITAL' | 'QUALIFIED' | 'WITNESSED';

export type DependencyRelationship = 'DEPENDS_ON' | 'APPEALS';

export type BondType = 'TRIGGERS' | 'FEEDS' | 'BLOCKS';

export type LifecycleType = 'DISCRETE' | 'RECURRING';

export type OutputType = 'DECISION' | 'ATTESTATION' | 'CLOSURE';

export interface GovernanceActorIdentity {
  actor_id: string;
  role: string;
  verification_method: 'PLATFORM_AUTH' | 'DELEGATED' | 'ATTESTED';
  delegation_chain?: string[];
}

export interface CommitmentSubmission {
  cp_id: string;
  context_id: string;
  commitment_text: string;
  evidence_entries: EvidenceEntry[];
  actor_id: string;
  actor_identity: GovernanceActorIdentity;
  reasoning: string;
  proposed_outcome: string;
  dry_run: boolean;
}

export interface EvidenceEntry {
  definition_id: string;
  content: unknown;
  source: string;
}

export interface GateResult {
  gate_type: GateType;
  passed: boolean;
  details: Record<string, unknown>;
}

export interface Receipt {
  receipt_id: string;
  cp_id: string;
  context_id: string;
  outcome_token: string;
  gate_results: GateResult[];
  blocked_gates: GateType[];
  evidence_refs: string[];
  previous_hash: string;
  content_hash: string;
  timestamp: string;
  dry_run: boolean;
}

export interface ValidationCode {
  code: string;
  severity: 'BLOCK' | 'WARN';
  message: string;
  cp_id?: string;
  spec_ref?: string;
}
