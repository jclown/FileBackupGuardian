<template>
  <div class="track-view">
    <!-- 页面标题区 -->
    <div class="page-header-modern">
      <div class="header-main">
        <button class="back-btn-modern" @click="goBack" title="返回">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="header-info">
          <h1 class="page-title">文件夹跟踪</h1>
          <p class="folder-path" v-if="selectedFolder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            {{ selectedFolder.path }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-sm btn-primary-modern" @click="refreshBackups" :disabled="loadingBackups">
          <svg v-if="!loadingBackups" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" >
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          <span v-else class="loading-spinner"></span>
          {{ loadingBackups ? '加载中...' : '刷新' }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!selectedFolderId" class="empty-state-container">
      <div class="empty-icon-wrapper">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <p class="empty-title">未选择文件夹</p>
      <p class="empty-desc">请从监听管理页面点击文件夹卡片进入</p>
      <button class="btn btn-primary" @click="goBack">返回监听管理</button>
    </div>

    <template v-else>
      <!-- 工具栏 -->
      <div class="toolbar-modern">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            v-model="searchKeyword" 
            placeholder="搜索文件名..."
          />
          <button v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="group-filter">
          <label class="filter-label">分组间隔:</label>
          <select class="form-select-modern" v-model.number="groupInterval">
            <option :value="1">每秒</option>
            <option :value="60">每分钟</option>
            <option :value="300">每5分钟</option>
            <option :value="600">每10分钟</option>
            <option :value="3600">每小时</option>
            <option :value="0">自定义</option>
          </select>
          <template v-if="groupInterval === 0">
            <input
              type="number"
              class="form-input-modern custom-interval"
              v-model.number="customInterval"
              min="1"
              placeholder="数值"
            />
            <select class="form-select-modern custom-interval-unit" v-model="customIntervalUnit">
              <option value="second">秒</option>
              <option value="minute">分</option>
              <option value="hour">时</option>
            </select>
          </template>
        </div>
      </div>

      <!-- 统计卡片区-->
      <div class="stats-grid-modern">
        <div class="stat-card-modern">
          <div class="stat-icon-modern primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalFiles }}</div>
            <div class="stat-label">文件总数</div>
          </div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon-modern success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalBackups }}</div>
            <div class="stat-label">备份版本</div>
          </div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon-modern info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.groupCount }}</div>
            <div class="stat-label">时间分组</div>
          </div>
        </div>
      </div>

      <div class="card-modern">
        <div class="card-header-modern">
          <span class="card-title-modern">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            备份历史
          </span>
          <span class="card-count-modern">{{ groupedBackups.length }} 组 · {{ filteredBackups.length }} 条记录</span>
        </div>
        <div class="card-body-modern">
          <div v-if="filteredBackups.length === 0" class="empty-timeline-modern">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{{ searchKeyword ? '未找到匹配的文件' : '暂无备份记录' }}</p>
          </div>
          <div v-else class="timeline-modern">
            <div 
              v-for="group in groupedBackups" 
              :key="group.id"
              class="timeline-group-modern"
            >
              <div class="timeline-header-modern" @click="toggleGroup(group.id)">
                <div class="header-left">
                  <svg class="expand-icon-modern" :class="{ expanded: expandedGroups.has(group.id) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <div class="group-time">
                    <span class="group-date">{{ formatDate(group.startTime) }}</span>
                    <span class="group-clock">{{ formatTime(group.startTime) }} - {{ formatTime(group.endTime) }}</span>
                  </div>
                  <span class="group-count-badge">{{ group.backups.length }} 版本 / {{ group.fileCount }} 文件</span>
                </div>
                <div class="header-actions">
                  <button class="btn btn-sm btn-primary-modern" @click.stop="restoreGroup(group)" title="恢复此版本">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                    </svg>
                    恢复
                  </button>
                </div>
              </div>
              <div v-show="expandedGroups.has(group.id)" class="timeline-items-modern">
                <div 
                  v-for="backup in group.backups" 
                  :key="backup.id"
                  class="backup-item-modern"
                >
                  <div class="item-icon-modern">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div class="item-info">
                    <div class="item-name">{{ getFileName(backup.originalPath) }}</div>
                    <div class="item-path">{{ backup.originalPath }}</div>
                    <div class="item-meta">
                      <span class="item-time">{{ formatTime(backup.timestamp) }}</span>
                      <span class="item-size">{{ formatSize(backup.fileSize) }}</span>
                      <span :class="['item-type', getBackupChangeClass(backup)]">
                        {{ getBackupChangeLabel(backup) }}
                      </span>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button v-if="backup.pairedBackupId" class="btn-icon-modern" @click.stop="compareBackup(backup)" title="对比">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                    </button>
                    <button v-if="backup.changeType != 'add'" class="btn-icon-modern" @click.stop="restoreBackup(backup)" title="恢复">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                      </svg>
                    </button>
                    <button class="btn-icon-modern danger" @click.stop="confirmDelete(backup)" title="删除">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 恢复确认弹窗 -->
    <ConfirmDialog
      v-model:visible="restoreDialog.visible"
      :title="restoreDialog.title"
      :message="restoreDialog.message"
      :details="restoreDialogDetails"
      :confirm-text="restoreDialog.confirmText"
      :loading="restoreDialog.loading"
      @confirm="confirmRestoreDialog"
      @cancel="closeRestoreDialog"
    />

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      v-model:visible="deleteDialog.visible"
      title="确认删除备份"
      message="此操作不可恢复，确定要删除此备份吗？"
      :details="deleteDialogDetails"
      confirm-text="确认删除"
      loading-text="删除中..."
      :loading="deleteDialog.loading"
      danger
      @confirm="confirmDeleteBackup"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onActivated } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '../stores/app';
