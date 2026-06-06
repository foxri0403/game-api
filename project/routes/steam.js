const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

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

    const response = await axios.get(
      "https://store.steampowered.com/api/storesearch",
      {
        params: {
          term: keyword,
          tags: genre || undefined,
          cc: "kr",
          l: "koreana"
        },
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

router.get("/steam/top100", async (req, res) => {
  try {
    const response = await axios.get(
      "https://store.steampowered.com/search/results/",
      {
        params: {
          query: "",
          start: 0,
          count: 100,
          filter: "topsellers",
          cc: "kr",
          l: "koreana",
          infinite: 1
        },
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 10000
      }
    );

    const html = response.data.results_html || "";
    const $ = cheerio.load(html);
    const results = [];

    $("a.search_result_row").each((i, el) => {
      const appid = $(el).attr("data-ds-appid");
      const name = $(el).find(".title").text().trim();
      const image = $(el).find("img").attr("src") || "";

      const discountText = $(el).find(".discount_pct").text().trim();
      const discount = discountText
        ? Number(discountText.replace(/[^0-9]/g, ""))
        : 0;

      const saleText = $(el).find(".discount_final_price").text().trim();
      const originalText = $(el).find(".discount_original_price").text().trim();

      const salePrice = saleText
        ? Number(saleText.replace(/[^0-9]/g, ""))
        : null;

      const originalPrice = originalText
        ? Number(originalText.replace(/[^0-9]/g, ""))
        : salePrice;

      results.push({
        rank: i + 1,
        appid,
        name,
        image,
        originalPrice,
        salePrice,
        discount
      });
    });

    res.json({
      success: true,
      count: results.length,
      results
    });

  } catch (err) {
    console.error("TOP100 조회 오류:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;