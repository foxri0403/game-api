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
    const keyword = (req.query.q || "").trim();

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "검색어를 입력하세요."
      });
    }

    const response = await axios.get(
      "https://directg.net/game/game_search_thumb.html",
      {
        params: {
          searchValue: keyword
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "ko-KR,ko;q=0.9"
        },
        timeout: 10000
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    $(".product, .prd, .item, .goods, li, .game_item").each((i, el) => {
      const $el = $(el);
      const text = $el.text().replace(/\s+/g, " ").trim();

      if (!text.includes(keyword)) return;

      const img = $el.find("img").first();
      const image = img.attr("src") || img.attr("data-src") || "";

      const linkEl = $el.find("a").first();
      const href = linkEl.attr("href") || "";

      let name =
        img.attr("alt") ||
        $el.find(".name").text().trim() ||
        $el.find(".title").text().trim() ||
        "";

      if (!name) {
        const lines = $el.text()
          .split("\n")
          .map(v => v.trim())
          .filter(Boolean);

        name = lines.find(v => v.includes(keyword)) || keyword;
      }

      const discountMatch = text.match(/(\d+)\s*%/);
      let discount = discountMatch ? Number(discountMatch[1]) : 0;

      const prices = text.match(/[0-9]{1,3}(?:,[0-9]{3})+/g) || [];

      let originalPrice = null;
      let salePrice = null;

      if (discount > 0 && prices.length >= 2) {
        originalPrice = parsePrice(prices[0]);
        salePrice = parsePrice(prices[1]);
      } else if (prices.length >= 1) {
        salePrice = parsePrice(prices[prices.length - 1]);
        originalPrice = salePrice;
      }

      if (discount === 0 && originalPrice && salePrice && originalPrice > salePrice) {
        discount = Math.round((1 - salePrice / originalPrice) * 100);
      }

      results.push({
        store: "DirectG",
        name,
        image: makeAbsoluteUrl(image),
        url: makeAbsoluteUrl(href),
        originalPrice,
        salePrice,
        discount
      });
    });

    const unique = [];
    const seen = new Set();

    for (const item of results) {
      const key = `${item.name}-${item.salePrice}`;

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