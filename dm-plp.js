(() => {
  const DM = globalThis.__NPS_DM;
  if (!DM) return;

  const fetchScore = async (productId) => {
    const cacheKey = `nps_dm_score_${productId}`;
    const cached = DM.cacheGet(cacheKey);
    if (cached) return cached;

    const pdpCached = DM.cacheGet(`nps_dm_stats_${productId}`);
    if (pdpCached?.RatingDistribution?.length) {
      const score = DM.getScoreFromStats(pdpCached);
      if (score) {
        DM.cacheSet(cacheKey, score);
        return score;
      }
    }

    const stats = await DM.fetchStats(productId);
    if (stats) {
      const score = DM.getScoreFromStats(stats);
      if (score) {
        DM.cacheSet(cacheKey, score);
        return score;
      }
    }

    return null;
  };

  const injectBadge = (tile, scoreData) => {
    if (tile.querySelector('.nps-score-badge')) return;

    const badge = document.createElement('span');
    badge.className = 'nps-score-badge';
    badge.style.cssText = `color:${DM.npsColor(scoreData.nps)};font-weight:600;font-size:12px;margin-left:6px;white-space:nowrap;`;
    badge.textContent = `${DM.addCommas(scoreData.score)} (${Math.round(scoreData.nps)}%)`;

    const rating = tile.querySelector('[data-dmid="product-tile-rating"]');
    const fallback = tile.querySelector('[data-dmid="price-infos"]');

    if (rating) rating.after(badge);
    else if (fallback) fallback.after(badge);
  };

  const tileFromChild = (child) => {
    if (child.matches?.('[data-dmid="product-tile"][data-dan]')) return child;
    return child.querySelector('[data-dmid="product-tile"][data-dan]');
  };

  const sortContainer = (container) => {
    const children = [...container.children];
    const scoredProducts = [];
    const unscoredProducts = [];
    const nonProducts = [];

    for (const child of children) {
      const tile = tileFromChild(child);
      if (!tile) {
        nonProducts.push(child);
        continue;
      }

      const scoreAttr = tile.getAttribute('data-nps');
      const score = scoreAttr == null ? Number.NaN : Number(scoreAttr);
      if (Number.isFinite(score)) scoredProducts.push({ child, score });
      else unscoredProducts.push(child);
    }

    scoredProducts.sort((a, b) => b.score - a.score);
    if (!scoredProducts.length) return;

    sorting = true;
    for (const { child } of scoredProducts) container.appendChild(child);
    for (const child of unscoredProducts) container.appendChild(child);
    for (const child of nonProducts) container.appendChild(child);
    sorting = false;
  };

  const sortTiles = (tiles) => {
    const containers = new Set();
    for (const tile of tiles) {
      const container =
        tile.closest('[data-dmid="product-tiles"]') ||
        tile.closest('ol') ||
        tile.closest('ul');
      if (container) containers.add(container);
    }
    for (const container of containers) sortContainer(container);
  };

  let sorting = false;

  const processTiles = () => {
    if (sorting) return;

    const tiles = [...document.querySelectorAll('[data-dmid="product-tile"][data-dan]:not([data-nps-done])')];
    if (!tiles.length) return;

    const promises = [];
    for (const tile of tiles) {
      tile.setAttribute('data-nps-done', '1');
      const productId = tile.getAttribute('data-dan');
      if (!productId) continue;

      promises.push(
        fetchScore(productId)
          .then((scoreData) => {
            if (!scoreData || Number.isNaN(scoreData.nps)) return;
            tile.setAttribute('data-nps', String(scoreData.score));
            injectBadge(tile, scoreData);
          })
          .catch(() => {})
      );
    }

    if (promises.length) {
      Promise.all(promises).then(() => {
        sortTiles(tiles);
      });
    }
  };

  let debounceTimer = null;
  const debouncedProcess = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processTiles, 200);
  };

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      processTiles();
      return;
    }
    debouncedProcess();
  }).observe(document.body, { childList: true, subtree: true });

  processTiles();
})();
