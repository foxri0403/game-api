const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL 연결
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 공통 쿼리 함수
async function executeQuery(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

// 루트
app.get("/", (req, res) => {
    res.send("🎮 Game API 서버 실행 중!");
});

// 게임 목록
app.get("/games", async (req, res) => {
    try {
        const data = await executeQuery("SELECT * FROM GAMES");
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "DB 오류" });
    }
});

// 게임 검색 (PostgreSQL 방식)
app.get("/games/search", async (req, res) => {
    const { title } = req.query;

    try {
        const data = await executeQuery(
            "SELECT * FROM GAMES WHERE LOWER(TITLE) LIKE LOWER($1)",
            [`%${title}%`]
        );
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "검색 실패" });
    }
});

// 가격 조회
app.get("/games/:id/prices", async (req, res) => {
    const gameId = req.params.id;

    try {
        const data = await executeQuery(
            `SELECT g.TITLE, p.NAME AS PLATFORM, pr.PRICE, pr.CURRENCY, pr.UPDATED_AT
             FROM PRICES pr
             JOIN GAMES g ON pr.GAME_ID = g.GAME_ID
             JOIN PLATFORMS p ON pr.PLATFORM_ID = p.PLATFORM_ID
             WHERE g.GAME_ID = $1`,
            [gameId]
        );
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "가격 조회 실패" });
    }
});

// 서버 실행 (한 번만!)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`서버 실행 중: ${PORT}`);
});

app.get("/init", async (req, res) => {
    try {
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS GAMES (
                GAME_ID SERIAL PRIMARY KEY,
                TITLE VARCHAR(200) NOT NULL
            );
        `);

        await executeQuery(`
            INSERT INTO GAMES (TITLE) VALUES ('Elden Ring');
        `);

        res.send("테이블 생성 완료!");
    } catch (err) {
        console.error(err);
        res.status(500).send("실패");
    }
});