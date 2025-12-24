# 🚀 Stripe決済機能 デプロイチェックリスト

## ✅ 実装完了項目

- [x] Stripe SDK統合 (`index.js`)
- [x] Price ID設定（4プラン）
- [x] 決済ページ作成 (`liff/payment.html`)
- [x] Checkout Session作成API (`/api/create-checkout-session`)
- [x] 決済成功ページ (`/payment-success`)
- [x] Webhook処理 (`/webhook/stripe`)
- [x] ドキュメント作成

---

## 📋 デプロイ前チェックリスト

### 1. 環境変数の設定（Render）

- [ ] **STRIPE_SECRET_KEY** を追加
  ```
  sk_test_XXXXX（Stripe Dashboardからコピー）
  ```

- [ ] **BASE_URL** を追加
  ```
  https://your-app-name.onrender.com
  ```
  ⚠️ 実際のRenderアプリURLに置き換えてください

### 2. コードのプッシュ

- [ ] GitHubリポジトリにプッシュ
  ```bash
  git add .
  git commit -m "Add Stripe payment integration"
  git push origin main
  ```

- [ ] Renderで自動デプロイが開始される
- [ ] デプロイログでエラーがないか確認

### 3. LIFF アプリの作成

- [ ] LINE Developers Consoleにログイン
- [ ] チャネルを選択
- [ ] **LIFF** タブを開く
- [ ] **Add** をクリック

#### LIFF設定内容

- [ ] **LIFF app name**: `タロット占い - 料金プラン`
- [ ] **Size**: `Full`
- [ ] **Endpoint URL**: `https://your-app-name.onrender.com/liff/payment.html`
- [ ] **Scope**: 
  - [x] `profile`
  - [x] `openid`
- [ ] **Bot link feature**: `On (Normal)`

- [ ] **LIFF ID**をコピー（`2006803301-xxxxxxxx`形式）

### 4. payment.htmlの更新

- [ ] `liff/payment.html` を開く
- [ ] **332行目**のLIFF IDを更新
  ```javascript
  await liff.init({ liffId: 'あなたのLIFF ID' });
  ```

- [ ] **759行目**のLIFF IDも更新
  ```javascript
  await liff.init({ liffId: 'あなたのLIFF ID' });
  ```

- [ ] GitHubにプッシュ
  ```bash
  git add liff/payment.html
  git commit -m "Update LIFF ID in payment.html"
  git push origin main
  ```

### 5. Stripe Webhookの作成

- [ ] Stripe Dashboardにログイン
- [ ] **開発者** → **Webhook** を開く
- [ ] **エンドポイントを追加** をクリック

#### Webhook設定内容

- [ ] **エンドポイントURL**: `https://your-app-name.onrender.com/webhook/stripe`
- [ ] **説明**: `タロット占いLINEボット - 決済通知`
- [ ] **リッスンするイベント**:
  - [x] `checkout.session.completed`
  - [x] `customer.subscription.updated`
  - [x] `customer.subscription.deleted`

- [ ] **署名シークレット**をコピー（`whsec_...`形式）

### 6. Webhook Secretの設定

- [ ] Renderの環境変数に **STRIPE_WEBHOOK_SECRET** を追加
  ```
  whsec_xxxxx（Stripeからコピーした値）
  ```

- [ ] Renderが自動的に再デプロイされる

---

## 🧪 テスト手順

### 1. 基本動作確認

- [ ] Renderアプリが起動している
  ```
  https://your-app-name.onrender.com
  ```
  → "Tarot LINE Bot is running!" が表示される

- [ ] LIFFページが開く
  ```
  https://liff.line.me/あなたのLIFF ID
  ```
  → 決済ページが表示される

### 2. 決済テスト

#### テストカード情報
```
カード番号: 4242 4242 4242 4242
有効期限: 12/34
CVC: 123
郵便番号: 123-4567
```

#### テスト手順

- [ ] LIFFページを開く
- [ ] **単品購入（380円）**を選択
- [ ] Stripe Checkoutページが開く
- [ ] テストカード情報を入力
- [ ] **支払う**をクリック
- [ ] 決済成功ページが表示される
- [ ] LINEに完了通知が届く

### 3. Webhook確認

- [ ] Stripe Dashboard → **開発者** → **Webhook**
- [ ] 作成したWebhookをクリック
- [ ] **イベント**タブで `checkout.session.completed` が表示される
- [ ] ステータスが **成功** になっている

### 4. データ確認

- [ ] Renderのログで以下を確認
  ```
  Payment completed: userId=U..., planType=single
  User plan updated: userId=U..., plan=single
  ```

- [ ] `users.json` でプランが更新されている
  ```json
  {
    "userId": "U...",
    "plan": "single",
    ...
  }
  ```

### 5. 各プランのテスト

- [ ] **単品購入（380円）** - 成功
- [ ] **ライト会員（3,000円/月）** - 成功
- [ ] **スタンダード会員（5,000円/月）** - 成功
- [ ] **プレミアム会員（9,800円/3ヶ月）** - 成功

---

## 🔍 トラブルシューティング

