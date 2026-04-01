/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    watcher: {
      addPath: (path: string, recursive?: boolean) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      removePath: (id: string) => Promise<{ success: boolean; error?: string }>;
      togglePath: (id: string, enabled: boolean) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      getStatus: () => Promise<unknown[]>;
      getFileCount: (folderPath: string, recursive: boolean, ignoreRules: unknown[]) => Promise<{ success: boolean; data?: number; error?: string }>;
      onStatusUpdate: (callback: (status: unknown) => void) => () => void;
      onFileChanged: (callback: (info: unknown) => void) => () => void;
    };
    backup: {
      getList: (originalPath?: string) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
      delete: (backupId: string) => Promise<{ success: boolean; error?: string }>;
      restore: (backupId: string, targetPath?: string) => Promise<{ success: boolean; error?: string }>;
      getHistory: (options?: { startDate?: number; endDate?: number; pathFilter?: string }) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
      getPairs: (originalPath?: string) => Promise<{ success: boolean; data?: unknown[][]; error?: string }>;
      getPaired: (backupId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      onListUpdate: (callback: (record: unknown) => void) => () => void;
    };
    compare: {
      files: (originalPath: string, backupPath: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      pairedBackups: (preBackupId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    };
    config: {
      get: () => Promise<{ success: boolean; data?: unknown }>;
      set: (config: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    };
    log: {
      getList: (limit?: number) => Promise<{ success: boolean; data?: unknown[] }>;
      export: () => Promise<{ success: boolean; data?: string; error?: string }>;
      onNewEntry: (callback: (entry: unknown) => void) => () => void;
    };
    dialog: {
      openDirectory: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
      openFile: (options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }) => Promise<{ success: boolean; paths?: string[]; canceled?: boolean }>;
    };
    shell: {
      openPath: (path: string) => Promise<string>;
      showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
    };
    readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    copyFile: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
  };
}

