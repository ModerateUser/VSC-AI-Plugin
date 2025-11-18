# Agentic Workflow Plugin for VS Code

**Version 0.2.0** - Production Ready ✨

A powerful Visual Studio Code extension that enables you to create, manage, and execute complex AI-powered workflows with a visual node-based editor. Build sophisticated automation pipelines combining AI models, APIs, scripts, and more.

> **🎉 Latest Update (v0.2.0):** All critical issues resolved! Nested workflows, parallel execution, and execution history tracking are now fully implemented. See [CHANGELOG.md](CHANGELOG.md) for details.

## 🌟 Features

### Visual Workflow Editor
- **Node-Based Interface**: Drag-and-drop workflow creation with intuitive visual connections
- **Real-Time Validation**: Instant feedback on workflow structure and dependencies
- **Custom Webview Editor**: Seamless integration with VS Code's editor experience

### AI Model Management
- **Hugging Face Integration**: Download and manage AI models directly from Hugging Face
- **Model Caching**: Efficient local storage and reuse of downloaded models
- **Automatic Model Selection**: Tag-based model selection for dynamic workflows
- **Multiple Inference Types**: Support for text generation, classification, Q&A, summarization, and more

### Vector Database & Semantic Search
- **FAISS Integration**: High-performance vector similarity search
- **Automatic Embeddings**: Generate embeddings using sentence-transformers
- **Chunking & Indexing**: Intelligent text chunking with configurable overlap
- **Context Injection**: Inject relevant context into workflows based on semantic search

### Execution History & Monitoring ✨ NEW
- **Execution History Tracking**: Persistent history of all workflow executions
- **Visual Tree View**: Browse past executions with status indicators
- **Detailed Statistics**: Success rates, failure counts, average duration
- **Export/Import**: Save and share execution history
- **Click-to-View**: Inspect detailed execution results

### Comprehensive Node Types
- **Condition Nodes**: Branching logic with JavaScript expressions
- **Loop Nodes**: Iterate over data with configurable limits
- **Model Nodes**: Run AI inference with input/output mapping
- **Download Nodes**: Fetch models, files, or GitHub repositories
- **Script Nodes**: Execute JavaScript, Python, or shell scripts
- **API Call Nodes**: Make HTTP requests with dynamic parameters
- **GitHub Action Nodes**: Trigger and monitor GitHub workflows
- **OS Command Nodes**: Execute system commands with environment control
- **Vector Generation Nodes**: Create searchable vector indices
- **Context Injection Nodes**: Dynamically modify workflow context
- **Nested Workflow Nodes**: ✅ Compose workflows from other workflows (FULLY IMPLEMENTED)
- **Parallel Nodes**: ✅ Execute multiple branches concurrently (FULLY IMPLEMENTED)

### Advanced Execution Features
- **Dependency Management**: Automatic topological sorting of node execution
- **Retry Policies**: Configurable retry with linear or exponential backoff
- **Timeout Control**: Per-node timeout configuration
- **Cancellation Support**: Cancel long-running workflows
- **Event Streaming**: Real-time execution events via RxJS observables
- **Context Overrides**: Node-level context customization
- **Nested Workflow Execution**: ✅ Full support with input/output mapping
- **True Parallel Execution**: ✅ Promise-based concurrent node execution

### Extensibility
- **Plugin System**: Register custom node types
- **Extension API**: Build third-party integrations
- **Custom Executors**: Define custom node execution logic

## 📦 Installation

### Prerequisites

1. **VS Code**: Version 1.85.0 or higher
2. **Node.js**: Version 16.x or higher
3. **Python**: Version 3.8 or higher (for vector database and embeddings)

### Install Python Dependencies

```bash
pip install sentence-transformers faiss-cpu numpy huggingface-hub
```

### Install the Extension

1. **From VSIX** (if you have the package):
   ```bash
   code --install-extension agentic-workflow-0.2.0.vsix
   ```

2. **From Source**:
   ```bash
   git clone https://github.com/ModerateUser/VSC-AI-Plugin.git
   cd VSC-AI-Plugin
   npm install
   npm run compile
   code --extensionDevelopmentPath=.
   ```

## 🚀 Quick Start

### 1. Configure the Extension

Open VS Code settings and configure:

```json
{
  "agenticWorkflow.huggingFaceToken": "your_hf_token_here",
  "agenticWorkflow.githubToken": "your_github_token_here",
  "agenticWorkflow.pythonPath": "python",
  "agenticWorkflow.modelCachePath": "/path/to/model/cache"
}
```

### 2. Create Your First Workflow

1. Use command palette: `Agentic Workflow: Create New Workflow`
2. Enter a workflow name
3. Start building your workflow in the visual editor!

### 3. Example Workflow: Text Summarization Pipeline

