import axios from 'axios';

const api = axios.create({
  baseURL: '/api/pet',
  timeout: 5000
});

// 获取狗狗状态 { hunger, happiness, intimacy }
export function getStats() {
  return api.get('/stats').then((res) => res.data);
}

// 喂食：饱食度 +10
export function feedDog() {
  return api.post('/feed').then((res) => res.data);
}

// 抚摸：愉悦度 +8，亲密度 +5
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