import ConfirmDialog from '../components/ConfirmDialog.vue';

interface BackupRecord {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: number;
  type: 'full';
  changeType?: 'add' | 'change' | 'unlink';
  fileSize: number;
  pairedBackupId?: string;
}

interface BackupGroup {
  id: string;
  timestamp: number;
  startTime: number;
  endTime: number;
  fileCount: number;
  backups: BackupRecord[];
}

const pageStateCache = new Map<string, {
  searchKeyword: string;
  groupInterval: number;
  customInterval: number;
  customIntervalUnit: 'second' | 'minute' | 'hour';
  expandedGroups: Set<string>;
}>();

const store = useAppStore();
const router = useRouter();
const route = useRoute();

const watchPaths = computed(() => store.watchPaths);
const selectedFolderId = ref('');
const searchKeyword = ref('');
const groupInterval = ref(60);
const customInterval = ref(60);
const customIntervalUnit = ref<'second' | 'minute' | 'hour'>('minute');
const expandedGroups = ref<Set<string>>(new Set());
const selectedBackup = ref<BackupRecord | null>(null);
const allBackups = ref<BackupRecord[]>([]);
const loadingBackups = ref(false);
const actualFileCount = ref(0);
const loadingFileCount = ref(false);

type RestoreDialogMode = 'single' | 'group';

const restoreDialog = ref<{
  visible: boolean;
  loading: boolean;
  mode: RestoreDialogMode;
  title: string;
  message: string;
  confirmText: string;
  backup: BackupRecord | null;
  group: BackupGroup | null;
}>({
  visible: false,
  loading: false,
  mode: 'single',
  title: '',
  message: '',
  confirmText: '',
  backup: null,
  group: null,
});

// 删除确认弹窗状态
const deleteDialog = ref<{
  visible: boolean;
  loading: boolean;
  backupId: string;
  fileName: string;
  backupTime: string;
  fileSize: string;
}>({
  visible: false,
  loading: false,
  backupId: '',
  fileName: '',
  backupTime: '',
  fileSize: '',
});

