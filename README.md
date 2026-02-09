# BestFTP
<div align="center">
  <img src="https://raw.githubusercontent.com/nihmadev/bestftp/main/public/icons/icon.png" alt="BestFTP Banner"
  height="128" width="128" />
</div>

**Tired for 2010s FTP clients? BestFTP is a modern, fast, and user-friendly FTP client with all features you need.**

BestFTP is a high-performance, next-generation FTP client designed with a focus on speed, reliability, and a premium user experience. Built using the **Tauri** stack, it combines the native performance of **Rust** with the flexibility of **React**.

![BestFTP Layout](https://img.shields.io/badge/UI-Fluent_Design-0078d4?style=for-the-badge&logo=windows)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri_|_React_|_Rust-ff69b4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-red?style=for-the-badge)
-------------
![Key Features](https://img.shields.io/badge/Features-12-blue?style=for-the-badge)

- **Native Performance**: Leverages Rust's speed for file operations and network communication.
- **Dual-Pane Interface**: Traditional yet modernized side-by-side view for local and remote file systems.
- **Auto-Reconnect**: Smart connection management that handles drops and retries automatically.
- **Premium UI**: A stunning interface built with Tailwind CSS V4, featuring glassmorphism, smooth animations, and the custom "Paghalopi" theme.
- **Media Integration**: Built-in high-quality video and audio viewers for previewing remote content.
- **Code Editor**: Integrated Monaco Editor (the engine behind VS Code) for seamless file editing.
- **Rich Operations**: Supports recursive deletion, batch uploads/downloads, and advanced file manipulation.
- **Deep Windows Integration**: Automatically tracks recent folders via PowerShell integration.

---

## ![System Architecture](https://img.shields.io/badge/Architecture-Decoupled-blue?style=for-the-badge)

### 1. Frontend (The Presentation Layer)
- **Framework**: React 19 (TypeScript)
- **Styling**: Tailwind CSS V4 & Custom CSS Modules
- **State Management**: React Hooks (State/Ref/Callback) & Zustand
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Key Pages**:
  - `Dashboard`: The main application interface with dual-pane layout
  - `Login`: Authentication and connection setup interface

- **Core Components**:
  - `TitleBar`: Custom window frame with system controls
  - `FileList`: High-performance file explorer with sorting, filtering, and context menus
  - `Pane`: Container component for local/remote file system views
  - `Breadcrumbs`: Navigation path display and interaction
  - `ContextMenu`: Right-click context menus for file operations
  - `Dialogs`: Modal dialogs for various operations (rename, delete, etc.)
  - `EditorDialog`: Integrated Monaco Editor for file editing
  - `VideoViewer`: Built-in media player for video content
  - `Sidebar`: Quick access and navigation panel
  - `StatusBar`: Connection status and transfer progress
  - `ToastList`: Notification system
  - `DragGhost`: Visual feedback during drag-and-drop operations
  - `DropOverlay`: Drop zone indicators

- **Custom Hooks**:
  - `useFileSystem`: Core hook orchestrating local/remote state synchronization
  - `useFileOperations`: File manipulation operations (copy, move, delete)
  - `useDashboardDragDrop`: Drag-and-drop functionality
  - `useDashboardContextMenu`: Context menu management
  - `useDashboardColumnResize`: Resizable column layout
  - `useKeybindings`: Keyboard shortcuts and hotkeys
  - `useToasts`: Toast notification management
  - `useTransferQueue`: Background transfer queue management

- **Utilities & Libraries**:
  - `tauri-api.ts`: Tauri command wrappers and type definitions
  - `api.ts`: HTTP API utilities
  - `fileIcons.tsx`: File type icon mapping
  - `themes/`: Custom theme system including Monaco editor themes
  - `symbol-icon-theme.json`: VS Code symbol icon theme

### 2. Backend (The Logic Layer)
- **Runtime**: Tauri V2 (Rust)
- **FTP Engine**: `suppaftp` (Async) providing robust protocol implementation
- **Concurrency**: `tokio` for non-blocking I/O operations
- **Process Management**: `spawn_blocking` for heavy filesystem tasks
- **Core Modules**:
  - `main.rs`: Application entry point and window setup
  - `lib.rs`: Core library initialization
  - `models.rs`: Type-safe data structures synchronized with TypeScript
  - `reconnect.rs`: Connection persistence and auto-reconnect logic
  - `utils.rs`: Shared utility functions

- **Command System** (RPC Bridge):
  - `commands/mod.rs`: Command registry and routing
  - `commands/connection.rs`: FTP connection management
  - `commands/system.rs`: System information and PowerShell integration
  - `commands/common.rs`: Shared command utilities

- **File System Operations**:
  - `commands/fs/mod.rs`: File system command coordinator
  - `commands/fs/listing.rs`: Directory listing and metadata
  - `commands/fs/manipulation.rs`: File operations (create, delete, rename)
  - `commands/fs/config.rs`: Configuration management

- **Transfer Engine**:
  - `commands/transfer/mod.rs`: Transfer operation coordinator
  - `commands/transfer/upload.rs`: File upload with progress tracking
  - `commands/transfer/download.rs`: File download with resume support
  - `commands/transfer/move_op.rs`: Remote file move operations
  - `commands/transfer/progress.rs`: Real-time progress reporting
  - `commands/transfer/io.rs`: Low-level I/O operations

### 3. Communication Bridge (IPC)
BestFTP uses Tauri's secure inter-process communication (IPC) to bridge the frontend and backend:
- **Invoke Pattern**: React calls Rust commands using `@tauri-apps/api/core`
- **CommandResult**: Unified response pattern with consistent error handling
- **Async Operations**: Non-blocking commands with progress callbacks
- **Type Safety**: Shared TypeScript definitions generated from Rust models

### 4. Security & Capabilities
- **CSP Policy**: Content Security Policy for secure resource loading
- **Asset Protocol**: Controlled access to local and remote assets
- **Capabilities**: Fine-grained permission system via `default.json`
- **Sandboxing**: Isolated runtime environment for safe operations

---

## ![Architecture](https://img.shields.io/badge/Architecture-Tree-blue?style=for-the-badge)

```
BestFTP/
├── Frontend (React + TypeScript)
│   ├── Pages/
│   │   ├── Dashboard.tsx          # Main application interface
│   │   └── Login.tsx              # Authentication screen
│   ├── Components/
│   │   ├── TitleBar.tsx          # Custom window frame
│   │   └── Dashboard/
│   │       ├── FileList.tsx      # File explorer component
│   │       ├── Pane.tsx          # Local/remote container
│   │       ├── Breadcrumbs.tsx   # Navigation path
│   │       ├── ContextMenu.tsx    # Right-click menus
│   │       ├── Dialogs.tsx        # Modal dialogs
│   │       ├── EditorDialog.tsx   # Monaco editor integration
│   │       ├── VideoViewer.tsx    # Media player
│   │       ├── Sidebar.tsx        # Quick navigation
│   │       ├── StatusBar.tsx      # Status & progress
│   │       ├── ToastList.tsx      # Notifications
│   │       ├── DragGhost.tsx      # Drag visual feedback
│   │       └── DropOverlay.tsx    # Drop zone indicators
│   ├── Hooks/
│   │   ├── useFileSystem.ts      # Core state management
│   │   ├── useFileOperations.ts   # File operations
│   │   ├── useDashboardDragDrop.ts # Drag & drop
│   │   ├── useDashboardContextMenu.ts # Context menus
│   │   ├── useDashboardColumnResize.ts # Resizable columns
│   │   ├── useKeybindings.ts      # Keyboard shortcuts
│   │   ├── useToasts.ts          # Toast notifications
│   │   └── useTransferQueue.ts    # Transfer management
│   ├── Utils/
│   │   ├── api.ts                 # HTTP utilities
│   │   ├── fileIcons.tsx          # File type icons
│   │   └── symbol-icon-theme.json # VS Code icons
│   ├── Themes/
│   │   ├── index.ts               # Theme system
│   │   └── monaco-themes.ts       # Editor themes
│   └── Lib/
│       └── tauri-api.ts          # Tauri command wrappers
│
├── Backend (Rust + Tauri)
│   ├── main.rs                    # Application entry point
│   ├── lib.rs                     # Core initialization
│   ├── models.rs                  # Shared data structures
│   ├── reconnect.rs               # Connection management
│   ├── utils.rs                   # Utility functions
│   └── Commands/
│       ├── mod.rs                 # Command registry
│       ├── connection.rs          # FTP connections
│       ├── system.rs              # System integration
│       ├── common.rs              # Shared utilities
│       ├── fs/
│       │   ├── mod.rs             # File system coordinator
│       │   ├── listing.rs         # Directory listings
│       │   ├── manipulation.rs    # File operations
│       │   └── config.rs          # Configuration
│       └── transfer/
│           ├── mod.rs             # Transfer coordinator
│           ├── upload.rs          # File uploads
│           ├── download.rs        # File downloads
│           ├── move_op.rs         # Remote moves
│           ├── progress.rs        # Progress tracking
│           └── io.ts              # Low-level I/O
│
└── Configuration & Build
    ├── src-tauri/
    │   ├── tauri.conf.json        # Tauri configuration
    │   ├── Cargo.toml             # Rust dependencies
    │   └── capabilities/
    │       └── default.json        # Security permissions
    ├── package.json               # Node.js dependencies
    ├── vite.config.ts             # Vite build config
    └── tsconfig.json              # TypeScript config
```

---

## Tech Stack


| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Framework** | [Tauri](https://tauri.app/) | Cross-platform desktop app framework |
| **Frontend** | [React](https://reactjs.org/) 19 | UI framework with TypeScript |
| **Backend Logic** | [Rust](https://www.rust-lang.org/) | High-performance systems programming |
| **FTP Engine** | [suppaftp](https://github.com/boltless-productions/suppaftp) | Async FTP client implementation |
| **Async Runtime** | [Tokio](https://tokio.rs/) | Asynchronous I/O and concurrency |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) V4 | Utility-first CSS framework |
| **Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | VS Code editor engine |
| **Icons** | [Lucide](https://lucide.dev/) | Modern icon library |
| **Build Tool** | [Vite](https://vitejs.dev/) | Fast development build tool |
| **Package Manager** | [Bun](https://bun.sh/) | Fast package manager and runtime |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) | Lightweight state management |
| **Type Safety** | TypeScript | Static type checking across frontend/backend |

---

## Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (Optional, used for locking)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/BestFTP.git
   ```
2. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. Install NodeJS:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
   **or** (Arch Linux)

   ```bash
   sudo pacman -Syu
   sudo pacman -S nodejs
   ```
   **or** (Fedora)
   ```bash
   sudo dnf install nodejs
   ```
   **or** (Windows)
   ```bash
   winget install -e --id OpenJS.Nodejs
   ```
4. Install dependencies:
   ```bash
   bun install
   ```
5. Run in development mode:
   ```bash
   bun run tauri dev
   ```
   **or** (Any platform)

   ```bash
   cd src-tauri
   cargo tauri dev
   ```

---
<div align="center">
<img src="https://raw.githubusercontent.com/nihmadev/bestftp/main/public/icons/icon.png" alt="BestFTP Banner"
height="128" width="128" />

<div align="center">


**[Back to top](#bestftp)**

## License
This project is licensed under the MIT License - see the LICENSE file for details.
