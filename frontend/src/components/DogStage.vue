<template>
  <div class="dog-wrapper" :class="[{ 'is-eating': action === 'feed', 'is-petted': action === 'pet' }, 'mood-' + mood]">
    <svg class="dog-svg" viewBox="0 0 220 220" role="img" aria-label="可爱的柴犬">
      <!-- 尾巴 -->
      <path class="tail" d="M156 152 Q 192 136 184 100" />
      <!-- 身体 -->
      <ellipse class="fur" cx="110" cy="150" rx="50" ry="40" />
      <!-- 肚皮 -->
      <ellipse class="cream" cx="110" cy="160" rx="32" ry="26" />
      <!-- 后腿 -->
      <rect class="fur" x="80" y="180" width="18" height="26" rx="9" />
      <rect class="fur" x="122" y="180" width="18" height="26" rx="9" />
      <!-- 头 -->
      <circle class="fur" cx="110" cy="82" r="45" />
      <!-- 耳朵（hungry 时以耳根为中心微微下垂） -->
      <path class="ear ear-left" d="M76 56 L 64 16 L 102 36 Z" />
      <path class="ear ear-right" d="M144 56 L 156 16 L 118 36 Z" />
      <path class="ear-inner ear-left" d="M78 48 L 72 26 L 92 37 Z" />
      <path class="ear-inner ear-right" d="M142 48 L 148 26 L 128 37 Z" />
      <!-- 眉毛斑点 -->
      <ellipse class="cream" cx="92" cy="64" rx="9" ry="5" />
      <ellipse class="cream" cx="128" cy="64" rx="9" ry="5" />
      <!-- 眼睛：normal、hungry 显示黑豆眼（保持原坐标）；happy、sad 显示追加的弧线眼 -->
      <circle class="eye" cx="92" cy="76" r="5.5" v-show="!showArcEyes" />
      <circle class="eye" cx="128" cy="76" r="5.5" v-show="!showArcEyes" />
      <path class="eye-arc" :d="eyePath(86, 92, 98)" v-show="showArcEyes" />
      <path class="eye-arc" :d="eyePath(122, 128, 134)" v-show="showArcEyes" />
      <!-- 腮红 -->
      <circle class="cheek" cx="78" cy="90" r="6.5" />
      <circle class="cheek" cx="142" cy="90" r="6.5" />
      <!-- 口鼻 -->
      <ellipse class="muzzle" cx="110" cy="96" rx="24" ry="17" />
      <ellipse class="nose" cx="110" cy="90" rx="7" ry="5.5" />
      <path class="mouth" :d="mouthPath()" />
      <!-- 开心时微微张开的嘴（盖住微笑线条） -->
      <path class="mouth-open" d="M103 101 Q 110 111 117 101 Z" />
      <!-- 舌头（被抚摸时吐出来） -->
      <path class="tongue" :class="{ show: action === 'pet' }" d="M106 104 Q 110 114 114 104 Z" />
      <!-- 饿了提示符号：头顶右侧的「…」 -->
      <text class="hungry-hint" x="146" y="42" v-show="mood === 'hungry'">…</text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  action: { type: String, default: '' },
  mood: { type: String, default: 'normal' }
});

// 眼睛弧线：happy 向上弯（眯眼笑），sad 向下弯，hungry 没精神的扁平下垂眼
function eyePath(x1, xm, x2) {
  if (props.mood === 'sad') return `M${x1} 74 Q ${xm} 82 ${x2} 74`;
  if (props.mood === 'hungry') return `M${x1 - 2} 76 Q ${xm} 80 ${x2 + 2} 76`;
  return `M${x1} 78 Q ${xm} 70 ${x2} 78`;
}

// 嘴巴：hungry 微微向下撇的小弧线，其他状态保持原微笑线条
function mouthPath() {
  return props.mood === 'hungry'
    ? 'M102 103 Q 110 99 118 103'
    : 'M100 99 Q 105 106 110 100 Q 115 106 120 99';
}

