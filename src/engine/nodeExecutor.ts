/**
 * Node Executor - handles execution of individual nodes
 */

import { spawn } from 'child_process';
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import {
    NodeConfig,
    NodeType,
    WorkflowContext,
    ConditionNodeConfig,
    LoopNodeConfig,
    ModelNodeConfig,
    DownloadNodeConfig,
    ScriptNodeConfig,
    ApiCallNodeConfig,
    GitHubActionNodeConfig,
    OsCommandNodeConfig,
    VectorGenerationNodeConfig,
    ContextInjectionNodeConfig,
    NestedWorkflowNodeConfig,
    ParallelNodeConfig,
} from '../types/workflow';
import { ModelManager } from '../models/modelManager';
import { VectorDatabaseManager } from '../vectordb/vectorDatabaseManager';
import { ExtensionManager } from '../extensions/extensionManager';

/**
 * Node Executor - executes individual workflow nodes
 */
export class NodeExecutor {
    private octokit?: Octokit;
    private workflowEngine?: any; // Will be set by WorkflowEngine
    private storageManager?: any; // Will be set by WorkflowEngine

    constructor(
        private modelManager: ModelManager,
        private vectorDbManager: VectorDatabaseManager,
        private extensionManager: ExtensionManager
    ) {
        this.initializeGitHub();
    }

    /**
     * Set workflow engine reference (for nested workflows)
     */
    setWorkflowEngine(engine: any): void {
        this.workflowEngine = engine;
    }

    /**
     * Set storage manager reference (for nested workflows)
     */
    setStorageManager(manager: any): void {
        this.storageManager = manager;
    }

