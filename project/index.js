// 🔥 서버 죽는 원인 추적용 (필수)
process.on("uncaughtException", (err) => {
  console.error("🔥 치명적 에러:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 Promise 에러:", err);
});

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// 🔧 기본 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔧 정적 파일 (HTML/CSS)
app.use(express.static(path.join(__dirname, "public")));

// 🔥 라우트 안전하게 로드 (하나라도 터지면 로그 출력)
let steamRoutes;
let authRoutes;
let gameRoutes;

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

// 🔧 페이지 라우트
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 🔧 API 라우트 연결 (로드된 것만 연결)
if (steamRoutes) {
  app.use("/api", steamRoutes);
}

if (authRoutes) {
  app.use("/api", authRoutes);
}

if (gameRoutes) {
  app.use("/", gameRoutes);
}

// 🔥 서버 실행 (Render 필수)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중: ${PORT}`);
});