// 恢复弹窗详情计算属性
const restoreDialogDetails = computed(() => {
  if (restoreDialog.value.mode === 'single' && restoreDialog.value.backup) {
    return [
      { label: '文件', value: getFileName(restoreDialog.value.backup.originalPath) },
      { label: '时间', value: `${formatDate(restoreDialog.value.backup.timestamp)} ${formatTime(restoreDialog.value.backup.timestamp)}` },
    ];
  }
  if (restoreDialog.value.mode === 'group' && restoreDialog.value.group) {
    return [
      { label: '文件数', value: String(restoreDialog.value.group.fileCount) },
      { label: '版本数', value: String(restoreDialog.value.group.backups.length) },
    ];
  }
  return [];
});

// 删除弹窗详情计算属性
const deleteDialogDetails = computed(() => [
  { label: '文件', value: deleteDialog.value.fileName },
  { label: '时间', value: deleteDialog.value.backupTime },
  { label: '大小', value: deleteDialog.value.fileSize },
]);

// 实际使用的分组间隔（秒）
const actualInterval = computed(() => {
  if (groupInterval.value !== 0) {
    return Math.max(1, Math.floor(groupInterval.value));
  }

  const raw = Math.max(1, Math.floor(customInterval.value || 1));
  if (customIntervalUnit.value === 'hour') {
    return raw * 3600;
  }
  if (customIntervalUnit.value === 'minute') {
    return raw * 60;
  }
  return raw;
});

// 当前的文件夹信息
const selectedFolder = computed(() => {
  return watchPaths.value.find(p => p.id === selectedFolderId.value);
});

// 统计数据
const stats = computed(() => {
  return {
    totalFiles: actualFileCount.value > 0 ? actualFileCount.value : new Set(filteredBackups.value.map(b => b.originalPath)).size,
    totalBackups: filteredBackups.value.length,
    groupCount: groupedBackups.value.length,
  };
});

// 过滤后的备份列表
const filteredBackups = computed(() => {
  let backups = [...allBackups.value];

  // 过滤掉备份后的记录（只显示备份前的记录）
  backups = backups.filter(b => !b.backupPath.includes('_post_'));

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    backups = backups.filter(b => 
      b.originalPath.toLowerCase().includes(keyword) ||
      getFileName(b.originalPath).toLowerCase().includes(keyword)
    );
  }

  // 按时间排序
  return backups.sort((a, b) => b.timestamp - a.timestamp);
});

// 分组后的备份
const groupedBackups = computed((): BackupGroup[] => {
  if (filteredBackups.value.length === 0) return [];

  const groups: Map<number, BackupRecord[]> = new Map();
  const interval = actualInterval.value * 1000; // 转换为毫秒

  for (const backup of filteredBackups.value) {
    // 按间隔向下取整分组
    const groupTimestamp = Math.floor(backup.timestamp / interval) * interval;
    
    if (!groups.has(groupTimestamp)) {
      groups.set(groupTimestamp, []);
    }
    groups.get(groupTimestamp)!.push(backup);
  }

  // 转换为数组并排序
  const result: BackupGroup[] = [];
  for (const [timestamp, backups] of groups) {
    // 每组内的备份按时间排序
    backups.sort((a, b) => b.timestamp - a.timestamp);
    const endTime = timestamp + interval - 1;
    const fileCount = new Set(backups.map(b => b.originalPath)).size;
    result.push({
      id: `${timestamp}-${endTime}`,
      timestamp,
      startTime: timestamp,
      endTime,
      fileCount,
      backups,
    });
  }

  // 按组时间排序
  return result.sort((a, b) => b.timestamp - a.timestamp);
});

// 保存页面状态
function savePageState() {
  if (selectedFolderId.value) {
    pageStateCache.set(selectedFolderId.value, {
      searchKeyword: searchKeyword.value,
      groupInterval: groupInterval.value,
      customInterval: customInterval.value,
      customIntervalUnit: customIntervalUnit.value,
      expandedGroups: new Set(expandedGroups.value),
    });
  }
}

