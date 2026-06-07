// 🔥 서버 죽는 원인 추적용
process.on("uncaughtException", (err) => {
  console.error("🔥 치명적 에러:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 Promise 에러:", err);
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

let steamRoutes;
let authRoutes;
let gameRoutes;
let wishlistRoutes;
let directgRoutes;

try {
  steamRoutes = require("./routes/steam");
  console.log("✅ steamRoutes 로드 성공");
} catch (err) {
  console.error("❌ steamRoutes 로드 실패:", err);
}

try {
  authRoutes = require("./routes/auth");
  console.log("✅ authRoutes 로드 성공");
} catch (err) {
  console.error("❌ authRoutes 로드 실패:", err);
}

try {
  gameRoutes = require("./routes/game");
  console.log("✅ gameRoutes 로드 성공");
} catch (err) {
  console.error("❌ gameRoutes 로드 실패:", err);
}

try {
  wishlistRoutes = require("./routes/wishlist");
  console.log("✅ wishlistRoutes 로드 성공");
} catch (err) {
  console.error("❌ wishlistRoutes 로드 실패:", err);
}

try {
  directgRoutes = require("./routes/directg");
  console.log("✅ directgRoutes 로드 성공");
} catch (err) {
  console.error("❌ directgRoutes 로드 실패:", err);
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

app.get("/mypage", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mypage.html"));
});

// USERS 테이블 생성용
app.get("/init-users", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS USERS (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.send("USERS 테이블 생성 완료");
  } catch (err) {
    console.error("❌ USERS 테이블 생성 실패:", err);
    res.status(500).send(err.message);
  }
});

app.get("/init-wishlist", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS WISHLIST (
        wishlist_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        appid INTEGER NOT NULL,
        game_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, appid)
      );
    `);

    await pool.query(`
      ALTER TABLE WISHLIST
      ADD COLUMN IF NOT EXISTS image TEXT;
    `);

    await pool.query(`
      ALTER TABLE WISHLIST
      ADD COLUMN IF NOT EXISTS current_price INTEGER DEFAULT 0;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ALERTS (
        alert_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        appid INTEGER NOT NULL,
        game_name VARCHAR(255),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.send("WISHLIST, ALERTS 테이블 생성 및 컬럼 추가 완료");
  } catch (err) {
    console.error("❌ 테이블 생성 실패:", err);
    res.status(500).send(err.message);
  }
});

if (steamRoutes) {
  app.use("/api", steamRoutes);
}

if (authRoutes) {
  app.use("/api", authRoutes);
}

if (wishlistRoutes) {
  app.use("/api", wishlistRoutes);
}

if (directgRoutes) {
  app.use("/api", directgRoutes);
}

if (gameRoutes) {
  app.use("/", gameRoutes);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중: ${PORT}`);
});