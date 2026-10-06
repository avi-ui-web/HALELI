'use strict';
/* הקסם של הללי – a magical English-words app. Plain JS, data kept in localStorage. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const KEY = 'hallel-magic-v1';
const COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7'];
const BOOK_EMOJI = ['📕', '📗', '📘', '📙', '🔮', '🧪', '🐉', '🦄', '🌙', '⭐', '🏰', '🍀', '🦉', '🧹', '👑', '🌸'];
const WORD_EMOJI = ['⭐', '❤️', '🌸', '🍎', '🐱', '🏠', '📖', '✏️', '🎵', '⚽', '🌞', '🌙', '🔥', '💧', '😊', '😢', '🏃', '🍕', '🚗', '🎁', '👀', '🗣️', '🧠', '✨'];
const LEVELS = [
  [0, 'מתלמדת קסמים', '🌱'], [100, 'שוליה קסומה', '✨'], [300, 'מכשפה צעירה', '🪄'],
  [700, 'מכשפה מוסמכת', '🔮'], [1500, 'קוסמת על', '🌟'], [3000, 'ארכי־קוסמת', '👑']
];
const PRAISE = ['מדהים, הללי! ✨', 'קסם אמיתי! 🪄', 'בדיוק! ⭐', 'את אלופה! 🏆', 'לחש מושלם! 🔮', 'וואו! 🌟', 'יש! ככה עושים את זה 💜'];
const OOPS = ['כמעט! ככה לומדים 💜', 'לא נורא, הקסם בדרך ✨', 'בפעם הבאה זה שלך 🌙', 'טעות זה חלק מהקסם 🪄'];

/* ---------- state ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
let S = load();

function fresh() {
  const s = { name: 'הללי', points: 0, streak: { count: 0, day: '' }, sound: true, books: [], certs: [] };
  const b = window.SAMPLE_BOOK;
  s.books.push({ id: uid(), name: b.name, emoji: b.emoji, color: b.color, words: b.words.map(w => newWord(w)) });
  return s;
}
function newWord(w) { return { id: uid(), en: w.en.trim(), he: (w.he || '').trim(), hint: (w.hint || '').trim(), emoji: w.emoji || '', box: 0, right: 0, wrong: 0 }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.books) return s; } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const book = id => S.books.find(b => b.id === id);
const allWords = () => S.books.flatMap(b => b.words);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = a => a[Math.random() * a.length | 0];
const norm = s => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

function level(p = S.points) {
  let i = 0; while (i + 1 < LEVELS.length && p >= LEVELS[i + 1][0]) i++;
  const [from, name, emo] = LEVELS[i]; const next = LEVELS[i + 1];
  return { i, name, emo, pct: next ? Math.round((p - from) / (next[0] - from) * 100) : 100, next: next ? next[0] : null };
}
function award(n) {
  const before = level().i;
  S.points += n;
  const t = today();
  if (S.streak.day !== t) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    S.streak.count = S.streak.day === y ? S.streak.count + 1 : 1;
    S.streak.day = t;
  }
  save();
  if (level().i > before) { setTimeout(() => { sfx.win(); confetti(); toast(`עלית רמה! עכשיו את ${level().name} ${level().emo}`); }, 600); }
}
function mark(w, ok) {
  if (ok) { w.right++; w.box = Math.min(5, w.box + 1); } else { w.wrong++; w.box = Math.max(0, w.box - 2); }
  save();
}
// Smart pick: words with a low box (not known yet) come up more often.
function pickWeighted(words, n) {
  const pool = words.map(w => ({ w, k: Math.random() ** (1 / (6 - Math.min(w.box, 5))) }));
  pool.sort((a, b) => b.k - a.k);
  return pool.slice(0, n).map(p => p.w);
}

/* ---------- speech ---------- */
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en[-_]US/i.test(v.lang) && /google|samantha|female/i.test(v.name)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
const canSpeak = 'speechSynthesis' in window;
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, slow) {
  if (!canSpeak) { toast('הטלפון לא תומך בהקראה 😕'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; if (voice) u.voice = voice;
  u.rate = slow ? 0.5 : 0.85;
  speechSynthesis.speak(u);
}

/* ---------- sounds (synthesized, no files) ---------- */
let ac;
function tone(f, at, dur, type = 'sine', vol = .14) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .05);
  } catch (e) {}
}
const sfx = {
  good() { [784, 988, 1319, 1568].forEach((f, i) => tone(f, i * .07, .3)); tone(2637, .3, .25, 'sine', .05); },
  bad() { tone(330, 0, .2, 'triangle', .12); tone(247, .16, .35, 'triangle', .12); },
  tap() { tone(1400, 0, .06, 'sine', .05); },
  flip() { tone(600, 0, .08, 'sine', .06); tone(900, .05, .1, 'sine', .05); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .35, i % 2 ? 'triangle' : 'sine', .13)); }
};

