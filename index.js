const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

app.get("/", (req, res) => {
  res.send("🎮 Game API 서버 실행 중!");
});

app.get("/init", async (req, res) => {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS games (
        game_id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL
      );
    `);

    await executeQuery(
      `INSERT INTO games (title)
       SELECT $1
       WHERE NOT EXISTS (
         SELECT 1 FROM games WHERE title = $1
       );`,
      ["Elden Ring"]
    );

    res.send("테이블 생성 완료!");
  } catch (err) {
    console.error("INIT 오류:", err);
    res.status(500).send("실패");
  }
});

app.get("/games", async (req, res) => {
  try {
    const data = await executeQuery("SELECT * FROM games ORDER BY game_id");
    res.json(data);
  } catch (err) {
    console.error("GAMES 오류:", err);
    res.status(500).json({ error: "DB 오류" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: ${PORT}`);
});