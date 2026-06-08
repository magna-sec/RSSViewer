const CACHE_KEY = 'cyber_feed_v2';
const CACHE_TTL = 30 * 60 * 1000;

const WORKER    = 'https://git.benjaminbarnes.workers.dev/?url=';
const FALLBACKS = [
  u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

const categoryTags = {
  cert:'cert', news:'news', vulnerability:'vuln',
  vendor_advisory:'vendor', vendor_blog:'vendor',
  malware_research:'malware', exploit_research:'exploit', community:'community'
};

const categoryIcons = {
  cert:'⚠', news:'📰', vulnerability:'🚨',
  vendor_advisory:'📦', vendor_blog:'📝',
  malware_research:'🧬', exploit_research:'💣', community:'👥'
};

let allArticles  = [];
let currentFilter = 'all';
let mode          = 'all';   // 'all' | 'feed'
let activeFeedIdx = null;
let openIdx       = null;

// ── Proxy ──────────────────────────────────────────────────────
async function proxyFetch(url) {
  try {
    const r = await fetch(WORKER + encodeURIComponent(url), {signal: AbortSignal.timeout(5000)});
    if (r.ok) return await r.text();
  } catch (_) {}
  for (const proxy of FALLBACKS) {
    try {
      const r = await fetch(proxy(url), {signal: AbortSignal.timeout(5000)});
      if (!r.ok) continue;
      const ct   = r.headers.get('content-type') || '';
      const body = ct.includes('json') ? await r.json() : await r.text();
      const text = typeof body === 'string' ? body : body.contents;
      if (text && text.length > 100) return text;
    } catch (_) {}
  }
  throw new Error('all proxies failed');
}

// ── Feed parsing ───────────────────────────────────────────────
function parseFeed(text, feed) {
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  if (xml.querySelector('parsererror')) return [];
  return Array.from(xml.querySelectorAll('item, entry')).map(item => {
    const title   = item.querySelector('title')?.textContent?.trim() || '(no title)';
    const link    = item.querySelector('link')?.textContent?.trim() ||
                    item.querySelector('link')?.getAttribute('href') || '#';
    const dateRaw = item.querySelector('pubDate, published, updated')?.textContent?.trim() || '';
    const dateTs  = dateRaw ? (new Date(dateRaw).getTime() || 0) : 0;
    const tmp = document.createElement('div');
    tmp.innerHTML = item.querySelector('description, summary, content')?.textContent || '';
    const desc = (tmp.textContent || '').trim();
    return {
      title, link, dateTs,
      dateStr: formatDate(dateRaw),
      desc: desc.length > 280 ? desc.slice(0, 280) + '…' : desc,
      feedName: feed.name,
      category: feed.category,
    };
  });
}

function formatDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) + ' ' +
           d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  } catch { return ''; }
}

// ── UI helpers ─────────────────────────────────────────────────
function setStatus(msg) { document.getElementById('statusbar').textContent = msg; }

function setFilter(cat) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  openIdx = null;
  renderArticleList(allArticles.filter(a => cat === 'all' || a.category === cat));
}

function toggle(i) {
  const body = document.getElementById('body-' + i);
  const item = document.getElementById('art-'  + i);
  if (openIdx === i) {
    body.classList.remove('visible');
    item.classList.remove('open');
    openIdx = null;
  } else {
    if (openIdx !== null) {
      document.getElementById('body-' + openIdx)?.classList.remove('visible');
      document.getElementById('art-'  + openIdx)?.classList.remove('open');
    }
    body.classList.add('visible');
    item.classList.add('open');
    item.scrollIntoView({behavior:'smooth', block:'nearest'});
    openIdx = i;
  }
}

