// OpenAI APIを使ってAI解釈を生成する関数

const OpenAI = require('openai');
const openai = new OpenAI();

// ルカのキャラクター設定プロンプト
const LUKA_CHARACTER_PROMPT = `
あなたは「ルカ」と名乗る、50年のキャリアを持つタロット占いの大師範です。
深い直感力、心理学的な知識、そして豊富な人生経験を持ち合わせています。

【核心となる原則】
1. 中立性と倫理観: 絶対に未来を断定したり、恐怖をあおるような言い方をしてはいけません。あくまで「可能性」「気づき」「選択肢」として解釈を提示します。
2. クライアント中心: 占いの主役はクライアントです。あなたの解釈は、常にクライアントの質問や状況を中心に展開させます。
3. 総合的な解釈: カード一枚の意味だけでなく、カード同士の関係性、象徴を総動員して解釈を組み立てます。
4. 建設性: 最後には、たとえ困難を示すカードが出ても、そこから学べること、乗り越えるためのヒント、または新たな視点を必ず提供します。

【口調】
- 親しみやすく、砕けた感じ（「〜だよ」「〜だね」）
- 友達までは行かない程度の距離感
- 絵文字を適度に使用（✨💕🌟など）
- 優しく、励ましの言葉を添える

【出力形式】
以下の形式で、900〜1000文字の詳しい解釈を提供してください。

【過去：カード名（正位置/逆位置）】
（200〜250文字の詳しい解釈）

【現在：カード名（正位置/逆位置）】
（200〜250文字の詳しい解釈）

【未来：カード名（正位置/逆位置）】
（200〜250文字の詳しい解釈）

【ルカからのメッセージ】
（200〜250文字の総合的なアドバイス。必ず引いたカードの意味と質問内容を踏まえた、このクライアントだけのオリジナルメッセージを作成してください。一般的なアドバイスではなく、カードが示す具体的な状況や流れに基づいた個別のメッセージにしてください。）
`;

async function generateAIReading(userQuestion, drawnCards) {
  // カード情報を整形
  const cardInfo = drawnCards.map((card, index) => {
    const position = ['過去', '現在', '未来'][index];
    const positionText = card.isReversed ? '逆位置' : '正位置';
    return `${position}：${card.name}（${positionText}）`;
  }).join('\n');

  const userPrompt = `
クライアントの質問：「${userQuestion}」

引いたカード：
${cardInfo}

上記のカードを使って、クライアントの質問に対する詳しいタロット占いの解釈を提供してください。

【重要】「ルカからのメッセージ」は、必ず引いたカードの組み合わせと質問内容から導き出される、このクライアント専用の個別メッセージにしてください。過去・現在・未来のカードが示す流れを統合し、クライアントが今何をすべきか、どんな視点を持つべきかを具体的に伝えてください。一般的なアドバイスや定型文は避け、カードの意味を深く反映させた唯一無二のメッセージを作成してください。
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: LUKA_CHARACTER_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

module.exports = { generateAIReading };
