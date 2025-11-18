/**
 * Workflow Storage Manager - handles workflow persistence, import/export
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowDefinition, WorkflowExport } from '../types/workflow';

/**
 * Workflow Storage Manager
 */
export class WorkflowStorageManager {
    // Workflow cache for performance optimization
    private workflowCache = new Map<string, { workflow: WorkflowDefinition; uri: vscode.Uri; lastModified: number }>();
    private cacheInitialized = false;

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Initialize workflow cache
     */
    private async initializeCache(): Promise<void> {
        if (this.cacheInitialized) {
            return;
        }

        const workflows = await this.listWorkflows();
        for (const workflowInfo of workflows) {
            try {
                const workflow = await this.loadWorkflow(workflowInfo.uri);
                const stat = await vscode.workspace.fs.stat(workflowInfo.uri);
                this.workflowCache.set(workflow.id, {
                    workflow,
                    uri: workflowInfo.uri,
                    lastModified: stat.mtime
                });
            } catch (error) {
                console.error(`Failed to cache workflow ${workflowInfo.uri.fsPath}:`, error);
            }
        }

        this.cacheInitialized = true;
    }

    /**
     * Refresh workflow cache
     */
    async refreshCache(): Promise<void> {
        this.workflowCache.clear();
        this.cacheInitialized = false;
        await this.initializeCache();
    }

    /**
     * Load workflow by ID (with caching)
     * CRITICAL: Required for nested workflow execution
     */
    async loadWorkflowById(workflowId: string): Promise<WorkflowDefinition | null> {
        // Initialize cache if needed
        await this.initializeCache();

        // Check cache first
        const cached = this.workflowCache.get(workflowId);
        if (cached) {
            // Verify file hasn't been modified
            try {
                const stat = await vscode.workspace.fs.stat(cached.uri);
                if (stat.mtime === cached.lastModified) {
                    return cached.workflow;
                }
                // File modified, reload
                const workflow = await this.loadWorkflow(cached.uri);
                this.workflowCache.set(workflowId, {
                    workflow,
                    uri: cached.uri,
                    lastModified: stat.mtime
                });
                return workflow;
            } catch (error) {
                // File deleted or inaccessible, remove from cache
                this.workflowCache.delete(workflowId);
            }
        }

        // Not in cache, search all workflows
        const workflows = await this.listWorkflows();
        for (const workflowInfo of workflows) {
            try {
                const workflow = await this.loadWorkflow(workflowInfo.uri);
                if (workflow.id === workflowId) {
                    // Add to cache
                    const stat = await vscode.workspace.fs.stat(workflowInfo.uri);
                    this.workflowCache.set(workflowId, {
                        workflow,
                        uri: workflowInfo.uri,
                        lastModified: stat.mtime
                    });
                    return workflow;
                }
            } catch (error) {
                console.error(`Failed to load workflow ${workflowInfo.uri.fsPath}:`, error);
            }
        }

        return null;
    }

