const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function parsePrice(text) {
  if (!text) return null;
  const num = String(text).replace(/[^0-9]/g, "");
  return num ? Number(num) : null;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-:：]/g, "");
}

router.get("/directg/search", async (req, res) => {
  try {
    const keyword = (req.query.q || "").trim();

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

    const bodyText = $("body")
      .text()
      .replace(/\r/g, "\n")
      .replace(/\t/g, "\n");

    const lines = bodyText
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    const results = [];
    const key = normalize(keyword);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!normalize(line).includes(key)) continue;

      const name = line;

      let discount = 0;
      let originalPrice = null;
      let salePrice = null;

      const nearLines = lines.slice(i, i + 8);

      for (const l of nearLines) {
        const discountMatch = l.match(/-?(\d+)\s*%/);

        if (discountMatch) {
          discount = Number(discountMatch[1]);
        }

        const inlineSale = l.match(/(\d+)\s*%\s*([0-9,]+)\s*~~([0-9,]+)~~/);
        if (inlineSale) {
          discount = Number(inlineSale[1]);
          salePrice = parsePrice(inlineSale[2]);
          originalPrice = parsePrice(inlineSale[3]);
          break;
        }

        const strikeSale = l.match(/~~([0-9,]+)~~\s*([0-9,]+)/);
        if (strikeSale) {
          originalPrice = parsePrice(strikeSale[1]);
          salePrice = parsePrice(strikeSale[2]);
          break;
        }
      }

      if (salePrice === null) {
        const prices = nearLines
          .join(" ")
          .match(/[0-9]{1,3}(?:,[0-9]{3})+/g) || [];

        if (discount > 0 && prices.length >= 2) {
          originalPrice = parsePrice(prices[0]);
          salePrice = parsePrice(prices[1]);
        } else if (prices.length >= 1) {
          salePrice = parsePrice(prices[0]);
          originalPrice = salePrice;
        }
      }

      if (discount === 0 && originalPrice && salePrice && originalPrice > salePrice) {
        discount = Math.round((1 - salePrice / originalPrice) * 100);
      }

      results.push({
        store: "DirectG",
        name,
        image: "",
        url: "https://directg.net/",
        originalPrice,
        salePrice,
        discount
      });
    }

    const unique = [];
    const seen = new Set();

    for (const item of results) {
      const key = item.name;

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