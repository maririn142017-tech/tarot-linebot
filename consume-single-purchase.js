// 単品購入の消費処理
const db = require('./database');

async function consumeSinglePurchaseIfNeeded(userId) {
  try {
    // ユーザー情報を取得
    const user = await db.getOrCreateUser(userId);
    
    // 無料プランまたは単品購入プランの場合は処理不要
    if (user.plan === 'free' || user.plan === 'single') {
      return;
    }
    
    // サブスクリプション会員の場合のみ処理
    const planLimits = {
      light: 1,
      standard: 2,
      premium: 2
    };
    
    const dailyLimit = planLimits[user.plan] || 0;
    
    // プラン変更後の使用回数を取得
    const historyAfterPlanChange = await db.getReadingHistoryAfterPlanChange(userId);
    const usedAfterPlanChange = historyAfterPlanChange.length;
    
    // プランの1日制限を超えている場合、単品購入から消費
    if (usedAfterPlanChange > dailyLimit) {
      const singlePurchaseCount = user.singlePurchaseCount || 0;
      
      if (singlePurchaseCount > 0) {
        const newCount = singlePurchaseCount - 1;
        await db.updateUser(userId, { singlePurchaseCount: newCount });
        console.log(`✅ Single purchase consumed: userId=${userId}, remaining=${newCount}`);
      } else {
        console.log(`⚠️ No single purchase to consume: userId=${userId}`);
      }
    }
  } catch (error) {
    console.error('❌ consumeSinglePurchaseIfNeeded error:', error);
  }
}

module.exports = { consumeSinglePurchaseIfNeeded };
