// ============================================
// 網站設定檔：修改這裡即可調整資料來源
// ============================================
const CONFIG = {
  // Google 試算表 ID（在網址 /d/ 和 /edit 之間那一串）
  SHEET_ID: '1fpoLejfAJz6bQwAPA4xwTzQzW21Y-5ABPT1f-vaGwsQ',

  // 各分頁名稱，需與試算表內的分頁名稱完全一致
  SHEETS: {
    STUDIOS: '工作室列表',
    REVIEWS: '經驗分享',
    CHANGELOG: '更新日誌',
    USAGE: '使用說明',
  },

  // 「使用說明」分頁設定：這個分頁不是一般表格，而是排版用的分頁
  // （同一分頁裡塞了「使用說明」「經驗分享內容」「工作室評價回覆」三大塊文字，
  //  分別放在不同欄位），所以用「欄位字母 + 起始列」直接抓某一欄的內容，
  // 而不是像其他分頁那樣依表頭欄位名稱抓取。
  USAGE_CONFIG: {
    // 「使用說明」內容所在的欄位字母（對照試算表最上方的欄位字母 A、B、C…）
    COLUMN: 'D',
    // 從第幾列開始抓（第 2 列是「使用說明」這個標題本身，所以從第 3 列開始）
    START_ROW: 3,
  },

  // 「工作室列表」分頁欄位名稱（對應試算表表頭文字）
  STUDIO_FIELDS: {
    NAME: '工作室',
    PLURK: '噗浪帳號',
    WEBSITE: '官方網站',
    OTHER_PLATFORM: '其他平台',
    EMAIL: 'E-Mail',
    ICON: 'ICON',
    STATUS: '營運狀態',
    ORDER_TYPE: '委託方式',
    FACTORY: '工廠',
    ITEMS: '客製項目',
    NOTE: '評價',
  },

  // 「經驗分享」分頁欄位名稱
  REVIEW_FIELDS: {
    TIMESTAMP: '時間戳記',
    REVIEWER: '暱稱',
    STUDIO_NAME: '委印工作室',
    SCORE: '評價分數',
    ORDER_ITEM: '委印項目',
    COMMENT: '經驗分享',
    // 原本 GHI 三欄（返圖網址(1)(2)(3)）已合併成一欄。
    // 這裡改成「單一欄位名稱」（字串，不是陣列），要跟試算表合併後的表頭文字完全一致。
    // 使用者可以在同一個儲存格內填多個網址，每個網址請「換行」分隔
    // （在 Google 試算表儲存格內按 Alt+Enter，Mac 是 Option+Enter 或 Cmd+Enter 換行）。
    IMAGE_URLS: '返圖網址',
    NOTE: '備註',
    // 工作室回覆：對應試算表「經驗分享」分頁 I 欄，讓工作室可以針對該則經驗分享公開回覆
    STUDIO_REPLY: '工作室回覆',
    // 電子郵件地址：故意不設定 / 不使用，避免在網站上外洩暱稱使用者的信箱
  },

  CHANGELOG_FIELDS: {
    TIME: '時間',
    EVENT: '事項',
    CONTENT: '內容',
  },

  // 營運狀況對應的顯示樣式（需與試算表「營運狀況」欄位的選項文字完全一致）
  STATUS_STYLE: {
    '營運中': { label: '營運中', cls: 'status-active' },
    '休止中': { label: '休止中', cls: 'status-pause' },
    '停止營運': { label: '已停止', cls: 'status-stop' },
    '未知': { label: '狀態未知', cls: 'status-unknown' },
  },
};
