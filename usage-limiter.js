// 利用制限チェックモジュール

const db = require('./database');

// プラン別の制限情報
const PLAN_LIMITS = {
  free: {
    name: '無料',
    dailyLimit: 0, // 初回1回のみ
    hasLuka: false,
    price: 0
  },
  single: {
    name: '単品購入',
    dailyLimit: 999, // 実質無制限（購入ごと）
    hasLuka: true,
    price: 380
  },
  light: {
    name: 'ライト会員',
    dailyLimit: 1,
    hasLuka: true,
    price: 3000
  },
  standard: {
    name: 'スタンダード会員',
    dailyLimit: 2,
    hasLuka: true,
    price: 5000
  },
  premium: {
    name: 'プレミアム会員',
    dailyLimit: 2,
    hasLuka: true,
    price: 9800,
    duration: '3ヶ月'
  }
};

// 使用可能かチェック
function checkUsageLimit(userId) {
  const user = db.getOrCreateUser(userId);
  const canUse = db.canUseReading(userId);
  const plan = PLAN_LIMITS[user.plan];
  
  return {
    canUse,
    user,
    plan,
    remainingToday: plan.dailyLimit - user.usageCount.today,
    message: canUse ? null : generateLimitMessage(user, plan)
  };
}

// 制限メッセージの生成
function generateLimitMessage(user, plan) {
  if (user.plan === 'free') {
    return `無料占いは初回1回のみです✨

もっと占いたい方は：

💫 単品購入：380円/回
　→ 何回でもOK！ルカとの会話あり

👑 月額会員：
　・ライト：3,000円/月（1日1回）
　・スタンダード：5,000円/月（1日2回）
　・プレミアム：9,800円/3ヶ月（1日2回）

下のメニューから「決済」をタップしてね🎶`;
  }
  
  if (user.plan === 'light') {
    return `本日の占い回数（1回）を使い切りました😊

また明日お待ちしています✨

もっと占いたい方は：
・スタンダード会員：1日2回
・プレミアム会員：1日2回（3ヶ月でお得）

プラン変更は「決済」から🎶`;
  }
  
  if (user.plan === 'standard' || user.plan === 'premium') {
    return `本日の占い回数（2回）を使い切りました😊

また明日お待ちしています✨

ありがとうございます💕`;
  }
  
  return '本日の利用回数を超えました。';
}

// ルカが使えるかチェック
function canUseLuka(userId) {
  const user = db.getOrCreateUser(userId);
  const plan = PLAN_LIMITS[user.plan];
  
  return plan.hasLuka;
}

// 初回ユーザーかチェック
function isFirstTimeUser(userId) {
  const user = db.getOrCreateUser(userId);
  return !user.freeReadingUsed && user.plan === 'free';
}

// 占い実行後の処理
function afterReading(userId) {
  const user = db.getOrCreateUser(userId);
  
  // 使用回数をインクリメント
  db.incrementUsageCount(userId);
  
  // 無料プランの場合、使用済みフラグを立てる
  if (user.plan === 'free') {
    db.updateUser(userId, {
      freeReadingUsed: true
    });
  }
}

// プラン情報の取得
function getPlanInfo(planType) {
  return PLAN_LIMITS[planType] || PLAN_LIMITS.free;
}

// 全プラン情報の取得
function getAllPlans() {
  return PLAN_LIMITS;
}

module.exports = {
  checkUsageLimit,
  canUseLuka,
  isFirstTimeUser,
  afterReading,
  getPlanInfo,
  getAllPlans,
  PLAN_LIMITS
};
