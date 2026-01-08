// PostgreSQL データベース
const { Pool } = require('pg');

// 環境変数からデータベースURLを取得
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL環境変数が設定されていません');
  process.exit(1);
}

// PostgreSQL接続プール
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// データベースの初期化（テーブル作成）
async function initDB() {
  try {
    // usersテーブルの作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        "userId" TEXT PRIMARY KEY,
        "displayName" TEXT,
        "plan" TEXT DEFAULT 'free',
        "planChangedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "freeReadingUsed" BOOLEAN DEFAULT FALSE,
        "singlePurchaseCount" INTEGER DEFAULT 0,
        "greetingSent" BOOLEAN DEFAULT FALSE,
        "subscription" JSONB,
        "lastActive" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // reading_historyテーブルの作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_history (
        "id" SERIAL PRIMARY KEY,
        "userId" TEXT REFERENCES users("userId") ON DELETE CASCADE,
        "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "readingType" TEXT,
        "theme" TEXT,
        "cards" JSONB,
        "reading" TEXT,
        "advice" TEXT
      )
    `);

    // インデックスの作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history("userId");
      CREATE INDEX IF NOT EXISTS idx_reading_history_timestamp ON reading_history("timestamp");
    `);

    console.log('✅ データベーステーブルが初期化されました');
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    throw error;
  }
}

// ユーザーの取得または作成
async function getOrCreateUser(userId, displayName = null) {
  try {
    // ユーザーが存在するか確認
    const result = await pool.query(
      'SELECT * FROM users WHERE "userId" = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      // 既存ユーザー
      const user = result.rows[0];
      
      // last_activeを更新
      await pool.query(
        'UPDATE users SET "lastActive" = CURRENT_TIMESTAMP WHERE "userId" = $1',
        [userId]
      );

      // JSONBフィールドをパース
      return {
        userId: user.userId,
        displayName: user.displayName,
        plan: user.plan,
        planChangedAt: user.planChangedAt,
        createdAt: user.createdAt,
        freeReadingUsed: user.freeReadingUsed,
        singlePurchaseCount: user.singlePurchaseCount,
        greetingSent: user.greetingSent,
        subscription: user.subscription,
        lastActive: user.lastActive
      };
    } else {
      // 新規ユーザー
      const insertResult = await pool.query(
        `INSERT INTO users ("userId", "displayName", "plan", "planChangedAt", "freeReadingUsed", "singlePurchaseCount", "greetingSent")
         VALUES ($1, $2, 'free', CURRENT_TIMESTAMP, FALSE, 0, FALSE)
         RETURNING *`,
        [userId, displayName]
      );

      const newUser = insertResult.rows[0];
      return {
        userId: newUser.userId,
        displayName: newUser.displayName,
        plan: newUser.plan,
        planChangedAt: newUser.planChangedAt,
        createdAt: newUser.createdAt,
        freeReadingUsed: newUser.freeReadingUsed,
        singlePurchaseCount: newUser.singlePurchaseCount,
        greetingSent: newUser.greetingSent,
        subscription: newUser.subscription,
        lastActive: newUser.lastActive
      };
    }
  } catch (error) {
    console.error('❌ getOrCreateUserエラー:', error);
    throw error;
  }
}

// ユーザー情報の更新
async function updateUser(userId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // 更新フィールドを構築
    if (updates.displayName !== undefined) {
      fields.push(`"displayName" = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.plan !== undefined) {
      fields.push(`"plan" = $${paramIndex++}`);
      values.push(updates.plan);
    }
    if (updates.planChangedAt !== undefined) {
      fields.push(`"planChangedAt" = $${paramIndex++}`);
      values.push(updates.planChangedAt);
    }
    if (updates.freeReadingUsed !== undefined) {
      fields.push(`"freeReadingUsed" = $${paramIndex++}`);
      values.push(updates.freeReadingUsed);
    }
    if (updates.singlePurchaseCount !== undefined) {
      fields.push(`"singlePurchaseCount" = $${paramIndex++}`);
      values.push(updates.singlePurchaseCount);
    }
    if (updates.greetingSent !== undefined) {
      fields.push(`"greetingSent" = $${paramIndex++}`);
      values.push(updates.greetingSent);
    }
    if (updates.subscription !== undefined) {
      fields.push(`"subscription" = $${paramIndex++}`);
      values.push(JSON.stringify(updates.subscription));
    }

    if (fields.length === 0) {
      return true; // 更新するフィールドがない
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE "userId" = $${paramIndex}`;
    
    await pool.query(query, values);
    return true;
  } catch (error) {
    console.error('❌ updateUserエラー:', error);
    throw error;
  }
}

// 占い履歴の追加
async function addReadingHistory(userId, reading) {
  try {
    await pool.query(
      `INSERT INTO reading_history ("userId", "readingType", "theme", "cards", "reading", "advice")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        reading.type,
        reading.theme,
        JSON.stringify(reading.cards),
        reading.reading,
        reading.advice
      ]
    );
    return true;
  } catch (error) {
    console.error('❌ addReadingHistoryエラー:', error);
    throw error;
  }
}

// 占い履歴の取得
async function getReadingHistory(userId, limit = 10) {
  try {
    const result = await pool.query(
      `SELECT * FROM reading_history 
       WHERE "userId" = $1 
       ORDER BY "timestamp" DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.readingType,
      theme: row.theme,
      cards: row.cards,
      reading: row.reading,
      advice: row.advice
    }));
  } catch (error) {
    console.error('❌ getReadingHistoryエラー:', error);
    throw error;
  }
}

// 今日の占い履歴を取得
async function getTodayReadingHistory(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM reading_history 
       WHERE "userId" = $1 
       AND DATE("timestamp") = CURRENT_DATE 
       ORDER BY "timestamp" DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.readingType,
      theme: row.theme,
      cards: row.cards,
      reading: row.reading,
      advice: row.advice
    }));
  } catch (error) {
    console.error('❌ getTodayReadingHistoryエラー:', error);
    throw error;
  }
}

// プラン変更後の占い履歴を取得
async function getReadingHistoryAfterPlanChange(userId) {
  try {
    // ユーザー情報を取得
    const userResult = await pool.query(
      'SELECT "planChangedAt" FROM users WHERE "userId" = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return [];
    }

    const planChangedAt = userResult.rows[0].planChangedAt;

    // プラン変更後の履歴を取得
    const result = await pool.query(
      `SELECT * FROM reading_history 
       WHERE "userId" = $1 
       AND "timestamp" >= $2 
       AND DATE("timestamp") = CURRENT_DATE 
       ORDER BY "timestamp" DESC`,
      [userId, planChangedAt]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.readingType,
      theme: row.theme,
      cards: row.cards,
      reading: row.reading,
      advice: row.advice
    }));
  } catch (error) {
    console.error('❌ getReadingHistoryAfterPlanChangeエラー:', error);
    throw error;
  }
}

// 接続プールを閉じる
async function closeDB() {
  await pool.end();
}

module.exports = {
  initDB,
  getOrCreateUser,
  updateUser,
  addReadingHistory,
  getReadingHistory,
  getTodayReadingHistory,
  getReadingHistoryAfterPlanChange,
  closeDB
};
