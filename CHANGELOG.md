# Changelog

All notable changes to the Agentic Workflow Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-11-18

### Added

#### Core Features
- **Workflow Engine**: Complete workflow execution orchestrator with dependency management
- **Node Executor**: Comprehensive executor supporting 13 node types
- **Visual Editor**: Custom webview-based workflow editor with real-time validation
- **Model Manager**: Hugging Face integration for model download and inference
- **Vector Database**: FAISS-based semantic search with automatic embeddings
- **Storage Manager**: Workflow persistence with JSON/YAML support
- **Extension System**: Plugin architecture for custom node types

#### Node Types
- Condition nodes with JavaScript expression evaluation
- Loop nodes with configurable iteration limits
- Model nodes with automatic inference type detection
- Download nodes for Hugging Face, URLs, and GitHub
- Script nodes supporting JavaScript, Python, and Shell
- API call nodes with dynamic parameter interpolation
- GitHub Action nodes with workflow dispatch and monitoring
- OS command nodes with environment control
- Vector generation nodes for creating searchable indices
- Context injection nodes for dynamic data manipulation
- Nested workflow nodes (placeholder)
- Parallel execution nodes (placeholder)
- Custom node type support via extensions

#### Execution Features
- Topological sorting for dependency resolution
- Configurable retry policies (linear/exponential backoff)
- Per-node timeout configuration
- Workflow cancellation support
- Real-time execution event streaming via RxJS
- Context override system for node-level customization
- Comprehensive error handling and recovery

#### AI & ML Features
- Hugging Face model download and caching
- Multiple inference types: text generation, classification, Q&A, summarization, translation
- Tag-based model selection
- Sentence-transformers integration for embeddings
- FAISS vector similarity search
- Automatic text chunking with configurable overlap
- Vector index management (create, search, update, delete)

#### Developer Experience
- TypeScript with strict type checking
- Comprehensive type definitions for all workflow components
- Webpack bundling for optimized extension size
- ESLint configuration for code quality
- VS Code command palette integration
- Tree view providers for workflows and models
- Progress indicators for long-running operations

#### Documentation
- Comprehensive README with installation and usage guides
- Architecture documentation with component diagrams
- Node type reference with examples
- Configuration guide
- Use case examples
- Contributing guidelines

### Technical Details

#### Architecture
- Modular component design with clear separation of concerns
- Event-driven execution monitoring
- Async/await throughout for proper concurrency
- AbortController integration for cancellation
- Immer for immutable state management (prepared)
- RxJS for reactive event streams

#### Dependencies
- `@huggingface/inference`: Hugging Face API client
- `@octokit/rest`: GitHub API integration
- `node-fetch`: HTTP requests
- `uuid`: Unique ID generation
- `js-yaml`: YAML parsing
- `rxjs`: Reactive programming
- Python: `sentence-transformers`, `faiss-cpu`, `numpy`, `huggingface-hub`

#### File Structure
```
src/
├── engine/
│   ├── workflowEngine.ts       (15.4 KB)
│   └── nodeExecutor.ts         (20.7 KB)
├── models/
│   └── modelManager.ts         (14.0 KB)
├── vectordb/
│   └── vectorDatabaseManager.ts (17.1 KB)
├── storage/
│   └── workflowStorageManager.ts (6.6 KB)
├── extensions/
│   └── extensionManager.ts     (3.0 KB)
├── ui/
│   └── workflowEditorProvider.ts (17.6 KB)
├── types/
│   └── workflow.ts             (7.9 KB)
└── extension.ts                (15.3 KB)
```

### Known Limitations
- React Flow visual editor not yet implemented (basic webview available)
- Nested workflow execution needs implementation
- Parallel node execution is currently sequential
- Limited error recovery in some edge cases
- Python dependency installation requires manual setup

### Configuration Options
- `agenticWorkflow.huggingFaceToken`: Hugging Face API token
- `agenticWorkflow.githubToken`: GitHub personal access token
- `agenticWorkflow.pythonPath`: Path to Python executable
- `agenticWorkflow.modelCachePath`: Model cache directory
- `agenticWorkflow.maxConcurrentNodes`: Max parallel nodes (default: 5)
- `agenticWorkflow.defaultTimeout`: Default timeout in ms (default: 300000)

### Commands
- `agenticWorkflow.openEditor`: Open workflow editor
- `agenticWorkflow.createWorkflow`: Create new workflow
- `agenticWorkflow.executeWorkflow`: Execute workflow
- `agenticWorkflow.importWorkflow`: Import workflow from file
- `agenticWorkflow.exportWorkflow`: Export workflow to file
- `agenticWorkflow.manageModels`: Manage AI models

### Future Roadmap
- Full React Flow visual editor implementation
- Real-time collaboration features
- Workflow templates library
- Enhanced debugging and profiling tools
- Cloud execution support
- Additional AI model providers (OpenAI, Anthropic)
- Workflow marketplace
- Performance optimizations
- Enhanced error recovery
- Workflow versioning system

---

## [Unreleased]

### Planned Features
- [ ] React Flow integration for visual node editing
- [ ] Drag-and-drop node creation
- [ ] Real-time execution visualization
- [ ] Workflow templates
- [ ] Collaborative editing
- [ ] Cloud storage integration
- [ ] Enhanced debugging tools
- [ ] Performance profiling
- [ ] Workflow testing framework
- [ ] CI/CD integration examples

### Under Consideration
- WebAssembly for performance-critical operations
- Local LLM support (llama.cpp, GGML)
- Database connectors (PostgreSQL, MongoDB, etc.)
- Message queue integration (RabbitMQ, Kafka)
- Kubernetes job execution
- Docker container nodes
- Workflow scheduling/cron support
- Multi-language script support (Ruby, Go, Rust)

---

**Note**: This is the initial release. Please report issues and feature requests on [GitHub Issues](https://github.com/ModerateUser/VSC-AI-Plugin/issues).
