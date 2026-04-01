<template>
  <div class="settings-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">设置</h1>
      <p class="page-desc">配置备份参数和系统设置</p>
    </div>

    <!-- 备份配置 -->
    <div class="card mb-3">
      <div class="card-header">
        <span class="card-title">备份配置</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">备份存储路径</label>
          <div class="input-group">
            <input 
              type="text" 
              class="form-input" 
              v-model="backupConfig.backupPath"
              readonly
            />
            <button class="btn btn-secondary" @click="selectBackupPath">选择</button>
          </div>
          <p class="form-hint">备份文件将存储在此目录下</p>
        </div>

        <div class="form-group">
          <label class="form-label">备份延迟（秒）</label>
          <input 
            type="number" 
            class="form-input" 
            v-model.number="backupConfig.backupDelay"
            min="1"
            max="600"
          />
          <p class="form-hint">文件变化后等待多久开始备份，避免频繁备份</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">备份保留天数</label>
            <input 
              type="number" 
              class="form-input" 
              v-model.number="backupConfig.retentionDays"
              min="1"
              max="365"
            />
          </div>
          <div class="form-group">
            <label class="form-label">最大备份数量</label>
            <input 
              type="number" 
              class="form-input" 
              v-model.number="backupConfig.maxBackups"
              min="1"
            />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" @click="saveBackupConfig">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 日志管理 -->
    <div class="card mb-3">
      <div class="card-header">
        <span class="card-title">日志管理</span>
        <span class="badge badge-info">{{ logs.length }} 条记录</span>
      </div>
      <div class="card-body">
        <div class="log-filters mb-3">
          <select class="form-select" v-model="logFilter.level" style="width: 120px;">
            <option value="">全部级别</option>
            <option value="info">信息</option>
            <option value="warn">警告</option>
            <option value="error">错误</option>
          </select>
          <select class="form-select" v-model="logFilter.module" style="width: 120px;">
            <option value="">全部模块</option>
            <option value="watcher">监听</option>
            <option value="backup">备份</option>
            <option value="compare">比较</option>
            <option value="config">配置</option>
          </select>
          <button class="btn btn-secondary" @click="exportLogs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon-sm">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            导出日志
          </button>
        </div>

        <div class="log-list">
          <div 
            v-for="log in filteredLogs" 
            :key="log.id" 
            :class="['log-item', log.level]"
          >
            <div class="log-header">
              <span :class="['log-level', log.level]">{{ getLevelLabel(log.level) }}</span>
              <span class="log-module">{{ getModuleLabel(log.module) }}</span>
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            </div>
            <div class="log-message">{{ log.message }}</div>
            <div v-if="log.details" class="log-details">
              <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">关于</span>
      </div>
      <div class="card-body">
        <div class="about-content">
          <div class="about-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="logo-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <div class="about-info">
            <h2 class="about-title">FileGuardian</h2>
            <p class="about-version">版本 1.0.0</p>
            <p class="about-tech">技术栈: Electron + TypeScript + Vue3</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '../stores/app';

interface BackupConfig {
  backupPath: string;
  backupDelay: number;
  backupStrategy: 'full';
  retentionDays: number;
  maxBackups: number;
}

const store = useAppStore();

const backupConfig = ref<BackupConfig>({
  backupPath: '',
  backupDelay: 10,
  backupStrategy: 'full',
  retentionDays: 30,
  maxBackups: 100,
});

const logs = computed(() => store.logs);
const logFilter = ref({
  level: '',
  module: '',
});

// 过滤后的日志
const filteredLogs = computed(() => {
  let result = [...logs.value];

  if (logFilter.value.level) {
    result = result.filter(l => l.level === logFilter.value.level);
  }

  if (logFilter.value.module) {
    result = result.filter(l => l.module === logFilter.value.module);
  }

  return result.slice(-100).reverse();
});

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

// 获取级别标签
function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    info: '信息',
    warn: '警告',
    error: '错误',
  };
  return labels[level] || level;
}

// 获取模块标签
function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    watcher: '监听',
    backup: '备份',
    compare: '比较',
    config: '配置',
  };
  return labels[module] || module;
}

// 选择备份路径
async function selectBackupPath() {
  const result = await window.electronAPI.dialog.openDirectory();
  if (result.success && result.path) {
    backupConfig.value.backupPath = result.path;
  }
}

// 保存备份配置
async function saveBackupConfig() {
  await store.updateConfig({
    backup: backupConfig.value,
  });
  store.addNotification({ type: 'success', message: '备份配置已保存' });
}

// 导出日志
async function exportLogs() {
  await store.exportLogs();
}

// 初始化
onMounted(() => {
  if (store.config?.backup) {
    backupConfig.value = { ...store.config.backup };
  }
});
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.page-desc {
  color: #666;
  font-size: 14px;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group .form-input {
  flex: 1;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.log-filters {
  display: flex;
  gap: 12px;
}

.btn-icon-sm {
  width: 14px;
  height: 14px;
}

.log-list {
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: #fafafa;
}

.log-item.error {
  background: #ffebee;
}

.log-item.warn {
  background: #fff3e0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.log-level {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.log-level.info {
  background: #e3f2fd;
  color: #1565c0;
}

.log-level.warn {
  background: #fff3e0;
  color: #ef6c00;
}

.log-level.error {
  background: #ffebee;
  color: #c62828;
}

.log-module {
  font-size: 12px;
  color: #666;
  padding: 2px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.log-time {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.log-message {
  font-size: 14px;
  color: #333;
}

.log-details {
  margin-top: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.log-details pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.about-content {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
}

.about-logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 48px;
  height: 48px;
  color: white;
}

.about-info {
  flex: 1;
}

.about-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.about-version {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.about-desc {
  font-size: 14px;
  color: #999;
  margin-bottom: 4px;
}

.about-tech {
  font-size: 13px;
  color: #999;
}
</style>



