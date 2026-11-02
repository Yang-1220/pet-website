<template>
  <div class="page">
    <header class="page-header">
      <h1>🐶 狗狗养成乐园</h1>
      <p class="subtitle">照顾好你的小狗伙伴吧！</p>
      <div class="weather-bar">
        <span class="weather-icon">{{ weather.icon }}</span>
        <span class="weather-label">{{ weather.label }}</span>
        <span v-if="weather.temperature !== null && weather.temperature !== undefined" class="weather-temp">
          {{ Math.round(weather.temperature) }}°C
        </span>
        <span class="weather-city">· {{ weather.city }}</span>
      </div>
      <div class="name-bar">
        <span class="dog-name">🐕 狗狗名字：<b>{{ dogName }}</b></span>
        <input
          v-model="nameInput"
          class="name-input"
          maxlength="12"
          placeholder="给狗狗起个名字"
          @keyup.enter="handleRename"
        />
        <button class="name-btn" :disabled="busy" @click="handleRename">取名</button>
      </div>
    </header>

    <div v-if="errorMsg" class="alert">⚠️ {{ errorMsg }}</div>

    <div class="layout">
      <!-- 周报统计面板（左侧） -->
      <aside class="weekly-panel">
        <WeeklyPanel :data="weekly" />
        <DiaryPanel
          :data="diary"
          :busy="diaryBusy"
          @prev="diaryPrev"
          @next="diaryNext"
          @generate="diaryGenerate"
        />
      </aside>

      <main class="pet-card">
      <!-- 漂浮表情动画层 -->
      <div class="float-layer">
        <span
          v-for="f in floats"
          :key="f.id"
          class="float-emoji"
          :style="{ left: f.x + '%', animationDelay: f.delay + 'ms' }"
        >{{ f.emoji }}</span>
      </div>

      <!-- 狗狗形象 + 气泡对话框 -->
      <div class="dog-area">
        <transition name="bubble">
          <div v-if="bubbleVisible" class="bubble">{{ bubbleText }}</div>
        </transition>
        <DogStage :action="dogAction" :mood="mood" />
      </div>

      <!-- 狗狗心情留言 -->
      <div class="mood-box">
        <span class="mood-avatar">🐶</span>
        <div class="mood-text">{{ moodLine }}</div>
      </div>

      <!-- 三项状态指标 -->
      <section class="status-list">
        <StatusBar
          icon="🍖"
          label="饱食度"
          :value="stats.hunger"
          color="linear-gradient(90deg,#ffb347,#ff7e3f)"
        />
        <StatusBar
          icon="😊"
          label="愉悦度"
          :value="stats.happiness"
          color="linear-gradient(90deg,#ffd86b,#ff8fab)"
        />
        <StatusBar
          icon="❤️"
          label="亲密度"
          :value="stats.intimacy"
          color="linear-gradient(90deg,#ff9a9e,#f6416c)"
        />
      </section>

      <!-- 互动按钮 -->
      <section class="actions">
        <button class="btn btn-feed" :disabled="busy || walking" @click="handleFeed">🍖 喂食</button>
        <button class="btn btn-pet" :disabled="busy || walking" @click="handlePet">🤚 抚摸</button>
      </section>
      <section class="actions">
        <button class="btn btn-walk" :disabled="busy || walking" @click="handleWalk">🦮 带狗狗散步</button>
      </section>
      </main>
    </div>

    <footer class="page-footer">状态数据保存在 MySQL · pet_db.pet_stats</footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import DogStage from './components/DogStage.vue';
import StatusBar from './components/StatusBar.vue';
import WeeklyPanel from './components/WeeklyPanel.vue';
import { getStats, feedDog, petDog, walkDog, getWeekly, getDogName, renameDog, getWeather, getDiary, createDiary } from './api/pet';
import DiaryPanel from './components/DiaryPanel.vue';

