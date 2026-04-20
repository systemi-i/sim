# GOVERNANCE-MODE-UI.md
## Sim UI Architecture Analysis — Governance Protocol Mode

> **Purpose:** Brief the UI implementation team on the existing architecture before building governance protocol mode. All paths are relative to `apps/sim/`.

---

## Table of Contents

1. [Codebase Overview](#1-codebase-overview)
2. [Workflow Editor Canvas](#2-workflow-editor-canvas)
3. [WorkflowBlock Component](#3-workflowblock-component)
4. [WorkflowEdge Component](#4-workflowedge-component)
5. [WorkflowControls Component](#5-workflowcontrols-component)
6. [Panel Editor](#6-panel-editor)
7. [Sub-Block Types → UI Component Map](#7-sub-block-types--ui-component-map)
8. [Block Menu (Context Menu)](#8-block-menu-context-menu)
9. [Canvas Menu (Pane Context Menu)](#9-canvas-menu-pane-context-menu)
10. [Toolbar (Add-Block Menu)](#10-toolbar-add-block-menu)
11. [Subflows (Loop & Parallel)](#11-subflows-loop--parallel)
12. [Zustand Stores](#12-zustand-stores)
13. [Custom Hooks](#13-custom-hooks)
14. [Design System](#14-design-system)
15. [Block Definition System](#15-block-definition-system)
16. [Governance Mode UI Implications](#16-governance-mode-ui-implications)

---

## 1. Codebase Overview

```
apps/sim/
├── app/workspace/[workspaceId]/w/[workflowId]/   ← Workflow editor (main subject)
│   ├── workflow.tsx                               ← Root canvas component
│   ├── components/                               ← All canvas-level UI components
│   ├── hooks/                                    ← Canvas-level hooks
│   └── utils/                                    ← Canvas utilities
├── stores/                                       ← Zustand global state
│   ├── workflows/workflow/store.ts               ← Primary workflow store
│   ├── workflows/registry/store.ts               ← Multi-workflow manager
│   ├── workflows/subblock/store.ts               ← Sub-block values
│   ├── execution/store.ts                        ← Run-time execution state
│   ├── panel/store.ts                            ← Panel width/tab state
│   ├── panel/editor/store.ts                     ← Selected block state
│   ├── canvas-mode/store.ts                      ← Hand/cursor mode
│   └── ...                                       ← (see §12)
├── blocks/                                       ← Block type definitions
│   ├── types.ts                                  ← SubBlockType, BlockConfig, etc.
│   └── registry.ts                               ← Central block registry
└── components/emcn/                              ← Design system (emcn)
```

**Technology stack:** React 18 + Next.js 14 (App Router), ReactFlow v11, Zustand 4, Tailwind CSS, TypeScript.

---

## 2. Workflow Editor Canvas

**File:** `app/workspace/[workspaceId]/w/[workflowId]/workflow.tsx`

The root canvas component. Wraps everything in `<ReactFlowProvider>` + custom `<ErrorBoundary>`.

### `WorkflowContent` component (inner, ~2500 lines)

**Props:**
```ts
interface WorkflowContentProps {
  workspaceId?: string
  workflowId?: string
  embedded?: boolean   // embeds canvas without sidebar/panel (read-only preview)
  sandbox?: boolean    // sim-academy mode: full edit, no API calls
}
```

**Registered ReactFlow node types:**
| ReactFlow type | Component | Used for |
|---|---|---|
| `workflowBlock` | `WorkflowBlock` | All regular blocks |
| `noteBlock` | `NoteBlock` | Sticky-note annotations |
| `subflowNode` | `SubflowNodeComponent` | Loop/parallel containers |

**Registered ReactFlow edge types:**
| ReactFlow type | Component |
|---|---|
| `default` / `workflowEdge` | `WorkflowEdge` |

**Key stores consumed at canvas level:**
- `useWorkflowStore` — blocks, edges, positions
- `useWorkflowRegistry` — hydration, active workflow, clipboard
- `useExecutionStore` — activeBlockIds, isExecuting, isDebugging
- `usePanelEditorStore` — selected block (drives panel)
- `useCanvasModeStore` — hand/cursor mode
- `useUndoRedoStore` — undo/redo stack
- `useNotificationStore` — toast notifications
- `useVariablesModalStore` — variables panel open state
- `useChatStore` — chat panel open state
- `useWorkflowDiffStore` — diff/snapshot mode

**Key canvas-level interactions:**
- **Drag-and-drop** from toolbar: `onDrop`, `handleToolbarDrop`
- **Node dragging** with container reparenting: `onNodeDrag`, `onNodeDragStop`
- **Edge connection**: `onConnect`, `onConnectStart`, `onConnectEnd` (supports drop-on-body)
- **Selection** with parent-child conflict resolution: `onNodesChange`, `handleNodeClick`
- **Keyboard shortcuts**: Ctrl+C/V copy-paste, Ctrl+Z/Shift+Z undo/redo, Del/Backspace delete, Shift+L auto-layout
- **Context menus**: right-click on pane → `CanvasMenu`, right-click on block(s) → `BlockMenu`
- **Auto-connect**: when dropping a block, automatically creates edge from nearest eligible source

**Node derivation (blocks → ReactFlow nodes):**
`derivedNodes` memo transforms `blocks` (store) into ReactFlow `Node[]`. Key mappings:
- `loop` / `parallel` block types → `subflowNode` ReactFlow type
- `note` → `noteBlock` ReactFlow type
- Everything else → `workflowBlock` ReactFlow type
- Block `data` carries: `type`, `config` (BlockConfig), `name`, `isActive`, `isPending`, `isEmbedded`, `isSandbox`
- Structural hash prevents node recreation during pure position changes (drag performance)

---

## 3. WorkflowBlock Component

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/workflow-block.tsx`

The single most complex component (~1600+ lines). Renders every regular block on the canvas.

**Props (from ReactFlow `NodeProps`):**
```ts
interface WorkflowBlockProps {
  data: {
    type: string            // block type id (e.g. 'agent', 'condition', 'router_v2')
    config: BlockConfig     // full block config from registry
    name: string
    isActive: boolean       // currently executing
    isPending: boolean      // next to execute in debug mode
    isEmbedded?: boolean
    isSandbox?: boolean
  }
  id: string               // block id
  selected: boolean
}
```

**Stores read:**
- `useWorkflowStore` — block state, edges, loops/parallels
- `useSubBlockStore` — sub-block values
- `usePanelEditorStore` — whether this block is "focused" (panel open)
- `useExecutionStore` — last run path/status per block
- `useVariablesStore` — for variable reference display
- Various query hooks for live data: `useCredentialName`, `useScheduleInfo`, `useWorkflowMap`, `useSkills`, `useMcpServers`, `useKnowledgeBase`, `useTablesList`

**Key internal hooks:**
| Hook | File | Purpose |
|---|---|---|
| `useBlockProperties` | `hooks/use-block-properties.ts` | Extracts all displayable block property lines |
| `useBlockState` | `hooks/use-block-state.ts` | Enabled/disabled/locked status |
| `useChildWorkflow` | `hooks/use-child-workflow.ts` | Sub-workflow preview for workflow blocks |
| `useWebhookInfo` | `hooks/use-webhook-info.ts` | Webhook URL display for trigger blocks |
| `useBlockDimensions` | `../hooks/use-block-dimensions.ts` | Deterministic height based on visible sub-blocks |
| `useBlockVisual` | `../hooks/use-block-visual.ts` | Icon, color, border states |

**What it renders (rough anatomy):**
1. **Outer container** — `workflow-drag-handle` class for drag, focus ring, diff highlighting, lock/disabled overlays
2. **Header** — block icon (colored), name (editable inline on rename), enabled toggle badge, execution status badge
3. **Sub-block previews** — a condensed read-only view of the block's key configured values (uses `useBlockProperties` to resolve displayed text)
4. **ActionBar** — hover-revealed row of action buttons (run, edit, duplicate, delete, etc.) — file: `components/action-bar/action-bar.tsx`
5. **ReactFlow Handles** — source/target connection points; dynamic for condition rows and router routes
6. **Webhook info** — displays endpoint URL for trigger blocks when configured

**Sub-block visibility logic:**
`workflow-block.tsx` uses `evaluateSubBlockCondition`, `isSubBlockHidden`, `isSubBlockVisibleForMode`, `isSubBlockFeatureEnabled` from `lib/workflows/subblocks/visibility.ts` to decide which sub-blocks appear in the preview.

---

## 4. WorkflowEdge Component

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/workflow-edge/workflow-edge.tsx`

**Props (from ReactFlow edge `data`):**
```ts
{
  isSelected: boolean
  isInsideLoop: boolean
  parentLoopId?: string
  sourceHandle: string
  onDelete: (edgeId: string) => void
  isDeleted?: boolean       // shown in diff view
}
```

Renders a smooth-step SVG path with:
- Delete button (×) on hover/select
- Colour coding: error handle edges in `var(--text-error)`, normal in `var(--workflow-edge)`
- Diff-mode "deleted" styling

---

## 5. WorkflowControls Component

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/workflow-controls/workflow-controls.tsx`

Floating bottom-left toolbar overlay.

**Stores read:** `useCanvasModeStore`, `useUndoRedoStore`, `useWorkflowRegistry`, `useCollaborativeWorkflow`

**Renders:**
- **Canvas mode selector** — Hand (pan) / Cursor (pointer/select) toggle
- **Undo / Redo** — buttons + ⌘Z / ⌘⇧Z labels
- **Fit to view** — ⌘⇧F
- Right-click context menu → "Hide canvas controls"

---

## 6. Panel Editor

### 6.1 Panel container

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/panel/panel.tsx`

A right-side resizable panel. Persists width via `usePanelStore`.

**Tabs:**
| Tab ID | Component | Purpose |
|---|---|---|
| `editor` | `Editor` | Sub-block editor for selected block |
| `toolbar` | `Toolbar` | Block picker / add-block list |
| `copilot` | `Copilot` | AI assistant |
| `deploy` | `Deploy` | Deployment options |

**Tab switching:** Clicking a block on canvas calls `usePanelEditorStore.setCurrentBlockId(id)` which automatically switches to the `editor` tab.

**Stores read:** `usePanelStore`, `usePanelEditorStore`, `useWorkflowRegistry`, `useWorkflowStore`, `useChatStore`, `useVariablesModalStore`, `useWorkflowDiffStore`

### 6.2 Editor component

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/editor.tsx`

Renders all configurable fields for the selected block.

**Sub-block layout determined by:**
- `useEditorSubblockLayout` hook — splits sub-blocks into sections (basic, advanced, trigger)
- Canonical pair system — some sub-blocks are paired (basic/advanced toggle, e.g. model selector)
- `evaluateSubBlockCondition` — conditional visibility based on sibling values
- Block lock state → all inputs `disabled`

**Sub-block rendering → `SubBlock` component:**
`app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/sub-block/`

`SubBlock` receives a `SubBlockConfig` and dispatches to the correct leaf component via the type map.

**How changes propagate to the store:**
All sub-block inputs write through `useSubBlockValue` hook → `useSubBlockStore.setSubBlockValue(blockId, subBlockId, value)`. The subblock store is the live edit layer; it gets merged into `WorkflowState` on serialization/execution.

### 6.3 Connection blocks

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/connection-blocks/`

Shows incoming/outgoing block connections in the bottom pane of the editor, with resizable height. Lets users reference outputs of upstream blocks.

### 6.4 Subflow editor

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/subflow-editor/`

Renders configuration for loop/parallel container blocks (loop type, iteration count, forEach collection, while condition, etc.).

---

## 7. Sub-Block Types → UI Component Map

Every block's fields are typed via `SubBlockType` (`blocks/types.ts`). The `SubBlock` dispatcher routes each type to a component in:

`app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/sub-block/components/`

| `SubBlockType` | Component directory/file | Notes |
|---|---|---|
| `short-input` | `short-input/` | Single-line text, with `SubBlockInputController` for env-var / tag popovers |
| `long-input` | `long-input/` | Multi-line textarea, same controller |
| `dropdown` | `dropdown/dropdown.tsx` | Single/multi-select via `Combobox`; supports async fetch, `dependsOn` refetch |
| `combobox` | `combobox/` | Searchable free-text + options |
| `slider` | `slider-input/` | Range slider with min/max |
| `table` | `table/` | Editable grid (rows × columns) |
| `code` | `code/` | Monaco/CodeMirror code editor |
| `switch` | `switch/` | Boolean toggle |
| `tool-input` | `tool-input/` | Tool selection for agent blocks (custom tools, MCP) |
| `skill-input` | `skill-input/` | Skill library selection |
| `checkbox-list` | `checkbox-list/` | Multi-select checkboxes |
| `grouped-checkbox-list` | `grouped-checkbox-list/` | Grouped scrollable checkboxes with select-all |
| `condition-input` | `condition-input/` | Condition rows (if/else-if/else branches) |
| `eval-input` | `eval-input/` | Evaluator scoring rows |
| `time-input` | `time-input/` | Time picker |
| `oauth-input` | `credential-selector/` | OAuth provider selector |
| `webhook-config` | (inline in editor) | Webhook trigger config |
| `schedule-info` | `schedule-info/` | Next-run display |
| `file-selector` | `selector-input/` | Google Drive etc. |
| `sheet-selector` | `selector-combobox/` | Sheet/tab picker |
| `project-selector` | `selector-input/` | Jira, Discord, etc. |
| `channel-selector` | `selector-input/` | Slack, Discord channels |
| `user-selector` | `selector-input/` | User pickers |
| `folder-selector` | `selector-input/` | Gmail folder picker |
| `knowledge-base-selector` | `knowledge-base-selector/` | KB selection |
| `knowledge-tag-filters` | `knowledge-tag-filters/` | Tag filter chips |
| `document-tag-entry` | `document-tag-entry/` | Tag entry for KB docs |
| `mcp-server-selector` | (selector-combobox variant) | MCP server picker |
| `mcp-tool-selector` | (selector-combobox variant) | MCP tool picker |
| `mcp-dynamic-args` | `mcp-dynamic-args/` | Dynamic args from tool schema |
| `input-format` | `starter/` | Workflow input schema builder |
| `response-format` | `response/` | Workflow output schema builder |
| `filter-builder` | `filter-builder/` | Filter condition rows |
| `sort-builder` | `sort-builder/` | Sort condition rows |
| `file-upload` | `file-upload/` | File uploader |
| `input-mapping` | `input-mapping/` | Parent → child workflow variable mapping |
| `variables-input` | `variables-input/` | Variable assignment |
| `messages-input` | `messages-input/` | LLM message history rows |
| `workflow-selector` | `workflow-selector/` | Pick a workflow (for agent tools) |
| `text` | `text/` | Read-only display text |
| `router-input` | (inline) | Router route definitions |
| `table-selector` | `table-selector/` | Table picker |

### How `SubBlockInputController` works

`sub-block/components/sub-block-input-controller.tsx` — a headless controller that:
1. Mounts env-var and tag popovers over any text input
2. Exposes a render-prop (`children`) with `ref`, `value`, `onChange`, `onKeyDown`, `onDrop`, `onFocus` already wired
3. Reads/writes through `useSubBlockValue` → `useSubBlockStore`

### Validation

There is **no Zod/form-level validation** at the panel layer. Constraints are enforced at execution time in the serializer/executor. `required` fields in `SubBlockConfig` drive a missing-value indicator in the editor but do not block saving.

For governance blocks, custom validation logic would sit in:
- `lib/workflows/subblocks/visibility.ts` — for show/hide conditions
- Block-level executor handler — for runtime invariant checks
- Optionally a new `validateGovernanceBlock()` function called before execution

---

## 8. Block Menu (Context Menu)

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/block-menu/block-menu.tsx`

Right-click context menu over one or more selected blocks. This is a **pure presentation component** — all action callbacks come from `workflow.tsx`.

**Props:**
```ts
{
  isOpen: boolean
  position: { x: number; y: number }
  menuRef: RefObject<HTMLDivElement>
  onClose: () => void
  selectedBlocks: BlockInfo[]         // multi-selection supported
  onCopy, onPaste, onDuplicate, onDelete
  onToggleEnabled, onToggleHandles
  onRemoveFromSubflow
  onOpenEditor, onRename
  onRunFromBlock?, onRunUntilBlock?
  hasClipboard?: boolean
  showRemoveFromSubflow?: boolean
  canRunFromBlock?: boolean
  disableEdit?: boolean
  userCanEdit?: boolean
  isExecuting?: boolean
  isPositionalTrigger?: boolean
  onToggleLocked?: () => void
  canAdmin?: boolean
}
```

**Rendered items (conditional):** Copy, Paste, Duplicate | Disable/Enable, Flip Handles, Remove from Subflow, Lock/Unlock | Rename, Open Editor | Run from block, Run until block | Delete

Uses `Popover` + `PopoverItem` from the `emcn` design system. Anchors at fixed screen position via `PopoverAnchor`.

**Governance implications:** Add "Configure Gate" or "View Evidence" menu items here for governance blocks. The trigger is `useCanvasContextMenu` hook which exposes `selectedBlocks`, so governance-specific items can be conditioned on `block.type === 'gate'` etc.

---

## 9. Canvas Menu (Pane Context Menu)

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/canvas-menu/canvas-menu.tsx`

Right-click on empty canvas area. Same `Popover`-anchored pattern.

**Props:**
```ts
{
  isOpen, position, menuRef, onClose
  onUndo, onRedo, onPaste, onAddBlock
  onAutoLayout, onFitToView
  onOpenLogs, onToggleVariables, onToggleChat
  isVariablesOpen, isChatOpen
  hasClipboard, disableEdit, canUndo, canRedo
  hasLockedBlocks, onToggleWorkflowLock, allBlocksLocked
  canAdmin, hasBlocks
}
```

Governance implications: Add "Add Governance Block" or "Configure Protocol" shortcut here if desired.

---

## 10. Toolbar (Add-Block Menu)

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/toolbar/toolbar.tsx`

The right-panel tab (tab ID: `toolbar`) that lists all available blocks. Acts as both a drag source (drag to canvas) and a click-to-add source.

**Block data sourced from:**
- `getBlocksForSidebar()` from `lib/workflows/triggers/trigger-utils.ts` — returns all non-trigger blocks grouped by `IntegrationTag`
- `getTriggersForSidebar()` — returns trigger-only blocks
- `LoopTool` and `ParallelTool` — synthetic entries for loop/parallel containers
- `useSandboxBlockConstraints()` — filters in sandbox mode

**Search/filter implementation:**
```ts
const filteredItems = useMemo(() => {
  const query = searchQuery.toLowerCase()
  return items.filter(item =>
    item.name.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query)
  )
}, [items, searchQuery])
```

**Categories:** The toolbar renders two tabs: "Blocks" (integration blocks) and "Triggers". Within each tab, blocks are grouped by `IntegrationTag` (e.g., `ai`, `communication`, `databases`, etc.).

**Item interaction hook:** `useToolbarItemInteractions` handles:
- **Click** → dispatches `CustomEvent('add-block-from-toolbar', { type, enableTriggerMode, presetOperation })`
- **Drag start** → sets `dataTransfer` with `application/json: { type, enableTriggerMode }`, creates custom drag preview via `drag-preview.ts`
- **Context menu** → `ToolbarItemContextMenu` (opens docs link, etc.)

**Adding a governance block to the toolbar:**
1. Register the block in `blocks/registry.ts`
2. Define `BlockConfig` with `category: 'blocks'` and appropriate `integrationType`
3. The block will automatically appear in the toolbar under its integration group. If governance blocks should be grouped together, add a new `IntegrationTag` value (e.g., `'governance'`).

**Search modal (⌘K):**
`stores/modals/search/store.ts` + component at `app/workspace/.../components/panel/components/toolbar/` — alternative block picker opened via command key. Works the same way.

---

## 11. Subflows (Loop & Parallel)

**File:** `app/workspace/[workspaceId]/w/[workflowId]/components/subflows/subflow-node.tsx`

Both loop and parallel containers render as `SubflowNodeComponent`. Distinction is in `data.kind: 'loop' | 'parallel'`.

**Node data:**
```ts
interface SubflowNodeData {
  width?: number
  height?: number
  parentId?: string
  kind: 'loop' | 'parallel'
  name?: string
  executionStatus?: 'success' | 'error' | 'not-executed'
}
```

**Handles:**
- Source handle: `loop-start-source` / `parallel-start-source` (left-side, connects into the container's first child)
- Source handle: `loop-end-source` / `parallel-end-source` (right-side, connects out of the container)
- Target handle: `target` (left entry)

**Stores read:** `usePanelEditorStore` (focus state), `useCurrentWorkflow` (block state, enabled/locked), `useLastRunPath` (execution colouring)

**Config editors:**
- `components/subflows/loop/loop-config.ts` — exports `LoopTool` config (shown in panel Subflow Editor)
- `components/subflows/parallel/parallel-config.ts` — exports `ParallelTool` config

A governance "gate" or "checkpoint" container could follow the same pattern.

---

## 12. Zustand Stores

All stores live in `stores/`. Here is the complete inventory:

### 12.1 Workflow Store (`stores/workflows/workflow/store.ts`)

**The primary source of truth for the active workflow.**

```ts
interface WorkflowState {
  currentWorkflowId: string | null
  blocks: Record<string, BlockState>
  edges: Edge[]
  loops: Record<string, Loop>
  parallels: Record<string, Parallel>
  lastSaved?: number
  variables?: Record<string, Variable>
  dragStartPosition?: DragStartPosition | null
}
```

**Key `BlockState` shape:**
```ts
interface BlockState {
  id: string
  type: string
  name: string
  position: { x: number; y: number }
  subBlocks: Record<string, SubBlockState>  // values stored in subblock store, not here
  outputs: Record<string, OutputFieldDefinition>
  enabled: boolean
  horizontalHandles?: boolean
  height?: number
  advancedMode?: boolean
  triggerMode?: boolean
  data?: BlockData          // parentId, width, height, loopType, etc.
  locked?: boolean
}
```

**Key actions:**
- `batchAddBlocks(blocks, edges?, subBlockValues?, options?)` — atomic add
- `batchRemoveBlocks(ids[])` — cascade deletes edges
- `batchUpdatePositions(updates[])` — position sync
- `batchToggleLocked(ids[])`, `batchToggleEnabled(ids[])`
- `updateBlockName(id, name)` — also updates cross-block references
- `replaceWorkflowState(state)` — full hydration
- `getWorkflowState()` — snapshot for execution

**Selectors available:**
Use `useWorkflowStore(selector)` with `useShallow` for slice subscriptions. Common patterns:
```ts
const blocks = useWorkflowStore(s => s.blocks)
const { blocks, edges } = useWorkflowStore(useShallow(s => ({ blocks: s.blocks, edges: s.edges })))
```

### 12.2 Workflow Registry (`stores/workflows/registry/store.ts`)

Manages which workflow is active, hydration lifecycle, clipboard, and multi-workflow navigation.

```ts
interface WorkflowRegistry {
  activeWorkflowId: string | null
  hydration: HydrationState   // phase: 'idle'|'state-loading'|'ready'|'error'
  clipboard: ClipboardState | null
  pendingSelection: string[] | null

  setActiveWorkflow(workflowId: string): Promise<void>
  copyBlocks(ids: string[]): void
  preparePasteData(offset): PasteData | null
  hasClipboard(): boolean
}
```

### 12.3 SubBlock Store (`stores/workflows/subblock/store.ts`)

Live edit layer for sub-block values, keyed by `workflowId → blockId → subBlockId`.

```ts
interface SubBlockStore {
  workflowValues: Record<string, Record<string, Record<string, unknown>>>
  setSubBlockValue(workflowId, blockId, subBlockId, value): void
  getSubBlockValue(workflowId, blockId, subBlockId): unknown
}
```

On execution, `mergeSubblockState(blocks, workflowId)` merges this store into `BlockState.subBlocks`.

### 12.4 Execution Store (`stores/execution/store.ts`)

Per-workflow execution state (uses `Map` keyed by workflow ID for concurrent runs).

```ts
interface WorkflowExecutionState {
  isExecuting: boolean
  isDebugging: boolean
  activeBlockIds: Set<string>     // blocks currently running (highlighted in canvas)
  pendingBlocks: string[]         // next blocks in debug mode
  lastRunPath: Map<string, BlockRunStatus>  // per-block run status
  lastRunEdges: Map<string, EdgeRunStatus>
  executor: Executor | null
  debugContext: DebugContext | null
}
```

**Key actions:** `setActiveBlocks`, `setBlockRunStatus`, `setEdgeRunStatus`, `setIsExecuting`, `setIsDebugging`, `setLastExecutionSnapshot`, `getLastExecutionSnapshot`

**Selectors:**
```ts
const { activeBlockIds, isExecuting } = useExecutionStore(useShallow(s => {
  const wf = s.workflowExecutions.get(activeWorkflowId)
  return { activeBlockIds: wf?.activeBlockIds ?? new Set(), isExecuting: wf?.isExecuting ?? false }
}))
```

### 12.5 Panel Store (`stores/panel/store.ts`)

```ts
// Persisted via localStorage
interface PanelState {
  panelWidth: number
  activeTab: PanelTab   // 'editor' | 'toolbar' | 'copilot' | 'deploy'
  isResizing: boolean
}
```

### 12.6 Panel Editor Store (`stores/panel/editor/store.ts`)

```ts
// Persisted
interface PanelEditorState {
  currentBlockId: string | null
  connectionsHeight: number
  setCurrentBlockId(id: string | null): void
  clearCurrentBlock(): void
  triggerRename(): void   // triggers inline rename mode on the canvas block
}
```

**This is the bridge between canvas selection and panel display.** Setting `currentBlockId` automatically switches the panel to the `editor` tab.

### 12.7 Canvas Mode Store (`stores/canvas-mode/store.ts`)

```ts
// Persisted
{ mode: 'hand' | 'cursor', setMode }
```

### 12.8 Variables Store (`stores/variables/store.ts`)

Workflow variables (global key-value state accessible within execution).

### 12.9 Undo/Redo Store (`stores/undo-redo/store.ts`)

Stacks keyed by `workflowId:userId`. Collaboratively safe.

### 12.10 Terminal/Console Store (`stores/terminal/console/store.ts`)

Execution log entries for the bottom terminal panel.

### 12.11 Notification Store (`stores/notifications/store.ts`)

Canvas-level toast notifications (not browser toasts).

### 12.12 Workflow Diff Store (`stores/workflow-diff/store.ts`)

Manages AI-proposed diff overlays (Copilot suggestions).

### 12.13 Other Stores

| Store | File | Purpose |
|---|---|---|
| `useChatStore` | `stores/chat/store.ts` | Chat widget state |
| `useSearchModalStore` | `stores/modals/search/store.ts` | ⌘K block search |
| `useFoldersStore` | `stores/folders/store.ts` | Workflow folder tree |
| `useSidebarStore` | `stores/sidebar/store.ts` | Sidebar collapsed state |
| `useUndoRedoStore` | `stores/undo-redo/store.ts` | Undo/redo stacks |
| `useLogsFilterStore` | `stores/logs/filters/store.ts` | Execution logs filter |
| `useVariablesModalStore` | `stores/variables/modal.ts` | Variables panel open state |
| `useToolbarStore` | `stores/panel/toolbar/index.ts` | Toolbar expanded state |

---

## 13. Custom Hooks

All in `app/workspace/[workspaceId]/w/[workflowId]/hooks/`:

### `useWorkflowExecution` (`use-workflow-execution.ts`)
The execution engine hook. Manages `handleRunWorkflow`, `handleRunFromBlock`, `handleRunUntilBlock`, `handleCancelExecution`, debug step/resume/cancel. Connects to server via SSE (`useExecutionStream`).

### `useAutoLayout` (`use-auto-layout.ts`)
Applies ELK-based auto-layout to workflow nodes then animates fitView. Called on Shift+L.

### `useNodeUtilities` (`use-node-utilities.ts`)
Provides geometric utilities: `getNodeAbsolutePosition`, `getNodeDepth`, `isDescendantOf`, `calculateRelativePosition`, `isPointInLoopNode`, `resizeLoopNodes`, `getNodeAnchorPosition`, `getBlockDimensions`.

### `useCanvasContextMenu` (`use-canvas-context-menu.ts`)
Handles right-click on nodes/pane/selection. Returns `isBlockMenuOpen`, `isPaneMenuOpen`, `position`, `selectedBlocks`, open/close callbacks.

### `useCurrentWorkflow` (`use-current-workflow.ts`)
Returns a view of the active workflow with derived helpers: `getBlockById`, `isDiffMode`, `isSnapshotView`, etc.

### `useAutoConnect` (from `hooks/queries/general-settings`)
Returns boolean whether auto-connect is enabled (user setting).

### `useBlockDimensions` (`use-block-dimensions.ts`)
Computes deterministic block height from visible sub-blocks. Used to set ReactFlow node dimensions without measuring DOM.

### `useBlockVisual` (`use-block-visual.ts`)
Returns icon component, background colour, border classes for a block type.

### `useDynamicHandleRefresh` (`use-dynamic-handle-refresh.ts`)
Calls `updateNodeInternals` for nodes whose handle count changes (condition rows, router routes).

### `useShiftSelectionLock` (`use-shift-selection-lock.ts`)
Manages `panOnDrag` / `selectionOnDrag` mode switching based on Shift key state.

### `useScrollManagement` (`use-scroll-management.ts`)
Prevents canvas scroll from propagating to page.

### `float/` hooks
Additional floating-panel layout utilities.

---

## 14. Design System

### 14.1 Component Library (`components/emcn/`)

The project uses a custom in-house component library called **emcn** (Radix UI + Tailwind CSS based). All primitive UI components live here.

**Primitive components available:**
| Component | Import |
|---|---|
| `Button` | `@/components/emcn` |
| `Badge` | `@/components/emcn` |
| `Combobox` | `@/components/emcn` |
| `Dropdown Menu` | `@/components/emcn` |
| `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter` | `@/components/emcn` |
| `SModal` (sidebar modal) | `@/components/emcn` |
| `Popover`, `PopoverItem`, `PopoverContent`, `PopoverSection`, `PopoverDivider` | `@/components/emcn` |
| `Tooltip` | `@/components/emcn` |
| `Input`, `Textarea` | `@/components/emcn` |
| `Checkbox` | `@/components/emcn` |
| `Switch` | `@/components/emcn` |
| `Slider` | `@/components/emcn` |
| `Code` (code editor) | `@/components/emcn` |
| `Table`, `TableRow`, `TableCell`, etc. | `@/components/emcn` |
| `TagInput` | `@/components/emcn` |
| `DatePicker`, `TimePicker` | `@/components/emcn` |
| `Skeleton` | `@/components/emcn` |
| `Toast` (via `useToast`) | `@/components/emcn` |
| `Avatar` | `@/components/emcn` |
| `FormField` | `@/components/emcn` |
| `Banner` | `@/components/emcn` |
| `Expandable` | `@/components/emcn` |
| `ButtonGroup` | `@/components/emcn` |

### 14.2 Icon System

**Emcn icons** (`components/emcn/icons/`): Custom SVG icons exported as React components. Examples: `Arrow`, `Bell`, `Check`, `ChevronDown`, `Cursor`, `Hand`, `Lock`, `Unlock`, `Play`, `Redo`, `Undo`, `Upload`, `Trash`, `Copy`, `Plus`, `MoreHorizontal`, `BubbleChatClose`, etc.

**Lucide icons** (`lucide-react`): Used extensively for standard iconography. Block icons are typically custom SVG components defined alongside each block config.

**Block icons:** Each `BlockConfig` defines an `icon: BlockIcon` which is a SVG component `(props: SVGProps<SVGSVGElement>) => JSX.Element`. These are rendered in the toolbar, block header, and panels.

**Usage pattern:**
```tsx
import { Hand, Lock, Play } from '@/components/emcn'
import { Search, Scan } from 'lucide-react'
// Block-specific icon:
const { icon: Icon } = blockConfig
<Icon className="h-4 w-4" />
```

### 14.3 Color / Theme System

CSS custom properties on `:root` / `.dark`. Key tokens used in workflow UI:

| Token | Usage |
|---|---|
| `--bg` | Canvas background |
| `--surface-1`, `--surface-2`, `--surface-5` | Panel/popover surfaces |
| `--border` | Block borders, dividers |
| `--workflow-edge` | Edge stroke colour |
| `--text-error` | Error handle / error badge |
| `--text-muted`, `--text-secondary` | Muted labels |
| `--muted-foreground` | Loading spinners |

Block header background colours come from `BlockConfig.bgColor` (e.g. `#6366f1` for agent). These are Tailwind arbitrary values or CSS variables applied inline.

### 14.4 Styling Conventions

- **Tailwind utility classes** — primary styling approach
- `cn()` from `lib/core/utils/cn` — conditional class merging (clsx + tailwind-merge)
- **CSS variables** — for theme-able values (see above)
- **`hover-hover:`** — custom Tailwind variant for pointer devices only (prevents sticky hover on touch)

---

## 15. Block Definition System

**Files:** `blocks/types.ts`, `blocks/registry.ts`, `blocks/blocks/*.ts`

### BlockConfig structure

```ts
interface BlockConfig {
  type: string            // unique type id
  name: string            // display name
  description?: string
  longDescription?: string
  category: BlockCategory // 'blocks' | 'tools' | 'triggers'
  bgColor: string
  icon: BlockIcon
  subBlocks: SubBlockConfig[]
  outputs: OutputConfig[]
  docsLink?: string
  // Trigger-specific:
  triggers?: {
    enabled: boolean      // can be used as trigger
    available: TriggerType[]
  }
  // Single-instance constraint:
  singleInstance?: boolean
  // Integration grouping:
  integrationType?: IntegrationTag
}
```

### SubBlockConfig key fields

```ts
interface SubBlockConfig {
  id: string
  title?: string
  type: SubBlockType
  mode?: 'basic' | 'advanced' | 'both' | 'trigger' | 'trigger-advanced'
  required?: boolean | ConditionalRequired
  defaultValue?: unknown
  options?: DropdownOption[] | (() => DropdownOption[])
  condition?: VisibilityCondition  // show/hide based on sibling value
  placeholder?: string
  hidden?: boolean
  tooltip?: string
  value?: (params: Record<string, any>) => string  // computed default
  dependsOn?: SubBlockConfig['id'][]   // refetch on change
  // ... (type-specific fields: min, max, columns, etc.)
}
```

### Registry

`blocks/registry.ts` exports `getBlock(type: string): BlockConfig | undefined`. All blocks are registered at module load.

To add a governance block: create `blocks/blocks/governance_gate.ts` (or similar) and add it to the registry import list.

---

## 16. Governance Mode UI Implications

### 16.1 Canvas Nodes (WorkflowBlock / new node type)

**Reuse:**
- `WorkflowBlock` as-is — governance blocks can be standard blocks with a distinctive `bgColor` and icon
- `BlockState`, `SubBlockState` types — fully compatible with any new block type
- Execution state highlighting (active/pending/success/error) — automatic via `activeBlockIds`

**New components needed:**
- Optionally a new ReactFlow node type (e.g., `governanceBlock`) if governance nodes need a distinct visual shape (e.g., diamond/hexagon gate). Add to `nodeTypes` in `workflow.tsx`.
- **Gate status overlay** — showing `APPROVED / REJECTED / PENDING` as a badge on the canvas node. Can be done by extending `WorkflowBlock` via `data.governanceStatus` or an `isGovernanceNode` flag checked in the render path.

**Where to add new node type:**
```ts
// workflow.tsx
const nodeTypes: NodeTypes = {
  workflowBlock: WorkflowBlock,
  noteBlock: NoteBlock,
  subflowNode: SubflowNodeComponent,
  governanceGate: GovernanceGate,   // ← ADD HERE
}
```

### 16.2 Panel Sub-Blocks

**Reuse:**
All existing sub-block types are available. For governance blocks:

| Need | Recommended SubBlockType | Notes |
|---|---|---|
| Select gate type (manual / automated / threshold) | `dropdown` | Static options |
| Evidence definition (name + type rows) | `table` | Existing table component |
| Approval policy script | `code` | JS/JSON |
| Pass/fail threshold value | `slider` or `short-input` | |
| Approver user selector | `user-selector` | Needs backend selector |
| Reviewer notes / description | `long-input` | |
| CP (Checkpoint) type selector | `dropdown` with custom options | |
| Evidence attachment | `file-upload` | |
| Required fields toggle | `checkbox-list` or `switch` | |

**New sub-block types needed (if existing don't fit):**

| Need | New SubBlockType name | Description |
|---|---|---|
| Evidence definition builder | `evidence-definition` | Table-like, but with typed evidence rows (document, screenshot, API response, metric) |
| Approval matrix editor | `approval-matrix` | N approvers × M conditions grid |
| Governance policy editor | `policy-editor` | Rich text + rule builder combo |

New sub-block types require:
1. Add the string to `SubBlockType` union in `blocks/types.ts`
2. Create the React component in `panel/components/editor/components/sub-block/components/<name>/`
3. Add the case to the `SubBlock` dispatcher
4. Handle in `workflow-block.tsx` preview rendering (what shows on the canvas card)

### 16.3 Validation

**For governance blocks, validation can be added at 3 levels:**

1. **Sub-block visibility** (`lib/workflows/subblocks/visibility.ts`):
   ```ts
   // Show "quorum threshold" only when gate type is 'threshold'
   condition: { field: 'gateType', value: 'threshold' }
   ```

2. **Panel-level** (before running): Add a `validateGovernanceConfig(block: BlockState): ValidationResult` function called in the `useWorkflowExecution` hook's `executeWorkflow` path, after `mergeSubblockState`.

3. **Executor-level** (runtime): The block handler in `executor/handlers/` enforces runtime invariants.

### 16.4 Block Menu Extensions

In `block-menu/block-menu.tsx`, add governance-specific items conditioned on block type:
```tsx
{isSingleBlock && isGovernanceBlock && (
  <>
    <PopoverDivider />
    <PopoverItem onClick={onViewEvidence}>View Evidence</PopoverItem>
    <PopoverItem onClick={onOverrideGate}>Override Gate</PopoverItem>
  </>
)}
```
Wire callbacks back through `workflow.tsx` → `useCanvasContextMenu`.

### 16.5 Toolbar

Register governance blocks in the registry with:
```ts
category: 'blocks',
integrationType: 'governance'   // NEW IntegrationTag value
```

Add `'governance'` to the `IntegrationTag` union in `blocks/types.ts`. They will automatically appear in the toolbar under a "Governance" section.

### 16.6 Stores

No new stores needed for basic governance blocks. If governance mode requires UI-level state (e.g., active review session, pending approvals count), create:
```
stores/governance/
├── store.ts    ← governanceSessionId, pendingGates, reviewerContext
├── types.ts
└── index.ts
```
Follow the same Zustand `create()` with `devtools` pattern as other stores.

### 16.7 Subflows / Governance Protocol Container

If "governance protocol mode" introduces a **protocol-level container** (similar to Loop/Parallel) grouping multiple blocks under a compliance boundary:

1. Add `'protocol'` to `SUBFLOW_TYPES` in `stores/workflows/workflow/types.ts`
2. Create `blocks/blocks/governance_protocol.ts` with `type: 'protocol'`
3. Create `components/subflows/protocol/protocol-config.ts`
4. Handle `type === 'protocol'` alongside `loop` / `parallel` in `workflow.tsx` node derivation
5. Add new ReactFlow node type `protocolNode` with its own container renderer

The `SubflowNodeComponent` (`subflows/subflow-node.tsx`) is a good reference — it's ~300 lines and handles all the header, handles, resize, and lock/enable overlays needed for a container node.

### 16.8 Hooks

New hooks to create:
- `useGovernanceBlocks(workflowId)` — returns `blocks` filtered to governance types
- `useGateStatus(blockId)` — real-time gate approval status (via polling or WebSocket)
- `useProtocolValidation(workflowId)` — validates the governance protocol structure before execution

Place in: `app/workspace/[workspaceId]/w/[workflowId]/hooks/`

### 16.9 Where Governance-Specific Validation Would Live

```
lib/
├── workflows/
│   ├── governance/                        ← NEW
│   │   ├── validate-protocol.ts           ← structural validation
│   │   ├── gate-types.ts                  ← gate type definitions
│   │   └── evidence-schema.ts             ← evidence type definitions
│   └── subblocks/visibility.ts            ← add governance condition helpers here
executor/
└── handlers/
    └── governance-gate/                   ← NEW handler
        ├── governance-gate-handler.ts     ← runtime execution
        └── types.ts
```

### 16.10 Summary: Reuse vs New

| Layer | Reuse | New |
|---|---|---|
| Canvas node | `WorkflowBlock` (with new type registration) | Optionally `GovernanceGate` node type for distinct shape |
| Canvas container | `SubflowNodeComponent` pattern | `ProtocolNode` if protocol-level containers are needed |
| Panel sub-blocks | All 40+ existing types | `evidence-definition`, `approval-matrix` if needed |
| Sub-block controller | `SubBlockInputController` as-is | — |
| Block menu | Extend with governance items | "View Evidence", "Override Gate" items |
| Toolbar | Register block → appears automatically | New `'governance'` IntegrationTag |
| Stores | All existing stores sufficient for basic blocks | `stores/governance/` for session-level state |
| Hooks | `useCurrentWorkflow`, `useWorkflowExecution` as-is | `useGateStatus`, `useProtocolValidation` |
| Design system | Full emcn library available | — |
| Validation | Visibility conditions in `SubBlockConfig` | `lib/workflows/governance/validate-protocol.ts` |
| Execution | `executor/` handler pattern | New `governance-gate-handler.ts` |

---

*Generated by Pepe (subagent: sim-arch-ui) · April 2026*
