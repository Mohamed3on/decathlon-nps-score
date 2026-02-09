(() => {
  if (globalThis.__NPS_DM) return;

  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const API_BASE = 'https://apps.bazaarvoice.com/bfd/v1/clients/dm-de/api-products/cv2/resources/data/reviews.json';
  const BFD_TOKEN = '18357,main_site,de_DE';

  const cacheGet = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  };

  const cacheSet = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  };

  const addCommas = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const npsColor = (nps) => {
    const hue = Math.min(120, Math.max(0, (nps - 50) * 3));
    return `hsl(${hue}, 70%, 35%)`;
  };

  const buildUrl = (productId, withMediaFilter) => {
    const params = new URLSearchParams();
    params.set('resource', 'reviews');
    params.set('action', withMediaFilter ? 'PHOTOS_TYPE' : 'REVIEWS_N_STATS');
    params.append('filter', `productid:eq:${productId}`);
    params.append('filter', 'contentlocale:eq:de*,de_DE,de_DE');
    params.append('filter', 'isratingsonly:eq:false');
    if (withMediaFilter) params.append('filter', 'HasMedia:eq:true');
    params.set('filter_reviews', 'contentlocale:eq:de*,de_DE,de_DE');
    params.set('include', withMediaFilter ? 'authors,products,comments' : 'products');
    params.set('filteredstats', 'reviews');
    params.set('Stats', 'Reviews');
    params.set('limit', '1');
    params.set('offset', '0');
    if (withMediaFilter) params.set('limit_comments', '3');
    params.set('sort', 'submissiontime:desc');
    params.set('Offset', '0');
    params.set('apiversion', '5.5');
    params.set('displaycode', '18357-de_de');
    return `${API_BASE}?${params.toString()}`;
  };

  const extractStats = (payload, requestedProductId) => {
    const response = payload?.response;
    const products = response?.Includes?.Products;
    if (!products) return null;

    if (products[requestedProductId]?.ReviewStatistics) {
      return products[requestedProductId].ReviewStatistics;
    }

    const productsOrder = response?.Includes?.ProductsOrder || [];
    for (const id of productsOrder) {
      const stats = products[id]?.ReviewStatistics;
      if (stats) return stats;
    }

    for (const id of Object.keys(products)) {
      const stats = products[id]?.ReviewStatistics;
      if (stats) return stats;
    }

    return null;
  };

  const fetchStats = async (productId) => {
    const cacheKey = `nps_dm_stats_${productId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const requestInit = {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        accept: '*/*',
        'bv-bfd-token': BFD_TOKEN,
      },
      referrer: 'https://www.dm.de/',
    };

    const urls = [buildUrl(productId, true), buildUrl(productId, false)];
    for (const url of urls) {
      try {
        const res = await fetch(url, requestInit);
        if (!res.ok) continue;
        const json = await res.json();
        const stats = extractStats(json, productId);
        if (stats) {
          cacheSet(cacheKey, stats);
          return stats;
        }
      } catch {}
    }

    return null;
  };

  const getScoreFromStats = (stats) => {
    const dist = stats?.RatingDistribution;
    if (!dist?.length) return null;

    let five = 0;
    let one = 0;
    let total = Number(stats.TotalReviewCount) || 0;
    if (!total) total = dist.reduce((sum, entry) => sum + (entry?.Count || 0), 0);
    if (!total) return null;

    for (const entry of dist) {
      if (entry?.RatingValue === 5) five = entry?.Count || 0;
      if (entry?.RatingValue === 1) one = entry?.Count || 0;
    }

    const nps = ((five - one) / total) * 100;
    const score = Math.round((five - one) * ((five - one) / total));
    return { score, nps, total, five, one };
  };

  globalThis.__NPS_DM = {
    cacheGet,
    cacheSet,
    addCommas,
    npsColor,
    fetchStats,
    getScoreFromStats,
  };
})();
