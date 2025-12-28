// データベース管理モジュール
// シンプルなJSONファイルベースのデータベース（後でMongoDBに移行可能）

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'users.json');

// データベースの初期化
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

// データベースの読み込み
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('DB読み込みエラー:', error);
    return { users: {} };
  }
}

// データベースの書き込み
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('DB書き込みエラー:', error);
    return false;
  }
}

// ユーザーの取得または作成
function getOrCreateUser(userId, displayName = null) {
  initDB();
  const db = readDB();
  
  if (!db.users[userId]) {
    // 新規ユーザー
    db.users[userId] = {
      userId: userId,
      displayName: displayName,
      plan: 'free', // free, single, light, standard, premium
      planChangedAt: new Date().toISOString(), // プラン変更時刻
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      freeReadingUsed: false, // 無料占い使用済みフラグ
      usageCount: {
        today: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
      },
      conversationState: {
        isInConversation: false,
        conversationCount: 0,
        conversationHistory: [],
        userQuestion: ''
      },
      subscription: {
        startDate: null,
        endDate: null,
        autoRenew: false,
        notificationSent: false
      },
      readingHistory: []
    };
    writeDB(db);
  }
  
  return db.users[userId];
}

// ユーザー情報の更新
function updateUser(userId, updates) {
  initDB();
  const db = readDB();
  
  if (db.users[userId]) {
    db.users[userId] = {
      ...db.users[userId],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeDB(db);
    return db.users[userId];
  }
  
  return null;
}

// 今日の使用回数をリセット（日付が変わった場合）
function resetDailyUsageIfNeeded(userId) {
  const user = getOrCreateUser(userId);
  const today = new Date().toISOString().split('T')[0];
  
  if (user.usageCount.lastResetDate !== today) {
    updateUser(userId, {
      usageCount: {
        today: 0,
        lastResetDate: today
      }
    });
  }
}

// 使用回数をインクリメント
function incrementUsageCount(userId) {
  resetDailyUsageIfNeeded(userId);
  const user = getOrCreateUser(userId);
  
  updateUser(userId, {
    usageCount: {
      today: user.usageCount.today + 1,
      lastResetDate: user.usageCount.lastResetDate
    },
    lastUsedAt: new Date().toISOString()
  });
}

// プラン変更後の使用回数を取得
function getUsageCountAfterPlanChange(user) {
  // planChangedAtがない場合は今日の使用回数を返す
  if (!user.planChangedAt) {
    return user.usageCount.today;
  }
  
  const planChangedAt = new Date(user.planChangedAt);
  const readingHistory = user.readingHistory || [];
  
  // プラン変更後の今日の占い回数をカウント
  const today = new Date().toISOString().split('T')[0];
  const usedAfterPlanChange = readingHistory.filter(reading => {
    const readingDate = new Date(reading.timestamp);
    const readingDateStr = readingDate.toISOString().split('T')[0];
    return readingDateStr === today && readingDate >= planChangedAt;
  }).length;
  
  return usedAfterPlanChange;
}

// 使用可能回数をチェック
function canUseReading(userId) {
  resetDailyUsageIfNeeded(userId);
  const user = getOrCreateUser(userId);
  
  // 無料プラン：初回のみ
  if (user.plan === 'free') {
    return !user.freeReadingUsed;
  }
  
  // 単品購入：常にOK（購入時にチェック）
  if (user.plan === 'single') {
    return true;
  }
  
  // ライト：1日1回
  if (user.plan === 'light') {
    const usedAfterPlanChange = getUsageCountAfterPlanChange(user);
    return usedAfterPlanChange < 1;
  }
  
  // スタンダード・プレミアム：1日2回
  if (user.plan === 'standard' || user.plan === 'premium') {
    const usedAfterPlanChange = getUsageCountAfterPlanChange(user);
    return usedAfterPlanChange < 2;
  }
  
  return false;
}

// 会話状態の更新
function updateConversationState(userId, updates) {
  const user = getOrCreateUser(userId);
  
  updateUser(userId, {
    conversationState: {
      ...user.conversationState,
      ...updates
    }
  });
}

// 会話のリセット
function resetConversation(userId) {
  updateConversationState(userId, {
    isInConversation: false,
    conversationCount: 0,
    conversationHistory: [],
    userQuestion: ''
  });
}

// 占い履歴の追加
function addReadingHistory(userId, reading) {
  const user = getOrCreateUser(userId);
  
  const history = user.readingHistory || [];
  history.unshift({
    ...reading,
    timestamp: new Date().toISOString()
  });
  
  // 最新50件のみ保持
  if (history.length > 50) {
    history.pop();
  }
  
  updateUser(userId, {
    readingHistory: history
  });
}

// サブスクリプション情報の更新
function updateSubscription(userId, subscriptionData) {
  updateUser(userId, {
    subscription: subscriptionData
  });
}

// 全ユーザーの取得（通知用）
function getAllUsers() {
  initDB();
  const db = readDB();
  return Object.values(db.users);
}

module.exports = {
  getOrCreateUser,
  updateUser,
  resetDailyUsageIfNeeded,
  incrementUsageCount,
  canUseReading,
  getUsageCountAfterPlanChange,
  updateConversationState,
  resetConversation,
  addReadingHistory,
  updateSubscription,
  getAllUsers
};