const stats = reactive({ hunger: 0, happiness: 0, intimacy: 0 });
const busy = ref(false);        // 防止连点
const walking = ref(false);     // 遛狗进行中
const errorMsg = ref('');
const dogAction = ref('');      // '' | 'feed' | 'pet'，驱动狗狗动画
const floats = ref([]);         // 漂浮的表情
const bubbleVisible = ref(false); // 气泡对话框
const bubbleText = ref('');
const weekly = ref([]);           // 最近 7 天趋势数据（狗狗周报）
const dogName = ref('小狗狗');    // 狗狗名字（未取名时为默认名）
const nameInput = ref('');        // 取名输入框
const weather = ref({ icon: '☁️', label: '阴天', temperature: null, city: '重庆' }); // 当前天气
const diary = ref({ page: 1, pageSize: 3, total: 0, items: [] }); // 狗狗日记（分页）
const diaryBusy = ref(false);      // 正在写日记
let floatId = 0;
let bubbleTimer = null;
let feedAnimTimer = null;
let refreshTimer = null;

function spawnFloat(emoji, count = 1) {
  for (let i = 0; i < count; i++) {
    const id = ++floatId;
    floats.value.push({
      id,
      emoji,
      x: 25 + Math.random() * 50,
      delay: Math.random() * 200
    });
    setTimeout(() => {
      floats.value = floats.value.filter((f) => f.id !== id);
    }, 1600);
  }
}

// 显示气泡对话框；duration 为 0 时不自动消失（用于"散步中……"等持续提示）
function showBubble(text, duration = 3000) {
  bubbleText.value = text;
  bubbleVisible.value = true;
  clearTimeout(bubbleTimer);
  if (duration > 0) {
    bubbleTimer = setTimeout(() => (bubbleVisible.value = false), duration);
  }
}

// 加载最近 7 天趋势数据（狗狗周报）；失败时静默，不影响主功能
async function loadWeekly() {
  try {
    weekly.value = await getWeekly();
  } catch (err) {
    console.error('周报加载失败:', err);
  }
}

function applyStats(data) {
  stats.hunger = data.hunger;
  stats.happiness = data.happiness;
  stats.intimacy = data.intimacy;
}

// 狗狗表情心情：优先级 hungry（饿）> sad（难过）> happy（开心）> normal
const mood = computed(() => {
  if (stats.hunger < 30) return 'hungry';
  if (stats.happiness < 30) return 'sad';
  if (stats.hunger >= 70 && stats.happiness >= 70) return 'happy';
  return 'normal';
});

// ===== 狗狗心情留言 =====
// 根据饱食度/愉悦度挑选场景，每个场景随机轮换一句话；数值变化时自动更新
const MOOD_LINES = {
  hungerHigh: ['吃得好饱，开心！', '肚子圆滚滚的，好满足～', '汪！这顿饭太香啦！'],
  happyHigh: ['今天好开心呀！', '和你在一起最快乐了！', '汪汪～心情超级好！'],
  normal: ['主人，我想出去散步', '好想出去玩呀～', '汪！今天有什么安排吗？'],
  low: ['有点饿，也有点无聊', '肚子咕咕叫了……', '好无聊哦，陪我玩玩嘛']
};

const moodLine = computed(() => {
  let key;
  if (stats.hunger >= 80) key = 'hungerHigh';
  else if (stats.happiness >= 80) key = 'happyHigh';
  else if (stats.hunger < 30 && stats.happiness < 30) key = 'low';
  else key = 'normal';
  const lines = MOOD_LINES[key];
  return lines[Math.floor(Math.random() * lines.length)];
});

// 加载狗狗名字（未取名时后端返回默认名「小狗狗」）
async function loadName() {
  try {
    dogName.value = (await getDogName()).name;
  } catch (err) {
    console.error('名字加载失败:', err);
  }
}

// 加载当前天气（后端已缓存 30 分钟，前端轮询开销很小）；失败时保留上一次的值
async function loadWeather() {
  try {
    weather.value = await getWeather();
  } catch (err) {
    console.error('天气加载失败:', err);
  }
}

// ===== 狗狗日记 =====
async function loadDiary(page = diary.value.page) {
  try {
    diary.value = await getDiary(page);
  } catch (err) {
    console.error('日记加载失败:', err);
  }
}

function diaryPrev() {
  if (diary.value.page > 1) loadDiary(diary.value.page - 1);
}

