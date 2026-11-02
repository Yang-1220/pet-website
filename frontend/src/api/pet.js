import axios from 'axios';

const api = axios.create({
  baseURL: '/api/pet',
  timeout: 5000
});

const authApi = axios.create({
  baseURL: '/api/auth',
  timeout: 5000
});

const TOKEN_KEY = 'pet_token';

// 登录 token 存取（localStorage 持久保存，刷新页面不丢）
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// 请求拦截器：自动附带 Authorization: Bearer <token>
function attachToken(config) {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

api.interceptors.request.use(attachToken);
authApi.interceptors.request.use(attachToken);

// 响应拦截器：登录失效（401）时清除本地 token 并通知页面切回登录视图
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      setToken('');
      window.dispatchEvent(new CustomEvent('pet:unauthorized'));
    }
    return Promise.reject(err);
  }
);

// ===== 认证接口 =====

// 注册（自动登录，返回 { token, username, dogName }）
export function registerUser(username, password) {
  return authApi.post('/register', { username, password }).then((res) => res.data);
}

// 登录（返回 { token, username, dogName }）
export function loginUser(username, password) {
  return authApi.post('/login', { username, password }).then((res) => res.data);
}

// 退出登录（后端销毁会话）
export function logoutUser() {
  return authApi.post('/logout').then((res) => res.data);
}

// 恢复登录态：用本地 token 换取当前用户信息
export function fetchMe() {
  return authApi.get('/me').then((res) => res.data);
}

// ===== 狗狗数据接口（均需登录，后端按用户隔离） =====

// 获取狗狗状态 { hunger, happiness, intimacy }
export function getStats() {
  return api.get('/stats').then((res) => res.data);
}

// 喂食：饱食度 +10
export function feedDog() {
  return api.post('/feed').then((res) => res.data);
}

// 抚摸：愉悦度涨幅随天气变化，亲密度 +5
export function petDog() {
  return api.post('/pet').then((res) => res.data);
}

// 遛狗：随机彩蛋事件（捡到骨头 +1 愉悦 / 交到新朋友 +10 亲密 / 无事发生）
export function walkDog() {
  return api.post('/walk').then((res) => res.data);
}

// 获取最近 7 天状态趋势（狗狗周报）
export function getWeekly() {
  return api.get('/weekly').then((res) => res.data);
}

// 获取狗狗名字（未取名时返回默认名「小狗狗」）
export function getDogName() {
  return api.get('/name').then((res) => res.data);
}

// 给狗狗取名/改名
export function renameDog(name) {
  return api.post('/name', { name }).then((res) => res.data);
}

// 获取当前天气（公开接口，后端内存缓存 30 分钟，失败降级为阴天）
export function getWeather() {
  return api.get('/weather').then((res) => res.data);
}

// 获取狗狗日记（分页）
export function getDiary(page = 1) {
  return api.get('/diary', { params: { page } }).then((res) => res.data);
}

// 写今天的日记（重复点会覆盖当天那条）
export function createDiary() {
  return api.post('/diary').then((res) => res.data);
}
