# 🔧 バグ修正の詳細レポート

## 📋 修正概要

サブスクリプション会員が単品購入した際に、既存のプランが上書きされてしまうバグを修正し、単品購入回数を別途カウントする機能を実装しました。

---

## ✅ 修正1: 単品購入時の処理修正（サブスク会員のプランを上書きしない）

### 📍 ファイル: `server.js` (157-184行目)

### 🐛 修正前の問題
- プレミアム会員が単品購入すると、`plan` が `'single'` に上書きされる
- プレミアム会員の権限（1日2回の占い）が失われる
- サブスクリプションの状態が消失する

### ✨ 修正後の動作

```javascript
// 単品購入の場合
const user = db.getOrCreateUser(userId);

// サブスクリプション会員かどうかをチェック
const isSubscriptionUser = ['light', 'standard', 'premium'].includes(user.plan);

if (isSubscriptionUser) {
  // サブスクリプション会員の場合、プランを上書きせず、単品購入回数を増やす
  const currentCount = user.singlePurchaseCount || 0;
  db.updateUser(userId, {
    singlePurchaseCount: currentCount + 1
  });
  console.log(`Subscription user purchased single reading: userId=${userId}, singlePurchaseCount=${currentCount + 1}`);
} else {
  // 無料または単品購入ユーザーの場合、プランを変更
  const updates = {
    plan: 'single',
    freeReadingUsed: false // 単品購入でリセット
  };
  
  // planChangedAtが設定されていない場合のみ記録
  if (!user.planChangedAt) {
    updates.planChangedAt = new Date().toISOString();
  }
  
  db.updateUser(userId, updates);
  console.log(`User upgraded to single purchase: userId=${userId}`);
}
```

### 🎯 修正のポイント

1. **サブスク会員の判定**: `['light', 'standard', 'premium'].includes(user.plan)` で判定
2. **プラン保護**: サブスク会員の場合、`plan` フィールドを変更しない
3. **単品購入カウント**: `singlePurchaseCount` を +1 する
4. **既存ユーザー対応**: 無料・単品購入ユーザーは従来通りプランを変更

### 📊 動作例

**ケース1: プレミアム会員が単品購入**
```
購入前: { plan: 'premium', singlePurchaseCount: 0 }
購入後: { plan: 'premium', singlePurchaseCount: 1 }  ← プランは維持！
```

**ケース2: 無料ユーザーが単品購入**
```
購入前: { plan: 'free', freeReadingUsed: true }
購入後: { plan: 'single', freeReadingUsed: false }  ← 従来通り
```

---

## ✅ 修正2: マイページ表示更新（単品購入回数を含めた残り回数表示）

### 📍 ファイル: `liff/mypage.html` (272-296行目)

### 🐛 修正前の問題
- 単品購入回数が残り回数に反映されない
- プレミアム会員が単品購入しても「残り2回」のまま
- ユーザーが追加購入した分が見えない

### ✨ 修正後の動作

```javascript
// サブスクリプション（ライト・スタンダード・プレミアム）の場合
// プラン変更後の使用回数を使用
const usedCount = data.usageCountAfterPlanChange !== undefined ? data.usageCountAfterPlanChange : data.usageCount.today;
const singlePurchaseCount = data.singlePurchaseCount || 0;
const totalLimit = planInfo.dailyLimit + singlePurchaseCount;
const remaining = Math.max(0, totalLimit - usedCount); // マイナスにならないように

// 単品購入がある場合は詳細を表示
let remainingText = `${remaining}回`;
if (singlePurchaseCount > 0) {
  remainingText += ` (プラン${planInfo.dailyLimit}回 + 単品${singlePurchaseCount}回)`;
}

usageInfo.innerHTML = `
  <div class="usage-info">
    <span class="usage-label">今日の残り回数</span>
    <span class="usage-value">${remainingText}</span>
  </div>
  <div class="usage-info">
    <span class="usage-label">今日の利用回数</span>
    <span class="usage-value">${data.usageCount.today}回</span>
  </div>
`;
```

### 🎯 修正のポイント

1. **合計制限の計算**: `totalLimit = planInfo.dailyLimit + singlePurchaseCount`
2. **残り回数の計算**: `remaining = totalLimit - usedCount`
3. **詳細表示**: 単品購入がある場合は内訳を表示
4. **視認性向上**: 「(プラン2回 + 単品3回)」のように明示

### 📊 表示例

**ケース1: プレミアム会員（単品購入なし）**
```
今日の残り回数: 2回
今日の利用回数: 0回
```

**ケース2: プレミアム会員（単品購入3回）**
```
今日の残り回数: 5回 (プラン2回 + 単品3回)
今日の利用回数: 0回
```

