const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function parsePrice(text) {
  if (!text) return null;

  const onlyNumber = text.replace(/[^0-9]/g, "");

  if (!onlyNumber) return null;

  return Number(onlyNumber);
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
    const results = [];

    $("a").each((i, el) => {
      const cardText = $(el).parent().text().replace(/\s+/g, " ").trim();
      const name = $(el).find("img").attr("alt") || $(el).text().trim();
      const image = $(el).find("img").attr("src") || "";
      const href = $(el).attr("href") || "";

      if (!name || !name.includes(keyword)) return;

      const discountMatch = cardText.match(/(\d+)%/);
      const discount = discountMatch ? Number(discountMatch[1]) : 0;

      const priceMatches = cardText.match(/[0-9,]+/g) || [];

      let originalPrice = null;
      let salePrice = null;

      if (priceMatches.length >= 2 && discount > 0) {
        originalPrice = parsePrice(priceMatches[priceMatches.length - 2]);
        salePrice = parsePrice(priceMatches[priceMatches.length - 1]);
      } else if (priceMatches.length >= 1) {
        salePrice = parsePrice(priceMatches[priceMatches.length - 1]);
        originalPrice = salePrice;
      }

      results.push({
        store: "DirectG",
        name,
        image: image.startsWith("http") ? image : `https://directg.net/${image}`,
        url: href.startsWith("http") ? href : `https://directg.net/${href}`,
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