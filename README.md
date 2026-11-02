# 🐶 狗狗养成互动网页🔗 在线体验：https://ceramic-chains-bobby-horse.trycloudflare.com

一个简单有趣的狗狗养成互动项目：喂食、抚摸你的小狗，三项状态指标实时保存到 MySQL 数据库。

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vite + Axios |
| 后端 | Node.js + Express + mysql2（promise 接口） |
| 数据库 | MySQL（`pet_db` 库 · `pet_stats` 表） |

## 项目结构

```
pet-website/
├── frontend/                 # Vue3 前端
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js        # 开发代理: /api -> localhost:3000
│   └── src/
│       ├── main.js
│       ├── style.css
│       ├── App.vue           # 主页面（状态条 + 按钮 + 浮动动画）
│       ├── api/pet.js        # 接口封装
│       └── components/
│           ├── DogStage.vue    # 狗狗 SVG 形象（摇尾巴/眨眼/互动动画）
│           ├── StatusBar.vue   # 状态条组件
│           └── WeeklyPanel.vue # 狗狗周报折线图（纯 SVG，无图表库依赖）
├── backend/                  # Node.js + Express 后端
│   ├── .env                  # 数据库配置
│   ├── package.json
│   ├── db.js                 # mysql2 连接池
│   └── server.js             # API 接口
└── database/
    └── init.sql              # 建库建表脚本
```

## 环境要求

- Node.js >= 18
- MySQL >= 5.7（推荐 8.0）
- MySQL 连接信息见 `backend/.env`（默认 `root`，空密码，端口 `3306`）

## 第一步：初始化数据库

先启动 MySQL 服务，然后任选一种方式执行初始化脚本：

```bash
# 方式一：命令行导入（在项目根目录执行）
mysql -u root -p < database/init.sql
```

```sql
-- 方式二：在 MySQL 客户端（如 Navicat / Workbench）中直接执行 database/init.sql 的内容
```

脚本会创建 `pet_db` 库、`pet_stats` 表、`pet_stats_log` 状态快照表（记录每次互动，供周报折线图使用）、`pet_info` 表（保存狗狗名字），并插入初始数据（饱食度 80 / 愉悦度 80 / 亲密度 50，默认名字「小狗狗」）。脚本可重复执行，已存在的表不会被修改或重建。

## 第二步：启动后端

```bash
cd backend
npm install
npm start        # 或 npm run dev（文件修改后自动重启）
```

看到 `🐶 后端服务已启动: http://localhost:3000` 即启动成功。

> 如果你的 MySQL 密码不是空的，请先修改 `backend/.env` 中的 `DB_PASSWORD`。

## 第三步：启动前端

新开一个终端：

```bash
cd frontend
npm install
npm run dev
```

然后浏览器打开 **http://localhost:5173** 即可开始互动。

## API 接口

| 方法 | 路径 | 说明 | 返回 |
| --- | --- | --- | --- |
| GET | `/api/health` | 健康检查 | `{ status: "ok" }` |
| GET | `/api/pet/stats` | 获取狗狗状态 | `{ hunger, happiness, intimacy }` |
| GET | `/api/pet/weekly` | 最近 7 天状态趋势（每天取当天最后一条快照，即"每日收盘值"，无数据的天为 null） | `[{ date, hunger, happiness, intimacy } × 7]` |
| GET | `/api/pet/name` | 获取狗狗名字（未取名返回默认「小狗狗」） | `{ name }` |
| POST | `/api/pet/name` | 给狗狗取名/改名（≤12 字，持久保存） | `{ name }` |
| POST | `/api/pet/feed` | 喂食：饱食度 +10 | 更新后的状态 |
| POST | `/api/pet/pet` | 抚摸：愉悦度 +8、亲密度 +5 | 更新后的状态 |
| POST | `/api/pet/walk` | 遛狗：随机彩蛋（捡到骨头愉悦 +1 / 交到新朋友亲密度 +10 / 什么也没发生），返回 `{ outcome, message, ... }` | 彩蛋结果 + 状态 |
| GET | `/api/pet/weather` | 当前天气（Open-Meteo 免注册接口，重庆坐标；后端内存缓存 30 分钟，失败降级为阴天）。抚摸涨幅随天气变化：晴 +12 / 阴 +8 / 雨雪 +4 且亲密度额外 +2 | `{ icon, label, temperature, city, ... }` |

所有指标上限为 100，满值后不再增加。

## 常见问题

- **页面提示"无法连接服务器"**：确认后端已启动（第二步），且数据库初始化已完成（第一步）。
- **后端报 ER_BAD_DB_ERROR / ER_NO_SUCH_TABLE**：说明 `pet_db` 或 `pet_stats` 不存在，重新执行 `database/init.sql`。
- **后端报 Access denied**：检查 `backend/.env` 中的 `DB_USER` / `DB_PASSWORD` 是否与你的 MySQL 一致。
- **周报面板显示"还没有记录"**：每次喂食/抚摸/遛狗（有数值变化时）都会写入一条快照，互动后折线图就会出现；确保已执行最新版 `database/init.sql` 创建了 `pet_stats_log` 表。
- **3306 端口被占用**：修改 `backend/.env` 中的 `DB_PORT`；修改后端服务端口可改 `PORT`（同时修改 `frontend/vite.config.js` 中代理目标）。
