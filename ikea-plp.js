(() => {
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
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
  const npsColor = (nps) => {
    const hue = Math.min(120, Math.max(0, (nps - 50) * 3));
    return `hsl(${hue}, 70%, 35%)`;
  };

  const getLocale = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { country: parts[0], lang: parts[1] };
  };

  const extractItemNo = (href) => {
    const match = href.match(/(\d{7,})\/?$/);
    return match ? match[1] : null;
  };

  const scoreFromDist = (dist) => {
    let total = 0, five = 0, one = 0;
    for (const { ratingType, ratingCount } of dist) {
      total += ratingCount;
      if (ratingType === 5) five = ratingCount;
      if (ratingType === 1) one = ratingCount;
    }
    if (total === 0) return null;
    const nps = ((five - one) / total) * 100;
    const score = Math.round((five - one) * ((five - one) / total));
    return { score, nps };
  };

  const fetchScore = async (country, lang, itemNo) => {
    const cacheKey = `nps_ikea_score_${itemNo}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
    const pdpCached = cacheGet(`nps_ikea_${itemNo}`);
    if (pdpCached?.ratingDistribution) {
      const result = scoreFromDist(pdpCached.ratingDistribution);
      if (result) { cacheSet(cacheKey, result); return result; }
    }

    const res = await fetch(
      `https://web-api.ikea.com/tugc/public/v5/rating/${country}/${lang}/${itemNo}`,
      { headers: { 'x-client-id': 'a1047798-0fc4-446e-9616-0afe3256d0d7' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const dist = json?.[0]?.ratingDistribution;
    if (!dist?.length) return null;
    const result = scoreFromDist(dist);
    if (result) cacheSet(cacheKey, result);
    return result;
  };

  const injectBadge = (card, { score, nps }) => {
    const badge = document.createElement('span');
    badge.style.cssText = `color:${npsColor(nps)};font-weight:600;font-size:12px;margin-left:6px;`;
    badge.textContent = `${addCommas(score)} (${Math.round(nps)}%)`;
    const target = card.querySelector('.plp-rating__label') || card.querySelector('.listing-rating__label');
    if (target) target.after(badge);
  };

  const sortContainer = (gridSel, itemSel) => {
    const grid = document.querySelector(gridSel);
    if (!grid) return;
    const items = [...grid.querySelectorAll(itemSel)];
    const scored = [], unscored = [];
    for (const el of items) {
      const nps = el.querySelector('[data-nps]');
      if (nps) scored.push({ el, score: parseFloat(nps.getAttribute('data-nps')) });
      else unscored.push(el);
    }
    scored.sort((a, b) => b.score - a.score);
    sorting = true;
    for (const { el } of scored) grid.appendChild(el);
    for (const el of unscored) grid.appendChild(el);
    sorting = false;
  };

  const getItemNo = (card) => {
    // Use data-product-number attribute first, strip 's' prefix
    const num = card.getAttribute('data-product-number');
    if (num) return num.replace(/^s/, '');
    // Fallback to URL extraction
    const link = card.querySelector('a[href*="/p/"]');
    return link ? extractItemNo(link.getAttribute('href')) : null;
  };

  const locale = getLocale();
  if (!locale) return;

  let sorting = false;

  const processCards = () => {
    if (sorting) return;
    const cards = document.querySelectorAll('.plp-mastercard:not([data-nps-done]), .listing-mastercard:not([data-nps-done])');
    if (cards.length === 0) return;

    let hasPlp = false, hasListing = false;
    const promises = [];
    for (const card of cards) {
      const itemNo = getItemNo(card);
      if (!itemNo) continue;
      card.setAttribute('data-nps-done', '1');

      if (card.classList.contains('plp-mastercard')) hasPlp = true;
      else hasListing = true;

      promises.push(
        fetchScore(locale.country, locale.lang, itemNo).then((data) => {
          if (data && !isNaN(data.nps)) {
            card.setAttribute('data-nps', data.score);
            injectBadge(card, data);
          }
        }).catch(() => {})
      );
    }

    if (promises.length > 0) Promise.all(promises).then(() => {
      try {
        if (hasPlp) sortContainer('.plp-product-list__products', ':scope > *');
        if (hasListing) {
          document.querySelectorAll('.listing-carousel__content').forEach(carousel => {
            const slides = [...carousel.querySelectorAll('.listing-carousel-slide')];
            const scored = [], unscored = [];
            for (const el of slides) {
              const nps = el.querySelector('[data-nps]');
              if (nps) scored.push({ el, score: parseFloat(nps.getAttribute('data-nps')) });
              else unscored.push(el);
            }
            scored.sort((a, b) => b.score - a.score);
            sorting = true;
            for (const { el } of scored) carousel.appendChild(el);
            for (const el of unscored) carousel.appendChild(el);
            sorting = false;
          });
        }
      } catch { sorting = false; }
    });
  };

  let debounceTimer;
  const debouncedProcess = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processCards, 200);
  };

  processCards();
  new MutationObserver(debouncedProcess).observe(document.body, { childList: true, subtree: true });
})();
