<template>
  <div class="watcher-dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ watchPaths.length }}</div>
          <div class="stat-label">监听目录</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ activeWatchCount }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ totalFiles }}</div>
          <div class="stat-label">文件总数</div>
        </div>
      </div>
    </div>

    <div class="section-header">
      <h2 class="section-title">监听目录</h2>
      <button class="btn btn-primary btn-sm" @click="showAddModal = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加目录
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="watchPaths.length === 0" class="empty-state">
      <div class="empty-illustration">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      </div>
      <h2 class="empty-title">开始保护你的文件</h2>
      <p class="empty-description">添加需要监听的文件夹，FileGuardian 将自动备份每一次变更</p>
    </div>

    <!-- 监听目录卡片网格 -->
    <div v-else class="watch-grid">
      <div 
        v-for="path in watchPaths" 
        :key="path.id" 
        class="watch-card"
        :class="{ paused: !path.enabled }"
      >
        <div class="watch-card-content" @click="goToTrack(path.id)">
          <div class="card-top">
            <div class="folder-header">
              <div class="folder-icon-wrapper">
                <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
              </div>
              <div class="folder-details">
                <span class="folder-name">{{ getFolderName(path.path) }}</span>
                <span class="watch-path" :title="path.path">{{ path.path }}</span>
              </div>
            </div>
            <!-- 更多操作 -->
            <div class="action-menu" @click.stop>
              <button class="btn-icon" @click.stop="showIgnoreRules(path)" title="忽略规则">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
              </button>
              <button class="btn-icon danger" @click.stop="confirmRemove(path)" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="card-middle">
             <div class="stat-badges">
                <span v-if="path.recursive" class="badge badge-primary">递归</span>
                <span v-if="path.ignoreRules && path.ignoreRules.length > 0" class="badge badge-info">{{path.ignoreRules.length}} 规则</span>
             </div>
          </div>

          <div class="card-bottom">
            <div class="watch-meta">
              <span class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="meta-text">{{ getFileCount(path.id) }} 文件</span>
              </span>
              <span class="meta-item" v-if="getStatus(path.id)?.lastActivity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span class="meta-text">{{ formatLastActivity(getStatus(path.id)?.lastActivity) }}</span>
              </span>
            </div>

            <!-- 状态与开关区 -->
            <div class="status-and-switch" @click.stop>
              <div class="watch-status-pill" :class="{ running: getStatus(path.id)?.isRunning }">
                <div class="status-dot"></div>
                <span class="status-text">{{ getStatus(path.id)?.isRunning ? '运行中' : '已暂停' }}</span>
              </div>
              <label class="switch">
                <input 
                  type="checkbox" 
                  :checked="path.enabled"
                  @change="togglePath(path.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加目录窗口 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
          <div class="modal" @click.stop>
            <div class="modal-header">
              <h3 class="modal-title">添加监听目录</h3>
              <button class="modal-close" @click="showAddModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">选择文件夹</label>
                <div class="input-group">
                  <input 
                    type="text" 
                    class="form-input" 
                    v-model="newFolderPath"
                    placeholder="点击浏览选择文件夹"
                    readonly
                  />
                  <button class="btn btn-secondary" @click="selectFolder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    浏览
                  </button>
                </div>
              </div>

              <label class="checkbox-label">
                <input type="checkbox" v-model="recursive" />
                <span class="checkbox-text">
                  <span class="checkbox-title">包含子目录</span>
                  <span class="checkbox-desc">递归监听所有子目录中的文件变更</span>
                </span>
              </label>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
              <button class="btn btn-primary" @click="addFolder" :disabled="!newFolderPath">
                添加目录
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 忽略规则窗口 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRulesModal" class="modal-overlay" @click="closeRulesModal">
          <div class="modal rules-modal" @click.stop>
            <div class="modal-header">
              <h3 class="modal-title">忽略规则</h3>
              <button class="modal-close" @click="closeRulesModal">×</button>
            </div>
            <div class="modal-body">
              <div v-if="currentRules.length === 0" class="empty-rules">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>暂无忽略规则</p>
              </div>
              <div v-else class="rules-list">
                <div v-for="rule in currentRules" :key="rule.id" class="rule-item">
                  <label class="switch switch-sm" @click.stop>
                    <input type="checkbox" v-model="rule.enabled" />
                    <span class="switch-slider"></span>
                  </label>
                  <span class="rule-badge">{{ getRuleTypeLabel(rule.type) }}</span>
                  <input type="text" class="form-input" v-model="rule.value" />
                  <button class="btn-icon danger" @click="removeRule(rule.id)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="add-rule">
                <select class="form-select" v-model="newRuleType" style="width: 120px;">
                  <option value="extension">扩展名</option>
                  <option value="name">文件名</option>
                  <option value="folder">文件夹</option>
                  <option value="pattern">正则</option>
                </select>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="newRuleValue" 
                  placeholder="输入规则值，如 .log、node_modules..."
                  @keyup.enter="addRule"
                />
                <button class="btn btn-primary" @click="addRule" :disabled="!newRuleValue.trim()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="closeRulesModal">取消</button>
              <button class="btn btn-primary" @click="saveRules">保存规则</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      v-model:visible="deleteDialog.visible"
      title="确认删除监听文件夹"
      message="确定要删除这个监听文件夹吗？"
      :details="[{ label: '路径', value: deleteDialog.pathName }]"
      confirm-text="确认删除"
      loading-text="删除中..."
      :loading="deleteDialog.loading"
      danger
      @confirm="confirmDeletePath"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import ConfirmDialog from '../components/ConfirmDialog.vue';