function diaryNext() {
  const maxPage = Math.max(1, Math.ceil(diary.value.total / (diary.value.pageSize || 3)));
  if (diary.value.page < maxPage) loadDiary(diary.value.page + 1);
}

// 让狗狗写今天的日记（重复点会覆盖当天那条，不会产生重复）
async function diaryGenerate() {
  if (diaryBusy.value) return;
  diaryBusy.value = true;
  try {
    await createDiary();
    await loadDiary(1);
    showBubble('汪！日记写完啦～');
  } catch (err) {
    console.error('写日记失败:', err);
    errorMsg.value = '写日记失败，请确认后端已启动';
  } finally {
    diaryBusy.value = false;
  }
}

// 给狗狗取名/改名，保存到数据库持久生效
async function handleRename() {
  const name = nameInput.value.trim();
  if (!name) {
    errorMsg.value = '请先输入狗狗的名字';
    return;
  }
  busy.value = true;
  errorMsg.value = '';
  try {
    const data = await renameDog(name);
    dogName.value = data.name;
    nameInput.value = '';
    showBubble(`汪！我以后就叫「${data.name}」啦！`);
  } catch (err) {
    fail(err);
  } finally {
    busy.value = false;
  }
}

function fail(err) {
  console.error(err);
  errorMsg.value = '无法连接服务器，请确认后端已启动且已执行 database/init.sql 初始化数据库';
}

// 喂食：饱食度 +10
async function handleFeed() {
  busy.value = true;
  errorMsg.value = '';
  try {
    applyStats(await feedDog());
    // 眨眼动画约 1.8 秒后恢复（先复位再重绘，保证连续点击时动画能重新触发）
    dogAction.value = '';
    nextTick(() => (dogAction.value = 'feed'));
    clearTimeout(feedAnimTimer);
    feedAnimTimer = setTimeout(() => (dogAction.value = ''), 1800);
    spawnFloat('🍖', 2);
    showBubble('汪汪！谢谢主人！');
    loadWeekly();
  } catch (err) {
    fail(err);
  } finally {
    busy.value = false;
  }
}

// 抚摸：愉悦度 +8，亲密度 +5
async function handlePet() {
  busy.value = true;
  errorMsg.value = '';
  try {
    applyStats(await petDog());
    dogAction.value = 'pet';
    spawnFloat('💗', 3);
    setTimeout(() => (dogAction.value = ''), 900);
    loadWeekly();
  } catch (err) {
    fail(err);
  } finally {
    busy.value = false;
  }
}

// 遛狗：显示"散步中……"约 3 秒，回来后弹出随机彩蛋结果
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleWalk() {
  walking.value = true;
  errorMsg.value = '';
  showBubble('散步中……', 0); // 持续显示直到散步结束
  try {
    await delay(3000);
    const data = await walkDog();
    applyStats(data);
    showBubble(data.message); // 彩蛋结果弹出，约 3 秒后自动消失
    loadWeekly();
  } catch (err) {
    bubbleVisible.value = false; // 失败时收起"散步中……"，避免卡住
    fail(err);
  } finally {
    walking.value = false;
  }
}

// 自动刷新：每 5 秒拉取最新状态与周报，更新状态条和折线图
async function refreshAll() {
  loadWeekly();
  loadWeather();
  try {
    applyStats(await getStats());
    errorMsg.value = ''; // 恢复连接后自动清除错误提示
  } catch (err) {
    fail(err);
  }
}

onMounted(() => {
  refreshAll();
  loadName();
  loadWeather();
  loadDiary(1);
  refreshTimer = setInterval(refreshAll, 5000);
});

// 组件卸载 / 页面关闭时清除定时器
onUnmounted(() => {
  clearInterval(refreshTimer);
});

</script>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 16px 40px;
  text-align: center;
}

.page-header h1 {
  font-size: 28px;
  letter-spacing: 1px;
}

.subtitle {
  margin-top: 6px;
  color: #9b8271;
  font-size: 14px;
}

/* 天气条 */
.weather-bar {
  margin: 10px auto 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid #f2e2cd;
  font-size: 13px;
  color: #7a5c43;
  box-shadow: 0 2px 8px rgba(214, 175, 130, 0.15);
}

