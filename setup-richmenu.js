const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

// 環境変数からアクセストークンを取得
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);

// リッチメニューの設定
const richMenu = {
  size: {
    width: 1200,
    height: 810,
  },
  selected: true,
  name: 'タロット占いメニュー',
  chatBarText: 'メニューを開く',
  areas: [
    // 上段左: 一般占い
    {
      bounds: {
        x: 0,
        y: 0,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: 'タロット占い'
      }
    },
    // 上段中央: 恋愛占い
    {
      bounds: {
        x: 400,
        y: 0,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: '恋愛占い'
      }
    },
    // 上段右: 決済
    {
      bounds: {
        x: 800,
        y: 0,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: '決済'
      }
    },
    // 下段左: ルカ占い
    {
      bounds: {
        x: 0,
        y: 405,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: 'ルカ占い'
      }
    },
    // 下段中央: カード解釈集
    {
      bounds: {
        x: 400,
        y: 405,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: 'カード解釈集'
      }
    },
    // 下段右: マイページ
    {
      bounds: {
        x: 800,
        y: 405,
        width: 400,
        height: 405,
      },
      action: {
        type: 'message',
        text: 'マイページ'
      }
    }
  ]
};

async function setupRichMenu() {
  try {
    console.log('リッチメニューを作成中...');
    const richMenuId = await client.createRichMenu(richMenu);
    console.log(`リッチメニューID: ${richMenuId}`);
    
    // 画像をアップロード
    const imagePath = path.join(__dirname, 'richmenu', 'richmenu_final.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log('画像をアップロード中...');
    await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
    console.log('画像のアップロード完了');
    
    // デフォルトのリッチメニューとして設定
    console.log('デフォルトのリッチメニューとして設定中...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('リッチメニューの設定が完了しました！');
    
    console.log(`\nリッチメニューID: ${richMenuId}`);
    console.log('LINEボットでメニューを確認してください。');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

setupRichMenu();
