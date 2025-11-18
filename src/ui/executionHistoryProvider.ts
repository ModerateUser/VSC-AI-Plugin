/**
 * Execution History Provider - tracks and displays workflow execution history
 */

import * as vscode from 'vscode';

/**
 * Execution record interface
 */
export interface ExecutionRecord {
    executionId: string;
    workflowName: string;
    workflowId: string;
    status: 'success' | 'failed' | 'partial';
    timestamp: Date;
    duration: number;
    nodeResults?: Map<string, any>;
}

/**
 * Execution History Tree Item
 */
class ExecutionHistoryItem extends vscode.TreeItem {
    constructor(
        public readonly record: ExecutionRecord,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(record.workflowName, collapsibleState);
        
        // Format timestamp
        const date = new Date(record.timestamp);
        this.description = date.toLocaleString();
        
        // Create tooltip with details
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**Workflow:** ${record.workflowName}\n\n`);
        this.tooltip.appendMarkdown(`**Status:** ${record.status}\n\n`);
        this.tooltip.appendMarkdown(`**Duration:** ${this.formatDuration(record.duration)}\n\n`);
        this.tooltip.appendMarkdown(`**Execution ID:** ${record.executionId}\n\n`);
        this.tooltip.appendMarkdown(`**Time:** ${date.toLocaleString()}`);
        
        // Set icon based on status
        this.iconPath = new vscode.ThemeIcon(
            record.status === 'success' ? 'check' : 
            record.status === 'failed' ? 'error' : 
            'warning',
            record.status === 'success' ? new vscode.ThemeColor('testing.iconPassed') :
            record.status === 'failed' ? new vscode.ThemeColor('testing.iconFailed') :
            new vscode.ThemeColor('testing.iconQueued')
        );
        
        this.contextValue = 'execution';
        
        // Add command to view execution details
        this.command = {
            command: 'agenticWorkflow.viewExecutionResult',
            title: 'View Execution Result',
            arguments: [record]
        };
    }

    private formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}m ${seconds}s`;
        }
    }
}

/**
 * Execution History Provider
 */
export class ExecutionHistoryProvider implements vscode.TreeDataProvider<ExecutionHistoryItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ExecutionHistoryItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private executions: ExecutionRecord[] = [];
    private readonly maxHistorySize = 100;

    constructor(private context: vscode.ExtensionContext) {
        this.loadHistory();
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item
     */
    getTreeItem(element: ExecutionHistoryItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children (root level only - flat list of executions)
     */
    async getChildren(element?: ExecutionHistoryItem): Promise<ExecutionHistoryItem[]> {
        if (element) {
            // No children for execution items
            return [];
        }

        // Return all executions sorted by timestamp (newest first)
        return this.executions
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(record => new ExecutionHistoryItem(record));
    }

    /**
     * Add a new execution to history
     */
    addExecution(execution: ExecutionRecord): void {
        // Add to beginning of array
        this.executions.unshift(execution);
        
        // Trim to max size
        if (this.executions.length > this.maxHistorySize) {
            this.executions = this.executions.slice(0, this.maxHistorySize);
        }
        
        // Save and refresh
        this.saveHistory();
        this.refresh();
    }

    /**
     * Clear all execution history
     */
    clearHistory(): void {
        this.executions = [];
        this.saveHistory();
        this.refresh();
    }

    /**
     * Get execution by ID
     */
    getExecution(executionId: string): ExecutionRecord | undefined {
        return this.executions.find(e => e.executionId === executionId);
    }

    /**
     * Get all executions for a specific workflow
     */
    getWorkflowExecutions(workflowId: string): ExecutionRecord[] {
        return this.executions.filter(e => e.workflowId === workflowId);
    }

    /**
     * Get execution statistics
     */
    getStatistics(): {
        total: number;
        successful: number;
        failed: number;
        partial: number;
        averageDuration: number;
    } {
        const total = this.executions.length;
        const successful = this.executions.filter(e => e.status === 'success').length;
        const failed = this.executions.filter(e => e.status === 'failed').length;
        const partial = this.executions.filter(e => e.status === 'partial').length;
        const averageDuration = total > 0 
            ? this.executions.reduce((sum, e) => sum + e.duration, 0) / total 
            : 0;

        return {
            total,
            successful,
            failed,
            partial,
            averageDuration
        };
    }

    /**
     * Load history from storage
     */
    private loadHistory(): void {
        try {
            const stored = this.context.globalState.get<ExecutionRecord[]>('executionHistory', []);
            // Convert timestamp strings back to Date objects
            this.executions = stored.map(record => ({
                ...record,
                timestamp: new Date(record.timestamp)
            }));
        } catch (error) {
            console.error('Failed to load execution history:', error);
            this.executions = [];
        }
    }

    /**
     * Save history to storage
     */
    private saveHistory(): void {
        try {
            this.context.globalState.update('executionHistory', this.executions);
        } catch (error) {
            console.error('Failed to save execution history:', error);
        }
    }

    /**
     * Export history to JSON
     */
    async exportHistory(): Promise<string> {
        return JSON.stringify(this.executions, null, 2);
    }

    /**
     * Import history from JSON
     */
    async importHistory(json: string): Promise<void> {
        try {
            const imported = JSON.parse(json) as ExecutionRecord[];
            // Validate and convert timestamps
            const validated = imported.map(record => ({
                ...record,
                timestamp: new Date(record.timestamp)
            }));
            
            this.executions = validated;
            this.saveHistory();
            this.refresh();
        } catch (error) {
            throw new Error(`Failed to import history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
