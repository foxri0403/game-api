//const steamRoutes = require("./routes/steam");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const key = process.env.STEAM_API_KEY;
const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/game");
const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
//app.use("/api", steamRoutes);

// 페이지 라우트
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// API / 기능 라우트 연결
app.use("/api", authRoutes);
app.use("/", gameRoutes);

router.get("/steam/apps", async (req, res) => {
  try {
    const key = process.env.STEAM_API_KEY;

    const response = await axios.get(
      "https://partner.steam-api.com/IStoreService/GetAppList/v1/",
      {
        params: {
          key
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error("Steam 오류:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;