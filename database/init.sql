-- ============================================
-- 狗狗养成互动网页 - 数据库初始化脚本（多用户版）
-- 使用方法: mysql -u root -p < database/init.sql
-- 全新环境：执行一次即可建好全部 6 张表（users / sessions / pet_stats /
--   pet_stats_log / pet_diary / pet_info），无预置数据，注册时由后端播种
-- 老环境（升级）：本脚本的 CREATE IF NOT EXISTS 不会改造已存在的旧表，
--   需另行执行 ALTER 增量 SQL（加 user_id 列与索引，见 README 或会话记录）
-- 旧数据归属：ALTER 时 user_id 默认值为 1，旧数据自动归属「第一个注册
--   的用户」（users 表首条记录 id=1），不丢失
-- ============================================

CREATE DATABASE IF NOT EXISTS pet_db DEFAULT CHARACTER SET utf8mb4;
USE pet_db;

-- 用户表：账号密码（密码只存 scrypt 摘要 + 随机盐，不存明文）
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(32) NOT NULL COMMENT '用户名，唯一',
  password_hash CHAR(128) NOT NULL COMMENT 'scrypt 密码摘要',
  salt CHAR(32) NOT NULL COMMENT '每用户独立随机盐',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  UNIQUE KEY uk_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 登录会话表：随机 token → 用户（前端 localStorage 保存 token）
CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) NOT NULL PRIMARY KEY COMMENT '随机会话 token',
  user_id INT NOT NULL COMMENT '所属用户',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 狗狗状态表：每个用户一条记录（注册时由后端播种初始数据）
CREATE TABLE IF NOT EXISTS pet_stats (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '所属用户',
  hunger INT NOT NULL DEFAULT 80 COMMENT '饱食度 0-100',
  happiness INT NOT NULL DEFAULT 80 COMMENT '愉悦度 0-100',
  intimacy INT NOT NULL DEFAULT 50 COMMENT '亲密度 0-100',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 状态快照表：每次互动后由后端写入一条，用于「狗狗周报」折线图
CREATE TABLE IF NOT EXISTS pet_stats_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1 COMMENT '所属用户',
  hunger INT NOT NULL COMMENT '饱食度快照',
  happiness INT NOT NULL COMMENT '愉悦度快照',
  intimacy INT NOT NULL COMMENT '亲密度快照',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  KEY idx_user_time (user_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 狗狗日记表：每用户每天一条，由后端按当天心情/天气/互动次数生成
CREATE TABLE IF NOT EXISTS pet_diary (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1 COMMENT '所属用户',
  day DATE NOT NULL COMMENT '日记日期',
  mood VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT '当时心情',
  weather VARCHAR(16) NOT NULL DEFAULT 'cloudy' COMMENT '当天天气',
  content VARCHAR(500) NOT NULL COMMENT '日记正文',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_day_user (day, user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '狗狗日记';

-- 狗狗信息表：保存名字（每个用户一条，注册时由后端播种默认名）
CREATE TABLE IF NOT EXISTS pet_info (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '所属用户',
  name VARCHAR(50) NOT NULL DEFAULT '小狗狗' COMMENT '狗狗名字',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
