import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';

interface WatchPath {
  id: string;
  path: string;
  enabled: boolean;
  recursive: boolean;
  ignoreRules: IgnoreRule[];
  createdAt: number;
}

interface IgnoreRule {
  id: string;
  type: 'extension' | 'pattern' | 'name' | 'folder';
  value: string;
  enabled: boolean;
}

interface WatcherStatus {
  pathId: string;
  isRunning: boolean;
  fileCount: number;
  lastActivity: number | null;
  error: string | null;
}

interface BackupRecord {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: number;
  type: 'full';
  changeType?: 'add' | 'change' | 'unlink';
  fileSize: number;
}

interface BackupConfig {
  backupPath: string;
  backupDelay: number;
  backupStrategy: 'full';
  retentionDays: number;
  maxBackups: number;
}

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  module: 'watcher' | 'backup' | 'compare' | 'config';
  message: string;
  details?: Record<string, unknown>;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface AppConfig {
  watchPaths: WatchPath[];
  backup: BackupConfig;
  defaultIgnoreRules: IgnoreRule[];
}

export const useAppStore = defineStore('app', () => {
  const config = ref<AppConfig | null>(null);
  const watchPaths = ref<WatchPath[]>([]);
  const watcherStatuses = shallowRef<Map<string, WatcherStatus>>(new Map());
  const backups = ref<BackupRecord[]>([]);
  const MAX_LOGS = 500;
  const logs = ref<LogEntry[]>([]);
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);

  const isWatcherActive = computed(() =>
    Array.from(watcherStatuses.value.values()).some((s) => s.isRunning),
  );

  const activeWatchCount = computed(() =>
    Array.from(watcherStatuses.value.values()).filter((s) => s.isRunning).length,
  );

  async function init() {
    if (typeof window === 'undefined' || !window.electronAPI) {
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const configResult = await window.electronAPI.config.get();
      if (configResult.success && configResult.data) {
        config.value = configResult.data as AppConfig;
        watchPaths.value = (configResult.data as AppConfig).watchPaths || [];
      }

      const statusResult = await window.electronAPI.watcher.getStatus();
      const statusMap = new Map<string, WatcherStatus>();
      if (Array.isArray(statusResult)) {
        for (const status of statusResult as WatcherStatus[]) {
          statusMap.set(status.pathId, status);
        }
      }

      for (const watchPath of watchPaths.value) {
        if (!statusMap.has(watchPath.id)) {
          statusMap.set(watchPath.id, {
            pathId: watchPath.id,
            isRunning: watchPath.enabled,
            fileCount: 0,
            lastActivity: null,
            error: null,
          });
        }
      }
      watcherStatuses.value = statusMap;

      const backupResult = await window.electronAPI.backup.getList();
      if (backupResult.success && backupResult.data) {
        backups.value = backupResult.data as BackupRecord[];
      }

      const logResult = await window.electronAPI.log.getList(MAX_LOGS);
      if (logResult.success && logResult.data) {
        logs.value = (logResult.data as LogEntry[]).slice(-MAX_LOGS);
      }

      window.electronAPI.watcher.onStatusUpdate((status) => {
        const s = status as WatcherStatus;
        const newMap = new Map(watcherStatuses.value);
        newMap.set(s.pathId, s);
        watcherStatuses.value = newMap;
      });

      window.electronAPI.backup.onListUpdate((record) => {
        backups.value.unshift(record as BackupRecord);
      });

      window.electronAPI.log.onNewEntry((entry) => {
        logs.value.push(entry as LogEntry);
        if (logs.value.length > MAX_LOGS) {
          logs.value = logs.value.slice(-MAX_LOGS);
        }
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: '初始化失败: ' + (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      loading.value = false;
    }
  }

  async function addWatchPath(path: string, recursive = true) {
    try {
      const result = await window.electronAPI.watcher.addPath(path, recursive);
      if (result.success && result.data) {
        const newWatchPath = result.data as WatchPath;
        watchPaths.value.push(newWatchPath);

        const newMap = new Map(watcherStatuses.value);
        newMap.set(newWatchPath.id, {
          pathId: newWatchPath.id,
          isRunning: true,
          fileCount: 0,
          lastActivity: null,
          error: null,
        });
        watcherStatuses.value = newMap;

        addNotification({ type: 'success', message: '添加监听路径成功' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '添加失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '添加监听路径失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function removeWatchPath(id: string) {
    try {
      const result = await window.electronAPI.watcher.removePath(id);
      if (result.success) {
        watchPaths.value = watchPaths.value.filter((p) => p.id !== id);
        const newMap = new Map(watcherStatuses.value);
        newMap.delete(id);
        watcherStatuses.value = newMap;

        addNotification({ type: 'success', message: '删除监听路径成功' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '删除失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '删除监听路径失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function toggleWatchPath(id: string, enabled: boolean) {
    try {
      const result = await window.electronAPI.watcher.togglePath(id, enabled);
      if (result.success && result.data) {
        const index = watchPaths.value.findIndex((p) => p.id === id);
        if (index > -1) {
          watchPaths.value[index] = result.data as WatchPath;
          watchPaths.value = [...watchPaths.value];
        }

        const newMap = new Map(watcherStatuses.value);
        const currentStatus = newMap.get(id);
        if (currentStatus) {
          newMap.set(id, { ...currentStatus, isRunning: enabled });
        } else {
          newMap.set(id, {
            pathId: id,
            isRunning: enabled,
            fileCount: 0,
            lastActivity: null,
            error: null,
          });
        }
        watcherStatuses.value = newMap;

        addNotification({ type: 'success', message: enabled ? '已启用监听' : '已暂停监听' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '操作失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '切换监听状态失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function deleteBackup(id: string) {
    try {
      const result = await window.electronAPI.backup.delete(id);
      if (result.success) {
        backups.value = backups.value.filter((b) => b.id !== id);
        addNotification({ type: 'success', message: '删除备份成功' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '删除失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '删除备份失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function restoreBackup(id: string, targetPath?: string) {
    try {
      const result = await window.electronAPI.backup.restore(id, targetPath);
      if (result.success) {
        addNotification({ type: 'success', message: '恢复备份成功' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '恢复失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '恢复备份失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function updateConfig(newConfig: Partial<AppConfig>) {
    try {
      const result = await window.electronAPI.config.set(newConfig);
      if (result.success && result.data) {
        const updatedConfig = result.data as AppConfig;
        config.value = updatedConfig;

        if (newConfig.watchPaths) {
          watchPaths.value = updatedConfig.watchPaths || [];
        }

        addNotification({ type: 'success', message: '配置已保存' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '保存失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '保存配置失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  function addNotification(notification: Omit<Notification, 'id'>) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 11);
    notifications.value.push({ ...notification, id });

    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  async function exportLogs() {
    try {
      const result = await window.electronAPI.log.export();
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fileguardian-logs-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        addNotification({ type: 'success', message: '日志已导出' });
        return true;
      }

      addNotification({ type: 'error', message: result.error || '导出失败' });
      return false;
    } catch (error) {
      addNotification({
        type: 'error',
        message: '导出日志失败: ' + (error instanceof Error ? error.message : String(error)),
      });
      return false;
    }
  }

  async function getFileCount(folderPath: string, recursive: boolean, ignoreRules: IgnoreRule[]): Promise<number> {
    try {
      const result = await window.electronAPI.watcher.getFileCount(folderPath, recursive, ignoreRules);
      if (result.success && result.data !== undefined) {
        return result.data as number;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  return {
    config,
    watchPaths,
    watcherStatuses,
    backups,
    logs,
    notifications,
    loading,
    isWatcherActive,
    activeWatchCount,
    init,
    addWatchPath,
    removeWatchPath,
    toggleWatchPath,
    deleteBackup,
    restoreBackup,
    updateConfig,
    addNotification,
    removeNotification,
    exportLogs,
    getFileCount,
  };
});
