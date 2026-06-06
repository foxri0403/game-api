const express = require("express");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

router.post("/wishlist", async (req, res) => {

  const { user_id, appid, game_name } = req.body;

  try {

    await pool.query(
      `
      INSERT INTO wishlist
      (user_id, appid, game_name)
      VALUES ($1,$2,$3)
      `,
      [user_id, appid, game_name]
    );

    res.json({
      success:true
    });

  } catch(err){

    res.status(500).json({
      success:false,
      error:err.message
    });

  }

});

module.exports = router;