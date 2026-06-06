const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function parsePrice(text) {
  if (!text) return null;
  const num = String(text).replace(/[^0-9]/g, "");
  return num ? Number(num) : null;
}

function makeAbsoluteUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://directg.net" + url;
  return "https://directg.net/" + url;
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

    const response = await axios.get("https://directg.net/index.php", {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $("a").each((i, el) => {
      const $a = $(el);
      const text = $a.text().replace(/\s+/g, " ").trim();

      if (!text) return;
      if (!text.toLowerCase().includes(keyword)) return;

      const img = $a.find("img").first();
      const image = img.attr("src") || img.attr("data-src") || "";
      const imgAlt = img.attr("alt") || "";

      let name = imgAlt.trim();

      if (!name) {
        const lines = text
          .split(/\s{2,}|\n/)
          .map(v => v.trim())
          .filter(Boolean);

        name = lines.find(line =>
          line.toLowerCase().includes(keyword) &&
          !line.includes("종료") &&
          !line.includes("코드") &&
          !line.includes("GAME")
        ) || "";
      }

      if (!name) return;

      const discountMatch =
        text.match(/-?\s*(\d+)\s*%/) ||
        text.match(/(\d+)\s*%/);

      const discount = discountMatch ? Number(discountMatch[1]) : 0;

      const prices = text.match(/[0-9]{1,3}(?:,[0-9]{3})+/g) || [];

      let originalPrice = null;
      let salePrice = null;

      if (prices.length >= 2 && discount > 0) {
        originalPrice = parsePrice(prices[prices.length - 2]);
        salePrice = parsePrice(prices[prices.length - 1]);
      } else if (prices.length >= 1) {
        salePrice = parsePrice(prices[prices.length - 1]);
        originalPrice = salePrice;
      }

      results.push({
        store: "DirectG",
        name,
        image: makeAbsoluteUrl(image),
        url: makeAbsoluteUrl($a.attr("href")),
        originalPrice,
        salePrice,
        discount
      });
    });

    const unique = [];
    const seen = new Set();

    for (const item of results) {
      const key = item.name + item.salePrice;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    res.json({
      success: true,
      count: unique.length,
      results: unique
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