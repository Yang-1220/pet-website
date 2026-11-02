require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// 读取狗狗状态（pet_stats 表固定只有一行，id = 1）
async function readStats() {
  const [rows] = await pool.query(
    'SELECT hunger, happiness, intimacy FROM pet_stats WHERE id = 1'
  );
  return rows[0] || null;
}

// 记录一次状态快照到 pet_stats_log（喂食/抚摸/遛狗后调用，供周报折线图使用）
async function logStats() {
  const stats = await readStats();
  await pool.query(
    'INSERT INTO pet_stats_log (hunger, happiness, intimacy) VALUES (?, ?, ?)',
    [stats.hunger, stats.happiness, stats.intimacy]
  );
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 获取狗狗状态
app.get('/api/pet/stats', async (req, res) => {
  try {
    const stats = await readStats();
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
app.post('/api/pet/feed', async (req, res) => {
  try {
    await pool.query(
      'UPDATE pet_stats SET hunger = LEAST(?, hunger + ?) WHERE id = 1',
      [MAX_VALUE, FEED_HUNGER]
    );
    await logStats();
    res.json(await readStats());
  } catch (err) {
    console.error('喂食失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 抚摸：愉悦度 +8，亲密度 +5（不超过 100）
app.post('/api/pet/pet', async (req, res) => {
  try {
    await pool.query(
      'UPDATE pet_stats SET happiness = LEAST(?, happiness + ?), intimacy = LEAST(?, intimacy + ?) WHERE id = 1',
      [MAX_VALUE, PET_HAPPINESS, MAX_VALUE, PET_INTIMACY]
    );
    await logStats();
    res.json(await readStats());
  } catch (err) {
    console.error('抚摸失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 遛狗：3 秒散步后随机彩蛋事件（三种结果概率均等）
// - 捡到骨头：愉悦度 +1
// - 交到新朋友：亲密度 +10
// - 什么也没发生
app.post('/api/pet/walk', async (req, res) => {
  try {
    const roll = Math.floor(Math.random() * 3);
    let outcome = 'nothing';
    let message = '今天很安静';

    if (roll === 0) {
      outcome = 'bone';
      message = '汪汪！捡到了一块骨头，愉悦度 +1';
      await pool.query(
        'UPDATE pet_stats SET happiness = LEAST(?, happiness + ?) WHERE id = 1',
        [MAX_VALUE, WALK_BONE_HAPPINESS]
      );
      await logStats();
    } else if (roll === 1) {
      outcome = 'friend';
      message = '汪汪！交到了一只新朋友，亲密度 +10';
      await pool.query(
        'UPDATE pet_stats SET intimacy = LEAST(?, intimacy + ?) WHERE id = 1',
        [MAX_VALUE, WALK_FRIEND_INTIMACY]
      );
      await logStats();
    }

    res.json({ outcome, message, ...(await readStats()) });
  } catch (err) {
    console.error('遛狗失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

// 获取最近 7 天状态趋势（每天取 created_at 最后一条快照的值，即"每日收盘值"，缺数据的天返回 null）
app.get('/api/pet/weekly', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(l.created_at, '%Y-%m-%d') AS day,
              l.hunger, l.happiness, l.intimacy
       FROM pet_stats_log l
       JOIN (
         SELECT MAX(id) AS id
         FROM pet_stats_log
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(created_at)
       ) m ON l.id = m.id`
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

// 获取狗狗名字（未取名时返回默认名）
app.get('/api/pet/name', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name FROM pet_info WHERE id = 1');
    res.json({ name: rows[0] ? rows[0].name : DEFAULT_NAME });
  } catch (err) {
    console.error('查询名字失败:', err.message);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 给狗狗取名/改名（保存到 pet_info 表，持久生效）
app.post('/api/pet/name', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) {
      return res.status(400).json({ error: '名字不能为空' });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `名字最多 ${MAX_NAME_LENGTH} 个字` });
    }
    await pool.query(
      'INSERT INTO pet_info (id, name) VALUES (1, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [name]
    );
    res.json({ name });
  } catch (err) {
    console.error('取名失败:', err.message);
    res.status(500).json({ error: '数据库更新失败' });
  }
});

app.listen(PORT, () => {
  console.log(`🐶 后端服务已启动: http://localhost:${PORT}`);
  console.log(`   数据库: ${process.env.DB_NAME || 'pet_db'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
});