### LIFFページが開かない

- [ ] LIFF IDが正しいか確認
- [ ] Endpoint URLが正しいか確認
- [ ] Renderアプリが起動しているか確認

### Checkoutセッションが作成できない

- [ ] 環境変数 `STRIPE_SECRET_KEY` が設定されているか確認
- [ ] Renderのログでエラーメッセージを確認
- [ ] Price IDが正しいか確認

### Webhookが動作しない

- [ ] Webhook URLが正しいか確認（`/webhook/stripe`）
- [ ] 環境変数 `STRIPE_WEBHOOK_SECRET` が設定されているか確認
- [ ] Stripe Dashboard → Webhook → イベントログを確認
- [ ] Renderのログでエラーを確認

### プランが更新されない

- [ ] Webhookが正しく動作しているか確認
- [ ] Renderのログで `User plan updated` を確認
- [ ] `users.json` の内容を確認

---

## 📱 LINEボットへの統合

### リッチメニューにボタンを追加

決済ページへのリンクをリッチメニューに追加することをおすすめします。

#### 方法1: URLアクションで直接リンク

```
https://liff.line.me/あなたのLIFF ID
```

#### 方法2: テキストメッセージで案内

ユーザーが「料金プラン」とメッセージを送ったら、決済ページのURLを返信する。

`index.js` に以下を追加：

```javascript
if (userMessage === '料金プラン' || userMessage === '料金') {
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '💳 料金プランはこちらからご確認いただけます！\n\nhttps://liff.line.me/あなたのLIFF ID'
  });
}
```

---

## 🎯 本番環境への移行

テストが完了したら、本番環境に移行します。

### 1. Stripe本番承認を待つ

- [ ] Stripeから承認メールが届く（1-2営業日）

### 2. 本番APIキーを取得

- [ ] Stripe Dashboard → **開発者** → **APIキー**
- [ ] **本番環境**に切り替え
- [ ] Secret Keyをコピー

### 3. 本番用Price IDを作成

- [ ] Stripe Dashboard → **商品**
- [ ] 本番環境で4つの商品を作成
- [ ] 各Price IDをコピー

### 4. 環境変数を更新

- [ ] Renderで `STRIPE_SECRET_KEY` を本番キーに変更
  ```
  sk_live_xxxxx
  ```

### 5. index.jsを更新

- [ ] `STRIPE_PRICES` を本番Price IDに変更
  ```javascript
  const STRIPE_PRICES = {
    single: 'price_xxxxx',      // 本番Price ID
    light: 'price_xxxxx',
    standard: 'price_xxxxx',
    premium: 'price_xxxxx'
  };
  ```

- [ ] GitHubにプッシュ

### 6. 本番Webhookを作成

- [ ] Stripe Dashboard（本番環境）でWebhookを作成
- [ ] Webhook Secretを環境変数に設定

### 7. 本番テスト

- [ ] 少額の実決済でテスト
- [ ] すぐに返金処理

---

## 📊 監視とメンテナンス

### 定期的に確認すること

- [ ] Stripe Dashboard → **支払い** で決済状況を確認
- [ ] Stripe Dashboard → **サブスクリプション** で会員状況を確認
- [ ] Renderのログでエラーがないか確認
- [ ] `users.json` のバックアップを取る

### 月次レポート

- [ ] 売上集計
- [ ] 新規会員数
- [ ] 解約数
- [ ] エラー発生状況

---

## 📝 重要な注意事項

⚠️ **セキュリティ**
- APIキーは絶対に公開しない
- Webhook Secretは環境変数で管理
- GitHubにAPIキーをコミットしない

⚠️ **テスト**
- 本番環境に移行する前に必ずテストを完了する
- テスト環境では実際の請求は発生しない

⚠️ **サポート**
- ユーザーからの問い合わせに対応できる体制を整える
- 返金ポリシーを明確にする

---

## ✅ 最終確認

すべてのチェックボックスにチェックが入ったら、デプロイ完了です！🎉

- [ ] 環境変数が設定されている
- [ ] コードがGitHubにプッシュされている
- [ ] Renderでデプロイが成功している
- [ ] LIFF アプリが作成されている
- [ ] payment.htmlのLIFF IDが更新されている
- [ ] Stripe Webhookが作成されている
- [ ] Webhook Secretが設定されている
- [ ] テストカードで決済テストが成功している
- [ ] Webhookイベントが正しく処理されている
- [ ] users.jsonでプランが更新されている
- [ ] LINEに通知が届いている

---

**作成日**: 2024年12月24日  
**バージョン**: 1.0（テスト環境）  
**ステータス**: ✅ 実装完了（デプロイ準備完了）

---

## 📞 サポート

問題が発生した場合は、以下のドキュメントを参照してください：

- **STRIPE_SETUP.md**: 詳細なセットアップガイド
- **IMPLEMENTATION_SUMMARY.md**: 実装内容のサマリー
- **PAYMENT_FLOW.txt**: 決済フローの簡易説明
- **ENV_VARIABLES.txt**: 環境変数のリスト

---

**頑張ってください！🚀✨**
