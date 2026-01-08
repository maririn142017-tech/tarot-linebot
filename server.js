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
const dailyFortune = require('./daily-fortune');

const app = express();

// JSONリクエストボディのパース用ミドルウェア
app.use((req, res, next) => {
  // LINE WebhookとStripe Webhookはraw bodyが必要なので除外
  if (req.path === '/webhook' || req.path === '/webhook-test' || req.path === '/webhook/stripe') {
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

// テストチャネル用の設定
const testConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_TEST,
  channelSecret: process.env.LINE_CHANNEL_SECRET_TEST,
};

// 環境変数のデバッグログ（起動時に確認）
console.log('=== Environment Variables Check ===');
console.log('LINE_CHANNEL_ACCESS_TOKEN:', config.channelAccessToken ? 'exists (length: ' + config.channelAccessToken.length + ')' : 'MISSING');
console.log('LINE_CHANNEL_SECRET:', config.channelSecret ? 'exists (length: ' + config.channelSecret.length + ')' : 'MISSING');
console.log('LINE_CHANNEL_ACCESS_TOKEN_TEST:', testConfig.channelAccessToken ? 'exists (length: ' + testConfig.channelAccessToken.length + ')' : 'MISSING');
console.log('LINE_CHANNEL_SECRET_TEST:', testConfig.channelSecret ? 'exists (length: ' + testConfig.channelSecret.length + ')' : 'MISSING');
console.log('===================================');

// テストチャネルの環境変数が設定されていない場合、エラーを出力
if (!testConfig.channelAccessToken || !testConfig.channelSecret) {
  console.error('❌ ERROR: Test channel environment variables are not set properly!');
  console.error('Please set LINE_CHANNEL_ACCESS_TOKEN_TEST and LINE_CHANNEL_SECRET_TEST in Render environment variables.');
}

// Stripe Price IDs（テスト環境）
const STRIPE_PRICES = {
  single: 'price_1Shf37R7a9cchBiybxEXoWiL',      // 単品購入 380円
  light: 'price_1Shf5SR7a9cchBiyKmjKaMdK',       // ライト会員 3,000円/月
  standard: 'price_1Shf77R7a9cchBiykQXzYY6H',    // スタンダード会員 5,000円/月
  premium: 'price_1Shf8ER7a9cchBiyQ5GoWlTv'      // プレミアム会員 9,800円/3ヶ月
};

const client = new line.Client(config);
const testClient = new line.Client(testConfig);

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
        const eventId = event.id; // StripeイベントID
        
        console.log(`Payment completed: userId=${userId}, planType=${planType}, eventId=${eventId}`);
        
        // 重複処理チェック
        const user = await db.getOrCreateUser(userId);
        if (user.processedEvents && user.processedEvents.includes(eventId)) {
          console.log(`⚠️ Event already processed: eventId=${eventId}, skipping`);
          return res.json({ received: true, skipped: true });
        }
        
        // ユーザーのプランを更新
        if (planType === 'single') {
          // 単品購入の場合
          const user = await db.getOrCreateUser(userId);
          
          // サブスクリプション会員かどうかをチェック
          const isSubscriptionUser = ['light', 'standard', 'premium'].includes(user.plan);
          
          if (isSubscriptionUser) {
            // サブスクリプション会員の場合、プランを上書きせず、単品購入回数を増やす
            const currentCount = user.singlePurchaseCount || 0;
            await db.updateUser(userId, {
              singlePurchaseCount: currentCount + 1
            });
            console.log(`Subscription user purchased single reading: userId=${userId}, plan unchanged, singlePurchaseCount=${currentCount + 1}`);
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
            
            await db.updateUser(userId, updates);
            console.log(`User upgraded to single purchase: userId=${userId}`);
          }
        } else {
          // 定期購読の場合
          const user = await db.getOrCreateUser(userId);
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
            },
            // プラン変更時刻を記録（必ず更新）
            planChangedAt: now.toISOString(),
            // 単品購入回数をリセット
            singlePurchaseCount: 0
          };
          
          await db.updateUser(userId, updates);
        }
        
        const updatedUser = await db.getOrCreateUser(userId);
        console.log(`User plan updated: userId=${userId}, actualPlan=${updatedUser.plan}, purchasedPlanType=${planType}, singlePurchaseCount=${updatedUser.singlePurchaseCount || 0}`);
        
        // 処理済みイベントIDを記録（重複処理を防ぐ）
        const processedEvents = updatedUser.processedEvents || [];
        processedEvents.push(eventId);
        if (processedEvents.length > 100) {
          processedEvents.shift();
        }
        await db.updateUser(userId, { processedEvents });
        console.log(`✅ Event processed and recorded: eventId=${eventId}`);
        
        // 決済完了メッセージを送信（エラーが発生してもwebhook処理は成功とする）
        try {
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
        } catch (notificationError) {
          // LINE通知の送信に失敗しても、webhook処理は成功とする
          console.error(`⚠️ Payment notification failed (but webhook processing succeeded): ${notificationError.message}`);
          if (notificationError.response && notificationError.response.status === 429) {
            console.log('🚫 LINE API rate limit exceeded, notification will be skipped');
          }
        }
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
    await Promise.all(events.map(event => handleEvent(event, client)));
    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
});