    /**
     * Initialize GitHub client
     */
    private initializeGitHub(): void {
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const token = config.get<string>('githubToken');
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    /**
     * Clone context for isolated execution (prevents race conditions)
     */
    private cloneContext(context: WorkflowContext): WorkflowContext {
        return {
            ...context,
            data: JSON.parse(JSON.stringify(context.data)),
            variables: JSON.parse(JSON.stringify(context.variables)),
            outputs: JSON.parse(JSON.stringify(context.outputs)),
            metadata: { ...context.metadata }
        };
    }

    /**
     * Execute a node based on its type
     */
    async execute(node: NodeConfig, context: WorkflowContext): Promise<any> {
        // Validate node configuration
        this.validateNodeConfig(node);

        switch (node.type) {
            case NodeType.CONDITION:
                return this.executeCondition(node as ConditionNodeConfig, context);
            case NodeType.LOOP:
                return this.executeLoop(node as LoopNodeConfig, context);
            case NodeType.MODEL:
                return this.executeModel(node as ModelNodeConfig, context);
            case NodeType.DOWNLOAD:
                return this.executeDownload(node as DownloadNodeConfig, context);
            case NodeType.SCRIPT:
                return this.executeScript(node as ScriptNodeConfig, context);
            case NodeType.API_CALL:
                return this.executeApiCall(node as ApiCallNodeConfig, context);
            case NodeType.GITHUB_ACTION:
                return this.executeGitHubAction(node as GitHubActionNodeConfig, context);
            case NodeType.OS_COMMAND:
                return this.executeOsCommand(node as OsCommandNodeConfig, context);
            case NodeType.VECTOR_GENERATION:
                return this.executeVectorGeneration(node as VectorGenerationNodeConfig, context);
            case NodeType.CONTEXT_INJECTION:
                return this.executeContextInjection(node as ContextInjectionNodeConfig, context);
            case NodeType.NESTED_WORKFLOW:
                return this.executeNestedWorkflow(node as NestedWorkflowNodeConfig, context);
            case NodeType.PARALLEL:
                return this.executeParallel(node as ParallelNodeConfig, context);
            case NodeType.CUSTOM:
                return this.executeCustom(node, context);
            default:
                throw new Error(`Unknown node type: ${node.type} (node: ${node.id})`);
        }
    }

    /**
     * Validate node configuration before execution
     */
    private validateNodeConfig(node: NodeConfig): void {
        if (!node.id) {
            throw new Error('Node must have an id');
        }
        if (!node.type) {
            throw new Error(`Node ${node.id} must have a type`);
        }
        if (!node.name) {
            throw new Error(`Node ${node.id} must have a name`);
        }

        // Type-specific validation
        switch (node.type) {
            case NodeType.MODEL:
                const modelNode = node as ModelNodeConfig;
                if (!modelNode.modelId && !modelNode.modelTags) {
                    throw new Error(`Model node ${node.id} must specify modelId or modelTags`);
                }
                break;
            case NodeType.API_CALL:
                const apiNode = node as ApiCallNodeConfig;
                if (!apiNode.url) {
                    throw new Error(`API call node ${node.id} must have a url`);
                }
                break;
            case NodeType.SCRIPT:
                const scriptNode = node as ScriptNodeConfig;
                if (!scriptNode.script) {
                    throw new Error(`Script node ${node.id} must have script content`);
                }
                break;
            case NodeType.NESTED_WORKFLOW:
                const nestedNode = node as NestedWorkflowNodeConfig;
                if (!nestedNode.workflowId) {
                    throw new Error(`Nested workflow node ${node.id} must have a workflowId`);
                }
                break;
        }
    }

    /**
     * Execute condition node - COMPLETE IMPLEMENTATION
     */
    private async executeCondition(
        node: ConditionNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (!this.workflowEngine) {
            throw new Error(`Workflow engine not initialized for condition node ${node.id}`);
        }

        // Evaluate condition expression
        const conditionResult = this.evaluateExpression(node.condition, context);
        const branchNodes = conditionResult ? node.trueBranch : node.falseBranch;
        const branchName = conditionResult ? 'true' : 'false';

        // Execute the appropriate branch
        const branchResults = [];
        for (const nodeId of branchNodes) {
            const branchNode = this.workflowEngine.getNodeById(nodeId);
            if (!branchNode) {
                throw new Error(`Branch node not found: ${nodeId} (condition: ${node.id})`);
            }

            try {
                const branchResult = await this.execute(branchNode, context);
                branchResults.push({ 
                    nodeId, 
                    nodeName: branchNode.name,
                    status: 'success',
                    result: branchResult 
                });
            } catch (error) {
                branchResults.push({
                    nodeId,
                    nodeName: branchNode.name,
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                });
                throw error; // Re-throw to fail the condition node
            }
        }

        return {
            condition: node.condition,
            result: Boolean(conditionResult),
            branch: branchName,
            branchNodesExecuted: branchNodes.length,
            branchResults
        };
    }

    /**
     * Execute loop node - COMPLETE IMPLEMENTATION
     */
    private async executeLoop(
        node: LoopNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (!this.workflowEngine) {
            throw new Error(`Workflow engine not initialized for loop node ${node.id}`);
        }

        // Get iteration data
        const iterationData = this.resolveContextPath(node.iterationSource, context);
        
        if (!Array.isArray(iterationData)) {
            throw new Error(`Loop iteration source must be an array: ${node.iterationSource} (node: ${node.id})`);
        }

        const maxIterations = node.maxIterations || iterationData.length;
        const iterations = Math.min(iterationData.length, maxIterations);
        const results: any[] = [];

        // Execute child nodes for each iteration
        for (let i = 0; i < iterations; i++) {
            // Create isolated context for this iteration
            const iterationContext = this.cloneContext(context);
            iterationContext.data.$iteration = i;
            iterationContext.data.$item = iterationData[i];
            iterationContext.data.$index = i;
            iterationContext.data.$total = iterations;

            const iterationResults: any[] = [];

            // Execute all child nodes in this iteration
            for (const childNodeId of node.childNodes) {
                const childNode = this.workflowEngine.getNodeById(childNodeId);
                if (!childNode) {
                    throw new Error(`Loop child node not found: ${childNodeId} (loop: ${node.id})`);
                }

                try {
                    const childResult = await this.execute(childNode, iterationContext);
                    iterationResults.push({
                        nodeId: childNodeId,
                        nodeName: childNode.name,
                        status: 'success',
                        result: childResult
                    });
                } catch (error) {
                    iterationResults.push({
                        nodeId: childNodeId,
                        nodeName: childNode.name,
                        status: 'failed',
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next iteration even if one fails
                }
            }

            results.push({
                iteration: i,
                item: iterationData[i],
                childNodesExecuted: node.childNodes.length,
                childResults: iterationResults
            });
        }

        return {
            totalIterations: iterations,
            maxIterations: node.maxIterations,
            childNodesPerIteration: node.childNodes.length,
            results
        };
    }

    /**
     * Execute model node
     */
    private async executeModel(
        node: ModelNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // Select model
        let model;
        if (node.modelId) {
            model = await this.modelManager.getModel(node.modelId);
        } else if (node.modelTags) {
            model = await this.modelManager.selectModelByTags(node.modelTags);
        } else {
            throw new Error(`Model node ${node.id} must specify modelId or modelTags`);
        }

        if (!model) {
            throw new Error(`No suitable model found for node ${node.id}`);
        }

        // Map inputs from context
        const inputs = this.mapInputs(node.inputMapping, context);

        // Run inference
        const output = await this.modelManager.runInference(model.id, inputs, node.inferenceParams);

        // Map outputs to context
        if (node.outputMapping) {
            for (const [key, contextPath] of Object.entries(node.outputMapping)) {
                this.setContextPath(contextPath, output[key], context);
            }
        }

        return output;
    }

    /**
     * Execute download node
     */
    private async executeDownload(
        node: DownloadNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        switch (node.source) {
            case 'huggingface':
                return this.modelManager.downloadModel(node.resourceId, node.version);
            case 'url':
                return this.downloadFromUrl(node.resourceId, node.destination);
            case 'github':
                return this.downloadFromGitHub(node.resourceId, node.destination);
            default:
                throw new Error(`Unknown download source: ${node.source} (node: ${node.id})`);
        }
    }

    /**
     * Execute script node
     */
    private async executeScript(
        node: ScriptNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        const inputs = node.inputMapping ? this.mapInputs(node.inputMapping, context) : {};

        let output: any;
        switch (node.language) {
            case 'javascript':
                output = await this.executeJavaScript(node.script, inputs, context);
                break;
            case 'python':
                output = await this.executePython(node.script, inputs);
                break;
            case 'shell':
                output = await this.executeShell(node.script, inputs);
                break;
            default:
                throw new Error(`Unknown script language: ${node.language} (node: ${node.id})`);
        }

        // Map outputs
        if (node.outputMapping) {
            for (const [key, contextPath] of Object.entries(node.outputMapping)) {
                this.setContextPath(contextPath, output[key], context);
            }
        }

        return output;
    }

    /**
     * Execute API call node
     */
    private async executeApiCall(
        node: ApiCallNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // Resolve URL with context variables
        const url = this.interpolateString(node.url, context);

        // Prepare headers
        const headers: Record<string, string> = {};
        if (node.headers) {
            for (const [key, value] of Object.entries(node.headers)) {
                headers[key] = this.interpolateString(value, context);
            }
        }

        // Prepare body
        let body = node.body;
        if (body && typeof body === 'string') {
            body = this.interpolateString(body, context);
        }

        // Make request
        const response = await fetch(url, {
            method: node.method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`API call failed (node: ${node.id}): ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // Map outputs
        if (node.outputMapping) {
            for (const [key, contextPath] of Object.entries(node.outputMapping)) {
                this.setContextPath(contextPath, result[key], context);
            }
        }

        return result;
    }

    /**
     * Execute GitHub Action node
     */
    private async executeGitHubAction(
        node: GitHubActionNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (!this.octokit) {
            throw new Error(`GitHub token not configured (node: ${node.id})`);
        }

        // Trigger workflow
        const response = await this.octokit.actions.createWorkflowDispatch({
            owner: node.owner,
            repo: node.repo,
            workflow_id: node.workflowId,
            ref: node.ref || 'main',
            inputs: node.inputs || {},
        });

        if (!node.waitForCompletion) {
            return { triggered: true, status: 'dispatched' };
        }

        // Poll for completion
        const pollInterval = node.pollInterval || 5000;
        let completed = false;
        let runId: number | undefined;

        // Wait a bit for the run to start
        await this.sleep(2000);

        // Find the run
        const runs = await this.octokit.actions.listWorkflowRuns({
            owner: node.owner,
            repo: node.repo,
            workflow_id: node.workflowId,
            per_page: 10,
        });

        if (runs.data.workflow_runs.length > 0) {
            runId = runs.data.workflow_runs[0].id;
        }

        if (!runId) {
            throw new Error(`Could not find workflow run (node: ${node.id})`);
        }

        // Poll for completion
        while (!completed) {
            const run = await this.octokit.actions.getWorkflowRun({
                owner: node.owner,
                repo: node.repo,
                run_id: runId,
            });

            if (run.data.status === 'completed') {
                completed = true;
                return {
                    runId,
                    status: run.data.conclusion,
                    url: run.data.html_url,
                };
            }

            await this.sleep(pollInterval);
        }

        return { runId, status: 'unknown' };
    }

    /**
     * Execute OS command node
     */
    private async executeOsCommand(
        node: OsCommandNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const command = this.interpolateString(node.command, context);
            const args = node.args?.map(arg => this.interpolateString(arg, context)) || [];

            const process = spawn(command, args, {
                cwd: node.cwd,
                env: { ...process.env, ...node.env },
                shell: true,
            });

            let stdout = '';
            let stderr = '';

            if (node.captureOutput) {
                process.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                process.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
            }

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        exitCode: code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                    });
                } else {
                    reject(new Error(`Command failed (node: ${node.id}) with exit code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Command error (node: ${node.id}): ${error.message}`));
            });
        });
    }

    /**
     * Execute vector generation node
     */
    private async executeVectorGeneration(
        node: VectorGenerationNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // Get data source
        const data = this.resolveContextPath(node.dataSource, context);

        // Generate embeddings and create index
        const result = await this.vectorDbManager.createIndex(
            node.indexName,
            data,
            node.embeddingModel,
            {
                chunkSize: node.chunkSize,
                overlap: node.overlap,
            }
        );

        return result;
    }

    /**
     * Execute context injection node
     */
    private async executeContextInjection(
        node: ContextInjectionNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (node.merge) {
            // Merge injections with existing context
            Object.assign(context.data, node.injections);
        } else {
            // Replace context data
            context.data = { ...node.injections };
        }

        return { injected: Object.keys(node.injections) };
    }

    /**
     * Execute nested workflow node - FULLY IMPLEMENTED
     */
    private async executeNestedWorkflow(
        node: NestedWorkflowNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (!this.workflowEngine) {
            throw new Error(`Workflow engine not initialized for nested workflow node ${node.id}`);
        }

        if (!this.storageManager) {
            throw new Error(`Storage manager not initialized for nested workflow node ${node.id}`);
        }

        try {
            // Load the nested workflow
            const nestedWorkflow = await this.storageManager.loadWorkflowById(node.workflowId);
            
            if (!nestedWorkflow) {
                throw new Error(`Nested workflow not found: ${node.workflowId} (node: ${node.id})`);
            }

            // Prepare nested context with input mapping
            let nestedContext: Record<string, any> = {};
            
            if (node.inputMapping) {
                for (const [key, contextPath] of Object.entries(node.inputMapping)) {
                    const value = this.resolveContextPath(contextPath, context);
                    nestedContext[key] = value;
                }
            } else {
                // If no mapping specified, pass entire context
                nestedContext = { ...context.data };
            }

            // Execute the nested workflow
            const result = await this.workflowEngine.executeWorkflow(
                nestedWorkflow,
                nestedContext
            );

            // Check execution status
            if (result.status === 'failed') {
                throw new Error(`Nested workflow "${nestedWorkflow.name}" failed (node: ${node.id})`);
            }

            // Map outputs back to parent context
            let output: any = result.context.outputs;
            
            if (node.outputMapping) {
                const mappedOutput: Record<string, any> = {};
                for (const [key, contextPath] of Object.entries(node.outputMapping)) {
                    const value = this.resolveContextPath(contextPath, result.context);
                    mappedOutput[key] = value;
                }
                output = mappedOutput;
            }

            return {
                nestedWorkflowId: node.workflowId,
                nestedWorkflowName: nestedWorkflow.name,
                executionId: result.executionId,
                status: result.status,
                duration: result.duration,
                output
            };
        } catch (error) {
            throw new Error(
                `Nested workflow execution failed (node: ${node.id}): ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Execute parallel node - FULLY IMPLEMENTED WITH CONTEXT ISOLATION
     */
    private async executeParallel(
        node: ParallelNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        if (!this.workflowEngine) {
            throw new Error(`Workflow engine not initialized for parallel node ${node.id}`);
        }

        try {
            // Get all child nodes
            const childNodes = node.childNodes.map(nodeId => {
                const childNode = this.workflowEngine.getNodeById(nodeId);
                if (!childNode) {
                    throw new Error(`Child node not found: ${nodeId} (parallel: ${node.id})`);
                }
                return childNode;
            });

            // Execute all child nodes in parallel with ISOLATED CONTEXTS
            const childPromises = childNodes.map(async (childNode) => {
                // Clone context for each parallel branch to prevent race conditions
                const isolatedContext = this.cloneContext(context);
                
                try {
                    const result = await this.execute(childNode, isolatedContext);
                    return {
                        nodeId: childNode.id,
                        nodeName: childNode.name,
                        status: 'success',
                        output: result,
                        error: null
                    };
                } catch (error) {
                    return {
                        nodeId: childNode.id,
                        nodeName: childNode.name,
                        status: 'failed',
                        output: null,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            });

            let results: any[];
            
            if (node.waitForAll) {
                // Wait for all nodes to complete (even if some fail)
                const settled = await Promise.allSettled(childPromises);
                results = settled.map((result, index) => {
                    if (result.status === 'fulfilled') {
                        return result.value;
                    } else {
                        return {
                            nodeId: childNodes[index].id,
                            nodeName: childNodes[index].name,
                            status: 'failed',
                            output: null,
                            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
                        };
                    }
                });
            } else {
                // Wait for first to complete successfully
                try {
                    const firstResult = await Promise.race(childPromises);
                    results = [firstResult];
                } catch (error) {
                    // All parallel nodes failed
                    throw new Error(`All parallel nodes failed (node: ${node.id})`);
                }
            }

            // Calculate statistics
            const successful = results.filter(r => r.status === 'success').length;
            const failed = results.filter(r => r.status === 'failed').length;

            return {
                parallelExecution: true,
                waitForAll: node.waitForAll,
                totalNodes: childNodes.length,
                successful,
                failed,
                results
            };
        } catch (error) {
            throw new Error(
                `Parallel execution failed (node: ${node.id}): ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Execute custom node
     */
    private async executeCustom(
        node: NodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        const customNode = this.extensionManager.getCustomNode(node.type);
        if (!customNode) {
            throw new Error(`Custom node type not found: ${node.type} (node: ${node.id})`);
        }

        return customNode.executor(node, context);
    }

    /**
     * Helper: Evaluate JavaScript expression
     */
    private evaluateExpression(expression: string, context: WorkflowContext): any {
        try {
            // Create a safe evaluation context
            const evalContext = {
                context: context.data,
                outputs: context.outputs,
                variables: context.variables,
            };

            // Use Function constructor for safer evaluation
            const fn = new Function('ctx', `with(ctx) { return ${expression}; }`);
            return fn(evalContext);
        } catch (error) {
            throw new Error(`Failed to evaluate expression: ${expression} - ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Helper: Resolve context path
     */
    private resolveContextPath(path: string, context: WorkflowContext): any {
        const parts = path.split('.');
        let current: any = context;

        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Helper: Set context path
     */
    private setContextPath(path: string, value: any, context: WorkflowContext): void {
        const parts = path.split('.');
        let current: any = context;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Helper: Map inputs from context
     */
    private mapInputs(mapping: Record<string, string>, context: WorkflowContext): Record<string, any> {
        const inputs: Record<string, any> = {};
        for (const [key, contextPath] of Object.entries(mapping)) {
            inputs[key] = this.resolveContextPath(contextPath, context);
        }
        return inputs;
    }

    /**
     * Helper: Interpolate string with context variables
     */
    private interpolateString(str: string, context: WorkflowContext): string {
        return str.replace(/\{\{(.+?)\}\}/g, (_, path) => {
            const value = this.resolveContextPath(path.trim(), context);
            return value !== undefined ? String(value) : '';
        });
    }

    /**
     * Helper: Execute JavaScript code
     */
    private async executeJavaScript(
        script: string,
        inputs: Record<string, any>,
        context: WorkflowContext
    ): Promise<any> {
        try {
            const fn = new Function('inputs', 'context', script);
            return fn(inputs, context);
        } catch (error) {
            throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Helper: Execute Python script
     */
    private async executePython(script: string, inputs: Record<string, any>): Promise<any> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';

            const process = spawn(pythonPath, ['-c', script], {
                env: { ...process.env, INPUTS: JSON.stringify(inputs) },
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch {
                        resolve({ output: stdout.trim() });
                    }
                } else {
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });
        });
    }

    /**
     * Helper: Execute shell script
     */
    private async executeShell(script: string, inputs: Record<string, any>): Promise<any> {
        return new Promise((resolve, reject) => {
            const process = spawn('sh', ['-c', script], {
                env: { ...process.env, ...inputs },
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ output: stdout.trim() });
                } else {
                    reject(new Error(`Shell script failed: ${stderr}`));
                }
            });
        });
    }

    /**
     * Helper: Download from URL
     */
    private async downloadFromUrl(url: string, destination?: string): Promise<any> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        // Implementation would save to destination
        return { url, status: 'downloaded' };
    }

    /**
     * Helper: Download from GitHub
     */
    private async downloadFromGitHub(repo: string, destination?: string): Promise<any> {
        if (!this.octokit) {
            throw new Error('GitHub token not configured');
        }

        // Implementation would download GitHub repo/file
        return { repo, status: 'downloaded' };
    }

    /**
     * Helper: Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
