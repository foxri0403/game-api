const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/init", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // users 테이블이 없으면 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // password_hash 컬럼이 없으면 추가
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `);

    // 예전 password 컬럼이 있고 password_hash가 비어 있으면 복사
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'users'
            AND column_name = 'password'
        ) THEN
          UPDATE users
          SET password_hash = password
          WHERE password_hash IS NULL;
        END IF;
      END
      $$;
    `);

    // username이 nullable일 수 있으니 기본값 보정
    await client.query(`
      UPDATE users
      SET username = 'user_' || user_id
      WHERE username IS NULL OR username = '';
    `);

    // password_hash가 null인 행이 있으면 임시 해시값 넣기
    // 기존 데이터 깨지지 않게 하기 위한 안전장치
    const fallbackHash = await bcrypt.hash("temp_password_1234", 10);
    await client.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE password_hash IS NULL OR password_hash = '';
      `,
      [fallbackHash]
    );

    // NOT NULL 제약 적용
    await client.query(`
      ALTER TABLE users
      ALTER COLUMN password_hash SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE users
      ALTER COLUMN username SET NOT NULL;
    `);

    // games
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100),
        thumbnail_url TEXT,
        release_date DATE
      );
    `);

    // games 중복 삭제
    await client.query(`
      DELETE FROM games
      WHERE game_id NOT IN (
        SELECT MIN(game_id)
        FROM games
        GROUP BY title
      );
    `);

    // games.title unique
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

    // platforms
    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        platform_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        region VARCHAR(50) DEFAULT 'KR'
      );
    `);

    // prices
    await client.query(`
      CREATE TABLE IF NOT EXISTS prices (
        price_id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        platform_id INTEGER NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KRW',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_prices_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
        CONSTRAINT fk_prices_platform
          FOREIGN KEY (platform_id) REFERENCES platforms(platform_id) ON DELETE CASCADE
      );
    `);

    // wishlist
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

    // alerts
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        alert_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        target_price NUMERIC(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_alerts_user
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_alerts_game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
      );
    `);

    // 기본 데이터
    await client.query(`
      INSERT INTO platforms (name, region)
      VALUES ('Steam', 'KR'), ('Epic Games', 'KR'), ('DirectG', 'KR')
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
      message: "초기화 완료 - users.password_hash 보정 완료"
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    client.release();
  }
});

app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: "이메일, 비밀번호, 이름을 모두 입력하세요."
      });
    }

    const existingUser = await executeQuery(
      `SELECT user_id FROM users WHERE email = $1`,
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "이미 가입된 이메일입니다."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await executeQuery(
      `
      INSERT INTO users (email, password_hash, username)
      VALUES ($1, $2, $3)
      `,
      [email, passwordHash, username]
    );

    res.json({
      success: true,
      message: "회원가입 성공"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await executeQuery(
      `SELECT user_id, email, username, password_hash FROM users WHERE email = $1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    res.json({
      success: true,
      message: "로그인 성공",
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT user_id, email, username, password_hash, created_at
      FROM users
      ORDER BY user_id
    `);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});