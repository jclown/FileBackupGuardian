# FileBackupGuardian

文件自动备份与对比工具，基于 Electron + Vue 3 构建。

## 功能特性

- **实时文件监听** - 监听指定目录的文件变更（新增、修改、删除）
- **自动双版本备份** - 文件修改时自动创建"变更前"和"变更后"两个版本备份
- **版本对比** - 对比文件修改前后的差异，支持文本文件的行级对比
- **备份恢复** - 支持恢复到任意历史版本
- **灵活的忽略规则** - 支持按扩展名、文件名、文件夹、正则表达式设置忽略规则
- **完整日志记录** - 记录所有操作，支持导出
- **跨平台支持** - 支持 Windows、macOS、Linux

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 29 |
| 前端框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 构建工具 | Vite 5 |
| 文件监听 | @parcel/watcher |
| 差异对比 | diff-match-patch |
| 打包工具 | electron-builder |

## 安装

### 从发布版本安装

下载对应平台的安装包：

- **Windows**: `.exe` 
- **macOS**: `.dmg` 或 `.zip`（暂无）
- **Linux**: `.AppImage` 或 `.deb`（暂无）

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/jclown/FileBackupGuardian.git
cd FileBackupGuardian

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行构建后的应用
npm run start

# 打包分发版本
npm run dist          # 当前平台
npm run dist:win      # Windows
npm run dist:mac      # macOS
npm run dist:linux    # Linux
```

## 使用指南

### 1. 添加监听目录

在"监听管理"页面，点击"添加目录"按钮，选择需要监听的文件夹。可以配置：

- **递归监听** - 是否监听子目录
- **忽略规则** - 设置不需要备份的文件类型

### 2. 查看备份历史

在"文件跟踪"页面，可以：

- 查看所有文件的备份历史
- 按时间分组显示备份记录
- 搜索特定文件的备份
- 执行单个或批量恢复

### 3. 对比文件差异

点击备份记录的"对比"按钮，进入对比页面：

- 查看修改前后的代码差异
- 高亮显示新增、删除、未变更的行
- 支持仅显示差异行
- 快速跳转到差异位置

## 项目结构

```
FileBackupGuardian/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── main.ts              # 主进程入口
│   │   ├── preload.ts           # 预加载脚本（IPC 桥接）
│   │   ├── ipc-handlers.ts      # IPC 处理器
│   │   ├── types.ts             # 类型定义
│   │   └── modules/             # 核心功能模块
│   │   │   ├── watcher-manager.ts   # 文件监听管理
│   │   │   ├── backup-manager.ts    # 备份管理
│   │   │   ├── compare-manager.ts   # 文件对比管理
│   │   │   └── config-manager.ts    # 配置管理
│   │   └── utils/               # 工具类
│   │       ├── worker-manager.ts    # Worker 线程管理
│   │       ├── file-worker.ts       # 文件操作 Worker
│   └── renderer/                # Vue 渲染进程
│       └── src/
│           ├── views/           # 页面组件
│           │   ├── WatcherView.vue   # 监听管理
│           │   ├── TrackView.vue     # 文件跟踪
│           │   ├── CompareView.vue   # 文件对比
│           │   └── SettingsView.vue  # 设置页面
│           ├── stores/          # Pinia 状态管理
│           └── router.ts        # 路由配置
├── electron-builder.yml         # 打包配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
└── package.json                 # 项目配置
```

## 配置说明

### 默认配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 备份延迟 | 10秒 | 文件变更后延迟备份时间 |
| 保留天数 | 30天 | 自动清理超过此天数的备份 |
| 最大备份数 | 100个/文件 | 每个文件保留的最大备份数 |
| 备份路径 | `~/FileGuardian/Backup` | 备份文件存储目录 |

### 默认忽略规则

以下文件/目录默认不进行备份：

- 扩展名: `.tmp`, `.temp`, `.swp`
- 文件: `.DS_Store`, `Thumbs.db`
- 目录: `node_modules`, `.git`, `dist`

可在设置页面自定义忽略规则。

## 特色功能

### 双版本备份机制

文件修改时，系统会：

1. **变更前备份** - 在文件写入前，缓存原始内容并备份
2. **变更后备份** - 文件写入完成后，备份新版本

形成完整的修改历史，可对比任意修改前后差异。

### Worker 线程优化

- 大文件差异计算（>5MB）在 Worker 线程执行
- 文件计数操作异步处理
- 避免阻塞主进程，保持界面流畅

### 恢复防循环

恢复文件后，系统自动跳过该文件的备份触发，防止产生冗余备份。

## 开发

### 环境要求

- Node.js 18+
- npm 9+

### 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 运行构建后的应用
npm run dist     # 打包分发版本
```

### IPC 通信架构

渲染进程通过 `window.electronAPI` 调用主进程功能：

```typescript
// 获取备份列表
const result = await window.electronAPI.backup.getList();

// 对比备份
const result = await window.electronAPI.compare.pairedBackups(backupId);

// 恢复备份
const result = await window.electronAPI.backup.restore(backupId);
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
