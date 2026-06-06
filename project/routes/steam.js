const express = require("express");
const axios = require("axios");

const router = express.Router();

// 테스트
router.get("/steam/test", (req, res) => {
  res.json({ success: true });
});

// Steam 검색
router.get("/steam/search", async (req, res) => {
  try {
    const keyword = (req.query.q || "").trim();
    const genre = (req.query.genre || "").trim();

    if (!keyword && !genre) {
      return res.status(400).json({
        success: false,
        message: "검색어 또는 장르를 선택하세요."
      });
    }

    const params = {
      term: keyword,
      cc: "kr",
      l: "koreana"
    };

    // 장르가 선택된 경우 Steam 태그 값 추가
    if (genre) {
      params.tags = genre;
    }

    const response = await axios.get(
      "https://store.steampowered.com/api/storesearch",
      {
        params,
        timeout: 10000
      }
    );

    const items = response.data.items || [];

    const results = items.map(game => {
      const salePrice = game.price?.final || 0;
      const originalPrice = game.price?.initial || salePrice;
      const discount = game.price?.discount_percent || 0;

      return {
        appid: game.id,
        name: game.name,
        originalPrice,
        salePrice,
        discount,
        image: game.tiny_image
      };
    });

    res.json({
      success: true,
      count: results.length,
      results
    });

  } catch (err) {
    console.error("Steam 검색 오류:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;