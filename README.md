BestFTP is a high-performance, next-generation FTP client designed with a focus on speed, reliability, and a premium user experience. Built using the modern **Tauri** stack, it combines the native performance of **Rust** with the flexibility of **React**.

![BestFTP Layout](https://img.shields.io/badge/UI-Fluent_Design-0078d4?style=for-the-badge&logo=windows)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri_|_React_|_Rust-ff69b4?style=for-the-badge)

## Key Features

- **Native Performance**: Leverages Rust's speed for file operations and network communication.
- **Dual-Pane Interface**: Traditional yet modernized side-by-side view for local and remote file systems.
- **Auto-Reconnect**: Smart connection management that handles drops and retries automatically.
- **Premium UI**: A stunning interface built with Tailwind CSS V4, featuring glassmorphism, smooth animations, and the custom "Paghalopi" theme.
- **Media Integration**: Built-in high-quality video and audio viewers for previewing remote content.
- **Code Editor**: Integrated Monaco Editor (the engine behind VS Code) for seamless file editing.
- **Rich Operations**: Supports recursive deletion, batch uploads/downloads, and advanced file manipulation.
- **Deep Windows Integration**: Automatically tracks recent folders via PowerShell integration.

---

## System Architecture

BestFTP follows a modern decoupled architecture using the Tauri framework:

### 1. Frontend (The Presentation Layer)
- **Framework**: React 19 (TypeScript)
- **Styling**: Tailwind CSS V4 & Custom CSS Modules
- **State Management**: React Hooks (State/Ref/Callback) & Zustand
- **Icons**: Lucide React
- **Key Components**:
    - `Dashboard`: The central hub managing the dual-pane layout.
    - `FileList`: High-performance file explorer component with sorting and context menu support.
    - `useFileSystem`: A custom hook orchestrating synchronization between local and remote states.

### 2. Backend (The Logic Layer)
- **Runtime**: Tauri V2 (Rust)
- **FTP Engine**: `suppaftp` (Async) providing robust protocol implementation.
- **Concurrency**: `tokio` for non-blocking I/O operations.
- **Process Management**: `spawn_blocking` for heavy filesystem tasks to keep the UI fluid.
- **Modules**:
    - `commands.rs`: The RPC bridge handling frontend requests.
    - `reconnect.rs`: Logic for maintaining persistent connections.
    - `models.rs`: Type-safe data structures synchronized with the TypeScript frontend.

### 3. Communication Bridge (RPC)
BestFTP uses Tauri's secure inter-process communication (IPC) to bridge the frontend and backend. 
- **Invoke Pattern**: React calls Rust commands using `@tauri-apps/api/core`.
- **CommandResult**: A unified response pattern ensuring consistent error handling across the app.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Core** | [Tauri](https://tauri.app/) |
| **Frontend** | [React](https://reactjs.org/) |
| **Backend Logic** | [Rust](https://www.rust-lang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **Icons** | [Lucide](https://lucide.dev/) |
| **Build Tool** | [Vite](https://vitejs.dev/) |

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

## License
This project is licensed under the MIT License - see the LICENSE file for details.
