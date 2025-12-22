const express = require('express');
const line = require('@line/bot-sdk');
const OpenAI = require('openai');
const tarotReadings = require('./tarot-readings');
const tarotGuide = require('./tarot-guide');
const { generateAIReading } = require('./ai-reading-generator');
const db = require('./database');
const usageLimiter = require('./usage-limiter');
const lukaConversation = require('./luka-conversation');

const app = express();

// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// OpenAI APIクライアント
const openai = new OpenAI();

// タロットカードのデータ（78枚）
const tarotCards = {
  major: [
    '愚者', '魔術師', '女教皇', '女帝', '皇帝', '教皇', '恋人', '戦車',
    '力', '隠者', '運命の輪', '正義', '吊るされた男', '死神', '節制',
    '悪魔', '塔', '星', '月', '太陽', '審判', '世界'
  ],
  wands: [
    'ワンドのエース', 'ワンドの2', 'ワンドの3', 'ワンドの4', 'ワンドの5',
    'ワンドの6', 'ワンドの7', 'ワンドの8', 'ワンドの9', 'ワンドの10',
    'ワンドのペイジ', 'ワンドのナイト', 'ワンドのクイーン', 'ワンドのキング'
  ],
  cups: [
    'カップのエース', 'カップの2', 'カップの3', 'カップの4', 'カップの5',
    'カップの6', 'カップの7', 'カップの8', 'カップの9', 'カップの10',
    'カップのペイジ', 'カップのナイト', 'カップのクイーン', 'カップのキング'
  ],
  swords: [
    'ソードのエース', 'ソードの2', 'ソードの3', 'ソードの4', 'ソードの5',
    'ソードの6', 'ソードの7', 'ソードの8', 'ソードの9', 'ソードの10',
    'ソードのペイジ', 'ソードのナイト', 'ソードのクイーン', 'ソードのキング'
  ],
  pentacles: [
    'ペンタクルのエース', 'ペンタクルの2', 'ペンタクルの3', 'ペンタクルの4', 'ペンタクルの5',
    'ペンタクルの6', 'ペンタクルの7', 'ペンタクルの8', 'ペンタクルの9', 'ペンタクルの10',
    'ペンタクルのペイジ', 'ペンタクルのナイト', 'ペンタクルのクイーン', 'ペンタクルのキング'
  ]
};

// 全カードを1つの配列に
const allCards = [
  ...tarotCards.major,
  ...tarotCards.wands,
  ...tarotCards.cups,
  ...tarotCards.swords,
  ...tarotCards.pentacles
];

// カードをランダムに引く
function drawCards(count = 3) {
  const shuffled = [...allCards].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(card => ({
    name: card,
    reversed: Math.random() < 0.5 // 50%の確率で逆位置
  }));
}

// カード解釈を取得
function getCardInterpretation(cardName, isReversed) {
  const position = isReversed ? 'reversed' : 'upright';
  const reading = tarotReadings[cardName];
  
  if (reading && reading[position]) {
    return reading[position];
  }
  
  return '解釈が見つかりませんでした。';
}

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
});

// イベントハンドラー
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text.trim();
  
  // ユーザー情報を取得または作成
  let profile;
  try {
    profile = await client.getProfile(userId);
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    profile = { displayName: 'ゲスト' };
  }
  
  const user = db.getOrCreateUser(userId, profile.displayName);
  
  // 初回ユーザーの挨拶
  if (usageLimiter.isFirstTimeUser(userId) && !lukaConversation.isInConversation(userId)) {
    const greeting = `初めまして${profile.displayName}さん💕

ルカに会いに来てくれてありがとう✨

ルカは78枚のタロットカードであなたの未来を占うよ🔮

初回は無料で3カード占いができるから、下のメニューから「タロット占い」を選んでね🎶`;
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: greeting
    });
  }
  
  // メニュー選択の処理
  if (userMessage === 'タロット占い') {
    return handleTarotReading(event, userId, profile.displayName, false);
  }
  
  if (userMessage === 'ルカ占い') {
    return handleLukaReading(event, userId, profile.displayName);
  }
  
  if (userMessage === '恋愛占い') {
    return handleLoveReading(event, userId, profile.displayName);
  }
  
  if (userMessage === 'カード解釈集') {
    return handleCardGuide(event, userId);
  }
  
  if (userMessage === 'マイページ') {
    return handleMyPage(event, userId, profile.displayName);
  }
  
  if (userMessage === '決済') {
    return handlePayment(event, userId, profile.displayName);
  }
  
  // ルカとの会話中の処理
  if (lukaConversation.isInConversation(userId)) {
    const result = await lukaConversation.handleConversationMessage(
      userId, 
      userMessage, 
      profile.displayName
    );
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: result.response
    });
  }
  
  // その他のメッセージ
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `${profile.displayName}さん、こんにちは🌈\n\n下のメニューから選んでね✨`
  });
}

