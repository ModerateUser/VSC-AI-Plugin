/**
 * Main extension entry point for Agentic Workflow Plugin
 */

import * as vscode from 'vscode';
import { WorkflowEditorProvider } from './ui/workflowEditorProvider';
import { WorkflowEngine } from './engine/workflowEngine';
import { ModelManager } from './models/modelManager';
import { VectorDatabaseManager } from './vectordb/vectorDatabaseManager';
import { WorkflowStorageManager } from './storage/workflowStorageManager';
import { ExtensionManager } from './extensions/extensionManager';

let workflowEngine: WorkflowEngine;
let modelManager: ModelManager;
let vectorDbManager: VectorDatabaseManager;
let storageManager: WorkflowStorageManager;
let extensionManager: ExtensionManager;

/**
 * Workflow tree item
 */
class WorkflowTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly workflowUri?: vscode.Uri,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this.contextValue = 'workflow';
        if (workflowUri) {
            this.command = {
                command: 'agenticWorkflow.openEditor',
                title: 'Open Workflow',
                arguments: [workflowUri],
            };
        }
    }
}

/**
 * Model tree item
 */
class ModelTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly modelId: string,
        public readonly description?: string,
        public readonly tooltip?: string
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = tooltip;
        this.contextValue = 'model';
    }
}

/**
 * Workflow tree data provider
 */
class WorkflowTreeDataProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private storageManager: WorkflowStorageManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
        if (element) {
            return [];
        }

        try {
            const workflows = await this.storageManager.listWorkflows();
            return workflows.map(w => 
                new WorkflowTreeItem(
                    w.name,
                    vscode.TreeItemCollapsibleState.None,
                    w.uri,
                    w.description
                )
            );
        } catch (error) {
            console.error('Failed to load workflows:', error);
            return [];
        }
    }
}

/**
 * Model tree data provider
 */
class ModelTreeDataProvider implements vscode.TreeDataProvider<ModelTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ModelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private modelManager: ModelManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ModelTreeItem): Promise<ModelTreeItem[]> {
        if (element) {
            return [];
        }

