const express = require("express");
const bcrypt = require("bcryptjs");
const { executeQuery } = require("../db");

const router = express.Router();

// 회원가입 API
router.post("/signup", async (req, res) => {
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
    console.error("회원가입 오류:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 로그인 API
router.post("/login", async (req, res) => {
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
router.get("/users", async (req, res) => {
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

module.exports = router;