// テストチャネル用のWebhookエンドポイント（手動署名検証）
app.post('/webhook-test', express.json(), async (req, res) => {
  try {
    // 署名検証のデバッグ情報
    const signature = req.headers['x-line-signature'];
    console.log('=== Webhook Test Debug ===');
    console.log('Signature:', signature ? 'exists' : 'MISSING');
    console.log('Channel Secret:', testConfig.channelSecret ? 'exists (length: ' + testConfig.channelSecret.length + ')' : 'MISSING');
    console.log('Body:', JSON.stringify(req.body).substring(0, 100));
    
    // 署名検証（エラーがあっても続行）
    if (signature && testConfig.channelSecret) {
      try {
        const bodyString = JSON.stringify(req.body);
        if (!line.validateSignature(bodyString, testConfig.channelSecret, signature)) {
          console.warn('⚠️ Signature validation failed, but continuing...');
        } else {
          console.log('✅ Signature validation passed');
        }
      } catch (sigError) {
        console.error('❌ Signature validation error:', sigError.message);
        console.log('Continuing without signature validation...');
      }
    } else {
      console.warn('⚠️ Signature or channel secret missing, skipping validation');
    }
    
    const events = req.body.events;
    if (!events || events.length === 0) {
      console.log('No events in webhook');
      return res.status(200).end();
    }
    
    console.log(`Processing ${events.length} event(s)`);
    await Promise.all(events.map(event => handleEvent(event, testClient)));
    console.log('=========================');
    res.status(200).end();
  } catch (err) {
    console.error('Webhook error (test):', err);
    console.error('Error stack:', err.stack);
    res.status(500).end();
  }
});