        try {
            const models = await this.modelManager.listModels();
            return models.map(m => 
                new ModelTreeItem(
                    m.name,
                    vscode.TreeItemCollapsibleState.None,
                    m.id,
                    m.tags.join(', '),
                    `Source: ${m.source}\nVersion: ${m.version || 'N/A'}`
                )
            );
        } catch (error) {
            console.error('Failed to load models:', error);
            return [];
        }
    }
}

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Agentic Workflow Plugin is now active');

    try {
        // Initialize core managers
        storageManager = new WorkflowStorageManager(context);
        modelManager = new ModelManager(context);
        vectorDbManager = new VectorDatabaseManager(context);
        extensionManager = new ExtensionManager();
        workflowEngine = new WorkflowEngine(
            modelManager,
            vectorDbManager,
            extensionManager
        );

        // Initialize managers
        await modelManager.initialize();
        await vectorDbManager.initialize();

        // Register workflow editor provider
        const editorProvider = new WorkflowEditorProvider(
            context,
            workflowEngine,
            storageManager
        );
        context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(
                'agenticWorkflow.editor',
                editorProvider,
                {
                    webviewOptions: {
                        retainContextWhenHidden: true,
                    },
                    supportsMultipleEditorsPerDocument: false,
                }
            )
        );

        // Register commands
        registerCommands(context);

        // Register tree view providers
        registerTreeViews(context);

        // Show welcome message
        vscode.window.showInformationMessage(
            'Agentic Workflow Plugin activated! Use "Open Workflow Editor" to get started.'
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate Agentic Workflow Plugin: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
    }
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Open workflow editor
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.openEditor', async (uri?: vscode.Uri) => {
            try {
                let targetUri = uri;
                if (!targetUri) {
                    const result = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Workflow Files': ['json', 'yaml', 'yml'],
                        },
                        title: 'Open Workflow',
                    });

                    if (!result || result.length === 0) {
                        return;
                    }
                    targetUri = result[0];
                }

                await vscode.commands.executeCommand('vscode.openWith', targetUri, 'agenticWorkflow.editor');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open workflow: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );

    // Create new workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.createWorkflow', async () => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage('Please open a workspace first');
                    return;
                }

                const name = await vscode.window.showInputBox({
                    prompt: 'Enter workflow name',
                    placeHolder: 'my-workflow',
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Workflow name cannot be empty';
                        }
                        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                            return 'Workflow name can only contain letters, numbers, hyphens, and underscores';
                        }
                        return null;
                    }
                });

                if (!name) {
                    return;
                }

                const newWorkflow = storageManager.createNewWorkflow(name);
                const filePath = vscode.Uri.joinPath(
                    workspaceFolders[0].uri,
                    `${name}.workflow.json`
                );

                await vscode.workspace.fs.writeFile(
                    filePath,
                    Buffer.from(JSON.stringify(newWorkflow, null, 2))
                );

                await vscode.commands.executeCommand('vscode.openWith', filePath, 'agenticWorkflow.editor');
                vscode.window.showInformationMessage(`Workflow "${name}" created successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );

    // Execute workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.executeWorkflow', async (workflowUri?: vscode.Uri) => {
            try {
                let uri = workflowUri;
                if (!uri) {
                    const result = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Workflow Files': ['json', 'yaml', 'yml'],
                        },
                        title: 'Select Workflow to Execute',
                    });

                    if (!result || result.length === 0) {
                        return;
                    }
                    uri = result[0];
                }

                const workflow = await storageManager.loadWorkflow(uri);
                
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Executing workflow: ${workflow.name}`,
                        cancellable: true,
                    },
                    async (progress, token) => {
                        const result = await workflowEngine.executeWorkflow(workflow, {}, token);
                        
                        if (result.status === 'success') {
                            vscode.window.showInformationMessage(
                                `Workflow "${workflow.name}" completed successfully`
                            );
                        } else if (result.status === 'failed') {
                            vscode.window.showErrorMessage(
                                `Workflow "${workflow.name}" failed`
                            );
                        } else {
                            vscode.window.showWarningMessage(
                                `Workflow "${workflow.name}" completed partially`
                            );
                        }

                        // Show execution results
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
        })
    );

    // Manage models
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.manageModels', async () => {
            try {
                const action = await vscode.window.showQuickPick(
                    ['Download Model', 'List Models', 'Delete Model', 'Update Model'],
                    { placeHolder: 'Select an action' }
                );

                if (!action) {
                    return;
                }

                switch (action) {
                    case 'Download Model':
                        await downloadModelCommand();
                        break;
                    case 'List Models':
                        await listModelsCommand();
                        break;
                    case 'Delete Model':
                        await deleteModelCommand();
                        break;
                    case 'Update Model':
                        await updateModelCommand();
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Model management failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );

    // Import workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.importWorkflow', async () => {
            try {
                const uri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'Workflow Files': ['json', 'yaml', 'yml'],
                    },
                    title: 'Import Workflow',
                });

                if (uri && uri[0]) {
                    const workflow = await storageManager.importWorkflow(uri[0]);
                    vscode.window.showInformationMessage(
                        `Workflow "${workflow.name}" imported successfully`
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to import workflow: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );

    // Export workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.exportWorkflow', async (workflowUri?: vscode.Uri) => {
            try {
                let uri = workflowUri;
                if (!uri) {
                    const result = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Workflow Files': ['json', 'yaml', 'yml'],
                        },
                        title: 'Select Workflow to Export',
                    });

                    if (!result || result.length === 0) {
                        return;
                    }
                    uri = result[0];
                }

                const format = await vscode.window.showQuickPick(['JSON', 'YAML'], {
                    placeHolder: 'Select export format',
                });

                if (!format) {
                    return;
                }

                const saveUri = await vscode.window.showSaveDialog({
                    filters: {
                        'Workflow Files': [format.toLowerCase()],
                    },
                    defaultUri: uri,
                });

                if (saveUri) {
                    await storageManager.exportWorkflow(uri, saveUri, format.toLowerCase() as 'json' | 'yaml');
                    vscode.window.showInformationMessage('Workflow exported successfully');
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to export workflow: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        })
    );
}

