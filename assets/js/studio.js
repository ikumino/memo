(async function () {
  const F = CONFIG.STUDIO_FIELDS;
  const RF = CONFIG.REVIEW_FIELDS;

  const params = new URLSearchParams(location.search);
  const studioName = params.get('name') || '';

  const heroEl = document.getElementById('studioHero');
  const infoEl = document.getElementById('infoGrid');
  const reviewSectionTitle = document.getElementById('reviewSectionTitle');
  const scoreSummaryEl = document.getElementById('scoreSummary');
  const reviewListEl = document.getElementById('reviewList');
  const reviewSortSel = document.getElementById('reviewSort');

  // ---- 返圖 Lightbox ----
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCount = document.getElementById('lightboxCount');

  let lightboxUrls = [];
  let lightboxIndex = 0;

  function updateLightboxView() {
    lightboxImg.src = lightboxUrls[lightboxIndex];
    lightboxCount.textContent = lightboxUrls.length > 1 ? `${lightboxIndex + 1} / ${lightboxUrls.length}` : '';
    const multi = lightboxUrls.length > 1;
    lightboxPrev.hidden = !multi;
    lightboxNext.hidden = !multi;
  }

  function openLightbox(urls, startIndex) {
    if (!urls.length) return;
    lightboxUrls = urls;
    lightboxIndex = startIndex;
    updateLightboxView();
    lightboxOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxOverlay.classList.remove('is-open');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  function showPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxUrls.length) % lightboxUrls.length;
    updateLightboxView();
  }

  function showNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxUrls.length;
    updateLightboxView();
  }

  if (lightboxOverlay) {
    // 點縮圖時用事件代理攔截，改開 lightbox 而不是跳轉/開新分頁
    reviewListEl.addEventListener('click', (e) => {
      const link = e.target.closest('.review-image-link');
      if (!link) return;
      e.preventDefault();
      const group = link.dataset.lightboxGroup;
      const urls = [...reviewListEl.querySelectorAll(`.review-image-link[data-lightbox-group="${group}"]`)]
        .map((a) => a.getAttribute('href'));
      openLightbox(urls, parseInt(link.dataset.lightboxIndex, 10) || 0);
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrev);
    lightboxNext.addEventListener('click', showNext);
    lightboxOverlay.addEventListener('click', (e) => {
      if (e.target === lightboxOverlay) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (!lightboxOverlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });
  }

  function renderState(el, msg, isError) {
    el.innerHTML = `<div class="state-msg ${isError ? 'error' : ''}">
      ${isError ? '' : '<div class="spinner"></div>'}
      ${msg}
    </div>`;
  }

  if (!studioName) {
    renderState(heroEl, '沒有指定工作室，請從<a href="index.html">工作室列表</a>點選進入。', true);
    return;
  }

  renderState(heroEl, '資料載入中...', false);

  try {
    const [studios, reviews] = await Promise.all([
      fetchSheetRows(CONFIG.SHEETS.STUDIOS),
      fetchSheetRows(CONFIG.SHEETS.REVIEWS).catch(() => []),
    ]);

    const studio = studios.find((s) => s[F.NAME] === studioName);
    if (!studio) {
      renderState(heroEl, `找不到工作室「${studioName}」，可能已從試算表移除。<br><a href="index.html">回工作室列表</a>`, true);
      return;
    }

    document.title = `${studio[F.NAME]}｜工作室評價`;

    const status = CONFIG.STATUS_STYLE[studio[F.STATUS]] || CONFIG.STATUS_STYLE['未知'];
    const iconHtml = studio[F.ICON]
      ? `<img src="${studio[F.ICON]}" alt="${studio[F.NAME]} icon" onerror="this.parentElement.textContent='${(studio[F.NAME] || '?').slice(0,1)}'">`
      : (studio[F.NAME] || '?').slice(0, 1);

    heroEl.innerHTML = `
      <div class="charm-icon">${iconHtml}</div>
      <div class="studio-hero-info">
        <div class="title-row">
          <h1>${studio[F.NAME]}</h1>
          ${mediaIconsHtml(studio, F)}
        </div>
        <div class="badge-row">
          <span class="badge ${status.cls}">${status.label}</span>
          ${studio[F.FACTORY] ? `<span class="badge">${studio[F.FACTORY]}</span>` : ''}
        </div>
      </div>
    `;

    // 所有自由文字欄位都套用網址超連結轉換，避免委託方式／備註裡的連結變成純文字
    // 「委託方式」另外把逗號統一換成頓號（例如「常態團, 獨立單」→「常態團、獨立單」）
    const infoCards = [
      { label: '委託方式', value: commasToDunhao(studio[F.ORDER_TYPE]) },
      { label: '客製項目', value: splitTags(studio[F.ITEMS]).join('、') },
    ].filter((item) => item.value);

    infoEl.innerHTML = infoCards
      .map((item) => `
        <div class="info-card">
          <div class="label">${item.label}</div>
          <div class="value">${formatTextWithLinks(item.value)}</div>
        </div>
      `).join('');

    const studioReviews = reviews.filter((r) => r[RF.STUDIO_NAME] === studioName);

    reviewSectionTitle.innerHTML = `經驗分享 <span class="count">${studioReviews.length} 則</span>`;

    if (studioReviews.length) {
      const scores = studioReviews.map((r) => parseFloat(r[RF.SCORE])).filter((n) => !Number.isNaN(n));
      if (scores.length) {
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        scoreSummaryEl.innerHTML = `<span class="num">${avg}</span><span class="of">/ 5・評價平均分數</span>`;
      }

      // 排序：預設「評價新→舊」（依時間戳記），另可切換「評價高→低」（依經驗分數）
      function sortReviews(list, mode) {
        const sorted = [...list];
        if (mode === 'score_desc') {
          sorted.sort((a, b) => (parseFloat(b[RF.SCORE]) || 0) - (parseFloat(a[RF.SCORE]) || 0));
        } else {
          sorted.sort((a, b) => safeDateValue(b[RF.TIMESTAMP]) - safeDateValue(a[RF.TIMESTAMP]));
        }
        return sorted;
      }

      function renderReviewCards(list) {
        reviewListEl.innerHTML = list.map((r, cardIdx) => {
          const imageUrls = splitMultiUrls(r[RF.IMAGE_URLS]);
          const imagesHtml = imageUrls.length
            ? `<div class="review-images">
                ${imageUrls.map((url, imgIdx) => (
                  isImageUrl(url)
                    ? `<a class="review-image-link" href="${url}" data-lightbox-group="review-${cardIdx}" data-lightbox-index="${imgIdx}">
                        <img class="review-thumb" src="${url}" alt="${r[RF.STUDIO_NAME] || ''} 返圖" loading="lazy">
                      </a>`
                    : `<a class="review-link-btn" href="${url}" target="_blank" rel="noopener">返圖連結</a>`
                )).join('')}
              </div>`
            : '';
          return `
          <div class="review-card">
            <div class="review-top">
              <span class="review-reviewer">${r[RF.ORDER_ITEM] || '未填寫委印項目'}</span>
              ${r[RF.SCORE] ? `<span class="review-score">⭐ ${r[RF.SCORE]}</span>` : ''}
            </div>
            <div class="review-meta">
              ${r[RF.TIMESTAMP] ? r[RF.TIMESTAMP] : ''}${r[RF.REVIEWER] ? ` ・ ${r[RF.REVIEWER]}` : ''}
            </div>
            <div class="review-comment">${formatTextWithLinks(r[RF.COMMENT])}</div>
            ${r[RF.NOTE] ? `<div class="review-meta" style="margin-top:8px;">備註：${formatTextWithLinks(r[RF.NOTE])}</div>` : ''}
            ${imagesHtml}
            ${r[RF.STUDIO_REPLY] ? `
              <div class="review-reply">
                <div class="review-reply-label">工作室回覆</div>
                <div class="review-reply-content">${formatTextWithLinks(r[RF.STUDIO_REPLY])}</div>
              </div>
            ` : ''}
          </div>
        `;
        }).join('');
      }

      if (reviewSortSel) {
        renderReviewCards(sortReviews(studioReviews, reviewSortSel.value));
        reviewSortSel.addEventListener('change', () => {
          renderReviewCards(sortReviews(studioReviews, reviewSortSel.value));
        });
      } else {
        renderReviewCards(sortReviews(studioReviews, 'time_desc'));
      }
    } else {
      renderState(reviewListEl, '目前還沒有經驗分享。', false);
      reviewListEl.querySelector('.spinner')?.remove();
    }
  } catch (err) {
    console.error(err);
    renderState(heroEl, `讀取試算表失敗，請確認試算表分享設定為「知道連結的任何人可檢視」。<br>（${err.message}）`, true);
  }
})();
