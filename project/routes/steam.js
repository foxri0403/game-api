const express = require("express");
const axios = require("axios");

const router = express.Router();

// 앱 목록 가져오기
router.get("/steam/apps", async (req, res) => {
  try {
    // 공식 문서상 권장되는 IStoreService/GetAppList 사용
    // 이 메서드는 key 파라미터를 받는다.
    // key가 없으면 환경변수에 넣어둔 값을 사용
    const key = process.env.STEAM_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        message: "STEAM_API_KEY 환경변수가 없습니다."
      });
    }

    const response = await axios.get(
      "https://partner.steam-api.com/IStoreService/GetAppList/v1/",
      {
        params: {
          key
        }
      }
    );

    const apps = response.data.response?.apps || [];

    res.json({
      success: true,
      count: apps.length,
      apps: apps.slice(0, 100)
    });
  } catch (err) {
    console.error("Steam 앱 목록 오류:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 검색
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
        params: {
          key
        }
      }
    );

    const apps = response.data.response?.apps || [];

    const filtered = apps
      .filter(app => app.name && app.name.toLowerCase().includes(keyword))
      .slice(0, 30);

    res.json({
      success: true,
      results: filtered
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