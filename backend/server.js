require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 互动数值配置
const MAX_VALUE = 100;    // 指标上限
const FEED_HUNGER = 10; // 每次喂食增加的饱食度
const PET_HAPPINESS = 8;  // 每次抚摸增加的愉悦度
const PET_INTIMACY = 5;   // 每次抚摸增加的亲密度
const WALK_BONE_HAPPINESS = 1;   // 遛狗彩蛋：捡到骨头增加的愉悦度
const WALK_FRIEND_INTIMACY = 10; // 遛狗彩蛋：交到新朋友增加的亲密度
const DEFAULT_NAME = '小狗狗';   // 未取名时显示的默认名字
const MAX_NAME_LENGTH = 12;      // 名字最大长度
const DECAY_INTERVAL_MS = 60 * 1000; // 状态自然衰减周期：60 秒

// ===== 天气接入（Open-Meteo 免注册接口，重庆坐标） =====
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=29.56&longitude=106.55&current=temperature_2m,weather_code';
const WEATHER_CACHE_MS = 30 * 60 * 1000; // 天气内存缓存：30 分钟
const PET_HAPPINESS_BY_WEATHER = { sunny: 12, cloudy: 8, rain: 4 }; // 天气对抚摸愉悦度的加成
const RAIN_EXTRA_INTIMACY = 2; // 雨天抚摸亲密度额外加成

// WMO 天气代码 → 分类 / 文案 / 图标
const WEATHER_CODE_MAP = [
  { min: 0, max: 1, category: 'sunny', label: '晴', icon: '☀️' },
  { min: 2, max: 3, category: 'cloudy', label: '阴', icon: '☁️' },
  { min: 45, max: 48, category: 'cloudy', label: '雾', icon: '🌫️' },
  { min: 51, max: 67, category: 'rain', label: '雨', icon: '🌧️' },
  { min: 71, max: 77, category: 'rain', label: '雪', icon: '❄️' },
  { min: 80, max: 82, category: 'rain', label: '阵雨', icon: '🌧️' },
  { min: 95, max: 99, category: 'rain', label: '雷雨', icon: '⛈️' }
];

// 接口失败时的降级天气：阴天（雪天按雨天处理，同样算坏天气）
const WEATHER_FALLBACK = { category: 'cloudy', label: '阴', icon: '☁️', temperature: null, city: '重庆', fallback: true };

let weatherCache = null; // { data, fetchedAt }

function classifyWeather(code) {
  return (
    WEATHER_CODE_MAP.find((r) => code >= r.min && code <= r.max) || {
      category: 'cloudy', label: '阴', icon: '☁️'
    }
  );
}

async function fetchWeather() {
  try {
    const resp = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const cur = data.current || {};
    const { category, label, icon } = classifyWeather(cur.weather_code ?? 3);
    const weather = {
      category,
      label,
      icon,
      temperature: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null,
      city: '重庆',
      fallback: false
    };
    weatherCache = { data: weather, fetchedAt: Date.now() };
    return weather;
  } catch (err) {
    console.error('获取天气失败，降级为阴天:', err.message);
    return WEATHER_FALLBACK; // 不写缓存，下次请求会重试
  }
}

// 优先读 30 分钟内存缓存，过期才请求 Open-Meteo
async function getWeather() {
  if (weatherCache && Date.now() - weatherCache.fetchedAt < WEATHER_CACHE_MS) {
    return weatherCache.data;
  }
  return fetchWeather();
}

// 当前天气：后端内存缓存 30 分钟，任何异常都降级为阴天，保证前端永远拿得到数据
app.get('/api/pet/weather', async (req, res) => {
  try {
    res.json(await getWeather());
  } catch (err) {
    console.error('天气接口异常:', err.message);
    res.json(WEATHER_FALLBACK);
  }
});

// ===== 用户认证（注册 / 登录 / 会话 token） =====
const MIN_USERNAME_LENGTH = 2;
const MAX_USERNAME_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 6;
const SCRYPT_KEYLEN = 64; // scrypt 摘要长度（字节）

// 生成密码摘要（Node 内置 crypto 的 scrypt + 每用户独立随机盐，无需第三方库）
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
}

