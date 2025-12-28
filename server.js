const express = require('express');
const line = require('@line/bot-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const OpenAI = require('openai');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const tarotReadings = require('./tarot-readings');
const tarotGuide = require('./tarot-guide');
const { generateAIReading } = require('./ai-reading-generator');
const db = require('./database');
const usageLimiter = require('./usage-limiter');
const lukaConversation = require('./luka-conversation');
const support = require('./support');

const app = express();

// JSONリクエストボディのパース用ミドルウェア
app.use((req, res, next) => {
  if (req.path === '/webhook/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
 
// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Stripe Price IDs（テスト環境）
const STRIPE_PRICES = {
  single: 'price_1Shf37R7a9cchBiybxEXoWiL',      // 単品購入 380円
  light: 'price_1Shf5SR7a9cchBiyKmjKaMdK',       // ライト会員 3,000円/月
  standard: 'price_1Shf77R7a9cchBiykQXzYY6H',    // スタンダード会員 5,000円/月
  premium: 'price_1Shf8ER7a9cchBiyQ5GoWlTv'      // プレミアム会員 9,800円/3ヶ月
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

// Stripe Webhookエンドポイント　（raw bodyが必要なのでexpress.json()の前に配置）
app.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('=== Webhook Debug ===');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
console.log('req.originalUrl:', req.originalUrl);
console.log('req.body is Buffer:', Buffer.isBuffer(req.body));
console.log('req.body length:', req.body ? req.body.length : 0);
console.log('req.body type:', typeof req.body);
console.log('sig:', sig);
console.log('webhookSecret:', webhookSecret ? 'exists' : 'missing');
console.log('=====================');
  
  let event;
  
  try {
    // Webhook署名の検証（一時的にスキップ）
    console.log('⚠️ Webhook signature verification is temporarily disabled for debugging');
    
    // req.bodyをBufferから文字列に変換してJSONパース
    const bodyString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    event = JSON.parse(bodyString);
    
    console.log('✅ Event parsed successfully:', event.type);
    
    /* 署名検証コード（一時的にコメントアウト）
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('✅ Webhook signature verified successfully');
    } else {
      event = JSON.parse(req.body);
      console.log('⚠️ Webhook signature verification skipped (no secret or signature)');
    }
    */
  } catch (err) {
    console.error('❌ Webhook parsing failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // イベント処理
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        // 決済完了
        const session = event.data.object;
        const userId = session.metadata.userId;
        const planType = session.metadata.planType;
        
        console.log(`Payment completed: userId=${userId}, planType=${planType}`);
        
        // ユーザーのプランを更新
        if (planType === 'single') {
          // 単品購入の場合
          const user = db.getOrCreateUser(userId);
          
          // サブスクリプション会員かどうかをチェック
          const isSubscriptionUser = ['light', 'standard', 'premium'].includes(user.plan);
          
          if (isSubscriptionUser) {
            // サブスクリプション会員の場合、プランを上書きせず、単品購入回数を増やす
            const currentCount = user.singlePurchaseCount || 0;
            db.updateUser(userId, {
              singlePurchaseCount: currentCount + 1
            });
            console.log(`Subscription user purchased single reading: userId=${userId}, singlePurchaseCount=${currentCount + 1}`);
          } else {
            // 無料または単品購入ユーザーの場合、プランを変更
            const updates = {
              plan: 'single',
              freeReadingUsed: false // 単品購入でリセット
            };
            
            // planChangedAtが設定されていない場合のみ記録
            if (!user.planChangedAt) {
              updates.planChangedAt = new Date().toISOString();
            }
            
            db.updateUser(userId, updates);
            console.log(`User upgraded to single purchase: userId=${userId}`);
          }
        } else {
          // 定期購読の場合
          const user = db.getOrCreateUser(userId);
          const now = new Date();
          let endDate = new Date(now);
          
          // プランによって終了日を計算
          if (planType === 'premium') {
            endDate.setMonth(endDate.getMonth() + 3); // 3ヶ月
          } else {
            endDate.setMonth(endDate.getMonth() + 1); // 1ヶ月
          }
          
          const updates = {
            plan: planType,
            subscription: {
              startDate: now.toISOString(),
              endDate: endDate.toISOString(),
              autoRenew: true,
              stripeSubscriptionId: session.subscription,
              notificationSent: false
            }
          };
          
          // planChangedAtが設定されていない場合のみ記録
          if (!user.planChangedAt) {
            updates.planChangedAt = now.toISOString();
          }
          
          db.updateUser(userId, updates);
        }
        
        console.log(`User plan updated: userId=${userId}, plan=${planType}`);
        
        // 決済完了メッセージを送信
        const planNames = {
          single: '単品購入',
          light: 'ライト会員',
          standard: 'スタンダード会員',
          premium: 'プレミアム会員'
        };

        const message = {
          type: 'text',
          text: `🎉 お支払いが完了しました！\n\n✨ ${planNames[planType] || planType}にアップグレードされました\n\nマイページで詳細を確認できます 📊`
        };

        await client.pushMessage(userId, message);
        console.log(`✅ Payment notification sent to ${userId}`);
        break;
        
      case 'customer.subscription.updated':
        // サブスクリプション更新
        const subscription = event.data.object;
        const subUserId = subscription.metadata.userId;
        
        if (subscription.status === 'active') {
          console.log(`Subscription renewed: userId=${subUserId}`);
          
          // 更新日を計算
          const renewDate = new Date(subscription.current_period_end * 1000);
          
          db.updateUser(subUserId, {
            subscription: {
              ...db.getOrCreateUser(subUserId).subscription,
              endDate: renewDate.toISOString(),
              autoRenew: true
            }
          });
        }
        break;
        
      case 'customer.subscription.deleted':
        // サブスクリプションキャンセル
        const canceledSub = event.data.object;
        const cancelUserId = canceledSub.metadata.userId;
        
        console.log(`Subscription canceled: userId=${cancelUserId}`);
        
        db.updateUser(cancelUserId, {
          plan: 'free',
          subscription: {
            startDate: null,
            endDate: null,
            autoRenew: false,
            stripeSubscriptionId: null,
            notificationSent: false
          }
        });
        
        // キャンセル通知をLINEに送信
        await client.pushMessage(cancelUserId, {
          type: 'text',
          text: 'サブスクリプションがキャンセルされました。\n\nいつでもまたご利用いただけます！🙏'
        });
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({received: true});
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({error: 'Webhook handler failed'});
  }
});

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
  
  // サポート会話中の処理
  if (support.isInSupport(userId)) {
    const supportResponse = await support.handleSupportMessage(userId, userMessage, profile.displayName);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: supportResponse
    });
  }
  
  // 初回ユーザーの挨拶
  if (usageLimiter.isFirstTimeUser(userId) && !lukaConversation.isInConversation(userId)) {
    const greeting = `初めまして${profile.displayName}さん💕

ルカに会いに来てくれてありがとう✨

ルカは78枚のタロットカードであなたの未来を占うよ🔮

初回は無料で3カード占いができるから、下のメニューから「一般占い」または「恋愛占い」を選んでね🎶`;
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: greeting
    });
  }
  
  // LIFFから送信されたメッセージの処理
  if (userMessage.startsWith('一般占い：')) {
    const theme = userMessage.replace('一般占い：', '');
    return handleGeneralReadingWithTheme(event, userId, profile.displayName, theme);
  }
  
  if (userMessage.startsWith('恋愛占い：')) {
    const theme = userMessage.replace('恋愛占い：', '');
    return handleLoveReadingWithTheme(event, userId, profile.displayName, theme);
  }
  
  // メニュー選択の処理
  if (userMessage === '一般占い' || userMessage === '恋愛占い') {
    return handleReadingMenu(event, userId, profile.displayName, userMessage);
  }
  
  if (userMessage === 'ルカ占い') {
    return handleLukaReading(event, userId, profile.displayName);
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
  
  if (userMessage === 'サポート') {
    const supportGreeting = support.startSupport(userId, profile.displayName);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: supportGreeting
    });
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