// イベントハンドラー
async function handleEvent(event, lineClient = client) {
  // フォローイベント（友だち追加）の処理
  if (event.type === 'follow') {
    const userId = event.source.userId;
    
    // プロフィール取得
    let profile;
    try {
      profile = await lineClient.getProfile(userId);
    } catch (error) {
      console.error('プロフィール取得エラー:', error);
      profile = { displayName: 'ゲスト' };
    }
    
    // ユーザー作成
    await db.getOrCreateUser(userId, profile.displayName);
    
    // 初回挨拶メッセージ
    const greeting = `こんにちは，${profile.displayName}さん🎴
ルカはあなたの運命を導くタロット占い師です💫
下のメニューから好きな項目を選んでね！
さあ、運命のカードを下のメニューから引いてみよう！🔮`;
    
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: greeting
    });
  }
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const userMessage = event.message.text.trim();
  
  console.log('=== Message Received ===');
  console.log('User ID:', userId);
  console.log('Message:', userMessage);
  console.log('=======================');
  
  // ユーザー情報を取得または作成
  let profile;
  try {
    profile = await lineClient.getProfile(userId);
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    profile = { displayName: 'ゲスト' };
  }
  
  const user = await db.getOrCreateUser(userId, profile.displayName);
  
  // デバッグログ
  console.log(`User ${userId} info:`, {
    greetingSent: user.greetingSent,
    freeReadingUsed: user.freeReadingUsed,
    plan: user.plan,
    isFirstTime: usageLimiter.isFirstTimeUser(userId)
  });
  
  // サポート会話中の処理
  if (support.isInSupport(userId)) {
    const supportResponse = await support.handleSupportMessage(userId, userMessage, profile.displayName);
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: supportResponse
    });
  }
  
  // 初回ユーザーの挨拶（「ルカ占い」「マイページ」メッセージは除外）
  if (usageLimiter.isFirstTimeUser(userId) && !(await lukaConversation.isInConversation(userId)) && userMessage !== 'ルカ占い' && userMessage !== 'マイページ') {
    // 挨拶を送信する前にフラグを立てる（次回からは表示しない）
    db.updateUser(userId, { greetingSent: true });
    
    const greeting = `初めまして${profile.displayName}さん💕

ルカに会いに来てくれてありがとう✨

ルカは78枚のタロットカードであなたの未来を占うよ🔮

初回は無料で3カード占いができるから、下のメニューから「一般占い」または「恋愛占い」を選んでね🎶`;
    
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: greeting
    });
  }
  
  // 2回目以降の挨拶（LIFFメッセージではない通常メッセージの場合のみ）
  if (!(await lukaConversation.isInConversation(userId)) && 
      !userMessage.startsWith('一般占い：') && 
      !userMessage.startsWith('恋愛占い：') &&
      userMessage.length < 20) { // 短いメッセージのみ挨拶を返す
    const user = await db.getOrCreateUser(userId);
    const greetingSent = user.greetingSent === undefined ? false : user.greetingSent;
    
    // 挨拶済みで、簡単な挨拶メッセージの場合
    const simpleGreetings = ['こんにちは', 'こんばんは', 'おはよう', 'やあ', 'よろしく'];
    const isSimpleGreeting = simpleGreetings.some(g => userMessage.includes(g));
    
    if (greetingSent && isSimpleGreeting) {
      const welcomeBack = `おかえり${profile.displayName}さん💕

今日はどんなことを占う？🔮

下のメニューから「一般占い」または「恋愛占い」を選んでね✨`;
      
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: welcomeBack
      });
    }
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
    return handleReadingMenu(event, userId, profile.displayName, userMessage, lineClient);
  }
  
  if (userMessage === 'ルカ占い') {
    console.log('>>> Luka Fortune button tapped! Calling handleLukaReading...');
    try {
      return await handleLukaReading(event, userId, profile.displayName, lineClient);
    } catch (error) {
      console.error('>>> Error in handleLukaReading:', error);
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: 'エラーが発生しました。もう一度お試しください。'
      });
    }
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
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: supportGreeting
    });
  }
  
  // ルカとの会話中の処理
  if (await lukaConversation.isInConversation(userId)) {
    const result = await lukaConversation.handleConversationMessage(
      userId, 
      userMessage, 
      profile.displayName
    );
    
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: result.response
    });
  }
  
  // その他のメッセージ
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: `${profile.displayName}さん、こんにちは🌈\n\n下のメニューから選んでね✨`
  });
}

// 占いメニュー（LIFFページへ誘導）
async function handleReadingMenu(event, userId, displayName, type, lineClient) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: limitCheck.message
    });
  }
  
  const typeName = type === '恋愛占い' ? '恋愛占い' : '一般占い';
  const message = `${displayName}さん、こんにちは🌈

${typeName}のテーマ選択ページを開きます✨

※現在準備中のため、もうすぐ利用可能になります！

今しばらくお待ちください😊💕`;
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}

