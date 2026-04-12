const express = require("express");
const axios = require("axios");

const router = express.Router();

// 테스트
router.get("/steam/test", (req, res) => {
  res.json({ success: true });
});

// 검색 (수정된 부분)
router.get("/steam/search", async (req, res) => {
  try {
    const keyword = (req.query.q || "").trim();

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "검색어를 입력하세요."
      });
    }

    const response = await axios.get(
      "https://store.steampowered.com/api/storesearch",
      {
        params: {
          term: keyword,
          cc: "kr",
          l: "koreana"
        },
        timeout: 10000
      }
    );

    const items = response.data.items || [];

    const results = items.map(game => ({
      appid: game.id,
      name: game.name,
      price: game.price?.final || 0,
      discount: game.price?.discount_percent || 0,
      image: game.tiny_image
    }));

    res.json({
      success: true,
      count: results.length,
      results
    });

  } catch (err) {
    console.error("Steam 검색 오류:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;