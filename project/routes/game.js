const express = require("express");
const { executeQuery, pool } = require("../db");

const router = express.Router();

// DB 연결 테스트
router.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      time: result.rows[0]
    });
  } catch (err) {
    console.error("DB 연결 테스트 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// DB 초기화
router.get("/init", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DROP TABLE IF EXISTS alerts CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS wishlist CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS users CASCADE;`);

    await client.query(`
      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100),
        thumbnail_url TEXT,
        release_date DATE
      );
    `);

    await client.query(`
      DELETE FROM games
      WHERE game_id NOT IN (
        SELECT MIN(game_id)
        FROM games
        GROUP BY title
      );
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        platform_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        region VARCHAR(50) DEFAULT 'KR'
      );
    `);

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

    await client.query(`
      CREATE TABLE wishlist (
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

    await client.query(`
      CREATE TABLE alerts (
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

    await client.query(`
      INSERT INTO platforms (name, region)
      VALUES
        ('Steam', 'KR'),
        ('Epic Games', 'KR'),
        ('DirectG', 'KR')
      ON CONFLICT (name) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO games (title, genre)
      VALUES ('Elden Ring', 'RPG')
      ON CONFLICT (title) DO NOTHING;
    `);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "초기화 완료"
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

// 게임 목록
router.get("/games", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT * FROM games
      ORDER BY game_id
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

// 플랫폼 목록
router.get("/platforms", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT * FROM platforms
      ORDER BY platform_id
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

module.exports = router;