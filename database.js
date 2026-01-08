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
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        plan TEXT DEFAULT 'free',
        plan_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        free_reading_used BOOLEAN DEFAULT FALSE,
        single_purchase_count INTEGER DEFAULT 0,
        greeting_sent BOOLEAN DEFAULT FALSE,
        subscription JSONB,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // reading_historyテーブルの作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reading_type TEXT,
        theme TEXT,
        cards JSONB,
        reading TEXT,
        advice TEXT
      )
    `);

    // インデックスの作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_reading_history_timestamp ON reading_history(timestamp);
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
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      // 既存ユーザー
      const user = result.rows[0];
      
      // last_activeを更新
      await pool.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      // JSONBフィールドをパース
      return {
        userId: user.user_id,
        displayName: user.display_name,
        plan: user.plan,
        planChangedAt: user.plan_changed_at,
        createdAt: user.created_at,
        freeReadingUsed: user.free_reading_used,
        singlePurchaseCount: user.single_purchase_count,
        greetingSent: user.greeting_sent,
        subscription: user.subscription,
        lastActive: user.last_active
      };
    } else {
      // 新規ユーザー
      const insertResult = await pool.query(
        `INSERT INTO users (user_id, display_name, plan, plan_changed_at, free_reading_used, single_purchase_count, greeting_sent)
         VALUES ($1, $2, 'free', CURRENT_TIMESTAMP, FALSE, 0, FALSE)
         RETURNING *`,
        [userId, displayName]
      );

      const newUser = insertResult.rows[0];
      return {
        userId: newUser.user_id,
        displayName: newUser.display_name,
        plan: newUser.plan,
        planChangedAt: newUser.plan_changed_at,
        createdAt: newUser.created_at,
        freeReadingUsed: newUser.free_reading_used,
        singlePurchaseCount: newUser.single_purchase_count,
        greetingSent: newUser.greeting_sent,
        subscription: newUser.subscription,
        lastActive: newUser.last_active
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
      fields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.plan !== undefined) {
      fields.push(`plan = $${paramIndex++}`);
      values.push(updates.plan);
    }
    if (updates.planChangedAt !== undefined) {
      fields.push(`plan_changed_at = $${paramIndex++}`);
      values.push(updates.planChangedAt);
    }
    if (updates.freeReadingUsed !== undefined) {
      fields.push(`free_reading_used = $${paramIndex++}`);
      values.push(updates.freeReadingUsed);
    }
    if (updates.singlePurchaseCount !== undefined) {
      fields.push(`single_purchase_count = $${paramIndex++}`);
      values.push(updates.singlePurchaseCount);
    }
    if (updates.greetingSent !== undefined) {
      fields.push(`greeting_sent = $${paramIndex++}`);
      values.push(updates.greetingSent);
    }
    if (updates.subscription !== undefined) {
      fields.push(`subscription = $${paramIndex++}`);
      values.push(JSON.stringify(updates.subscription));
    }

    if (fields.length === 0) {
      return true; // 更新するフィールドがない
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${paramIndex}`;
    
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
      `INSERT INTO reading_history (user_id, reading_type, theme, cards, reading, advice)
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
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.reading_type,
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
       WHERE user_id = $1 
       AND DATE(timestamp) = CURRENT_DATE 
       ORDER BY timestamp DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.reading_type,
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
      'SELECT plan_changed_at FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return [];
    }

    const planChangedAt = userResult.rows[0].plan_changed_at;

    // プラン変更後の履歴を取得
    const result = await pool.query(
      `SELECT * FROM reading_history 
       WHERE user_id = $1 
       AND timestamp >= $2 
       AND DATE(timestamp) = CURRENT_DATE 
       ORDER BY timestamp DESC`,
      [userId, planChangedAt]
    );

    return result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.reading_type,
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
