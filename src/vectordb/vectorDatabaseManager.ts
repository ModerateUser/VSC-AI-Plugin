/**
 * Vector Database Manager - handles embeddings and FAISS vector search
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { VectorIndex, VectorSearchResult } from '../types/workflow';

/**
 * Vector Database Manager - manages vector embeddings and FAISS indices
 */
export class VectorDatabaseManager {
    private indices: Map<string, VectorIndex> = new Map();
    private vectorDbPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.vectorDbPath = path.join(context.globalStorageUri.fsPath, 'vectordb');
    }

    /**
     * Initialize the vector database manager
     */
    async initialize(): Promise<void> {
        // Create vector DB directory if it doesn't exist
        await this.ensureVectorDbDirectory();

        // Load existing indices
        await this.loadIndices();

        // Check if Python dependencies are available
        await this.checkPythonDependencies();
    }

    /**
     * Ensure vector DB directory exists
     */
    private async ensureVectorDbDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.vectorDbPath, { recursive: true });
        } catch (error) {
            console.error('Failed to create vector DB directory:', error);
        }
    }

    /**
     * Load existing indices from disk
     */
    private async loadIndices(): Promise<void> {
        try {
            const metadataPath = path.join(this.vectorDbPath, 'indices.json');
            const data = await fs.readFile(metadataPath, 'utf-8');
            const indicesArray: VectorIndex[] = JSON.parse(data);
            
            for (const index of indicesArray) {
                this.indices.set(index.name, index);
            }
        } catch (error) {
            // No cached indices or error reading - that's okay
            console.log('No cached indices found or error loading:', error);
        }
    }

    /**
     * Save indices metadata to disk
     */
    private async saveIndicesMetadata(): Promise<void> {
        try {
            const metadataPath = path.join(this.vectorDbPath, 'indices.json');
            const indicesArray = Array.from(this.indices.values());
            await fs.writeFile(metadataPath, JSON.stringify(indicesArray, null, 2));
        } catch (error) {
            console.error('Failed to save indices metadata:', error);
        }
    }

    /**
     * Check if Python dependencies are available
     */
    private async checkPythonDependencies(): Promise<boolean> {
        return new Promise((resolve) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';

            const checkScript = `
import sys
try:
    import sentence_transformers
    import faiss
    import numpy
    print("OK")
except ImportError as e:
    print(f"MISSING: {e}", file=sys.stderr)
    sys.exit(1)
`;

            const process = spawn(pythonPath, ['-c', checkScript]);

            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    vscode.window.showWarningMessage(
                        'Python dependencies missing. Install: pip install sentence-transformers faiss-cpu numpy',
                        'Install Now'
                    ).then(selection => {
                        if (selection === 'Install Now') {
                            this.installPythonDependencies();
                        }
                    });
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Install Python dependencies
     */
    private async installPythonDependencies(): Promise<void> {
        const config = vscode.workspace.getConfiguration('agenticWorkflow');
        const pythonPath = config.get<string>('pythonPath') || 'python';

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Python dependencies...',
                cancellable: false,
            },
            async () => {
                return new Promise<void>((resolve, reject) => {
                    const process = spawn(pythonPath, [
                        '-m',
                        'pip',
                        'install',
                        'sentence-transformers',
                        'faiss-cpu',
                        'numpy',
                    ]);

                    process.on('close', (code) => {
                        if (code === 0) {
                            vscode.window.showInformationMessage('Python dependencies installed successfully');
                            resolve();
                        } else {
                            vscode.window.showErrorMessage('Failed to install Python dependencies');
                            reject(new Error('Installation failed'));
                        }
                    });
                });
            }
        );
    }

    /**
     * Create a new vector index
     */
    async createIndex(
        name: string,
        data: any,
        embeddingModel: string,
        options?: {
            chunkSize?: number;
            overlap?: number;
        }
    ): Promise<VectorIndex> {
        // Check if index already exists
        if (this.indices.has(name)) {
            throw new Error(`Index already exists: ${name}`);
        }

        // Prepare data for embedding
        const documents = this.prepareDocuments(data, options);

        // Generate embeddings using Python
        const embeddings = await this.generateEmbeddings(documents, embeddingModel);

        // Create FAISS index
        const indexPath = path.join(this.vectorDbPath, `${name}.index`);
        await this.createFaissIndex(embeddings, indexPath);

        // Save document metadata
        const metadataPath = path.join(this.vectorDbPath, `${name}.metadata.json`);
        await fs.writeFile(metadataPath, JSON.stringify(documents, null, 2));

        const index: VectorIndex = {
            name,
            dimension: embeddings[0].length,
            count: embeddings.length,
            model: embeddingModel,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                indexPath,
                metadataPath,
                chunkSize: options?.chunkSize,
                overlap: options?.overlap,
            },
        };

        this.indices.set(name, index);
        await this.saveIndicesMetadata();

        return index;
    }

    /**
     * Prepare documents for embedding
     */
    private prepareDocuments(
        data: any,
        options?: { chunkSize?: number; overlap?: number }
    ): Array<{ id: string; content: string; metadata?: any }> {
        const documents: Array<{ id: string; content: string; metadata?: any }> = [];

        if (typeof data === 'string') {
            // Single text document - chunk it
            const chunks = this.chunkText(data, options?.chunkSize || 512, options?.overlap || 50);
            chunks.forEach((chunk, i) => {
                documents.push({
                    id: `chunk_${i}`,
                    content: chunk,
                });
            });
        } else if (Array.isArray(data)) {
            // Array of documents
            data.forEach((item, i) => {
                if (typeof item === 'string') {
                    documents.push({
                        id: `doc_${i}`,
                        content: item,
                    });
                } else if (typeof item === 'object' && item.content) {
                    documents.push({
                        id: item.id || `doc_${i}`,
                        content: item.content,
                        metadata: item.metadata,
                    });
                }
            });
        } else if (typeof data === 'object') {
            // Single document object
            documents.push({
                id: data.id || 'doc_0',
                content: data.content || JSON.stringify(data),
                metadata: data.metadata,
            });
        }

        return documents;
    }

    /**
     * Chunk text into smaller pieces
     */
    private chunkText(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.slice(start, end));
            start += chunkSize - overlap;
        }

        return chunks;
    }

    /**
     * Generate embeddings using Python sentence-transformers
     */
    private async generateEmbeddings(
        documents: Array<{ id: string; content: string; metadata?: any }>,
        model: string
    ): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';

            const texts = documents.map(d => d.content);
            const textsJson = JSON.stringify(texts);

            const pythonScript = `
import sys
import json
from sentence_transformers import SentenceTransformer

try:
    model = SentenceTransformer('${model}')
    texts = json.loads('''${textsJson}''')
    embeddings = model.encode(texts)
    print(json.dumps(embeddings.tolist()))
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
                    try {
                        const embeddings = JSON.parse(stdout);
                        resolve(embeddings);
                    } catch (error) {
                        reject(new Error(`Failed to parse embeddings: ${error}`));
                    }
                } else {
                    reject(new Error(`Embedding generation failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Create FAISS index from embeddings
     */
    private async createFaissIndex(embeddings: number[][], indexPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';

            const embeddingsJson = JSON.stringify(embeddings);

            const pythonScript = `
import sys
import json
import numpy as np
import faiss

try:
    embeddings = np.array(json.loads('''${embeddingsJson}''')).astype('float32')
    dimension = embeddings.shape[1]
    
    # Create FAISS index
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)
    
    # Save index
    faiss.write_index(index, '${indexPath}')
    print("OK")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

            const process = spawn(pythonPath, ['-c', pythonScript]);

            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FAISS index creation failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Search vector index
     */
    async search(
        indexName: string,
        query: string,
        k: number = 5
    ): Promise<VectorSearchResult[]> {
        const index = this.indices.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }

        // Generate query embedding
        const queryEmbedding = await this.generateEmbeddings(
            [{ id: 'query', content: query }],
            index.model
        );

        // Search FAISS index
        const results = await this.searchFaissIndex(
            index.metadata.indexPath,
            queryEmbedding[0],
            k
        );

        // Load document metadata
        const metadataPath = index.metadata.metadataPath;
        const documentsData = await fs.readFile(metadataPath, 'utf-8');
        const documents = JSON.parse(documentsData);

        // Map results to documents
        return results.map(result => ({
            id: documents[result.index].id,
            score: result.distance,
            content: documents[result.index].content,
            metadata: documents[result.index].metadata,
        }));
    }

    /**
     * Search FAISS index
     */
    private async searchFaissIndex(
        indexPath: string,
        queryEmbedding: number[],
        k: number
    ): Promise<Array<{ index: number; distance: number }>> {
        return new Promise((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('agenticWorkflow');
            const pythonPath = config.get<string>('pythonPath') || 'python';

            const queryJson = JSON.stringify(queryEmbedding);

            const pythonScript = `
import sys
import json
import numpy as np
import faiss

try:
    # Load index
    index = faiss.read_index('${indexPath}')
    
    # Prepare query
    query = np.array(json.loads('''${queryJson}''')).astype('float32').reshape(1, -1)
    
    # Search
    distances, indices = index.search(query, ${k})
    
    # Format results
    results = [
        {"index": int(idx), "distance": float(dist)}
        for idx, dist in zip(indices[0], distances[0])
    ]
    
    print(json.dumps(results))
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
                    try {
                        const results = JSON.parse(stdout);
                        resolve(results);
                    } catch (error) {
                        reject(new Error(`Failed to parse search results: ${error}`));
                    }
                } else {
                    reject(new Error(`FAISS search failed: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * List all indices
     */
    async listIndices(): Promise<VectorIndex[]> {
        return Array.from(this.indices.values());
    }

    /**
     * Get index by name
     */
    async getIndex(name: string): Promise<VectorIndex | undefined> {
        return this.indices.get(name);
    }

    /**
     * Delete an index
     */
    async deleteIndex(name: string): Promise<void> {
        const index = this.indices.get(name);
        if (!index) {
            throw new Error(`Index not found: ${name}`);
        }

        // Delete index files
        try {
            await fs.unlink(index.metadata.indexPath);
            await fs.unlink(index.metadata.metadataPath);
        } catch (error) {
            console.error('Failed to delete index files:', error);
        }

        // Remove from cache
        this.indices.delete(name);
        await this.saveIndicesMetadata();
    }

    /**
     * Update an index with new data
     */
    async updateIndex(
        name: string,
        newData: any,
        options?: { chunkSize?: number; overlap?: number }
    ): Promise<VectorIndex> {
        const existingIndex = this.indices.get(name);
        if (!existingIndex) {
            throw new Error(`Index not found: ${name}`);
        }

        // Delete old index
        await this.deleteIndex(name);

        // Create new index with combined data
        return this.createIndex(name, newData, existingIndex.model, options);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.indices.clear();
    }
}
