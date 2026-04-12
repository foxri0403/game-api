const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = {
  pool,
  executeQuery
};