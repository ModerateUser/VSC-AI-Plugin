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
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Agentic Workflow Plugin is now active');

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
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Open workflow editor
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.openEditor', async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Workflow Files': ['json', 'yaml', 'yml'],
                },
                title: 'Open Workflow',
            });

            if (uri && uri[0]) {
                await vscode.commands.executeCommand('vscode.openWith', uri[0], 'agenticWorkflow.editor');
            }
        })
    );

    // Create new workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.createWorkflow', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace first');
                return;
            }

            const name = await vscode.window.showInputBox({
                prompt: 'Enter workflow name',
                placeHolder: 'my-workflow',
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
                        } else {
                            vscode.window.showErrorMessage(
                                `Workflow "${workflow.name}" failed or completed partially`
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
        })
    );

    // Import workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('agenticWorkflow.importWorkflow', async () => {
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
                try {
                    const workflow = await storageManager.importWorkflow(uri[0]);
                    vscode.window.showInformationMessage(
                        `Workflow "${workflow.name}" imported successfully`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to import workflow: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
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
    const workflowExplorer = vscode.window.createTreeView('workflowExplorer', {
        treeDataProvider: {
            getTreeItem: (element: any) => element,
            getChildren: async () => {
                const workflows = await storageManager.listWorkflows();
                return workflows.map(w => {
                    const item = new vscode.TreeItem(w.name, vscode.TreeItemCollapsibleState.None);
                    item.description = w.description;
                    item.command = {
                        command: 'agenticWorkflow.openEditor',
                        title: 'Open Workflow',
                        arguments: [w.uri],
                    };
                    return item;
                });
            },
        },
    });
    context.subscriptions.push(workflowExplorer);

    // Model manager tree view
    const modelExplorer = vscode.window.createTreeView('modelManager', {
        treeDataProvider: {
            getTreeItem: (element: any) => element,
            getChildren: async () => {
                const models = await modelManager.listModels();
                return models.map(m => {
                    const item = new vscode.TreeItem(m.name, vscode.TreeItemCollapsibleState.None);
                    item.description = m.tags.join(', ');
                    item.tooltip = `Source: ${m.source}\nVersion: ${m.version || 'N/A'}`;
                    return item;
                });
            },
        },
    });
    context.subscriptions.push(modelExplorer);
}

/**
 * Model management commands
 */
async function downloadModelCommand() {
    const modelId = await vscode.window.showInputBox({
        prompt: 'Enter Hugging Face model ID',
        placeHolder: 'e.g., bert-base-uncased',
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
            try {
                await modelManager.downloadModel(modelId);
                vscode.window.showInformationMessage(`Model "${modelId}" downloaded successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to download model: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
}

async function listModelsCommand() {
    const models = await modelManager.listModels();
    const items = models.map(m => ({
        label: m.name,
        description: m.tags.join(', '),
        detail: `Source: ${m.source} | Version: ${m.version || 'N/A'}`,
    }));

    await vscode.window.showQuickPick(items, {
        placeHolder: 'Installed Models',
    });
}

async function deleteModelCommand() {
    const models = await modelManager.listModels();
    const selected = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m })),
        { placeHolder: 'Select model to delete' }
    );

    if (selected) {
        const confirm = await vscode.window.showWarningMessage(
            `Delete model "${selected.label}"?`,
            'Yes',
            'No'
        );

        if (confirm === 'Yes') {
            await modelManager.deleteModel(selected.model.id);
            vscode.window.showInformationMessage(`Model "${selected.label}" deleted`);
        }
    }
}

async function updateModelCommand() {
    const models = await modelManager.listModels();
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
                try {
                    await modelManager.updateModel(selected.model.id);
                    vscode.window.showInformationMessage(`Model "${selected.label}" updated successfully`);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to update model: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }
}

/**
 * Extension deactivation
 */
export function deactivate() {
    console.log('Agentic Workflow Plugin is now deactivated');
    
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
}