// 占いメニュー（LIFFページへ誘導）
async function handleReadingMenu(event, userId, displayName, type) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: limitCheck.message
    });
  }
  
  const typeName = type === '恋愛占い' ? '恋愛占い' : '一般占い';
  const message = `${displayName}さん、こんにちは🌈

${typeName}のテーマ選択ページを開きます✨

※現在準備中のため、もうすぐ利用可能になります！

今しばらくお待ちください😊💕`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}

// 一般占い（テーマあり）
async function handleGeneralReadingWithTheme(event, userId, displayName, theme) {
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
  resultMessage += `【${theme}】\n\n`;
  
  const positions = ['過去', '現在', '未来'];
  
  cards.forEach((card, index) => {
    const position = positions[index];
    const positionText = card.reversed ? '逆位置' : '正位置';
    const interpretation = getCardInterpretation(card.name, card.reversed);
    
    resultMessage += `【${position}】${card.name}（${positionText}）\n`;
    resultMessage += `${interpretation}\n\n`;
  });
  
  // 使用回数を記録
  usageLimiter.afterReading(userId);
  
  // 占い履歴に追加
  db.addReadingHistory(userId, {
    type: 'general',
    theme: theme,
    cards: cards,
    result: resultMessage
  });
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: resultMessage
  });
}

