const express = require("express");
const axios = require("axios");

const router = express.Router();

// Steam 라우트 연결 테스트
router.get("/steam/test", (req, res) => {
  res.json({
    success: true,
    message: "Steam route OK"
  });
});

// Steam API 키 확인
router.get("/steam/key-check", (req, res) => {
  res.json({
    success: true,
    hasSteamKey: !!process.env.STEAM_API_KEY
  });
});

// Steam 게임 검색
router.get("/steam/search", async (req, res) => {
  try {
    const keyword = (req.query.q || "").trim().toLowerCase();
    const key = process.env.STEAM_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        message: "STEAM_API_KEY 환경변수가 없습니다."
      });
    }

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "검색어를 입력하세요."
      });
    }

    const response = await axios.get(
      "https://partner.steam-api.com/IStoreService/GetAppList/v1/",
      {
        params: { key },
        timeout: 10000
      }
    );

    const apps = response.data?.response?.apps || [];

    const filtered = apps
      .filter(app => app.name && app.name.toLowerCase().includes(keyword))
      .slice(0, 30)
      .map(app => ({
        appid: app.appid,
        name: app.name
      }));

    res.json({
      success: true,
      keyword,
      count: filtered.length,
      results: filtered
    });
  } catch (err) {
    console.error("Steam 검색 오류:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

module.exports = router;