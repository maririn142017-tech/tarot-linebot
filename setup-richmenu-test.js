const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

// テストチャネルの環境変数からアクセストークンを取得
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST || 'JBJ2LOfZxyyPvi4olww049flppA19ww6i3zcaOqktbPoAdJx89LP1X8yStnykA+jHaRnCoCLgtMb0oxY9tOXZsyQ4lfi9IJR/1jZaUrrEz+/I2gB9jQf3b/9q6eN+oe+sHlu80xU4MLM9bQ9hO4bSQdB04t89/1O/w1cDnyilFU='
};

const client = new line.Client(config);

// テストチャネル用のLIFF ID
const LIFF_IDS = {
  mypage: '2008796293',
  payment: '2008796371',
  reading: '2008796438'
};

// リッチメニューの設定
const richMenu = {
  size: {
    width: 1200,
    height: 810,
  },
  selected: true,
  name: 'タロット占いメニュー（テスト）',
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
    console.log('テストチャネル用のリッチメニューを作成中...');
    const richMenuId = await client.createRichMenu(richMenu);
    console.log(`リッチメニューID: ${richMenuId}`);
    
    // 画像をアップロード（圧縮済み画像を使用）
    const imagePath = path.join(__dirname, 'richmenu', 'richmenu_compressed.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log('画像をアップロード中...');
    await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
    console.log('画像のアップロード完了');
    
    // デフォルトのリッチメニューとして設定
    console.log('デフォルトのリッチメニューとして設定中...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('リッチメニューの設定が完了しました！');
    
    console.log(`\nリッチメニューID: ${richMenuId}`);
    console.log('テストチャネルのLINEボットでメニューを確認してください。');
    console.log('\nテストチャネル用のLIFF ID:');
    console.log(`  マイページ: ${LIFF_IDS.mypage}`);
    console.log(`  決済ページ: ${LIFF_IDS.payment}`);
    console.log(`  占い選択ページ: ${LIFF_IDS.reading}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

setupRichMenu();
