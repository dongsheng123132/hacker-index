'use strict';

/* Hacker Index — static, no build step, no dependencies.
   Bilingual: every UI string goes through T(), the language lives in the URL
   (?lang=zh) and localStorage so a share link keeps its language. */

const HN = id => 'https://news.ycombinator.com/item?id=' + id;
const PAGE = 200;

const I18N = {
  en: {
    lede: 'Twenty years of Hacker News, every link it kept passing around, ranked by how many different people endorsed it — and every row opens the comment that said so.',
    stats: (e, m, t, g) => `${e} things, ${m} mentions, ${t} media types · archive through ${g}`,
    search: 'Search titles…',
    entries: n => `${n} entries`,
    matches: n => `${n} matches`,
    people: n => `${n} ${n === 1 ? 'person' : 'people'} recommended`,
    mentions: n => `${n} ${n === 1 ? 'mention' : 'mentions'}`,
    receipts: 'The receipts',
    recommends: 'recommends',
    skeptical: 'skeptical',
    none: 'No explicit recommendation found',
    noneBody: 'Mentioned, but nobody used recommending language.',
    more: n => `Show ${n} more`,
    empty: 'Nothing here yet.',
    foot: '49.3M Hacker News items indexed · every row links back to the comment that recommended it · ranking = distinct people, not raw mentions.',
    dataset: 'Download the dataset',
    method: 'Method & known errors',
    intro: null,
    tabs: {},
  },
  zh: {
    lede: '二十年 Hacker News 里被人反复贴来贴去的链接，按「多少个不同的人推荐过」排序——每一条都能点开，看是谁说的。',
    stats: (e, m, t, g) => `${e} 个条目 · ${m} 次提及 · ${t} 个品类 · 数据截至 ${g}`,
    search: '搜索标题…',
    entries: n => `${n} 条`,
    matches: n => `${n} 条匹配`,
    people: n => `${n} 人推荐`,
    mentions: n => `${n} 次提及`,
    receipts: '原话证据',
    recommends: '推荐',
    skeptical: '泼冷水',
    none: '没找到明确的推荐语',
    noneBody: '被提到过，但没有人用推荐的口吻。',
    more: n => `再显示 ${n} 条`,
    empty: '这里还什么都没有。',
    foot: '已索引 4930 万条 HN 记录 · 每条都能点回推荐它的原评论 · 排名看人数，不看次数。',
    dataset: '下载数据集',
    method: '方法与已知错误',
    intro: [
      '这是什么：Hacker News 从 2006 年到现在，被不同的人反复推荐的链接，按「推荐人数」排出来的榜。',
      '为什么可信：每条都能点开，看到具体的评论、作者、年份——不是我们说了算。',
      '哪里不行：只收带链接的推荐。有人在评论里只写书名、不贴链接的，我们抓不到；书那一栏因此偏弱，电影/游戏/播客样本也少。视频、工具、论文三类不受影响。',
    ],
    tabs: {
      video: '视频', tool: '工具', paper: '论文', book: '书',
      film: '电影', game: '游戏', podcast: '播客', music: '音乐',
    },
  },
};

const state = { tabs: [], etype: null, rows: [], shown: PAGE, q: '', cache: {}, lang: 'en', idx: null };

const $ = sel => document.querySelector(sel);
const T = key => I18N[state.lang][key];

function detectLang() {
  const url = new URLSearchParams(location.search).get('lang');
  if (url === 'zh' || url === 'en') return url;
  return localStorage.getItem('hi-lang') || 'en';
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem('hi-lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const u = new URL(location.href);
  if (lang === 'zh') u.searchParams.set('lang', 'zh'); else u.searchParams.delete('lang');
  history.replaceState(null, '', u);
  document.querySelectorAll('#lang button').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === lang));
  paintStatic();
  renderTabs();
  renderIntro();
  renderNote(state.etype);
  render();
}

function paintStatic() {
  $('#lede').textContent = T('lede');
  $('#q').placeholder = T('search');
  $('#foot').innerHTML = `${T('foot')} <a href="data/entities.csv.gz">${T('dataset')}</a> · ` +
    `<a href="method.html${state.lang === 'zh' ? '#zh' : ''}">${T('method')}</a>.`;
  if (state.idx) {
    const i = state.idx;
    $('#stats').textContent = T('stats')(fmt(i.total_entities), fmt(i.total_mentions),
      i.tabs.length, i.generated);
  }
}

function renderIntro() {
  const el = $('#intro');
  const lines = T('intro');
  if (!lines) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join('');
}

async function boot() {
  state.lang = detectLang();
  const idx = await fetch('data/index.json').then(r => r.json());
  state.idx = idx;
  state.tabs = idx.tabs;
  buildLangSwitch();
  document.querySelectorAll('#lang button').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === state.lang));
  paintStatic();
  renderTabs();
  renderIntro();
  const want = location.hash.slice(1);
  await select(state.tabs.some(t => t.slug === want) ? want : state.tabs[0].slug, true);
}