interface IgnoreRule {
  id: string;
  type: 'extension' | 'pattern' | 'name' | 'folder';
  value: string;
  enabled: boolean;
}

const store = useAppStore();
const router = useRouter();

const watchPaths = computed(() => store.watchPaths);
const showAddModal = ref(false);
const newFolderPath = ref('');
const recursive = ref(true);
const showRulesModal = ref(false);
const currentPathId = ref('');
const currentRules = ref<IgnoreRule[]>([]);
const newRuleType = ref<'extension' | 'pattern' | 'name' | 'folder'>('extension');
const newRuleValue = ref('');

const deleteDialog = ref<{
  visible: boolean;
  loading: boolean;
  pathId: string;
  pathName: string;
}>({
  visible: false,
  loading: false,
  pathId: '',
  pathName: '',
});

const isElectron = typeof window !== 'undefined' && window.electronAPI;

const activeWatchCount = computed(() => {
  return watchPaths.value.filter(p => p.enabled).length;
});

const totalFiles = computed(() => {
  return watchPaths.value.reduce((total, path) => {
    const status = store.watcherStatuses.get(path.id);
    return total + (status?.fileCount ?? 0);
  }, 0);
});

function getStatus(pathId: string) {
  return store.watcherStatuses.get(pathId);
}

function getFileCount(pathId: string): number {
  return store.watcherStatuses.get(pathId)?.fileCount ?? 0;
}

function getFolderName(fullPath: string): string {
  const parts = fullPath.split(/[\\/]/);
  return parts[parts.length - 1] || fullPath;
}

function formatLastActivity(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function goToTrack(pathId: string) {
  router.push({ path: '/track', query: { folderId: pathId } });
}

async function selectFolder() {
  if (!isElectron) return;
  
  try {
    const result = await window.electronAPI.dialog.openDirectory();
    if (result.success && result.path) {
      newFolderPath.value = result.path;
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
  }
}

async function addFolder() {
  if (!newFolderPath.value) return;
  const success = await store.addWatchPath(newFolderPath.value, recursive.value);
  if (success) {
    showAddModal.value = false;
    newFolderPath.value = '';
  }
}

async function togglePath(id: string, enabled: boolean) {
  await store.toggleWatchPath(id, enabled);
}

function confirmRemove(path: { id: string; path: string }) {
  deleteDialog.value = {
    visible: true,
    loading: false,
    pathId: path.id,
    pathName: path.path,
  };
}

function closeDeleteDialog() {
  if (deleteDialog.value.loading) return;
  deleteDialog.value.visible = false;
}

async function confirmDeletePath() {
  if (deleteDialog.value.loading) return;
  deleteDialog.value.loading = true;
  try {
    await store.removeWatchPath(deleteDialog.value.pathId);
    deleteDialog.value.visible = false;
  } finally {
    deleteDialog.value.loading = false;
  }
}

function showIgnoreRules(path: { id: string; ignoreRules: IgnoreRule[] }) {
  currentPathId.value = path.id;
  currentRules.value = JSON.parse(JSON.stringify(path.ignoreRules));
  showRulesModal.value = true;
}

function closeRulesModal() {
  showRulesModal.value = false;
  currentPathId.value = '';
  currentRules.value = [];
}

function getRuleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    extension: '扩展名',
    name: '文件名',
    folder: '文件夹',
    pattern: '正则',
  };
  return labels[type] || type;
}

function addRule() {
  if (!newRuleValue.value.trim()) return;
  currentRules.value.push({
    id: Date.now().toString(),
    type: newRuleType.value,
    value: newRuleValue.value.trim(),
    enabled: true,
  });
  newRuleValue.value = '';
}

function removeRule(id: string) {
  currentRules.value = currentRules.value.filter(r => r.id !== id);
}

async function saveRules() {
  const pathIndex = store.watchPaths.findIndex(p => p.id === currentPathId.value);
  if (pathIndex > -1) {
    const plainRules = JSON.parse(JSON.stringify(currentRules.value));
    const currentPath = JSON.parse(JSON.stringify(store.watchPaths[pathIndex]));
    const updatedPaths = store.watchPaths.map((p, i) => 
      i === pathIndex ? { ...currentPath, ignoreRules: plainRules } : JSON.parse(JSON.stringify(p))
    );
    await store.updateConfig({ watchPaths: updatedPaths });
  }
  closeRulesModal();
}
</script>

