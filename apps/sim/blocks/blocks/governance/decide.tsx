import type { BlockConfig } from '@/blocks/types'

/**
 * Governance DECIDE Block — Phase A Spike
 * A discretionary institutional decision requiring authority and evidence evaluation.
 */

// Inline icon for spike — proper SVG icon in SIM-04
function DecideIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" fill="#3B82F6" stroke="#2563EB" strokeWidth="1.5"/>
      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export const GovernanceDecideBlock: BlockConfig = {
  type: 'governance_decide',
  name: 'Decide',
  description: 'A discretionary institutional decision requiring authority and evidence evaluation',
  longDescription:
    'Governance commitment point: DECIDE. Represents a binding institutional decision that requires authority verification, evidence evaluation, and produces an enforceable receipt. Connected to Precepto enforcement engine.',
  category: 'blocks',
  bgColor: '#3B82F6',
  icon: DecideIcon,
  subBlocks: [
    // ── Identity ──
    {
      id: 'cp_id',
      title: 'CP ID',
      type: 'short-input',
      placeholder: 'e.g., cp_zoning_review',
      description: 'Unique identifier for this commitment point in the protocol',
    },
    {
      id: 'cp_name',
      title: 'Name',
      type: 'short-input',
      placeholder: 'e.g., Zoning Compliance Review',
    },
    {
      id: 'cp_description',
      title: 'Description',
      type: 'long-input',
      placeholder: 'Describe what this commitment point does...',
    },

    // ── Authority Gate ──
    {
      id: 'authority_header',
      title: 'Authority Gate',
      type: 'text',
      description: 'Who has the authority to make this decision?',
    },
    {
      id: 'authority_model',
      title: 'Authority Model',
      type: 'dropdown',
      options: [
        { label: 'Single', id: 'SINGLE' },
        { label: 'Alternative', id: 'ALTERNATIVE' },
        { label: 'Joint', id: 'JOINT' },
        { label: 'Delegated', id: 'DELEGATED' },
        { label: 'Attribute Determined', id: 'ATTRIBUTE_DETERMINED' },
      ],
    },
    {
      id: 'automation_level',
      title: 'Automation Level',
      type: 'dropdown',
      options: [
        { label: 'Manual', id: 'MANUAL' },
        { label: 'Supervised', id: 'SUPERVISED' },
        { label: 'Assisted', id: 'ASSISTED' },
        { label: 'Automated', id: 'AUTOMATED' },
      ],
    },
    {
      id: 'authority_roles',
      title: 'Required Roles',
      type: 'table',
      columns: ['Role Name'],
    },

    // ── Evidence Gate ──
    {
      id: 'evidence_header',
      title: 'Evidence Gate',
      type: 'text',
      description: 'What evidence is required for this decision?',
    },
    {
      id: 'evidence_requirements',
      title: 'Required Evidence',
      type: 'table',
      columns: ['Name', 'Type', 'Required'],
    },

    // ── Outcomes ──
    {
      id: 'outcomes_header',
      title: 'Outcomes',
      type: 'text',
      description: 'What are the possible outcomes of this decision?',
    },
    {
      id: 'allowed_outcomes',
      title: 'Allowed Outcomes',
      type: 'table',
      columns: ['Token', 'Label'],
    },
    {
      id: 'proposed_outcome',
      title: 'Proposed Outcome',
      type: 'short-input',
      placeholder: 'e.g., APPROVED',
      description: 'The outcome being proposed by the submitting actor or automation',
    },
  ],
  tools: { access: [] },
  inputs: {
    evidence_in: {
      type: 'json',
      description: 'Evidence from upstream automation blocks',
    },
    authority_in: {
      type: 'json',
      description: 'Actor identity from auth/HITL blocks',
    },
    activation: {
      type: 'json',
      description: 'Activation signal from upstream CP receipt',
    },
  },
  outputs: {
    receipt: { type: 'json', description: 'Enforcement receipt from Precepto' },
    outcome_token: { type: 'string', description: 'Decision outcome token' },
    blocked_gates: { type: 'json', description: 'Which gates blocked, if any' },
  },
}