function buildLangSwitch() {
  const box = $('#lang');
  box.innerHTML = '';
  for (const l of ['en', 'zh']) {
    const b = document.createElement('button');
    b.dataset.lang = l;
    b.textContent = l === 'en' ? 'EN' : '中文';
    b.onclick = () => setLang(l);
    box.appendChild(b);
  }
}

function fmt(n) { return Number(n).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US'); }

function renderTabs() {
  const nav = $('#tabs');
  nav.innerHTML = '';
  for (const t of state.tabs) {
    const b = document.createElement('button');
    b.dataset.slug = t.slug;
    const label = (T('tabs') || {})[t.etype] || t.label;
    b.innerHTML = `${label}<span class="n">${fmt(t.count)}</span>`;
    b.classList.toggle('on', t.slug === state.etype);
    b.onclick = () => select(t.slug);
    nav.appendChild(b);
  }
}

function renderNote(slug) {
  const tab = state.tabs.find(t => t.slug === slug) || {};
  let note = tab.note || '';
  if (state.lang === 'zh' && tab.etype === 'book') {
    note = '只收带链接的推荐；评论里只提书名、不贴链接的，目前抓不到';
  }
  const el = $('#note');
  el.textContent = note;
  el.style.display = note ? 'block' : 'none';
}

async function select(slug, initial) {
  state.etype = slug;
  if (!initial) history.replaceState(null, '', '#' + slug);
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('on', b.dataset.slug === slug));
  if (!state.cache[slug]) {
    state.cache[slug] = await fetch(`data/${slug}.json`).then(r => r.json());
  }
  state.rows = state.cache[slug];
  state.shown = PAGE;
  state.q = '';
  $('#q').value = '';
  renderNote(slug);
  render();
  if (!initial) window.scrollTo({ top: 0 });
}

function matches(r, q) {
  return !q || r.t.toLowerCase().includes(q) || r.k.toLowerCase().includes(q);
}

function render() {
  if (!state.rows) return;
  const q = state.q.trim().toLowerCase();
  const rows = state.rows.filter(r => matches(r, q));
  const list = $('#list');
  list.innerHTML = '';
  $('#count').textContent = rows.length === state.rows.length
    ? T('entries')(fmt(rows.length))
    : T('matches')(fmt(rows.length));

  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = T('empty');
    list.appendChild(li);
    return;
  }

  const frag = document.createDocumentFragment();
  rows.slice(0, state.shown).forEach((r, i) => frag.appendChild(card(r, i + 1)));
  list.appendChild(frag);

  if (rows.length > state.shown) {
    const li = document.createElement('li');
    li.className = 'empty';
    const b = document.createElement('button');
    b.className = 'morebtn';
    b.textContent = T('more')(Math.min(PAGE, rows.length - state.shown));
    b.onclick = () => { state.shown += PAGE; render(); };
    li.appendChild(b);
    list.appendChild(li);
  }
}

function card(r, rank) {
  const li = document.createElement('li');
  li.className = 'item';

  const row = document.createElement('div');
  row.className = 'row';

  const num = document.createElement('div');
  num.className = 'rank';
  num.textContent = rank;

  const body = document.createElement('div');
  const a = document.createElement('a');
  a.className = 'name';
  a.href = r.u;
  a.target = '_blank';
  a.rel = 'noopener nofollow';
  a.textContent = r.t;
  a.onclick = e => e.stopPropagation();

  const meta = document.createElement('div');
  meta.className = 'meta';
  const bits = [`<b>${fmt(r.r)}</b>${T('people')(r.r).replace(/^\s*\d+\s*/, ' ')}`];
  bits.push(T('mentions')(fmt(r.m)));
  if (r.a && r.b) bits.push(r.a === r.b ? r.a : `${r.a}–${r.b}`);
  meta.innerHTML = bits.join('<span class="dot">·</span>');

  body.appendChild(a);
  body.appendChild(meta);
  row.appendChild(num);
  row.appendChild(body);

  const ev = document.createElement('div');
  ev.className = 'ev';
  if (r.e && r.e.length) {
    const h = document.createElement('h4');
    h.textContent = T('receipts');
    ev.appendChild(h);
    const ul = document.createElement('ul');
    for (const [id, by, ts, v] of r.e) {
      const li2 = document.createElement('li');
      const cls = v === 'c' ? 'tag c' : 'tag';
      const word = v === 'c' ? T('skeptical') : T('recommends');
      li2.innerHTML =
        `<span class="${cls}">${word}</span>` +
        `<span class="by">${esc(by || '[deleted]')}</span>` +
        ` <span style="color:#8b95a3">${ts}</span> · ` +
        `<a href="${HN(id)}" target="_blank" rel="noopener nofollow">#${id}</a>`;
      ul.appendChild(li2);
    }
    ev.appendChild(ul);
  } else {
    ev.innerHTML = `<h4>${T('none')}</h4><ul><li>${T('noneBody')}</li></ul>`;
  }

  row.onclick = () => li.classList.toggle('open');
  li.appendChild(row);
  li.appendChild(ev);
  return li;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

let timer;
$('#q').addEventListener('input', e => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.q = e.target.value;
    state.shown = PAGE;
    render();
  }, 120);
});

boot().catch(err => {
  $('#stats').textContent = 'failed to load data';
  console.error(err);
});
