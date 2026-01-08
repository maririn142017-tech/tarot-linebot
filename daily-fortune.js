// 今日の運勢生成モジュール
// 日付ベースのシード値を使用して、同じ日なら同じ結果を返す

// シード値を使った疑似乱数生成器
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 日付からシード値を生成（日本時間を使用）
function getDateSeed(userId) {
  const today = new Date();
  // 日本時間（JST）に変換
  const jstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dateString = `${jstDate.getFullYear()}-${jstDate.getMonth() + 1}-${jstDate.getDate()}`;
  
  // ユーザーIDと日付を組み合わせてシード値を生成
  let seed = 0;
  const combined = dateString + userId;
  for (let i = 0; i < combined.length; i++) {
    seed = ((seed << 5) - seed) + combined.charCodeAt(i);
    seed = seed & seed;
  }
  return Math.abs(seed);
}

// 運勢レベルを生成（1-5の星）
function generateFortune(seed, index) {
  const random = seededRandom(seed + index);
  if (random < 0.1) return 5; // 10% - ★★★★★
  if (random < 0.3) return 4; // 20% - ★★★★☆
  if (random < 0.6) return 3; // 30% - ★★★☆☆
  if (random < 0.85) return 2; // 25% - ★★☆☆☆
  return 1; // 15% - ★☆☆☆☆
}

// ラッキーカラーのリスト
const luckyColors = [
  '赤', '青', '黄色', '緑', '紫', 
  'ピンク', 'オレンジ', '白', '黒', '金色',
  '銀色', '水色', 'ラベンダー', 'ミントグリーン', 'コーラルピンク'
];

// 今日のアドバイスのリスト
const adviceList = [
  '新しいことに挑戦する絶好の日です✨',
  '周りの人に感謝の気持ちを伝えてみて💕',
  '直感を信じて行動すると良い結果が待っています🌟',
  '今日は自分を大切にする時間を作りましょう🌸',
  '小さな幸せに気づける一日になりそう🍀',
  '思い切った決断が吉を呼びます💫',
  '笑顔でいることが幸運の鍵です😊',
  '過去の経験が今日の力になります🔮',
  '焦らず、自分のペースで進みましょう🌈',
  '今日出会う人があなたに大切なヒントをくれるかも✨',
  '心の声に耳を傾けてみてください💭',
  '今日は冒険心を持って行動してみて🚀',
  '優しさが幸運を引き寄せる日です💖',
  '今日の小さな努力が大きな成果につながります🌟',
  'リラックスする時間を大切にしてね🌙',
  '今日は自分の魅力が輝く日✨',
  '周りの変化に柔軟に対応すると良いことが🌊',
  '今日の出来事には意味があります🔮',
  '前向きな言葉が幸運を呼び込みます💬',
  '今日は自分らしさを大切にして🌺'
];

// 星を絵文字に変換
function starsToEmoji(level) {
  const filled = '★'.repeat(level);
  const empty = '☆'.repeat(5 - level);
  return filled + empty;
}

// 今日の運勢を生成
function generateDailyFortune(userId, displayName) {
  const seed = getDateSeed(userId);
  
  // 各運勢を生成
  const overall = generateFortune(seed, 1);
  const love = generateFortune(seed, 2);
  const work = generateFortune(seed, 3);
  const money = generateFortune(seed, 4);
  
  // ラッキーカラーとナンバーを生成
  const colorIndex = Math.floor(seededRandom(seed + 5) * luckyColors.length);
  const luckyColor = luckyColors[colorIndex];
  const luckyNumber = Math.floor(seededRandom(seed + 6) * 99) + 1;
  
  // 今日のアドバイスを選択
  const adviceIndex = Math.floor(seededRandom(seed + 7) * adviceList.length);
  const advice = adviceList[adviceIndex];
  
  // 総合運勢レベルを判定
  const totalScore = overall + love + work + money;
  let fortuneLevel;
  if (totalScore >= 18) fortuneLevel = '大吉';
  else if (totalScore >= 15) fortuneLevel = '中吉';
  else if (totalScore >= 12) fortuneLevel = '小吉';
  else if (totalScore >= 9) fortuneLevel = '吉';
  else if (totalScore >= 6) fortuneLevel = '末吉';
  else fortuneLevel = '凶';
  
  // メッセージを生成
  const message = `🔮 ${displayName}さんの今日の運勢 🔮

【 ${fortuneLevel} 】

📊 運勢バロメーター
━━━━━━━━━━━━━━━
✨ 総合運　${starsToEmoji(overall)}
💕 恋愛運　${starsToEmoji(love)}
💼 仕事運　${starsToEmoji(work)}
💰 金運　　${starsToEmoji(money)}
━━━━━━━━━━━━━━━

🎨 ラッキーカラー: ${luckyColor}
🎲 ラッキーナンバー: ${luckyNumber}

💬 ルカからのメッセージ
${advice}

今日も素敵な一日を過ごしてね✨`;

  return message;
}

module.exports = {
  generateDailyFortune
};