function renderArticleList(list) {
  const container = document.getElementById('articles');
  if (!list.length) {
    container.innerHTML = '<div class="placeholder"><div class="big">&#x25A1;</div><div>no articles found</div></div>';
    return;
  }
  container.innerHTML = list.map((a, i) => {
    const tag = categoryTags[a.category] || '';
    return `<div class="article-item" id="art-${i}" onclick="toggle(${i})">
      <div class="article-top">
        <span class="article-source">${a.feedName}</span>
        <span class="tag ${tag}">${a.category.replace(/_/g,' ')}</span>
        ${a.dateStr ? `<span class="article-date">${a.dateStr}</span>` : ''}
      </div>
      <div class="article-title">${a.title}</div>
      <div class="article-body" id="body-${i}">
        <p>${a.desc || '(no description)'}</p>
        <a class="article-link" href="${a.link}" target="_blank" rel="noopener">open article &#x2197;</a>
      </div>
    </div>`;
  }).join('');
}

// ── Sidebar ────────────────────────────────────────────────────
function buildSidebar() {
  const list = document.getElementById('feed-list');
  const categories = {};
  for (const f of FEEDS) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
  }
  let html = '';
  for (const [cat, items] of Object.entries(categories)) {
    const icon = categoryIcons[cat] || '▸';
    html += `<div class="category-header">${icon} ${cat.replace(/_/g,' ')} (${items.length})</div>`;
    for (const f of items) {
      const idx = FEEDS.indexOf(f);
      html += `<div class="feed-item" data-idx="${idx}" onclick="selectFeed(${idx})">
        <span class="feed-name">${f.name}</span>
      </div>`;
    }
  }
  list.insertAdjacentHTML('beforeend', html);
}

function setSidebarActive(which) {
  document.getElementById('all-feeds-btn').classList.toggle('active', which === 'all');
  document.querySelectorAll('.feed-item').forEach(el =>
    el.classList.toggle('active', which !== 'all' && el.dataset.idx == which)
  );
}

// ── Aggregated view ────────────────────────────────────────────
function selectAll() {
  mode = 'all';
  activeFeedIdx = null;
  openIdx = null;
  setSidebarActive('all');
  document.getElementById('filter-bar').style.display  = '';
  document.getElementById('feed-header').style.display = 'none';

  if (allArticles.length) {
    const filtered = currentFilter === 'all' ? allArticles : allArticles.filter(a => a.category === currentFilter);
    renderArticleList(filtered);
    const now = new Date(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}').ts || Date.now())
                  .toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
    setStatus(`${allArticles.length} articles · last updated ${now} · source: github.com/mr-r3b00t/cyber_rss`);
  } else {
    document.getElementById('articles').innerHTML =
      '<div class="placeholder"><div class="big">&#x25A1;</div><div>loading feeds...</div></div>';
    fetchAll();
  }
}

// ── Single feed view ───────────────────────────────────────────
function selectFeed(idx) {
  mode = 'feed';
  activeFeedIdx = idx;
  openIdx = null;
  setSidebarActive(idx);
  document.getElementById('filter-bar').style.display  = 'none';
  document.getElementById('feed-header').style.display = '';

  const f   = FEEDS[idx];
  const tag = categoryTags[f.category] || '';
  document.getElementById('feed-title').textContent = f.name;
  document.getElementById('feed-meta').innerHTML =
    `<span class="tag ${tag}">${f.category.replace(/_/g,' ')}</span>`;

  document.getElementById('articles').innerHTML =
    `<div class="placeholder"><div class="big">&#x25A1;</div><div>fetching ${f.name}…</div></div>`;
  setStatus('fetching: ' + f.url);

  proxyFetch(f.url)
    .then(text => {
      const articles = parseFeed(text, f);
      if (!articles.length) throw new Error('no items found in feed');
      renderArticleList(articles);
      setStatus(`${articles.length} articles from ${f.name}`);
    })
    .catch(e => {
      document.getElementById('articles').innerHTML =
        `<div class="error-msg">&#x26A0; failed to load <strong>${f.name}</strong><br><br>
        <span style="opacity:.7;font-size:11px">${e.message}</span></div>`;
      setStatus('error: ' + e.message);
    });
}

