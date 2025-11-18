/**
 * Unit tests for ExecutionHistoryProvider
 */

import * as vscode from 'vscode';
import { ExecutionHistoryProvider, ExecutionRecord } from '../ui/executionHistoryProvider';

// Mock vscode module
jest.mock('vscode', () => ({
    TreeItem: jest.fn().mockImplementation((label, collapsibleState) => ({
        label,
        collapsibleState,
    })),
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
    },
    ThemeIcon: jest.fn().mockImplementation((id, color) => ({ id, color })),
    ThemeColor: jest.fn().mockImplementation((id) => ({ id })),
    MarkdownString: jest.fn().mockImplementation(() => ({
        appendMarkdown: jest.fn(),
    })),
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
    })),
}));

describe('ExecutionHistoryProvider', () => {
    let provider: ExecutionHistoryProvider;
    let mockContext: any;

    beforeEach(() => {
        // Create mock extension context
        mockContext = {
            globalState: {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn().mockResolvedValue(undefined),
            },
        };

        provider = new ExecutionHistoryProvider(mockContext);
    });

    describe('addExecution', () => {
        it('should add execution to history', () => {
            const execution: ExecutionRecord = {
                executionId: 'test-123',
                workflowName: 'Test Workflow',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            };

            provider.addExecution(execution);

            const stats = provider.getStatistics();
            expect(stats.total).toBe(1);
            expect(stats.successful).toBe(1);
        });

        it('should maintain max history size', () => {
            // Add 150 executions (max is 100)
            for (let i = 0; i < 150; i++) {
                provider.addExecution({
                    executionId: `test-${i}`,
                    workflowName: 'Test Workflow',
                    workflowId: 'workflow-1',
                    status: 'success',
                    timestamp: new Date(),
                    duration: 1000,
                });
            }

            const stats = provider.getStatistics();
            expect(stats.total).toBe(100);
        });

        it('should add newest executions first', () => {
            const execution1: ExecutionRecord = {
                executionId: 'test-1',
                workflowName: 'Workflow 1',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date('2025-01-01'),
                duration: 1000,
            };

            const execution2: ExecutionRecord = {
                executionId: 'test-2',
                workflowName: 'Workflow 2',
                workflowId: 'workflow-2',
                status: 'success',
                timestamp: new Date('2025-01-02'),
                duration: 2000,
            };

            provider.addExecution(execution1);
            provider.addExecution(execution2);

            const retrieved = provider.getExecution('test-2');
            expect(retrieved).toBeDefined();
            expect(retrieved?.workflowName).toBe('Workflow 2');
        });
    });

    describe('getExecution', () => {
        it('should retrieve execution by ID', () => {
            const execution: ExecutionRecord = {
                executionId: 'test-123',
                workflowName: 'Test Workflow',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            };

            provider.addExecution(execution);

            const retrieved = provider.getExecution('test-123');
            expect(retrieved).toBeDefined();
            expect(retrieved?.executionId).toBe('test-123');
            expect(retrieved?.workflowName).toBe('Test Workflow');
        });

        it('should return undefined for non-existent execution', () => {
            const retrieved = provider.getExecution('non-existent');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getWorkflowExecutions', () => {
        it('should return all executions for a workflow', () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Workflow A',
                workflowId: 'workflow-a',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            });

            provider.addExecution({
                executionId: 'test-2',
                workflowName: 'Workflow B',
                workflowId: 'workflow-b',
                status: 'success',
                timestamp: new Date(),
                duration: 2000,
            });

            provider.addExecution({
                executionId: 'test-3',
                workflowName: 'Workflow A',
                workflowId: 'workflow-a',
                status: 'failed',
                timestamp: new Date(),
                duration: 500,
            });

            const workflowAExecutions = provider.getWorkflowExecutions('workflow-a');
            expect(workflowAExecutions).toHaveLength(2);
            expect(workflowAExecutions.every(e => e.workflowId === 'workflow-a')).toBe(true);
        });
    });

    describe('getStatistics', () => {
        it('should calculate correct statistics', () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            });

            provider.addExecution({
                executionId: 'test-2',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'failed',
                timestamp: new Date(),
                duration: 2000,
            });

            provider.addExecution({
                executionId: 'test-3',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'partial',
                timestamp: new Date(),
                duration: 1500,
            });

            const stats = provider.getStatistics();
            expect(stats.total).toBe(3);
            expect(stats.successful).toBe(1);
            expect(stats.failed).toBe(1);
            expect(stats.partial).toBe(1);
            expect(stats.averageDuration).toBe(1500);
        });

        it('should return zero statistics for empty history', () => {
            const stats = provider.getStatistics();
            expect(stats.total).toBe(0);
            expect(stats.successful).toBe(0);
            expect(stats.failed).toBe(0);
            expect(stats.partial).toBe(0);
            expect(stats.averageDuration).toBe(0);
        });
    });

    describe('clearHistory', () => {
        it('should clear all executions', () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            });

            provider.clearHistory();

            const stats = provider.getStatistics();
            expect(stats.total).toBe(0);
        });
    });

    describe('exportHistory', () => {
        it('should export history as JSON', async () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date('2025-01-01'),
                duration: 1000,
            });

            const exported = await provider.exportHistory();
            const parsed = JSON.parse(exported);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].executionId).toBe('test-1');
        });
    });

    describe('importHistory', () => {
        it('should import history from JSON', async () => {
            const historyJson = JSON.stringify([
                {
                    executionId: 'imported-1',
                    workflowName: 'Imported Workflow',
                    workflowId: 'workflow-1',
                    status: 'success',
                    timestamp: new Date('2025-01-01').toISOString(),
                    duration: 1000,
                },
            ]);

            await provider.importHistory(historyJson);

            const retrieved = provider.getExecution('imported-1');
            expect(retrieved).toBeDefined();
            expect(retrieved?.workflowName).toBe('Imported Workflow');
        });

        it('should throw error for invalid JSON', async () => {
            await expect(provider.importHistory('invalid json')).rejects.toThrow();
        });
    });

    describe('getChildren', () => {
        it('should return empty array for non-root element', async () => {
            const mockElement: any = { record: {} };
            const children = await provider.getChildren(mockElement);
            expect(children).toEqual([]);
        });

        it('should return execution items for root', async () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Test',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date(),
                duration: 1000,
            });

            const children = await provider.getChildren();
            expect(children).toHaveLength(1);
        });

        it('should sort executions by timestamp descending', async () => {
            provider.addExecution({
                executionId: 'test-1',
                workflowName: 'Test 1',
                workflowId: 'workflow-1',
                status: 'success',
                timestamp: new Date('2025-01-01'),
                duration: 1000,
            });

            provider.addExecution({
                executionId: 'test-2',
                workflowName: 'Test 2',
                workflowId: 'workflow-2',
                status: 'success',
                timestamp: new Date('2025-01-03'),
                duration: 1000,
            });

            provider.addExecution({
                executionId: 'test-3',
                workflowName: 'Test 3',
                workflowId: 'workflow-3',
                status: 'success',
                timestamp: new Date('2025-01-02'),
                duration: 1000,
            });

            const children = await provider.getChildren();
            expect(children[0].record.executionId).toBe('test-2'); // Newest first
            expect(children[1].record.executionId).toBe('test-3');
            expect(children[2].record.executionId).toBe('test-1');
        });
    });
});
