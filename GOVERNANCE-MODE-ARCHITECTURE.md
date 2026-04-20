# Sim Architecture Analysis: Governance Protocol Mode

> **Purpose:** A thorough architecture map for a team building "governance protocol mode" — a new set of block types for composing institutional governance protocols on top of the Sim workflow engine.
>
> **Codebase root:** `/Users/pepe/sim/`
> **App root:** `apps/sim/` (Next.js 14 app router)

---

## Table of Contents

1. [Block System Architecture](#1-block-system-architecture)
2. [Canvas & Rendering](#2-canvas--rendering)
3. [Execution Engine](#3-execution-engine)
4. [Tool System](#4-tool-system)
5. [Database Schema](#5-database-schema)
6. [State Management](#6-state-management)
7. [Key Integration Points for Governance Mode](#7-key-integration-points-for-governance-mode)

---

## 1. Block System Architecture

### 1.1 The `BlockConfig` Interface
**File:** `apps/sim/blocks/types.ts`

Every block in Sim is a TypeScript object conforming to `BlockConfig<T extends ToolResponse>`. This is the single source of truth for a block's structure, UI, and execution contract.

```typescript
interface BlockConfig<T extends ToolResponse = ToolResponse> {
  type: string                   // Unique key, matches registry key (e.g. 'condition')
  name: string                   // Display name
  description: string            // Short description
  category: BlockCategory        // 'blocks' | 'tools' | 'triggers'
  integrationType?: IntegrationType  // Optional integration category (ai, crm, etc.)
  tags?: IntegrationTag[]        // Optional searchable tags
  longDescription?: string       // Markdown docs for panel
  bestPractices?: string         // Agent-facing guidance
  docsLink?: string              // External docs URL
  bgColor: string                // CSS colour for block header
  icon: BlockIcon                // SVG component (props: SVGProps<SVGSVGElement>)
  subBlocks: SubBlockConfig[]    // Ordered array of UI field definitions
  triggerAllowed?: boolean       // Whether block can be used as trigger
  authMode?: AuthMode            // 'oauth' | 'api_key' | 'bot_token'
  singleInstance?: boolean       // Only one of this block allowed per workflow
  hideFromToolbar?: boolean      // Hidden from block picker (legacy blocks use this)
  tools: {
    access: string[]             // Tool IDs this block can call
    config?: {
      tool: (params) => string   // Dynamic tool selector
      params?: (params) => Record  // Param transformation before tool call
    }
  }
  inputs: Record<string, ParamConfig>      // Block input schema
  outputs: Record<string, OutputFieldDefinition>  // Block output schema
  triggers?: {
    enabled: boolean
    available: string[]          // List of trigger IDs this block supports
  }
}
```

### 1.2 Sub-Block Types
**File:** `apps/sim/blocks/types.ts` — `SubBlockType` union

Sub-blocks are the individual UI fields inside a block panel. Available types:

| Type | Purpose |
|------|---------|
| `short-input` | Single-line text input |
| `long-input` | Multi-line textarea |
| `dropdown` | Select menu with static options |
| `combobox` | Searchable dropdown with text input |
| `slider` | Range slider (min/max/step/integer) |
| `table` | Grid with named columns |
| `code` | Monaco editor (javascript/json/python) |
| `switch` | Toggle button |
| `tool-input` | Tool configuration picker |
| `skill-input` | Skill selection for agent blocks |
| `checkbox-list` | Multi-selection list |
| `grouped-checkbox-list` | Grouped, scrollable checkbox list |
| `condition-input` | Conditional logic builder |
| `eval-input` | Evaluation input |
| `time-input` | Time input |
| `oauth-input` | OAuth credential selector |
| `webhook-config` | Webhook configuration |
| `schedule-info` | Schedule status display |
| `file-selector` | File picker (Drive, etc.) |
| `sheet-selector` | Sheet/tab picker |
| `project-selector` | Project picker |
| `channel-selector` | Slack/Discord channel picker |
| `user-selector` | User picker |
| `folder-selector` | Folder picker |
| `knowledge-base-selector` | Knowledge base picker |
| `knowledge-tag-filters` | Tag filter builder |
| `document-selector` | Document picker |
| `document-tag-entry` | Document tag entry |
| `mcp-server-selector` | MCP server picker |
| `mcp-tool-selector` | MCP tool picker |
| `mcp-dynamic-args` | Dynamic MCP args from tool schema |
| `input-format` | Input structure form builder |
| `response-format` | Response structure form builder |
| `filter-builder` | Filter condition builder |
| `sort-builder` | Sort condition builder |
| `file-upload` | File uploader |
| `input-mapping` | Parent→child workflow variable mapping |
| `variables-input` | Workflow variable assignments |
| `messages-input` | LLM multi-message history input |
| `workflow-selector` | Child workflow picker |
| `workflow-input-mapper` | Dynamic child workflow input mapper |
| `text` | Read-only text display |
| `router-input` | Router route definitions |
| `table-selector` | Table picker with table link |

**Key sub-block config fields:**
- `condition` / `condition(values)` — show/hide based on other field values
- `mode` — `'basic' | 'advanced' | 'both' | 'trigger' | 'trigger-advanced'`
- `required` — static or conditional requirement
- `defaultValue` — initial value
- `options` — static array or function returning options
- `wandConfig` — AI-assist configuration with custom prompt
- `dependsOn` — declarative deps for cross-field clearing
- `generationType` — hints what AI should generate (sql-query, json-schema, etc.)
- `fetchOptions` / `fetchOptionById` — dynamic option loading
- `reactiveCondition` — credential-type visibility gate

### 1.3 Block Registry
**File:** `apps/sim/blocks/registry.ts`

A flat `Record<string, BlockConfig>` called `registry`. Imports every block and registers it under a snake_case key. Versioned blocks use `_v2`, `_v3` suffix convention.

```typescript
export const registry: Record<string, BlockConfig> = {
  agent: AgentBlock,
  condition: ConditionBlock,
  human_in_the_loop: HumanInTheLoopBlock,
  router_v2: RouterV2Block,
  // ...~200+ blocks
}
```

Helper functions:
- `getBlock(type)` — lookup with `-` → `_` normalisation
- `getLatestBlock(baseType)` — finds highest `_vN` version
- `getBlockByToolName(toolName)` — reverse-lookup by tool ID
- `getBlocksByCategory(category)` — filter by `'blocks' | 'tools' | 'triggers'`
- `getAllBlocks()` — all values

### 1.4 Block Categories
`BlockCategory = 'blocks' | 'tools' | 'triggers'`

- **`blocks`** — Core workflow primitives: Agent, Condition, Router, Function, Variables, HumanInTheLoop, Response, Wait, etc.
- **`tools`** — Integration connectors: Slack, Gmail, GitHub, MCP, etc.
- **`triggers`** — Entry points: Starter, ManualTrigger, ApiTrigger, ChatTrigger, ScheduleBlock, GenericWebhook, etc.

The block toolbar/picker UI uses these categories to organise the block menu.

### 1.5 Block Icons
`BlockIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element`

Icons are React SVG components defined in `apps/sim/components/icons/`. Each block imports its icon directly (e.g., `ConditionalIcon`, `HumanInTheLoopIcon`, `ConnectIcon`). No icon registry — just direct imports.

### 1.6 Block Versioning
Versioned blocks follow the naming pattern `<base>_v2`, `<base>_v3` in the registry:

```
confluence, confluence_v2
cursor, cursor_v2
github, github_v2
router, router_v2      // v1 is hidden from toolbar (hideFromToolbar: true)
file, file_v2, file_v3
stt, stt_v2
vision, vision_v2
```

`getLatestBlock(baseType)` automatically finds the highest-version variant. v1 blocks that have v2+ successors are typically hidden from the toolbar via `hideFromToolbar: true` but still support existing workflows.

---

## 2. Canvas & Rendering

### 2.1 Workflow Canvas
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/workflow.tsx`

The canvas is a React Flow `<ReactFlow>` component wrapped in `<ReactFlowProvider>`. It:
- Reads nodes from `useWorkflowStore` (Zustand)
- Converts `BlockState[]` → React Flow `Node[]`
- Converts edge connections → React Flow `Edge[]`
- Registers custom node types: `WorkflowBlock`, `SubflowNodeComponent`, `NoteBlock`
- Registers custom edge type: `WorkflowEdge`
- Handles drag/drop of new blocks from the toolbar
- Manages copy/paste, selection, context menus

Key React Flow settings:
```typescript
connectionLineType={ConnectionLineType.SmoothStep}
selectionMode={SelectionMode.Partial}
```

Node types registered:
```typescript
const nodeTypes: NodeTypes = {
  workflowBlock: WorkflowBlock,
  subflow: SubflowNodeComponent,
  note: NoteBlock,
}
```

### 2.2 WorkflowBlock Component
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/workflow-block.tsx`

The primary block renderer. It's a memoised React component (React Flow `NodeProps`). Key responsibilities:
- Reads block config from registry via `getBlock(type)`
- Renders block header with `icon`, `bgColor`, name, enable/disable badge
- Renders sub-blocks using the sub-block component registry (each `SubBlockType` has a corresponding React component)
- Evaluates `condition` / `mode` fields on sub-blocks to determine visibility
- Renders React Flow `Handle` components (left/right input/output handles + dynamic handles for condition branches)
- Shows execution status overlays (running spinner, success/error indicator)
- Evaluates `canonicalParamId` / canonical swaps for basic↔advanced mode
- Calls `useSelectorDisplayName` to hydrate stored IDs to human-readable names for selector subblocks

Sub-block visibility logic:
```
evaluateSubBlockCondition() — check condition field against current param values
isSubBlockVisibleForMode() — check mode vs block's advancedMode
isSubBlockHidden() — check hidden flag
isSubBlockFeatureEnabled() — check showWhenEnvSet / hideWhenHosted etc.
```

### 2.3 Edges
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-edge/workflow-edge.tsx`

Custom edge component `WorkflowEdge` with SmoothStep routing. Special handle names:
- `condition-true` / `condition-false` — condition branches
- `error` — error port (when present, errors are routed rather than thrown)
- `loop-start` / `loop-end` — loop sentinels
- `parallel-start` / `parallel-end` — parallel sentinels
- Route IDs for router v2 dynamic routes

Edge source handles are rendered as dynamic handles on WorkflowBlock based on block type (condition rows, router routes, etc.).

### 2.4 Panel Editor
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/panel/panel.tsx`

The right-side panel. Tabs:
- **Toolbar** — block browser/search (`Toolbar` component)
- **Editor** — selected block detail editor (`Editor` component)
- **Deploy** — deployment settings (`Deploy` component)

`usePanelStore` tracks `activeTab` and `selectedBlock`. Clicking a block opens the Editor tab.

The **Toolbar** (`components/panel/components/toolbar/toolbar.tsx`) lists all non-hidden blocks grouped by category. Clicking a block in the toolbar adds it to the canvas.

The **Editor** renders sub-blocks for the selected block. Sub-block values are read from `useSubBlockStore` and written back on change.

### 2.5 Subflows / Container Nodes
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/components/subflows/subflow-node.tsx`

Loops and parallels are rendered as container `SubflowNodeComponent` nodes in React Flow. Child blocks have `parentId` set to the subflow container's node ID. The container:
- Displays loop/parallel type icon and name in header
- Provides left/right handles for external connections
- Shows execution status badge
- Handles resize and parent constraint (`extent: 'parent'`)

The subflow store tracks `WorkflowState.subflows` (a `Record<string, Subflow>` with `LoopConfig | ParallelConfig`).

**Loop config fields:** `nodes[]`, `iterations`, `loopType` (`for|forEach|while|doWhile`), `forEachItems`, `whileCondition`, `doWhileCondition`

**Parallel config fields:** `nodes[]`, `distribution`, `parallelType` (`count|collection`)

### 2.6 Auto-Layout
**File:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/hooks/use-auto-layout.ts`
**Utility:** `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/utils/auto-layout-utils.ts`

`useAutoLayout(workflowId)` hook provides `applyAutoLayoutAndUpdateStore()`. The algorithm:
- Uses Dagre or a custom DAG-based layout
- Respects user's snap-to-grid setting
- Fits view after layout with animation

---

## 3. Execution Engine

### 3.1 Overview: Full Execution Stack

```
Background job / API trigger
  → preprocessExecution()          [apps/sim/lib/execution/preprocessing.ts]
  → executeWorkflowCore()          [apps/sim/lib/workflows/executor/execution-core.ts]
  → WorkflowSerializer.serialize() [apps/sim/serializer/]
  → DAGBuilder.build()             [apps/sim/executor/dag/builder.ts]
  → ExecutionEngine.run()          [apps/sim/executor/execution/engine.ts]
      → NodeExecutionOrchestrator  [apps/sim/executor/orchestrators/node.ts]
          → BlockExecutor.execute() [apps/sim/executor/execution/block-executor.ts]
              → findHandler() → BlockHandler.execute()
  → LoggingSession / handlePostExecutionPauseState
```

### 3.2 DAG Builder
**File:** `apps/sim/executor/dag/builder.ts`

Converts `SerializedWorkflow` into a `DAG` (directed acyclic graph):

```typescript
interface DAG {
  nodes: Map<string, DAGNode>
  loopConfigs: Map<string, SerializedLoop>
  parallelConfigs: Map<string, SerializedParallel>
}

interface DAGNode {
  id: string
  block: SerializedBlock
  incomingEdges: Set<string>
  outgoingEdges: Map<string, DAGEdge>
  metadata: NodeMetadata
}
```

Sub-constructors:
- `PathConstructor` — finds reachable blocks from trigger
- `LoopConstructor` — adds sentinel start/end nodes for loops
- `ParallelConstructor` — adds sentinel start/end nodes for parallels
- `NodeConstructor` — creates DAGNode for each block
- `EdgeConstructor` — wires up edges between DAGNodes

**Sentinel nodes** (`sentinel_start`, `sentinel_end`) are infrastructure nodes that bracket loops and parallels — they are NOT user-visible blocks.

### 3.3 Execution Engine
**File:** `apps/sim/executor/execution/engine.ts`

The `ExecutionEngine` class drives execution:

1. `initializeQueue()` — seeds `readyQueue` with the start block (or resume blocks)
2. `run()` — main loop: `while (hasWork()) → processQueue()`
3. `processQueue()` — dequeues nodes and spawns `executeNodeAsync()` promises
4. After each node completes, `handleNodeCompletion()` uses `EdgeManager.processOutgoingEdges()` to determine which downstream nodes become ready and enqueues them

Execution is **topological** (respects DAG dependencies) and **concurrent** within an execution step (multiple independent paths can run in parallel).

**Cancellation:** Via `AbortSignal` or Redis key check every 500ms.

**Pause detection:** If a block outputs `_pauseMetadata`, the engine stores it in `pausedBlocks` and returns a `status: 'paused'` result.

### 3.4 Block Handlers
**File:** `apps/sim/executor/handlers/registry.ts`

The handler registry returns all `BlockHandler` instances. Each handler implements:

```typescript
interface BlockHandler {
  canHandle(block: SerializedBlock): boolean
  execute(ctx, block, inputs): Promise<BlockOutput | StreamingExecution>
  executeWithNode?(ctx, block, inputs, nodeMetadata): Promise<...>  // optional
}
```

Registered handlers (in order, first match wins):

| Handler | Block types |
|---------|-------------|
| `TriggerBlockHandler` | `start_trigger`, `starter`, `trigger` |
| `FunctionBlockHandler` | `function` |
| `ApiBlockHandler` | `api` |
| `ConditionBlockHandler` | `condition` |
| `RouterBlockHandler` | `router`, `router_v2` |
| `ResponseBlockHandler` | `response` |
| `HumanInTheLoopBlockHandler` | `human_in_the_loop` |
| `AgentBlockHandler` | `agent` |
| `MothershipBlockHandler` | `mothership` |
| `VariablesBlockHandler` | `variables` |
| `WorkflowBlockHandler` | `workflow` (child workflow invocation) |
| `WaitBlockHandler` | `wait` |
| `EvaluatorBlockHandler` | `evaluator` |
| `CredentialBlockHandler` | `credential` |
| `GenericBlockHandler` | **fallback** — handles all tool-based blocks |

The `GenericBlockHandler` handles the vast majority of integration blocks by looking up the tool in `tools.config.tool(params)` and calling `executeTool()`.

### 3.5 Block Executor
**File:** `apps/sim/executor/execution/block-executor.ts`

`BlockExecutor.execute()` per block:
1. `findHandler(block)` — selects handler
2. Create `BlockLog` entry
3. `callOnBlockStart()` callback
4. `resolver.resolveInputs()` — resolves `<block.output>` and `{{ENV_VAR}}` references
5. `handler.execute(ctx, block, resolvedInputs)` — runs the block
6. Handle streaming if `output.stream` present
7. Hydrate `UserFile` objects with base64 if needed
8. `state.setBlockOutput()` — persist output to context
9. `callOnBlockComplete()` callback
10. Error handling: if error port edge exists → return error output; otherwise throw

### 3.6 Edge Manager & Routing
**File:** `apps/sim/executor/execution/edge-manager.ts`

`EdgeManager.processOutgoingEdges(node, output)` determines which nodes become ready after a node completes:
- For **condition blocks**: checks `output.selectedOption` to pick `condition-true` or `condition-false` path
- For **router blocks**: checks `output.selectedRoute` to pick the correct route handle
- For **regular blocks**: traverses all outgoing edges, decrements `incomingEdges` counts, enqueues nodes with zero remaining incoming edges
- For **error ports**: routes to error-handling path when `output.error` is present

### 3.7 Condition & Routing Logic
**Files:**
- `apps/sim/executor/handlers/condition/condition-handler.ts`
- `apps/sim/executor/handlers/router/router-handler.ts`

**Condition handler:**
- Evaluates JavaScript expressions from `condition-input` sub-block
- Returns `conditionResult: boolean`, `selectedOption: string` (the matching `if/else-if/else` branch ID)
- Stores decision in `ctx.decisions.condition`

**Router handler:**
- RouterV2: builds route list from `router-input` sub-block, sends to LLM (any configured model)
- Returns `selectedRoute: string` (route ID), `reasoning: string`
- Stores decision in `ctx.decisions.router`
- Edge manager uses `selectedRoute` to activate only that route's edge

### 3.8 Human-in-the-Loop Pause/Resume
**Files:**
- `apps/sim/executor/handlers/human-in-the-loop/human-in-the-loop-handler.ts`
- `apps/sim/background/resume-execution.ts`
- `apps/sim/executor/execution/snapshot-serializer.ts`

**Pause mechanism:**
1. `HumanInTheLoopBlockHandler.executeWithNode()` generates:
   - `contextId` — unique per pause point
   - `resumeLinks.apiUrl` — direct curl resume endpoint
   - `resumeLinks.uiUrl` — UI resume page
   - Optional notification tool calls (Slack, email, etc.)
   - Returns `_pauseMetadata` in output (special sentinel field)
2. Engine detects `_pauseMetadata` → stores in `pausedBlocks` map
3. `buildPausedResult()` calls `serializePauseSnapshot()` to capture full execution state
4. `pausedExecutions` DB table stores: `executionSnapshot`, `pausePoints`, status

**Resume mechanism:**
1. Approver hits the resume endpoint with form data
2. `resume-execution.ts` background job:
   - Loads snapshot from `pausedExecutions`
   - Reconstructs `ExecutionContext` from snapshot
   - Sets `metadata.resumeFromSnapshot = true`
   - Feeds resume input into block state
   - Resumes execution from pending blocks

### 3.9 Loops & Parallels
**Files:**
- `apps/sim/executor/orchestrators/loop.ts`
- `apps/sim/executor/orchestrators/parallel.ts`

**Loop orchestrator:** Manages `ctx.loopExecutions` map keyed by `loopId`. Per iteration, resets block states for loop nodes and re-enqueues them. Supports `for` (count), `forEach` (collection), `while` (condition check at start), `doWhile` (condition check at end).

**Parallel orchestrator:** Expands a parallel block into N branches at runtime. Each branch gets a cloned copy of the contained blocks with unique node IDs. `ctx.parallelExecutions` tracks per-branch outputs. After all branches complete, results are aggregated.

### 3.10 Error/Retry
- Errors during block execution are caught in `BlockExecutor.handleBlockError()`
- If block has an outgoing `error`-handle edge: returns `{error: message}` output and continues (error is "handled")
- If no error handle: throws, propagates to `ExecutionEngine`, marks `errorFlag`, stops execution
- Block-level `errorHandled: true` flag is set in logs when error is routed
- Tool-level retry config in `ToolConfig.request.retry` (via `ToolRetryConfig`)

---

## 4. Tool System

### 4.1 Tool Definition
**File:** `apps/sim/tools/types.ts`

```typescript
interface ToolConfig<P, R> {
  id: string
  name: string
  description: string
  version: string
  params: Record<string, { type, required, visibility, default, description }>
  outputs?: Record<string, OutputProperty>
  oauth?: OAuthConfig
  request: {
    url: string | ((params) => string)
    method: HttpMethod | ((params) => HttpMethod)
    headers: (params) => Record<string, string>
    body?: (params) => Record | string | FormData
    retry?: ToolRetryConfig
  }
  transformResponse?: (response: Response, params?) => Promise<R>
  directExecution?: (params) => Promise<ToolResponse>  // Skip HTTP, run directly
  postProcess?: (result, params, executeTool) => Promise<R>
  schemaEnrichment?: Record<string, SchemaEnrichmentConfig>  // Dynamic schema enrichment
  toolEnrichment?: ToolEnrichmentConfig  // Dynamic tool-level enrichment
  hosting?: ToolHostingConfig<P>  // Hosted API key config with pricing
}
```

**Parameter visibility:**
- `user-or-llm` — user or LLM provides
- `user-only` — only user provides
- `llm-only` — only LLM provides
- `hidden` — never shown

### 4.2 Tool Registration & Lookup
**File:** `apps/sim/tools/utils.ts`

`getTool(toolId)` returns a `ToolConfig` by ID. Tools are organised in subdirectories under `apps/sim/tools/` (one folder per integration: `slack/`, `github/`, `gmail/`, etc.). Each folder exports tool configs.

**Tool execution:** `executeTool(toolId, params, stream, executionContext)` in `apps/sim/tools/index.ts`:
1. Looks up tool config
2. Resolves hosted API keys (if `hosting` config present)
3. Resolves OAuth tokens from credentials
4. Calls `formatRequestParams(tool, params)`
5. Makes HTTP request (with retry if configured)
6. Calls `tool.transformResponse()` or default JSON parse
7. Returns `ToolResponse { success, output, error }`

### 4.3 How Blocks Bind to Tools
Block config `tools.access` lists tool IDs. `tools.config.tool(params)` dynamically selects which tool to call based on param values (e.g., `operation` dropdown). `tools.config.params(params)` transforms block params before passing to tool.

The `GenericBlockHandler` uses this:
```
toolId = block.config.tool       // set by serializer from tools.config.tool(params)
executeTool(toolId, resolvedInputs, ...)
```

### 4.4 MCP Integration
**File:** `apps/sim/blocks/blocks/mcp.ts`
**MCP utils:** `apps/sim/lib/mcp/`

The `McpBlock` uses three sub-blocks:
1. `mcp-server-selector` — picks a workspace-configured MCP server
2. `mcp-tool-selector` — shows tools available on that server
3. `mcp-dynamic-args` — renders tool input form from MCP tool schema

Tool ID is constructed as `createMcpToolId(serverId, toolName)` from `apps/sim/lib/mcp/shared.ts`. The tools executor dynamically routes MCP tool calls to the configured MCP server via the `parseMcpToolId()` utility.

MCP servers are configured per-workspace in settings (`apps/sim/app/workspace/.../settings/components/workflow-mcp-servers/`).

### 4.5 Credentials & Auth
**File:** `apps/sim/tools/index.ts` (credential resolution in `executeTool`)
**DB table:** `credential` (in `packages/db/schema.ts`)

OAuth credentials are stored per-workspace in the `credential` table with encrypted tokens. The `oauth-input` sub-block type lets users select a stored credential. At execution time, the credential ID is resolved to an access token via the OAuth refresh flow.

API key credentials are stored as workspace BYOK keys in `workspaceBYOKKeys` table, or can be entered directly into `short-input` password fields on blocks.

---

## 5. Database Schema

**File:** `packages/db/schema.ts` (Drizzle ORM, PostgreSQL)

### Core Tables

#### `workflow`
Main workflow metadata:
- `id`, `userId`, `workspaceId`, `folderId`
- `name`, `description`, `color`
- `isDeployed`, `deployedAt`, `isPublicApi`
- `variables: json` — workflow-level variables definition
- `runCount`, `lastRunAt`

#### `workflow_blocks`
Individual blocks in a workflow:
- `id`, `workflowId`, `type`, `name`
- `positionX`, `positionY` — canvas position
- `enabled`, `horizontalHandles`, `isWide`, `advancedMode`, `triggerMode`, `locked`
- `subBlocks: jsonb` — all sub-block values (the form state)
- `outputs: jsonb` — output type definitions
- `data: jsonb` — extra data (parentId, width/height, loop/parallel config)

#### `workflow_edges`
Connections between blocks:
- `id`, `workflowId`
- `sourceBlockId`, `targetBlockId`
- `sourceHandle`, `targetHandle` — handle names for conditional/router edges

#### `workflow_subflows`
Loop and parallel container metadata:
- `id`, `workflowId`
- `type: 'loop' | 'parallel'`
- `config: jsonb` — `LoopConfig | ParallelConfig`

### Execution Tables

#### `workflow_execution_logs`
One row per workflow run:
- `executionId` (unique), `workflowId`, `workspaceId`
- `level`, `status` (`running|pending|completed|failed|cancelled`)
- `trigger` (`api|webhook|schedule|manual|chat`)
- `startedAt`, `endedAt`, `totalDurationMs`
- `executionData: jsonb` — full block logs array
- `cost: jsonb`
- `stateSnapshotId` → `workflow_execution_snapshots.id`
- `deploymentVersionId` → `workflow_deployment_versions.id`

#### `workflow_execution_snapshots`
Deduplicated workflow state snapshots:
- `stateHash` — content hash for deduplication
- `stateData: jsonb` — full serialised workflow state

#### `paused_executions`
Human-in-the-loop pause state:
- `executionId` (unique)
- `executionSnapshot: jsonb` — full execution state at pause point
- `pausePoints: jsonb` — array of `PausePoint` objects with resume links
- `status` (`paused|resumed|expired|failed`)
- `expiresAt`

#### `resume_queue`
Resume requests queued for processing:
- `pausedExecutionId`, `contextId`
- `resumeInput: jsonb` — form data submitted by approver
- `status` (`pending|claimed|completed|failed`)

#### `credential`
OAuth/API credentials per workspace:
- `workspaceId`, `userId`
- `serviceId`, `type` (`oauth|service_account`)
- Encrypted token fields

#### Other Relevant Tables
- `workflowSchedule` — cron schedules linked to workflows
- `workflowDeploymentVersion` — deployment version history
- `workspaceBYOKKeys` — bring-your-own-key API keys per workspace
- `workspaceEnvironment` — workspace-level environment variables
- `environment` — user-level environment variables

---

## 6. State Management

### 6.1 Zustand Stores

All stores in `apps/sim/stores/`. Key stores:

#### `useWorkflowStore` — `stores/workflows/workflow/store.ts`
**The primary editor state store.** Contains:
- `blocks: Record<string, BlockState>` — all block positions, sub-block values, outputs
- `edges: Edge[]` — React Flow edges
- `subflows: Record<string, Subflow>` — loop/parallel containers

Key operations: `addBlock`, `removeBlock`, `updateBlockPosition`, `addEdge`, `removeEdge`, `addLoop`, `addParallel`, `removeSubflow`, etc.

`BlockState` shape:
```typescript
interface BlockState {
  id: string
  type: string
  name: string
  position: { x, y }
  subBlocks: Record<string, SubBlockState>
  outputs: Record<string, OutputFieldDefinition>
  enabled: boolean
  horizontalHandles?: boolean
  height?: number
  advancedMode?: boolean
  triggerMode?: boolean
  data?: BlockData
  locked?: boolean
}
```

#### `useSubBlockStore` — `stores/workflows/subblock/store.ts`
Manages sub-block value updates. Separated from WorkflowStore to allow fine-grained updates without triggering full re-renders. Syncs to DB via Socket.io operations.

#### `useWorkflowRegistry` — `stores/workflows/registry/store.ts`
Registry of all workflows in the workspace (name, id, isDeployed, etc.).

#### `useExecutionStore` — `stores/execution/store.ts`
Execution state for the current run:
- `blockExecutionState: Record<string, { status, output, error, ... }>`
- `isExecuting: boolean`
- `currentExecutionId: string`

#### `usePanelStore` — `stores/panel/store.ts`
Panel state: `activeTab`, `selectedBlockId`, `isOpen`.

#### `useUndoRedoStore` — `stores/undo-redo/store.ts`
Undo/redo stack. Persisted to localStorage. Tracks `Operation` entries:
- `BatchAddBlocksOperation`
- `BatchRemoveBlocksOperation`
- `BatchMoveBlocksOperation`
- `BatchAddEdgesOperation`
- `BatchRemoveEdgesOperation`
- `BatchUpdateParentOperation`

Operations are suspended during programmatic changes via `runWithUndoRedoRecordingSuspended()`.

#### `useVariablesStore` — `stores/variables/store.ts`
Workflow-level variable definitions and current values.

#### Other stores
- `useCanvasModeStore` — canvas mode (normal/diff/preview)
- `useNotificationStore` — UI notifications
- `useWorkflowDiffStore` — diff state for comparing deployed vs. draft
- `useChatStore` — chat interface state
- `useLogsStore` — execution log display state

### 6.2 Real-Time Collaboration
**Files:** `apps/sim/socket/`

Socket.io server handles real-time sync. Workflow changes are broadcast to all users in the same workflow "room".

**Presence handlers** (`socket/handlers/presence.ts`):
- `cursor-update` — broadcasts cursor position to other users
- `selection-update` — broadcasts block selection state

**Workflow/operation handlers** (`socket/handlers/workflow.ts`, `operations.ts`):
- Block add/move/delete, edge changes, sub-block value changes are all broadcast and persisted via Socket.io

Room management via `IRoomManager` (Redis-backed in production, memory-backed in dev).

Collaborative workflow hook: `apps/sim/hooks/use-collaborative-workflow.ts` — React hook that subscribes to socket events and applies remote changes to local stores.

### 6.3 Undo/Redo
Undo/redo uses a per-workflow, per-user stack stored in localStorage. Each operation type has a defined undo action. Max 100 entries, max 5 parallel stacks.

---

## 7. Key Integration Points for Governance Mode

### 7.1 What Governance Protocol Mode Needs

Governance protocols typically require blocks for:
- **Proposal** — submit a decision item for review
- **Vote / Multi-sig approval** — collect votes from N of M participants
- **Quorum check** — evaluate whether a threshold has been met
- **Role gate** — check if the current actor has the required role
- **Timelock** — pause execution until a delay passes
- **Veto** — allow a designated party to block an action
- **Audit log** — append-only record of governance decisions
- **Delegation** — allow a principal to act on behalf of another
- **Escrow / Conditional release** — hold an action pending condition

---

### 7.2 Reuse As-Is

#### Block system
The `BlockConfig` interface covers everything needed. New governance blocks are simply new `BlockConfig` objects following the exact same pattern. No changes to the system.

#### Sub-block types
The existing palette is rich enough for most governance UIs:
- `input-format` — define the structure of a proposal
- `response-format` — define the structure of a vote response
- `dropdown` — select role, voting method, threshold type
- `short-input` — enter numeric thresholds (e.g., `3` of `5`)
- `long-input` — description, justification fields
- `table` — voter lists, eligible roles
- `condition-input` — quorum expressions
- `code` — custom vote-counting logic
- `switch` — enable/disable features (anonymous voting, etc.)
- `time-input` — timelock duration

#### Registry
Just add entries to `registry.ts`. Zero friction.

#### Execution engine
The core engine is completely block-agnostic. The handler dispatch, DAG building, edge routing, parallel/loop orchestration, pause/resume — all work for any new handler.

#### Human-in-the-loop mechanism
The full pause/resume infrastructure (`PauseMetadata`, `pausedExecutions`, `resumeQueue`, snapshot serialiser) is **directly reusable** for multi-party approval workflows. A "Vote" block can pause, notify N voters, and resume when quorum is reached. The `inputFormat` sub-block defines the vote form.

#### Variables block
Useful for accumulating vote counts across iterations.

#### Tool system
The `ToolConfig` / `executeTool()` / `GenericBlockHandler` pipeline works for any new governance tools (e.g., an on-chain submission tool, a Gnosis Safe transaction proposer, an identity verification API).

#### Database
`workflow_execution_logs`, `paused_executions`, `resume_queue` are all reusable. The `executionData` jsonb field in logs stores all block outputs and can capture governance decisions.

---

### 7.3 What Needs Extension

#### New `BlockCategory` or `IntegrationType` (optional, low priority)
Currently `BlockCategory = 'blocks' | 'tools' | 'triggers'`. Governance blocks fit in `'blocks'`. However, a new `IntegrationType.Governance = 'governance'` could be added if you want a dedicated section in the block picker.

#### New `SubBlockType`s (if needed)
Existing types cover most cases, but these might need to be added:
- `voter-list-input` — structured list of voters with weights/roles (could use `table` for MVP)
- `threshold-input` — specialised numeric threshold with denominator (e.g., `3 of 5`) — could use two `short-input` fields for MVP
- `timeline-input` — date range with start/end and optional auto-close (could use `time-input` for MVP)
- `delegation-map` — principal → delegate mapping (could use `table` for MVP)

In most cases, composing existing sub-block types is sufficient for MVP. Add new types only when the UX is significantly better.

#### Handler for voting/quorum logic
The core voting logic needs a dedicated handler (similar to `ConditionBlockHandler` and `RouterBlockHandler`). Governance blocks that require special execution semantics (multi-party collection, threshold evaluation, delegation resolution) need new handler classes in `apps/sim/executor/handlers/`.

Register them in `apps/sim/executor/handlers/registry.ts` before `GenericBlockHandler`.

#### Resume-with-accumulation pattern
Current `HumanInTheLoopBlockHandler` pauses once and resumes once. Governance voting requires **accumulating N responses** before resuming. This requires either:
- **Option A:** Multiple sequential `HumanInTheLoop` blocks (one per voter), with a `Condition` block checking quorum — works today with no engine changes.
- **Option B:** A new `VoteBlock` handler that can pause multiple times (one per voter), accumulate `resumeInput` values, and only allow the engine to proceed when quorum is reached. Requires minor extension to `ExecutionEngine.handleNodeCompletion()` to support "re-pause after partial resume."

Option A is recommended for MVP. Option B is a future enhancement.

#### Timelock block
The `WaitBlock` already supports time-based pauses. A `TimelockBlock` can extend this with:
- A minimum delay that cannot be bypassed
- An optional veto window during which a designated party can cancel

Reuse `WaitBlockHandler` as a base.

#### Audit log persistence
Governance decisions should be immutable. The `workflowExecutionLogs.executionData` field captures all outputs, but for governance you likely want:
- A dedicated `governance_decisions` table (new DB migration)
- Or leverage the existing `workflow_execution_logs` table with a specific `trigger = 'governance'` value and structured `executionData`

#### Identity / Role verification
Most governance protocols need to verify that voters are who they claim to be and hold the required role. This requires:
- New tools for on-chain identity (e.g., ENS, DAO membership checks)
- Or OAuth-gated credential checks
- A `RoleGateBlock` that wraps credential validation

---

### 7.4 What Needs New Code

#### New block definitions
Create one file per governance block in `apps/sim/blocks/blocks/`:
```
apps/sim/blocks/blocks/governance_proposal.ts
apps/sim/blocks/blocks/governance_vote.ts
apps/sim/blocks/blocks/governance_quorum.ts
apps/sim/blocks/blocks/governance_timelock.ts
apps/sim/blocks/blocks/governance_role_gate.ts
apps/sim/blocks/blocks/governance_veto.ts
apps/sim/blocks/blocks/governance_audit_log.ts
apps/sim/blocks/blocks/governance_delegate.ts
```

Register them in `apps/sim/blocks/registry.ts`.

#### New block handler(s)
At minimum, a `GovernanceVoteBlockHandler` for the multi-party vote collection:

```typescript
// apps/sim/executor/handlers/governance/governance-vote-handler.ts
export class GovernanceVoteBlockHandler implements BlockHandler {
  canHandle(block: SerializedBlock): boolean {
    return block.metadata?.id === 'governance_vote'
  }
  async executeWithNode(ctx, block, inputs, nodeMetadata): Promise<BlockOutput> {
    // 1. Collect voter list from inputs
    // 2. For each voter: create pause point, send notification
    // 3. Return _pauseMetadata for engine pause
    // (On resume: accumulate votes, check quorum, re-pause or proceed)
  }
}
```

Register in `apps/sim/executor/handlers/registry.ts` before `GenericBlockHandler`.

#### New tools (if needed)
For on-chain or identity verification calls, add tool configs under:
```
apps/sim/tools/governance/
  gnosis_safe_propose.ts
  snapshot_vote.ts
  ens_resolve.ts
  index.ts
```

Follow the `ToolConfig` interface. Register in the tool registry.

#### New DB table(s) (recommended)
```sql
-- Governance decision records (immutable audit log)
CREATE TABLE governance_decisions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflow(id),
  execution_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,   -- 'vote', 'quorum', 'veto', 'timelock'
  participants JSONB NOT NULL,   -- list of voters/approvers with their responses
  outcome TEXT NOT NULL,         -- 'approved', 'rejected', 'vetoed', 'expired'
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMP
);
```

Add migration in `packages/db/migrations/`.

#### New resume endpoint variant (optional for multi-voter)
Current resume endpoint: `POST /api/workflows/{workflowId}/execute/{executionId}/resume/{contextId}`

For multi-voter patterns, may need:
- A "partial resume" endpoint that accumulates votes without fully resuming execution
- Or: store votes externally and check quorum in the vote handler's re-execution

#### New UI components for governance sub-blocks (if adding new SubBlockTypes)
If adding `voter-list-input` or `threshold-input`, add their React components in:
```
apps/sim/app/workspace/.../components/workflow-block/components/subblock/components/
```

And add the type to `SubBlockType` union in `apps/sim/blocks/types.ts`.

---

### 7.5 Recommended Build Order

1. **Block definitions** — define `governance_proposal.ts`, `governance_vote.ts`, etc. using existing sub-block types. Register in registry. This gives a working (though simple) block menu immediately.

2. **GenericHandler MVP** — since `GenericBlockHandler` handles any block with `tools.config`, you can wire governance blocks to REST tools (e.g., a Snapshot API, a Gnosis API) with zero new handler code.

3. **HumanInTheLoop composition** — use existing HITL + Variables + Condition blocks to model multi-party approval (Option A above). This works today.

4. **Dedicated GovernanceVoteHandler** — once the pattern is proven, build the dedicated handler for cleaner UX and true multi-pause accumulation (Option B).

5. **DB audit table** — add `governance_decisions` migration for immutable decision records.

6. **UI polish** — add any new sub-block types needed for better governance-specific UX.

---

## Appendix: Key File Index

### Block System
| File | Purpose |
|------|---------|
| `apps/sim/blocks/types.ts` | `BlockConfig`, `SubBlockConfig`, `SubBlockType`, `BlockCategory` interfaces |
| `apps/sim/blocks/registry.ts` | Block registry and lookup helpers |
| `apps/sim/blocks/blocks/*.ts` | Individual block definitions |
| `apps/sim/blocks/utils.ts` | Shared block utilities (model options, provider creds) |

### Canvas & UI
| File | Purpose |
|------|---------|
| `apps/sim/app/workspace/[workspaceId]/w/[workflowId]/workflow.tsx` | Main React Flow canvas |
| `apps/sim/app/workspace/.../components/workflow-block/workflow-block.tsx` | Block node renderer |
| `apps/sim/app/workspace/.../components/subflows/subflow-node.tsx` | Loop/parallel container renderer |
| `apps/sim/app/workspace/.../components/workflow-edge/workflow-edge.tsx` | Edge renderer |
| `apps/sim/app/workspace/.../components/panel/panel.tsx` | Side panel (toolbar + editor + deploy) |
| `apps/sim/app/workspace/.../components/block-menu/block-menu.tsx` | Block context menu |
| `apps/sim/app/workspace/.../hooks/use-auto-layout.ts` | Auto-layout hook |

### Execution Engine
| File | Purpose |
|------|---------|
| `apps/sim/executor/dag/builder.ts` | DAG construction from serialized workflow |
| `apps/sim/executor/execution/engine.ts` | Main execution loop |
| `apps/sim/executor/execution/block-executor.ts` | Per-block execution |
| `apps/sim/executor/execution/edge-manager.ts` | Post-execution edge routing |
| `apps/sim/executor/handlers/registry.ts` | Handler registration |
| `apps/sim/executor/handlers/*/` | Individual block handlers |
| `apps/sim/executor/variables/resolver.ts` | `<block.output>` reference resolution |
| `apps/sim/executor/types.ts` | `ExecutionContext`, `BlockHandler`, `BlockLog` interfaces |
| `apps/sim/executor/constants.ts` | `BlockType` enum, sentinel types |
| `apps/sim/background/workflow-execution.ts` | Trigger.dev background job entry point |
| `apps/sim/background/resume-execution.ts` | Resume from pause entry point |

### Tool System
| File | Purpose |
|------|---------|
| `apps/sim/tools/types.ts` | `ToolConfig`, `ToolResponse` interfaces |
| `apps/sim/tools/index.ts` | `executeTool()` — main tool execution function |
| `apps/sim/tools/utils.ts` | `getTool()`, `formatRequestParams()` |
| `apps/sim/tools/*/` | Individual tool definitions |

### Database
| File | Purpose |
|------|---------|
| `packages/db/schema.ts` | All Drizzle ORM table definitions |
| `packages/db/index.ts` | DB client export |
| `packages/db/migrations/` | SQL migration files |

### State Management
| File | Purpose |
|------|---------|
| `apps/sim/stores/workflows/workflow/store.ts` | Primary editor state (blocks, edges, subflows) |
| `apps/sim/stores/workflows/workflow/types.ts` | `BlockState`, `SubBlockState`, `WorkflowState` types |
| `apps/sim/stores/workflows/subblock/store.ts` | Sub-block value store |
| `apps/sim/stores/execution/store.ts` | Live execution state |
| `apps/sim/stores/panel/store.ts` | Panel tab/selection state |
| `apps/sim/stores/undo-redo/store.ts` | Undo/redo operation stack |
| `apps/sim/stores/variables/store.ts` | Workflow variables |
| `apps/sim/socket/handlers/presence.ts` | Cursor/selection real-time sync |
| `apps/sim/socket/handlers/operations.ts` | Workflow change broadcast |
| `apps/sim/hooks/use-collaborative-workflow.ts` | Socket event → store updates |

### Serializer
| File | Purpose |
|------|---------|
| `apps/sim/serializer/types.ts` | `SerializedWorkflow`, `SerializedBlock`, `SerializedLoop`, `SerializedParallel` |
