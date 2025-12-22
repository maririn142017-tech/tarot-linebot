// 機能テストスクリプト v2

const db = require('./database');
const usageLimiter = require('./usage-limiter');
const themeSelector = require('./theme-selector');
const support = require('./support');

console.log('🧪 機能テスト v2 開始\n');

const testUserId = 'test-user-v2-123';
const testDisplayName = 'テストユーザーv2';

// テスト1: テーマ選択機能
console.log('【テスト1】テーマ選択機能');
console.log('一般占いのテーマ選択メッセージ:');
const generalMessage = themeSelector.getGeneralThemeSelectionMessage();
console.log(generalMessage.substring(0, 100) + '...');
console.log('');

console.log('恋愛占いのテーマ選択メッセージ:');
const loveMessage = themeSelector.getLoveThemeSelectionMessage();
console.log(loveMessage.substring(0, 100) + '...');
console.log('');

// テスト2: テーマ選択状態の管理
console.log('【テスト2】テーマ選択状態の管理');
themeSelector.setThemeSelectionState(testUserId, 'general');
const state1 = themeSelector.getThemeSelectionState(testUserId);
console.log('✅ テーマ選択中:', state1.isSelecting);
console.log('   タイプ:', state1.type);
console.log('');

// テスト3: テーマの選択
console.log('【テスト3】テーマの選択');
const selectedTheme = themeSelector.selectTheme(testUserId, '1', 'general');
console.log('✅ 選択したテーマ:', selectedTheme.name);
console.log('   絵文字:', selectedTheme.emoji);
console.log('   キーワード:', selectedTheme.keyword);
console.log('');

// テスト4: テーマプレフィックス
console.log('【テスト4】テーマプレフィックス');
const prefix = themeSelector.getThemePrefix(selectedTheme, 'general');
console.log('✅ プレフィックス:', prefix.trim());
console.log('');

// テスト5: 恋愛テーマの数
console.log('【テスト5】恋愛テーマの数');
const loveThemes = themeSelector.getLoveThemes();
console.log('✅ 恋愛テーマ数:', Object.keys(loveThemes).length);
console.log('   テーマ一覧:');
Object.entries(loveThemes).forEach(([key, theme]) => {
  console.log(`   ${key}. ${theme.emoji} ${theme.name}`);
});
console.log('');

// テスト6: 一般テーマの数
console.log('【テスト6】一般テーマの数');
const generalThemes = themeSelector.getGeneralThemes();
console.log('✅ 一般テーマ数:', Object.keys(generalThemes).length);
console.log('   テーマ一覧:');
Object.entries(generalThemes).forEach(([key, theme]) => {
  console.log(`   ${key}. ${theme.emoji} ${theme.name}`);
});
console.log('');

// テスト7: サポート機能の開始
console.log('【テスト7】サポート機能の開始');
const supportGreeting = support.startSupport(testUserId, testDisplayName);
console.log('✅ サポート挨拶:');
console.log(supportGreeting.substring(0, 100) + '...');
console.log('');

// テスト8: サポート中かチェック
console.log('【テスト8】サポート中かチェック');
const isInSupport = support.isInSupport(testUserId);
console.log('✅ サポート中:', isInSupport);
console.log('');

// テスト9: サポート終了
console.log('【テスト9】サポート終了');
support.endSupport(testUserId);
const isInSupport2 = support.isInSupport(testUserId);
console.log('✅ サポート中:', isInSupport2);
console.log('');

// テスト10: データベースの状態確認
console.log('【テスト10】データベースの状態確認');
const user = db.getOrCreateUser(testUserId);
console.log('✅ ユーザーID:', user.userId);
console.log('   表示名:', user.displayName);
console.log('   プラン:', user.plan);
console.log('   テーマ選択状態:', user.themeSelection ? user.themeSelection.isSelecting : 'なし');
console.log('   サポート状態:', user.supportState ? user.supportState.isInSupport : 'なし');
console.log('');

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
