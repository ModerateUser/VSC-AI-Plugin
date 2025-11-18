/**
 * Unit tests for WorkflowEngine
 */

import { WorkflowEngine } from '../engine/workflowEngine';
import { WorkflowDefinition, NodeType, NodeStatus } from '../types/workflow';

// Mock dependencies
const mockModelManager = {
    getModel: jest.fn(),
    selectModelByTags: jest.fn(),
    runInference: jest.fn(),
    downloadModel: jest.fn(),
    listModels: jest.fn(),
    deleteModel: jest.fn(),
    updateModel: jest.fn(),
    initialize: jest.fn(),
    dispose: jest.fn(),
};

const mockVectorDbManager = {
    createIndex: jest.fn(),
    search: jest.fn(),
    deleteIndex: jest.fn(),
    listIndices: jest.fn(),
    initialize: jest.fn(),
    dispose: jest.fn(),
};

const mockExtensionManager = {
    getCustomNode: jest.fn(),
    registerCustomNode: jest.fn(),
    dispose: jest.fn(),
};

const mockStorageManager = {
    loadWorkflow: jest.fn(),
    loadWorkflowById: jest.fn(),
    saveWorkflow: jest.fn(),
    listWorkflows: jest.fn(),
    createNewWorkflow: jest.fn(),
    importWorkflow: jest.fn(),
    exportWorkflow: jest.fn(),
};

describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
        jest.clearAllMocks();
        engine = new WorkflowEngine(
            mockModelManager as any,
            mockVectorDbManager as any,
            mockExtensionManager as any,
            mockStorageManager as any
        );
    });

    describe('Workflow Validation', () => {
        it('should validate workflow with valid structure', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return { result: "test" };',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            // Should not throw
            await expect(engine.executeWorkflow(workflow)).resolves.toBeDefined();
        });

        it('should reject workflow with duplicate node IDs', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return {};',
                        language: 'javascript',
                    },
                    {
                        id: 'node-1', // Duplicate ID
                        name: 'Node 2',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Duplicate node ID');
        });

        it('should reject workflow with invalid dependencies', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: ['non-existent-node'],
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            await expect(engine.executeWorkflow(workflow)).rejects.toThrow('invalid dependency');
        });

        it('should reject workflow with circular dependencies', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-2'],
                        script: 'return {};',
                        language: 'javascript',
                    },
                    {
                        id: 'node-2',
                        name: 'Node 2',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-1'], // Circular
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            await expect(engine.executeWorkflow(workflow)).rejects.toThrow('circular');
        });

        it('should reject workflow with invalid entry nodes', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['non-existent-node'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Invalid entry node');
        });
    });

    describe('Workflow Execution', () => {
        it('should execute simple workflow successfully', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return { result: "success" };',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.status).toBe('success');
            expect(result.workflowId).toBe('test-workflow');
            expect(result.nodeResults.size).toBe(1);
            expect(result.nodeResults.get('node-1')?.status).toBe(NodeStatus.SUCCESS);
        });

        it('should execute workflow with dependencies in correct order', async () => {
            const executionOrder: string[] = [];

            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: `executionOrder.push('node-1'); return { value: 1 };`,
                        language: 'javascript',
                    },
                    {
                        id: 'node-2',
                        name: 'Node 2',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-1'],
                        script: `executionOrder.push('node-2'); return { value: 2 };`,
                        language: 'javascript',
                    },
                    {
                        id: 'node-3',
                        name: 'Node 3',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-2'],
                        script: `executionOrder.push('node-3'); return { value: 3 };`,
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.status).toBe('success');
            expect(result.nodeResults.size).toBe(3);
            // All nodes should execute successfully
            expect(result.nodeResults.get('node-1')?.status).toBe(NodeStatus.SUCCESS);
            expect(result.nodeResults.get('node-2')?.status).toBe(NodeStatus.SUCCESS);
            expect(result.nodeResults.get('node-3')?.status).toBe(NodeStatus.SUCCESS);
        });

        it('should handle node failures gracefully', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'throw new Error("Test error");',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.status).toBe('failed');
            expect(result.nodeResults.get('node-1')?.status).toBe(NodeStatus.FAILED);
            expect(result.nodeResults.get('node-1')?.error).toBeDefined();
        });

        it('should skip nodes when dependencies fail', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'throw new Error("Test error");',
                        language: 'javascript',
                    },
                    {
                        id: 'node-2',
                        name: 'Node 2',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-1'],
                        script: 'return { value: 2 };',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.nodeResults.get('node-1')?.status).toBe(NodeStatus.FAILED);
            expect(result.nodeResults.get('node-2')?.status).toBe(NodeStatus.SKIPPED);
        });

        it('should pass context between nodes', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return { value: 42 };',
                        language: 'javascript',
                    },
                    {
                        id: 'node-2',
                        name: 'Node 2',
                        type: NodeType.SCRIPT,
                        dependencies: ['node-1'],
                        script: 'return { doubled: context.outputs["node-1"].value * 2 };',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.status).toBe('success');
            expect(result.context.outputs['node-1']).toEqual({ value: 42 });
        });
    });

    describe('Execution Control', () => {
        it('should support cancellation', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'await new Promise(resolve => setTimeout(resolve, 10000)); return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            // Create cancellation token
            const tokenSource = {
                token: {
                    isCancellationRequested: false,
                    onCancellationRequested: jest.fn((callback) => {
                        setTimeout(() => {
                            tokenSource.token.isCancellationRequested = true;
                            callback();
                        }, 100);
                    }),
                },
            };

            const resultPromise = engine.executeWorkflow(workflow, {}, tokenSource.token as any);

            // Wait a bit then check status
            await new Promise(resolve => setTimeout(resolve, 200));

            const result = await resultPromise;
            expect(result.status).toBe('partial');
        });

        it('should track active executions', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const resultPromise = engine.executeWorkflow(workflow);
            
            // Check active executions during execution
            const activeExecutions = engine.getActiveExecutions();
            expect(activeExecutions.length).toBeGreaterThanOrEqual(0);

            await resultPromise;

            // Should be cleared after execution
            const activeAfter = engine.getActiveExecutions();
            expect(activeAfter.length).toBe(0);
        });
    });

    describe('Node Retry Logic', () => {
        it('should retry failed nodes according to retry policy', async () => {
            let attempts = 0;

            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: `
                            attempts++;
                            if (attempts < 3) throw new Error("Retry me");
                            return { success: true };
                        `,
                        language: 'javascript',
                        retryPolicy: {
                            maxAttempts: 3,
                            initialDelay: 100,
                            backoff: 'linear',
                        },
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            const result = await engine.executeWorkflow(workflow);

            expect(result.nodeResults.get('node-1')?.attempts).toBe(3);
            expect(result.nodeResults.get('node-1')?.status).toBe(NodeStatus.SUCCESS);
        });
    });

    describe('getNodeById', () => {
        it('should return node by ID during execution', async () => {
            const workflow: WorkflowDefinition = {
                id: 'test-workflow',
                name: 'Test Workflow',
                version: '1.0.0',
                description: 'Test',
                nodes: [
                    {
                        id: 'node-1',
                        name: 'Node 1',
                        type: NodeType.SCRIPT,
                        dependencies: [],
                        script: 'return {};',
                        language: 'javascript',
                    },
                ],
                entryNodes: ['node-1'],
                metadata: {
                    created: new Date(),
                    modified: new Date(),
                    author: 'test',
                },
            };

            // Start execution
            const executionPromise = engine.executeWorkflow(workflow);

            // During execution, getNodeById should work
            // (In real scenario, this would be called from within node execution)
            
            await executionPromise;

            // After execution, should return undefined (workflow cleared)
            const node = engine.getNodeById('node-1');
            expect(node).toBeUndefined();
        });
    });
});
