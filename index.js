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

// DB 연결 테스트
app.get("/test-db", async (req, res) => {
  try {
    const result = await executeQuery("SELECT NOW()");
    res.json({
      success: true,
      server_time: result[0]
    });
  } catch (err) {
    console.error("TEST-DB 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// DB 초기화 및 테이블 생성
app.get("/init", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. users 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. games 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100),
        thumbnail_url TEXT,
        release_date DATE
      );
    `);

    // 3. platforms 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        platform_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        region VARCHAR(50) DEFAULT 'KR'
      );
    `);

    // 4. prices 테이블 생성
    await client.query(`
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

    // 5. price_history 테이블 생성
    await client.query(`
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

    // 6. wishlist 테이블 생성
    await client.query(`
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

    // 7. alerts 테이블 생성
    await client.query(`
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

    // 8. games 중복 데이터 삭제
    // 같은 title이 여러 개 있으면 가장 작은 game_id 하나만 남기고 삭제
    await client.query(`
      DELETE FROM games
      WHERE game_id NOT IN (
        SELECT MIN(game_id)
        FROM games
        GROUP BY title
      );
    `);

    // 9. games.title UNIQUE 제약 추가
    // 이미 있으면 에러 없이 넘어가게 처리
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'unique_game_title'
        ) THEN
          ALTER TABLE games
          ADD CONSTRAINT unique_game_title UNIQUE (title);
        END IF;
      END
      $$;
    `);

    // 10. 기본 플랫폼 데이터 삽입
    await client.query(`
      INSERT INTO platforms (name, region)
      VALUES
        ('Steam', 'KR'),
        ('Epic Games', 'KR'),
        ('DirectG', 'KR')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 11. 테스트용 게임 데이터 삽입
    await client.query(`
      INSERT INTO games (title, genre)
      VALUES ('Elden Ring', 'RPG')
      ON CONFLICT (title) DO NOTHING;
    `);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "모든 테이블 생성 완료 + games 중복 삭제 완료 + UNIQUE 적용 완료"
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("INIT 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    client.release();
  }
});

// 게임 목록 조회
app.get("/games", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT * FROM games
      ORDER BY game_id;
    `);
    res.json(data);
  } catch (err) {
    console.error("GAMES 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 플랫폼 목록 조회
app.get("/platforms", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT * FROM platforms
      ORDER BY platform_id;
    `);
    res.json(data);
  } catch (err) {
    console.error("PLATFORMS 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
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
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});