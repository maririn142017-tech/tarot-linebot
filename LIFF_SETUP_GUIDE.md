# 🚀 LIFF実装ガイド

## 📋 概要

LINEの中でWebページを開いて、タロット占いのテーマ選択やカード解釈集を表示する機能を実装しました！

---

## ✅ 完成した機能

### 1️⃣ 一般占い選択ページ
- **ファイル**: `liff/general-reading.html`
- **テーマ**: 4種類
  - 💼 仕事運
  - 💰 金運
  - 🏥 健康運
  - 👥 人間関係運

### 2️⃣ 恋愛占い選択ページ
- **ファイル**: `liff/love-reading.html`
- **テーマ**: 9種類
  - 💭 相手の気持ち
  - 💑 2人の関係性
  - 🔮 恋の近未来
  - 📈 進展の可能性
  - ⚖️ 恋の決断
  - 💕 相手との相性
  - 🚧 恋の障害
  - 🔄 復縁の可能性
  - ✨ 新しい出会い

### 3️⃣ カード解釈集ページ
- **ファイル**: `liff/card-guide.html`
- **内容**: 78枚のタロットカード
  - 大アルカナ（22枚）
  - ワンド（14枚）
  - カップ（14枚）
  - ソード（14枚）
  - ペンタクル（14枚）
- **機能**: タップで正位置・逆位置の詳細表示

### 4️⃣ マイページ
- **ファイル**: `liff/mypage.html`
- **内容**:
  - 現在のプラン
  - 利用状況（残り回数）
  - 占い履歴（最新10件）

---

## 🛠️ LINE Developers設定手順

### ステップ1: LIFFアプリを作成

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダーを選択
3. チャンネルを選択
4. 左メニューから「LIFF」をクリック
5. 「追加」ボタンをクリック

### ステップ2: 一般占い用LIFFを設定

**設定内容：**
```
LIFFアプリ名: 一般占い選択
サイズ: Full
エンドポイントURL: https://your-app.onrender.com/liff/general-reading.html
Scope: profile, openid
ボットリンク機能: On (Aggressive)
```

**LIFF IDをコピー**して、`liff/general-reading.html`の以下の部分を修正：
```javascript
liffId: 'YOUR_LIFF_ID' // ← ここにLIFF IDを貼り付け
```

### ステップ3: 恋愛占い用LIFFを設定

**設定内容：**
```
LIFFアプリ名: 恋愛占い選択
サイズ: Full
エンドポイントURL: https://your-app.onrender.com/liff/love-reading.html
Scope: profile, openid
ボットリンク機能: On (Aggressive)
```

**LIFF IDをコピー**して、`liff/love-reading.html`の以下の部分を修正：
```javascript
liffId: 'YOUR_LIFF_ID' // ← ここにLIFF IDを貼り付け
```

### ステップ4: カード解釈集用LIFFを設定

**設定内容：**
```
LIFFアプリ名: カード解釈集
サイズ: Full
エンドポイントURL: https://your-app.onrender.com/liff/card-guide.html
Scope: profile, openid
ボットリンク機能: On (Aggressive)
```

**LIFF IDをコピー**して、`liff/card-guide.html`の以下の部分を修正：
```javascript
liffId: 'YOUR_LIFF_ID' // ← ここにLIFF IDを貼り付け
```

### ステップ5: マイページ用LIFFを設定

**設定内容：**
```
LIFFアプリ名: マイページ
サイズ: Full
エンドポイントURL: https://your-app.onrender.com/liff/mypage.html
Scope: profile, openid
ボットリンク機能: On (Aggressive)
```

**LIFF IDをコピー**して、`liff/mypage.html`の以下の部分を修正：
```javascript
liffId: 'YOUR_LIFF_ID' // ← ここにLIFF IDを貼り付け
```

---

## 🎨 リッチメニュー設定

### リッチメニューのボタンにLIFF URLを設定

**一般占いボタン：**
```
アクション: URI
URI: https://liff.line.me/{一般占い用LIFF_ID}
```

**恋愛占いボタン：**
```
アクション: URI
URI: https://liff.line.me/{恋愛占い用LIFF_ID}
```

**カード解釈集ボタン：**
```
アクション: URI
URI: https://liff.line.me/{カード解釈集用LIFF_ID}
```

**マイページボタン：**
```
アクション: URI
URI: https://liff.line.me/{マイページ用LIFF_ID}
```

---

## 📱 使い方の流れ

### 一般占いの場合

```
1. ユーザーがリッチメニュー「一般占い」をタップ
   ↓
2. LINEの中でWebページが開く
   （一般占い選択ページ）
   ↓
3. テーマをタップ（例：💼 仕事運）
   ↓
4. LINEのトーク画面に戻る
   「一般占い：仕事運」というメッセージが送信される
   ↓
5. ボットが占い結果を返す
```

### カード解釈集の場合

```
1. ユーザーがリッチメニュー「カード解釈集」をタップ
   ↓
2. LINEの中でWebページが開く
   （カード解釈集ページ）
   ↓
3. タブで切り替え（大アルカナ、ワンド、カップ...）
   ↓
4. カードをタップ
   ↓
5. モーダルで正位置・逆位置の詳細が表示される
```

---

## 🚀 デプロイ手順

### ステップ1: 既存ファイルのバックアップ

```bash
cd /home/ubuntu/tarot-linebot
cp index.js index-backup-$(date +%Y%m%d-%H%M).js
```

### ステップ2: 新しいファイルに置き換え

```bash
mv index-final.js index.js
```

### ステップ3: LIFF IDを設定

各HTMLファイルの`YOUR_LIFF_ID`を実際のLIFF IDに置き換える

### ステップ4: GitHubにプッシュ

```bash
git add .
git commit -m "feat: LIFF実装完了

- 一般占い選択ページ
- 恋愛占い選択ページ
- カード解釈集ページ
- マイページ
- API追加（カード詳細、ユーザーデータ）

全テスト完了 ✅"

git push origin main
```

### ステップ5: Renderで自動デプロイ

- GitHubにプッシュすると自動的にデプロイ
- ログを確認してエラーがないかチェック

### ステップ6: リッチメニューを更新

- LINE Developers Consoleでリッチメニューを更新
- 各ボタンにLIFF URLを設定

---

## 🧪 テスト方法

### 1. ローカルテスト

```bash
cd /home/ubuntu/tarot-linebot
node index.js
```

ブラウザで以下にアクセス：
- http://localhost:3000/liff/general-reading.html
- http://localhost:3000/liff/love-reading.html
- http://localhost:3000/liff/card-guide.html
- http://localhost:3000/liff/mypage.html

### 2. LINEでテスト

1. リッチメニューから各ボタンをタップ
2. Webページが開くか確認
3. テーマを選択して占いが実行されるか確認
4. カード解釈集が表示されるか確認
5. マイページが表示されるか確認

---

## 📝 注意事項

### LIFF IDの設定

- **必ず**各HTMLファイルの`YOUR_LIFF_ID`を実際のLIFF IDに置き換えてください
- LIFF IDを設定しないと、ページが開きません

### デプロイ先のURL

- `https://your-app.onrender.com`を実際のRenderのURLに置き換えてください
- URLが間違っていると、LIFFページが開きません

### リッチメニューの更新

- LIFFを設定した後、リッチメニューを更新してください
- 更新しないと、古いメニューのままです

---

## 🎉 完成！

これで、LINEの中でWebページを開いて、タロット占いのテーマ選択やカード解釈集を表示できるようになりました！

ユーザー体験が格段に向上します！✨
