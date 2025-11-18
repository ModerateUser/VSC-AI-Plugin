/**
 * Workflow Editor Provider - provides custom editor for workflow files
 */

import * as vscode from 'vscode';
import { WorkflowEngine } from '../engine/workflowEngine';
import { WorkflowStorageManager } from '../storage/workflowStorageManager';
import { WorkflowDefinition } from '../types/workflow';

/**
 * Workflow Editor Provider - custom editor for .workflow.json/yaml files
 */
export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
    constructor(
        private context: vscode.ExtensionContext,
        private workflowEngine: WorkflowEngine,
        private storageManager: WorkflowStorageManager
    ) {}

    /**
     * Resolve custom text editor
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview options
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
            ],
        };

        // Set webview HTML content
        webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview);

        // Load workflow from document
        let workflow: WorkflowDefinition;
        try {
            workflow = JSON.parse(document.getText());
        } catch (error) {
            vscode.window.showErrorMessage('Failed to parse workflow file');
            return;
        }

        // Send initial workflow data to webview
        webviewPanel.webview.postMessage({
            type: 'loadWorkflow',
            workflow,
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'updateWorkflow':
                        await this.updateWorkflow(document, message.workflow);
                        break;

                    case 'executeWorkflow':
                        await this.executeWorkflow(message.workflow);
                        break;

                    case 'validateWorkflow':
                        await this.validateWorkflow(message.workflow, webviewPanel.webview);
                        break;

                    case 'addNode':
                        await this.addNode(document, message.node);
                        break;

                    case 'deleteNode':
                        await this.deleteNode(document, message.nodeId);
                        break;

                    case 'updateNode':
                        await this.updateNode(document, message.node);
                        break;

                    case 'ready':
                        // Webview is ready, send current workflow
                        webviewPanel.webview.postMessage({
                            type: 'loadWorkflow',
                            workflow,
                        });
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Update webview when document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
            (e) => {
                if (e.document.uri.toString() === document.uri.toString()) {
                    try {
                        const updatedWorkflow = JSON.parse(e.document.getText());
                        webviewPanel.webview.postMessage({
                            type: 'loadWorkflow',
                            workflow: updatedWorkflow,
                        });
                    } catch (error) {
                        // Ignore parse errors during editing
                    }
                }
            }
        );

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    /**
     * Update workflow in document
     */
    private async updateWorkflow(
        document: vscode.TextDocument,
        workflow: WorkflowDefinition
    ): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        edit.replace(document.uri, fullRange, JSON.stringify(workflow, null, 2));
        await vscode.workspace.applyEdit(edit);
    }

    /**
     * Execute workflow
     */
    private async executeWorkflow(workflow: WorkflowDefinition): Promise<void> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Executing workflow: ${workflow.name}`,
                    cancellable: true,
                },
                async (progress, token) => {
                    const result = await this.workflowEngine.executeWorkflow(
                        workflow,
                        {},
                        token
                    );

                    if (result.status === 'success') {
                        vscode.window.showInformationMessage(
                            `Workflow "${workflow.name}" completed successfully`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Workflow "${workflow.name}" failed or completed partially`
                        );
                    }

                    // Show results
                    const doc = await vscode.workspace.openTextDocument({
                        content: JSON.stringify(result, null, 2),
                        language: 'json',
                    });
                    await vscode.window.showTextDocument(doc);
                }
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to execute workflow: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Validate workflow
     */
    private async validateWorkflow(
        workflow: WorkflowDefinition,
        webview: vscode.Webview
    ): Promise<void> {
        try {
            // Basic validation
            const errors: string[] = [];

            if (!workflow.name) {
                errors.push('Workflow must have a name');
            }

            if (!workflow.nodes || workflow.nodes.length === 0) {
                errors.push('Workflow must have at least one node');
            }

            if (!workflow.entryNodes || workflow.entryNodes.length === 0) {
                errors.push('Workflow must have at least one entry node');
            }

            // Check for duplicate node IDs
            const nodeIds = new Set<string>();
            for (const node of workflow.nodes) {
                if (nodeIds.has(node.id)) {
                    errors.push(`Duplicate node ID: ${node.id}`);
                }
                nodeIds.add(node.id);
            }

            // Check for invalid dependencies
            for (const node of workflow.nodes) {
                for (const depId of node.dependencies) {
                    if (!nodeIds.has(depId)) {
                        errors.push(`Node ${node.id} has invalid dependency: ${depId}`);
                    }
                }
            }

            // Send validation results to webview
            webview.postMessage({
                type: 'validationResult',
                valid: errors.length === 0,
                errors,
            });

            if (errors.length === 0) {
                vscode.window.showInformationMessage('Workflow is valid');
            } else {
                vscode.window.showWarningMessage(
                    `Workflow has ${errors.length} validation error(s)`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Add node to workflow
     */
    private async addNode(document: vscode.TextDocument, node: any): Promise<void> {
        try {
            const workflow = JSON.parse(document.getText());
            workflow.nodes.push(node);
            await this.updateWorkflow(document, workflow);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to add node: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Delete node from workflow
     */
    private async deleteNode(document: vscode.TextDocument, nodeId: string): Promise<void> {
        try {
            const workflow = JSON.parse(document.getText());
            workflow.nodes = workflow.nodes.filter((n: any) => n.id !== nodeId);
            
            // Remove from entry nodes if present
            workflow.entryNodes = workflow.entryNodes.filter((id: string) => id !== nodeId);
            
            // Remove from dependencies
            for (const node of workflow.nodes) {
                node.dependencies = node.dependencies.filter((id: string) => id !== nodeId);
            }

            await this.updateWorkflow(document, workflow);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to delete node: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Update node in workflow
     */
    private async updateNode(document: vscode.TextDocument, updatedNode: any): Promise<void> {
        try {
            const workflow = JSON.parse(document.getText());
            const index = workflow.nodes.findIndex((n: any) => n.id === updatedNode.id);
            
            if (index !== -1) {
                workflow.nodes[index] = updatedNode;
                await this.updateWorkflow(document, workflow);
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to update node: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get webview HTML content
     */
    private getWebviewContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Editor</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        #container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #toolbar {
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
        }
        
        button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 2px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        #editor {
            flex: 1;
            padding: 20px;
            overflow: auto;
        }
        
        .workflow-info {
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        
        .node-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .node-card {
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
        }
        
        .node-card:hover {
            border-color: var(--vscode-focusBorder);
        }
        
        .node-type {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        
        .node-name {
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .node-dependencies {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .placeholder {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="toolbar">
            <button onclick="executeWorkflow()">▶ Execute</button>
            <button onclick="validateWorkflow()">✓ Validate</button>
            <button onclick="addNode()">+ Add Node</button>
            <button onclick="refreshView()">↻ Refresh</button>
        </div>
        <div id="editor">
            <div class="placeholder">Loading workflow...</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentWorkflow = null;

        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'loadWorkflow':
                    currentWorkflow = message.workflow;
                    renderWorkflow(currentWorkflow);
                    break;
                    
                case 'validationResult':
                    showValidationResult(message.valid, message.errors);
                    break;
            }
        });

        function renderWorkflow(workflow) {
            const editor = document.getElementById('editor');
            
            if (!workflow) {
                editor.innerHTML = '<div class="placeholder">No workflow loaded</div>';
                return;
            }

            let html = \`
                <div class="workflow-info">
                    <h2>\${workflow.name}</h2>
                    <p>\${workflow.description || 'No description'}</p>
                    <p><strong>Version:</strong> \${workflow.version}</p>
                    <p><strong>Nodes:</strong> \${workflow.nodes.length}</p>
                    <p><strong>Entry Nodes:</strong> \${workflow.entryNodes.join(', ')}</p>
                </div>
                <h3>Nodes</h3>
            \`;

            if (workflow.nodes.length === 0) {
                html += '<div class="placeholder">No nodes in workflow. Click "Add Node" to get started.</div>';
            } else {
                html += '<div class="node-list">';
                for (const node of workflow.nodes) {
                    html += \`
                        <div class="node-card" onclick="selectNode('\${node.id}')">
                            <div class="node-type">\${node.type}</div>
                            <div class="node-name">\${node.name}</div>
                            <div class="node-dependencies">
                                Dependencies: \${node.dependencies.length > 0 ? node.dependencies.join(', ') : 'None'}
                            </div>
                        </div>
                    \`;
                }
                html += '</div>';
            }

            editor.innerHTML = html;
        }

        function executeWorkflow() {
            if (currentWorkflow) {
                vscode.postMessage({
                    type: 'executeWorkflow',
                    workflow: currentWorkflow
                });
            }
        }

        function validateWorkflow() {
            if (currentWorkflow) {
                vscode.postMessage({
                    type: 'validateWorkflow',
                    workflow: currentWorkflow
                });
            }
        }

        function addNode() {
            // This would open a node creation dialog
            // For now, just show a message
            alert('Node creation UI coming soon! Edit the JSON directly for now.');
        }

        function selectNode(nodeId) {
            // This would open node details/editor
            alert('Node editor coming soon! Node ID: ' + nodeId);
        }

        function refreshView() {
            if (currentWorkflow) {
                renderWorkflow(currentWorkflow);
            }
        }

        function showValidationResult(valid, errors) {
            if (valid) {
                // Visual feedback for valid workflow
                return;
            }
            
            // Show errors in editor
            const editor = document.getElementById('editor');
            let errorHtml = '<div style="color: var(--vscode-errorForeground); padding: 20px;">';
            errorHtml += '<h3>Validation Errors:</h3><ul>';
            for (const error of errors) {
                errorHtml += \`<li>\${error}</li>\`;
            }
            errorHtml += '</ul></div>';
            editor.insertAdjacentHTML('afterbegin', errorHtml);
        }
    </script>
</body>
</html>`;
    }
}