// 恢复页面状态
function restorePageState() {
  if (selectedFolderId.value && pageStateCache.has(selectedFolderId.value)) {
    const state = pageStateCache.get(selectedFolderId.value)!;
    searchKeyword.value = state.searchKeyword;
    groupInterval.value = state.groupInterval;
    customInterval.value = state.customInterval;
    customIntervalUnit.value = state.customIntervalUnit || 'minute';
    expandedGroups.value = new Set(state.expandedGroups);
  }
}

// 加载备份数据
async function loadBackups() {
  if (!selectedFolder.value) return;
  
  loadingBackups.value = true;
  try {
    // 获取该文件夹相关的所有备份
    const result = await window.electronAPI.backup.getList();
    if (result.success && result.data) {
      const folderPath = selectedFolder.value.path;
      allBackups.value = (result.data as BackupRecord[]).filter(b => 
        b.originalPath.startsWith(folderPath)
      );
    }
  } finally {
    loadingBackups.value = false;
  }
}


async function loadActualFileCount() {
  const folder = selectedFolder.value;
  if (!folder) return;

  (async () => {
    loadingFileCount.value = true;
    try {
      const folderPath = folder.path;
      const recursive = folder.recursive || false;
  
      const ignoreRules = (folder.ignoreRules || [])
        .filter(rule => rule.enabled)
        .map(rule => ({
          id: rule.id,
          type: rule.type,
          value: rule.value,
          enabled: rule.enabled,
        }));
      

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('loadActualFileCount')), 10000); 
      });
      
      const result = await Promise.race([
        window.electronAPI.watcher.getFileCount(folderPath, recursive, ignoreRules),
        timeoutPromise
      ]);
      
      if (result && typeof result === 'object' && 'success' in result) {
        actualFileCount.value = (result as any).data || 0;
      }
    } catch (error) {
      console.error('loadActualFileCount:', error);

    } finally {
      loadingFileCount.value = false;
    }
  })();
}

async function refreshBackups() {
  // 先加载备份数据，确保核心功能正常
  await loadBackups();
  // 再异步加载文件数量，即使失败也不影响主流程
  loadActualFileCount().catch(err => console.error('文件计数失败:', err));
  store.addNotification({ type: 'success', message: '已刷新' });
}

// 返回监听管理
function goBack() {
  // 保存状态后返回
  savePageState();
  router.push('/');
}

// 展开/折叠组
function toggleGroup(groupId: string) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId);
  } else {
    expandedGroups.value.add(groupId);
  }
  expandedGroups.value = new Set(expandedGroups.value);
}

// 对比备份 - 跳转到文件对比页面
function compareBackup(backup: BackupRecord) {
  // 保存当前页面状态
  savePageState();
  router.push({
    path: '/compare',
    query: {
      filePath: backup.originalPath,
      backupId: backup.id,
      backupPath: backup.backupPath,
      backupTimestamp: String(backup.timestamp),
      folderId: selectedFolderId.value,
    },
  });
}

// 恢复单个备份
async function restoreBackup(backup: BackupRecord) {
  restoreDialog.value = {
    visible: true,
    loading: false,
    mode: 'single',
    title: '确定恢复文件',
    message: '恢复后将覆盖当前文件内容。',
    confirmText: '恢复文件',
    backup,
    group: null,
  };
}

// 确认删除备份 - 显示弹窗
function confirmDelete(backup: BackupRecord) {
  deleteDialog.value = {
    visible: true,
    loading: false,
    backupId: backup.id,
    fileName: getFileName(backup.originalPath),
    backupTime: `${formatDate(backup.timestamp)} ${formatTime(backup.timestamp)}`,
    fileSize: formatSize(backup.fileSize),
  };
}

// 关闭删除弹窗
function closeDeleteDialog() {
  if (deleteDialog.value.loading) return;
  deleteDialog.value.visible = false;
}

