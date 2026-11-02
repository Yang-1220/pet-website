<template>
  <div class="diary-card">
    <h2 class="panel-title">📖 狗狗日记</h2>
    <p class="panel-subtitle">每天一条，狗狗自己写的</p>

    <div v-if="items.length" class="diary-list">
      <article v-for="item in items" :key="item.id" class="diary-item">
        <div class="diary-head">
          <span class="diary-day">{{ item.day.slice(5) }}</span>
          <span class="diary-mood">{{ moodIcon(item.mood) }}</span>
        </div>
        <p class="diary-text">{{ item.content }}</p>
      </article>
    </div>
    <div v-else class="diary-empty">还没有日记，点下面按钮让它写一篇吧～</div>

    <div class="diary-actions">
      <button class="diary-btn ghost" :disabled="page <= 1" @click="$emit('prev')">← 新的</button>
      <span class="diary-page">{{ page }} / {{ maxPage }}</span>
      <button class="diary-btn ghost" :disabled="page >= maxPage" @click="$emit('next')">更早 →</button>
    </div>
    <button class="diary-btn primary" :disabled="busy" @click="$emit('generate')">
      {{ busy ? '正在写…' : '✍️ 写今天的日记' }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({ page: 1, pageSize: 3, total: 0, items: [] })
  },
  busy: { type: Boolean, default: false }
});

defineEmits(['prev', 'next', 'generate']);

const items = computed(() => props.data.items || []);
const page = computed(() => props.data.page || 1);
const maxPage = computed(() => Math.max(1, Math.ceil((props.data.total || 0) / (props.data.pageSize || 3))));

const MOOD_ICON = { happy: '😊', hungry: '😟', sad: '☹️', normal: '🐶' };
function moodIcon(mood) {
  return MOOD_ICON[mood] || '🐶';
}
</script>

<style scoped>
.diary-card {
  margin-top: 18px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 24px;
  padding: 20px 18px;
  box-shadow: 0 12px 32px rgba(214, 143, 74, 0.18);
  backdrop-filter: blur(6px);
  text-align: left;
}

.panel-title {
  font-size: 18px;
  color: #5b4636;
  text-align: center;
}

.panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #b59a86;
  text-align: center;
}

.diary-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.diary-item {
  background: #fffaf3;
  border: 1px solid #f5e7d6;
  border-radius: 14px;
  padding: 10px 12px;
}

.diary-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.diary-day {
  font-size: 12px;
  font-weight: 600;
  color: #d97b29;
}

.diary-mood {
  font-size: 14px;
}

.diary-text {
  font-size: 12.5px;
  line-height: 1.65;
  color: #6b5140;
}

.diary-empty {
  margin: 18px 0;
  font-size: 13px;
  color: #b59a86;
  text-align: center;
  line-height: 1.6;
}

.diary-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.diary-page {
  font-size: 12px;
  color: #a8927e;
}

.diary-btn {
  border: none;
  cursor: pointer;
  border-radius: 999px;
  font-size: 12.5px;
  padding: 7px 12px;
  transition: opacity 0.15s, transform 0.15s;
}

.diary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.diary-btn.ghost {
  background: #f6ece0;
  color: #7a5c43;
}

.diary-btn.primary {
  margin-top: 10px;
  width: 100%;
  padding: 9px 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #ffc86b, #f79c3c);
}

.diary-btn.primary:not(:disabled):hover {
  transform: translateY(-1px);
}
</style>
