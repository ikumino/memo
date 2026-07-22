// ============================================
// Google 試算表讀取工具
// 透過公開的 gviz CSV 匯出端點抓資料，純前端、不需要 API Key
// 前提：試算表分享設定需為「知道連結的任何人 - 檢視者」
// ============================================

/**
 * 簡易 CSV 解析（支援雙引號包住的欄位、欄位內逗號與換行）
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char === '\r') {
        // 忽略，交給 \n 統一斷行
      } else {
        field += char;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * 抓取指定分頁，回傳「陣列的物件」，key 為表頭文字
 */
async function fetchSheetRows(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`無法讀取分頁「${sheetName}」（HTTP ${res.status}）`);
  }
  const text = await res.text();
  const table = parseCSV(text);
  if (table.length === 0) return [];

  const headers = table[0].map((h) => h.trim());
  return table.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim();
    });
    return obj;
  });
}

/**
 * 抓取指定分頁「某一欄」從某一列開始的內容（不依賴表頭欄位名稱）。
 * 用於「使用說明」這種排版用分頁：同一分頁裡有好幾塊不同用途的文字，
 * 分別放在不同欄位，沒辦法用一般「表頭 -> 物件」的方式抓取。
 *
 * @param {string} sheetName 分頁名稱
 * @param {string} columnLetter 欄位字母，例如 'D'
 * @param {number} startRow 從第幾列開始抓（從 1 算起，跟試算表列號一致）
 * @returns {Promise<string[]>} 該欄位由上到下、去除空白列後的文字陣列
 */
async function fetchSheetColumn(sheetName, columnLetter, startRow = 1) {
  const range = `${columnLetter}${startRow}:${columnLetter}`;
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&range=${encodeURIComponent(range)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`無法讀取分頁「${sheetName}」的 ${columnLetter} 欄（HTTP ${res.status}）`);
  }
  const text = await res.text();
  const table = parseCSV(text);
  return table
    .map((row) => (row[0] ?? '').trim())
    .filter((cell) => cell !== '');
}