// 确认删除备份
async function confirmDeleteBackup() {
  if (deleteDialog.value.loading) return;
  deleteDialog.value.loading = true;

  try {
    const success = await store.deleteBackup(deleteDialog.value.backupId);
    if (success) {
      allBackups.value = allBackups.value.filter(b => b.id !== deleteDialog.value.backupId);
      deleteDialog.value.visible = false;
    }
  } finally {
    deleteDialog.value.loading = false;
  }
}

// 恢复分组备份
async function restoreGroup(group: BackupGroup) {
  const stepCount = group.backups.length;
  restoreDialog.value = {
    visible: true,
    loading: false,
    mode: 'group',
    title: '确定恢复分组',
    message: `将按时间顺序恢复，执行 ${stepCount} 个版本步骤。`,
    confirmText: '恢复分组',
    backup: null,
    group,
  };
}

async function restoreSingleBackupAction(backup: BackupRecord) {
  const result = await window.electronAPI.backup.restore(backup.id);
  if (result.success) {
    store.addNotification({ type: 'success', message: '恢复成功' });
  } else {
    store.addNotification({ type: 'error', message: result.error || '恢复失败' });
  }
  selectedBackup.value = null;
}

async function restoreGroupAction(group: BackupGroup) {
  const stepCount = group.backups.length;
  const backupsByFile = new Map<string, BackupRecord[]>();
  const ordered = [...group.backups].sort((a, b) => a.timestamp - b.timestamp);
  for (const backup of ordered) {
    const list = backupsByFile.get(backup.originalPath) || [];
    list.push(backup);
    backupsByFile.set(backup.originalPath, list);
  }

  let successCount = 0;
  let failCount = 0;
  for (const [, fileBackups] of backupsByFile) {
    for (const backup of fileBackups) {
      const result = await window.electronAPI.backup.restore(backup.id);
      if (result.success) successCount++;
      else failCount++;
    }
  }

  if (failCount === 0) {
    store.addNotification({ type: 'success', message: `分组恢复完成：${successCount}/${stepCount} 步骤成功` });
  } else {
    store.addNotification({ type: 'warning', message: `分组恢复完成：${successCount} 成功，${failCount} 失败` });
  }
}

function closeRestoreDialog() {
  if (restoreDialog.value.loading) return;
  restoreDialog.value.visible = false;
}

