const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');

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

// ランダムにカードを選ぶ関数
function drawRandomCards(count) {
  const shuffled = [...allCards].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// タロット占いの結果を生成する関数
function generateTarotReading(cards) {
  const readings = {
    '愚者': '新しい始まり、冒険、自由を象徴しています。',
    '魔術師': '創造力、意志の力、スキルを示しています。',
    '女教皇': '直感、神秘、内なる知恵を表しています。',
    '女帝': '豊かさ、母性、創造性を意味します。',
    '皇帝': '権威、安定、リーダーシップを示します。',
    '教皇': '伝統、精神的な導き、教えを表します。',
    '恋人': '愛、調和、選択を象徴しています。',
    '戦車': '意志の力、勝利、前進を意味します。',
    '力': '内なる強さ、勇気、忍耐を示します。',
    '隠者': '内省、孤独、精神的な探求を表します。',
    '運命の輪': '運命、変化、サイクルを象徴します。',
    '正義': '公正、真実、バランスを意味します。',
    '吊るされた男': '犠牲、新しい視点、停滞を示します。',
    '死神': '変容、終わりと始まり、再生を表します。',
    '節制': 'バランス、調和、節度を象徴します。',
    '悪魔': '束縛、誘惑、物質主義を意味します。',
    '塔': '突然の変化、破壊、啓示を示します。',
    '星': '希望、インスピレーション、癒しを表します。',
    '月': '幻想、不安、潜在意識を象徴します。',
    '太陽': '喜び、成功、活力を意味します。',
    '審判': '復活、評価、新しいスタートを示します。',
    '世界': '完成、達成、統合を表します。'
  };

  // デフォルトのメッセージ
  const defaultReading = 'このカードは、あなたの人生に新しい展開をもたらすでしょう。';

  return cards.map(card => {
    const reading = readings[card] || defaultReading;
    return `【${card}】\n${reading}`;
  }).join('\n\n');
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
    // 3枚のカードを引く
    const drawnCards = drawRandomCards(3);
    const reading = generateTarotReading(drawnCards);

    // カード画像を送信
    const imageMessages = drawnCards.map(card => ({
      type: 'image',
      originalContentUrl: getCloudinaryImageUrl(card),
      previewImageUrl: getCloudinaryImageUrl(card)
    }));

    // 占い結果をSupabaseに保存
    try {
      await supabase.from('readings').insert({
        line_user_id: userId,
        cards: drawnCards,
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
        text: `🔮 タロット占いの結果 🔮\n\n${reading}\n\n※より詳しい占いをご希望の方は「詳細占い」とメッセージしてください。`
      }
    ]);

    return;
  }

  if (userMessage === '詳細占い') {
    replyMessage = {
      type: 'text',
      text: '詳細な占いは有料サービスです。\n料金：500円\n\nお支払いをご希望の方は「支払い」とメッセージしてください。'
    };
  } else if (userMessage === '支払い') {
    // Stripe決済リンクを生成（実装例）
    replyMessage = {
      type: 'text',
      text: '決済機能は現在準備中です。しばらくお待ちください。'
    };
  } else if (userMessage === 'ヘルプ' || userMessage === 'help') {
    replyMessage = {
      type: 'text',
      text: '🔮 タロット占いボットへようこそ！\n\n【使い方】\n・「タロット占い」または「占い」と送信すると、3枚のカードで占います\n・「詳細占い」で有料の詳細占いが利用できます\n・「ヘルプ」でこのメッセージを表示します'
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
