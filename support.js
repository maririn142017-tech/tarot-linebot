// サポート機能モジュール

const db = require('./database');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// サポート会話の最大往復数
const MAX_SUPPORT_TURNS = 5;

// サポート会話を開始
function startSupport(userId, displayName) {
  db.updateUser(userId, {
    supportState: {
      isInSupport: true,
      conversationCount: 0,
      conversationHistory: [],
      startedAt: new Date().toISOString()
    }
  });
  
  const greeting = `${displayName}さん、こんにちは😊

ルカのサポートです✨

以下のことについてお答えできます：

💳 料金プランについて
🔮 占いの使い方
📱 アプリの操作方法
❓ その他のご質問

どんなことでお困りですか？🌈`;
  
  return greeting;
}

// サポート会話中かチェック
function isInSupport(userId) {
  const user = db.getOrCreateUser(userId);
  return user.supportState && user.supportState.isInSupport;
}

// サポート会話を終了
function endSupport(userId) {
  db.updateUser(userId, {
    supportState: {
      isInSupport: false,
      conversationCount: 0,
      conversationHistory: [],
      endedAt: new Date().toISOString()
    }
  });
}

// サポートメッセージを処理
async function handleSupportMessage(userId, userMessage, displayName) {
  const user = db.getOrCreateUser(userId, displayName);
  
  if (!user.supportState || !user.supportState.isInSupport) {
    return startSupport(userId, displayName);
  }
  
  // 会話履歴に追加
  const conversationHistory = user.supportState.conversationHistory || [];
  conversationHistory.push({
    role: 'user',
    content: userMessage
  });
  
  // 会話カウントをインクリメント
  const conversationCount = user.supportState.conversationCount + 1;
  
  // 会話状態を更新
  db.updateUser(userId, {
    supportState: {
      ...user.supportState,
      conversationCount,
      conversationHistory
    }
  });
  
  // 「終了」「戻る」などのキーワードチェック
  if (userMessage.includes('終了') || userMessage.includes('戻る') || userMessage.includes('ありがとう')) {
    endSupport(userId);
    return `${displayName}さん、ご利用ありがとうございました😊

また何かあればいつでも聞いてね✨

下のメニューから占いを楽しんでください🔮💕`;
  }
  
  // ルカの応答を生成
  const lukaResponse = await generateSupportResponse(
    userMessage,
    conversationHistory,
    displayName,
    user.plan
  );
  
  // ルカの応答を履歴に追加
  conversationHistory.push({
    role: 'assistant',
    content: lukaResponse
  });
  
  db.updateUser(userId, {
    supportState: {
      ...user.supportState,
      conversationHistory
    }
  });
  
  // 最大往復数に達したら終了を促す
  if (conversationCount >= MAX_SUPPORT_TURNS) {
    return lukaResponse + '\n\n他にご質問があれば、また「サポート」を選んでね😊✨';
  }
  
  return lukaResponse;
}

// ルカのサポート応答を生成
async function generateSupportResponse(userMessage, conversationHistory, displayName, userPlan) {
  try {
    const systemPrompt = `あなたは優しいタロット占い師「ルカ」のサポート担当です。
以下の情報を参考に、ユーザーの質問に丁寧に答えてください。

【料金プラン】
- 無料：初回1回のみ、3カード占い、ルカなし
- 単品：380円/回、何回でもOK、ルカとの会話あり
- ライト：3,000円/月、1日1回、ルカとの会話あり
- スタンダード：5,000円/月、1日2回、ルカとの会話あり
- プレミアム：9,800円/3ヶ月、1日2回、ルカとの会話あり

【占いの種類】
- 一般占い：仕事、金運、健康、人間関係
- 恋愛占い：相手の気持ち、2人の関係性、恋の近未来など9種類

【使い方】
- リッチメニューから選択
- テーマを選んで占う
- マイページで履歴確認

ユーザーの現在のプラン: ${userPlan}

回答は200文字以内で、絵文字を適度に使ってください。
「終了したい場合は『終了』と送ってね」という案内を最後に追加してください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    return completion.choices[0].message.content;
    
  } catch (error) {
    console.error('サポート応答生成エラー:', error);
    
    // エラー時のフォールバック
    return `${displayName}さん、申し訳ございません🙏

少し時間をおいてから、もう一度お試しください。

【よくある質問】
💳 料金プラン：単品380円、月額3,000円〜
🔮 占い方法：メニューから選択→テーマを選ぶ
📱 使い方：リッチメニューをタップ

終了したい場合は「終了」と送ってね😊✨`;
  }
}

// サポート会話のカウントを取得
function getSupportConversationCount(userId) {
  const user = db.getOrCreateUser(userId);
  if (user.supportState) {
    return user.supportState.conversationCount || 0;
  }
  return 0;
}

module.exports = {
  startSupport,
  isInSupport,
  endSupport,
  handleSupportMessage,
  getSupportConversationCount,
  MAX_SUPPORT_TURNS
};