.weather-icon {
  font-size: 16px;
  line-height: 1;
}

.weather-label {
  font-weight: 600;
}

.weather-temp {
  color: #d97b29;
  font-weight: 600;
}

.weather-city {
  color: #a8927e;
}

/* 取名栏 */
.name-bar {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dog-name {
  font-size: 14px;
  color: #6b5140;
}

.dog-name b {
  color: #d97b29;
}

.name-input {
  width: 150px;
  padding: 8px 14px;
  border: 1.5px solid #f0d9bd;
  border-radius: 999px;
  font-size: 14px;
  color: #5b4636;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}

.name-input:focus {
  border-color: #f7b055;
}

.name-btn {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #9ad0f5, #5b8def);
  box-shadow: 0 4px 10px rgba(91, 141, 239, 0.3);
  transition: transform 0.15s ease, opacity 0.15s;
}

.name-btn:active {
  transform: scale(0.95);
}

.name-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  margin: 16px 0 0;
  padding: 10px 14px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 10px;
  color: #cf1322;
  font-size: 13px;
  text-align: left;
}

.layout {
  margin-top: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
}

.weekly-panel {
  width: 330px;
  flex-shrink: 0;
}

.pet-card {
  position: relative;
  flex: 1;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 24px;
  padding: 24px 20px;
  box-shadow: 0 12px 32px rgba(214, 143, 74, 0.18);
  backdrop-filter: blur(6px);
}

/* 窄屏时上下堆叠，主卡片在上、周报面板在下 */
@media (max-width: 900px) {
  .layout {
    flex-direction: column-reverse;
    align-items: center;
  }

  .weekly-panel,
  .pet-card {
    width: 100%;
  }
}

.float-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.float-emoji {
  position: absolute;
  bottom: 42%;
  font-size: 28px;
  opacity: 0;
  animation: float-up 1.4s ease-out forwards;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(-130px) scale(1.25);
    opacity: 0;
  }
}

.dog-area {
  position: relative;
  display: flex;
  justify-content: center;
}

.bubble {
  position: absolute;
  top: 4px;
  right: 2%;
  z-index: 2;
  padding: 10px 14px;
  background: #fff;
  border: 2px solid #f7b055;
  border-radius: 16px;
  color: #b05e1f;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(214, 143, 74, 0.25);
}

/* 气泡小尾巴 */
.bubble::before {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 26px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-right: 2px solid #f7b055;
  border-bottom: 2px solid #f7b055;
  transform: rotate(45deg);
}

/* 气泡出现 / 消失过渡 */
.bubble-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bubble-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}

.status-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

/* 狗狗心情留言（对话框样式） */
.mood-box {
  margin-top: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
}

.mood-avatar {
  font-size: 22px;
  line-height: 1.4;
}

.mood-text {
  position: relative;
  background: #fdf3e7;
  border: 1.5px solid #f3ddc4;
  border-radius: 14px;
  padding: 9px 13px;
  font-size: 14px;
  color: #8a6f5c;
}

/* 气泡左侧小尾巴 */
.mood-text::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 12px;
  width: 10px;
  height: 10px;
  background: #fdf3e7;
  border-left: 1.5px solid #f3ddc4;
  border-bottom: 1.5px solid #f3ddc4;
  transform: rotate(45deg);
}

.actions {
  margin-top: 24px;
  display: flex;
  gap: 14px;
  justify-content: center;
}

.btn {
  flex: 1;
  max-width: 160px;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: #fff;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s;
}

.btn:active {
  transform: scale(0.95);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-feed {
  background: linear-gradient(135deg, #ffb347, #ff7e3f);
  box-shadow: 0 6px 14px rgba(255, 126, 63, 0.35);
}

.btn-pet {
  background: linear-gradient(135deg, #ff8fab, #f6416c);
  box-shadow: 0 6px 14px rgba(246, 65, 108, 0.3);
}

.btn-walk {
  max-width: 260px;
  background: linear-gradient(135deg, #7ed886, #38a169);
  box-shadow: 0 6px 14px rgba(56, 161, 105, 0.3);
}

.page-footer {
  margin-top: 18px;
  font-size: 12px;
  color: #b59a86;
}
</style>
