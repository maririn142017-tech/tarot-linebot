# 🎉 セットアップ完了！

## ✅ LIFF ID設定完了

すべてのHTMLファイルにLIFF IDを設定しました！

---

## 📋 設定したLIFF ID

### 1️⃣ 一般占い選択
- **LIFF ID**: `2008750510-wk5DplkU`
- **URL**: https://tarot-linebot.onrender.com/liff/general-reading.html
- **ファイル**: `liff/general-reading.html` ✅

### 2️⃣ 恋愛占い選択
- **LIFF ID**: `2008750658-us5be0bS`
- **URL**: https://tarot-linebot.onrender.com/liff/love-reading.html
- **ファイル**: `liff/love-reading.html` ✅

### 3️⃣ カード解釈集
- **LIFF ID**: `2008750739-TFcLJhtx`
- **URL**: https://tarot-linebot.onrender.com/liff/card-guide.html
- **ファイル**: `liff/card-guide.html` ✅

### 4️⃣ マイページ
- **LIFF ID**: `2008750798-ev9KiDfQ`
- **URL**: https://tarot-linebot.onrender.com/liff/mypage.html
- **ファイル**: `liff/mypage.html` ✅

---

## 🚀 デプロイ完了

**コミットID**: `ec89d35`

Renderが自動的にデプロイを開始します（3〜5分）。

---

## 📋 次にやること

### ステップ1: リッチメニューを更新

LINE Developers Consoleで、リッチメニューの各ボタンに以下のURLを設定します。

#### 一般占いボタン
```
アクション: URI
URI: https://liff.line.me/2008750510-wk5DplkU
```

#### 恋愛占いボタン
```
アクション: URI
URI: https://liff.line.me/2008750658-us5be0bS
```

#### カード解釈集ボタン
```
アクション: URI
URI: https://liff.line.me/2008750739-TFcLJhtx
```

#### マイページボタン
```
アクション: URI
URI: https://liff.line.me/2008750798-ev9KiDfQ
```

---

### ステップ2: リッチメニュー更新手順

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダー → チャンネル → **Messaging API** → **リッチメニュー**
3. 既存のリッチメニューを選択（または新規作成）
4. 各ボタンの「アクション」を編集
5. 「URI」を選択して、上記のURLを入力
6. 保存

---

### ステップ3: テスト

1. LINEアプリを開く
2. リッチメニューから「一般占い」をタップ
3. Webページが開くか確認
4. テーマを選択（例：仕事運）
5. LINEのトーク画面に戻る
6. 占い結果が表示されるか確認

**同様に：**
- 恋愛占い
- カード解釈集
- マイページ

もテストしてください！

---

## 🎯 完成！

これで、LINEの中でWebページを開いて、タロット占いのテーマ選択やカード解釈集を表示できるようになりました！

ユーザー体験が格段に向上します！✨

---

## 📱 使い方の流れ

### 一般占いの場合

```
1. ユーザーがリッチメニュー「一般占い」をタップ
   ↓
2. LINEの中でWebページが開く
   （綺麗なグラデーション背景）
   ↓
3. テーマをタップ（例：💼 仕事運）
   ↓
4. LINEのトーク画面に戻る
   「一般占い：仕事運」というメッセージが送信される
   ↓
5. ボットが占い結果を返す
   🔮 〇〇さんの占い結果 🔮
   【仕事運】
   【過去】愚者（正位置）
   ...
```

### カード解釈集の場合

```
1. ユーザーがリッチメニュー「カード解釈集」をタップ
   ↓
2. LINEの中でWebページが開く
   ↓
3. タブで切り替え（大アルカナ、ワンド、カップ...）
   ↓
4. カードをタップ（例：愚者）
   ↓
5. モーダルで正位置・逆位置の詳細が表示される
```

---

## 💪 お疲れ様でした！

素晴らしいタロット占いボットが完成しました！😊💕

リッチメニューを更新したら、すぐに使えます！✨
