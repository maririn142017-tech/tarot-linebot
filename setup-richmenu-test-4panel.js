const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

// テストチャネルのアクセストークン
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST || 'JBJ2LOfZxyyPvi4olww049flppA19ww6i3zcaOqktbPoAdJx89LP1X8yStnykA+jHaRnCoCLgtMb0oxY9tOXZsyQ4lfi9IJR/1jZaUrrEz+/I2gB9jQf3b/9q6eN+oe+sHlu80xU4MLM9bQ9hO4bSQdB04t89/1O/w1cDnyilFU='
};

const client = new line.Client(config);

// テストチャネル用のLIFF ID
const LIFF_IDS = {
  reading: '2008796438',      // 占い選択ページ
  payment: '2008796371',      // 決済ページ
  cardMeanings: '2008796593', // カードの意味
  mypage: '2008796293'        // 私のページ
};

// 4パネルリッチメニューの設定（1250x843）
const richMenu = {
  size: {
    width: 1250,
    height: 843,
  },
  selected: true,
  name: 'タロット占いメニュー（テスト・4パネル）',
  chatBarText: 'メニュー',
  areas: [
    // 左上: 占い選択ページ
    {
      bounds: {
        x: 0,
        y: 0,
        width: 625,
        height: 421,
      },
      action: {
        type: 'uri',
        uri: `https://liff.line.me/${LIFF_IDS.reading}`
      }
    },
    // 右上: 決済ページ
    {
      bounds: {
        x: 625,
        y: 0,
        width: 625,
        height: 421,
      },
      action: {
        type: 'uri',
        uri: `https://liff.line.me/${LIFF_IDS.payment}`
      }
    },
    // 左下: カードの意味
    {
      bounds: {
        x: 0,
        y: 421,
        width: 625,
        height: 422,
      },
      action: {
        type: 'uri',
        uri: `https://liff.line.me/${LIFF_IDS.cardMeanings}`
      }
    },
    // 右下: 私のページ
    {
      bounds: {
        x: 625,
        y: 421,
        width: 625,
        height: 422,
      },
      action: {
        type: 'uri',
        uri: `https://liff.line.me/${LIFF_IDS.mypage}`
      }
    }
  ]
};

async function setupRichMenu() {
  try {
    console.log('=== テストチャネル用の4パネルリッチメニューを作成中 ===');
    console.log('');
    
    // 既存のデフォルトリッチメニューを確認
    try {
      const defaultRichMenuId = await client.getDefaultRichMenuId();
      console.log(`既存のデフォルトリッチメニューID: ${defaultRichMenuId}`);
      console.log('既存のリッチメニューを削除します...');
      await client.cancelDefaultRichMenu();
      await client.deleteRichMenu(defaultRichMenuId);
      console.log('既存のリッチメニューを削除しました');
      console.log('');
    } catch (err) {
      console.log('既存のデフォルトリッチメニューはありません');
      console.log('');
    }
    
    // 新しいリッチメニューを作成
    console.log('新しいリッチメニューを作成中...');
    const richMenuId = await client.createRichMenu(richMenu);
    console.log(`✅ リッチメニューID: ${richMenuId}`);
    console.log('');
    
    // 画像をアップロード（最適化済みPNG）
    const imagePath = path.join(__dirname, 'richmenu', 'richmenu_4panel_optimized.png');
    console.log(`画像をアップロード中: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`画像サイズ: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
    console.log('✅ 画像のアップロード完了');
    console.log('');
    
    // デフォルトのリッチメニューとして設定
    console.log('デフォルトのリッチメニューとして設定中...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('✅ リッチメニューの設定が完了しました！');
    console.log('');
    
    console.log('=== 設定完了 ===');
    console.log(`リッチメニューID: ${richMenuId}`);
    console.log('');
    console.log('テストチャネル用のLIFF URL:');
    console.log(`  占い選択ページ: https://liff.line.me/${LIFF_IDS.reading}`);
    console.log(`  決済ページ: https://liff.line.me/${LIFF_IDS.payment}`);
    console.log(`  カードの意味: https://liff.line.me/${LIFF_IDS.cardMeanings}`);
    console.log(`  私のページ: https://liff.line.me/${LIFF_IDS.mypage}`);
    console.log('');
    console.log('テストチャネルのLINEボットでメニューを確認してください！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.response) {
      console.error('レスポンス:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('スタックトレース:', error.stack);
    }
  }
}

setupRichMenu();