// 恋愛占い（テーマあり）
async function handleLoveReadingWithTheme(event, userId, displayName, theme) {
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
  resultMessage += `【${theme}】\n\n`;
  
  const positions = ['現状', '課題', '未来'];
  
  cards.forEach((card, index) => {
    const position = positions[index];
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
    theme: theme,
    cards: cards,
    result: resultMessage
  });
  
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

※有料会員でも単品購入可能です

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

// カード解釈集
async function handleCardGuide(event, userId) {
  const guideMessage = `🔮 タロットカード解釈集 🔮

78枚のカードを見やすく表示します✨

※現在準備中のため、もうすぐ利用可能になります！

今しばらくお待ちください😊💕`;
  
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
      const type = reading.type === 'love' ? '恋愛占い' : '一般占い';
      const theme = reading.theme ? `（${reading.theme}）` : '';
      myPageMessage += `${index + 1}. ${date} - ${type}${theme}\n`;
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

※有料会員でも単品購入可能です

━━━━━━━━━━━━━━

💬 サポート

ご質問やお困りのことがあれば、
「サポート」と送信してください😊

ルカがお答えします✨

━━━━━━━━━━━━━━

※決済機能は準備中です
※近日公開予定です✨`;
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: paymentMessage
  });
}

// マイページHTML配信
app.get('/mypage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'mypage.html'));
});

// API: カード詳細取得
app.get('/api/card-detail', (req, res) => {
  const cardName = req.query.name;
  const card = tarotGuide[cardName];
  
  if (card) {
    res.json(card);
  } else {
    res.json({
      upright: '解釈を準備中です',
      reversed: '解釈を準備中です'
    });
  }
});

// API: ユーザーデータ取得
app.get('/api/user-data', (req, res) => {
  const userId = req.query.userId;
  const user = db.getOrCreateUser(userId);
  
  // プラン変更後の使用回数を追加
  const usageCountAfterPlanChange = db.getUsageCountAfterPlanChange(user);
  
  res.json({
    ...user,
    usageCountAfterPlanChange
  });
});

// API: LIFF経由で占いを実行
app.post('/api/send-reading', express.json(), async (req, res) => {
  try {
    const { userId, type, theme } = req.body;
    
    if (!userId || !type || !theme) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // ユーザー情報を取得
    let profile;
    try {
      profile = await client.getProfile(userId);
    } catch (error) {
      console.error('プロフィール取得エラー:', error);
      profile = { displayName: 'ゲスト' };
    }
    
    const user = db.getOrCreateUser(userId, profile.displayName);
    
    // 利用制限チェック
    const limitCheck = usageLimiter.checkUsageLimit(userId);
    
    if (!limitCheck.canUse) {
      await client.pushMessage(userId, {
        type: 'text',
        text: limitCheck.message
      });
      return res.json({ success: true });
    }
    
    // 待機メッセージを送信
    await client.pushMessage(userId, {
      type: 'text',
      text: 'カードを引いてるから、少し待っててね✨\n詳しい解釈を作ってるよ💫'
    });
    
    // カードを引く
    const cards = drawCards(3);
    console.log('Drawn cards:', cards);
    
    // AIによる詳しい鑑定結果を生成
    const userQuestion = `${profile.displayName}さんの${theme}の占い`;
    const drawnCards = cards.map(card => ({
      name: card.name,
      isReversed: card.reversed
    }));
    console.log('Formatted cards:', drawnCards);
    
    const aiReading = await generateAIReading(userQuestion, drawnCards);
    console.log('AI reading generated successfully');
    
    const resultMessage = `🔮 ${profile.displayName}さんの占い結果 🔮\n\n【${theme}】\n\n${aiReading}`;
    
    // カード画像のURLを作成（逆位置対応）
    const baseUrl = 'https://tarot-linebot.onrender.com';
    const cardImages = await Promise.all(cards.map(async (card) => {
      let imageUrl;
      
      if (card.reversed) {
        // 逆位置の場合、回転画像を生成
        const originalPath = path.join(__dirname, 'public', 'cards', `${card.name}.png`);
        const reversedFileName = `${card.name}_reversed_${Date.now()}.png`;
        const reversedPath = path.join(__dirname, 'public', 'cards', 'temp', reversedFileName);
        
        // tempディレクトリがなければ作成
        const tempDir = path.join(__dirname, 'public', 'cards', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 画像を180度回転
        await sharp(originalPath)
          .rotate(180)
          .toFile(reversedPath);
        
        imageUrl = `${baseUrl}/cards/temp/${encodeURIComponent(reversedFileName)}`;
      } else {
        // 正位置の場合、そのまま
        imageUrl = `${baseUrl}/cards/${encodeURIComponent(card.name)}.png`;
      }
      
      return {
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl
      };
    }));
    
    // メッセージを送信（画像 + テキスト）
    await client.pushMessage(userId, [
      ...cardImages,
      {
        type: 'text',
        text: resultMessage
      }
    ]);
    
    // 送信成功後に使用回数を記録
    usageLimiter.afterReading(userId);
    
    // 占い履歴に追加
    db.addReadingHistory(userId, {
      type: type,
      theme: theme,
      cards: cards,
      result: resultMessage
    });
    
    // フォローアップメッセージを送信（単品購入ユーザーへの誘導）
    const userInfo = await db.getOrCreateUser(userId);
    console.log('User plan for follow-up message:', userInfo.plan);
    
    if (userInfo.plan === 'single') {
      console.log('Scheduling follow-up message for single purchase user');
      // 少し待ってからフォローアップメッセージを送信
      // setTimeoutをPromiseでラップして待機
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          console.log('Sending follow-up message to:', userId);
          await client.pushMessage(userId, {
            type: 'text',
            text: `ルカの占い、どうだった？🔮💕

あなたの運命、もっと見てみない？

👑 ルカとの深い会話
👑 1000文字の詳細鑑定
👑 毎日占える安心感

もっと詳しく知りたいなら...
有料会員がおすすめだよ✨
「決済」をタップして、特別な鑑定を受けてね💖`
          });
          console.log('Follow-up message sent successfully');
        } catch (error) {
          console.error('Failed to send follow-up message:', error);
        }
      })();
    } else {
      console.log('User is not single purchase, skipping follow-up message');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Send reading error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Stripe Checkout セッション作成API
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, planType } = req.body;
    
    if (!userId || !planType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // プランタイプに対応するPrice IDを取得
    const priceId = STRIPE_PRICES[planType];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }
    
    // 単品購入か定期購読かを判定
    const isSubscription = planType !== 'single';
    
// Stripe Customerを作成（既存の場合は取得）
let customer;
const user = await db.getOrCreateUser(userId);


if (user && user.stripeCustomerId) {
  customer = await stripe.customers.retrieve(user.stripeCustomerId);
} else {
  customer = await stripe.customers.create({
    metadata: {
      lineUserId: userId
    }
  });
  await db.updateUser(userId, { stripeCustomerId: customer.id });
}

    
    // Stripe Checkoutセッションを作成
    const sessionParams = {
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `https://liff.line.me/2008750798-ev9KiDfQ?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://liff.line.me/2008760002-EwUmXW6q?payment=cancelled`,
      client_reference_id: userId, // LINE User IDを保存
      metadata: {
        userId: userId,
        planType: planType
      }
    };
    
    // 定期購読の場合、subscription_dataを追加
    if (isSubscription) {
      sessionParams.subscription_data = {
        metadata: {
          userId: userId,
          planType: planType
        }
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionParams);
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// 決済成功ページ
app.get('/payment-success', async (req, res) => {
  const sessionId = req.query.session_id;
  
  try {
    // Checkoutセッション情報を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata.userId;
    const planType = session.metadata.planType;
    
    // 成功メッセージをLINEに送信
    const planNames = {
      single: '単品購入',
      light: 'ライト会員',
      standard: 'スタンダード会員',
      premium: 'プレミアム会員'
    };
    
    await client.pushMessage(userId, {
      type: 'text',
      text: `🎉 お支払いが完了しました！\n\n【${planNames[planType]}】\nご購入ありがとうございます💕\n\n✨ ルカとの深い会話\n✨ 1000文字の詳細鑑定\n✨ 毎日占える安心感\n\n下のメニューから「ルカ占い」を選んでね🔮💖`
    });
    
    // 成功ページを表示
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>お支払い完了</title>
        <style>
          body {
            font-family: 'Hiragino Sans', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .success-box {
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 400px;
          }
          .success-icon {
            font-size: 80px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 15px;
          }
          p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .close-button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="success-box">
          <div class="success-icon">🎉</div>
          <h1>お支払い完了！</h1>
          <p>${planNames[planType]}のご購入ありがとうございます。<br><br>LINEトークからタロット占いをお楽しみください！</p>
          <button class="close-button" onclick="closeWindow()">閉じる</button>
        </div>
        <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
        <script>
          async function closeWindow() {
            try {
              await liff.init({ liffId: '2008750798-ev9KiDfQ' });
              liff.closeWindow();
            } catch (error) {
              console.error('LIFF close error:', error);
              // LIFF環境外の場合、LINEトークへのリンクを表示
              alert('このウィンドウを閉じて、LINEトークからタロット占いをお楽しみください！');
              window.close();
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Payment success page error:', error);
    res.status(500).send('エラーが発生しました');
  }
});

// LIFFページ用の静的ファイル配信
app.use('/liff', express.static('liff'));

// カード画像用の静的ファイル配信
app.use('/cards', express.static('public/cards'));

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