/**
 * Register tree view providers
 */
function registerTreeViews(context: vscode.ExtensionContext) {
    // Workflow explorer tree view
    const workflowTreeDataProvider = new WorkflowTreeDataProvider(storageManager);
    const workflowExplorer = vscode.window.createTreeView('workflowExplorer', {
        treeDataProvider: workflowTreeDataProvider,
    });
    context.subscriptions.push(workflowExplorer);

    // Model manager tree view
    const modelTreeDataProvider = new ModelTreeDataProvider(modelManager);
    const modelExplorer = vscode.window.createTreeView('modelManager', {
        treeDataProvider: modelTreeDataProvider,
    });
    context.subscriptions.push(modelExplorer);

    // Refresh tree views when needed
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.refreshWorkflows', () => {
            workflowTreeDataProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.refreshModels', () => {
            modelTreeDataProvider.refresh();
        })
    );
}

/**
 * Model management commands
 */
async function downloadModelCommand() {
    try {
        const modelId = await vscode.window.showInputBox({
            prompt: 'Enter Hugging Face model ID',
            placeHolder: 'e.g., bert-base-uncased',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Model ID cannot be empty';
                }
                return null;
            }
        });

        if (!modelId) {
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Downloading model: ${modelId}`,
                cancellable: false,
            },
            async () => {
                await modelManager.downloadModel(modelId);
                vscode.window.showInformationMessage(`Model "${modelId}" downloaded successfully`);
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to download model: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function listModelsCommand() {
    try {
        const models = await modelManager.listModels();
        
        if (models.length === 0) {
            vscode.window.showInformationMessage('No models installed');
            return;
        }

        const items = models.map(m => ({
            label: m.name,
            description: m.tags.join(', '),
            detail: `Source: ${m.source} | Version: ${m.version || 'N/A'}`,
        }));

        await vscode.window.showQuickPick(items, {
            placeHolder: 'Installed Models',
        });
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to list models: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function deleteModelCommand() {
    try {
        const models = await modelManager.listModels();
        
        if (models.length === 0) {
            vscode.window.showInformationMessage('No models to delete');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            models.map(m => ({ label: m.name, model: m })),
            { placeHolder: 'Select model to delete' }
        );

        if (selected) {
            const confirm = await vscode.window.showWarningMessage(
                `Delete model "${selected.label}"?`,
                { modal: true },
                'Yes',
                'No'
            );

            if (confirm === 'Yes') {
                await modelManager.deleteModel(selected.model.id);
                vscode.window.showInformationMessage(`Model "${selected.label}" deleted`);
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to delete model: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function updateModelCommand() {
    try {
        const models = await modelManager.listModels();
        
        if (models.length === 0) {
            vscode.window.showInformationMessage('No models to update');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            models.map(m => ({ label: m.name, model: m })),
            { placeHolder: 'Select model to update' }
        );

        if (selected) {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Updating model: ${selected.label}`,
                    cancellable: false,
                },
                async () => {
                    await modelManager.updateModel(selected.model.id);
                    vscode.window.showInformationMessage(`Model "${selected.label}" updated successfully`);
                }
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to update model: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Extension deactivation
 */
export function deactivate() {
    console.log('Agentic Workflow Plugin is now deactivated');
    
    try {
        // Cleanup resources
        if (modelManager) {
            modelManager.dispose();
        }
        if (vectorDbManager) {
            vectorDbManager.dispose();
        }
        if (extensionManager) {
            extensionManager.dispose();
        }
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}
