const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');
const OpenAI = require('openai');
const tarotReadings = require('./tarot-readings');
const { generateAIReading } = require('./ai-reading-generator');

const app = express();

// 環境変数から設定を読み込み
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const client = new line.Client(config);

// OpenAI APIクライアント
const openai = new OpenAI();

// ユーザーの会話状態を管理
const userStates = new Map();

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

// 全てのカードを1つの配列にまとめる
const allCards = [
  ...tarotCards.major,
  ...tarotCards.wands,
  ...tarotCards.cups,
  ...tarotCards.swords,
  ...tarotCards.pentacles
];

// Cloudinaryの画像URLを生成する関数
function getCloudinaryImageUrl(cardName) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const encodedCardName = encodeURIComponent(cardName);
  return `https://res.cloudinary.com/${cloudName}/image/upload/${encodedCardName}.webp`;
}

// ランダムにカードを選ぶ関数（正位置・逆位置も決定）
function drawRandomCards(count) {
  const shuffled = [...allCards].sort(() => 0.5 - Math.random());
  const selectedCards = shuffled.slice(0, count);
  
  // 各カードに正位置/逆位置をランダムに割り当て
  return selectedCards.map(card => ({
    name: card,
    isReversed: Math.random() < 0.5 // 50%の確率で逆位置
  }));
}

// タロット占いの結果を生成する関数（900〜1000文字）
function generateTarotReading(cards) {
  const positions = ['過去', '現在', '未来'];
  
  let result = '';
  
  // 各カードの解釈
  cards.forEach((card, index) => {
    const position = positions[index] || `カード${index + 1}`;
    const cardName = card.name;
    const isReversed = card.isReversed;
    const positionText = isReversed ? '（逆位置）' : '';
    
    // 解釈を取得
    const reading = tarotReadings[cardName];
    const interpretation = isReversed ? reading.reversed : reading.upright;
    
    result += `【${position}：${cardName}${positionText}】\n${interpretation}\n\n`;
  });
  
  // ルカからのメッセージ
  result += `【ルカからのメッセージ】\n`;
  result += `あなたのカードを見させてもらったよ✨\n`;
  result += `過去から現在、そして未来へと続く流れの中で、あなたは今、大切な時期にいるんだね。\n`;
  result += `カードが示すメッセージを受け取って、自分の心に正直に進んでいってほしいな💕\n`;
  result += `あなたには、素敵な未来を切り開く力があるから。\n`;
  result += `信じて、一歩ずつ進んでいこう🌈\n`;
  result += `いつでも応援してるからね！💪✨`;
  
  return result;
}

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    
    await Promise.all(events.map(handleEvent));
    
    res.status(200).end();
  } catch (err) {
    console.error('Error:', err);
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

  // ユーザー情報をSupabaseに保存
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({ line_user_id: userId, last_active: new Date() }, { onConflict: 'line_user_id' });
    
    if (error) console.error('Supabase error:', error);
  } catch (err) {
    console.error('Error saving user:', err);
  }

  let replyMessage;

  if (userMessage === 'タロット占い' || userMessage === '占い') {
    // 3枚のカードを引く（正位置・逆位置含む）
    const drawnCards = drawRandomCards(3);
    const reading = generateTarotReading(drawnCards);

    // カード画像を送信（カード名のみ）
    const imageMessages = drawnCards.map(card => ({
      type: 'image',
      originalContentUrl: getCloudinaryImageUrl(card.name),
      previewImageUrl: getCloudinaryImageUrl(card.name)
    }));

    // 占い結果をSupabaseに保存
    try {
      await supabase.from('readings').insert({
        line_user_id: userId,
        cards: drawnCards.map(c => `${c.name}${c.isReversed ? '（逆位置）' : ''}`),
        reading: reading,
        created_at: new Date()
      });
    } catch (err) {
      console.error('Error saving reading:', err);
    }

    // 画像とテキストを送信
    await client.replyMessage(event.replyToken, [
      ...imageMessages,
      {
        type: 'text',
        text: `🔮 タロット占いの結果 🔮\n\n${reading}\n\n※より詳しい占いをご希望の方は「ルカ占い」とメッセージしてください。`
      }
    ]);

    return;
  }

  // ルカ占い（OpenAI API使用）
  if (userMessage === 'ルカ占い') {
    // ユーザーの状態を「質問待ち」に設定
    userStates.set(userId, { state: 'waiting_for_question' });
    
    replyMessage = {
      type: 'text',
      text: 'こんにちは、私はルカだよ✨\nあなたの心の声を、タロットを通してお聞きするね。\n\nまずは、どんなことを占いたいか教えてくれる？\n例えば「恋愛について」「仕事について」「人間関係について」など、自由に教えてね💕'
    };
  } 
  // ユーザーが質問を入力した場合
  else if (userStates.has(userId) && userStates.get(userId).state === 'waiting_for_question') {
    const userQuestion = userMessage;
    
    // カードを引く
    const drawnCards = drawRandomCards(3);
    
    // カード画像を送信
    const imageMessages = drawnCards.map(card => ({
      type: 'image',
      originalContentUrl: getCloudinaryImageUrl(card.name),
      previewImageUrl: getCloudinaryImageUrl(card.name)
    }));
    
    await client.replyMessage(event.replyToken, [
      ...imageMessages,
      {
        type: 'text',
        text: 'カードを引いてるから、少し待っててね✨\n詳しい解釈を作ってるよ💫'
      }
    ]);
    
    // OpenAI APIで詳細な解釈を生成
    try {
      const aiReading = await generateAIReading(userQuestion, drawnCards);
      
      // 解釈を送信
      await client.pushMessage(userId, {
        type: 'text',
        text: `🔮 タロット占いの結果 🔮\n\n${aiReading}`
      });
      
      // 占い結果をSupabaseに保存
      await supabase.from('readings').insert({
        line_user_id: userId,
        cards: drawnCards.map(c => `${c.name}${c.isReversed ? '（逆位置）' : ''}`),
        reading: aiReading,
        question: userQuestion,
        created_at: new Date()
      });
    } catch (error) {
      console.error('OpenAI API error:', error);
      await client.pushMessage(userId, {
        type: 'text',
        text: 'ごめんね、ちょっとエラーが起きちゃった😢\nもう一度「ルカ占い」と送信してみてくれる？'
      });
    }
    
    // ユーザーの状態をクリア
    userStates.delete(userId);
    return;
  } 
  else if (userMessage === '支払い') {
    // Stripe決済リンクを生成（実装例）
    replyMessage = {
      type: 'text',
      text: '決済機能は現在準備中です。しばらくお待ちください。'
    };
  } else if (userMessage === 'ヘルプ' || userMessage === 'help') {
    replyMessage = {
      type: 'text',
      text: '🔮 タロット占いボットへようこそ！\n\n【使い方】\n・「タロット占い」または「占い」と送信すると、3枚のカードで占います\n・「ルカ占い」でAIによる詳細占いが利用できます\n・「ヘルプ」でこのメッセージを表示します'
    };
  } else {
    replyMessage = {
      type: 'text',
      text: 'こんにちは！タロット占いボットです。\n「タロット占い」と送信してください。\n\n使い方を知りたい場合は「ヘルプ」と送信してください。'
    };
  }

  return client.replyMessage(event.replyToken, replyMessage);
}

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
  res.send('Tarot LINE Bot is running!');
});

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