// 一般占い（テーマあり）
async function handleGeneralReadingWithTheme(event, userId, displayName, theme) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return lineClient.replyMessage(event.replyToken, {
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
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: resultMessage
  });
}

// 恋愛占い（テーマあり）
async function handleLoveReadingWithTheme(event, userId, displayName, theme) {
  // 利用制限チェック
  const limitCheck = usageLimiter.checkUsageLimit(userId);
  
  if (!limitCheck.canUse) {
    return lineClient.replyMessage(event.replyToken, {
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
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: resultMessage
  });
}

// ルカ占い（AI会話あり）
async function handleLukaReading(event, userId, displayName, lineClient = client) {
  console.log('>>> handleLukaReading called!');
  console.log('>>> userId:', userId);
  console.log('>>> displayName:', displayName);
  
  // 今日の運勢を生成（無料、誰でも使える）
  const fortuneMessage = dailyFortune.generateDailyFortune(userId, displayName);
  console.log('>>> fortuneMessage generated:', fortuneMessage.substring(0, 50) + '...');
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: fortuneMessage
  });
}

// カード解釈集
async function handleCardGuide(event, userId) {
  const guideMessage = `🔮 タロットカード解釈集 🔮

78枚のカードを見やすく表示します✨

※現在準備中のため、もうすぐ利用可能になります！

今しばらくお待ちください😊💕`;
  
  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: guideMessage
  });
}