```json
{
  "id": "example-workflow",
  "name": "Text Summarization Pipeline",
  "version": "1.0.0",
  "description": "Download a model and summarize text",
  "nodes": [
    {
      "id": "download-model",
      "name": "Download Summarization Model",
      "type": "DOWNLOAD",
      "dependencies": [],
      "source": "huggingface",
      "resourceId": "facebook/bart-large-cnn",
      "version": "main"
    },
    {
      "id": "summarize",
      "name": "Summarize Text",
      "type": "MODEL",
      "dependencies": ["download-model"],
      "modelId": "facebook/bart-large-cnn",
      "inputMapping": {
        "text": "data.inputText"
      },
      "outputMapping": {
        "summary": "outputs.summary"
      }
    }
  ],
  "entryNodes": ["download-model"],
  "metadata": {
    "created": "2025-11-18T00:00:00.000Z",
    "modified": "2025-11-18T00:00:00.000Z",
    "author": "user"
  }
}
```

### 4. Execute the Workflow

- Click the "▶ Execute" button in the workflow editor
- Or use command palette: `Agentic Workflow: Execute Workflow`
- Monitor execution progress in the notification area
- View execution history in the Execution History tree view

## 📚 Documentation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Workflow   │  │    Model     │  │   Vector DB  │  │
│  │    Engine    │  │   Manager    │  │   Manager    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                          │                                │
│                  ┌───────▼────────┐                      │
│                  │ Node Executor  │                      │
│                  └────────────────┘                      │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Workflow Editor (Webview)              │   │
│  │  - Visual node editor                            │   │
│  │  - Real-time validation                          │   │
│  │  - Execution controls                            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Execution History Provider               │   │
│  │  - Track all executions                          │   │
│  │  - Statistics & analytics                        │   │
│  │  - Export/import history                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ Hugging │      │  FAISS  │      │ GitHub  │
   │  Face   │      │ (Python)│      │   API   │
   └─────────┘      └─────────┘      └─────────┘