    /**
     * Create a new workflow
     */
    createNewWorkflow(name: string): WorkflowDefinition {
        return {
            id: uuidv4(),
            name,
            description: '',
            version: '1.0.0',
            nodes: [],
            entryNodes: [],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    /**
     * Load workflow from file
     */
    async loadWorkflow(uri: vscode.Uri): Promise<WorkflowDefinition> {
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(content).toString('utf-8');

            // Determine format based on file extension
            const ext = path.extname(uri.fsPath).toLowerCase();

            let workflow: WorkflowDefinition;
            if (ext === '.yaml' || ext === '.yml') {
                workflow = yaml.load(text) as WorkflowDefinition;
            } else {
                workflow = JSON.parse(text);
            }

            // Validate workflow structure
            this.validateWorkflow(workflow);

            return workflow;
        } catch (error) {
            throw new Error(`Failed to load workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Save workflow to file
     */
    async saveWorkflow(uri: vscode.Uri, workflow: WorkflowDefinition): Promise<void> {
        try {
            // Update timestamp
            workflow.updatedAt = new Date();

            // Determine format based on file extension
            const ext = path.extname(uri.fsPath).toLowerCase();

            let content: string;
            if (ext === '.yaml' || ext === '.yml') {
                content = yaml.dump(workflow, { indent: 2 });
            } else {
                content = JSON.stringify(workflow, null, 2);
            }

            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));

            // Update cache
            const stat = await vscode.workspace.fs.stat(uri);
            this.workflowCache.set(workflow.id, {
                workflow,
                uri,
                lastModified: stat.mtime
            });
        } catch (error) {
            throw new Error(`Failed to save workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Import workflow from file
     */
    async importWorkflow(uri: vscode.Uri): Promise<WorkflowDefinition> {
        const workflow = await this.loadWorkflow(uri);

        // Generate new ID for imported workflow
        workflow.id = uuidv4();
        workflow.createdAt = new Date();
        workflow.updatedAt = new Date();

        // Invalidate cache since we have a new workflow
        this.cacheInitialized = false;

        return workflow;
    }

    /**
     * Export workflow to file
     */
    async exportWorkflow(
        sourceUri: vscode.Uri,
        targetUri: vscode.Uri,
        format: 'json' | 'yaml'
    ): Promise<void> {
        const workflow = await this.loadWorkflow(sourceUri);

        const exportData: WorkflowExport = {
            format,
            version: '1.0.0',
            workflow,
            exportedAt: new Date(),
        };

        let content: string;
        if (format === 'yaml') {
            content = yaml.dump(exportData, { indent: 2 });
        } else {
            content = JSON.stringify(exportData, null, 2);
        }

        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(content, 'utf-8'));
    }

    /**
     * List workflows in workspace
     */
    async listWorkflows(): Promise<Array<{ name: string; uri: vscode.Uri; description?: string }>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const workflows: Array<{ name: string; uri: vscode.Uri; description?: string }> = [];

        for (const folder of workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/*.workflow.{json,yaml,yml}');
            const files = await vscode.workspace.findFiles(pattern);

            for (const file of files) {
                try {
                    const workflow = await this.loadWorkflow(file);
                    workflows.push({
                        name: workflow.name,
                        uri: file,
                        description: workflow.description,
                    });
                } catch (error) {
                    console.error(`Failed to load workflow ${file.fsPath}:`, error);
                }
            }
        }

        return workflows;
    }

    /**
     * Validate workflow structure
     */
    private validateWorkflow(workflow: any): void {
        if (!workflow.id) {
            throw new Error('Workflow must have an id');
        }
        if (!workflow.name) {
            throw new Error('Workflow must have a name');
        }
        if (!workflow.version) {
            throw new Error('Workflow must have a version');
        }
        if (!Array.isArray(workflow.nodes)) {
            throw new Error('Workflow must have a nodes array');
        }
        if (!Array.isArray(workflow.entryNodes)) {
            throw new Error('Workflow must have an entryNodes array');
        }
    }

    /**
     * Clone workflow
     */
    async cloneWorkflow(workflow: WorkflowDefinition, newName: string): Promise<WorkflowDefinition> {
        const cloned: WorkflowDefinition = {
            ...workflow,
            id: uuidv4(),
            name: newName,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return cloned;
    }

    /**
     * Get workflow history (if versioning is implemented)
     */
    async getWorkflowHistory(workflowId: string): Promise<WorkflowDefinition[]> {
        // Placeholder for version history feature
        return [];
    }

    /**
     * Backup workflow
     */
    async backupWorkflow(uri: vscode.Uri): Promise<vscode.Uri> {
        const workflow = await this.loadWorkflow(uri);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${workflow.name}_backup_${timestamp}`;
        
        const backupUri = vscode.Uri.joinPath(
            uri,
            '..',
            `${backupName}.workflow.json`
        );

        await this.saveWorkflow(backupUri, workflow);
        return backupUri;
    }
}
