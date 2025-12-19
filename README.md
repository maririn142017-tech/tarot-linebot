# タロット占いLINEボット

タロットカードを使った占いができるLINEボットです。

## 機能

- 3枚のタロットカードで占い
- Cloudinaryから画像を取得
- Supabaseにユーザー情報と占い履歴を保存
- Stripe決済連携（予定）

## 使い方

LINEで「タロット占い」または「占い」と送信すると、3枚のカードで占います。

## 環境変数

以下の環境変数を設定してください：

```
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
STRIPE_SECRET_KEY=your_stripe_secret_key
PORT=3000
```

## デプロイ

Renderにデプロイする場合：

1. GitHubリポジトリと連携
2. 環境変数を設定
3. 自動デプロイ

## ライセンス

MIT
