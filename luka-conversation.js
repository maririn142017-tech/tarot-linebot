// ルカの会話機能モジュール

const db = require('./database');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 会話の最大往復数
const MAX_CONVERSATION_TURNS = 3;

// 会話を開始
function startConversation(userId, displayName) {
  db.updateConversationState(userId, {
    isInConversation: true,
    conversationCount: 0,
    conversationHistory: [],
    userQuestion: ''
  });
  
  const greeting = `${displayName}さん、こんにちは🌈今日はどんな事を占いたい❓🔮`;
  
  return greeting;
}

// ユーザーのメッセージを処理
async function handleConversationMessage(userId, userMessage, displayName) {
  const user = db.getOrCreateUser(userId, displayName);
  
  // 会話中でない場合は開始
  if (!user.conversationState.isInConversation) {
    db.updateConversationState(userId, {
      isInConversation: true,
      conversationCount: 0,
      conversationHistory: [],
      userQuestion: ''
    });
  }
  
  // 会話履歴に追加
  const conversationHistory = user.conversationState.conversationHistory || [];
  conversationHistory.push({
    role: 'user',
    content: userMessage
  });
  
  // 会話カウントをインクリメント
  const conversationCount = user.conversationState.conversationCount + 1;
  
  // ユーザーの質問内容を蓄積
  const userQuestion = user.conversationState.userQuestion 
    ? `${user.conversationState.userQuestion} ${userMessage}` 
    : userMessage;
  
  // 会話状態を更新
  db.updateConversationState(userId, {
    conversationCount,
    conversationHistory,
    userQuestion
  });
  
  // ルカの応答を生成
  const lukaResponse = await generateLukaResponse(
    userMessage, 
    conversationCount, 
    displayName,
    conversationHistory
  );
  
  // ルカの応答を履歴に追加
  conversationHistory.push({
    role: 'assistant',
    content: lukaResponse
  });
  
  db.updateConversationState(userId, {
    conversationHistory
  });
  
  return {
    response: lukaResponse,
    conversationCount,
    shouldEndConversation: conversationCount >= MAX_CONVERSATION_TURNS
  };
}

// ルカの応答を生成（AI使用）
async function generateLukaResponse(userMessage, conversationCount, displayName, conversationHistory) {
  try {
    // 1往復目：質問を受け取る
    if (conversationCount === 1) {
      const systemPrompt = `あなたは優しいタロット占い師「ルカ」です。
ユーザーの悩みや質問を共感的に受け止め、簡潔にオウム返しをしてください。
その後、「ルカが占うから下のメニューから選んでね✨」と誘導してください。
文字数は100文字以内で、絵文字を適度に使ってください。`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 150,
        temperature: 0.8
      });
      
      return completion.choices[0].message.content;
    }
    
    // 2往復目：さらに話を聞く
    if (conversationCount === 2) {
      const systemPrompt = `あなたは優しいタロット占い師「ルカ」です。
ユーザーがさらに話を続けた場合、共感的に受け止めてください。
「うんうん、わかったよ😊」のような相槌と、「占うには下のメニューから選んでね🎶」という誘導を含めてください。
文字数は80文字以内で、絵文字を適度に使ってください。`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 120,
        temperature: 0.8
      });
      
      return completion.choices[0].message.content;
    }
    
    // 3往復目以降：メニュー選択を促す
    return 'メニューから選んでね✨';
    
  } catch (error) {
    console.error('ルカの応答生成エラー:', error);
    
    // エラー時のフォールバック
    if (conversationCount === 1) {
      return `${extractKeyword(userMessage)}なんだね😊\nルカが占うから下のメニューから選んでね✨`;
    } else if (conversationCount === 2) {
      return 'うんうん、わかったよ😊\n占うには下のメニューから選んでね🎶';
    } else {
      return 'メニューから選んでね✨';
    }
  }
}

// キーワード抽出（簡易版）
function extractKeyword(text) {
  const keywords = ['彼氏', '彼女', '恋愛', '仕事', '転職', '金運', 'お金', '人間関係', '友達', '家族', '健康', '将来'];
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }
  
  return 'そのこと';
}

// 会話状態をチェック
async function isInConversation(userId) {
  const user = await db.getOrCreateUser(userId);
  return user.conversationState && user.conversationState.isInConversation;
}

// 会話をリセット
function endConversation(userId) {
  db.resetConversation(userId);
}

// ユーザーの質問内容を取得
function getUserQuestion(userId) {
  const user = db.getOrCreateUser(userId);
  return user.conversationState.userQuestion || '';
}

// 会話カウントを取得
function getConversationCount(userId) {
  const user = db.getOrCreateUser(userId);
  return user.conversationState.conversationCount || 0;
}

module.exports = {
  startConversation,
  handleConversationMessage,
  isInConversation,
  endConversation,
  getUserQuestion,
  getConversationCount,
  MAX_CONVERSATION_TURNS
};
