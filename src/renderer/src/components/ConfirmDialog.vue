<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal confirm-modal" :class="{ 'danger-mode': danger }" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <button class="modal-close" @click="handleCancel" :disabled="loading">×</button>
      </div>
      <div class="modal-body">
        <p v-if="message" :class="{ 'warning-text': danger }">{{ message }}</p>
        <div v-if="details && details.length > 0" class="confirm-meta">
          <div v-for="(detail, index) in details" :key="index" class="detail-row">
            <span class="detail-label">{{ detail.label }}</span>
            <span class="detail-value">{{ detail.value }}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleCancel" :disabled="loading">{{ cancelText }}</button>
        <button 
          :class="['btn', danger ? 'btn-danger-modern' : 'btn-primary-modern']" 
          @click="handleConfirm" 
          :disabled="loading"
        >
          {{ loading ? loadingText : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface DetailItem {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  details?: DetailItem[];
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  loading?: boolean;
  danger?: boolean;
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: '确认',
  cancelText: '取消',
  loadingText: '处理中...',
  loading: false,
  danger: false,
  closeOnOverlay: true,
});

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'update:visible', value: boolean): void;
}>();

function handleOverlayClick() {
  if (props.closeOnOverlay && !props.loading) {
    handleCancel();
  }
}

function handleCancel() {
  if (props.loading) return;
  emit('cancel');
  emit('update:visible', false);
}

function handleConfirm() {
  if (props.loading) return;
  emit('confirm');
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
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 18px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #eee;
  color: #333;
}

.modal-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  padding: 20px 24px;
}

.modal-body p {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.warning-text {
  color: #dc2626;
  font-weight: 500;
}

.confirm-meta {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid #eee;
}

.detail-label {
  font-size: 13px;
  color: #999;
  flex-shrink: 0;
  margin-right: 16px;
}

.detail-value {
  flex: 1;
  font-size: 14px;
  color: #333;
  word-break: break-all;
  text-align: right;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-secondary:hover {
  background: #eee;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary-modern {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary-modern:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn-primary-modern:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-danger-modern {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.btn-danger-modern:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-danger-modern:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
