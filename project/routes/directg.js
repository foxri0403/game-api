const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function parsePrice(text) {
  if (!text) return null;
  const num = String(text).replace(/[^0-9]/g, "");
  return num ? Number(num) : null;
}

router.get("/directg/search", async (req, res) => {
  try {
    const keyword = (req.query.q || "").trim().toLowerCase();

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "검색어를 입력하세요."
      });
    }

    const response = await axios.get("https://directg.net/", {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $("img").each((i, img) => {
      const image = $(img).attr("src") || "";
      const name = ($(img).attr("alt") || "").trim();

      if (!name) return;
      if (!name.toLowerCase().includes(keyword)) return;

      const card = $(img).closest("a, li, div");
      const text = card.text().replace(/\s+/g, " ").trim();

      const discountMatch = text.match(/(\d+)\s*%/);
      const discount = discountMatch ? Number(discountMatch[1]) : 0;

      const prices = text.match(/[0-9,]+/g) || [];

      let salePrice = null;
      let originalPrice = null;

      if (prices.length >= 2 && discount > 0) {
        salePrice = parsePrice(prices[prices.length - 2]);
        originalPrice = parsePrice(prices[prices.length - 1]);
      } else if (prices.length >= 1) {
        salePrice = parsePrice(prices[prices.length - 1]);
        originalPrice = salePrice;
      }

      const link = card.attr("href") || $(img).closest("a").attr("href") || "";

      results.push({
        store: "DirectG",
        name,
        image: image.startsWith("http") ? image : `https://directg.net${image.startsWith("/") ? image : "/" + image}`,
        url: link.startsWith("http") ? link : `https://directg.net${link.startsWith("/") ? link : "/" + link}`,
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
    console.error("DirectG 크롤링 오류:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;