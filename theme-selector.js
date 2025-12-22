// テーマ選択機能モジュール

const db = require('./database');

// 一般占いのテーマ
const GENERAL_THEMES = {
  '1': { name: '仕事', emoji: '💼', keyword: '仕事運' },
  '2': { name: '金運', emoji: '💰', keyword: '金運' },
  '3': { name: '健康', emoji: '🏥', keyword: '健康運' },
  '4': { name: '人間関係', emoji: '👥', keyword: '人間関係運' }
};

// 恋愛占いのテーマ
const LOVE_THEMES = {
  '1': { name: '相手の気持ち', emoji: '💭', keyword: '相手の気持ち' },
  '2': { name: '2人の関係性', emoji: '💑', keyword: '2人の関係性' },
  '3': { name: '恋の近未来', emoji: '🔮', keyword: '恋の近未来' },
  '4': { name: '進展の可能性', emoji: '📈', keyword: '進展の可能性' },
  '5': { name: '恋の決断', emoji: '⚖️', keyword: '恋の決断' },
  '6': { name: '相手との相性', emoji: '💕', keyword: '相手との相性' },
  '7': { name: '恋の障害', emoji: '🚧', keyword: '恋の障害' },
  '8': { name: '復縁の可能性', emoji: '🔄', keyword: '復縁の可能性' },
  '9': { name: '新しい出会い', emoji: '✨', keyword: '新しい出会い' }
};

// 一般占いのテーマ選択メッセージ
function getGeneralThemeSelectionMessage() {
  let message = '🔮 一般占い 🔮\n\n';
  message += 'どのテーマで占いたいですか？\n';
  message += '番号を選んでね✨\n\n';
  
  Object.entries(GENERAL_THEMES).forEach(([key, theme]) => {
    message += `${theme.emoji} ${key}. ${theme.name}\n`;
  });
  
  message += '\n番号を送信してください（例：1）';
  
  return message;
}

// 恋愛占いのテーマ選択メッセージ
function getLoveThemeSelectionMessage() {
  let message = '💕 恋愛占い 💕\n\n';
  message += 'どのテーマで占いたいですか？\n';
  message += '番号を選んでね✨\n\n';
  
  Object.entries(LOVE_THEMES).forEach(([key, theme]) => {
    message += `${theme.emoji} ${key}. ${theme.name}\n`;
  });
  
  message += '\n番号を送信してください（例：1）';
  
  return message;
}

// テーマ選択状態を設定
function setThemeSelectionState(userId, type) {
  db.updateUser(userId, {
    themeSelection: {
      isSelecting: true,
      type: type, // 'general' or 'love'
      timestamp: new Date().toISOString()
    }
  });
}

// テーマ選択状態を取得
function getThemeSelectionState(userId) {
  const user = db.getOrCreateUser(userId);
  return user.themeSelection || { isSelecting: false, type: null };
}

// テーマ選択状態をクリア
function clearThemeSelectionState(userId) {
  db.updateUser(userId, {
    themeSelection: {
      isSelecting: false,
      type: null,
      selectedTheme: null
    }
  });
}

// テーマを選択
function selectTheme(userId, themeNumber, type) {
  const themes = type === 'general' ? GENERAL_THEMES : LOVE_THEMES;
  const theme = themes[themeNumber];
  
  if (!theme) {
    return null;
  }
  
  // 選択したテーマを保存
  db.updateUser(userId, {
    themeSelection: {
      isSelecting: false,
      type: type,
      selectedTheme: theme,
      timestamp: new Date().toISOString()
    }
  });
  
  return theme;
}

// 選択されたテーマを取得
function getSelectedTheme(userId) {
  const user = db.getOrCreateUser(userId);
  if (user.themeSelection && user.themeSelection.selectedTheme) {
    return user.themeSelection.selectedTheme;
  }
  return null;
}

// テーマに基づいた占い結果のプレフィックス
function getThemePrefix(theme, type) {
  if (type === 'general') {
    return `【${theme.emoji} ${theme.name}】\n\n`;
  } else if (type === 'love') {
    return `【${theme.emoji} ${theme.name}】\n\n`;
  }
  return '';
}

// 一般占いのテーマ一覧を取得
function getGeneralThemes() {
  return GENERAL_THEMES;
}

// 恋愛占いのテーマ一覧を取得
function getLoveThemes() {
  return LOVE_THEMES;
}

module.exports = {
  getGeneralThemeSelectionMessage,
  getLoveThemeSelectionMessage,
  setThemeSelectionState,
  getThemeSelectionState,
  clearThemeSelectionState,
  selectTheme,
  getSelectedTheme,
  getThemePrefix,
  getGeneralThemes,
  getLoveThemes,
  GENERAL_THEMES,
  LOVE_THEMES
};