// タロット占い（無料・有料共通）
async function handleTarotReading(event, userId, displayName, isAIPowered = false) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: limitCheck.message
    });
  }
  
  // カードを引く
  const cards = drawCards(3);
  
  // 占い結果のメッセージを作成
  let resultMessage = `🔮 ${displayName}さんの占い結果 🔮\n\n`;
  
  cards.forEach((card, index) => {
    const position = ['過去', '現在', '未来'][index];
    const positionText = card.reversed ? '逆位置' : '正位置';
    const interpretation = getCardInterpretation(card.name, card.reversed);
    
    resultMessage += `【${position}】${card.name}（${positionText}）\n`;
    resultMessage += `${interpretation}\n\n`;
  });
  
  // 使用回数を記録
  usageLimiter.afterReading(userId);
  
  // 占い履歴に追加
  db.addReadingHistory(userId, {
    type: 'tarot',
    cards: cards,
    result: resultMessage
  });
  
  // 会話をリセット
  lukaConversation.endConversation(userId);
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: resultMessage
  });
}

// ルカ占い（AI会話あり）
async function handleLukaReading(event, userId, displayName) {
  // ルカが使えるかチェック
  if (!usageLimiter.canUseLuka(userId)) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `ルカ占いは有料会員限定です💕

【ルカ占いの特徴】
✨ ルカとの会話ができる
✨ AIによる詳しい鑑定
✨ 1000文字の個別メッセージ

料金プラン：
💫 単品：380円/回
👑 ライト：3,000円/月（1日1回）
👑 スタンダード：5,000円/月（1日2回）
👑 プレミアム：9,800円/3ヶ月（1日2回）

下のメニューから「決済」をタップしてね🎶`
    });
  }
  
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: limitCheck.message
    });
  }
  
  // 会話を開始
  const greeting = lukaConversation.startConversation(userId, displayName);
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: greeting
  });
}

// 恋愛占い
async function handleLoveReading(event, userId, displayName) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: limitCheck.message
    });
  }
  
  // カードを引く
  const cards = drawCards(3);
  
  // 恋愛に特化した解釈
  let resultMessage = `💕 ${displayName}さんの恋愛運 💕\n\n`;
  
  cards.forEach((card, index) => {
    const position = ['あなたの気持ち', '相手の気持ち', '二人の未来'][index];
    const positionText = card.reversed ? '逆位置' : '正位置';
    const interpretation = getCardInterpretation(card.name, card.reversed);
    
    resultMessage += `【${position}】${card.name}（${positionText}）\n`;
    resultMessage += `${interpretation}\n\n`;
  });
  
  // 使用回数を記録
  usageLimiter.afterReading(userId);
  
  // 占い履歴に追加
  db.addReadingHistory(userId, {
    type: 'love',
    cards: cards,
    result: resultMessage
  });
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: resultMessage
  });
}

// カード解釈集
async function handleCardGuide(event, userId) {
  const guideMessage = `🔮 タロットカード解釈集 🔮

【大アルカナ】
愚者、魔術師、女教皇、女帝、皇帝、教皇、恋人、戦車、力、隠者、運命の輪、正義、吊るされた男、死神、節制、悪魔、塔、星、月、太陽、審判、世界

【小アルカナ】
・ワンド（情熱・行動）
・カップ（感情・愛）
・ソード（思考・葛藤）
・ペンタクル（物質・金運）

カード名を送信すると詳しい解釈が見れます✨

例：「愚者」「ワンドのエース」`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: guideMessage
  });
}

// マイページ
async function handleMyPage(event, userId, displayName) {
  const user = db.getOrCreateUser(userId, displayName);
  const planInfo = usageLimiter.getPlanInfo(user.plan);
  
  // 今日の残り回数
  db.resetDailyUsageIfNeeded(userId);
  const remainingToday = planInfo.dailyLimit - user.usageCount.today;
  
  let myPageMessage = `📊 ${displayName}さんのマイページ\n\n`;
  myPageMessage += `【現在のプラン】\n${planInfo.name}\n\n`;
  
  if (user.plan !== 'free') {
    myPageMessage += `【今日の残り回数】\n${remainingToday}回\n\n`;
  }
  
  if (user.plan === 'free') {
    myPageMessage += `【無料占い】\n${user.freeReadingUsed ? '使用済み' : '未使用'}\n\n`;
  }
  
  // 占い履歴
  if (user.readingHistory && user.readingHistory.length > 0) {
    myPageMessage += `【最近の占い】\n`;
    user.readingHistory.slice(0, 3).forEach((reading, index) => {
      const date = new Date(reading.timestamp).toLocaleDateString('ja-JP');
      const type = reading.type === 'love' ? '恋愛占い' : 'タロット占い';
      myPageMessage += `${index + 1}. ${date} - ${type}\n`;
    });
  }
  
  myPageMessage += `\n✨ いつもありがとうございます 💕`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: myPageMessage
  });
}

// 決済
async function handlePayment(event, userId, displayName) {
  const paymentMessage = `💳 料金プラン 💳

【単品購入】
💫 380円/回
　・何回でもOK
　・ルカとの会話あり
　・3カード占い

【月額会員】
👑 ライト：3,000円/月
　・1日1回
　・ルカとの会話あり

👑 スタンダード：5,000円/月
　・1日2回
　・ルカとの会話あり

👑 プレミアム：9,800円/3ヶ月
　・1日2回
　・ルカとの会話あり
　・3ヶ月でお得！

※決済機能は準備中です
※近日公開予定です✨`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: paymentMessage
  });
}

// ヘルスチェック
app.get('/', (req, res) => {
  res.send('Tarot LINE Bot is running!');
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // データベース初期化
  db.getOrCreateUser('system', 'System');
  console.log('Database initialized');
});