// マイページ
async function handleMyPage(event, userId, displayName) {
  try {
    // PostgreSQLからユーザー情報を取得
    const user = await db.getOrCreateUser(userId, displayName);
    const planInfo = usageLimiter.getPlanInfo(user.plan);
    
    // 今日の利用回数を取得
    const todayHistory = await db.getTodayReadingHistory(userId);
    const todayUsageCount = todayHistory.length;
    
    // プラン変更後の使用回数
    const historyAfterPlanChange = await db.getReadingHistoryAfterPlanChange(userId);
    const usageCountAfterPlanChange = historyAfterPlanChange.length;
    
    // 占い履歴を取得
    const readingHistory = await db.getReadingHistory(userId, 3);
    
    // 今日の残り回数を計算
    let usedToday;
    if (user.plan === 'single' || user.plan === 'free') {
      usedToday = todayUsageCount;
    } else {
      usedToday = usageCountAfterPlanChange;
    }
    
    const singlePurchaseCount = user.singlePurchaseCount || 0;
    const totalLimit = planInfo.dailyLimit + singlePurchaseCount;
    const remainingToday = Math.max(0, totalLimit - usedToday);
    
    let myPageMessage = `📊 ${displayName}さんのマイページ\n\n`;
    myPageMessage += `【現在のプラン】\n${planInfo.name}\n\n`;
    
    if (user.plan === 'free') {
      myPageMessage += `【今日の利用回数】\n${todayUsageCount}回\n\n`;
      myPageMessage += `【無料占い】\n${user.freeReadingUsed ? '使用済み' : '未使用'}\n\n`;
    } else if (user.plan === 'single') {
      myPageMessage += `【今日の利用回数】\n${todayUsageCount}回\n\n`;
    } else {
      myPageMessage += `【今日の残り回数】\n${remainingToday}回\n\n`;
      myPageMessage += `【今日の利用回数】\n${usedToday}回\n\n`;
    }
    
    // 占い履歴
    if (readingHistory && readingHistory.length > 0) {
      myPageMessage += `【最近の占い】\n`;
      readingHistory.forEach((reading, index) => {
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
  } catch (error) {
    console.error('❗ handleMyPageエラー:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'マイページの読み込みに失敗しました。もう一度お試しください。'
    });
  }
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
  
  return lineClient.replyMessage(event.replyToken, {
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
app.get('/api/user-data', async (req, res) => {
  try {
    const userId = req.query.userId;
    const user = await db.getOrCreateUser(userId);
    
    // プラン変更後の使用回数を取得
    const historyAfterPlanChange = await db.getReadingHistoryAfterPlanChange(userId);
    const usageCountAfterPlanChange = historyAfterPlanChange.length;
    
    // 今日の占い履歴を取得（今日の利用回数を計算）
    const todayHistory = await db.getTodayReadingHistory(userId);
    const todayUsageCount = todayHistory.length;
    
    // 占い履歴を取得（最新10件）
    const readingHistory = await db.getReadingHistory(userId, 10);
    
    res.json({
      ...user,
      usageCount: {
        today: todayUsageCount
      },
      usageCountAfterPlanChange,
      readingHistory
    });
  } catch (error) {
    console.error('❌ /api/user-dataエラー:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
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
    
    const user = await db.getOrCreateUser(userId, profile.displayName);
    
    // 利用制限チェック
    const limitCheck = await usageLimiter.checkUsageLimit(userId);
    
    if (!limitCheck.canUse) {
      try {
        await client.pushMessage(userId, {
          type: 'text',
          text: limitCheck.message
        });
      } catch (error) {
        console.error('Failed to send limit message:', error);
      }
      return res.json({ success: true });
    }
    
    // 待機メッセージを削除（LINE APIリクエスト数削減のため）
    // 占い結果のみを送信することで、429エラーの発生頻度を下げる
    
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
    
    // メッセージを送信（ローディングメッセージ + 画像 + テキスト）
    // 429エラーが出ても占い処理自体は成功させる
    try {
      await client.pushMessage(userId, [
        {
          type: 'text',
          text: '今日カード達は何を伝えたいのか…🌟\nどんな運命が…🎴'
        },
        ...cardImages,
        {
          type: 'text',
          text: resultMessage
        }
      ]);
      console.log('Reading result sent successfully');
    } catch (error) {
      console.error('Failed to send reading result (but continuing processing):', error);
      // 429エラーなどで送信失敗しても、使用回数の記録と履歴保存は続行
    }
    
    // 使用回数を記録（送信成功・失敗に関わらず必ず実行）
    await usageLimiter.afterReading(userId);
    console.log('Usage count recorded');
    
    // 占い履歴に追加（送信成功・失敗に関わらず必ず実行）
    await db.addReadingHistory(userId, {
      type: type,
      theme: theme,
      cards: cards,
      reading: resultMessage,
      advice: null
    });
    console.log('Reading history saved');
    
    // フォローアップメッセージを送信（無料・単品購入ユーザーへの誘導）
    const userInfo = await db.getOrCreateUser(userId);
    console.log('User plan for follow-up message:', userInfo.plan);
    
    if (userInfo.plan === 'free') {
      console.log('Scheduling follow-up message for free user');
      // 無料鑑定後の購入促進メッセージ
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          console.log('Sending follow-up message to free user:', userId);
          await client.pushMessage(userId, {
            type: 'text',
            text: `ルカの占い、どうだった？🔮💕

もっと詳しく占いたい場合は：

💫 単品購入：380円/回
　→ 何回でもOK！ルカとの会話あり

👑 月額会員：
　・ライト：3,000円/月（1日1回）
　・スタンダード：5,000円/月（1日2回）
　・プレミアム：9,800円/3ヶ月（1日2回）

下のメニューから「決済」をタップしてね🎶`
          });
          console.log('Follow-up message sent successfully to free user');
        } catch (error) {
          console.error('Failed to send follow-up message to free user:', error);
        }
      })();
    } else if (userInfo.plan === 'single') {
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

// LIFFからの占いリクエストを処理するAPIエンドポイント
app.post('/api/send-reading-request', async (req, res) => {
  try {
    const { userId, readingType, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // ユーザーにメッセージを送信（testClientを使用）
    await testClient.pushMessage(userId, {
      type: 'text',
      text: `${message}を選択しました。\nどのようなことを占いたいですか？`
    });
    
    console.log(`Reading request sent to user ${userId}: ${message}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending reading request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
