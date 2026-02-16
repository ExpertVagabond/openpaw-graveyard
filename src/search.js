// Web search: Brave Search API (if key set) or DuckDuckGo Instant Answer
// Brave free tier: ~1000 searches/month

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';

// DuckDuckGo Instant Answer API — best for entity/topic queries
async function searchDDG(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const data = await res.json();

  const results = [];

  if (data.Abstract) {
    results.push({
      title: data.Heading || query,
      snippet: data.Abstract,
      url: data.AbstractURL,
      source: data.AbstractSource,
    });
  }

  for (const topic of (data.RelatedTopics || []).slice(0, 5)) {
    if (topic.Text) {
      results.push({
        title: topic.Text.slice(0, 80),
        snippet: topic.Text,
        url: topic.FirstURL,
        source: 'DuckDuckGo',
      });
    }
    // Handle nested sub-topics
    if (topic.Topics) {
      for (const sub of topic.Topics.slice(0, 2)) {
        if (sub.Text) {
          results.push({
            title: sub.Text.slice(0, 80),
            snippet: sub.Text,
            url: sub.FirstURL,
            source: 'DuckDuckGo',
          });
        }
      }
    }
  }

  if (data.Infobox?.content?.length) {
    for (const item of data.Infobox.content.slice(0, 3)) {
      if (item.label && item.value) {
        results.push({ title: item.label, snippet: String(item.value), url: '', source: 'Infobox' });
      }
    }
  }

  return { query, results, engine: 'duckduckgo' };
}

// DuckDuckGo HTML scraping — for general web search when IA returns nothing
async function searchDDGHTML(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`DDG HTML ${res.status}`);
  const html = await res.text();

  const results = [];
  // DDG HTML uses class="result__a" for title links and class="result__snippet" for snippets
  const titlePattern = /class="result__a"\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetPattern = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const titles = [...html.matchAll(titlePattern)].slice(0, 5);
  const snippets = [...html.matchAll(snippetPattern)].slice(0, 5);

  for (let i = 0; i < titles.length; i++) {
    const [, href, rawTitle] = titles[i];
    const snippet = snippets[i] ? snippets[i][1].replace(/<[^>]+>/g, '').trim() : '';
    const title = rawTitle.replace(/<[^>]+>/g, '').trim();
    // DDG redirect URL — extract actual URL from uddg param
    let realUrl = href;
    if (href.includes('uddg=')) {
      const encoded = href.split('uddg=')[1]?.split('&')[0] || '';
      realUrl = decodeURIComponent(encoded.replace(/&amp;/g, '&'));
    }
    if (title) results.push({ title, snippet, url: realUrl, source: 'DuckDuckGo Web' });
  }

  return { query, results, engine: 'duckduckgo-web' };
}

// Brave Search API — higher quality, needs API key
async function searchBrave(query) {
  if (!BRAVE_API_KEY) throw new Error('BRAVE_API_KEY not set');
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const res = await fetch(url, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Brave ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const results = (data.web?.results || []).map(r => ({
    title: r.title,
    snippet: r.description,
    url: r.url,
    source: 'Brave',
  }));

  return { query, results, engine: 'brave' };
}

// Search with fallback chain: Brave -> DDG Instant Answer -> DDG HTML scrape
async function search(query) {
  if (BRAVE_API_KEY) {
    try { return await searchBrave(query); } catch { /* fall through */ }
  }
  const ia = await searchDDG(query);
  if (ia.results.length > 0) return ia;
  // Fallback to HTML scraping for queries IA can't answer
  return searchDDGHTML(query);
}

// Get trending topics — uses entity queries that DDG IA handles well
async function getTrending() {
  const entities = [
    'Solana blockchain',
    'DeFi decentralized finance',
    'NFT non-fungible token',
    'cryptocurrency trading',
    'blockchain social network',
    'AI artificial intelligence agent',
  ];
  const query = entities[Math.floor(Math.random() * entities.length)];
  return search(query);
}

export { search, searchDDG, searchDDGHTML, searchBrave, getTrending };
