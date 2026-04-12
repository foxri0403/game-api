const express = require("express");
const router = express.Router();

router.get("/steam/test", (req, res) => {
  res.json({
    success: true,
    message: "Steam route OK"
  });
});

module.exports = router;