// 创建一条会话记录，返回随机 token
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId]);
  return token;
}

// 认证中间件：校验 Authorization: Bearer <token>，通过后挂上 req.user
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?',
      [token]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    console.error('身份验证失败:', err.message);
    res.status(500).json({ error: '身份验证失败' });
  }
}

// 注册：创建用户并为其播种一份初始狗狗数据（饱食度 80 / 愉悦度 80 / 亲密度 50）
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      return res.status(400).json({ error: `用户名需要 ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} 个字符` });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` });
    }
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length > 0) {
      return res.status(409).json({ error: '用户名已被注册' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)',
      [username, passwordHash, salt]
    );
    const userId = result.insertId;
    // 为新用户播种狗狗初始数据（状态 + 默认名字）
    await pool.query(
      'INSERT INTO pet_stats (user_id, hunger, happiness, intimacy) VALUES (?, ?, ?, ?)',
      [userId, 80, 80, 50]
    );
    await pool.query(
      'INSERT INTO pet_info (user_id, name) VALUES (?, ?)',
      [userId, DEFAULT_NAME]
    );
    const token = await createSession(userId);
    res.json({ token, username });
  } catch (err) {
    console.error('注册失败:', err.message);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 登录：校验用户名密码，签发新 token
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const [rows] = await pool.query('SELECT id, username, password_hash, salt FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const candidate = Buffer.from(hashPassword(password, user.salt), 'hex');
    const stored = Buffer.from(user.password_hash, 'hex');
    if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = await createSession(user.id);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('登录失败:', err.message);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 退出登录：删除当前 token 对应的会话
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token = ?', [req.headers.authorization.slice(7).trim()]);
    res.json({ ok: true });
  } catch (err) {
    console.error('退出失败:', err.message);
    res.status(500).json({ error: '退出失败' });
  }
});

// 当前登录用户信息（用于页面刷新后恢复登录态）
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});

// 读取狗狗状态（每个用户一条 pet_stats 记录，按 user_id 隔离）
async function readStats(userId) {
  const [rows] = await pool.query(
    'SELECT hunger, happiness, intimacy FROM pet_stats WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}

// 记录一次状态快照到 pet_stats_log（喂食/抚摸/遛狗后调用，供周报折线图使用）
async function logStats(userId) {
  const stats = await readStats(userId);
  if (!stats) return;
  await pool.query(
    'INSERT INTO pet_stats_log (user_id, hunger, happiness, intimacy) VALUES (?, ?, ?, ?)',
    [userId, stats.hunger, stats.happiness, stats.intimacy]
  );
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 获取狗狗状态（需登录，只返回当前用户的狗狗数据）
app.get('/api/pet/stats', requireAuth, async (req, res) => {
  try {
    const stats = await readStats(req.user.id);
    if (!stats) {
      return res.status(404).json({ error: '未找到狗狗状态数据，请先执行 database/init.sql 初始化数据库' });
    }
    res.json(stats);
  } catch (err) {
    console.error('查询状态失败:', err.message);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 喂食：饱食度 +10（不超过 100）
app.post('/api/pet/feed', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE pet_stats SET hunger = LEAST(?, hunger + ?) WHERE user_id = ?',
      [MAX_VALUE, FEED_HUNGER, req.user.id]
    );
    await logStats(req.user.id);
    res.json(await readStats(req.user.id));
  } catch (err) {
    console.error('喂食失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 抚摸：愉悦度/亲密度涨幅随天气变化（晴天 +12、阴天 +8、雨天 +4 且亲密度额外 +2）
app.post('/api/pet/pet', requireAuth, async (req, res) => {
  try {
    const weather = await getWeather();
    const happinessGain = PET_HAPPINESS_BY_WEATHER[weather.category] ?? PET_HAPPINESS;
    const intimacyGain = PET_INTIMACY + (weather.category === 'rain' ? RAIN_EXTRA_INTIMACY : 0);
    await pool.query(
      'UPDATE pet_stats SET happiness = LEAST(?, happiness + ?), intimacy = LEAST(?, intimacy + ?) WHERE user_id = ?',
      [MAX_VALUE, happinessGain, MAX_VALUE, intimacyGain, req.user.id]
    );
    await logStats(req.user.id);
    res.json({
      ...(await readStats(req.user.id)),
      gains: { happiness: happinessGain, intimacy: intimacyGain },
      weather: weather.category
    });
  } catch (err) {
    console.error('抚摸失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 遛狗：3 秒散步后随机彩蛋事件（三种结果概率均等）
// - 捡到骨头：愉悦度 +1
// - 交到新朋友：亲密度 +10
// - 什么也没发生
app.post('/api/pet/walk', requireAuth, async (req, res) => {
  try {
    const roll = Math.floor(Math.random() * 3);
    let outcome = 'nothing';
    let message = '今天很安静';

    if (roll === 0) {
      outcome = 'bone';
      message = '汪汪！捡到了一块骨头，愉悦度 +1';
      await pool.query(
        'UPDATE pet_stats SET happiness = LEAST(?, happiness + ?) WHERE user_id = ?',
        [MAX_VALUE, WALK_BONE_HAPPINESS, req.user.id]
      );
      await logStats(req.user.id);
    } else if (roll === 1) {
      outcome = 'friend';
      message = '汪汪！交到了一只新朋友，亲密度 +10';
      await pool.query(
        'UPDATE pet_stats SET intimacy = LEAST(?, intimacy + ?) WHERE user_id = ?',
        [MAX_VALUE, WALK_FRIEND_INTIMACY, req.user.id]
      );
      await logStats(req.user.id);
    }

    res.json({ outcome, message, ...(await readStats(req.user.id)) });
  } catch (err) {
    console.error('遛狗失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 获取最近 7 天状态趋势（每天取 created_at 最后一条快照的值，即"每日收盘值"，缺数据的天返回 null；只统计当前用户）
app.get('/api/pet/weekly', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(l.created_at, '%Y-%m-%d') AS day,
              l.hunger, l.happiness, l.intimacy
       FROM pet_stats_log l
       JOIN (
         SELECT MAX(id) AS id
         FROM pet_stats_log
         WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(created_at)
       ) m ON l.id = m.id`,
      [req.user.id]
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const r = byDay.get(key);
      days.push({
        date: key,
        hunger: r ? Number(r.hunger) : null,
        happiness: r ? Number(r.happiness) : null,
        intimacy: r ? Number(r.intimacy) : null
      });
    }
    res.json(days);
  } catch (err) {
    console.error('查询周报失败:', err.message);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 获取狗狗名字（存于 pet_info 表，按用户隔离；未取名时返回默认名）
app.get('/api/pet/name', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM pet_info WHERE user_id = ?', [req.user.id]);
    res.json({ name: rows[0] && rows[0].name ? rows[0].name : DEFAULT_NAME });
  } catch (err) {
    console.error('查询名字失败:', err.message);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 给狗狗取名/改名（保存到 pet_info 表，按用户隔离，持久生效）
app.post('/api/pet/name', requireAuth, async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) {
      return res.status(400).json({ error: '名字不能为空' });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `名字最多 ${MAX_NAME_LENGTH} 个字` });
    }
    await pool.query(
      'INSERT INTO pet_info (user_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [req.user.id, name]
    );
    res.json({ name });
  } catch (err) {
    console.error('取名失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// ===== 狗狗日记 =====
// 每天一条，按当天的心情、天气、互动次数生成一段"狗狗自述"
const DIARY_TEMPLATES = {
  happy: [
    '今天吃了好多好吃的，主人还一直摸我，尾巴都要摇断了！',
    '主人今天特别宠我，心情好到想满地打滚～',
    '吃饱喝足还有人陪玩，我感觉自己是全世界最幸福的狗。'
  ],
  hungry: [
    '肚子咕咕叫了……主人是不是把我忘了？',
    '有点饿，也有点无聊，我趴在地上等开饭。',
    '想去厨房门口蹲着，可主人好像没看见我。'
  ],
  sad: [
    '今天有点低落，主人好像很忙，没怎么理我。',
    '没什么精神，趴在窗边看了一下午的云。',
    '有点想被摸摸头，可是不好意思开口。'
  ],
  normal: [
    '今天也是平平淡淡的一天，吃饱了就睡，睡醒了就等主人。',
    '家里很安静，我在客厅巡逻了两圈，没发现异常。',
    '普通的一天，但我把尾巴摇给主人看了三次。'
  ]
};

const WEATHER_DIARY_WORD = { sunny: '阳光很好', cloudy: '天有点阴', rain: '外面下着雨' };

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 生成（或覆盖）今天的日记（按用户隔离）
async function generateTodayDiary(userId) {
  const stats = await readStats(userId);
  if (!stats) throw new Error('还没有狗狗状态数据');

  const weather = await getWeather();

  // 今天的互动次数（每次喂食/抚摸/散步都会写一条快照，只统计当前用户）
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS c FROM pet_stats_log WHERE user_id = ? AND DATE(created_at) = CURDATE()',
    [userId]
  );
  const interactions = Number(countRows[0].c) || 0;

  // 狗狗名字（pet_info，按用户）
  const [nameRows] = await pool.query('SELECT name FROM pet_info WHERE user_id = ?', [userId]);
  const name = nameRows[0] && nameRows[0].name ? nameRows[0].name : DEFAULT_NAME;

  // 心情判定（与前端表情规则一致）
  let mood = 'normal';
  if (stats.hunger < 30) mood = 'hungry';
  else if (stats.happiness < 30) mood = 'sad';
  else if (stats.hunger >= 70 && stats.happiness >= 70) mood = 'happy';

  const weatherWord = WEATHER_DIARY_WORD[weather.category] || '天有点阴';
  const body = pickOne(DIARY_TEMPLATES[mood]);
  const content =
    `${weather.icon} ${weatherWord}，今天主人和我互动了 ${interactions} 次。` +
    `现在饱食度 ${stats.hunger}、愉悦度 ${stats.happiness}、亲密度 ${stats.intimacy}。${body}`;

  await pool.query(
    `INSERT INTO pet_diary (user_id, day, mood, weather, content)
     VALUES (?, CURDATE(), ?, ?, ?)
     ON DUPLICATE KEY UPDATE mood = VALUES(mood), weather = VALUES(weather), content = VALUES(content)`,
    [userId, mood, weather.category, content]
  );

  return { name, mood, weather: weather.category, interactions, content };
}

// 日记列表（分页，最新在前，只看自己的日记）
app.get('/api/pet/diary', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = 3;
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM pet_diary WHERE user_id = ?', [req.user.id]);
    const [rows] = await pool.query(
      `SELECT id, DATE_FORMAT(day, '%Y-%m-%d') AS day, mood, weather, content
       FROM pet_diary WHERE user_id = ? ORDER BY day DESC LIMIT ? OFFSET ?`,
      [req.user.id, pageSize, (page - 1) * pageSize]
    );
    res.json({ page, pageSize, total: Number(total), items: rows });
  } catch (err) {
    console.error('查询日记失败:', err.message);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 写今天的日记（重复调用会覆盖当天那条）
app.post('/api/pet/diary', requireAuth, async (req, res) => {
  try {
    const entry = await generateTodayDiary(req.user.id);
    res.json(entry);
  } catch (err) {
    console.error('写日记失败:', err.message);
    res.status(500).json({ error: '写日记失败' });
  }
});

// 状态自然衰减：每 60 秒 hunger、happiness 各 -1，最低到 0，intimacy 不衰减
// 全表更新：所有用户的狗狗同步衰减；不写入 pet_stats_log（自然衰减不算互动，不进周报快照）
setInterval(async () => {
  try {
    await pool.query(
      'UPDATE pet_stats SET hunger = GREATEST(0, hunger - 1), happiness = GREATEST(0, happiness - 1)'
    );
  } catch (err) {
    console.error('状态衰减失败:', err.message);
  }
}, DECAY_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`🐶 后端服务已启动: http://localhost:${PORT}`);
  console.log(`   数据库: ${process.env.DB_NAME || 'pet_db'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
});
