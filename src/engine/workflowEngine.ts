/**
 * Core Workflow Engine
 * Handles workflow execution, node orchestration, and dependency management
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import {
    WorkflowDefinition,
    WorkflowContext,
    WorkflowExecutionResult,
    NodeConfig,
    NodeExecutionResult,
    NodeStatus,
    NodeType,
    ExecutionEvent,
} from '../types/workflow';
import { ModelManager } from '../models/modelManager';
import { VectorDatabaseManager } from '../vectordb/vectorDatabaseManager';
import { ExtensionManager } from '../extensions/extensionManager';
import { NodeExecutor } from './nodeExecutor';

/**
 * Workflow Engine - orchestrates workflow execution
 */
export class WorkflowEngine {
    private executionEvents = new Subject<ExecutionEvent>();
    private nodeExecutor: NodeExecutor;
    private activeExecutions = new Map<string, AbortController>();

    constructor(
        private modelManager: ModelManager,
        private vectorDbManager: VectorDatabaseManager,
        private extensionManager: ExtensionManager
    ) {
        this.nodeExecutor = new NodeExecutor(
            modelManager,
            vectorDbManager,
            extensionManager
        );
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(
        workflow: WorkflowDefinition,
        initialContext: Record<string, any> = {},
        cancellationToken?: vscode.CancellationToken
    ): Promise<WorkflowExecutionResult> {
        const executionId = uuidv4();
        const startTime = new Date();

        // Create execution context
        const context: WorkflowContext = {
            workflowId: workflow.id,
            executionId,
            data: { ...initialContext },
            variables: {},
            outputs: {},
            metadata: {
                startTime,
                workflowName: workflow.name,
                workflowVersion: workflow.version,
            },
        };

        // Create abort controller for cancellation
        const abortController = new AbortController();
        this.activeExecutions.set(executionId, abortController);

        // Handle cancellation
        if (cancellationToken) {
            cancellationToken.onCancellationRequested(() => {
                abortController.abort();
            });
        }

        // Emit workflow start event
        this.emitEvent({
            type: 'workflow_start',
            timestamp: new Date(),
            workflowId: workflow.id,
            executionId,
            data: { workflow },
        });

        const nodeResults = new Map<string, NodeExecutionResult>();
        let status: 'success' | 'failed' | 'partial' = 'success';

        try {
            // Validate workflow
            this.validateWorkflow(workflow);

            // Build dependency graph
            const dependencyGraph = this.buildDependencyGraph(workflow.nodes);

            // Execute nodes in topological order
            const executionOrder = this.topologicalSort(dependencyGraph);

            // Execute nodes
            for (const nodeId of executionOrder) {
                // Check for cancellation
                if (abortController.signal.aborted) {
                    status = 'partial';
                    break;
                }

                const node = workflow.nodes.find(n => n.id === nodeId);
                if (!node) {
                    continue;
                }

                // Check if dependencies succeeded
                const dependenciesMet = this.checkDependencies(node, nodeResults);
                if (!dependenciesMet) {
                    nodeResults.set(nodeId, {
                        nodeId,
                        status: NodeStatus.SKIPPED,
                        startTime: new Date(),
                        endTime: new Date(),
                        duration: 0,
                        attempts: 0,
                    });
                    continue;
                }

                // Execute node
                const result = await this.executeNode(
                    node,
                    context,
                    abortController.signal
                );
                nodeResults.set(nodeId, result);

                // Update context with node output
                if (result.output !== undefined) {
                    context.outputs[nodeId] = result.output;
                }

                // Check if node failed
                if (result.status === NodeStatus.FAILED) {
                    status = 'failed';
                    // Continue execution or stop based on configuration
                    // For now, we continue to allow partial execution
                }
            }
        } catch (error) {
            status = 'failed';
            this.emitEvent({
                type: 'workflow_error',
                timestamp: new Date(),
                workflowId: workflow.id,
                executionId,
                data: { error },
            });
        } finally {
            this.activeExecutions.delete(executionId);
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Emit workflow complete event
        this.emitEvent({
            type: 'workflow_complete',
            timestamp: new Date(),
            workflowId: workflow.id,
            executionId,
            data: { status, duration },
        });

        return {
            workflowId: workflow.id,
            executionId,
            status,
            nodeResults,
            startTime,
            endTime,
            duration,
            context,
        };
    }

    /**
     * Execute a single node
     */
    private async executeNode(
        node: NodeConfig,
        context: WorkflowContext,
        abortSignal: AbortSignal
    ): Promise<NodeExecutionResult> {
        const startTime = new Date();
        let attempts = 0;
        let lastError: Error | undefined;

        // Emit node start event
        this.emitEvent({
            type: 'node_start',
            timestamp: new Date(),
            workflowId: context.workflowId,
            executionId: context.executionId,
            nodeId: node.id,
            data: { node },
        });

        // Apply node-level context overrides
        const nodeContext = this.applyOverrides(context, node.overrides);

        // Retry logic
        const maxAttempts = node.retryPolicy?.maxAttempts || 1;
        const initialDelay = node.retryPolicy?.initialDelay || 1000;
        const backoff = node.retryPolicy?.backoff || 'linear';

        while (attempts < maxAttempts) {
            attempts++;

            try {
                // Check for abort
                if (abortSignal.aborted) {
                    throw new Error('Execution aborted');
                }

                // Execute with timeout if specified
                const output = await this.executeWithTimeout(
                    () => this.nodeExecutor.execute(node, nodeContext),
                    node.timeout
                );

                const endTime = new Date();
                const duration = endTime.getTime() - startTime.getTime();

                // Emit node complete event
                this.emitEvent({
                    type: 'node_complete',
                    timestamp: new Date(),
                    workflowId: context.workflowId,
                    executionId: context.executionId,
                    nodeId: node.id,
                    data: { output, duration },
                });

                return {
                    nodeId: node.id,
                    status: NodeStatus.SUCCESS,
                    output,
                    startTime,
                    endTime,
                    duration,
                    attempts,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Emit node error event
                this.emitEvent({
                    type: 'node_error',
                    timestamp: new Date(),
                    workflowId: context.workflowId,
                    executionId: context.executionId,
                    nodeId: node.id,
                    data: { error: lastError, attempt: attempts },
                });

                // Check if we should retry
                if (attempts < maxAttempts) {
                    const delay = this.calculateBackoff(attempts, initialDelay, backoff);
                    await this.sleep(delay);
                } else {
                    break;
                }
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
            nodeId: node.id,
            status: NodeStatus.FAILED,
            error: lastError,
            startTime,
            endTime,
            duration,
            attempts,
        };
    }

    /**
     * Execute with timeout
     */
    private async executeWithTimeout<T>(
        fn: () => Promise<T>,
        timeout?: number
    ): Promise<T> {
        if (!timeout) {
            return fn();
        }

        return Promise.race([
            fn(),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Execution timeout')), timeout)
            ),
        ]);
    }

    /**
     * Calculate backoff delay
     */
    private calculateBackoff(
        attempt: number,
        initialDelay: number,
        backoff: 'linear' | 'exponential'
    ): number {
        if (backoff === 'exponential') {
            return initialDelay * Math.pow(2, attempt - 1);
        }
        return initialDelay * attempt;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Apply context overrides
     */
    private applyOverrides(
        context: WorkflowContext,
        overrides?: Record<string, any>
    ): WorkflowContext {
        if (!overrides) {
            return context;
        }

        return {
            ...context,
            data: { ...context.data, ...overrides },
        };
    }

    /**
     * Check if node dependencies are met
     */
    private checkDependencies(
        node: NodeConfig,
        results: Map<string, NodeExecutionResult>
    ): boolean {
        for (const depId of node.dependencies) {
            const depResult = results.get(depId);
            if (!depResult || depResult.status !== NodeStatus.SUCCESS) {
                return false;
            }
        }
        return true;
    }

    /**
     * Validate workflow structure
     */
    private validateWorkflow(workflow: WorkflowDefinition): void {
        // Check for duplicate node IDs
        const nodeIds = new Set<string>();
        for (const node of workflow.nodes) {
            if (nodeIds.has(node.id)) {
                throw new Error(`Duplicate node ID: ${node.id}`);
            }
            nodeIds.add(node.id);
        }

        // Check for invalid dependencies
        for (const node of workflow.nodes) {
            for (const depId of node.dependencies) {
                if (!nodeIds.has(depId)) {
                    throw new Error(
                        `Node ${node.id} has invalid dependency: ${depId}`
                    );
                }
            }
        }

        // Check for cycles
        const hasCycle = this.detectCycle(workflow.nodes);
        if (hasCycle) {
            throw new Error('Workflow contains circular dependencies');
        }

        // Check entry nodes exist
        for (const entryId of workflow.entryNodes) {
            if (!nodeIds.has(entryId)) {
                throw new Error(`Invalid entry node: ${entryId}`);
            }
        }
    }

    /**
     * Build dependency graph
     */
    private buildDependencyGraph(
        nodes: NodeConfig[]
    ): Map<string, Set<string>> {
        const graph = new Map<string, Set<string>>();

        for (const node of nodes) {
            if (!graph.has(node.id)) {
                graph.set(node.id, new Set());
            }

            for (const depId of node.dependencies) {
                if (!graph.has(depId)) {
                    graph.set(depId, new Set());
                }
                graph.get(depId)!.add(node.id);
            }
        }

        return graph;
    }

    /**
     * Topological sort for execution order
     */
    private topologicalSort(graph: Map<string, Set<string>>): string[] {
        const result: string[] = [];
        const visited = new Set<string>();
        const temp = new Set<string>();

        const visit = (nodeId: string) => {
            if (temp.has(nodeId)) {
                throw new Error('Circular dependency detected');
            }
            if (visited.has(nodeId)) {
                return;
            }

            temp.add(nodeId);

            const dependencies = graph.get(nodeId) || new Set();
            for (const depId of dependencies) {
                visit(depId);
            }

            temp.delete(nodeId);
            visited.add(nodeId);
            result.push(nodeId);
        };

        for (const nodeId of graph.keys()) {
            if (!visited.has(nodeId)) {
                visit(nodeId);
            }
        }

        return result.reverse();
    }

    /**
     * Detect cycles in workflow
     */
    private detectCycle(nodes: NodeConfig[]): boolean {
        const graph = new Map<string, string[]>();
        for (const node of nodes) {
            graph.set(node.id, node.dependencies);
        }

        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycleUtil = (nodeId: string): boolean => {
            visited.add(nodeId);
            recStack.add(nodeId);

            const neighbors = graph.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycleUtil(neighbor)) {
                        return true;
                    }
                } else if (recStack.has(neighbor)) {
                    return true;
                }
            }

            recStack.delete(nodeId);
            return false;
        };

        for (const nodeId of graph.keys()) {
            if (!visited.has(nodeId)) {
                if (hasCycleUtil(nodeId)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Emit execution event
     */
    private emitEvent(event: ExecutionEvent): void {
        this.executionEvents.next(event);
    }

    /**
     * Subscribe to execution events
     */
    public onExecutionEvent(callback: (event: ExecutionEvent) => void): void {
        this.executionEvents.subscribe(callback);
    }

    /**
     * Cancel workflow execution
     */
    public cancelExecution(executionId: string): void {
        const controller = this.activeExecutions.get(executionId);
        if (controller) {
            controller.abort();
        }
    }

    /**
     * Get active executions
     */
    public getActiveExecutions(): string[] {
        return Array.from(this.activeExecutions.keys());
    }
}