// ── Fetch all feeds ────────────────────────────────────────────
async function fetchAll() {
  document.getElementById('refresh-btn').disabled = true;
  document.getElementById('progress-wrap').style.display = 'block';
  document.getElementById('progress-bar').style.width    = '0%';

  const total = FEEDS.length;
  const state = { done: 0, ok: 0, failed: 0, articleCount: 0, log: [] };

  // Show live loading screen in the articles pane
  document.getElementById('articles').innerHTML = `
    <div id="load-screen">
      <div class="load-title">&#x25A0; Fetching feeds<span class="blink"> _</span></div>
      <div class="load-stats">
        <div><strong id="load-done">0 / ${total}</strong>feeds loaded</div>
        <div><strong id="load-count">0</strong>articles found</div>
        <div><strong id="load-failed" style="color:var(--danger)">0</strong>failed</div>
      </div>
      <div id="load-log"></div>
    </div>`;

  function tick(feed, articles, success) {
    state.done++;
    if (success) { state.ok++; state.articleCount += articles.length; }
    else         { state.failed++; }
    state.log.push({name: feed.name, ok: success, count: articles.length});

    const pct = (state.done / total * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('subtitle').textContent     = `loading ${state.done}/${total} feeds…`;
    document.getElementById('load-done').textContent    = `${state.done} / ${total} `;
    document.getElementById('load-count').textContent   = state.articleCount.toLocaleString();
    document.getElementById('load-failed').textContent  = state.failed;

    const logEl = document.getElementById('load-log');
    if (logEl) {
      const entry = document.createElement('div');
      entry.className = 'load-entry ' + (success ? 'ok' : 'fail');
      entry.textContent = (success ? '✓ ' : '✗ ') + feed.name +
                          (success ? ` — ${articles.length} articles` : ' — failed');
      logEl.prepend(entry);
      // keep last 12 visible
      while (logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
    }
  }

  const results = await Promise.allSettled(
    FEEDS.map(feed =>
      proxyFetch(feed.url)
        .then(text  => { const a = parseFeed(text, feed); tick(feed, a, true);  return a; })
        .catch(()   => {                                   tick(feed, [], false); return []; })
    )
  );

  const articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  articles.sort((a, b) => (b.dateTs || 0) - (a.dateTs || 0));
  allArticles = articles;

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), articles})); } catch (_) {}

  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('refresh-btn').disabled = false;
  document.getElementById('all-feeds-btn').querySelector('.count').textContent = articles.length.toLocaleString();

  const now = new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  document.getElementById('subtitle').textContent =
    `${articles.length.toLocaleString()} articles · ${state.ok}/${total} feeds · ${now}`;
  setStatus(`${articles.length.toLocaleString()} articles from ${state.ok} feeds · ${state.failed} failed · updated ${now} · source: github.com/mr-r3b00t/cyber_rss`);

  if (mode === 'all') {
    const filtered = currentFilter === 'all' ? allArticles : allArticles.filter(a => a.category === currentFilter);
    renderArticleList(filtered);
  }
}

function refresh() {
  if (mode === 'feed' && activeFeedIdx !== null) {
    selectFeed(activeFeedIdx);
    return;
  }
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  allArticles = [];
  openIdx = null;
  document.getElementById('articles').innerHTML =
    '<div class="placeholder"><div class="big">&#x25A1;</div><div>loading feeds…</div></div>';
  fetchAll();
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  buildSidebar();
  document.getElementById('filter-bar').style.display  = '';
  document.getElementById('feed-header').style.display = 'none';
  document.getElementById('all-feeds-btn').classList.add('active');

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      allArticles = cached.articles;
      const age = Math.round((Date.now() - cached.ts) / 60000);
      const at  = new Date(cached.ts).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
      document.getElementById('subtitle').textContent = `${allArticles.length} articles · 45 feeds · ${at} (cached)`;
      document.getElementById('all-feeds-btn').querySelector('.count').textContent = allArticles.length;
      document.getElementById('refresh-btn').disabled = false;
      setStatus(`${allArticles.length} articles from cache (${age}m old) · click refresh to update`);
      renderArticleList(allArticles);
      return;
    }
  } catch (_) {}

  fetchAll();
}

init();
