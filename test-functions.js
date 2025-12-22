// 機能テストスクリプト

const db = require('./database');
const usageLimiter = require('./usage-limiter');

console.log('🧪 機能テスト開始\n');

// テスト1: ユーザー作成
console.log('【テスト1】ユーザー作成');
const testUserId = 'test-user-123';
const user = db.getOrCreateUser(testUserId, 'テストユーザー');
console.log('✅ ユーザー作成成功:', user.displayName);
console.log('   プラン:', user.plan);
console.log('   無料占い使用済み:', user.freeReadingUsed);
console.log('');

// テスト2: 初回ユーザーチェック
console.log('【テスト2】初回ユーザーチェック');
const isFirstTime = usageLimiter.isFirstTimeUser(testUserId);
console.log('✅ 初回ユーザー:', isFirstTime);
console.log('');

// テスト3: 使用可能チェック
console.log('【テスト3】使用可能チェック（無料プラン）');
const limitCheck1 = usageLimiter.checkUsageLimit(testUserId);
console.log('✅ 使用可能:', limitCheck1.canUse);
console.log('   プラン:', limitCheck1.plan.name);
console.log('');

// テスト4: 占い実行後
console.log('【テスト4】占い実行後の処理');
usageLimiter.afterReading(testUserId);
const user2 = db.getOrCreateUser(testUserId);
console.log('✅ 無料占い使用済み:', user2.freeReadingUsed);
console.log('   使用回数:', user2.usageCount.today);
console.log('');

// テスト5: 2回目の使用チェック
console.log('【テスト5】2回目の使用チェック（制限）');
const limitCheck2 = usageLimiter.checkUsageLimit(testUserId);
console.log('✅ 使用可能:', limitCheck2.canUse);
if (!limitCheck2.canUse) {
  console.log('   制限メッセージ:');
  console.log('   ' + limitCheck2.message.split('\n')[0]);
}
console.log('');

// テスト6: プラン変更（ライト会員）
console.log('【テスト6】プラン変更（ライト会員）');
db.updateUser(testUserId, { plan: 'light' });
db.resetDailyUsageIfNeeded(testUserId);
const limitCheck3 = usageLimiter.checkUsageLimit(testUserId);
console.log('✅ 新プラン:', limitCheck3.plan.name);
console.log('   使用可能:', limitCheck3.canUse);
console.log('   1日の制限:', limitCheck3.plan.dailyLimit);
console.log('   ルカ使用可能:', limitCheck3.plan.hasLuka);
console.log('');

// テスト7: ルカ使用チェック
console.log('【テスト7】ルカ使用チェック');
const canUseLuka = usageLimiter.canUseLuka(testUserId);
console.log('✅ ルカ使用可能:', canUseLuka);
console.log('');

// テスト8: 会話状態の管理
console.log('【テスト8】会話状態の管理');
db.updateConversationState(testUserId, {
  isInConversation: true,
  conversationCount: 1,
  userQuestion: '彼氏のことで悩んでます'
});
const user3 = db.getOrCreateUser(testUserId);
console.log('✅ 会話中:', user3.conversationState.isInConversation);
console.log('   会話回数:', user3.conversationState.conversationCount);
console.log('   質問内容:', user3.conversationState.userQuestion);
console.log('');

// テスト9: 占い履歴の追加
console.log('【テスト9】占い履歴の追加');
db.addReadingHistory(testUserId, {
  type: 'tarot',
  cards: [
    { name: '愚者', reversed: false },
    { name: '魔術師', reversed: true },
    { name: '女教皇', reversed: false }
  ],
  result: 'テスト占い結果'
});
const user4 = db.getOrCreateUser(testUserId);
console.log('✅ 履歴件数:', user4.readingHistory.length);
console.log('   最新の占い:', user4.readingHistory[0].type);
console.log('');

// テスト10: 全プラン情報の取得
console.log('【テスト10】全プラン情報');
const allPlans = usageLimiter.getAllPlans();
Object.entries(allPlans).forEach(([key, plan]) => {
  console.log(`✅ ${plan.name}:`);
  console.log(`   1日の制限: ${plan.dailyLimit}回`);
  console.log(`   ルカ: ${plan.hasLuka ? 'あり' : 'なし'}`);
  console.log(`   料金: ${plan.price}円${plan.duration ? '/' + plan.duration : ''}`);
  console.log('');
});

console.log('🎉 全テスト完了！\n');

// クリーンアップ
console.log('🧹 テストデータをクリーンアップ中...');
const fs = require('fs');
const path = require('path');
const dbFile = path.join(__dirname, 'users.json');
if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('✅ テストデータ削除完了');
}
