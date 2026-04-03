const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 공통 쿼리 함수
async function executeQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// 루트
app.get("/", (req, res) => {
  res.send("🎮 Game API 서버 실행 중!");
});

// DB 초기화 및 테이블 생성
app.get("/init", async (req, res) => {
  try {
    // 1. users 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. games 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100),
        thumbnail_url TEXT,
        release_date DATE
      );
    `);

    // 3. platforms 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS platforms (
        platform_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        region VARCHAR(50) DEFAULT 'KR'
      );
    `);

    // 4. prices 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS prices (
        price_id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        platform_id INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KRW',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_prices_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
        CONSTRAINT fk_prices_platform
          FOREIGN KEY (platform_id) REFERENCES platforms(platform_id) ON DELETE CASCADE
      );
    `);

    // 5. price_history 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS price_history (
        history_id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        platform_id INTEGER NOT NULL,
        old_price NUMERIC(10, 2),
        new_price NUMERIC(10, 2),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_history_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
        CONSTRAINT fk_history_platform
          FOREIGN KEY (platform_id) REFERENCES platforms(platform_id) ON DELETE CASCADE
      );
    `);

    // 6. wishlist 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS wishlist (
        wishlist_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_wishlist_user
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_wishlist_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
        CONSTRAINT unique_user_game UNIQUE (user_id, game_id)
      );
    `);

    // 7. alerts 테이블
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS alerts (
        alert_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        target_price NUMERIC(10, 2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_alerts_user
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_alerts_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
      );
    `);

    // 기본 플랫폼 데이터 삽입
    await executeQuery(`
      INSERT INTO platforms (name, region)
      VALUES 
        ('Steam', 'KR'),
        ('Epic Games', 'KR'),
        ('DirectG', 'KR')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 테스트용 게임 데이터 삽입
    await executeQuery(`
      INSERT INTO games (title, genre)
      VALUES ('Elden Ring', 'RPG')
      ON CONFLICT DO NOTHING;
    `);

    res.send("모든 테이블 생성 완료!");
  } catch (err) {
    console.error("INIT 오류:", err);
    res.status(500).send("초기화 실패");
  }
});

// 게임 목록 조회
app.get("/games", async (req, res) => {
  try {
    const data = await executeQuery("SELECT * FROM games ORDER BY game_id");
    res.json(data);
  } catch (err) {
    console.error("GAMES 오류:", err);
    res.status(500).json({ error: "DB 오류" });
  }
});

// 플랫폼 목록 조회
app.get("/platforms", async (req, res) => {
  try {
    const data = await executeQuery("SELECT * FROM platforms ORDER BY platform_id");
    res.json(data);
  } catch (err) {
    console.error("PLATFORMS 오류:", err);
    res.status(500).json({ error: "DB 오류" });
  }
});

// 가격 목록 조회
app.get("/prices", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT 
        p.price_id,
        g.title AS game_title,
        pf.name AS platform_name,
        p.price,
        p.currency,
        p.updated_at
      FROM prices p
      JOIN games g ON p.game_id = g.game_id
      JOIN platforms pf ON p.platform_id = pf.platform_id
      ORDER BY p.price_id;
    `);
    res.json(data);
  } catch (err) {
    console.error("PRICES 오류:", err);
    res.status(500).json({ error: "DB 오류" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});