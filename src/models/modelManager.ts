/**
 * Model Manager - handles AI model downloads, caching, and inference
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import { HfInference } from '@huggingface/inference';
import { spawn } from 'child_process';
import { ModelInfo } from '../types/workflow';

/**
 * Model Manager - manages AI models from Hugging Face and local storage
 */
export class ModelManager {
    private models: Map<string, ModelInfo> = new Map();
    private hfInference?: HfInference;
    private modelCachePath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.modelCachePath = this.getModelCachePath();
    }

    /**
     * Initialize the model manager
     */
    async initialize(): Promise<void> {
        // Create cache directory if it doesn't exist
        await this.ensureCacheDirectory();

        // Initialize Hugging Face client
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const hfToken = config.get<string>('huggingFaceToken');
        
        if (hfToken) {
            this.hfInference = new HfInference(hfToken);
        }

        // Load cached models
        await this.loadCachedModels();
    }

    /**
     * Get model cache path
     */
    private getModelCachePath(): string {
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const customPath = config.get<string>('modelCachePath');
        
        if (customPath) {
            return customPath;
        }

        return path.join(this.context.globalStorageUri.fsPath, 'models');
    }

    /**
     * Ensure cache directory exists
     */
    private async ensureCacheDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.modelCachePath, { recursive: true });
        } catch (error) {
            console.error('Failed to create model cache directory:', error);
        }
    }

    /**
     * Load cached models from disk
     */
    private async loadCachedModels(): Promise<void> {
        try {
            const metadataPath = path.join(this.modelCachePath, 'models.json');
            const data = await fs.readFile(metadataPath, 'utf-8');
            const modelsArray: ModelInfo[] = JSON.parse(data);
            
            for (const model of modelsArray) {
                this.models.set(model.id, model);
            }
        } catch (error) {
            // No cached models or error reading - that's okay
            console.log('No cached models found or error loading:', error);
        }
    }

    /**
     * Save models metadata to disk
     */
    private async saveModelsMetadata(): Promise<void> {
        try {
            const metadataPath = path.join(this.modelCachePath, 'models.json');
            const modelsArray = Array.from(this.models.values());
            await fs.writeFile(metadataPath, JSON.stringify(modelsArray, null, 2));
        } catch (error) {
            console.error('Failed to save models metadata:', error);
        }
    }

    /**
     * Download a model from Hugging Face
     */
    async downloadModel(modelId: string, version?: string): Promise<ModelInfo> {
        // Check if model already exists
        if (this.models.has(modelId)) {
            const existing = this.models.get(modelId)!;
            if (!version || existing.version === version) {
                return existing;
            }
        }

        // Fetch model info from Hugging Face API
        const modelInfo = await this.fetchModelInfo(modelId);

        // Download model using Python huggingface_hub
        const modelPath = await this.downloadModelFiles(modelId, version);

        const model: ModelInfo = {
            id: modelId,
            name: modelInfo.name || modelId,
            tags: modelInfo.tags || [],
            source: 'huggingface',
            path: modelPath,
            version: version || 'latest',
            metadata: modelInfo,
            downloadedAt: new Date(),
            size: modelInfo.size,
        };

        this.models.set(modelId, model);
        await this.saveModelsMetadata();

        return model;
    }

    /**
     * Fetch model information from Hugging Face API
     */
    private async fetchModelInfo(modelId: string): Promise<any> {
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const hfToken = config.get<string>('huggingFaceToken');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }

        const response = await fetch(`https://huggingface.co/api/models/${modelId}`, {
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch model info: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Download model files using Python huggingface_hub
     */
    private async downloadModelFiles(modelId: string, version?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';
            const hfToken = config.get<string>('huggingFaceToken');

            const modelPath = path.join(this.modelCachePath, modelId.replace('/', '_'));

            // Python script to download model
            const pythonScript = `
import os
import sys
from huggingface_hub import snapshot_download

model_id = "${modelId}"
cache_dir = "${modelPath}"
token = "${hfToken || ''}"

try:
    path = snapshot_download(
        repo_id=model_id,
        cache_dir=cache_dir,
        token=token if token else None,
        revision="${version || 'main'}"
    )
    print(path)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

            const process = spawn(pythonPath, ['-c', pythonScript]);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Model download failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Get a model by ID
     */
    async getModel(modelId: string): Promise<ModelInfo | undefined> {
        return this.models.get(modelId);
    }

    /**
     * List all available models
     */
    async listModels(): Promise<ModelInfo[]> {
        return Array.from(this.models.values());
    }

    /**
     * Select model by tags
     */
    async selectModelByTags(tags: string[]): Promise<ModelInfo | undefined> {
        const models = Array.from(this.models.values());
        
        // Find model that matches all tags
        for (const model of models) {
            const hasAllTags = tags.every(tag => 
                model.tags.some(modelTag => 
                    modelTag.toLowerCase().includes(tag.toLowerCase())
                )
            );
            
            if (hasAllTags) {
                return model;
            }
        }

        // If no exact match, find model with most matching tags
        let bestMatch: ModelInfo | undefined;
        let maxMatches = 0;

        for (const model of models) {
            const matches = tags.filter(tag =>
                model.tags.some(modelTag =>
                    modelTag.toLowerCase().includes(tag.toLowerCase())
                )
            ).length;

            if (matches > maxMatches) {
                maxMatches = matches;
                bestMatch = model;
            }
        }

        return bestMatch;
    }

    /**
     * Run inference on a model
     */
    async runInference(
        modelId: string,
        inputs: Record<string, any>,
        params?: Record<string, any>
    ): Promise<any> {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }

        if (!this.hfInference) {
            throw new Error('Hugging Face token not configured');
        }

        // Determine inference type based on model tags
        const inferenceType = this.determineInferenceType(model);

        try {
            switch (inferenceType) {
                case 'text-generation':
                    return await this.hfInference.textGeneration({
                        model: modelId,
                        inputs: inputs.text || inputs.prompt,
                        parameters: params,
                    });

                case 'text-classification':
                    return await this.hfInference.textClassification({
                        model: modelId,
                        inputs: inputs.text,
                    });

                case 'token-classification':
                    return await this.hfInference.tokenClassification({
                        model: modelId,
                        inputs: inputs.text,
                    });

                case 'question-answering':
                    return await this.hfInference.questionAnswering({
                        model: modelId,
                        inputs: {
                            question: inputs.question,
                            context: inputs.context,
                        },
                    });

                case 'summarization':
                    return await this.hfInference.summarization({
                        model: modelId,
                        inputs: inputs.text,
                        parameters: params,
                    });

                case 'translation':
                    return await this.hfInference.translation({
                        model: modelId,
                        inputs: inputs.text,
                    });

                case 'feature-extraction':
                    return await this.hfInference.featureExtraction({
                        model: modelId,
                        inputs: inputs.text,
                    });

                default:
                    // Generic inference
                    return await this.hfInference.request({
                        model: modelId,
                        inputs: inputs,
                        parameters: params,
                    });
            }
        } catch (error) {
            throw new Error(`Inference failed: ${error}`);
        }
    }

    /**
     * Determine inference type from model tags
     */
    private determineInferenceType(model: ModelInfo): string {
        const tags = model.tags.map(t => t.toLowerCase());

        if (tags.some(t => t.includes('text-generation') || t.includes('gpt') || t.includes('llm'))) {
            return 'text-generation';
        }
        if (tags.some(t => t.includes('text-classification') || t.includes('sentiment'))) {
            return 'text-classification';
        }
        if (tags.some(t => t.includes('token-classification') || t.includes('ner'))) {
            return 'token-classification';
        }
        if (tags.some(t => t.includes('question-answering') || t.includes('qa'))) {
            return 'question-answering';
        }
        if (tags.some(t => t.includes('summarization'))) {
            return 'summarization';
        }
        if (tags.some(t => t.includes('translation'))) {
            return 'translation';
        }
        if (tags.some(t => t.includes('feature-extraction') || t.includes('embedding'))) {
            return 'feature-extraction';
        }

        return 'generic';
    }

    /**
     * Delete a model
     */
    async deleteModel(modelId: string): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }

        // Delete model files
        if (model.path) {
            try {
                await fs.rm(model.path, { recursive: true, force: true });
            } catch (error) {
                console.error('Failed to delete model files:', error);
            }
        }

        // Remove from cache
        this.models.delete(modelId);
        await this.saveModelsMetadata();
    }

    /**
     * Update a model to latest version
     */
    async updateModel(modelId: string): Promise<ModelInfo> {
        // Delete existing model
        await this.deleteModel(modelId);

        // Download latest version
        return this.downloadModel(modelId);
    }

    /**
     * Search models on Hugging Face
     */
    async searchModels(query: string, filters?: Record<string, any>): Promise<any[]> {
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const hfToken = config.get<string>('huggingFaceToken');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }

        let url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}`;
        
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                url += `&${key}=${encodeURIComponent(value)}`;
            }
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Model search failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Cleanup if needed
        this.models.clear();
    }
}