// 弧线眼睛在 happy / sad / hungry 显示，normal 用黑豆眼
const showArcEyes = computed(() => props.mood !== 'normal');
</script>

<style scoped>
.dog-wrapper {
  display: flex;
  justify-content: center;
}

.dog-svg {
  width: 230px;
  height: 230px;
  animation: idle-bob 3s ease-in-out infinite;
}

/* 待机时轻轻上下浮动 */
@keyframes idle-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.tail {
  fill: none;
  stroke: #ec9a3c;
  stroke-width: 15;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: 0% 100%;
  animation: wag 0.5s ease-in-out infinite;
}

/* 摇尾巴 */
@keyframes wag {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(16deg); }
}

.eye {
  fill: #3d2b1f;
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 4.2s infinite;
}

/* 眨眼 */
@keyframes blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.12); }
}

.fur { fill: #f7b055; }
.ear { fill: #ec9a3c; }
.ear-inner { fill: #ffd9b3; }
.cream { fill: #fdead2; }
.muzzle { fill: #fdead2; }
.nose { fill: #4a3423; }
.mouth {
  fill: none;
  stroke: #4a3423;
  stroke-width: 3;
  stroke-linecap: round;
}
.cheek { fill: #ffb1a0; opacity: 0.55; }

.tongue {
  fill: #ff8ba0;
  opacity: 0;
  transition: opacity 0.2s;
}
.tongue.show { opacity: 1; }

/* 喂食动画：快速眨眼一小会儿，然后恢复正常眨眼节奏 */
.is-eating .eye {
  animation: wink-blink 0.45s ease-in-out 4;
}
@keyframes wink-blink {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.1); }
}

/* ===== 心情表情（mood：normal / happy / hungry / sad） ===== */

/* 弧线眼（happy / sad 显示）：happy 时随待机眨眼 */
.eye-arc {
  fill: none;
  stroke: #3d2b1f;
  stroke-width: 4;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 4.2s infinite;
}
.mood-sad .eye-arc { animation: none; }
/* hungry：黑豆眼停止眨眼 */
.mood-hungry .eye { animation: none; }
/* hungry：下垂眼不眨、线条更细更没精神 */
.mood-hungry .eye-arc {
  animation: none;
  stroke-width: 3;
}
/* 喂食快速眨眼同样作用于弧线眼 */
.is-eating .eye-arc {
  animation: wink-blink 0.45s ease-in-out 4;
}

/* hungry：耳朵以耳根（底边中心）为轴微微向外下垂 */
.ear, .ear-inner {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  transition: transform 0.3s ease;
}
.mood-hungry .ear-left { transform: translateY(4px) rotate(-35deg); }
.mood-hungry .ear-right { transform: translateY(4px) rotate(35deg); }

/* hungry：整体蔫蔫地下沉一点（位移放在无动画的 wrapper 上，不干扰 idle-bob） */
.dog-wrapper {
  transition: transform 0.3s ease;
}
.mood-hungry .dog-wrapper {
  transform: translateY(4px);
}

/* hungry 提示符号「…」 */
.hungry-hint {
  fill: #b0a89e;
  font-size: 20px;
  font-weight: 600;
}

/* happy：微笑线条隐藏，显示微微张开的嘴 */
.mouth-open {
  fill: #4a3423;
  opacity: 0;
  transition: opacity 0.2s;
}
.mood-happy .mouth { opacity: 0; }
.mood-happy .mouth-open { opacity: 1; }

/* sad：嘴巴向下弯（原微笑线条绕自身中心垂直翻转） */
.mouth {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.3s ease;
}
.mood-sad .mouth { transform: scaleY(-1); }

/* 抚摸动画：左右摇晃 */
.is-petted .dog-svg {
  animation: wiggle 0.9s ease;
}
@keyframes wiggle {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-7deg) translateY(-4px); }
  50% { transform: rotate(7deg) translateY(-4px); }
  75% { transform: rotate(-5deg); }
}
</style>
