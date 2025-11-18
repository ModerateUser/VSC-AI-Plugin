/**
 * Workflow Editor Provider - provides visual node-based editor for workflow files
 */

import * as vscode from 'vscode';
import { WorkflowEngine } from '../engine/workflowEngine';
import { WorkflowStorageManager } from '../storage/workflowStorageManager';
import { WorkflowDefinition, NodeConfig } from '../types/workflow';

/**
 * Workflow Editor Provider - visual node-based editor for .workflow.json/yaml files
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

                    case 'updateConnection':
                        await this.updateConnection(document, message.connection);
                        break;

                    case 'deleteConnection':
                        await this.deleteConnection(document, message.connection);
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
     * Update connection (dependency) between nodes
     */
    private async updateConnection(document: vscode.TextDocument, connection: { source: string, target: string }): Promise<void> {
        try {
            const workflow = JSON.parse(document.getText());
            const targetNode = workflow.nodes.find((n: any) => n.id === connection.target);
            
            if (targetNode && !targetNode.dependencies.includes(connection.source)) {
                targetNode.dependencies.push(connection.source);
                await this.updateWorkflow(document, workflow);
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to update connection: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Delete connection (dependency) between nodes
     */
    private async deleteConnection(document: vscode.TextDocument, connection: { source: string, target: string }): Promise<void> {
        try {
            const workflow = JSON.parse(document.getText());
            const targetNode = workflow.nodes.find((n: any) => n.id === connection.target);
            
            if (targetNode) {
                targetNode.dependencies = targetNode.dependencies.filter((id: string) => id !== connection.source);
                await this.updateWorkflow(document, workflow);
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to delete connection: ${error instanceof Error ? error.message : String(error)}`
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
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            overflow: hidden;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* Toolbar */
        #toolbar {
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-shrink: 0;
        }
        
        button {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* Main content area */
        #main-content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Node palette */
        #node-palette {
            width: 200px;
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
            padding: 10px;
        }

        .palette-section {
            margin-bottom: 20px;
        }

        .palette-section h3 {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .palette-node {
            padding: 8px;
            margin-bottom: 5px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: grab;
            font-size: 12px;
        }

        .palette-node:hover {
            border-color: var(--vscode-focusBorder);
            background-color: var(--vscode-list-hoverBackground);
        }

        .palette-node:active {
            cursor: grabbing;
        }

        /* Canvas */
        #canvas-container {
            flex: 1;
            position: relative;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
        }

        #canvas {
            width: 100%;
            height: 100%;
            position: absolute;
            cursor: grab;
        }

        #canvas.panning {
            cursor: grabbing;
        }

        /* Nodes */
        .workflow-node {
            position: absolute;
            min-width: 180px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 2px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 12px;
            cursor: move;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .workflow-node.selected {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 2px var(--vscode-focusBorder);
        }

        .workflow-node.entry {
            border-color: var(--vscode-charts-green);
        }

        .node-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .node-type {
            font-size: 10px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .node-delete {
            background: none;
            border: none;
            color: var(--vscode-errorForeground);
            cursor: pointer;
            padding: 2px 6px;
            font-size: 16px;
            line-height: 1;
        }

        .node-delete:hover {
            background-color: var(--vscode-inputValidation-errorBackground);
        }

        .node-name {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
            word-wrap: break-word;
        }

        .node-id {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .node-dependencies {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        /* Connection ports */
        .node-port {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            position: absolute;
            background-color: var(--vscode-panel-border);
            border: 2px solid var(--vscode-editor-background);
            cursor: crosshair;
        }

        .node-port:hover {
            background-color: var(--vscode-focusBorder);
            transform: scale(1.3);
        }

        .node-port.input {
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        .node-port.output {
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        /* Connections (SVG) */
        #connections-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        }

        .connection-line {
            stroke: var(--vscode-panel-border);
            stroke-width: 2;
            fill: none;
            pointer-events: stroke;
            cursor: pointer;
        }

        .connection-line:hover {
            stroke: var(--vscode-focusBorder);
            stroke-width: 3;
        }

        .connection-line.selected {
            stroke: var(--vscode-focusBorder);
            stroke-width: 3;
        }

        .temp-connection {
            stroke: var(--vscode-textLink-foreground);
            stroke-width: 2;
            stroke-dasharray: 5, 5;
            fill: none;
        }

        /* Properties panel */
        #properties-panel {
            width: 300px;
            background-color: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
            padding: 15px;
            display: none;
        }

        #properties-panel.visible {
            display: block;
        }

        .property-group {
            margin-bottom: 20px;
        }

        .property-group h3 {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .property-field {
            margin-bottom: 12px;
        }

        .property-field label {
            display: block;
            font-size: 12px;
            margin-bottom: 4px;
            color: var(--vscode-descriptionForeground);
        }

        .property-field input,
        .property-field select,
        .property-field textarea {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }

        .property-field textarea {
            min-height: 80px;
            resize: vertical;
        }

        .property-field input:focus,
        .property-field select:focus,
        .property-field textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        /* Minimap */
        #minimap {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 200px;
            height: 150px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            opacity: 0.8;
            pointer-events: none;
        }

        /* Status bar */
        #status-bar {
            padding: 4px 10px;
            background-color: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .placeholder {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .placeholder-icon {
            font-size: 48px;
            margin-bottom: 10px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="toolbar">
            <button onclick="executeWorkflow()" title="Execute Workflow">▶ Execute</button>
            <button onclick="validateWorkflow()" title="Validate Workflow">✓ Validate</button>
            <button onclick="autoLayout()" title="Auto Layout">⚡ Auto Layout</button>
            <button onclick="zoomIn()" title="Zoom In">🔍+</button>
            <button onclick="zoomOut()" title="Zoom Out">🔍-</button>
            <button onclick="resetView()" title="Reset View">⟲ Reset</button>
            <button onclick="toggleProperties()" title="Toggle Properties">⚙ Properties</button>
        </div>
        
        <div id="main-content">
            <div id="node-palette">
                <div class="palette-section">
                    <h3>Basic Nodes</h3>
                    <div class="palette-node" draggable="true" data-node-type="input">📥 Input</div>
                    <div class="palette-node" draggable="true" data-node-type="output">📤 Output</div>
                    <div class="palette-node" draggable="true" data-node-type="transform">🔄 Transform</div>
                </div>
                
                <div class="palette-section">
                    <h3>Control Flow</h3>
                    <div class="palette-node" draggable="true" data-node-type="condition">❓ Condition</div>
                    <div class="palette-node" draggable="true" data-node-type="loop">🔁 Loop</div>
                    <div class="palette-node" draggable="true" data-node-type="parallel">⚡ Parallel</div>
                </div>
                
                <div class="palette-section">
                    <h3>AI & Data</h3>
                    <div class="palette-node" draggable="true" data-node-type="model">🤖 AI Model</div>
                    <div class="palette-node" draggable="true" data-node-type="embedding">🧠 Embedding</div>
                    <div class="palette-node" draggable="true" data-node-type="vector">🔍 Vector Search</div>
                </div>
                
                <div class="palette-section">
                    <h3>Integration</h3>
                    <div class="palette-node" draggable="true" data-node-type="api">🌐 API Call</div>
                    <div class="palette-node" draggable="true" data-node-type="script">📜 Script</div>
                    <div class="palette-node" draggable="true" data-node-type="github">🐙 GitHub</div>
                    <div class="palette-node" draggable="true" data-node-type="os">💻 OS Command</div>
                </div>
            </div>
            
            <div id="canvas-container">
                <svg id="connections-svg"></svg>
                <div id="canvas">
                    <div class="placeholder">
                        <div class="placeholder-icon">📊</div>
                        <div>Drag nodes from the palette to start building your workflow</div>
                    </div>
                </div>
                <div id="minimap"></div>
            </div>
            
            <div id="properties-panel">
                <div class="property-group">
                    <h3>Node Properties</h3>
                    <div id="properties-content">
                        <p style="color: var(--vscode-descriptionForeground); font-size: 12px;">
                            Select a node to edit its properties
                        </p>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="status-bar">
            <span id="status-nodes">Nodes: 0</span>
            <span id="status-zoom">Zoom: 100%</span>
            <span id="status-position">Position: 0, 0</span>
        </div>
    </div>

    <script src="${this.getWebviewScript()}"></script>
</body>
</html>`;
    }

    /**
     * Get webview script content
     */
    private getWebviewScript(): string {
        // This would normally be a separate file, but for simplicity we'll inline it
        return 'data:text/javascript;base64,' + Buffer.from(`
            const vscode = acquireVsCodeApi();
            
            let currentWorkflow = null;
            let nodes = new Map();
            let connections = [];
            let selectedNode = null;
            let selectedConnection = null;
            let isDraggingNode = false;
            let isDraggingCanvas = false;
            let isConnecting = false;
            let connectingFrom = null;
            let tempConnectionLine = null;
            let dragOffset = { x: 0, y: 0 };
            let canvasOffset = { x: 0, y: 0 };
            let zoom = 1.0;
            let nodeIdCounter = 1;

            // Initialize
            window.addEventListener('DOMContentLoaded', () => {
                initializeCanvas();
                initializePalette();
                vscode.postMessage({ type: 'ready' });
            });

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

            function initializeCanvas() {
                const canvas = document.getElementById('canvas');
                const container = document.getElementById('canvas-container');
                
                // Canvas panning
                canvas.addEventListener('mousedown', (e) => {
                    if (e.target === canvas && e.button === 0) {
                        isDraggingCanvas = true;
                        canvas.classList.add('panning');
                        dragOffset = { x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y };
                    }
                });
                
                window.addEventListener('mousemove', (e) => {
                    if (isDraggingCanvas) {
                        canvasOffset.x = e.clientX - dragOffset.x;
                        canvasOffset.y = e.clientY - dragOffset.y;
                        updateCanvasTransform();
                        updateStatusBar();
                    }
                    
                    if (isConnecting && tempConnectionLine) {
                        updateTempConnection(e.clientX, e.clientY);
                    }
                });
                
                window.addEventListener('mouseup', () => {
                    isDraggingCanvas = false;
                    isDraggingNode = false;
                    canvas.classList.remove('panning');
                    
                    if (isConnecting) {
                        isConnecting = false;
                        connectingFrom = null;
                        if (tempConnectionLine) {
                            tempConnectionLine.remove();
                            tempConnectionLine = null;
                        }
                    }
                });
                
                // Zoom with mouse wheel
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    zoom = Math.max(0.1, Math.min(3, zoom * delta));
                    updateCanvasTransform();
                    updateStatusBar();
                });
                
                // Drop zone for palette nodes
                canvas.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });
                
                canvas.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const nodeType = e.dataTransfer.getData('nodeType');
                    if (nodeType) {
                        const rect = canvas.getBoundingClientRect();
                        const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
                        const y = (e.clientY - rect.top - canvasOffset.y) / zoom;
                        createNode(nodeType, x, y);
                    }
                });
            }

            function initializePalette() {
                const paletteNodes = document.querySelectorAll('.palette-node');
                paletteNodes.forEach(node => {
                    node.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('nodeType', node.dataset.nodeType);
                    });
                });
            }

            function renderWorkflow(workflow) {
                if (!workflow) return;
                
                // Clear existing
                nodes.clear();
                connections = [];
                const canvas = document.getElementById('canvas');
                canvas.innerHTML = '';
                
                // Hide placeholder if there are nodes
                if (workflow.nodes && workflow.nodes.length > 0) {
                    const placeholder = canvas.querySelector('.placeholder');
                    if (placeholder) placeholder.style.display = 'none';
                }
                
                // Render nodes
                if (workflow.nodes) {
                    workflow.nodes.forEach((node, index) => {
                        const x = node.position?.x || (200 + (index % 3) * 250);
                        const y = node.position?.y || (100 + Math.floor(index / 3) * 150);
                        renderNode(node, x, y);
                    });
                }
                
                // Render connections
                renderConnections();
                updateStatusBar();
            }

            function renderNode(nodeData, x, y) {
                const canvas = document.getElementById('canvas');
                const nodeEl = document.createElement('div');
                nodeEl.className = 'workflow-node';
                if (currentWorkflow.entryNodes && currentWorkflow.entryNodes.includes(nodeData.id)) {
                    nodeEl.classList.add('entry');
                }
                nodeEl.dataset.nodeId = nodeData.id;
                nodeEl.style.left = x + 'px';
                nodeEl.style.top = y + 'px';
                
                const isEntry = currentWorkflow.entryNodes && currentWorkflow.entryNodes.includes(nodeData.id);
                
                nodeEl.innerHTML = \`
                    <div class="node-header">
                        <div class="node-type">\${nodeData.type}</div>
                        <button class="node-delete" onclick="deleteNode('\${nodeData.id}')">×</button>
                    </div>
                    <div class="node-name">\${nodeData.name}</div>
                    <div class="node-id">ID: \${nodeData.id}</div>
                    <div class="node-dependencies">
                        Dependencies: \${nodeData.dependencies.length > 0 ? nodeData.dependencies.join(', ') : 'None'}
                    </div>
                    <div class="node-port input" data-port="input"></div>
                    <div class="node-port output" data-port="output"></div>
                \`;
                
                // Node dragging
                nodeEl.addEventListener('mousedown', (e) => {
                    if (e.target.classList.contains('node-delete')) return;
                    if (e.target.classList.contains('node-port')) return;
                    
                    e.stopPropagation();
                    selectNode(nodeData.id);
                    isDraggingNode = true;
                    const rect = nodeEl.getBoundingClientRect();
                    dragOffset = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                });
                
                window.addEventListener('mousemove', (e) => {
                    if (isDraggingNode && selectedNode === nodeData.id) {
                        const canvasRect = canvas.getBoundingClientRect();
                        const x = (e.clientX - canvasRect.left - canvasOffset.x - dragOffset.x) / zoom;
                        const y = (e.clientY - canvasRect.top - canvasOffset.y - dragOffset.y) / zoom;
                        nodeEl.style.left = x + 'px';
                        nodeEl.style.top = y + 'px';
                        renderConnections();
                    }
                });
                
                // Port connection handling
                const outputPort = nodeEl.querySelector('.node-port.output');
                outputPort.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    startConnection(nodeData.id, e);
                });
                
                const inputPort = nodeEl.querySelector('.node-port.input');
                inputPort.addEventListener('mouseup', (e) => {
                    e.stopPropagation();
                    if (isConnecting && connectingFrom !== nodeData.id) {
                        finishConnection(nodeData.id);
                    }
                });
                
                canvas.appendChild(nodeEl);
                nodes.set(nodeData.id, { data: nodeData, element: nodeEl, x, y });
            }

            function createNode(type, x, y) {
                const nodeId = 'node_' + nodeIdCounter++;
                const newNode = {
                    id: nodeId,
                    type: type,
                    name: type.charAt(0).toUpperCase() + type.slice(1) + ' Node',
                    dependencies: [],
                    config: {},
                    position: { x, y }
                };
                
                if (!currentWorkflow.nodes) {
                    currentWorkflow.nodes = [];
                }
                currentWorkflow.nodes.push(newNode);
                
                // Add as entry node if it's the first node
                if (currentWorkflow.nodes.length === 1) {
                    if (!currentWorkflow.entryNodes) {
                        currentWorkflow.entryNodes = [];
                    }
                    currentWorkflow.entryNodes.push(nodeId);
                }
                
                renderNode(newNode, x, y);
                saveWorkflow();
                updateStatusBar();
            }

            function deleteNode(nodeId) {
                const node = nodes.get(nodeId);
                if (node) {
                    node.element.remove();
                    nodes.delete(nodeId);
                }
                
                if (currentWorkflow.nodes) {
                    currentWorkflow.nodes = currentWorkflow.nodes.filter(n => n.id !== nodeId);
                }
                
                if (currentWorkflow.entryNodes) {
                    currentWorkflow.entryNodes = currentWorkflow.entryNodes.filter(id => id !== nodeId);
                }
                
                // Remove from dependencies
                if (currentWorkflow.nodes) {
                    currentWorkflow.nodes.forEach(n => {
                        n.dependencies = n.dependencies.filter(id => id !== nodeId);
                    });
                }
                
                renderConnections();
                saveWorkflow();
                updateStatusBar();
            }

            function selectNode(nodeId) {
                // Deselect all
                document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('selected'));
                
                // Select this one
                selectedNode = nodeId;
                const node = nodes.get(nodeId);
                if (node) {
                    node.element.classList.add('selected');
                    showNodeProperties(node.data);
                }
            }

            function showNodeProperties(nodeData) {
                const panel = document.getElementById('properties-panel');
                const content = document.getElementById('properties-content');
                
                content.innerHTML = \`
                    <div class="property-field">
                        <label>Node ID</label>
                        <input type="text" value="\${nodeData.id}" disabled>
                    </div>
                    <div class="property-field">
                        <label>Node Type</label>
                        <input type="text" value="\${nodeData.type}" disabled>
                    </div>
                    <div class="property-field">
                        <label>Node Name</label>
                        <input type="text" value="\${nodeData.name}" onchange="updateNodeProperty('\${nodeData.id}', 'name', this.value)">
                    </div>
                    <div class="property-field">
                        <label>Configuration (JSON)</label>
                        <textarea onchange="updateNodeConfig('\${nodeData.id}', this.value)">\${JSON.stringify(nodeData.config, null, 2)}</textarea>
                    </div>
                \`;
                
                panel.classList.add('visible');
            }

            function updateNodeProperty(nodeId, property, value) {
                const node = nodes.get(nodeId);
                if (node) {
                    node.data[property] = value;
                    const nodeIndex = currentWorkflow.nodes.findIndex(n => n.id === nodeId);
                    if (nodeIndex !== -1) {
                        currentWorkflow.nodes[nodeIndex][property] = value;
                    }
                    renderWorkflow(currentWorkflow);
                    saveWorkflow();
                }
            }

            function updateNodeConfig(nodeId, configJson) {
                try {
                    const config = JSON.parse(configJson);
                    const node = nodes.get(nodeId);
                    if (node) {
                        node.data.config = config;
                        const nodeIndex = currentWorkflow.nodes.findIndex(n => n.id === nodeId);
                        if (nodeIndex !== -1) {
                            currentWorkflow.nodes[nodeIndex].config = config;
                        }
                        saveWorkflow();
                    }
                } catch (e) {
                    alert('Invalid JSON configuration');
                }
            }

            function startConnection(fromNodeId, event) {
                isConnecting = true;
                connectingFrom = fromNodeId;
                
                const svg = document.getElementById('connections-svg');
                tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tempConnectionLine.classList.add('temp-connection');
                svg.appendChild(tempConnectionLine);
                
                updateTempConnection(event.clientX, event.clientY);
            }

            function updateTempConnection(mouseX, mouseY) {
                if (!tempConnectionLine || !connectingFrom) return;
                
                const fromNode = nodes.get(connectingFrom);
                if (!fromNode) return;
                
                const fromRect = fromNode.element.getBoundingClientRect();
                const canvasRect = document.getElementById('canvas-container').getBoundingClientRect();
                
                const x1 = fromRect.right - canvasRect.left;
                const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                const x2 = mouseX - canvasRect.left;
                const y2 = mouseY - canvasRect.top;
                
                const path = \`M \${x1} \${y1} C \${x1 + 50} \${y1}, \${x2 - 50} \${y2}, \${x2} \${y2}\`;
                tempConnectionLine.setAttribute('d', path);
            }

            function finishConnection(toNodeId) {
                if (!connectingFrom || connectingFrom === toNodeId) return;
                
                // Add dependency
                const toNode = currentWorkflow.nodes.find(n => n.id === toNodeId);
                if (toNode && !toNode.dependencies.includes(connectingFrom)) {
                    toNode.dependencies.push(connectingFrom);
                    vscode.postMessage({
                        type: 'updateConnection',
                        connection: { source: connectingFrom, target: toNodeId }
                    });
                    renderConnections();
                }
            }

            function renderConnections() {
                const svg = document.getElementById('connections-svg');
                svg.innerHTML = '';
                
                if (!currentWorkflow.nodes) return;
                
                const canvasRect = document.getElementById('canvas-container').getBoundingClientRect();
                
                currentWorkflow.nodes.forEach(node => {
                    node.dependencies.forEach(depId => {
                        const fromNode = nodes.get(depId);
                        const toNode = nodes.get(node.id);
                        
                        if (fromNode && toNode) {
                            const fromRect = fromNode.element.getBoundingClientRect();
                            const toRect = toNode.element.getBoundingClientRect();
                            
                            const x1 = fromRect.right - canvasRect.left;
                            const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                            const x2 = toRect.left - canvasRect.left;
                            const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
                            
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            const d = \`M \${x1} \${y1} C \${x1 + 50} \${y1}, \${x2 - 50} \${y2}, \${x2} \${y2}\`;
                            path.setAttribute('d', d);
                            path.classList.add('connection-line');
                            path.dataset.from = depId;
                            path.dataset.to = node.id;
                            
                            path.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (confirm('Delete this connection?')) {
                                    vscode.postMessage({
                                        type: 'deleteConnection',
                                        connection: { source: depId, target: node.id }
                                    });
                                }
                            });
                            
                            svg.appendChild(path);
                        }
                    });
                });
            }

            function updateCanvasTransform() {
                const canvas = document.getElementById('canvas');
                canvas.style.transform = \`translate(\${canvasOffset.x}px, \${canvasOffset.y}px) scale(\${zoom})\`;
                canvas.style.transformOrigin = '0 0';
            }

            function updateStatusBar() {
                document.getElementById('status-nodes').textContent = \`Nodes: \${nodes.size}\`;
                document.getElementById('status-zoom').textContent = \`Zoom: \${Math.round(zoom * 100)}%\`;
                document.getElementById('status-position').textContent = \`Position: \${Math.round(canvasOffset.x)}, \${Math.round(canvasOffset.y)}\`;
            }

            function saveWorkflow() {
                // Update node positions
                nodes.forEach((node, id) => {
                    const nodeData = currentWorkflow.nodes.find(n => n.id === id);
                    if (nodeData) {
                        const rect = node.element.getBoundingClientRect();
                        const canvasRect = document.getElementById('canvas').getBoundingClientRect();
                        nodeData.position = {
                            x: (rect.left - canvasRect.left) / zoom,
                            y: (rect.top - canvasRect.top) / zoom
                        };
                    }
                });
                
                vscode.postMessage({
                    type: 'updateWorkflow',
                    workflow: currentWorkflow
                });
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

            function autoLayout() {
                if (!currentWorkflow.nodes) return;
                
                // Simple hierarchical layout
                const levels = new Map();
                const visited = new Set();
                
                function getLevel(nodeId, level = 0) {
                    if (visited.has(nodeId)) return;
                    visited.add(nodeId);
                    
                    if (!levels.has(level)) {
                        levels.set(level, []);
                    }
                    levels.get(level).push(nodeId);
                    
                    const node = currentWorkflow.nodes.find(n => n.id === nodeId);
                    if (node) {
                        node.dependencies.forEach(depId => getLevel(depId, level + 1));
                    }
                }
                
                // Start from entry nodes
                currentWorkflow.entryNodes.forEach(id => getLevel(id, 0));
                
                // Position nodes
                levels.forEach((nodeIds, level) => {
                    nodeIds.forEach((nodeId, index) => {
                        const node = nodes.get(nodeId);
                        if (node) {
                            const x = 100 + level * 250;
                            const y = 100 + index * 150;
                            node.element.style.left = x + 'px';
                            node.element.style.top = y + 'px';
                            node.x = x;
                            node.y = y;
                        }
                    });
                });
                
                renderConnections();
                saveWorkflow();
            }

            function zoomIn() {
                zoom = Math.min(3, zoom * 1.2);
                updateCanvasTransform();
                updateStatusBar();
            }

            function zoomOut() {
                zoom = Math.max(0.1, zoom / 1.2);
                updateCanvasTransform();
                updateStatusBar();
            }

            function resetView() {
                zoom = 1.0;
                canvasOffset = { x: 0, y: 0 };
                updateCanvasTransform();
                updateStatusBar();
            }

            function toggleProperties() {
                const panel = document.getElementById('properties-panel');
                panel.classList.toggle('visible');
            }

            function showValidationResult(valid, errors) {
                if (valid) {
                    return;
                }
                
                alert('Validation Errors:\\n\\n' + errors.join('\\n'));
            }
        `).toString('base64');
    }
}