/* ---------- Hallel avatar (drawn SVG, moods) ---------- */
function avatar(mood = 'happy', o = {}) {
  const hair = '#3a2418', skin = '#f7d5bd', shirt = o.shirt || '#dccbf2';
  const eyes = mood === 'joy'
    ? `<path d="M74 104 Q82 96 90 104" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M110 104 Q118 96 126 104" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="82" cy="103" rx="6.5" ry="8" fill="#3b2416"/><ellipse cx="118" cy="103" rx="6.5" ry="8" fill="#3b2416"/><circle cx="84.5" cy="100" r="2.4" fill="#fff"/><circle cx="120.5" cy="100" r="2.4" fill="#fff"/>`;
  const brows = mood === 'oops'
    ? `<path d="M73 88 Q81 84 90 89" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M110 89 Q119 84 127 88" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<path d="M73 89 Q81 83 90 87" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M110 87 Q119 83 127 89" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const mouth = {
    happy: `<path d="M87 124 Q100 136 113 124" stroke="#b8475c" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    joy: `<path d="M85 121 Q100 143 115 121 Z" fill="#b8475c"/><path d="M90 123 Q100 128 110 123" stroke="#fff" stroke-width="3" fill="none"/>`,
    oops: `<path d="M92 130 Q100 124 108 130" stroke="#b8475c" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    think: `<path d="M93 127 L108 125" stroke="#b8475c" stroke-width="3.5" stroke-linecap="round"/>`
  }[mood] || '';
  const hat = o.hat ? `
    <ellipse cx="100" cy="58" rx="66" ry="13" fill="#4b2f99"/>
    <path d="M60 56 Q86 20 96 -26 Q104 -34 110 -24 Q118 18 140 56 Z" fill="#6d4fc2"/>
    <path d="M62 52 Q100 62 138 52 L140 58 Q100 68 60 58 Z" fill="#f5c451"/>
    <path d="M100 12 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1z" fill="#ffd76a"/>` : '';
  const wand = o.wand ? `
    <g transform="rotate(-30 160 190)"><rect x="156" y="140" width="7" height="62" rx="3" fill="#7a4b2a"/><rect x="156" y="186" width="7" height="16" rx="3" fill="#4a2c18"/></g>
    <path d="M178 128 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1z" fill="#ffd76a"/>
    <circle cx="198" cy="118" r="3" fill="#fff"/><circle cx="168" cy="116" r="2" fill="#fff"/><circle cx="196" cy="150" r="2.5" fill="#ffe9a8"/>` : '';
  return `<svg class="av" viewBox="0 -40 215 262" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="הללי">
    <path d="M40 96 Q36 34 100 30 Q166 34 160 96 L170 205 Q100 222 30 205 Z" fill="${hair}"/>
    <rect x="89" y="134" width="22" height="24" rx="8" fill="#ecc3a6"/>
    <path d="M42 222 Q46 166 100 156 Q154 166 158 222 Z" fill="${shirt}"/>
    <path d="M84 160 Q100 172 116 160" stroke="#c4b0e6" stroke-width="3" fill="none"/>
    <circle cx="120" cy="190" r="6" fill="#f08bbd"/><circle cx="120" cy="190" r="2.5" fill="#f5c451"/>
    <circle cx="57" cy="106" r="8" fill="#ecc3a6"/><circle cx="143" cy="106" r="8" fill="#ecc3a6"/>
    <circle cx="57" cy="117" r="3.2" fill="#f5c451"/><circle cx="143" cy="117" r="3.2" fill="#f5c451"/>
    <ellipse cx="100" cy="100" rx="44" ry="48" fill="${skin}"/>
    <path d="M54 100 Q48 42 104 40 Q152 42 148 98 Q142 68 116 60 Q86 74 54 100 Z" fill="${hair}"/>
    <path d="M52 100 Q50 140 58 170 L48 175 Q40 135 52 100Z" fill="${hair}"/>
    <path d="M148 98 Q152 140 144 172 L154 176 Q162 136 148 98Z" fill="${hair}"/>
    ${brows}${eyes}
    <ellipse cx="71" cy="119" rx="8" ry="5" fill="#f2a0a0" opacity=".55"/><ellipse cx="129" cy="119" rx="8" ry="5" fill="#f2a0a0" opacity=".55"/>
    <path d="M99 108 Q97 116 101 117" stroke="#d9a98a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${mouth}${hat}${wand}
  </svg>`;
}

/* ---------- ui helpers ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function confetti(n = 36) {
  const items = ['✨', '⭐', '🌟', '💜', '🪄', '🎉'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'confetti'; s.textContent = rand(items);
    s.style.left = Math.random() * 100 + 'vw'; s.style.animationDuration = 1.8 + Math.random() * 1.8 + 's'; s.style.animationDelay = Math.random() * .6 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 4500);
  }
}
function openModal(html, onMount) {
  const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.remove('hidden');
  m.onclick = e => { if (e.target === m) closeModal(); };
  onMount && onMount(m);
}
function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }
function on(sel, ev, fn, root = app) { $$(sel, root).forEach(el => el.addEventListener(ev, e => fn(e, el))); }
const starsOf = box => '★'.repeat(box) + '☆'.repeat(5 - box);

/* ---------- navigation (Android back button friendly) ---------- */
function go(name, p = {}, replace = false) {
  const st = { name, p };
  replace ? history.replaceState(st, '') : history.pushState(st, '');
  render(st);
}
window.addEventListener('popstate', e => render(e.state || { name: 'home', p: {} }));
function render(st) {
  closeModal(); if (canSpeak) speechSynthesis.cancel();
  const fn = SCREENS[st.name] || SCREENS.home;
  fn(st.p || {}); window.scrollTo(0, 0);
}

/* ---------- screens ---------- */
const SCREENS = {};

SCREENS.home = () => {
  const L = level(); const known = allWords().filter(w => w.box >= 4).length;
  const streak = S.streak.day === today() || S.streak.day === new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? S.streak.count : 0;
  app.innerHTML = `
    <header class="hero">${avatar('happy', { hat: true })}
      <div style="flex:1">
        <h1>שלום ${esc(S.name)}! ✨</h1>
        <div class="lvl">${L.emo} ${L.name}</div>
        <div class="bar"><i style="width:${L.pct}%"></i></div>
        <small>${L.next ? `עוד ${L.next - S.points} נקודות לרמה הבאה` : 'הגעת לרמה הכי גבוהה!'}</small>
      </div>
    </header>
    <div class="stats">
      <div class="stat"><b>🔥 ${streak}</b><span>ימים ברצף</span></div>
      <div class="stat"><b>⭐ ${S.points}</b><span>נקודות קסם</span></div>
      <div class="stat"><b>🧠 ${known}</b><span>מילים שאני יודעת</span></div>
    </div>
    <button class="btn gold" id="review" ${allWords().length < 2 ? 'disabled' : ''}>🪄 חזרה חכמה על כל המילים</button>
    <h2 class="sec-title">📚 ספרי הלחשים שלי</h2>
    <div class="books">
      ${S.books.map(b => {
        const k = b.words.filter(w => w.box >= 4).length; const pct = b.words.length ? Math.round(k / b.words.length * 100) : 0;
        return `<button class="book" data-id="${b.id}" style="background:${b.color}">
          <div><div class="em">${b.emoji}</div><h3>${esc(b.name)}</h3></div>
          <div><small>${b.words.length} מילים · ${pct}% יודעת</small><div class="mbar"><i style="width:${pct}%"></i></div></div>
        </button>`;
      }).join('')}
      <button class="book btn ghost" id="newBook" style="min-height:128px;flex-direction:column">➕<span>ספר לחשים חדש</span></button>
    </div>
    <div class="foot">
      <button class="btn light" id="certs">🏆 התעודות שלי</button>
      <button class="btn light" id="settings">⚙️ הגדרות</button>
    </div>
    <p class="tip">🦉 טיפ: צרי ספר לחשים לכל מבחן, והכניסי לתוכו את המילים שהמורה נתנה.</p>`;
  on('.book[data-id]', 'click', (e, el) => { sfx.tap(); go('book', { id: el.dataset.id }); });
  $('#newBook').onclick = () => bookForm();
  $('#review').onclick = () => go('quiz', { mode: 'review' });
  $('#certs').onclick = () => go('certs');
  $('#settings').onclick = settings;
};

function bookForm(b) {
  let emoji = b ? b.emoji : rand(BOOK_EMOJI), color = b ? b.color : COLORS[S.books.length % COLORS.length];
  openModal(`
    <h3>${b ? 'עריכת ספר לחשים' : 'ספר לחשים חדש 📖'}</h3>
    <div class="stack">
      <input class="field" id="bn" placeholder="שם, למשל: מבחן יחידה 2" value="${esc(b ? b.name : '')}" maxlength="40">
      <div class="hintline">סמל</div>
      <div class="chips">${BOOK_EMOJI.map(e => `<button class="chip ${e === emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="hintline">צבע</div>
      <div class="chips">${COLORS.map(c => `<button class="swatch ${c === color ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <button class="btn" id="bsave">${b ? 'שמירה' : 'יצירה ✨'}</button>
      ${b ? '<button class="btn light" id="bdel">🗑️ מחיקת הספר</button>' : ''}
    </div>`, m => {
    on('.chip', 'click', (e, el) => { emoji = el.dataset.e; $$('.chip', m).forEach(x => x.classList.toggle('on', x === el)); }, m);
    on('.swatch', 'click', (e, el) => { color = el.dataset.c; $$('.swatch', m).forEach(x => x.classList.toggle('on', x === el)); }, m);
    $('#bsave', m).onclick = () => {
      const name = $('#bn', m).value.trim(); if (!name) { $('#bn', m).focus(); return; }
      if (b) { Object.assign(b, { name, emoji, color }); save(); closeModal(); SCREENS.book({ id: b.id }); }
      else { const nb = { id: uid(), name, emoji, color, words: [] }; S.books.push(nb); save(); closeModal(); sfx.good(); go('book', { id: nb.id }); }
    };
    if (b) $('#bdel', m).onclick = () => {
      if (confirm(`למחוק את "${b.name}" עם כל ${b.words.length} המילים?`)) { S.books = S.books.filter(x => x !== b); save(); closeModal(); history.back(); }
    };
    if (!b) setTimeout(() => $('#bn', m).focus(), 50);
  });
}

SCREENS.book = ({ id }) => {
  const b = book(id); if (!b) return go('home', {}, true);
  const n = b.words.length;
  const mode = (m, emo, label, min = 2) => `<button class="mode" data-m="${m}" ${n < min ? 'disabled' : ''}><b>${emo}</b>${label}</button>`;
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back">➜</button><h2><span>${b.emoji} ${esc(b.name)}</span></h2><button class="icon-btn" id="edit">✏️</button></div>
    ${n < 2 ? '<p class="tip" style="margin-top:0">🦉 הוסיפי לפחות 2 מילים כדי להתחיל לתרגל</p>' : ''}
    <div class="modes">
      ${mode('cards', '🃏', 'כרטיסיות')}
      ${mode('dictation', '🎧', 'הכתבה')}
      ${mode('choice', '🔮', 'בחירה')}
      ${mode('match', '🧩', 'התאמה')}
      ${mode('scramble', '🔤', 'אותיות')}
      ${mode('mix', '🌀', 'הכל ביחד')}
      <button class="mode exam" data-m="exam" ${n < 3 ? 'disabled' : ''}><b>🏆</b>מבחן סיום ותעודה</button>
    </div>
    <div class="panel">
      <h3>➕ הוספת מילה</h3>
      <div class="stack">
        <input class="field en" id="wen" placeholder="English word" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr">
        <div class="row"><input class="field" id="whe" placeholder="תרגום לעברית" autocomplete="off"><button class="btn small light" id="tr" style="flex:none">🔮 תרגמי</button></div>
        <input class="field" id="whint" placeholder="רמז או אסוציאציה שלי (לא חובה)" autocomplete="off">
        <div class="row"><span class="hintline" style="flex:none">סמל:</span><button class="chip" id="wemo" style="flex:none">✨</button><span class="hintline">לחצי לבחירה</span></div>
        <button class="btn" id="wadd">הוספה לספר ✨</button>
        <details><summary>📋 הוספה של הרבה מילים בבת אחת</summary>
          <div class="stack" style="margin-top:8px">
            <div class="hintline">כל מילה בשורה נפרדת. אפשר גם עם תרגום, למשל: <span class="en">apple - תפוח</span></div>
            <textarea class="field" id="bulk" placeholder="apple - תפוח&#10;house&#10;happy - שמח"></textarea>
            <button class="btn teal" id="bulkAdd">הוספת כל המילים</button>
          </div>
        </details>
      </div>
    </div>
    <div class="panel">
      <h3>📜 המילים בספר (${n})</h3>
      ${n ? `<ul class="words">${b.words.map(w => `
        <li class="word">
          <span class="emo">${w.emoji || '✨'}</span>
          <span class="txt"><span class="en">${esc(w.en)}</span><span class="he">${esc(w.he) || '<i>בלי תרגום</i>'}</span>${w.hint ? `<span class="h">💡 ${esc(w.hint)}</span>` : ''}<span class="stars">${starsOf(w.box)}</span></span>
          <button class="mini" data-say="${esc(w.en)}" aria-label="הקראה">🔊</button>
          <button class="mini" data-ed="${w.id}" aria-label="עריכה">✏️</button>
        </li>`).join('')}</ul>` : '<div class="empty">עוד אין מילים. הוסיפי את הראשונה למעלה! 🪄</div>'}
    </div>`;
  $('#back').onclick = () => history.back();
  $('#edit').onclick = () => bookForm(b);
  on('.mode[data-m]', 'click', (e, el) => {
    sfx.tap(); const m = el.dataset.m;
    if (m === 'cards') go('cards', { id }); else if (m === 'match') go('match', { id }); else go('quiz', { id, mode: m });
  });
  on('[data-say]', 'click', (e, el) => speak(el.dataset.say));
  on('[data-ed]', 'click', (e, el) => wordForm(b, b.words.find(w => w.id === el.dataset.ed)));

  let emo = '';
  const en = $('#wen'), he = $('#whe');
  const setEmo = e => { emo = e; $('#wemo').textContent = e || '✨'; };
  en.addEventListener('change', () => {
    const k = norm(en.value); if (!emo && window.EMOJI_MAP[k]) setEmo(window.EMOJI_MAP[k]);
    if (k && !he.value.trim()) translate(k).then(t => { if (t && !he.value.trim()) he.value = t; });
  });
  $('#tr').onclick = async () => {
    const k = norm(en.value); if (!k) { en.focus(); return; }
    $('#tr').textContent = '⏳'; const t = await translate(k); $('#tr').textContent = '🔮 תרגמי';
    if (t) he.value = t; else toast('לא הצלחתי לתרגם, אפשר לכתוב לבד 💜');
  };
  $('#wemo').onclick = () => emojiPicker(setEmo);
  $('#wadd').onclick = () => {
    const w = en.value.trim(); if (!w) { en.focus(); return; }
    if (b.words.some(x => norm(x.en) === norm(w))) { toast('המילה הזאת כבר בספר 😉'); return; }
    b.words.unshift(newWord({ en: w, he: he.value, hint: $('#whint').value, emoji: emo || window.EMOJI_MAP[norm(w)] || '' }));
    save(); sfx.good(); speak(w); SCREENS.book({ id }); toast('לחש חדש נוסף! ✨'); setTimeout(() => $('#wen').focus(), 50);
  };
  [en, he, $('#whint')].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') $('#wadd').click(); }));
  $('#bulkAdd').onclick = async () => {
    const lines = $('#bulk').value.split('\n').map(l => l.trim()).filter(Boolean);
    const added = [];
    for (const l of lines) {
      const m = l.match(/^(.+?)\s*(?:\t|\s[-–=:]\s|[-–=:,]\s*)\s*(.+)$/);
      let e = l, h = '';
      if (m && /[֐-׿]/.test(m[2])) { e = m[1]; h = m[2]; }
      e = e.trim(); if (!e || b.words.some(x => norm(x.en) === norm(e))) continue;
      const w = newWord({ en: e, he: h, emoji: window.EMOJI_MAP[norm(e)] || '' }); b.words.push(w); added.push(w);
    }
    save();
    if (!added.length) { toast('לא נמצאו מילים חדשות'); return; }
    toast(`נוספו ${added.length} מילים! מתרגמת... 🔮`); SCREENS.book({ id });
    for (const w of added.filter(w => !w.he)) { const t = await translate(w.en); if (t) { w.he = t; save(); } }
    if (history.state && history.state.name === 'book' && history.state.p.id === id) SCREENS.book({ id });
  };
};

async function translate(word) {
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|he`);
    const j = await r.json(); const t = j && j.responseData && j.responseData.translatedText;
    if (!t || /[a-z]/i.test(t) || /MYMEMORY|LIMIT/i.test(t)) return '';
    return t.replace(/[.!]+$/, '').trim();
  } catch (e) { return ''; }
}

function emojiPicker(cb) {
  const all = [...new Set([...WORD_EMOJI, ...Object.values(window.EMOJI_MAP)])].slice(0, 120);
  openModal(`<h3>בחרי סמל למילה</h3><div class="chips">${all.map(e => `<button class="chip" data-e="${e}">${e}</button>`).join('')}</div>
    <button class="btn light" id="noemo" style="margin-top:12px">בלי סמל</button>`, m => {
    on('.chip', 'click', (e, el) => { cb(el.dataset.e); closeModal(); }, m);
    $('#noemo', m).onclick = () => { cb(''); closeModal(); };
  });
}

function wordForm(b, w, emoOverride) {
  let emo = emoOverride !== undefined ? emoOverride : w.emoji;
  openModal(`<h3>עריכת מילה</h3><div class="stack">
    <input class="field en" id="een" value="${esc(w.en)}" dir="ltr" autocapitalize="off" spellcheck="false">
    <input class="field" id="ehe" value="${esc(w.he)}" placeholder="תרגום לעברית">
    <input class="field" id="ehint" value="${esc(w.hint)}" placeholder="רמז או אסוציאציה שלי">
    <div class="row"><span class="hintline" style="flex:none">סמל:</span><button class="chip" id="eemo" style="flex:none">${emo || '✨'}</button><span></span></div>
    <button class="btn" id="esave">שמירה</button>
    <button class="btn light" id="edel">🗑️ מחיקת המילה</button></div>`, m => {
    $('#eemo', m).onclick = () => emojiPicker(e => wordForm(b, w, e));
    $('#esave', m).onclick = () => {
      const en = $('#een', m).value.trim(); if (!en) return;
      Object.assign(w, { en, he: $('#ehe', m).value.trim(), hint: $('#ehint', m).value.trim(), emoji: emo }); save(); closeModal(); SCREENS.book({ id: b.id });
    };
    $('#edel', m).onclick = () => { if (confirm(`למחוק את "${w.en}"?`)) { b.words = b.words.filter(x => x !== w); save(); closeModal(); SCREENS.book({ id: b.id }); } };
  });
}

/* ---------- flashcards ---------- */
SCREENS.cards = ({ id }) => {
  const b = book(id); if (!b) return go('home', {}, true);
  let deck = pickWeighted(b.words, b.words.length), i = 0, knew = 0, earned = 0;
  const total = deck.length;
  const show = () => {
    if (i >= deck.length) return endScreen({ title: 'סיימת את הכרטיסיות!', right: knew, total: deck.length, earned, again: () => SCREENS.cards({ id }), bookId: id });
    const w = deck[i];
    app.innerHTML = `
      <div class="top"><button class="icon-btn" id="x">✕</button><h2><span>🃏 כרטיסיות</span></h2><span class="pts">⭐ ${S.points}</span></div>
      <div class="prog"><i style="width:${Math.min(100, i / deck.length * 100)}%"></i></div>
      <div class="flip" id="card"><div class="flip-in">
        <div class="face"><div class="q-emo">${w.emoji || '✨'}</div><div class="q-word en">${esc(w.en)}</div>
          <div class="speak-row"><button class="speak" id="s1">🔊</button><button class="speak slow" id="s2">🐢</button></div>
          <span class="tap">לחצי על הכרטיס כדי להפוך 🔄</span></div>
        <div class="face back"><div class="q-emo">${w.emoji || '✨'}</div><div class="q-he">${esc(w.he) || '—'}</div><div class="q-word en" style="font-size:24px">${esc(w.en)}</div>
          ${w.hint ? `<div class="hint">💡 ${esc(w.hint)}</div>` : ''}<span class="tap">לחצי כדי להפוך בחזרה</span></div>
      </div></div>
      <div class="row"><button class="btn light" id="no">🙈 עוד לא</button><button class="btn teal" id="yes">✓ ידעתי!</button></div>
      <p class="tip">🦉 נסי להיזכר בתרגום לפני שאת הופכת</p>`;
    $('#x').onclick = () => history.back();
    $('#card').onclick = e => { if (e.target.closest('.speak')) return; sfx.flip(); $('#card').classList.toggle('on'); };
    $('#s1').onclick = () => speak(w.en); $('#s2').onclick = () => speak(w.en, true);
    $('#yes').onclick = () => { mark(w, true); knew++; earned += 5; award(5); sfx.good(); i++; show(); };
    $('#no').onclick = () => { mark(w, false); sfx.flip(); if (deck.length < total * 2) deck.push(w); i++; show(); };
    setTimeout(() => speak(w.en), 250);
  };
  show();
};

/* ---------- match pairs ---------- */
SCREENS.match = ({ id }) => {
  const b = book(id); if (!b) return go('home', {}, true);
  const words = pickWeighted(b.words.filter(w => w.he), Math.min(10, b.words.length));
  if (words.length < 2) { toast('צריך לפחות 2 מילים עם תרגום 💜'); return history.back(); }
  const rounds = []; for (let k = 0; k < words.length; k += 5) rounds.push(words.slice(k, k + 5));
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 2) rounds[rounds.length - 2].push(...rounds.pop());
  let r = 0, mistakes = 0, earned = 0;
  const play = () => {
    if (r >= rounds.length) return endScreen({ title: 'כל הזוגות נמצאו!', right: words.length, total: words.length + mistakes, earned, again: () => SCREENS.match({ id }), bookId: id, note: mistakes ? `${mistakes} ניסיונות לא נכונים בדרך` : 'בלי אף טעות! 🤩' });
    const set = rounds[r]; let left = set.length, selEn = null, selHe = null;
    app.innerHTML = `
      <div class="top"><button class="icon-btn" id="x">✕</button><h2><span>🧩 התאמה</span></h2><span class="pts">⭐ ${S.points}</span></div>
      <div class="prog"><i style="width:${r / rounds.length * 100}%"></i></div>
      <p class="tip" style="margin-top:0">חברי כל מילה באנגלית לתרגום שלה</p>
      <div class="match">
        <div class="col">${shuffle(set).map(w => `<button class="mt en" data-en="${w.id}">${esc(w.en)}</button>`).join('')}</div>
        <div class="col">${shuffle(set).map(w => `<button class="mt" data-he="${w.id}">${w.emoji || ''} ${esc(w.he)}</button>`).join('')}</div>
      </div>`;
    $('#x').onclick = () => history.back();
    const check = () => {
      if (!selEn || !selHe) return;
      const a = selEn, c = selHe; selEn = selHe = null;
      if (a.dataset.en === c.dataset.he) {
        const w = set.find(x => x.id === a.dataset.en); speak(w.en); sfx.good(); mark(w, true); award(5); earned += 5;
        a.classList.add('done'); c.classList.add('done'); left--;
        if (!left) { r++; setTimeout(play, 700); }
      } else {
        sfx.bad(); mistakes++; [a, c].forEach(el => { el.classList.remove('sel'); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
      }
    };
    on('[data-en]', 'click', (e, el) => { sfx.tap(); $$('[data-en]').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); selEn = el; speak(set.find(x => x.id === el.dataset.en).en); check(); });
    on('[data-he]', 'click', (e, el) => { sfx.tap(); $$('[data-he]').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); selHe = el; check(); });
  };
  play();
};

/* ---------- question runner: choice / dictation / scramble / mix / exam / review ---------- */
SCREENS.quiz = ({ id, mode }) => {
  const b = id ? book(id) : null;
  if (id && !b) return go('home', {}, true);
  const words = b ? b.words : allWords();
  const exam = mode === 'exam';
  const types = { choice: ['choice'], dictation: ['dictation'], scramble: ['scramble'] }[mode] || ['choice', 'dictation', 'scramble'];
  const n = Math.min(exam ? 12 : 10, Math.max(words.length, 5));
  // repeat words if the book is small so each session has a few questions
  let picked = pickWeighted(words, Math.min(n, words.length));
  while (picked.length < Math.min(n, words.length * 2)) picked = picked.concat(pickWeighted(words, Math.min(n - picked.length, words.length)));
  const queue = picked.map(w => {
    let t = rand(types);
    if (t === 'scramble' && (w.en.replace(/[^a-z]/gi, '').length < 2 || w.en.length > 14)) t = types.includes('choice') ? 'choice' : 'dictation';
    if (t === 'choice' && !w.he) t = 'dictation';
    if (t === 'scramble' && !w.he && !w.emoji) t = 'dictation';
    return { w, t };
  });
  const title = { choice: '🔮 בחירה', dictation: '🎧 הכתבה', scramble: '🔤 אותיות מבולגנות', mix: '🌀 הכל ביחד', exam: '🏆 מבחן סיום', review: '🪄 חזרה חכמה' }[mode];
  let i = 0, right = 0, earned = 0;

  const frame = inner => {
    app.innerHTML = `
      <div class="top"><button class="icon-btn" id="x">✕</button><h2><span>${title}</span></h2><span class="pts">⭐ ${S.points}</span></div>
      <div class="prog"><i style="width:${i / queue.length * 100}%"></i></div>
      <div class="stage">${avatar('think')}${inner}<div class="feedback" id="fb"></div><div id="nx"></div></div>`;
    $('.stage .av').classList.add('mood');
    $('#x').onclick = () => { if (i === 0 || confirm('לצאת באמצע? ההתקדמות במילים כבר נשמרה 💜')) history.back(); };
  };
  const result = (q, ok, msg) => {
    mark(q.w, ok);
    const mood = $('.stage .av'); if (mood) mood.outerHTML = avatar(ok ? 'joy' : 'oops').replace('class="av"', 'class="av mood pop"');
    const fb = $('#fb');
    if (ok) { right++; const pts = q.t === 'dictation' ? 15 : 10; earned += pts; award(pts); sfx.good(); fb.className = 'feedback good'; fb.textContent = rand(PRAISE); }
    else { sfx.bad(); fb.className = 'feedback bad'; fb.innerHTML = msg || rand(OOPS); }
    $('#nx').innerHTML = `<button class="btn next">${i + 1 < queue.length ? 'הבא ⬅' : 'סיום 🎉'}</button>`;
    $('#nx .btn').onclick = () => { i++; next(); };
    if (ok && q.t !== 'dictation') setTimeout(() => { if ($('#nx .btn')) $('#nx .btn').focus(); }, 0);
  };

  const ask = {
    choice(q) {
      const w = q.w, he2en = Math.random() < .4;
      const pool = shuffle(allWords().filter(x => x.he && norm(x.en) !== norm(w.en) && x.he !== w.he));
      const seen = new Set([he2en ? norm(w.en) : w.he]); const dis = [];
      for (const x of pool) { const k = he2en ? norm(x.en) : x.he; if (!seen.has(k)) { seen.add(k); dis.push(x); } if (dis.length === 3) break; }
      const opts = shuffle([w, ...dis]);
      frame(`
        ${he2en ? `<div class="q-label">איך אומרים באנגלית?</div><div class="q-emo">${w.emoji || ''}</div><div class="q-he">${esc(w.he)}</div>`
                : `<div class="q-label">מה התרגום?</div><div class="q-emo">${w.emoji || ''}</div><div class="q-word en">${esc(w.en)}</div>
                   <div class="speak-row"><button class="speak" id="s1">🔊</button></div>`}
        <div class="opts">${opts.map(o => `<button class="opt ${he2en ? 'en' : ''}" data-id="${o.id}">${esc(he2en ? o.en : o.he)}</button>`).join('')}</div>`);
      if (!he2en) { $('#s1').onclick = () => speak(w.en); setTimeout(() => speak(w.en), 250); }
      on('.opt', 'click', (e, el) => {
        const ok = el.dataset.id === w.id;
        $$('.opt').forEach(x => { x.disabled = true; if (x.dataset.id === w.id) x.classList.add('ok'); });
        if (!ok) el.classList.add('no');
        if (he2en || ok) speak(w.en);
        result(q, ok, ok ? '' : `${rand(OOPS)}<br><span class="en">${esc(w.en)}</span> = ${esc(w.he)}`);
      });
    },
    dictation(q) {
      const w = q.w;
      frame(`
        <div class="q-label">הקשיבי וכתבי את המילה באנגלית</div>
        <div class="speak-row"><button class="speak huge" id="s1">🔊</button><button class="speak slow" id="s2" style="align-self:center">🐢</button></div>
        ${!exam ? `<button class="btn small light" id="hint" style="margin:0 auto 10px">💡 רמז</button><div id="hintBox" class="hintline"></div>` : ''}
        <input class="field en" id="ans" dir="ltr" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="type here...">
        <button class="btn teal" id="chk" style="margin-top:10px">בדיקה ✓</button>`);
      const ans = $('#ans');
      $('#s1').onclick = () => speak(w.en); $('#s2').onclick = () => speak(w.en, true);
      setTimeout(() => speak(w.en), 300);
      if (!exam) $('#hint').onclick = () => { $('#hintBox').innerHTML = `${w.emoji || ''} ${esc(w.he)} · מתחילה ב־<b class="en">${esc(w.en[0])}</b> · ${w.en.replace(/\s/g, '').length} אותיות`; };
      const check = () => {
        if (!ans.value.trim()) { ans.focus(); return; }
        const ok = norm(ans.value) === norm(w.en);
        ans.disabled = true; $('#chk').remove(); speak(w.en);
        const a = norm(ans.value), c = w.en;
        const letters = [...c].map((ch, k) => ch === ' ' ? '<span class="sp"></span>' : `<span class="${(a[k] || '').toLowerCase() === ch.toLowerCase() ? 'g' : 'r'}">${esc(ch)}</span>`).join('');
        result(q, ok, `${rand(OOPS)}<div class="cmp-label">ככה כותבים את זה (ירוק = צדקת, אדום = לתקן):</div><div class="letters">${letters}</div>${w.he ? esc(w.he) : ''}`);
        if (ok) $('#fb').insertAdjacentHTML('beforeend', `<div class="letters">${[...c].map(ch => ch === ' ' ? '<span class="sp"></span>' : `<span class="g">${esc(ch)}</span>`).join('')}</div>`);
      };
      $('#chk').onclick = check;
      ans.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    },
    scramble(q) {
      const w = q.w, target = w.en.replace(/\s+/g, '');
      let tiles = shuffle([...target].map((ch, k) => ({ ch, k })));
      if (tiles.map(t => t.ch).join('') === target && target.length > 1) tiles = tiles.reverse();
      const placed = [];
      frame(`
        <div class="q-label">סדרי את האותיות למילה באנגלית</div>
        <div class="q-emo">${w.emoji || ''}</div><div class="q-he">${esc(w.he)}</div>
        <div class="slots" id="slots"></div>
        <div class="tiles" id="tiles">${tiles.map((t, k) => `<button class="tile" data-k="${k}">${esc(t.ch)}</button>`).join('')}</div>
        ${!exam ? '<div class="speak-row"><button class="speak slow" id="s1" title="שמיעה">🔊</button></div>' : ''}`);
      if (!exam) $('#s1').onclick = () => speak(w.en);
      const draw = () => {
        $('#slots').innerHTML = placed.map((k, p) => `<button class="tile in" data-p="${p}">${esc(tiles[k].ch)}</button>`).join('');
        $$('#tiles .tile').forEach(el => el.classList.toggle('used', placed.includes(+el.dataset.k)));
        on('#slots .tile', 'click', (e, el) => { sfx.tap(); placed.splice(+el.dataset.p, 1); draw(); });
        if (placed.length === tiles.length) {
          const got = placed.map(k => tiles[k].ch).join('');
          const ok = got.toLowerCase() === target.toLowerCase();
          $$('.tile').forEach(t => t.disabled = true); speak(w.en);
          result(q, ok, `${rand(OOPS)}<br>התשובה: <span class="en">${esc(w.en)}</span>`);
        }
      };
      on('#tiles .tile', 'click', (e, el) => { if (placed.length < tiles.length) { sfx.tap(); placed.push(+el.dataset.k); draw(); } });
      draw();
    }
  };

  const next = () => {
    if (i >= queue.length) {
      const pct = Math.round(right / queue.length * 100);
      if (exam && pct >= 80) {
        const cert = { id: uid(), book: b.name, emoji: b.emoji, score: pct, date: new Date().toLocaleDateString('he-IL') };
        S.certs.unshift(cert); award(50); save();
        return go('cert', { id: cert.id, fresh: true }, true);
      }
      return endScreen({
        title: exam ? 'כמעט תעודה!' : 'סיימת את התרגול!', right, total: queue.length, earned,
        note: exam ? `צריך 80% כדי לקבל תעודה. קיבלת ${pct}%. עוד קצת תרגול וזה שלך! 💪` : '',
        again: () => SCREENS.quiz({ id, mode }), bookId: id
      });
    }
    ask[queue[i].t](queue[i]);
  };
  next();
};

function endScreen({ title, right, total, earned, again, bookId, note }) {
  const pct = total ? right / total : 1;
  const stars = pct >= .9 ? 3 : pct >= .6 ? 2 : 1;
  sfx.win(); if (stars === 3) confetti();
  app.innerHTML = `
    <div class="end">
      ${avatar(stars > 1 ? 'joy' : 'happy', { hat: true, wand: true })}
      <div class="stars3 pop">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <h2>${title}</h2>
      <div class="big">${right} מתוך ${total} נכון · +${earned} נקודות קסם ✨</div>
      ${note ? `<p class="tip" style="font-size:16px">${note}</p>` : ''}
      <div class="stack">
        <button class="btn gold" id="again">🔁 עוד פעם</button>
        <button class="btn light" id="back">${bookId ? '📖 חזרה לספר' : '🏠 למסך הבית'}</button>
      </div>
    </div>`;
  $('#again').onclick = again;
  $('#back').onclick = () => history.back();
}

/* ---------- certificates ---------- */
SCREENS.cert = ({ id, fresh }) => {
  const c = S.certs.find(x => x.id === id); if (!c) return go('certs', {}, true);
  if (fresh) { sfx.win(); confetti(60); }
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back">➜</button><h2><span>🏆 תעודה</span></h2></div>
    <div class="cert pop">
      <div class="seal">🏅</div>
      <small>בית הספר לקסמים של אנגלית</small>
      <h2>תעודת הצטיינות</h2>
      <div>מוענקת בגאווה ל</div>
      <div class="who">${esc(S.name)}</div>
      <div>על השלמת ספר הלחשים</div>
      <h3 style="margin:6px 0">${c.emoji} ${esc(c.book)}</h3>
      <div>בציון <b>${c.score}</b> 🌟</div>
      ${avatar('joy', { hat: true, wand: true })}
      <small>${c.date} · חתום: הינשוף הראשי 🦉</small>
    </div>
    <p class="tip">📸 אפשר לצלם מסך ולשלוח לכל המשפחה!</p>
    <button class="btn gold" id="home" style="margin-top:8px">🏠 למסך הבית</button>`;
  $('#back').onclick = () => history.back();
  $('#home').onclick = () => go('home');
};

SCREENS.certs = () => {
  app.innerHTML = `
    <div class="top"><button class="icon-btn" id="back">➜</button><h2><span>🏆 התעודות שלי</span></h2></div>
    ${S.certs.length ? `<div class="cert-list">${S.certs.map(c => `<button class="cert-item" data-id="${c.id}"><span style="font-size:34px">🏅</span><span><b>${c.emoji} ${esc(c.book)}</b><small>ציון ${c.score} · ${c.date}</small></span></button>`).join('')}</div>`
      : `<div class="end">${avatar('happy', { hat: true })}<p class="big">עוד אין תעודות. עברי "מבחן סיום" בספר לחשים עם 80% ומעלה, ותקבלי תעודה! 🏆</p></div>`}`;
  $('#back').onclick = () => history.back();
  on('.cert-item', 'click', (e, el) => go('cert', { id: el.dataset.id }));
};

/* ---------- settings ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
function settings() {
  openModal(`<h3>⚙️ הגדרות</h3>
    <div class="set-row"><span>🔔 צלילים</span><button class="switch ${S.sound ? 'on' : ''}" id="snd" aria-label="צלילים"></button></div>
    <div class="set-row"><span>🔊 בדיקת הקראה</span><button class="btn small light" id="tts">Hello Hallel!</button></div>
    <div class="set-row"><span>✏️ השם שלי</span><input class="field" id="nm" value="${esc(S.name)}" style="max-width:150px"></div>
    ${installEvt ? '<div class="set-row"><span>📲 התקנה למסך הבית</span><button class="btn small" id="inst">התקנה</button></div>' : ''}
    <div class="set-row"><span>💾 גיבוי המילים</span><button class="btn small light" id="exp">שמירת קובץ</button></div>
    <div class="set-row"><span>📂 שחזור מגיבוי</span><label class="btn small light">בחירת קובץ<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
    <button class="btn" id="close" style="margin-top:14px">סגירה</button>`, m => {
    $('#snd', m).onclick = e => { S.sound = !S.sound; save(); e.target.classList.toggle('on', S.sound); sfx.tap(); };
    $('#tts', m).onclick = () => speak('Hello Hallel! You are a magical English star!');
    $('#nm', m).onchange = e => { S.name = e.target.value.trim() || 'הללי'; save(); };
    if ($('#inst', m)) $('#inst', m).onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeModal(); };
    $('#exp', m).onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
      a.download = `hallel-backup-${today()}.json`; a.click();
    };
    $('#imp', m).onchange = async e => {
      try { const s = JSON.parse(await e.target.files[0].text()); if (!s.books) throw 0; if (confirm('לשחזר מהגיבוי? זה יחליף את מה שיש עכשיו.')) { S = s; save(); closeModal(); go('home', {}, true); toast('שוחזר בהצלחה ✨'); } }
      catch (err) { toast('הקובץ לא תקין 😕'); }
    };
    $('#close', m).onclick = () => { closeModal(); SCREENS.home(); };
  });
}

/* ---------- start ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
go('home', {}, true);