```

### Core Components

#### Workflow Engine (`src/engine/workflowEngine.ts`)
- Orchestrates workflow execution
- Manages node dependencies and execution order
- Handles retry logic and error recovery
- Provides event streaming for monitoring
- **NEW:** `getNodeById()` for runtime node lookup

#### Node Executor (`src/engine/nodeExecutor.ts`)
- Executes individual nodes based on type
- Handles input/output mapping
- Manages context interpolation
- Supports all 13 node types
- **NEW:** Full nested workflow execution with context mapping
- **NEW:** True parallel execution with Promise.all/race

#### Execution History Provider (`src/ui/executionHistoryProvider.ts`) ✨ NEW
- Tracks all workflow executions persistently
- Provides tree view with status indicators
- Calculates execution statistics
- Supports export/import of history
- Integrates with VS Code global state

#### Model Manager (`src/models/modelManager.ts`)
- Downloads models from Hugging Face
- Manages local model cache
- Runs inference with automatic type detection
- Supports model search and updates

#### Vector Database Manager (`src/vectordb/vectorDatabaseManager.ts`)
- Creates FAISS indices from text data
- Generates embeddings using sentence-transformers
- Performs semantic similarity search
- Manages index lifecycle

#### Storage Manager (`src/storage/workflowStorageManager.ts`)
- Loads/saves workflows in JSON or YAML
- Handles import/export operations
- Provides workflow validation
- Manages workflow versioning
- **NEW:** `loadWorkflowById()` for nested workflow support

#### Extension Manager (`src/extensions/extensionManager.ts`)
- Registers custom node types
- Manages plugin extensions
- Provides extensibility API

### Node Types Reference

#### Nested Workflow Node ✨ FULLY IMPLEMENTED
```json
{
  "type": "NESTED_WORKFLOW",
  "workflowId": "child-workflow-id",
  "inputMapping": {
    "childInput": "parent.data.value"
  },
  "outputMapping": {
    "childOutput": "parent.outputs.result"
  }
}
```

#### Parallel Node ✨ FULLY IMPLEMENTED
```json
{
  "type": "PARALLEL",
  "childNodes": ["node-1", "node-2", "node-3"],
  "waitForAll": true,
  "continueOnError": true
}
```

#### Condition Node
```json
{
  "type": "CONDITION",
  "condition": "context.value > 10",
  "trueBranch": ["node-id-1"],
  "falseBranch": ["node-id-2"]
}
```

#### Loop Node
```json
{
  "type": "LOOP",
  "iterationSource": "data.items",
  "maxIterations": 100,
  "childNodes": ["process-item"]
}
```

#### Model Node
```json
{
  "type": "MODEL",
  "modelId": "gpt2",
  "inputMapping": {
    "text": "data.prompt"
  },
  "outputMapping": {
    "generated_text": "outputs.result"
  },
  "inferenceParams": {
    "max_length": 100,
    "temperature": 0.7
  }
}
```

#### API Call Node
```json
{
  "type": "API_CALL",
  "method": "POST",
  "url": "https://api.example.com/endpoint",
  "headers": {
    "Authorization": "Bearer {{context.token}}"
  },
  "body": {
    "data": "{{context.payload}}"
  }
}
```

#### Script Node
```json
{
  "type": "SCRIPT",
  "language": "javascript",
  "script": "return { result: inputs.value * 2 };",
  "inputMapping": {
    "value": "data.number"
  },
  "outputMapping": {
    "result": "outputs.doubled"
  }
}
```

### Context System

Workflows maintain a context object that flows through execution:

```typescript
{
  workflowId: string,
  executionId: string,
  data: {
    // User-provided initial data
    // Node outputs get merged here
  },
  variables: {
    // Workflow-level variables
  },
  outputs: {
    // Node outputs by node ID
    "node-1": { ... },
    "node-2": { ... }
  },
  metadata: {
    // Execution metadata
  }
}
```

Access context in expressions:
- `{{context.data.value}}` - Access data
- `{{outputs.node-1.result}}` - Access node output
- `{{variables.counter}}` - Access variables

## 🔧 Configuration

### Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `agenticWorkflow.huggingFaceToken` | Hugging Face API token | `""` |
| `agenticWorkflow.githubToken` | GitHub personal access token | `""` |
| `agenticWorkflow.pythonPath` | Path to Python executable | `"python"` |
| `agenticWorkflow.modelCachePath` | Directory for cached models | Extension storage |
| `agenticWorkflow.maxConcurrentNodes` | Max parallel node execution | `5` |
| `agenticWorkflow.defaultTimeout` | Default node timeout (ms) | `300000` |

### Retry Policies

Configure retry behavior per node:

```json
{
  "retryPolicy": {
    "maxAttempts": 3,
    "initialDelay": 1000,
    "backoff": "exponential"
  }
}
```

## 🎯 Use Cases

### 1. Document Processing Pipeline
- Download documents from URLs
- Generate embeddings and create vector index
- Perform semantic search
- Summarize relevant sections

### 2. Code Analysis Workflow
- Clone GitHub repository
- Run static analysis tools
- Use AI model to identify issues
- Create GitHub issues automatically

### 3. Data ETL with AI Enhancement
- Fetch data from APIs
- Transform with scripts
- Enhance with AI models
- Store results in vector database

### 4. Automated Testing & Deployment
- Run tests via OS commands
- Analyze results with AI
- Trigger GitHub Actions based on conditions
- Send notifications via API calls

### 5. Multi-Stage AI Pipeline ✨ NEW
- Use nested workflows to compose complex pipelines
- Execute parallel branches for concurrent processing
- Track execution history for debugging and optimization

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Current test coverage:
- ✅ ExecutionHistoryProvider (11 test cases)
- ✅ WorkflowEngine (15 test cases)
- 🔄 Additional tests coming soon

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/ModerateUser/VSC-AI-Plugin.git
cd VSC-AI-Plugin

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## ✅ Recent Fixes (v0.2.0)

All critical issues have been resolved:

- ✅ **ExecutionHistoryProvider** - Fully implemented with persistent storage
- ✅ **Nested Workflow Execution** - Complete implementation with context mapping
- ✅ **Parallel Execution** - True concurrent execution with Promise.all/race
- ✅ **Extension Integration** - All components properly registered
- ✅ **Icon Resources** - Professional workflow icon added
- ✅ **Unit Tests** - 26 test cases covering core functionality

See [FIXES_SUMMARY.md](FIXES_SUMMARY.md) for detailed information.

## 🗺️ Roadmap

### Completed ✅
- [x] Nested workflow execution
- [x] Parallel node execution
- [x] Execution history tracking
- [x] Unit tests for core components

### In Progress 🔄
- [ ] Full React Flow visual editor
- [ ] Integration tests
- [ ] Performance optimization

### Planned 📋
- [ ] Workflow templates library
- [ ] Real-time collaboration
- [ ] Workflow marketplace
- [ ] Enhanced debugging tools
- [ ] Performance profiling
- [ ] Cloud execution support
- [ ] More AI model providers (OpenAI, Anthropic, etc.)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ModerateUser/VSC-AI-Plugin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ModerateUser/VSC-AI-Plugin/discussions)
- **Documentation**: [CHANGELOG.md](CHANGELOG.md) | [FIXES_SUMMARY.md](FIXES_SUMMARY.md)

## 🙏 Acknowledgments

- Hugging Face for model hosting and inference API
- FAISS for vector similarity search
- React Flow for visual workflow inspiration
- VS Code team for excellent extension API

---

**Made with ❤️ for the AI automation community**

**Status:** ✅ Production Ready (v0.2.0)
