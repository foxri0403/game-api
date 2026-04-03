const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// public 폴더의 정적 파일(html, css 등) 사용
app.use(express.static(path.join(__dirname, "public")));

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

// 메인 홈페이지
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 회원가입 페이지
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// 로그인 페이지
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// DB 연결 테스트
app.get("/test-db", async (req, res) => {
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

// DB 초기화 및 테이블 생성
app.get("/init", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // users 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // games 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        genre VARCHAR(100),
        thumbnail_url TEXT,
        release_date DATE
      );
    `);

    // platforms 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        platform_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        region VARCHAR(50) DEFAULT 'KR'
      );
    `);

    // prices 테이블
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

    // price_history 테이블
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

    // wishlist 테이블
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

    // alerts 테이블
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

    // games 중복 삭제
    await client.query(`
      DELETE FROM games
      WHERE game_id NOT IN (
        SELECT MIN(game_id)
        FROM games
        GROUP BY title
      );
    `);

    // games.title UNIQUE 제약 추가
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

    // 기본 플랫폼 데이터 삽입
    await client.query(`
      INSERT INTO platforms (name, region)
      VALUES
        ('Steam', 'KR'),
        ('Epic Games', 'KR'),
        ('DirectG', 'KR')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 기본 게임 데이터 삽입
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

// 회원가입 API
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
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "이미 가입된 이메일입니다."
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

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
    console.error("회원가입 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 로그인 API
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "이메일과 비밀번호를 입력하세요."
      });
    }

    const users = await executeQuery(
      `
      SELECT user_id, email, username, password_hash
      FROM users
      WHERE email = $1
      `,
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
    console.error("로그인 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 사용자 목록 확인용
app.get("/users", async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT user_id, email, username, password_hash, created_at
      FROM users
      ORDER BY user_id
    `);
    res.json(data);
  } catch (err) {
    console.error("USERS 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 게임 목록
app.get("/games", async (req, res) => {
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
app.get("/platforms", async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});