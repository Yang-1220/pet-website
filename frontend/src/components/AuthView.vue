<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1 class="auth-title">🐶 狗狗养成乐园</h1>
      <p class="auth-subtitle">{{ mode === 'login' ? '登录后照顾你的小狗伙伴' : '注册一个账号，领养你的小狗' }}</p>

      <!-- 登录 / 注册切换 -->
      <div class="auth-tabs">
        <button
          class="auth-tab"
          :class="{ active: mode === 'login' }"
          @click="switchMode('login')"
        >登录</button>
        <button
          class="auth-tab"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >注册</button>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <input
          v-model.trim="username"
          class="auth-input"
          type="text"
          autocomplete="username"
          placeholder="用户名（2-16 个字符）"
        />
        <input
          v-model="password"
          class="auth-input"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="密码（至少 6 位）"
        />
        <button class="auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '请稍候……' : mode === 'login' ? '登录' : '注册并领养' }}
        </button>
      </form>

      <p v-if="authError" class="auth-error">⚠️ {{ authError }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { loginUser, registerUser } from '../api/pet';

// 登录成功后通知父组件（App.vue）进入主界面
const emit = defineEmits(['logged-in']);

const mode = ref('login');       // 'login' | 'register'
const username = ref('');
const password = ref('');
const submitting = ref(false);
const authError = ref('');

function switchMode(next) {
  mode.value = next;
  authError.value = '';
}

async function handleSubmit() {
  if (submitting.value) return;
  const name = username.value.trim();
  const pass = password.value;
  if (!name || !pass) {
    authError.value = '请输入用户名和密码';
    return;
  }
  submitting.value = true;
  authError.value = '';
  try {
    const data =
      mode.value === 'login'
        ? await loginUser(name, pass)
        : await registerUser(name, pass);
    emit('logged-in', data);
  } catch (err) {
    authError.value =
      (err.response && err.response.data && err.response.data.error) ||
      '连接服务器失败，请确认后端已启动';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-card {
  width: 100%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 24px;
  padding: 32px 28px;
  box-shadow: 0 12px 32px rgba(214, 143, 74, 0.18);
  text-align: center;
}

.auth-title {
  font-size: 24px;
  letter-spacing: 1px;
}

.auth-subtitle {
  margin-top: 6px;
  color: #9b8271;
  font-size: 13px;
}

.auth-tabs {
  margin-top: 18px;
  display: flex;
  gap: 8px;
  background: #f7efe3;
  border-radius: 999px;
  padding: 4px;
}

.auth-tab {
  flex: 1;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #9b8271;
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-tab.active {
  background: #fff;
  color: #d97b29;
  box-shadow: 0 2px 6px rgba(214, 143, 74, 0.2);
}

.auth-form {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.auth-input {
  padding: 11px 16px;
  border: 1.5px solid #f0d9bd;
  border-radius: 999px;
  font-size: 14px;
  color: #5b4636;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}

.auth-input:focus {
  border-color: #f7b055;
}

.auth-submit {
  margin-top: 4px;
  padding: 12px 0;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #ffb347, #ff7e3f);
  box-shadow: 0 6px 14px rgba(255, 126, 63, 0.35);
  transition: transform 0.15s ease, opacity 0.15s;
}

.auth-submit:active {
  transform: scale(0.97);
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-error {
  margin-top: 12px;
  font-size: 13px;
  color: #cf1322;
  text-align: left;
}
</style>