<style scoped>
/* 本地扩展设计令牌 */
.watcher-dashboard {
  --app-gradient-primary: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%);
  --app-glass-bg: rgba(255, 255, 255, 0.7);
  --app-card-border: 1px solid rgba(0, 0, 0, 0.05);
}

.watcher-dashboard {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* 统计卡片区域 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.stat-card {
  background: var(--bg-primary);
  padding: var(--space-6);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--space-5);
  border: var(--app-card-border);
  transition: all var(--transition-slow);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-light);
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-base);
}

.stat-card:hover .stat-icon {
  transform: scale(1.05);
}

.stat-icon svg {
  width: 32px;
  height: 32px;
}

.stat-icon.primary {
  background: linear-gradient(135deg, var(--primary-50) 0%, #e0f2fe 100%);
  color: var(--primary-500);
}

.stat-icon.success {
  background: linear-gradient(135deg, var(--success-50) 0%, #dcfce7 100%);
  color: var(--success-500);
}

.stat-icon.info {
  background: linear-gradient(135deg, var(--info-50) 0%, #dbeafe 100%);
  color: var(--info-500);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--text-4xl);
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-top: var(--space-1);
  font-weight: 500;
}

/* 栏目头部 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: calc(var(--space-6) * -0.5);
}

.section-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.3px;
}

/* 网格布局重构 */
.watch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--space-6);
}

.watch-card {
  background: var(--bg-primary);
  border-radius: var(--radius-2xl);
  border: var(--app-card-border);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-slow);
  position: relative;
  overflow: hidden;
  height: 100%;
}

.watch-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--app-gradient-primary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.watch-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: var(--shadow-lg);
  border-color: transparent;
}

.watch-card:hover::before {
  opacity: 1;
}

.watch-card.paused {
  opacity: 0.7;
  filter: grayscale(10%);
}

.watch-card.paused::before {
  background: var(--gray-300);
}

.watch-card-content {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  height: 100%;
  cursor: pointer;
}

/* 卡片顶部内容 */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  gap: var(--space-3);
}

.folder-header {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  flex: 1;
  min-width: 0;
}

.folder-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--primary-50);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.folder-icon {
  width: 24px;
  height: 24px;
  color: var(--primary-500);
}

.folder-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.folder-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.watch-path {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  font-family: var(--font-mono);
}

/* 卡片中间区域 - Badges */
.card-middle {
  margin-bottom: var(--space-5);
  flex: 1;
}

.stat-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.action-menu {
  display: flex;
  gap: var(--space-1);
  opacity: 1;
  transition: opacity var(--transition-fast);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--text-secondary);
}

.btn-icon:hover {
  background: var(--primary-500);
  color: white;
  transform: translateY(-2px);
}

.btn-icon.danger:hover {
  background: var(--danger-500);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

/* 鍗＄墖搴曢儴缁熻鍙婄姸鎬?*/
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-4);
  margin-top: auto;
}

.watch-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-item svg {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
}

.meta-text {
  flex: 1;
  white-space: nowrap;
}

/* 鐘舵€佽嵂涓?& 寮€鍏?*/
.status-and-switch {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
}

.watch-status-pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

.watch-status-pill.running {
  background: var(--success-50);
  color: var(--success-600);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gray-400);
}

.watch-status-pill.running .status-dot {
  background: var(--success-500);
  animation: pulse 2s ease-in-out infinite;
  box-shadow: 0 0 0 rgba(34, 197, 94, 0.4);
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

/* 绌虹姸鎬?*/
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
  background: var(--bg-primary);
  border-radius: var(--radius-2xl);
  border: var(--app-card-border);
  box-shadow: var(--shadow-sm);
  margin-top: var(--space-4);
}

.empty-illustration {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, var(--primary-50) 0%, #e0f2fe 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-6);
  box-shadow: 0 10px 25px rgba(14, 165, 233, 0.1);
}

.empty-illustration svg {
  width: 50px;
  height: 50px;
  color: var(--primary-500);
}

.empty-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-tertiary);
  margin: 0;
  max-width: 400px;
}

/* 寮圭獥鏍峰紡 */
.rules-modal {
  max-width: 600px;
}

.empty-rules {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.empty-rules svg {
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.rule-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.rule-badge {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  min-width: 50px;
  text-align: center;
  border: 1px solid var(--border-light);
  font-weight: 600;
}

.add-rule {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-light);
}

/* Checkbox 鏍峰紡 */
.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: 1px solid transparent;
}

.checkbox-label:hover {
  background: var(--primary-50);
  border-color: var(--primary-100);
}

.checkbox-label input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox-text {
  display: flex;
  flex-direction: column;
}

.checkbox-title {
  font-weight: 600;
  color: var(--text-primary);
}

.checkbox-desc {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

/* 灏忓紑鍏?*/
.switch-sm {
  width: 36px;
  height: 20px;
}

.switch-sm .switch-slider::before {
  width: 14px;
  height: 14px;
  left: 3px;
  bottom: 3px;
}

.switch-sm input:checked + .switch-slider::before {
  transform: translateX(16px);
}

/* 鍝嶅簲寮?*/
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .watch-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
}
</style>

