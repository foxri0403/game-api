const express = require("express");
const { Pool } = require("pg");
const axios = require("axios");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 찜 추가
router.post("/wishlist", async (req, res) => {
  const { user_id, appid, game_name, image, current_price } = req.body;

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
      (user_id, appid, game_name, image, current_price)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [user_id, appid, game_name, image || "", current_price ?? null]
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

// 내 찜 목록 조회 + Steam 최신 가격 조회
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

    const games = await Promise.all(
      result.rows.map(async (game) => {
        const savedPrice = game.current_price;

        try {
          const steamRes = await axios.get(
            "https://store.steampowered.com/api/appdetails",
            {
              params: {
                appids: game.appid,
                cc: "kr",
                l: "koreana",
                filters: "basic,price_overview"
              },
              timeout: 10000
            }
          );

          const appData = steamRes.data[String(game.appid)];

          if (appData && appData.success && appData.data) {
            const detail = appData.data;

            game.image = game.image || detail.header_image || "";

            if (detail.price_overview) {
              game.current_price = detail.price_overview.final;
              game.original_price = detail.price_overview.initial;
              game.discount = detail.price_overview.discount_percent;
            } else if (detail.is_free) {
              game.current_price = 0;
              game.original_price = 0;
              game.discount = 0;
            } else {
              game.current_price = savedPrice;
              game.original_price = savedPrice;
              game.discount = 0;
            }
          } else {
            game.current_price = savedPrice;
            game.original_price = savedPrice;
            game.discount = 0;
          }

        } catch (e) {
          console.log(`Steam 가격 조회 실패: ${game.game_name}`);
          game.current_price = savedPrice;
          game.original_price = savedPrice;
          game.discount = 0;
        }

        return game;
      })
    );

    res.json({
      success: true,
      results: games
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

  if (!user_id || !appid) {
    return res.status(400).json({
      success: false,
      message: "user_id, appid가 필요합니다."
    });
  }

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