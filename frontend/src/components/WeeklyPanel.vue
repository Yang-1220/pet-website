<template>
  <div class="weekly-card">
    <h2 class="panel-title">📊 狗狗周报</h2>
    <p class="panel-note">每日收盘值</p>
    <p class="panel-subtitle">最近 7 天状态变化趋势</p>

    <div v-if="hasData" class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 330 240" role="img" aria-label="狗狗最近 7 天状态折线图">
        <!-- 网格线与 Y 轴刻度（0-100） -->
        <g v-for="t in yTicks" :key="'grid' + t">
          <line :x1="padL" :x2="330 - padR" :y1="yAt(t)" :y2="yAt(t)" class="grid-line" />
          <text :x="padL - 6" :y="yAt(t) + 3" class="axis-text" text-anchor="end">{{ t }}</text>
        </g>
        <!-- X 轴日期（最近 7 天） -->
        <text
          v-for="(d, i) in dateLabels"
          :key="'x' + i"
          :x="xAt(i)"
          :y="240 - 8"
          class="axis-text"
          text-anchor="middle"
        >{{ d }}</text>
        <!-- 三条折线：饱食度 / 愉悦度 / 亲密度 -->
        <g v-for="s in plotted" :key="s.key">
          <polyline
            v-for="(seg, idx) in s.segs"
            :key="idx"
            :points="seg.map((p) => p.x + ',' + p.y).join(' ')"
            fill="none"
            :stroke="s.color"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="(p, idx) in s.points"
            :key="'p' + idx"
            :cx="p.x"
            :cy="p.y"
            r="3"
            :fill="s.color"
          />
        </g>
      </svg>
      <!-- 图例 -->
      <div class="legend">
        <span v-for="s in plotted" :key="s.key" class="legend-item">
          <i class="dot" :style="{ background: s.color }"></i>{{ s.label }}
        </span>
      </div>
    </div>

    <div v-else class="chart-empty">还没有记录，和狗狗互动一下，就能看到趋势曲线啦～</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 长度为 7 的数组：[{ date: 'YYYY-MM-DD', hunger, happiness, intimacy }]，无数据的天为 null
  data: { type: Array, default: () => [] }
});

const series = [
  { key: 'hunger', label: '饱食度', color: '#ff9f43' },
  { key: 'happiness', label: '愉悦度', color: '#f668a5' },
  { key: 'intimacy', label: '亲密度', color: '#5b8def' }
];

// SVG 画布与边距
const padL = 34;
const padR = 14;
const padT = 14;
const plotW = 330 - padL - padR;
const plotH = 240 - padT - 28;

const yTicks = [0, 25, 50, 75, 100];

function xAt(i) {
  return padL + (i / 6) * plotW;
}

function yAt(v) {
  return padT + (1 - v / 100) * plotH;
}

const dateLabels = computed(() =>
  props.data.map((d) => (d && d.date ? d.date.slice(5) : ''))
);

// 把每条序列拆成若干连续有数据的段（缺数据的天断开不画）
const plotted = computed(() =>
  series.map((s) => {
    const pts = props.data.map((d, i) =>
      d && d[s.key] !== null && d[s.key] !== undefined
        ? { x: xAt(i), y: yAt(Number(d[s.key])) }
        : null
    );
    const segs = [];
    let cur = [];
    pts.forEach((p) => {
      if (p) cur.push(p);
      else if (cur.length) {
        segs.push(cur);
        cur = [];
      }
    });
    if (cur.length) segs.push(cur);
    return { ...s, segs, points: pts.filter(Boolean) };
  })
);

const hasData = computed(() => plotted.value.some((s) => s.points.length > 0));
</script>

<style scoped>
.weekly-card {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 24px;
  padding: 20px 18px;
  box-shadow: 0 12px 32px rgba(214, 143, 74, 0.18);
  backdrop-filter: blur(6px);
  text-align: center;
}

.panel-title {
  font-size: 18px;
  color: #5b4636;
}

.panel-note {
  margin-top: 3px;
  font-size: 11px;
  letter-spacing: 1px;
  color: #c4a88f;
}

.panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #b59a86;
}

.chart-wrap {
  margin-top: 12px;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.grid-line {
  stroke: #f0e2d4;
  stroke-width: 1;
}

.axis-text {
  font-size: 9px;
  fill: #b59a86;
}

.legend {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 14px;
  font-size: 12px;
  color: #6b5140;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

.chart-empty {
  margin: 28px 0 22px;
  font-size: 13px;
  color: #b59a86;
  line-height: 1.6;
}
</style>
