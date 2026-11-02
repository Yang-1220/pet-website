<template>
  <div class="status-row">
    <span class="icon">{{ icon }}</span>
    <span class="label">{{ label }}</span>
    <div class="track">
      <div class="fill" :class="{ full: clamped >= 100 }" :style="{ width: clamped + '%' }"></div>
    </div>
    <span class="num">{{ clamped }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  color: { type: String, default: 'linear-gradient(90deg,#ffb347,#ff7e3f)' }
});

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.value))));
</script>

<style scoped>
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  font-size: 20px;
  width: 26px;
  text-align: center;
}

.label {
  width: 60px;
  font-size: 14px;
  font-weight: 600;
  color: #6b5140;
}

.track {
  flex: 1;
  height: 14px;
  background: #f3e7db;
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999px;
  background: v-bind(color);
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 满值时轻微发光 */
.fill.full {
  animation: glow 1.2s ease-in-out infinite alternate;
}
@keyframes glow {
  from { filter: brightness(1); }
  to { filter: brightness(1.25); }
}

.num {
  width: 34px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #8a6f5c;
}
</style>
