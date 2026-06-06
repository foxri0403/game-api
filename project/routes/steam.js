const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/steam/test", (req, res) => {
  res.json({ success: true });
});

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
      let salePrice = null;
      let originalPrice = null;
      let discount = 0;

      if (game.price) {
        salePrice = game.price.final ?? null;
        originalPrice = game.price.initial ?? salePrice;
        discount =
          game.price.discount_percent ??
          game.price.discount_pct ??
          0;
      }

      if (!discount && originalPrice && salePrice && originalPrice > salePrice) {
        discount = Math.round((1 - salePrice / originalPrice) * 100);
      }

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
    console.error("Steam 검색 오류:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;