/** 把逗號 / 頓號 / 空白分隔的標籤字串拆成陣列 */
function splitTags(str) {
  if (!str) return [];
  return str
    .split(/[,，、\/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 將純文字轉為安全 HTML：跳脫標籤、保留換行、並把網址轉成可點擊的超連結。
 * 供列表頁、詳情頁、更新日誌共用。
 */
function formatTextWithLinks(text) {
  if (!text) return '';
  // 1. 先跳脫 HTML 標籤，避免 XSS
  let safe = String(text).replace(/</g, '&lt;');
  // 2. 換行字元轉換
  safe = safe.replace(/\n/g, '<br>');
  // 3. 網址偵測並轉為超連結
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return safe.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

/**
 * 把「同一個儲存格內填多個網址」的字串拆成網址陣列。
 * 支援換行（Google 試算表儲存格內 Alt+Enter 換行）、逗號、頓號、空白等分隔方式，
 * 並且只保留看起來像 http(s) 網址的項目，避免誤拆到網址內的斜線或其他符號。
 */
function splitMultiUrls(str) {
  if (!str) return [];
  return String(str)
    .split(/[\n,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\//i.test(s));
}

/**
 * 純前端沒辦法讀取遠端檔案的實際 Content-Type，只能靠網址副檔名判斷是不是圖片。
 * 判斷得到的副檔名符合常見圖片格式就當作圖片顯示縮圖，判斷不到（例如雲端硬碟分享連結、
 * 沒有副檔名的短網址等）就顯示成連結按鈕，避免圖片破圖或很久讀不出來。
 */
function isImageUrl(url) {
  if (!url) return false;
  const clean = String(url).trim().split(/[?#]/)[0];
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(clean);
}

/**
 * 安全地解析日期字串以供排序用；解析失敗時回傳 0（視為最舊）。
 * Google 表單寫入試算表的時間戳記，常見格式是「2024/1/15 下午 3:45:30」
 * 這種帶中文上午/下午的格式，瀏覽器內建的 Date.parse 完全看不懂會直接失敗，
 * 導致排序功能「看起來沒作用」（全部都被當成同一個時間）。
 * 這裡先試著手動解析這類格式，解析不了才 fallback 回 Date.parse。
 */
function safeDateValue(str) {
  if (!str) return 0;
  const s = String(str).trim();

  // 格式一：2024/1/15 下午 3:45:30 或 2024/1/15 下午3:45:30（年/月/日 + 上午或下午 + 時:分:秒）
  // 也相容用 - 或 . 分隔日期的寫法，例如 2024-1-15、2024.1.15
  const zhMatch = s.match(
    /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\s+(上午|下午)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (zhMatch) {
    const [, y, mo, d, ampm, hRaw, mi, se] = zhMatch;
    let h = parseInt(hRaw, 10);
    if (ampm === '下午' && h < 12) h += 12;
    if (ampm === '上午' && h === 12) h = 0;
    const t = new Date(+y, +mo - 1, +d, h, +mi, +(se || 0)).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // 格式二：一般 24 小時制，但用 . 分隔日期（Date.parse 對這種格式常常解析失敗）
  const dotMatch = s.match(
    /^(\d{4})[.](\d{1,2})[.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dotMatch) {
    const [, y, mo, d, h, mi, se] = dotMatch;
    const t = new Date(+y, +mo - 1, +d, +(h || 0), +(mi || 0), +(se || 0)).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // 其餘格式交給瀏覽器內建解析（例如標準 ISO 格式、2024/1/15 15:45:30 沒有中文上下午的情況）
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** 把文字中的半形／全形逗號統一換成中文頓號（用於「委託方式」這類條列文字） */
function commasToDunhao(str) {
  if (!str) return '';
  return String(str).replace(/\s*[,，]\s*/g, '、');
}

/**
 * 把試算表裡的「噗浪帳號」欄位轉成噗浪個人頁網址。
 * 支援欄位本身已經是完整網址、或只是帳號／@帳號 兩種寫法。
 */
function plurkProfileUrl(account) {
  if (!account) return '';
  const trimmed = String(account).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  return `https://www.plurk.com/${handle}`;
}

/**
 * 把試算表裡的「官方網站」欄位轉成可點擊的完整網址。
 * 如果漏打 http(s):// 開頭，自動補上 https://。
 */
function websiteUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * 依「其他平台」欄位的網址，自動判斷要顯示哪個平台圖示。
 * 判斷不出來（例如不認得的網域、或不是完整網址）就一律 fallback 成 media-store。
 */
function detectOtherPlatformIcon(url) {
  const s = String(url).toLowerCase();
  if (/discord(\.gg|\.com|app\.com)/.test(s)) return 'discord';
  if (/facebook\.com|fb\.me|fb\.com/.test(s)) return 'facebook';
  if (/instagram\.com/.test(s)) return 'instagram';
  if (/line\.me|lin\.ee/.test(s)) return 'line';
  if (/threads\.com/.test(s)) return 'threads';
  if (/twitter\.com|x\.com/.test(s)) return 'twitter';
  return 'store';
}

/**
 * 產生「噗浪帳號 / 官方網站 / 其他平台 / E-mail」共用的媒體圖示列。
 * 只有欄位有值的項目才會顯示對應圖示，全部都沒有就回傳空字串。
 * iconBase 預設抓 assets/img/ 底下的圖示，index.html 與 studio.html 都放在根目錄，路徑相同。
 * 圖示檔名統一為 media-XXX.svg（例如 media-plurk.svg、media-homepage.svg）。
 */
function mediaIconsHtml(studio, F, iconBase = 'assets/img') {
  const items = [];
  if (studio[F.PLURK]) {
    items.push({
      href: plurkProfileUrl(studio[F.PLURK]),
      icon: `${iconBase}/media-plurk.svg`,
      label: `噗浪：${studio[F.PLURK]}`,
    });
  }
  if (studio[F.WEBSITE]) {
    items.push({
      href: websiteUrl(studio[F.WEBSITE]),
      icon: `${iconBase}/media-homepage.svg`,
      label: `官方網站：${studio[F.WEBSITE]}`,
    });
  }
  if (F.OTHER_PLATFORM && studio[F.OTHER_PLATFORM]) {
    const platformIcon = detectOtherPlatformIcon(studio[F.OTHER_PLATFORM]);
    items.push({
      href: websiteUrl(studio[F.OTHER_PLATFORM]),
      icon: `${iconBase}/media-${platformIcon}.svg`,
      label: `其他平台：${studio[F.OTHER_PLATFORM]}`,
    });
  }
  if (studio[F.EMAIL]) {
    items.push({
      href: `mailto:${String(studio[F.EMAIL]).trim()}`,
      icon: `${iconBase}/media-email.svg`,
      label: `E-mail：${studio[F.EMAIL]}`,
    });
  }
  if (items.length === 0) return '';
  return `<div class="media-row">${items
    .map(
      (item) => `<a class="media-icon" href="${item.href}" target="_blank" rel="noopener" title="${item.label}" aria-label="${item.label}">
        <img src="${item.icon}" alt="${item.label}" loading="lazy">
      </a>`
    )
    .join('')}</div>`;
}
