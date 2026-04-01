// 类型定义：用于主进程和渲染进程之间的通信

export interface WatchPath {
  id: string;
  path: string;
  enabled: boolean;
  recursive: boolean;
  ignoreRules: IgnoreRule[];
  createdAt: number;
}

export interface IgnoreRule {
  id: string;
  type: 'extension' | 'pattern' | 'name' | 'folder';
  value: string;
  enabled: boolean;
}

export interface BackupRecord {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: number;
  type: 'full';
  changeType: 'add' | 'change' | 'unlink';
  fileSize: number;
  checksum?: string;
  pairedBackupId?: string;
}

export interface BackupConfig {
  backupPath: string;
  backupDelay: number; // 秒（s）
  backupStrategy: 'full';
  retentionDays: number;
  maxBackups: number;
}

export interface FileDiff {
  type: 'add' | 'delete' | 'modify';
  lineNumber?: number;
  content: string;
  oldContent?: string;
}

export interface CompareResult {
  originalPath: string;
  backupPath: string;
  isTextFile: boolean;
  diffs: FileDiff[];
  originalSize: number;
  backupSize: number;
  originalModifiedTime: number;
  backupModifiedTime: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  module: 'watcher' | 'backup' | 'compare' | 'config';
  message: string;
  details?: Record<string, unknown>;
}

export interface AppConfig {
  watchPaths: WatchPath[];
  backup: BackupConfig;
  defaultIgnoreRules: IgnoreRule[];
}

export interface WatcherStatus {
  pathId: string;
  isRunning: boolean;
  fileCount: number;
  lastActivity: number | null;
  error: string | null;
}

// IPC 通道名称
export const IPC_CHANNELS = {
  // 监听相关
  WATCHER_ADD_PATH: 'watcher:add-path',
  WATCHER_REMOVE_PATH: 'watcher:remove-path',
  WATCHER_TOGGLE_PATH: 'watcher:toggle-path',
  WATCHER_GET_STATUS: 'watcher:get-status',
  WATCHER_STATUS_UPDATE: 'watcher:status-update',
  WATCHER_FILE_CHANGED: 'watcher:file-changed',
  WATCHER_GET_FILE_COUNT: 'watcher:get-file-count',
  
  // 备份相关
  BACKUP_GET_LIST: 'backup:get-list',
  BACKUP_DELETE: 'backup:delete',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_GET_HISTORY: 'backup:get-history',
  BACKUP_LIST_UPDATE: 'backup:list-update',
  BACKUP_GET_SKIPPING_FILES: 'backup:get-skipping-files',
  
  // 对比相关
  COMPARE_FILES: 'compare:files',
  COMPARE_RESULT: 'compare:result',
  COMPARE_PAIRED_BACKUPS: 'compare:paired-backups',
  BACKUP_GET_PAIRS: 'backup:get-pairs',
  BACKUP_GET_PAIRED: 'backup:get-paired',
  
  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_UPDATE: 'config:update',
  
  // 日志相关
  LOG_GET_LIST: 'log:get-list',
  LOG_EXPORT: 'log:export',
  LOG_NEW_ENTRY: 'log:new-entry',
  
  // 对话框
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  
  // Shell 操作
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_SHOW_ITEM_IN_FOLDER: 'shell:show-item-in-folder',
  
  // 文件操作
  FILE_READ: 'file:read',
  FILE_COPY: 'file:copy',
} as const;



