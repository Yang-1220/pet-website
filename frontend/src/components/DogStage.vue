<template>
  <div class="dog-wrapper" :class="{ 'is-eating': action === 'feed', 'is-petted': action === 'pet' }">
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
      <!-- 耳朵 -->
      <path class="ear" d="M76 56 L 64 16 L 102 36 Z" />
      <path class="ear" d="M144 56 L 156 16 L 118 36 Z" />
      <path class="ear-inner" d="M78 48 L 72 26 L 92 37 Z" />
      <path class="ear-inner" d="M142 48 L 148 26 L 128 37 Z" />
      <!-- 眉毛斑点 -->
      <ellipse class="cream" cx="92" cy="64" rx="9" ry="5" />
      <ellipse class="cream" cx="128" cy="64" rx="9" ry="5" />
      <!-- 眼睛 -->
      <circle class="eye" cx="92" cy="76" r="5.5" />
      <circle class="eye" cx="128" cy="76" r="5.5" />
      <!-- 腮红 -->
      <circle class="cheek" cx="78" cy="90" r="6.5" />
      <circle class="cheek" cx="142" cy="90" r="6.5" />
      <!-- 口鼻 -->
      <ellipse class="muzzle" cx="110" cy="96" rx="24" ry="17" />
      <ellipse class="nose" cx="110" cy="90" rx="7" ry="5.5" />
      <path class="mouth" d="M100 99 Q 105 106 110 100 Q 115 106 120 99" />
      <!-- 舌头（被抚摸时吐出来） -->
      <path class="tongue" :class="{ show: action === 'pet' }" d="M106 104 Q 110 114 114 104 Z" />
    </svg>
  </div>
</template>

<script setup>
defineProps({
  action: { type: String, default: '' }
});
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
