# Stripe決済機能 実装サマリー

## 📅 実装日
2024年12月24日

## 🎯 実装内容

### 1. Stripe SDK統合
- **ファイル**: `index.js`
- **場所**: 3行目
- Stripe SDKを初期化し、環境変数からシークレットキーを読み込み

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
```

### 2. Price ID設定
- **ファイル**: `index.js`
- **場所**: 24-30行目
- 4つのプランのPrice IDを定義

```javascript
const STRIPE_PRICES = {
  single: 'price_1Shf37R7a9cchBiybxEXoWiL',      // 単品購入 380円
  light: 'price_1Shf5SR7a9cchBiyKmjKaMdK',       // ライト会員 3,000円/月
  standard: 'price_1Shf77R7a9cchBiykQXzYY6H',    // スタンダード会員 5,000円/月
  premium: 'price_1Shf8ER7a9cchBiyQ5GoWlTv'      // プレミアム会員 9,800円/3ヶ月
};
```

### 3. 決済ページ（LIFF）
- **ファイル**: `liff/payment.html`
- **新規作成**
- 4つのプランを表示する美しいUIページ
- プラン選択時にCheckout APIを呼び出し

**主な機能**:
- レスポンシブデザイン
- おすすめプランのバッジ表示
- LIFF SDK統合
- エラーハンドリング

### 4. Checkout Session作成API
- **ファイル**: `index.js`
- **場所**: 619-673行目
- **エンドポイント**: `POST /api/create-checkout-session`

**機能**:
- ユーザーIDとプランタイプを受け取る
- 単品購入と定期購読を自動判定
- Stripe Checkoutセッションを作成
- Checkout URLを返す

### 5. 決済成功ページ
- **ファイル**: `index.js`
- **場所**: 675-767行目
- **エンドポイント**: `GET /payment-success`

**機能**:
- Checkoutセッション情報を取得
- LINEに完了通知を送信
- 美しい成功ページを表示
- LIFF closeWindow機能

### 6. Webhook処理
- **ファイル**: `index.js`
- **場所**: 96-218行目
- **エンドポイント**: `POST /webhook/stripe`

**処理するイベント**:

#### `checkout.session.completed`（決済完了）
- 単品購入: プランを'single'に更新
- 定期購読: プランと終了日を設定

#### `customer.subscription.updated`（サブスクリプション更新）
- 自動更新時に終了日を延長

#### `customer.subscription.deleted`（サブスクリプションキャンセル）
- プランを'free'に戻す
- LINEに通知送信

---

## 📁 ファイル構成

```
tarot-linebot/
├── index.js                    # メインサーバーファイル（Stripe統合済み）
├── liff/
│   ├── payment.html           # 決済ページ（新規作成）
│   ├── general-reading.html   # 一般占いページ（既存）
│   └── love-reading.html      # 恋愛占いページ（既存）
├── STRIPE_SETUP.md            # セットアップガイド（新規作成）
├── ENV_VARIABLES.txt          # 環境変数リスト（新規作成）
└── IMPLEMENTATION_SUMMARY.md  # このファイル（新規作成）
```

---

## 🔑 必要な環境変数

### Renderで設定が必要

1. **STRIPE_SECRET_KEY**
   - テスト: `sk_test_XXXXX`（Stripe Dashboardから取得）
   - 本番: `sk_live_XXXXX`（承認後に取得）

2. **STRIPE_WEBHOOK_SECRET**
   - Webhook作成後に取得: `whsec_xxxxx`

3. **BASE_URL**
   - あなたのRenderアプリURL: `https://your-app-name.onrender.com`

---

## 🔗 必要な外部設定

### 1. LIFF アプリ作成
- **場所**: LINE Developers Console
- **Endpoint URL**: `https://your-app-name.onrender.com/liff/payment.html`
- **Size**: Full
- **取得するもの**: LIFF ID（`2006803301-xxxxxxxx`）

### 2. payment.htmlの更新
- 2箇所のLIFF IDを更新（332行目と759行目）

### 3. Stripe Webhook作成
- **場所**: Stripe Dashboard → 開発者 → Webhook
- **URL**: `https://your-app-name.onrender.com/webhook/stripe`
- **イベント**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

---

## 💳 料金プラン

| プラン | 金額 | タイプ | 機能 |
|--------|------|--------|------|
| 単品購入 | ¥380 | 都度払い | 1回のみ |
| ライト会員 | ¥3,000/月 | 定期購読 | 月10回まで |
| スタンダード会員 | ¥5,000/月 | 定期購読 | 月30回まで（おすすめ） |
| プレミアム会員 | ¥9,800/3ヶ月 | 定期購読 | 無制限 |

---

## 🧪 テスト方法

### テストカード情報

```
カード番号: 4242 4242 4242 4242
有効期限: 12/34
CVC: 123
郵便番号: 123-4567
```

### テストフロー

1. LIFFページを開く
2. プランを選択
3. Stripe Checkoutで決済
4. 成功ページ表示
5. LINE通知確認
6. users.jsonでプラン更新確認

---

## 🚀 デプロイ手順

### 1. コードをGitHubにプッシュ

```bash
cd /home/ubuntu/tarot-linebot
git add .
git commit -m "Add Stripe payment integration"
git push origin main
```

### 2. Renderで環境変数を設定

- `STRIPE_SECRET_KEY`
- `BASE_URL`

### 3. Renderが自動デプロイ

### 4. LIFF アプリを作成

### 5. payment.htmlのLIFF IDを更新してプッシュ

### 6. Stripe Webhookを作成

### 7. `STRIPE_WEBHOOK_SECRET`を環境変数に追加

### 8. テスト実行

---

## 📝 重要な注意事項

### セキュリティ

- ✅ APIキーは環境変数で管理
- ✅ Webhook署名を検証
- ✅ ユーザーIDをmetadataで管理
- ✅ 価格はサーバー側で定義（クライアントから受け取らない）

### データ管理

- ユーザープランは`users.json`に保存
- サブスクリプションIDを保存（キャンセル時に使用）
- 終了日を保存（自動更新の管理）

### エラーハンドリング

- Checkout作成失敗時のエラー表示
- Webhook処理失敗時のログ出力
- LIFF初期化失敗時のエラー表示

---

## 🔄 今後の改善案

### 短期

1. ユーザーダッシュボード追加
   - 現在のプラン表示
   - 使用回数表示
   - サブスクリプション管理

2. プラン変更機能
   - アップグレード
   - ダウングレード

3. 領収書発行
   - Stripe Invoiceとの連携

### 長期

1. データベース移行
   - JSON → PostgreSQL/MongoDB

2. 分析機能
   - 売上レポート
   - ユーザー行動分析

3. マーケティング
   - クーポン機能
   - 紹介プログラム

---

## 📞 サポート

問題が発生した場合：

1. **STRIPE_SETUP.md**のトラブルシューティングを確認
2. Renderのログを確認
3. Stripeダッシュボードのイベントログを確認
4. `users.json`の内容を確認

---

## ✅ チェックリスト

デプロイ前に確認：

- [ ] 環境変数が設定されている
- [ ] LIFF アプリが作成されている
- [ ] payment.htmlのLIFF IDが更新されている
- [ ] Stripe Webhookが作成されている
- [ ] テストカードで決済テストが成功している
- [ ] Webhookイベントが正しく処理されている
- [ ] users.jsonでプランが更新されている

---

**実装者**: Manus AI  
**実装日**: 2024年12月24日  
**バージョン**: 1.0（テスト環境）  
**ステータス**: ✅ 実装完了（テスト準備完了）
