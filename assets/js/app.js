(async function () {
  const F = CONFIG.STUDIO_FIELDS;
  const RF = CONFIG.REVIEW_FIELDS;
  const CF = CONFIG.CHANGELOG_FIELDS;
  const NF = CONFIG.LATEST_NEWS_FIELDS;

  const gridEl = document.getElementById('studioGrid');
  const countEl = document.getElementById('resultCount');
  const searchInput = document.getElementById('searchInput');
  const factorySel = document.getElementById('filterFactory');
  const itemSel = document.getElementById('filterItem');
  const statusSel = document.getElementById('filterStatus');
  const sortSel = document.getElementById('filterSort');
  const changelogContentEl = document.getElementById('changelogContent');
  const usageContentEl = document.getElementById('usageContent');
  const newsContentEl = document.getElementById('newsContent');

  let studios = [];
  const scoreMap = {}; // 工作室名稱 -> { avg, count }

  function renderState(msg, isError) {
    gridEl.innerHTML = `<div class="state-msg ${isError ? 'error' : ''}">
      ${isError ? '' : '<div class="spinner"></div>'}
      ${msg}
    </div>`;
  }

  function buildFilterOptions(select, values, placeholder) {
    const unique = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    select.innerHTML = `<option value="">${placeholder}</option>` +
      unique.map((v) => `<option value="${v}">${v}</option>`).join('');
  }

  function studioCard(s) {
    const status = CONFIG.STATUS_STYLE[s[F.STATUS]] || CONFIG.STATUS_STYLE['未知'];
    const items = splitTags(s[F.ITEMS]);
    const score = scoreMap[s[F.NAME]];
    const iconHtml = s[F.ICON]
      ? `<img src="${s[F.ICON]}" alt="${s[F.NAME]} icon" loading="lazy" onerror="this.parentElement.textContent='${(s[F.NAME] || '?').slice(0,1)}'">`
      : (s[F.NAME] || '?').slice(0, 1);

    return `
      <div class="charm-card" data-studio-name="${encodeURIComponent(s[F.NAME] || '')}" role="link" tabindex="0" aria-label="查看${s[F.NAME] || '這間工作室'}詳情">
        <div class="charm-icon">${iconHtml}</div>
        <h3>${s[F.NAME] || '未命名工作室'}</h3>
        ${mediaIconsHtml(s, F)}
        <div class="badge-row">
          <span class="badge ${status.cls}">${status.label}</span>
          ${s[F.FACTORY] ? `<span class="badge">${s[F.FACTORY]}</span>` : ''}
          ${score ? `<span class="badge badge-score">⭐ ${score.avg}（${score.count}則）</span>` : ''}
        </div>
        <div class="tag-row">
          ${items.map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    `;
  }

  function goToStudio(name) {
    if (!name) return;
    window.location.href = `studio.html?name=${encodeURIComponent(name)}`;
  }

  // 卡片整張可點擊：點到噗浪／官網／E-mail 圖示時要讓連結自己動作，不要連動跳轉詳情頁；
  // 其餘任何地方點擊，都導去該工作室的詳情頁。也支援鍵盤 Enter / 空白鍵操作，維持可及性。
  gridEl.addEventListener('click', (e) => {
    const card = e.target.closest('.charm-card');
    if (!card) return;
    if (e.target.closest('.media-icon')) return;
    goToStudio(decodeURIComponent(card.dataset.studioName || ''));
  });
  gridEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.charm-card');
    if (!card) return;
    e.preventDefault();
    goToStudio(decodeURIComponent(card.dataset.studioName || ''));
  });

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const factory = factorySel.value;
    const item = itemSel.value;
    const status = statusSel.value;

    const filtered = studios.filter((s) => {
      if (q && !(s[F.NAME] || '').toLowerCase().includes(q) && !(s[F.PLURK] || '').toLowerCase().includes(q)) return false;
      if (factory && !splitTags(s[F.FACTORY]).includes(factory)) return false;
      if (status && s[F.STATUS] !== status) return false;
      if (item && !splitTags(s[F.ITEMS]).includes(item)) return false;
      return true;
    });

    // 排序：預設「評價新→舊」（依最新一則經驗回報的時間戳記），
    // 另可切換「評價多→寡」（依回報則數）或「評價高→低」（依平均分數）。
    // 完全沒有經驗回報的工作室，三種排序都視為 0，會排在最後面。
    const sortMode = sortSel ? sortSel.value : 'latest_desc';
    filtered.sort((a, b) => {
      const scoreA = scoreMap[a[F.NAME]] || { avg: 0, count: 0, latest: 0 };
      const scoreB = scoreMap[b[F.NAME]] || { avg: 0, count: 0, latest: 0 };
      if (sortMode === 'avg_desc') {
        return (parseFloat(scoreB.avg) || 0) - (parseFloat(scoreA.avg) || 0);
      }
      if (sortMode === 'count_desc') {
        return (scoreB.count || 0) - (scoreA.count || 0);
      }
      return (scoreB.latest || 0) - (scoreA.latest || 0);
    });

    countEl.textContent = `共找到 ${filtered.length} 間工作室`;
    gridEl.innerHTML = filtered.length
      ? filtered.map(studioCard).join('')
      : `<div class="state-msg">找不到符合條件的工作室，換個篩選條件看看？</div>`;
  }

  [searchInput, factorySel, itemSel, statusSel, sortSel].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  function renderUsage(lines) {
    if (!lines || lines.length === 0) {
      usageContentEl.innerHTML = '<p style="text-align:center; font-size:0.85rem; color:var(--ink-soft);">目前尚無使用說明。</p>';
      return;
    }
    usageContentEl.innerHTML = lines
      .map((line, idx) => `
        <div class="usage-line">
          <span class="usage-line-num">${idx + 1}</span>
          <div class="usage-line-text">${formatTextWithLinks(line)}</div>
        </div>
      `)
      .join('');
  }

  function renderChangelog(rows) {
    if (!rows || rows.length === 0) {
      changelogContentEl.innerHTML = '<p style="text-align:center; font-size:0.85rem; color:var(--ink-soft); margin:10px 0;">目前尚無更新紀錄。</p>';
      return;
    }
    const sorted = [...rows].sort((a, b) => safeDateValue(b[CF.TIME]) - safeDateValue(a[CF.TIME]));
    changelogContentEl.innerHTML = `
      <ul class="changelog-list">
        ${sorted.map((item) => `
          <li class="changelog-item">
            <div class="changelog-meta">
              <span class="changelog-time">${item[CF.TIME] || ''}</span>
              <span class="changelog-event">${item[CF.EVENT] || ''}</span>
            </div>
            <div class="changelog-text">${formatTextWithLinks(item[CF.CONTENT])}</div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  // 「一週內」以「發噗時間」欄位為準：只顯示過去 7 天內有發噗紀錄、且有填「最新團務」內容的工作室。
  // 沒有任何工作室在一週內發文時，區塊仍會顯示，但改顯示「這週還沒有新團務」的提示文字。
  function renderNews(rows) {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - WEEK_MS;

    const recent = (rows || [])
      .filter((r) => (r[NF.CONTENT] || '').trim())
      .map((r) => ({ row: r, ts: safeDateValue(r[NF.TIME]) }))
      .filter((item) => item.ts >= cutoff)
      .sort((a, b) => b.ts - a.ts);

    if (recent.length === 0) {
      newsContentEl.innerHTML = '<p class="news-empty">這週還沒有新團務。</p>';
      return;
    }

    newsContentEl.innerHTML = `
      <ul class="news-list">
        ${recent.map(({ row: r }) => `
          <li class="news-item">
            <div class="news-meta">
              <span class="news-studio-name" data-studio-name="${encodeURIComponent(r[NF.NAME] || '')}" role="link" tabindex="0">${r[NF.NAME] || '未命名工作室'}</span>
              <span class="news-time">${r[NF.TIME] || ''}</span>
            </div>
            <div class="news-text">${formatTextWithLinks(r[NF.CONTENT])}</div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  // 點擊「最新團務」裡的工作室名稱，跳到該工作室的詳情頁（比照工作室卡片的點擊行為）
  newsContentEl.addEventListener('click', (e) => {
    const nameEl = e.target.closest('.news-studio-name');
    if (!nameEl) return;
    goToStudio(decodeURIComponent(nameEl.dataset.studioName || ''));
  });
  newsContentEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const nameEl = e.target.closest('.news-studio-name');
    if (!nameEl) return;
    e.preventDefault();
    goToStudio(decodeURIComponent(nameEl.dataset.studioName || ''));
  });

  try {
    renderState('資料載入中...', false);

    const [studioRows, reviewRows, changelogRows, usageLines, newsRows] = await Promise.all([
      fetchSheetRows(CONFIG.SHEETS.STUDIOS),
      fetchSheetRows(CONFIG.SHEETS.REVIEWS).catch(() => []),
      fetchSheetRows(CONFIG.SHEETS.CHANGELOG).catch(() => []),
      fetchSheetColumn(
        CONFIG.SHEETS.USAGE,
        CONFIG.USAGE_CONFIG.COLUMN,
        CONFIG.USAGE_CONFIG.START_ROW
      ).catch(() => []),
      fetchSheetRows(CONFIG.SHEETS.LATEST_NEWS).catch(() => []),
    ]);
    studios = studioRows;

    reviewRows.forEach((r) => {
      const name = r[RF.STUDIO_NAME];
      const score = parseFloat(r[RF.SCORE]);
      if (!name || Number.isNaN(score)) return;
      if (!scoreMap[name]) scoreMap[name] = { total: 0, count: 0, latest: 0 };
      scoreMap[name].total += score;
      scoreMap[name].count += 1;
      const ts = safeDateValue(r[RF.TIMESTAMP]);
      if (ts > scoreMap[name].latest) scoreMap[name].latest = ts;
    });
    Object.keys(scoreMap).forEach((name) => {
      scoreMap[name].avg = (scoreMap[name].total / scoreMap[name].count).toFixed(1);
    });

    const allFactories = studios.flatMap((s) => splitTags(s[F.FACTORY]));
    buildFilterOptions(factorySel, allFactories, '全部工廠');
    buildFilterOptions(statusSel, studios.map((s) => s[F.STATUS]), '全部狀態');
    const allItems = studios.flatMap((s) => splitTags(s[F.ITEMS]));
    buildFilterOptions(itemSel, allItems, '全部客製項目');

    applyFilters();
    renderChangelog(changelogRows);
    renderUsage(usageLines);
    renderNews(newsRows);
  } catch (err) {
    console.error(err);
    renderState(
      `讀取試算表失敗，請確認試算表分享設定為「知道連結的任何人可檢視」。<br>（${err.message}）`,
      true
    );
    renderChangelog([]);
    renderUsage([]);
    renderNews([]);
  }
})();
