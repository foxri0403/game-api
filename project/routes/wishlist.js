const express = require("express");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.postgresql://game_db_3puq_user:xjrZoXjKNUGJsL8fzHvRYLvknYDRKi3p@dpg-d6vdi36a2pns73ah8ao0-a/game_db_3puq,
  ssl: { rejectUnauthorized: false }
});

// 찜 추가
router.post("/wishlist", async (req, res) => {
  const { user_id, appid, game_name } = req.body;

  if (!user_id || !appid || !game_name) {
    return res.status(400).json({
      success: false,
      message: "user_id, appid, game_name이 필요합니다."
    });
  }

  try {
    const existing = await pool.query(
      `
      SELECT *
      FROM wishlist
      WHERE user_id = $1
      AND appid = $2
      `,
      [user_id, appid]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: "이미 찜한 게임입니다."
      });
    }

    await pool.query(
      `
      INSERT INTO wishlist
      (user_id, appid, game_name)
      VALUES ($1, $2, $3)
      `,
      [user_id, appid, game_name]
    );

    res.json({
      success: true,
      message: "찜 목록에 추가되었습니다."
    });

  } catch (err) {
    console.error("찜 추가 오류:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 내 찜 목록 조회
router.get("/wishlist/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM wishlist
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [user_id]
    );

    res.json({
      success: true,
      results: result.rows
    });

  } catch (err) {
    console.error("찜 목록 조회 오류:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 찜 삭제
router.delete("/wishlist", async (req, res) => {
  const { user_id, appid } = req.body;

  try {
    await pool.query(
      `
      DELETE FROM wishlist
      WHERE user_id = $1
      AND appid = $2
      `,
      [user_id, appid]
    );

    res.json({
      success: true,
      message: "찜 목록에서 삭제되었습니다."
    });

  } catch (err) {
    console.error("찜 삭제 오류:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;