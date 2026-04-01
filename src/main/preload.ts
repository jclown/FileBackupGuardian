import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  WATCHER_ADD_PATH: 'watcher:add-path',
  WATCHER_REMOVE_PATH: 'watcher:remove-path',
  WATCHER_TOGGLE_PATH: 'watcher:toggle-path',
  WATCHER_GET_STATUS: 'watcher:get-status',
  WATCHER_STATUS_UPDATE: 'watcher:status-update',
  WATCHER_FILE_CHANGED: 'watcher:file-changed',
  WATCHER_GET_FILE_COUNT: 'watcher:get-file-count',

  BACKUP_GET_LIST: 'backup:get-list',
  BACKUP_DELETE: 'backup:delete',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_GET_HISTORY: 'backup:get-history',
  BACKUP_LIST_UPDATE: 'backup:list-update',
  BACKUP_GET_SKIPPING_FILES: 'backup:get-skipping-files',

  COMPARE_FILES: 'compare:files',
  COMPARE_RESULT: 'compare:result',
  COMPARE_PAIRED_BACKUPS: 'compare:paired-backups',
  BACKUP_GET_PAIRS: 'backup:get-pairs',
  BACKUP_GET_PAIRED: 'backup:get-paired',

  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_UPDATE: 'config:update',

  LOG_GET_LIST: 'log:get-list',
  LOG_EXPORT: 'log:export',
  LOG_NEW_ENTRY: 'log:new-entry',

  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_OPEN_FILE: 'dialog:open-file',

  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_SHOW_ITEM_IN_FOLDER: 'shell:show-item-in-folder',

  FILE_READ: 'file:read',
  FILE_COPY: 'file:copy',
} as const;

const electronAPI = {
  watcher: {
    addPath: (path: string, recursive?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.WATCHER_ADD_PATH, path, recursive),
    removePath: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WATCHER_REMOVE_PATH, id),
    togglePath: (id: string, enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.WATCHER_TOGGLE_PATH, id, enabled),
    getStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.WATCHER_GET_STATUS),
    getFileCount: (folderPath: string, recursive: boolean, ignoreRules: unknown[]) => {
      const safeIgnoreRules = Array.isArray(ignoreRules)
        ? ignoreRules.map((rule) => ({ ...(rule as Record<string, unknown>) }))
        : [];
      return ipcRenderer.invoke(
        IPC_CHANNELS.WATCHER_GET_FILE_COUNT,
        folderPath,
        recursive,
        safeIgnoreRules,
      );
    },
    onStatusUpdate: (callback: (status: unknown) => void) => {
      const handler = (_: unknown, status: unknown) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.WATCHER_STATUS_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WATCHER_STATUS_UPDATE, handler);
    },
    onFileChanged: (callback: (info: unknown) => void) => {
      const handler = (_: unknown, info: unknown) => callback(info);
      ipcRenderer.on(IPC_CHANNELS.WATCHER_FILE_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WATCHER_FILE_CHANGED, handler);
    },
  },

  backup: {
    getList: (originalPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_LIST, originalPath),
    delete: (backupId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_DELETE, backupId),
    restore: (backupId: string, targetPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, backupId, targetPath),
    getHistory: (options?: { startDate?: number; endDate?: number; pathFilter?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_HISTORY, options),
    getSkippingFiles: () =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_SKIPPING_FILES),
    getPairs: (originalPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_PAIRS, originalPath),
    getPaired: (backupId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_PAIRED, backupId),
    onListUpdate: (callback: (record: unknown) => void) => {
      const handler = (_: unknown, record: unknown) => callback(record);
      ipcRenderer.on(IPC_CHANNELS.BACKUP_LIST_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BACKUP_LIST_UPDATE, handler);
    },
  },

  compare: {
    files: (originalPath: string, backupPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARE_FILES, originalPath, backupPath),
    pairedBackups: (preBackupId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPARE_PAIRED_BACKUPS, preBackupId),
  },

  config: {
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
    set: (config: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config),
  },

  log: {
    getList: (limit?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.LOG_GET_LIST, limit),
    export: () =>
      ipcRenderer.invoke(IPC_CHANNELS.LOG_EXPORT),
    onNewEntry: (callback: (entry: unknown) => void) => {
      const handler = (_: unknown, entry: unknown) => callback(entry);
      ipcRenderer.on(IPC_CHANNELS.LOG_NEW_ENTRY, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_NEW_ENTRY, handler);
    },
  },

  dialog: {
    openDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),
    openFile: (options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
  },

  shell: {
    openPath: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, path),
    showItemInFolder: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, path),
  },

  readFile: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, path),
  copyFile: (sourcePath: string, targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_COPY, sourcePath, targetPath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
