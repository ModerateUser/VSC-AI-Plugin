/**
 * Extension Manager - handles custom node types and plugin extensions
 */

import { PluginExtension, CustomNodeType } from '../types/workflow';

/**
 * Extension Manager - manages plugin extensions and custom node types
 */
export class ExtensionManager {
    private extensions: Map<string, PluginExtension> = new Map();
    private customNodeTypes: Map<string, CustomNodeType> = new Map();

    /**
     * Register a plugin extension
     */
    async registerExtension(extension: PluginExtension): Promise<void> {
        if (this.extensions.has(extension.id)) {
            throw new Error(`Extension already registered: ${extension.id}`);
        }

        // Initialize extension
        if (extension.initialize) {
            await extension.initialize();
        }

        // Register custom node types
        if (extension.nodeTypes) {
            for (const nodeType of extension.nodeTypes) {
                this.registerCustomNodeType(nodeType);
            }
        }

        this.extensions.set(extension.id, extension);
    }

    /**
     * Unregister a plugin extension
     */
    async unregisterExtension(extensionId: string): Promise<void> {
        const extension = this.extensions.get(extensionId);
        if (!extension) {
            return;
        }

        // Dispose extension
        if (extension.dispose) {
            await extension.dispose();
        }

        // Unregister custom node types
        if (extension.nodeTypes) {
            for (const nodeType of extension.nodeTypes) {
                this.customNodeTypes.delete(nodeType.type);
            }
        }

        this.extensions.delete(extensionId);
    }

    /**
     * Register a custom node type
     */
    registerCustomNodeType(nodeType: CustomNodeType): void {
        if (this.customNodeTypes.has(nodeType.type)) {
            throw new Error(`Custom node type already registered: ${nodeType.type}`);
        }

        this.customNodeTypes.set(nodeType.type, nodeType);
    }

    /**
     * Get a custom node type
     */
    getCustomNode(type: string): CustomNodeType | undefined {
        return this.customNodeTypes.get(type);
    }

    /**
     * List all custom node types
     */
    listCustomNodeTypes(): CustomNodeType[] {
        return Array.from(this.customNodeTypes.values());
    }

    /**
     * List all registered extensions
     */
    listExtensions(): PluginExtension[] {
        return Array.from(this.extensions.values());
    }

    /**
     * Check if a node type is custom
     */
    isCustomNodeType(type: string): boolean {
        return this.customNodeTypes.has(type);
    }

    /**
     * Dispose all extensions
     */
    async dispose(): Promise<void> {
        for (const extension of this.extensions.values()) {
            if (extension.dispose) {
                await extension.dispose();
            }
        }

        this.extensions.clear();
        this.customNodeTypes.clear();
    }
}
