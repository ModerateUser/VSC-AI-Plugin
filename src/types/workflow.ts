/**
 * Core type definitions for the Agentic Workflow Plugin
 */

import { Readable } from 'stream';

/**
 * Node types supported by the workflow engine
 */
export enum NodeType {
  CONDITION = 'condition',
  LOOP = 'loop',
  MODEL = 'model',
  DOWNLOAD = 'download',
  SCRIPT = 'script',
  API_CALL = 'api_call',
  GITHUB_ACTION = 'github_action',
  OS_COMMAND = 'os_command',
  VECTOR_GENERATION = 'vector_generation',
  CONTEXT_INJECTION = 'context_injection',
  NESTED_WORKFLOW = 'nested_workflow',
  PARALLEL = 'parallel',
  CUSTOM = 'custom'
}

/**
 * Node execution status
 */
export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Base node configuration
 */
export interface BaseNodeConfig {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  dependencies: string[]; // IDs of nodes that must complete before this one
  retryPolicy?: RetryPolicy;
  timeout?: number; // milliseconds
  overrides?: Record<string, any>; // Context overrides for this node
}

/**
 * Retry policy for node execution
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number; // milliseconds
  maxDelay?: number;
}

/**
 * Condition node configuration
 */
export interface ConditionNodeConfig extends BaseNodeConfig {
  type: NodeType.CONDITION;
  condition: string; // JavaScript expression to evaluate
  trueBranch: string[]; // Node IDs to execute if true
  falseBranch: string[]; // Node IDs to execute if false
}

/**
 * Loop node configuration
 */
export interface LoopNodeConfig extends BaseNodeConfig {
  type: NodeType.LOOP;
  iterationSource: string; // Context path to array or expression
  childNodes: string[]; // Node IDs to execute for each iteration
  maxIterations?: number;
}

/**
 * Model node configuration
 */
export interface ModelNodeConfig extends BaseNodeConfig {
  type: NodeType.MODEL;
  modelId?: string; // Explicit model ID
  modelTags?: string[]; // Tags for model selection
  inputMapping: Record<string, string>; // Map context to model inputs
  outputMapping: Record<string, string>; // Map model outputs to context
  inferenceParams?: Record<string, any>;
}

/**
 * Download node configuration
 */
export interface DownloadNodeConfig extends BaseNodeConfig {
  type: NodeType.DOWNLOAD;
  source: 'huggingface' | 'url' | 'github';
  resourceId: string; // Model ID, URL, or GitHub repo
  destination?: string; // Custom cache path
  version?: string;
}

/**
 * Script node configuration
 */
export interface ScriptNodeConfig extends BaseNodeConfig {
  type: NodeType.SCRIPT;
  language: 'javascript' | 'python' | 'shell';
  script: string; // Inline script or path to script file
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

/**
 * API call node configuration
 */
export interface ApiCallNodeConfig extends BaseNodeConfig {
  type: NodeType.API_CALL;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  outputMapping?: Record<string, string>;
}

/**
 * GitHub Action node configuration
 */
export interface GitHubActionNodeConfig extends BaseNodeConfig {
  type: NodeType.GITHUB_ACTION;
  owner: string;
  repo: string;
  workflowId: string;
  ref?: string;
  inputs?: Record<string, any>;
  waitForCompletion: boolean;
  pollInterval?: number; // milliseconds
}

/**
 * OS Command node configuration
 */
export interface OsCommandNodeConfig extends BaseNodeConfig {
  type: NodeType.OS_COMMAND;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  captureOutput: boolean;
}

/**
 * Vector generation node configuration
 */
export interface VectorGenerationNodeConfig extends BaseNodeConfig {
  type: NodeType.VECTOR_GENERATION;
  dataSource: string; // Context path or file path
  embeddingModel: string;
  indexName: string;
  chunkSize?: number;
  overlap?: number;
}

/**
 * Context injection node configuration
 */
export interface ContextInjectionNodeConfig extends BaseNodeConfig {
  type: NodeType.CONTEXT_INJECTION;
  injections: Record<string, any>; // Key-value pairs to inject
  merge: boolean; // Whether to merge or replace
}

/**
 * Nested workflow node configuration
 */
export interface NestedWorkflowNodeConfig extends BaseNodeConfig {
  type: NodeType.NESTED_WORKFLOW;
  workflowId: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

/**
 * Parallel execution node configuration
 */
export interface ParallelNodeConfig extends BaseNodeConfig {
  type: NodeType.PARALLEL;
  childNodes: string[]; // Node IDs to execute in parallel
  waitForAll: boolean; // Wait for all or first completion
}

/**
 * Union type for all node configurations
 */
export type NodeConfig =
  | ConditionNodeConfig
  | LoopNodeConfig
  | ModelNodeConfig
  | DownloadNodeConfig
  | ScriptNodeConfig
  | ApiCallNodeConfig
  | GitHubActionNodeConfig
  | OsCommandNodeConfig
  | VectorGenerationNodeConfig
  | ContextInjectionNodeConfig
  | NestedWorkflowNodeConfig
  | ParallelNodeConfig
  | BaseNodeConfig;

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: NodeConfig[];
  entryNodes: string[]; // Node IDs to start execution
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  data: Record<string, any>; // Dynamic data storage
  variables: Record<string, any>; // User-defined variables
  outputs: Record<string, any>; // Node outputs
  metadata: Record<string, any>;
}

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  output?: any;
  error?: Error;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  attempts: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  workflowId: string;
  executionId: string;
  status: 'success' | 'failed' | 'partial';
  nodeResults: Map<string, NodeExecutionResult>;
  startTime: Date;
  endTime: Date;
  duration: number;
  context: WorkflowContext;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  tags: string[];
  source: 'huggingface' | 'local' | 'custom';
  path?: string;
  version?: string;
  metadata?: Record<string, any>;
  downloadedAt?: Date;
  size?: number;
}

/**
 * Vector database index
 */
export interface VectorIndex {
  name: string;
  dimension: number;
  count: number;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Search result from vector database
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  content?: string;
}

/**
 * Execution event for monitoring
 */
export interface ExecutionEvent {
  type: 'node_start' | 'node_complete' | 'node_error' | 'workflow_start' | 'workflow_complete' | 'workflow_error';
  timestamp: Date;
  workflowId: string;
  executionId: string;
  nodeId?: string;
  data?: any;
}

/**
 * Plugin extension interface
 */
export interface PluginExtension {
  id: string;
  name: string;
  version: string;
  nodeTypes?: CustomNodeType[];
  initialize?: () => Promise<void>;
  dispose?: () => Promise<void>;
}

/**
 * Custom node type definition
 */
export interface CustomNodeType {
  type: string;
  name: string;
  description: string;
  configSchema: any; // JSON Schema for configuration
  executor: (config: any, context: WorkflowContext) => Promise<any>;
}

/**
 * Workflow export format
 */
export interface WorkflowExport {
  format: 'json' | 'yaml';
  version: string;
  workflow: WorkflowDefinition;
  exportedAt: Date;
}
