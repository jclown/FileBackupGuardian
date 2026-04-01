<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          设置
        </h3>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <!-- 备份设置 -->
        <div class="settings-section">
          <h4 class="section-title">备份设置</h4>
          
          <div class="form-group">
            <label class="form-label">备份存储路径</label>
            <div class="input-group">
              <input 
                type="text" 
                class="form-input" 
                v-model="settings.backupPath" 
                readonly
              />
              <button class="btn btn-secondary" @click="selectBackupPath">浏览⋯</button>
              <button 
                class="btn btn-secondary" 
                @click="openBackupLocation" 
                :disabled="!settings.backupPath"
                title="在文件资源管理器中打开"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon-sm">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                打开位置
              </button>
            </div>
            <p class="form-hint">备份文件将存储在此目录下</p>
          </div>

          <div class="form-group">
            <label class="form-label">备份延迟 (秒)</label>
            <input 
              type="number" 
              class="form-input" 
              v-model.number="settings.backupDelay"
              min="1"
              max="600"
            />
            <p class="form-hint">文件变化后等待多久开始备份，避免频繁备份</p>
          </div>

          <div class="form-group">
            <label class="form-label">备份保留天数</label>
            <input 
              type="number" 
              class="form-input" 
              v-model.number="settings.retentionDays"
              min="1"
              max="365"
            />
          </div>

          <div class="form-group">
            <label class="form-label">最大备份数量</label>
            <input 
              type="number" 
              class="form-input" 
              v-model.number="settings.maxBackups"
              min="1"
            />
          </div>
        </div>

        <!-- 默认忽略规则 -->
        <div class="settings-section">
          <h4 class="section-title">默认忽略规则</h4>
          <p class="section-desc">新添加的文件名将自动应用这些规则</p>
          
          <div class="rules-list">
            <div 
              v-for="rule in defaultIgnoreRules" 
              :key="rule.id" 
              class="rule-item"
            >
              <label class="switch switch-sm">
                <input type="checkbox" v-model="rule.enabled" />
                <span class="switch-slider"></span>
              </label>
              <span class="rule-type">{{ getRuleTypeLabel(rule.type) }}</span>
              <input 
                type="text" 
                class="form-input rule-value" 
                v-model="rule.value"
              />
              <button class="btn btn-sm btn-danger" @click="removeDefaultRule(rule.id)">删除</button>
            </div>
          </div>
          
          <div class="mt-3">
            <div class="flex gap-2">
              <select class="form-select" v-model="newRuleType" style="width: 120px;">
                <option value="extension">扩展名</option>
                <option value="name">文件名</option>
                <option value="folder">文件夹</option>
                <option value="pattern">正则模式</option>
              </select>
              <input 
                type="text" 
                class="form-input flex-1" 
                v-model="newRuleValue" 
                placeholder="输入规则值"
              />
              <button class="btn btn-primary" @click="addDefaultRule">添加</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" @click="saveSettings">保存设置</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAppStore } from '../stores/app';

interface IgnoreRule {
  id: string;
  type: 'extension' | 'pattern' | 'name' | 'folder';
  value: string;
  enabled: boolean;
}

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useAppStore();

const settings = ref({
  backupPath: '',
  backupDelay: 10,
  backupStrategy: 'full' as const,
  retentionDays: 30,
  maxBackups: 100,
});

const defaultIgnoreRules = ref<IgnoreRule[]>([]);
const newRuleType = ref<'extension' | 'pattern' | 'name' | 'folder'>('extension');
const newRuleValue = ref('');

// 监听 show 变化，加载设置
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadSettings();
  }
});

// 加载设置
function loadSettings() {
  const config = store.config;
  if (!config) return;
  
  settings.value = {
    backupPath: config.backup?.backupPath || '',
    backupDelay: config.backup?.backupDelay || 10,
    backupStrategy: 'full' as const,
    retentionDays: config.backup?.retentionDays || 30,
    maxBackups: config.backup?.maxBackups || 100,
  };
  defaultIgnoreRules.value = JSON.parse(JSON.stringify(config.defaultIgnoreRules || []));
}

// 选择备份路径
async function selectBackupPath() {
  const result = await window.electronAPI.dialog.openDirectory();
  if (result.success && result.path) {
    settings.value.backupPath = result.path;
  }
}

// 打开备份位置
async function openBackupLocation() {
  if (!settings.value.backupPath) return;
  
  try {
    // 使用 shell.openPath 打开文件目录
    const result = await window.electronAPI.shell.openPath(settings.value.backupPath);
    // shell.openPath 在成功时返回空字符串
    if (result && typeof result === 'string' && result !== '') {
      // 有错误消息
    }
  } catch {
    // 忽略错误
  }
}

// 获取规则类型标签
function getRuleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    extension: '扩展名',
    name: '文件名',
    folder: '文件夹',
    pattern: '正则',
  };
  return labels[type] || type;
}

// 添加默认忽略规则
function addDefaultRule() {
  if (!newRuleValue.value.trim()) return;
  defaultIgnoreRules.value.push({
    id: Date.now().toString(),
    type: newRuleType.value,
    value: newRuleValue.value.trim(),
    enabled: true,
  });
  newRuleValue.value = '';
}

// 删除默认忽略规则
function removeDefaultRule(id: string) {
  defaultIgnoreRules.value = defaultIgnoreRules.value.filter(r => r.id !== id);
}

// 保存设置
async function saveSettings() {
  const config = {
    backup: {
      backupPath: settings.value.backupPath,
      backupDelay: settings.value.backupDelay,
      backupStrategy: 'full' as const,
      retentionDays: settings.value.retentionDays,
      maxBackups: settings.value.maxBackups,
    },
    defaultIgnoreRules: JSON.parse(JSON.stringify(defaultIgnoreRules.value)),
  };
  
  await store.updateConfig(config);
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
}

.modal-title svg {
  width: 22px;
  height: 22px;
  color: var(--primary-500);
}

.modal-close {
  border: none;
  background: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.section-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group .form-input {
  flex: 1;
}

.btn-icon-sm {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

/* 规则列表 */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 8px;
}

.rule-type {
  width: 60px;
  font-size: 12px;
  color: #666;
}

.rule-value {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .3s;
  border-radius: 26px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .switch-slider {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
}

input:checked + .switch-slider:before {
  transform: translateX(22px);
}

.switch-sm {
  width: 36px;
  height: 20px;
}

.switch-sm .switch-slider:before {
  height: 14px;
  width: 14px;
}

.switch-sm input:checked + .switch-slider:before {
  transform: translateX(16px);
}

.mt-3 {
  margin-top: 16px;
}

.flex {
  display: flex;
}

.gap-2 {
  gap: 8px;
}

.flex-1 {
  flex: 1;
}
</style>
