(() => {
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
  const cacheGet = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
      return data;
    } catch { return null; }
  };
  const cacheSet = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
  };

  const addCommas = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const getLocale = () => {
    const host = location.hostname;
    if (host.includes('decathlon.de')) return 'de-DE';
    if (host.includes('decathlon.co.uk')) return 'en-GB';
    return null;
  };

  const extractModelId = (href) => {
    const path = href.split('#')[0].split('?')[0];
    const match = path.split('/').pop().match(/(\d{5,})$/);
    return match ? match[1] : null;
  };

  const fetchScore = async (locale, modelId) => {
    const cacheKey = `nps_score_${modelId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const domain = locale === 'en-GB' ? 'co.uk' : locale.split('-')[0];
    const res = await fetch(
      `https://www.decathlon.${domain}/api/reviews/${locale}/reviews-stats/${modelId}/product?nbItemsPerPage=0&page=0`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const dist = json?.stats?.ratingDistribution;
    if (!dist?.length) return null;

    let total = 0, five = 0, one = 0;
    for (const { code, value } of dist) {
      total += value;
      if (code === '5') five = value;
      if (code === '1') one = value;
    }
    if (total === 0) return null;

    const nps = ((five - one) / total) * 100;
    const score = Math.round((five - one) * ((five - one) / total));
    const result = { score, nps };
    cacheSet(cacheKey, result);
    return result;
  };

  const npsColor = (nps) => {
    const hue = Math.min(120, Math.max(0, (nps - 50) * 3));
    return `hsl(${hue}, 70%, 35%)`;
  };

  const injectBadge = (card, { score, nps }) => {
    const badge = document.createElement('span');
    badge.style.cssText = `color:${npsColor(nps)};font-weight:600;font-size:12px;margin-left:6px;`;
    badge.textContent = `${addCommas(score)} (${Math.round(nps)}%)`;
    const target = card.querySelector('.review__fullstars__votes');
    if (target) target.after(badge);
  };

  const sortGrid = () => {
    const grid = document.querySelector('ul.product-grid');
    console.log('[NPS] sortGrid, grid found:', !!grid);
    if (!grid) return;
    const items = [...grid.children];
    console.log('[NPS] items to sort:', items.length);
    const scores = items.map(li => {
      const el = li.querySelector('[data-nps]');
      const val = el?.getAttribute('data-nps');
      console.log('[NPS] li score:', val, li.querySelector('.product-card-details__item__title')?.textContent?.trim().slice(0, 30));
      return { li, score: val != null ? parseFloat(val) : -Infinity };
    });
    scores.sort((a, b) => b.score - a.score);
    console.log('[NPS] sorted order:', scores.map(s => s.score));
    sorting = true;
    for (const { li } of scores) grid.appendChild(li);
    sorting = false;
    console.log('[NPS] sort done');
  };

  const locale = getLocale();
  if (!locale) return;

  let sorting = false;

  const processCards = () => {
    if (sorting) return;
    const cards = document.querySelectorAll('.product-card:not([data-nps-done])');
    if (cards.length === 0) return;

    const promises = [];
    for (const card of cards) {
      card.setAttribute('data-nps-done', '1');
      const link = card.querySelector('a[href*="/p/"]');
      if (!link) continue;
      const modelId = extractModelId(link.getAttribute('href'));
      if (!modelId) continue;

      promises.push(
        fetchScore(locale, modelId).then((data) => {
          if (data && !isNaN(data.nps)) {
            card.setAttribute('data-nps', data.score);
            injectBadge(card, data);
          }
        }).catch(() => {})
      );
    }

    if (promises.length > 0) Promise.all(promises).then(sortGrid);
  };

  processCards();
  new MutationObserver(processCards).observe(document.body, { childList: true, subtree: true });
})();