async function confirmRestoreDialog() {
  if (restoreDialog.value.loading) return;
  restoreDialog.value.loading = true;
  try {
    if (restoreDialog.value.mode === 'single' && restoreDialog.value.backup) {
      await restoreSingleBackupAction(restoreDialog.value.backup);
    } else if (restoreDialog.value.mode === 'group' && restoreDialog.value.group) {
      await restoreGroupAction(restoreDialog.value.group);
    }
    restoreDialog.value.visible = false;
  } finally {
    restoreDialog.value.loading = false;
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const targetDate = new Date(timestamp);
  targetDate.setHours(0, 0, 0, 0);
  
  if (targetDate.getTime() === today.getTime()) {
    return '今天';
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return '昨天';
  } else {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getBackupChangeLabel(backup: BackupRecord): string {
  switch (backup.changeType) {
    case 'add':
      return '新增';
    case 'change':
      return '修改';
    case 'unlink':
      return '删除';
    default:
      return '修改';
  }
}

function getBackupChangeClass(backup: BackupRecord): 'add' | 'change' | 'unlink' {
  if (backup.changeType === 'add' || backup.changeType === 'change' || backup.changeType === 'unlink') {
    return backup.changeType;
  }
  return 'change';
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}




onMounted(() => {
  const folderId = route.query.folderId as string;
  if (folderId) {
    selectedFolderId.value = folderId;
    restorePageState();
    loadBackups().then(() => {
      loadActualFileCount().catch(err => console.error('onMounted:', err));
    });
  }
});

onActivated(() => {
  const folderId = route.query.folderId as string;
  if (folderId && folderId !== selectedFolderId.value) {
    selectedFolderId.value = folderId;
    restorePageState();
    loadBackups().then(() => {
      loadActualFileCount().catch(err => console.error('onActivated:', err));
    });
  }
});

// 监听路由参数变化
watch(() => route.query.folderId, (newId) => {
  if (newId && newId !== selectedFolderId.value) {
    selectedFolderId.value = newId as string;
    restorePageState();
    loadBackups().then(() => {
      loadActualFileCount().catch(err => console.error('监听路由参数变化:', err));
    });
  }
});

// 监听分组间隔变化，重新计算展开状态
watch(actualInterval, () => {
  expandedGroups.value = new Set();
});
</script>

<style scoped>
.track-view {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--primary-500);
}

.back-btn:hover svg {
  color: white;
}

.back-btn svg {
  width: 20px;
  height: 20px;
  color: #666;
}

.header-info {
  flex: 1;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.folder-path {
  font-size: 13px;
  color: #999;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-icon-sm {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.toolbar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input-wrapper {
  flex: 1;
  min-width: 200px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: #999;
}

.search-input {
  width: 100%;
  padding: 10px 36px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.clear-btn {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn svg {
  width: 16px;
  height: 16px;
  color: #999;
}

.group-settings {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-label {
  font-size: 14px;
  color: #666;
}

.form-select {
  padding: 10px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
  background: white;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
}

.custom-interval {
  width: 80px;
}

.empty-state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon-wrapper {
  width: 100px;
  height: 100px;
  background: #f0f4ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--primary-500);
}

.empty-title {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  font-weight: 600;
}

.empty-desc {
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
}


.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.bg-primary { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); }
.bg-success { background: linear-gradient(135deg, #4caf50 0%, #43a047 100%); }
.bg-info { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); }

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}


.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.card-count {
  font-size: 13px;
  color: #999;
}

.card-body {
  padding: 16px 24px 24px;
}


.timeline {
  position: relative;
}

.timeline-group {
  margin-bottom: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  cursor: pointer;
  transition: background 0.2s;
}

.timeline-header:hover {
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-500);
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.group-time {
  display: flex;
  flex-direction: column;
}

.group-date {
  font-weight: 600;
  color: #333;
  font-size: 15px;
}

.group-clock {
  font-size: 13px;
  color: #666;
}

.group-count {
  font-size: 13px;
  color: #999;
  background: white;
  padding: 4px 10px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .btn svg {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #f0f0f0;
}

.backup-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: white;
  cursor: pointer;
  transition: background 0.2s;
}

.backup-item:hover {
  background: #fafafa;
}

.item-icon {
  width: 36px;
  height: 36px;
  background: #f0f4ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-icon svg {
  width: 18px;
  height: 18px;
  color: var(--primary-500);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.item-filename {
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-size {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

.item-time {
  font-size: 12px;
  color: #64748b;
}

.item-path {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.empty-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: #999;
}

.empty-timeline svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.track-view {
  max-width: 1200px;
  margin: 0 auto;
}


.page-header-modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: white;
  padding: 20px 24px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn-modern {
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-btn-modern:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.back-btn-modern svg {
  width: 20px;
  height: 20px;
  color: white;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.folder-path {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  margin: 4px 0 0 0;
}

.folder-path svg {
  width: 16px;
  height: 16px;
  color: #999;
}

.toolbar-modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 10px;
  z-index: 20;
}

.search-box {
  flex: 1;
  max-width: 400px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-box .search-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #999;
}

.search-box .search-input {
  width: 100%;
  padding: 10px 40px 10px 42px;
  border: 2px solid #f0f0f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  background: #fafafa;
}

.search-box .search-input:focus {
  border-color: var(--primary-500);
  background: white;
  outline: none;
}

.search-box .clear-btn {
  position: absolute;
  right: 10px;
  width: 24px;
  height: 24px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-box .clear-btn svg {
  width: 14px;
  height: 14px;
  color: #666;
}

.group-filter {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.form-select-modern {
  padding: 10px 32px 10px 14px;
  border: 2px solid #f0f0f0;
  border-radius: 10px;
  font-size: 14px;
  background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
  appearance: none;
  cursor: pointer;
  transition: all 0.2s;
}

.form-select-modern:focus {
  border-color: var(--primary-500);
  outline: none;
}

.form-input-modern {
  padding: 10px 14px;
  border: 2px solid #f0f0f0;
  border-radius: 10px;
  font-size: 14px;
  width: 100px;
  transition: all 0.2s;
}

.form-input-modern:focus {
  border-color: var(--primary-500);
  outline: none;
}

.custom-interval {
  width: 80px !important;
}

.custom-interval-unit {
  min-width: 72px;
}


.stats-grid-modern {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card-modern {
  background: white;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.stat-card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.stat-icon-modern {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-modern svg {
  width: 26px;
  height: 26px;
}

.stat-icon-modern.primary {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
}

.stat-icon-modern.primary svg {
  color: white;
}

.stat-icon-modern.success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon-modern.success svg {
  color: white;
}

.stat-icon-modern.info {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon-modern.info svg {
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.card-modern {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header-modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #f8f9ff 0%, #f5f7fa 100%);
}

.card-title-modern {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.card-title-modern svg {
  width: 20px;
  height: 20px;
  color: var(--primary-500);
}

.card-count-modern {
  font-size: 13px;
  color: #999;
  background: white;
  padding: 6px 12px;
  border-radius: 20px;
}

.card-body-modern {
  padding: 16px;
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}


.empty-timeline-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.empty-timeline-modern svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: #ddd;
}


.timeline-modern {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-group-modern {
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.timeline-group-modern:hover {
  border-color: var(--primary-300);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
}

.timeline-header-modern {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  cursor: pointer;
  transition: background 0.2s;
  gap: 12px;
}

.timeline-header-modern:hover {
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
}

.timeline-header-modern .header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.expand-icon-modern {
  width: 18px;
  height: 18px;
  color: var(--primary-500);
  transition: transform 0.2s;
}

.expand-icon-modern.expanded {
  transform: rotate(90deg);
}

.group-time {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.group-date {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.group-clock {
  font-size: 12px;
  color: #888;
}

.group-count-badge {
  font-size: 12px;
  color: var(--primary-600);
  background: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid #dbeafe;
  white-space: nowrap;
}

.timeline-header-modern .header-actions {
  margin-left: auto;
}

.timeline-items-modern {
  border-top: 1px solid #f0f0f0;
}

.backup-item-modern {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
}

.backup-item-modern:last-child {
  border-bottom: none;
}

.backup-item-modern:hover {
  background: #fafafa;
}

.item-icon-modern {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-icon-modern svg {
  width: 20px;
  height: 20px;
  color: var(--primary-500);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-path {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.item-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.item-size {
  font-size: 12px;
  color: #999;
}

.item-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.item-type.add {
  color: #14532d;
  background: #dcfce7;
}

.item-type.change {
  color: #0b5394;
  background: #dbeafe;
}

.item-type.unlink {
  color: #991b1b;
  background: #fee2e2;
}

.item-actions {
  display: flex;
  gap: 6px;
  opacity: 1;
  transition: opacity 0.2s;
}


.btn-icon-modern {
  width: 32px;
  height: 32px;
  border: none;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-icon-modern svg {
  width: 16px;
  height: 16px;
  color: #666;
}

.btn-icon-modern:hover {
  background: var(--primary-500);
}

.btn-icon-modern:hover svg {
  color: white;
}

.btn-icon-modern.danger:hover {
  background: #f44336;
}

.btn-primary-modern {
  background: var(--primary-500);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn-primary-modern:hover {
  background: #5a6fd6;
}

.btn-primary-modern svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .toolbar-modern {
    position: static;
    flex-direction: column;
    align-items: stretch;
  }

  .group-filter {
    width: 100%;
    flex-wrap: wrap;
  }

  .stats-grid-modern {
    grid-template-columns: 1fr;
  }

  .timeline-header-modern {
    flex-direction: column;
  }

  .timeline-header-modern .header-actions {
    margin-left: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>








