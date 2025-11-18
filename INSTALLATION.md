# 🚀 Installation & Usage Guide

Complete guide to installing and using the Agentic Workflow Plugin for VS Code.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Initial Setup](#initial-setup)
4. [Quick Start](#quick-start)
5. [Creating Your First Workflow](#creating-your-first-workflow)
6. [Using the Plugin](#using-the-plugin)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **VS Code** | 1.85.0+ | IDE | [Download](https://code.visualstudio.com/) |
| **Node.js** | 20.x | Runtime | [Download](https://nodejs.org/) |
| **Python** | 3.8+ | AI Models | [Download](https://www.python.org/) |
| **Git** | Latest | Version Control | [Download](https://git-scm.com/) |

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

```bash
# Install Python packages for AI functionality
pip install sentence-transformers faiss-cpu numpy huggingface-hub

# Or use pip3 if you have multiple Python versions
pip3 install sentence-transformers faiss-cpu numpy huggingface-hub
```

**Python Dependencies Explained:**
- `sentence-transformers` - Generate embeddings for semantic search
- `faiss-cpu` - Fast vector similarity search
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

### Method 2: Install from VSIX Package (Coming Soon)

Once published to the VS Code Marketplace, you'll be able to install with one click.

```bash
# Install from VSIX file (when available)
code --install-extension agentic-workflow-0.1.0.vsix
```

---

### Method 3: Install from VS Code Marketplace (Coming Soon)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Agentic Workflow"
4. Click **Install**

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
  "agenticWorkflow.enableVectorDB": true
}
```

### Configuration Details

#### `huggingFaceToken`
- **Type:** String
- **Default:** Empty
- **Purpose:** Access Hugging Face models
- **Required:** For downloading models

#### `githubToken`
- **Type:** String
- **Default:** Empty
- **Purpose:** Trigger GitHub Actions
- **Required:** For GitHub integration nodes

#### `modelCachePath`
- **Type:** String
- **Default:** `~/.cache/huggingface`
- **Purpose:** Where to store downloaded models
- **Note:** Leave empty for default location

#### `pythonPath`
- **Type:** String
- **Default:** `python`
- **Purpose:** Path to Python executable
- **Note:** Use full path if Python not in PATH

#### `maxConcurrentNodes`
- **Type:** Number
- **Default:** 5
- **Purpose:** Max parallel node execution
- **Range:** 1-20

#### `enableVectorDB`
- **Type:** Boolean
- **Default:** true
- **Purpose:** Enable vector database features
- **Note:** Requires Python dependencies

---

## 🎓 Example Workflows

### Example 1: Text Summarization

Located at `examples/text-summarization.workflow.json`

**What it does:**
1. Takes input text
2. Loads a summarization model
3. Generates a summary
4. Outputs the result

**How to run:**
1. Open the example file
2. Execute workflow
3. Enter text when prompted
4. View summary in output

### Example 2: Semantic Search Q&A

Located at `examples/semantic-search-qa.workflow.json`

**What it does:**
1. Loads documents
2. Creates vector embeddings
3. Searches for relevant content
4. Answers questions using context

**How to run:**
1. Open the example file
2. Prepare some text documents
3. Execute workflow
4. Ask questions about the documents

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

### Getting Help

If you encounter issues:

1. **Check the logs:**
   - Open Output panel (`Ctrl+Shift+U`)
   - Select "Agentic Workflow" from dropdown

2. **Enable debug logging:**
   ```json
   {
     "agenticWorkflow.logLevel": "debug"
   }
   ```

3. **Report an issue:**
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

### Advanced Usage

1. **Create Custom Nodes** - Extend with plugins
2. **Build Complex Workflows** - Chain multiple operations
3. **Integrate with CI/CD** - Automate with GitHub Actions
4. **Share Workflows** - Export and share with team

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
pip install sentence-transformers faiss-cpu numpy huggingface-hub

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
- **Hugging Face:** https://huggingface.co/
- **VS Code Docs:** https://code.visualstudio.com/docs
- **Python Docs:** https://docs.python.org/

---

**Last Updated:** November 18, 2025  
**Version:** 0.1.0  
**Maintainer:** ModerateUser