**ケース3: プレミアム会員（単品購入3回、1回使用済み）**
```
今日の残り回数: 4回 (プラン2回 + 単品3回)
今日の利用回数: 1回
```

**ケース4: ライト会員（単品購入1回、使用済み）**
```
今日の残り回数: 1回 (プラン1回 + 単品1回)
今日の利用回数: 1回
```

---

## 🔄 その他の関連修正

### 3. 利用制限チェックの修正 (`database.js`)

```javascript
// ライト：1日1回 + 単品購入回数
if (user.plan === 'light') {
  const usedAfterPlanChange = getUsageCountAfterPlanChange(user);
  const singlePurchaseCount = user.singlePurchaseCount || 0;
  const totalLimit = 1 + singlePurchaseCount;
  return usedAfterPlanChange < totalLimit;
}

// スタンダード・プレミアム：1日2回 + 単品購入回数
if (user.plan === 'standard' || user.plan === 'premium') {
  const usedAfterPlanChange = getUsageCountAfterPlanChange(user);
  const singlePurchaseCount = user.singlePurchaseCount || 0;
  const totalLimit = 2 + singlePurchaseCount;
  return usedAfterPlanChange < totalLimit;
}
```

### 4. 日次リセット機能の修正 (`database.js`)

```javascript
function resetDailyUsageIfNeeded(userId) {
  const user = getOrCreateUser(userId);
  const today = new Date().toISOString().split('T')[0];
  
  if (user.usageCount.lastResetDate !== today) {
    updateUser(userId, {
      usageCount: {
        today: 0,
        lastResetDate: today
      },
      singlePurchaseCount: 0  // 単品購入回数もリセット
    });
  }
}
```

---

## 🧪 テストシナリオ

### シナリオ1: プレミアム会員が単品購入
1. プレミアム会員としてログイン
2. 単品購入（500円）を実行
3. **期待結果**: 
   - `plan` が `'premium'` のまま
   - `singlePurchaseCount` が 1 になる
   - マイページに「残り3回 (プラン2回 + 単品1回)」と表示

### シナリオ2: プレミアム会員が複数回単品購入
1. プレミアム会員としてログイン
2. 単品購入を3回実行
3. **期待結果**:
   - `plan` が `'premium'` のまま
   - `singlePurchaseCount` が 3 になる
   - マイページに「残り5回 (プラン2回 + 単品3回)」と表示

### シナリオ3: 単品購入後に占いを実行
1. プレミアム会員が単品購入（singlePurchaseCount = 1）
2. 占いを1回実行
3. **期待結果**:
   - マイページに「残り2回 (プラン2回 + 単品1回)」と表示
   - `usageCount.today` が 1 になる

### シナリオ4: 日付変更後のリセット
1. プレミアム会員が単品購入3回（singlePurchaseCount = 3）
2. 占いを2回実行（usageCount.today = 2）
3. 日付が変わる（翌日0時）
4. **期待結果**:
   - `singlePurchaseCount` が 0 にリセット
   - `usageCount.today` が 0 にリセット
   - マイページに「残り2回」と表示（プランのみ）

---

## 📝 データ構造の変更

### 新規フィールド: `singlePurchaseCount`

```javascript
{
  userId: "U1234567890abcdef",
  plan: "premium",
  singlePurchaseCount: 3,  // ← 新規追加
  usageCount: {
    today: 1,
    lastResetDate: "2025-12-28"
  },
  planChangedAt: "2025-12-28T10:30:00.000Z",
  // ... その他のフィールド
}
```

### リセットタイミング
- **毎日0時**: `singlePurchaseCount` は 0 にリセット
- **プラン変更時**: リセットしない（プランとは独立）

---

## 🚀 デプロイ方法

```bash
cd /home/ubuntu/tarot-linebot
git add database.js liff/mypage.html server.js
git commit -m "サブスク会員の単品購入機能を実装: プラン上書きバグを修正し、単品購入回数を別カウント"
git push origin main
```

Renderが自動的にデプロイを開始します。

---

## ✅ 修正完了チェックリスト

- [x] 単品購入時にサブスク会員のプランを保護
- [x] `singlePurchaseCount` フィールドの追加
- [x] 利用制限チェックに単品購入回数を反映
- [x] マイページ表示に単品購入回数を反映
- [x] 日次リセット機能に単品購入回数を追加
- [x] コードのコミット準備完了
- [ ] GitHubへのプッシュ（認証待ち）
- [ ] Renderでの自動デプロイ
- [ ] 本番環境でのテスト

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **Renderのログ**: デプロイエラーがないか
2. **LINEのログ**: Webhook エラーがないか
3. **Firestoreのデータ**: `singlePurchaseCount` が正しく記録されているか

---

**作成日**: 2025-12-28  
**コミットID**: 954de5b
