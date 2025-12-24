# Stripe決済機能 セットアップガイド

## 📋 概要

このドキュメントでは、タロット占いLINEボットのStripe決済機能のセットアップ方法とテスト手順を説明します。

---

## 🔑 環境変数の設定

Renderダッシュボードで以下の環境変数を追加してください。

### 必須の環境変数

```bash
# Stripe APIキー（テスト環境）
STRIPE_SECRET_KEY=sk_test_XXXXX

# Stripe Webhook Secret（後で設定）
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# ベースURL（あなたのRenderアプリのURL）
BASE_URL=https://your-app-name.onrender.com
```

### 設定手順

1. **Renderダッシュボード**にログイン
2. あなたのアプリを選択
3. **Environment** タブを開く
4. **Add Environment Variable** をクリック
5. 上記の環境変数を追加
6. **Save Changes** をクリック
7. アプリが自動的に再デプロイされます

---

## 🔗 LIFF アプリの作成

決済ページ用のLIFFアプリを作成します。

### 手順

1. **LINE Developers Console**にログイン
2. あなたのチャネルを選択
3. **LIFF** タブを開く
4. **Add** をクリック

### LIFF設定

- **LIFF app name**: `タロット占い - 料金プラン`
- **Size**: `Full`
- **Endpoint URL**: `https://your-app-name.onrender.com/liff/payment.html`
- **Scope**: 
  - ✅ `profile`
  - ✅ `openid`
- **Bot link feature**: `On (Normal)`

### LIFF IDを取得

作成後、**LIFF ID**（`2006803301-xxxxxxxx`形式）をコピーしてください。

### payment.htmlを更新

`/home/ubuntu/tarot-linebot/liff/payment.html` の以下の行を更新：

```javascript
await liff.init({ liffId: '2006803301-0Qj3JLlb' }); // ← あなたのLIFF IDに変更
```

成功ページの以下の行も更新：

```javascript
await liff.init({ liffId: '2006803301-0Qj3JLlb' }); // ← あなたのLIFF IDに変更
```

---

## 🪝 Stripe Webhook の設定

Stripeからのイベント通知を受け取るためにWebhookを設定します。

### 手順

1. **Stripe Dashboard**にログイン
2. **開発者** → **Webhook** を開く
3. **エンドポイントを追加** をクリック

### Webhook設定

- **エンドポイントURL**: `https://your-app-name.onrender.com/webhook/stripe`
- **説明**: `タロット占いLINEボット - 決済通知`
- **リッスンするイベント**:
  - ✅ `checkout.session.completed`
  - ✅ `customer.subscription.updated`
  - ✅ `customer.subscription.deleted`

### Webhook Secretを取得

1. 作成したWebhookをクリック
2. **署名シークレット**をコピー（`whsec_...`形式）
3. Renderの環境変数 `STRIPE_WEBHOOK_SECRET` に設定

---

## 🧪 テスト方法

### 1. テストカード情報

Stripeのテスト環境では以下のカード情報を使用します。

#### 成功するカード

```
カード番号: 4242 4242 4242 4242
有効期限: 12/34（未来の日付ならOK）
CVC: 123（任意の3桁）
郵便番号: 123-4567（任意）
```

#### その他のテストカード

- **3Dセキュア認証が必要**: `4000 0027 6000 3184`
- **決済失敗**: `4000 0000 0000 0002`
- **カード拒否**: `4000 0000 0000 9995`

### 2. テストフロー

#### Step 1: 決済ページを開く

LINEトークで以下のメッセージを送信（または専用ボタンを追加）：

```
料金プラン
```

または、直接LIFFページを開く：

```
https://liff.line.me/2006803301-xxxxxxxx
```

#### Step 2: プランを選択

- 単品購入（380円）
- ライト会員（3,000円/月）
- スタンダード会員（5,000円/月）
- プレミアム会員（9,800円/3ヶ月）

#### Step 3: Stripe Checkoutで決済

1. テストカード情報を入力
2. **支払う** をクリック
3. 決済完了ページが表示される
4. LINEに完了通知が届く

#### Step 4: 確認

1. **Stripe Dashboard** → **支払い** で決済を確認
2. **users.json** でユーザープランが更新されたか確認

```bash
cat users.json
```

---

## 📊 プランと機能

### 単品購入（380円）

- タロット占い1回
- 都度払い
- 自動更新なし

### ライト会員（3,000円/月）

- 月10回まで占い放題
- 毎月自動更新
- いつでも解約可能

### スタンダード会員（5,000円/月）⭐おすすめ

- 月30回まで占い放題
- 特別な占いテーマ追加
- 毎月自動更新
- いつでも解約可能

### プレミアム会員（9,800円/3ヶ月）

- 無制限で占い放題
- 限定プレミアムテーマ
- 個別カスタマイズ鑑定
- 3ヶ月ごと自動更新
- いつでも解約可能

---

## 🔍 トラブルシューティング

### 決済ページが開かない

- LIFF IDが正しいか確認
- BASE_URLが正しいか確認
- Renderアプリが起動しているか確認

### Checkoutセッションが作成できない

- STRIPE_SECRET_KEYが設定されているか確認
- Renderのログを確認：`console.error`メッセージを探す

### Webhookが動作しない

- Webhook URLが正しいか確認（`/webhook/stripe`）
- STRIPE_WEBHOOK_SECRETが設定されているか確認
- Stripeダッシュボードで **Webhook** → **イベント** を確認

### プランが更新されない

- `users.json`を確認
- Webhookが正しく動作しているか確認
- Renderのログで `User plan updated` メッセージを探す

---

## 🚀 本番環境への移行

テストが完了したら、本番環境に移行します。

### 手順

1. **Stripe本番承認を待つ**（1-2営業日）
2. **本番APIキーを取得**
   - Stripe Dashboard → **開発者** → **APIキー**
   - **本番環境**に切り替え
   - Secret KeyとPublishable Keyをコピー

3. **環境変数を更新**
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxxxx
   ```

4. **本番用Price IDを作成**
   - Stripe Dashboard → **商品**
   - 4つの商品を本番環境で作成
   - Price IDをコピー

5. **index.jsを更新**
   ```javascript
   const STRIPE_PRICES = {
     single: 'price_xxxxx',      // 本番Price ID
     light: 'price_xxxxx',
     standard: 'price_xxxxx',
     premium: 'price_xxxxx'
   };
   ```

6. **本番Webhookを設定**
   - 本番環境用のWebhookエンドポイントを作成
   - Webhook Secretを環境変数に設定

7. **テスト実行**
   - 少額の実決済でテスト
   - すぐに返金処理

---

## 📝 メモ

- **テスト環境では実際の請求は発生しません**
- **本番環境に移行する前に必ずテストを完了してください**
- **Webhook Secretは絶対に公開しないでください**
- **APIキーは環境変数で管理し、コードにハードコードしないでください**

---

## 🆘 サポート

問題が発生した場合：

1. Renderのログを確認
2. Stripeダッシュボードのイベントログを確認
3. `users.json`の内容を確認
4. 環境変数が正しく設定されているか確認

---

**作成日**: 2024年12月24日  
**バージョン**: 1.0（テスト環境）
