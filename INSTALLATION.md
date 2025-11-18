# 🚀 Installation & Usage Guide

Complete guide to installing and using the Agentic Workflow Plugin for VS Code.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Initial Setup](#initial-setup)
4. [GPU Support (Optional)](#gpu-support-optional)
5. [Quick Start](#quick-start)
6. [Creating Your First Workflow](#creating-your-first-workflow)
7. [Using the Plugin](#using-the-plugin)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **VS Code** | 1.85.0+ | IDE | [Download](https://code.visualstudio.com/) |
| **Node.js** | 20.x | Runtime | [Download](https://nodejs.org/) |
| **Python** | 3.8+ | AI Models | [Download](https://www.python.org/) |
| **Git** | Latest | Version Control | [Download](https://git-scm.com/) |

### Optional (For GPU Acceleration)

| Hardware | Minimum | Recommended |
|----------|---------|-------------|
| **NVIDIA GPU** | GTX 1060 (6GB) | RTX 3060+ (12GB+) |
| **AMD GPU** | RX 6600 (8GB) | RX 7900 XTX (24GB) |
| **Apple Silicon** | M1 (8GB) | M2/M3 (16GB+) |

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should output: v20.x.x or higher

# Check Python version
python --version
# Should output: Python 3.8.x or higher

# Check VS Code version
code --version
# Should output: 1.85.0 or higher

# Check Git version
git --version
# Should output: git version 2.x.x or higher

# Check GPU (NVIDIA only)
nvidia-smi
# Should show GPU info if NVIDIA GPU present
```

---

## 🔧 Installation Methods

### Method 1: Install from Source (Recommended for Development)

This method is best if you want to modify the plugin or contribute to development.

#### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/ModerateUser/VSC-AI-Plugin.git

# Navigate to the directory
cd VSC-AI-Plugin
```

#### Step 2: Install Node.js Dependencies

```bash
# Install all npm packages
npm install

# This will install:
# - TypeScript compiler
# - Webpack bundler
# - All runtime dependencies
# - Development tools
```

#### Step 3: Install Python Dependencies

**For CPU-only (Basic Installation):**

```bash
# Install Python packages for AI functionality
pip install sentence-transformers faiss-cpu numpy huggingface-hub

# Or use pip3 if you have multiple Python versions
pip3 install sentence-transformers faiss-cpu numpy huggingface-hub
```

**For GPU Support (10-100x Faster):**

See the [GPU Support](#gpu-support-optional) section below for detailed GPU installation instructions.

**Python Dependencies Explained:**
- `sentence-transformers` - Generate embeddings for semantic search
- `faiss-cpu` or `faiss-gpu` - Fast vector similarity search
- `numpy` - Numerical computing (required by above)
- `huggingface-hub` - Download AI models from Hugging Face

#### Step 4: Compile the Extension

```bash
# Compile TypeScript to JavaScript
npm run compile

# This creates the dist/ folder with compiled code
```

#### Step 5: Open in VS Code

```bash
# Open the extension in VS Code
code .
```

#### Step 6: Run the Extension

1. Press `F5` or go to **Run > Start Debugging**
2. This opens a new VS Code window with the extension loaded
3. The extension is now active in the development window

---

## ⚙️ Initial Setup

### 1. Configure API Tokens (Optional but Recommended)

The plugin works with several external services. Configure tokens for the features you need:

#### Hugging Face Token (For AI Models)

1. Go to [Hugging Face Settings](https://huggingface.co/settings/tokens)
2. Create a new token with `read` access
3. In VS Code, open Settings (`Ctrl+,` or `Cmd+,`)
4. Search for "Agentic Workflow"
5. Paste your token in **Hugging Face Token** field

**Or via settings.json:**
```json
{
  "agenticWorkflow.huggingFaceToken": "hf_your_token_here"
}
```

#### GitHub Token (For GitHub Actions Integration)

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Create a new token with `repo` and `workflow` scopes
3. In VS Code Settings, paste token in **GitHub Token** field

**Or via settings.json:**
```json
{
  "agenticWorkflow.githubToken": "ghp_your_token_here"
}
```

### 2. Configure Python Path (If Needed)

If Python is not in your PATH or you have multiple versions:

```json
{
  "agenticWorkflow.pythonPath": "/usr/local/bin/python3"
}
```

**Find your Python path:**
```bash
# On macOS/Linux
which python3

# On Windows
where python
```

### 3. Configure Model Cache Path (Optional)

By default, models are cached in your home directory. To use a custom location:

```json
{
  "agenticWorkflow.modelCachePath": "/path/to/your/cache"
}
```

---

## 🚀 GPU Support (Optional)

### Why GPU?

GPU acceleration provides **10-100x faster** AI model inference:

| Operation | CPU Time | GPU Time | Speedup |
|-----------|----------|----------|---------|
| Text Generation | 30s | 2s | **15x** |
| Embeddings | 45s | 3s | **15x** |
| Vector Search | 5s | 0.2s | **25x** |

### Quick GPU Setup

#### Windows/Linux (NVIDIA)

```bash
# 1. Install NVIDIA drivers and CUDA
# Download from: https://developer.nvidia.com/cuda-downloads

# 2. Uninstall CPU packages
pip uninstall faiss-cpu torch

# 3. Install GPU packages
pip install faiss-gpu
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install sentence-transformers transformers accelerate

# 4. Verify GPU
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"
```

#### macOS (Apple Silicon)

```bash
# 1. Install PyTorch with Metal support
pip install torch torchvision torchaudio

# 2. Install other packages
pip install sentence-transformers transformers accelerate faiss-cpu

# 3. Enable Metal
echo 'export PYTORCH_ENABLE_MPS_FALLBACK=1' >> ~/.zshrc
source ~/.zshrc
```

#### Linux (AMD ROCm)

```bash
# 1. Install ROCm
# Follow: https://rocm.docs.amd.com/

# 2. Install PyTorch with ROCm
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm5.7

# 3. Install other packages
pip install sentence-transformers transformers accelerate
```

### Enable GPU in VS Code

```json
{
  "agenticWorkflow.enableGPU": true,
  "agenticWorkflow.gpuDevice": 0,
  "agenticWorkflow.enableMixedPrecision": true
}
```

### 📖 Full GPU Documentation

For complete GPU setup instructions, troubleshooting, and optimization tips, see:

**[GPU_SETUP.md](GPU_SETUP.md)** - Comprehensive GPU guide with:
- Detailed installation for all platforms
- Performance benchmarks
- Configuration options
- Troubleshooting guide
- Optimization tips

---

## 🚀 Quick Start

### Open the Extension

Once installed, you'll see a new icon in the Activity Bar (left sidebar):

1. Click the **Agentic Workflow** icon
2. You'll see three panels:
   - **Workflows** - Your saved workflows
   - **AI Models** - Downloaded models
   - **Execution History** - Past workflow runs

### Try an Example Workflow

The plugin comes with example workflows to get you started:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Agentic Workflow: Open Editor"
3. Navigate to `examples/text-summarization.workflow.json`
4. The workflow editor will open
5. Click **Execute Workflow** button (or use Command Palette)

---

## 📝 Creating Your First Workflow

### Method 1: Using the Command Palette

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Agentic Workflow: Create New Workflow"
3. Enter a name (e.g., `my-first-workflow`)
4. A new workflow file is created and opened

### Method 2: Create Manually

1. Create a new file: `my-workflow.workflow.json`
2. Paste this basic template:

```json
{
  "name": "My First Workflow",
  "description": "A simple workflow to get started",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "input",
      "type": "input",
      "name": "User Input",
      "config": {
        "schema": {
          "text": "string"
        }
      }
    },
    {
      "id": "output",
      "type": "output",
      "name": "Display Result",
      "config": {
        "outputs": {
          "result": "{{input.text}}"
        }
      },
      "dependencies": ["input"]
    }
  ],
  "metadata": {
    "author": "Your Name",
    "tags": ["example", "beginner"]
  }
}
```

3. Save the file
4. Right-click the file and select "Open with Workflow Editor"

---

## 🎯 Using the Plugin

### Available Commands

Access all commands via Command Palette (`Ctrl+Shift+P`):

| Command | Description | Shortcut |
|---------|-------------|----------|
| **Open Workflow Editor** | Open a workflow file | - |
| **Create New Workflow** | Create a new workflow | - |
| **Execute Workflow** | Run a workflow | - |
| **Manage AI Models** | Download/manage models | - |
| **Import Workflow** | Import from file | - |
| **Export Workflow** | Export to JSON/YAML | - |

### Workflow Editor Features

When you open a workflow file:

1. **Visual Editor** (Coming Soon) - Drag-and-drop node editor
2. **JSON/YAML Editor** (Current) - Edit workflow definition directly
3. **Execute Button** - Run the workflow
4. **Validation** - Real-time syntax checking

### Managing AI Models

#### Download a Model

1. Command Palette > "Agentic Workflow: Manage Models"
2. Select "Download Model"
3. Enter Hugging Face model ID (e.g., `bert-base-uncased`)
4. Wait for download to complete

#### List Installed Models

1. Command Palette > "Agentic Workflow: Manage Models"
2. Select "List Models"
3. View all downloaded models

#### Delete a Model

1. Command Palette > "Agentic Workflow: Manage Models"
2. Select "Delete Model"
3. Choose model to remove
4. Confirm deletion

---

## 🔧 Configuration

### All Available Settings

Open VS Code Settings and search for "Agentic Workflow":

```json
{
  // API Tokens
  "agenticWorkflow.huggingFaceToken": "",
  "agenticWorkflow.githubToken": "",
  
  // Paths
  "agenticWorkflow.modelCachePath": "",
  "agenticWorkflow.pythonPath": "python",
  
  // Performance
  "agenticWorkflow.maxConcurrentNodes": 5,
  
  // Features
  "agenticWorkflow.enableVectorDB": true,
  
  // GPU Settings (Optional)
  "agenticWorkflow.enableGPU": false,
  "agenticWorkflow.gpuDevice": 0,
  "agenticWorkflow.gpuMemoryLimit": 0,
  "agenticWorkflow.gpuBatchSize": 32,
  "agenticWorkflow.enableMixedPrecision": true,
  "agenticWorkflow.gpuMemoryFraction": 0.9
}
```

### Configuration Details

#### Basic Settings

- **`huggingFaceToken`** - Access Hugging Face models (required for downloads)
- **`githubToken`** - Trigger GitHub Actions (required for GitHub nodes)
- **`modelCachePath`** - Where to store models (default: `~/.cache/huggingface`)
- **`pythonPath`** - Python executable path (default: `python`)
- **`maxConcurrentNodes`** - Max parallel execution (default: 5)
- **`enableVectorDB`** - Enable vector database features (default: true)

#### GPU Settings (See GPU_SETUP.md for details)

- **`enableGPU`** - Enable GPU acceleration (default: false)
- **`gpuDevice`** - GPU device ID (0 = first GPU, -1 = CPU)
- **`gpuMemoryLimit`** - GPU memory limit in GB (0 = no limit)
- **`gpuBatchSize`** - Batch size for inference (default: 32)
- **`enableMixedPrecision`** - Use FP16 for faster inference (default: true)
- **`gpuMemoryFraction`** - GPU memory fraction to use (default: 0.9)

---

## 🔍 Workflow Node Types

The plugin supports 13 different node types:

### Basic Nodes

| Node Type | Purpose | Example Use |
|-----------|---------|-------------|
| **input** | Get user input | Prompt for text, numbers, files |
| **output** | Display results | Show final output |
| **transform** | Modify data | Format, filter, map data |
| **condition** | Branching logic | If/else decisions |
| **loop** | Iteration | Process arrays, repeat tasks |

### AI Nodes

| Node Type | Purpose | Example Use |
|-----------|---------|-------------|
| **model** | AI inference | Text generation, classification |
| **embedding** | Generate vectors | Semantic search, similarity |

### Integration Nodes

| Node Type | Purpose | Example Use |
|-----------|---------|-------------|
| **api** | HTTP requests | Call REST APIs |
| **github** | GitHub Actions | Trigger workflows, get data |
| **script** | Run code | JavaScript, Python, Shell |

### Advanced Nodes

| Node Type | Purpose | Example Use |
|-----------|---------|-------------|
| **vector** | Vector search | Semantic search, RAG |
| **parallel** | Concurrent execution | Run multiple tasks |
| **nested** | Sub-workflows | Reusable components |

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: "Python not found"

**Solution:**
1. Verify Python is installed: `python --version`
2. Set Python path in settings:
   ```json
   {
     "agenticWorkflow.pythonPath": "/full/path/to/python"
   }
   ```

#### Issue: "Failed to import sentence-transformers"

**Solution:**
```bash
# Reinstall Python dependencies
pip install --upgrade sentence-transformers faiss-cpu numpy
```

#### Issue: "Model download failed"

**Solution:**
1. Check internet connection
2. Verify Hugging Face token is set
3. Try a different model ID
4. Check disk space

#### Issue: "Workflow execution failed"

**Solution:**
1. Check workflow syntax (JSON/YAML valid)
2. Verify all node dependencies are correct
3. Check node configuration
4. View error details in output panel

#### Issue: "Extension not activating"

**Solution:**
1. Check VS Code version (1.85.0+)
2. Reload window: `Ctrl+Shift+P` > "Reload Window"
3. Check extension logs: `Ctrl+Shift+P` > "Developer: Show Logs"
4. Reinstall extension

#### Issue: "GPU not detected" (If using GPU)

**Solution:**
See [GPU_SETUP.md](GPU_SETUP.md) for comprehensive GPU troubleshooting.

### Getting Help

If you encounter issues:

1. **Check the logs:**
   - Open Output panel (`Ctrl+Shift+U`)
   - Select "Agentic Workflow" from dropdown

2. **Report an issue:**
   - Go to [GitHub Issues](https://github.com/ModerateUser/VSC-AI-Plugin/issues)
   - Provide:
     - VS Code version
     - Extension version
     - Error message
     - Steps to reproduce

---

## 📚 Next Steps

### Learn More

1. **Read the README** - Comprehensive feature overview
2. **Study Examples** - Learn from example workflows
3. **Check CHANGELOG** - See what's new
4. **Read AUDIT.md** - Technical details
5. **GPU Setup** - Enable GPU acceleration (see GPU_SETUP.md)

### Advanced Usage

1. **Create Custom Nodes** - Extend with plugins
2. **Build Complex Workflows** - Chain multiple operations
3. **Integrate with CI/CD** - Automate with GitHub Actions
4. **Share Workflows** - Export and share with team
5. **Optimize Performance** - Use GPU for 10-100x speedup

### Community

- **GitHub:** [ModerateUser/VSC-AI-Plugin](https://github.com/ModerateUser/VSC-AI-Plugin)
- **Issues:** [Report bugs or request features](https://github.com/ModerateUser/VSC-AI-Plugin/issues)
- **Discussions:** [Ask questions and share workflows](https://github.com/ModerateUser/VSC-AI-Plugin/discussions)

---

## 🎉 You're Ready!

You now have everything you need to start using the Agentic Workflow Plugin. Here's a quick recap:

✅ Prerequisites installed  
✅ Extension installed and running  
✅ API tokens configured  
✅ Example workflows tested  
✅ First workflow created  
✅ GPU support (optional) configured

**Happy workflow building! 🚀**

---

## 📖 Quick Reference

### Installation Commands

```bash
# Clone repository
git clone https://github.com/ModerateUser/VSC-AI-Plugin.git
cd VSC-AI-Plugin

# Install dependencies
npm install

# CPU-only
pip install sentence-transformers faiss-cpu numpy huggingface-hub

# GPU (NVIDIA)
pip install faiss-gpu torch --index-url https://download.pytorch.org/whl/cu121
pip install sentence-transformers transformers accelerate

# Compile and run
npm run compile
code .
# Press F5 to start debugging
```

### Essential Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Open File | `Ctrl+P` | `Cmd+P` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Extensions | `Ctrl+Shift+X` | `Cmd+Shift+X` |
| Output Panel | `Ctrl+Shift+U` | `Cmd+Shift+U` |

### Useful Links

- **Repository:** https://github.com/ModerateUser/VSC-AI-Plugin
- **GPU Setup:** [GPU_SETUP.md](GPU_SETUP.md)
- **Hugging Face:** https://huggingface.co/
- **VS Code Docs:** https://code.visualstudio.com/docs
- **Python Docs:** https://docs.python.org/

---

**Last Updated:** November 18, 2025  
**Version:** 0.1.0  
**Maintainer:** ModerateUser
