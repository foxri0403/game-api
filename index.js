const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// 🔗 Oracle DB 연결 설정
const dbConfig = {
    user: "YOUR_USER",
    password: "YOUR_PASSWORD",
    connectString: "localhost:1521/XEPDB1"
};

// 🔹 공통 DB 실행 함수
async function executeQuery(sql, binds = {}, options = {}) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: true,
            ...options
        });
        return result.rows;
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

app.get("/games", async (req, res) => {
    res.json([
        { id: 1, title: "테스트 게임" }
    ]);
});
app.get("/games/search", async (req, res) => {
    const { title } = req.query;

    try {
        const sql = `
            SELECT * FROM GAMES
            WHERE LOWER(TITLE) LIKE LOWER(:title)
        `;
        const data = await executeQuery(sql, { title: `%${title}%` });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "검색 실패" });
    }
});

app.get("/games/:id/prices", async (req, res) => {
    const gameId = req.params.id;

    try {
        const sql = `
            SELECT 
                g.TITLE,
                p.NAME AS PLATFORM,
                pr.PRICE,
                pr.CURRENCY,
                pr.UPDATED_AT
            FROM PRICES pr
            JOIN GAMES g ON pr.GAME_ID = g.GAME_ID
            JOIN PLATFORMS p ON pr.PLATFORM_ID = p.PLATFORM_ID
            WHERE g.GAME_ID = :id
        `;

        const data = await executeQuery(sql, { id: gameId });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "가격 조회 실패" });
    }
});

app.get("/games/:id/history", async (req, res) => {
    const gameId = req.params.id;

    try {
        const sql = `
            SELECT PRICE, RECORDED_AT
            FROM PRICE_HISTORY
            WHERE GAME_ID = :id
            ORDER BY RECORDED_AT
        `;

        const data = await executeQuery(sql, { id: gameId });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "히스토리 조회 실패" });
    }
});

app.post("/wishlist", async (req, res) => {
    const { user_id, game_id } = req.body;

    try {
        const sql = `
            INSERT INTO WISHLIST (USER_ID, GAME_ID)
            VALUES (:user_id, :game_id)
        `;

        await executeQuery(sql, { user_id, game_id });
        res.json({ message: "추가 완료" });
    } catch (err) {
        res.status(500).json({ error: "추가 실패" });
    }
});

app.get("/wishlist/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const sql = `
            SELECT g.TITLE
            FROM WISHLIST w
            JOIN GAMES g ON w.GAME_ID = g.GAME_ID
            WHERE w.USER_ID = :id
        `;

        const data = await executeQuery(sql, { id: userId });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "조회 실패" });
    }
});

app.post("/alerts", async (req, res) => {
    const { user_id, game_id, target_price } = req.body;

    try {
        const sql = `
            INSERT INTO ALERTS (USER_ID, GAME_ID, TARGET_PRICE)
            VALUES (:user_id, :game_id, :target_price)
        `;

        await executeQuery(sql, { user_id, game_id, target_price });
        res.json({ message: "알림 설정 완료" });
    } catch (err) {
        res.status(500).json({ error: "알림 실패" });
    }
});

app.get("/alerts/check", async (req, res) => {
    try {
        const sql = `
            SELECT 
                a.USER_ID,
                g.TITLE,
                pr.PRICE,
                a.TARGET_PRICE
            FROM ALERTS a
            JOIN PRICES pr ON a.GAME_ID = pr.GAME_ID
            JOIN GAMES g ON g.GAME_ID = a.GAME_ID
            WHERE pr.PRICE <= a.TARGET_PRICE
        `;

        const data = await executeQuery(sql);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "알림 조회 실패" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버 실행 중: ${PORT}`);
});
app.get("/", (req, res) => {
    res.send("서버 살아있음");
});