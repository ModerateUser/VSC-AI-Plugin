/**
 * Vector Database Panel - provides intuitive UI for vector database management
 */

import * as vscode from 'vscode';
import { VectorDatabaseManager } from '../vectordb/vectorDatabaseManager';

/**
 * Vector Database Panel Provider
 */
export class VectorDatabasePanel {
    public static currentPanel: VectorDatabasePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private context: vscode.ExtensionContext,
        private vectorDbManager: VectorDatabaseManager
    ) {
        this._panel = panel;

        // Set webview content
        this._panel.webview.html = this.getWebviewContent();

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'loadIndices':
                        await this.loadIndices();
                        break;
                    case 'createIndex':
                        await this.createIndex(message.data);
                        break;
                    case 'deleteIndex':
                        await this.deleteIndex(message.indexName);
                        break;
                    case 'searchIndex':
                        await this.searchIndex(message.indexName, message.query, message.k);
                        break;
                    case 'getIndexDetails':
                        await this.getIndexDetails(message.indexName);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Load initial data
        this.loadIndices();

        // Handle panel disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    /**
     * Create or show the panel
     */
    public static createOrShow(
        context: vscode.ExtensionContext,
        vectorDbManager: VectorDatabaseManager
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel already exists, show it
        if (VectorDatabasePanel.currentPanel) {
            VectorDatabasePanel.currentPanel._panel.reveal(column);
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'vectorDatabaseManager',
            'Vector Database Manager',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        VectorDatabasePanel.currentPanel = new VectorDatabasePanel(
            panel,
            context,
            vectorDbManager
        );
    }

    /**
     * Load all indices
     */
    private async loadIndices(): Promise<void> {
        try {
            const indices = await this.vectorDbManager.listIndices();
            this._panel.webview.postMessage({
                type: 'indicesLoaded',
                indices,
            });
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to load indices: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Create new index
     */
    private async createIndex(data: any): Promise<void> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating index: ${data.name}`,
                    cancellable: false,
                },
                async () => {
                    const index = await this.vectorDbManager.createIndex(
                        data.name,
                        data.data,
                        data.embeddingModel,
                        {
                            chunkSize: data.chunkSize,
                            overlap: data.overlap,
                        }
                    );

                    this._panel.webview.postMessage({
                        type: 'indexCreated',
                        index,
                    });

                    vscode.window.showInformationMessage(
                        `Index "${data.name}" created successfully`
                    );

                    // Reload indices
                    await this.loadIndices();
                }
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to create index: ${error instanceof Error ? error.message : String(error)}`
            );
            this._panel.webview.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Delete index
     */
    private async deleteIndex(indexName: string): Promise<void> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                `Delete index "${indexName}"? This cannot be undone.`,
                { modal: true },
                'Delete',
                'Cancel'
            );

            if (confirm !== 'Delete') {
                return;
            }

            await this.vectorDbManager.deleteIndex(indexName);
            vscode.window.showInformationMessage(`Index "${indexName}" deleted`);

            // Reload indices
            await this.loadIndices();
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to delete index: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Search index
     */
    private async searchIndex(
        indexName: string,
        query: string,
        k: number
    ): Promise<void> {
        try {
            const results = await this.vectorDbManager.search(indexName, query, k);
            this._panel.webview.postMessage({
                type: 'searchResults',
                results,
            });
        } catch (error) {
            vscode.window.showErrorMessage(
                `Search failed: ${error instanceof Error ? error.message : String(error)}`
            );
            this._panel.webview.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Get index details
     */
    private async getIndexDetails(indexName: string): Promise<void> {
        try {
            const index = await this.vectorDbManager.getIndex(indexName);
            this._panel.webview.postMessage({
                type: 'indexDetails',
                index,
            });
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to get index details: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get webview HTML content
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vector Database Manager</title>
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
            padding: 20px;
        }

        h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: var(--vscode-foreground);
        }

        h2 {
            font-size: 18px;
            margin: 20px 0 10px 0;
            color: var(--vscode-foreground);
        }

        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }

        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        button.danger {
            background-color: var(--vscode-errorForeground);
            color: white;
        }

        .indices-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .index-card {
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .index-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .index-card h3 {
            font-size: 16px;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }

        .index-stat {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .index-actions {
            margin-top: 10px;
            display: flex;
            gap: 5px;
        }

        .index-actions button {
            padding: 4px 8px;
            font-size: 11px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .slider-container {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .slider-container input[type="range"] {
            flex: 1;
        }

        .slider-value {
            min-width: 50px;
            text-align: right;
            font-weight: 500;
        }

        .search-results {
            margin-top: 15px;
        }

        .result-item {
            padding: 12px;
            margin-bottom: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }

        .result-score {
            font-size: 12px;
            color: var(--vscode-charts-green);
            font-weight: 600;
            margin-bottom: 5px;
        }

        .result-content {
            font-size: 13px;
            line-height: 1.5;
            color: var(--vscode-foreground);
        }

        .result-metadata {
            margin-top: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 10px;
            opacity: 0.5;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }

        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background-color: var(--vscode-editor-background);
            padding: 30px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .modal-header h2 {
            margin: 0;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--vscode-foreground);
            padding: 0;
            width: 30px;
            height: 30px;
        }

        .popular-models {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }

        .model-chip {
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 16px;
            font-size: 12px;
            cursor: pointer;
            border: 1px solid transparent;
        }

        .model-chip:hover {
            border-color: var(--vscode-focusBorder);
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <h1>🔍 Vector Database Manager</h1>

    <div class="toolbar">
        <button onclick="showCreateModal()">➕ Create Index</button>
        <button class="secondary" onclick="refreshIndices()">🔄 Refresh</button>
    </div>

    <!-- Indices List -->
    <div class="section">
        <h2>Vector Indices</h2>
        <div id="indices-container">
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div>No vector indices yet. Create one to get started!</div>
            </div>
        </div>
    </div>

    <!-- Search Section -->
    <div class="section">
        <h2>Search Index</h2>
        <div class="form-group">
            <label>Select Index</label>
            <select id="search-index-select">
                <option value="">-- Select an index --</option>
            </select>
        </div>
        <div class="form-group">
            <label>Query</label>
            <input type="text" id="search-query" placeholder="Enter search query...">
        </div>
        <div class="form-group">
            <label>Number of Results (k)</label>
            <div class="slider-container">
                <input type="range" id="search-k" min="1" max="20" value="5">
                <span class="slider-value" id="search-k-value">5</span>
            </div>
        </div>
        <button onclick="searchIndex()">🔍 Search</button>
        
        <div id="search-results" class="search-results"></div>
    </div>

    <!-- Create Index Modal -->
    <div id="create-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Create Vector Index</h2>
                <button class="modal-close" onclick="closeCreateModal()">×</button>
            </div>

            <div class="form-group">
                <label>Index Name *</label>
                <input type="text" id="index-name" placeholder="my-index" required>
                <div class="help-text">Use lowercase letters, numbers, and hyphens only</div>
            </div>

            <div class="form-group">
                <label>Embedding Model *</label>
                <select id="embedding-model">
                    <option value="sentence-transformers/all-MiniLM-L6-v2">all-MiniLM-L6-v2 (Fast, 384 dim)</option>
                    <option value="sentence-transformers/all-mpnet-base-v2">all-mpnet-base-v2 (Balanced, 768 dim)</option>
                    <option value="sentence-transformers/multi-qa-mpnet-base-dot-v1">multi-qa-mpnet (Q&A, 768 dim)</option>
                    <option value="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2">multilingual-MiniLM (Multilingual, 384 dim)</option>
                    <option value="BAAI/bge-small-en-v1.5">bge-small (High quality, 384 dim)</option>
                    <option value="BAAI/bge-base-en-v1.5">bge-base (High quality, 768 dim)</option>
                </select>
                <div class="help-text">Choose based on your use case and performance needs</div>
            </div>

            <div class="form-group">
                <label>Data Source *</label>
                <select id="data-source-type" onchange="updateDataSourceInput()">
                    <option value="text">Text Input</option>
                    <option value="file">File Path</option>
                    <option value="array">JSON Array</option>
                </select>
            </div>

            <div class="form-group" id="data-input-group">
                <label>Data *</label>
                <textarea id="data-input" placeholder="Enter your text data here..."></textarea>
                <div class="help-text">The text will be automatically chunked for embedding</div>
            </div>

            <div class="form-group">
                <label>Chunk Size</label>
                <div class="slider-container">
                    <input type="range" id="chunk-size" min="128" max="2048" value="512" step="128">
                    <span class="slider-value" id="chunk-size-value">512</span>
                </div>
                <div class="help-text">Larger chunks preserve context, smaller chunks are more precise</div>
            </div>

            <div class="form-group">
                <label>Overlap</label>
                <div class="slider-container">
                    <input type="range" id="overlap" min="0" max="200" value="50" step="10">
                    <span class="slider-value" id="overlap-value">50</span>
                </div>
                <div class="help-text">Overlap between chunks to preserve context at boundaries</div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="createIndex()">Create Index</button>
                <button class="secondary" onclick="closeCreateModal()">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentIndices = [];

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {
            loadIndices();
            setupSliders();
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'indicesLoaded':
                    currentIndices = message.indices;
                    renderIndices(message.indices);
                    updateSearchIndexSelect(message.indices);
                    break;
                    
                case 'indexCreated':
                    closeCreateModal();
                    break;
                    
                case 'searchResults':
                    renderSearchResults(message.results);
                    break;
                    
                case 'error':
                    alert('Error: ' + message.message);
                    break;
            }
        });

        function loadIndices() {
            vscode.postMessage({ type: 'loadIndices' });
        }

        function refreshIndices() {
            loadIndices();
        }

        function renderIndices(indices) {
            const container = document.getElementById('indices-container');
            
            if (indices.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div>No vector indices yet. Create one to get started!</div>
                    </div>
                \`;
                return;
            }

            container.innerHTML = '<div class="indices-grid">' + 
                indices.map(index => \`
                    <div class="index-card">
                        <h3>\${index.name}</h3>
                        <div class="index-stat">
                            <span>Documents:</span>
                            <span>\${index.count}</span>
                        </div>
                        <div class="index-stat">
                            <span>Dimensions:</span>
                            <span>\${index.dimension}</span>
                        </div>
                        <div class="index-stat">
                            <span>Model:</span>
                            <span>\${index.model.split('/').pop()}</span>
                        </div>
                        <div class="index-stat">
                            <span>Created:</span>
                            <span>\${new Date(index.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div class="index-actions">
                            <button class="secondary" onclick="selectIndexForSearch('\${index.name}')">Search</button>
                            <button class="danger" onclick="deleteIndex('\${index.name}')">Delete</button>
                        </div>
                    </div>
                \`).join('') +
                '</div>';
        }

        function updateSearchIndexSelect(indices) {
            const select = document.getElementById('search-index-select');
            select.innerHTML = '<option value="">-- Select an index --</option>' +
                indices.map(index => \`<option value="\${index.name}">\${index.name}</option>\`).join('');
        }

        function selectIndexForSearch(indexName) {
            document.getElementById('search-index-select').value = indexName;
            document.getElementById('search-query').focus();
        }

        function showCreateModal() {
            document.getElementById('create-modal').classList.add('active');
        }

        function closeCreateModal() {
            document.getElementById('create-modal').classList.remove('active');
            // Reset form
            document.getElementById('index-name').value = '';
            document.getElementById('data-input').value = '';
        }

        function updateDataSourceInput() {
            const type = document.getElementById('data-source-type').value;
            const textarea = document.getElementById('data-input');
            const helpText = document.querySelector('#data-input-group .help-text');
            
            switch(type) {
                case 'text':
                    textarea.placeholder = 'Enter your text data here...';
                    helpText.textContent = 'The text will be automatically chunked for embedding';
                    break;
                case 'file':
                    textarea.placeholder = '/path/to/your/file.txt';
                    helpText.textContent = 'Enter the path to a text file';
                    break;
                case 'array':
                    textarea.placeholder = '["doc1", "doc2", "doc3"]';
                    helpText.textContent = 'Enter a JSON array of documents';
                    break;
            }
        }

        function createIndex() {
            const name = document.getElementById('index-name').value.trim();
            const model = document.getElementById('embedding-model').value;
            const dataInput = document.getElementById('data-input').value.trim();
            const chunkSize = parseInt(document.getElementById('chunk-size').value);
            const overlap = parseInt(document.getElementById('overlap').value);
            const dataSourceType = document.getElementById('data-source-type').value;

            if (!name || !dataInput) {
                alert('Please fill in all required fields');
                return;
            }

            // Parse data based on type
            let data;
            try {
                if (dataSourceType === 'array') {
                    data = JSON.parse(dataInput);
                } else {
                    data = dataInput;
                }
            } catch (e) {
                alert('Invalid JSON array');
                return;
            }

            vscode.postMessage({
                type: 'createIndex',
                data: {
                    name,
                    embeddingModel: model,
                    data,
                    chunkSize,
                    overlap
                }
            });
        }

        function deleteIndex(indexName) {
            vscode.postMessage({
                type: 'deleteIndex',
                indexName
            });
        }

        function searchIndex() {
            const indexName = document.getElementById('search-index-select').value;
            const query = document.getElementById('search-query').value.trim();
            const k = parseInt(document.getElementById('search-k').value);

            if (!indexName) {
                alert('Please select an index');
                return;
            }

            if (!query) {
                alert('Please enter a search query');
                return;
            }

            vscode.postMessage({
                type: 'searchIndex',
                indexName,
                query,
                k
            });
        }

        function renderSearchResults(results) {
            const container = document.getElementById('search-results');
            
            if (results.length === 0) {
                container.innerHTML = '<div class="empty-state">No results found</div>';
                return;
            }

            container.innerHTML = results.map(result => \`
                <div class="result-item">
                    <div class="result-score">Score: \${result.score.toFixed(4)}</div>
                    <div class="result-content">\${result.content}</div>
                    \${result.metadata ? \`<div class="result-metadata">ID: \${result.id}</div>\` : ''}
                </div>
            \`).join('');
        }

        function setupSliders() {
            // Chunk size slider
            const chunkSize = document.getElementById('chunk-size');
            const chunkSizeValue = document.getElementById('chunk-size-value');
            chunkSize.addEventListener('input', () => {
                chunkSizeValue.textContent = chunkSize.value;
            });

            // Overlap slider
            const overlap = document.getElementById('overlap');
            const overlapValue = document.getElementById('overlap-value');
            overlap.addEventListener('input', () => {
                overlapValue.textContent = overlap.value;
            });

            // Search k slider
            const searchK = document.getElementById('search-k');
            const searchKValue = document.getElementById('search-k-value');
            searchK.addEventListener('input', () => {
                searchKValue.textContent = searchK.value;
            });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        VectorDatabasePanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
