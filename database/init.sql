-- ============================================
-- 狗狗养成互动网页 - 数据库初始化脚本
-- 使用方法: mysql -u root -p < database/init.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS pet_db DEFAULT CHARACTER SET utf8mb4;
USE pet_db;

-- 狗狗状态表（固定一行，id = 1）
CREATE TABLE IF NOT EXISTS pet_stats (
  id INT NOT NULL PRIMARY KEY COMMENT '固定为 1',
  hunger INT NOT NULL DEFAULT 80 COMMENT '饱食度 0-100',
  happiness INT NOT NULL DEFAULT 80 COMMENT '愉悦度 0-100',
  intimacy INT NOT NULL DEFAULT 50 COMMENT '亲密度 0-100',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 初始化狗狗状态数据（已存在则跳过）
INSERT INTO pet_stats (id, hunger, happiness, intimacy)
VALUES (1, 80, 80, 50)
ON DUPLICATE KEY UPDATE id = id;

-- 状态快照表：每次互动后由后端写入一条，用于「狗狗周报」折线图
CREATE TABLE IF NOT EXISTS pet_stats_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hunger INT NOT NULL COMMENT '饱食度快照',
  happiness INT NOT NULL COMMENT '愉悦度快照',
  intimacy INT NOT NULL COMMENT '亲密度快照',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 狗狗信息表：保存名字（未取名时显示默认名「小狗狗」）
CREATE TABLE IF NOT EXISTS pet_info (
  id INT NOT NULL PRIMARY KEY COMMENT '固定为 1',
  name VARCHAR(50) NOT NULL DEFAULT '小狗狗' COMMENT '狗狗名字',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 初始化狗狗信息（已存在则跳过，不会覆盖已取的名字）
INSERT INTO pet_info (id, name) VALUES (1, '小狗狗')
ON DUPLICATE KEY UPDATE id = id;

-- 狗狗日记表：每天一条，由后端按当天心情/天气/互动次数生成
CREATE TABLE IF NOT EXISTS pet_diary (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  day DATE NOT NULL COMMENT '日记日期，一天一条',
  mood VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT '当时心情',
  weather VARCHAR(16) NOT NULL DEFAULT 'cloudy' COMMENT '当天天气',
  content VARCHAR(500) NOT NULL COMMENT '日记正文',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_day (day)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '狗狗日记';
