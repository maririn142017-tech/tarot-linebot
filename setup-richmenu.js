const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// リッチメニューの設定
const richMenu = {
  size: {
    width: 2500,
    height: 1686
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
        width: 833,
        height: 843
      },
      action: {
        type: 'message',
        text: 'タロット占い'
      }
    },
    // 上段中央: 恋愛占い
    {
      bounds: {
        x: 833,
        y: 0,
        width: 834,
        height: 843
      },
      action: {
        type: 'message',
        text: '恋愛占い'
      }
    },
    // 上段右: 決済
    {
      bounds: {
        x: 1667,
        y: 0,
        width: 833,
        height: 843
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
        y: 843,
        width: 833,
        height: 843
      },
      action: {
        type: 'message',
        text: 'ルカ占い'
      }
    },
    // 下段中央: カード解釈集
    {
      bounds: {
        x: 833,
        y: 843,
        width: 834,
        height: 843
      },
      action: {
        type: 'message',
        text: 'カード解釈集'
      }
    },
    // 下段右: マイページ
    {
      bounds: {
        x: 1667,
        y: 843,
        width: 833,
        height: 843
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
    
    // リッチメニューを作成
    const richMenuId = await client.createRichMenu(richMenu);
    console.log(`リッチメニューID: ${richMenuId}`);
    
    // 画像をアップロード
    const imagePath = path.join(__dirname, 'richmenu', 'richmenu_2500x1686.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log('画像をアップロード中...');
    await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
    console.log('画像のアップロード完了');
    
    // デフォルトのリッチメニューとして設定
    console.log('デフォルトのリッチメニューとして設定中...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('設定完了！');
    
    console.log('\n✅ リッチメニューの設定が完了しました！');
    console.log(`リッチメニューID: ${richMenuId}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

// 既存のリッチメニューを削除する関数（オプション）
async function deleteAllRichMenus() {
  try {
    console.log('既存のリッチメニューを確認中...');
    const richMenus = await client.getRichMenuList();
    
    if (richMenus.length === 0) {
      console.log('既存のリッチメニューはありません。');
      return;
    }
    
    console.log(`${richMenus.length}個のリッチメニューが見つかりました。`);
    
    for (const menu of richMenus) {
      console.log(`削除中: ${menu.richMenuId} (${menu.name})`);
      await client.deleteRichMenu(menu.richMenuId);
    }
    
    console.log('既存のリッチメニューを全て削除しました。');
  } catch (error) {
    console.error('削除エラー:', error);
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--delete')) {
    await deleteAllRichMenus();
  }
  
  await setupRichMenu();
}

main();
