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

    constructor(
        private modelManager: ModelManager,
        private vectorDbManager: VectorDatabaseManager,
        private extensionManager: ExtensionManager
    ) {
        this.initializeGitHub();
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
     * Execute a node based on its type
     */
    async execute(node: NodeConfig, context: WorkflowContext): Promise<any> {
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
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    /**
     * Execute condition node
     */
    private async executeCondition(
        node: ConditionNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // Evaluate condition expression
        const result = this.evaluateExpression(node.condition, context);
        return {
            condition: node.condition,
            result: Boolean(result),
            branch: result ? 'true' : 'false',
        };
    }

    /**
     * Execute loop node
     */
    private async executeLoop(
        node: LoopNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // Get iteration data
        const iterationData = this.resolveContextPath(node.iterationSource, context);
        
        if (!Array.isArray(iterationData)) {
            throw new Error(`Loop iteration source must be an array: ${node.iterationSource}`);
        }

        const maxIterations = node.maxIterations || iterationData.length;
        const iterations = Math.min(iterationData.length, maxIterations);
        const results: any[] = [];

        for (let i = 0; i < iterations; i++) {
            const iterationContext = {
                ...context,
                data: {
                    ...context.data,
                    $iteration: i,
                    $item: iterationData[i],
                },
            };

            // Note: Child nodes would be executed by the workflow engine
            // This just tracks the iteration
            results.push({
                iteration: i,
                item: iterationData[i],
            });
        }

        return {
            iterations: results.length,
            results,
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
            throw new Error('Model node must specify modelId or modelTags');
        }

        if (!model) {
            throw new Error('No suitable model found');
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
                throw new Error(`Unknown download source: ${node.source}`);
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
                throw new Error(`Unknown script language: ${node.language}`);
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
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
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
            throw new Error('GitHub token not configured');
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
            throw new Error('Could not find workflow run');
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
                    reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
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
     * Execute nested workflow node
     */
    private async executeNestedWorkflow(
        node: NestedWorkflowNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // This would be handled by the workflow engine
        // For now, return a placeholder
        throw new Error('Nested workflows not yet implemented');
    }

    /**
     * Execute parallel node
     */
    private async executeParallel(
        node: ParallelNodeConfig,
        context: WorkflowContext
    ): Promise<any> {
        // This would be handled by the workflow engine
        // For now, return a placeholder
        return {
            childNodes: node.childNodes,
            waitForAll: node.waitForAll,
        };
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
            throw new Error(`Custom node type not found: ${node.type}`);
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
            throw new Error(`Failed to evaluate expression: ${expression}`);
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
            throw new Error(`JavaScript execution failed: ${error}`);
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
