/* app.js — interface: configuração, QR code, matrizes animadas, navegação
   Parte do site "Alinhamento de Sequências de DNA" (https://github.com/Lucas7Ramos/alinhamento-dna). */
'use strict';
/* ===================================================================
   CONFIGURAÇÃO — itens [ABERTO] da especificação ficam aqui.
   =================================================================== */
const CONFIG = {
  // [ABERTO] Endereço do site publicado. O QR code do Fechamento é gerado a partir dele.
  SITE_URL: 'https://lucas7ramos.github.io/alinhamento-dna/',
  // [ABERTO] Faixa de tamanho "confortável para projetor", marcada no slider do Comparador. Use null para desligar.
  PROJECTOR_RANGE: [4, 7],
  DEFAULT_A: 'GATCGA',
  DEFAULT_B: 'GATTA',
  SPEED_MS: 900,        // tempo por passo no play (300–2500)
  AUTOPLAY_MS: 400,     // velocidade do play automático das matrizes ilustrativas
  MIN_LEN: 3,
  MAX_LEN: 10,
};

/* QR-START */
/* ===== Gerador de QR code embutido (modo byte, correção M, versões 1–10) ===== */
function makeQR(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  // [ec por bloco, blocos grupo 1, dados/bloco g1, blocos g2, dados/bloco g2] — nível M
  const TABLE = [null, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27], [18, 4, 31],
    [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  let ver = 1;
  const cap = (v) => { const t = TABLE[v]; return t[1] * t[2] + (t[3] || 0) * (t[4] || 0); };
  while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > cap(ver) * 8) ver++;
  if (ver > 10) throw new Error('texto longo demais para o QR');
  const [ecLen, b1, d1, b2 = 0, d2 = 0] = TABLE[ver];
  const capBytes = cap(ver);

  // bits de dados
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capBytes * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; data.length < capBytes; p++) data.push(p % 2 ? 0x11 : 0xec);

  // Reed-Solomon em GF(256)
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
  const div = []; for (let i = 0; i < ecLen - 1; i++) div.push(0); div.push(1);
  for (let i = 0, root = 1; i < ecLen; i++) {
    for (let j = 0; j < div.length; j++) { div[j] = mul(div[j], root); if (j + 1 < div.length) div[j] ^= div[j + 1]; }
    root = mul(root, 2);
  }
  const rem = (blk) => { const r = div.map(() => 0); for (const b of blk) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; };
  const blocks = [], eccs = [];
  let off = 0;
  for (let k = 0; k < b1 + b2; k++) { const len = k < b1 ? d1 : d2; const blk = data.slice(off, off + len); off += len; blocks.push(blk); eccs.push(rem(blk)); }
  const code = [];
  for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach((b) => { if (i < b.length) code.push(b[i]); });
  for (let i = 0; i < ecLen; i++) eccs.forEach((e) => code.push(e[i]));

  // matriz
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, v) => { mod[y][x] = v; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  const al = ALIGN[ver], last = al.length - 1;
  al.forEach((ax, a) => al.forEach((ay, b) => {
    if ((a === 0 && b === 0) || (a === 0 && b === last) || (a === last && b === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask) => {
    const d = (0 << 3) | mask; // nível M = 00
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412, bit = (i) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const v = (ver << 12) | r;
    for (let i = 0; i < 18; i++) { const b = ((v >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, b); set(c, a, b); }
  }
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && i < code.length * 8) { mod[y][x] = ((code[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const applyMask = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    const line = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b <= size; b++) {
          if (b < size && get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        for (let b = 0; b + 6 < size; b++) {
          const s = [0, 1, 2, 3, 4, 5, 6].map((k) => get(a, b + k));
          if (s.join() === 'true,false,true,true,true,false,true') {
            const before = b >= 4 && [1, 2, 3, 4].every((k) => !get(a, b - k));
            const after = b + 10 < size && [7, 8, 9, 10].every((k) => !get(a, b + k));
            if (before || after) p += 40;
          }
        }
      }
    };
    line((a, b) => mod[a][b]); line((a, b) => mod[b][a]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (mod[y][x]) dark++;
      if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
    }
    return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } applyMask(k); }
  applyMask(best); drawFormat(best);
  return mod;
}

function qrSVG(text) {
  const mod = makeQR(text), n = mod.length, q = 4;
  let d = '';
  mod.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="QR code do endereço do site"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1A1A1A"/></svg>`;
}
/* QR-END */

/* ===================================================================
   Utilitários
   =================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v) => (v < 0 ? '−' + -v : String(v));
const fmtS = (v) => (v > 0 ? '+' + v : fmt(v));
const cellTxt = ([i, j]) => `(${i},${j})`;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const MODE_INFO = {
  global: { name: 'Global', sub: 'Needleman–Wunsch' },
  semi: { name: 'Semi-Global', sub: 'pontas livres' },
  local: { name: 'Local', sub: 'Smith–Waterman' },
};
const GLYPH = { [DIR.D]: '↖', [DIR.U]: '↑', [DIR.L]: '←' };
const GCLS = { [DIR.D]: 'd', [DIR.U]: 'u', [DIR.L]: 'l' };
const DNAME = { [DIR.D]: 'diagonal', [DIR.U]: 'cima', [DIR.L]: 'esquerda' };
const glyphHTML = (d) => `<i class="ga ${GCLS[d]}">${GLYPH[d]}</i>`;
const END_REASON = { global: 'chegou em (0,0)', semi: 'chegou na borda', local: 'encontrou um 0' };

const App = { speed: CONFIG.SPEED_MS, notes: true, players: [] };

/* ---------- desenho de um alinhamento (3 linhas: A, marcas, B) ---------- */
function alignmentHTML(al, mode, reveal) {
  // reveal: null → tudo; senão { r: colunas do núcleo já montadas (da direita), done: bool }
  const A = [], M = [], B = [];
  const push = (a, m, b, cls, hid) => {
    const h = hid ? ' hid' : '';
    A.push(`<span class="${cls}${h}">${a}</span>`); M.push(`<span class="${cls}${h}">${m}</span>`); B.push(`<span class="${cls}${h}">${b}</span>`);
  };
  const done = !reveal || reveal.done;
  const L = al.cols.length, r = reveal ? reveal.r : L;
  if (mode === 'local') {
    const f = al.flank, P = Math.max(f.aPre.length, f.bPre.length);
    for (let k = 0; k < P; k++) {
      const a = f.aPre[k - (P - f.aPre.length)] || ' ', b = f.bPre[k - (P - f.bPre.length)] || ' ';
      push(a, ' ', b, 't-out', !done);
    }
  } else al.pre.forEach((c) => push(c.a, ' ', c.b, 't-free', !done));
  al.cols.forEach((c, k) => {
    const mk = c.type === 'match' ? '|' : c.type === 'mismatch' ? '×' : ' ';
    push(c.a, mk, c.b, c.type === 'match' ? 't-match' : c.type === 'mismatch' ? 't-mis' : 't-gap', k < L - r);
  });
  if (mode === 'local') {
    const f = al.flank, S = Math.max(f.aSuf.length, f.bSuf.length);
    for (let k = 0; k < S; k++) push(f.aSuf[k] || ' ', ' ', f.bSuf[k] || ' ', 't-out', false);
  } else al.suf.forEach((c) => push(c.a, ' ', c.b, 't-free', false));
  if (!A.length) return '<div class="muted">— nenhum trecho com score positivo</div>';
  return `<div class="aln" aria-label="Alinhamento ${al.textA} sobre ${al.textB}"><div class="ar">${A.join('')}</div><div class="ar mk" aria-hidden="true">${M.join('')}</div><div class="ar">${B.join('')}</div></div>`;
}
function alignmentWidth(al, mode) {
  if (mode === 'local') { const f = al.flank; return Math.max(f.aPre.length, f.bPre.length) + al.cols.length + Math.max(f.aSuf.length, f.bSuf.length); }
  return al.pre.length + al.cols.length + al.suf.length;
}

/* ===================================================================
   Painel: uma matriz + área de cálculo/alinhamento
   =================================================================== */
class Panel {
  constructor(mode, kind) {
    this.mode = mode; this.kind = kind;
    const mi = MODE_INFO[mode];
    this.el = el('div', `panel m-${mode}${kind === 'mini' ? ' mini' : ''}`);
    this.el.innerHTML = `<div class="p-title"><span>${mi.name}</span><span class="p-sub">${mi.sub}</span><span class="p-score"></span></div>
      <div class="mx-wrap"><div class="mx" role="img"></div></div>`;
    this.info = el('div', 'info');
    if (kind === 'single') {
      this.side = el('div', 'side');
      this.side.appendChild(this.info);
      this.el.appendChild(this.side);
    } else this.el.appendChild(this.info);
    this.mx = $('.mx', this.el); this.wrap = $('.mx-wrap', this.el); this.scoreEl = $('.p-score', this.el);
    this.c = 40; this.g = 3;
  }
  setDP(dp) {
    this.dp = dp;
    const { n, m, A, B } = dp;
    this.mx.innerHTML = '';
    this.mx.style.setProperty('--cols', m + 2);
    this.cells = []; this.rowH = []; this.colH = [];
    const add = (cls, txt) => { const e = el('div', cls, txt); this.mx.appendChild(e); return e; };
    add('hd corner', '');
    this.colH.push(add('hd', '−'));
    for (let j = 0; j < m; j++) this.colH.push(add('hd', B[j]));
    for (let i = 0; i <= n; i++) {
      this.rowH.push(add('hd', i === 0 ? '−' : A[i - 1]));
      const row = [];
      for (let j = 0; j <= m; j++) row.push(add('c', ''));
      this.cells.push(row);
    }
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('class', 'ov'); this.svg.setAttribute('aria-hidden', 'true');
    this.mx.appendChild(this.svg);
    this.mx.setAttribute('aria-label', `Matriz ${MODE_INFO[this.mode].name}: A = ${A}, B = ${B}`);
    let wide = false;
    for (const row of dp.S) for (const v of row) if (fmt(v).length >= 3) wide = true;
    this.wide = wide;
    this.setCell(this.c);
  }
  setCell(c) {
    this.c = c; this.g = c >= 50 ? 4 : c >= 34 ? 3 : 2; // mesmo critério de Player.layout
    const s = this.mx.style, { n, m } = this.dp;
    s.setProperty('--c', c + 'px'); s.setProperty('--g', this.g + 'px');
    const fz = Math.max(18, Math.round(c * 0.4));
    s.setProperty('--fz', fz + 'px');
    s.setProperty('--fzh', Math.max(24, Math.round(c * 0.5)) + 'px');
    s.setProperty('--ls', this.wide && c < 36 ? '-1.5px' : '0px');
    s.setProperty('--sw1', Math.max(1.4, c * 0.045).toFixed(2) + 'px');
    s.setProperty('--sw2', Math.max(2.6, c * 0.085).toFixed(2) + 'px');
    const W = (m + 2) * c + (m + 1) * this.g, H = (n + 2) * c + (n + 1) * this.g;
    this.svg.setAttribute('width', W); this.svg.setAttribute('height', H);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }
  cx(j) { return (j + 1) * (this.c + this.g) + this.c / 2; }
  cy(i) { return (i + 1) * (this.c + this.g) + this.c / 2; }

  arrows(i, j) {
    const { ties, dir } = this.dp, t = ties[i][j];
    if (!t) return '';
    const x = this.cx(j), y = this.cy(i), c = this.c, g = this.g;
    let s = '';
    for (const [bit, dx, dy] of [[DIR.D, -1, -1], [DIR.U, 0, -1], [DIR.L, -1, 0]]) {
      if (!(t & bit)) continue;
      const thick = bit === dir[i][j];
      const a0 = dx && dy ? c * 0.3 : c * 0.36, a1 = c * 0.5 + g / 2 + c * 0.1;
      const r = (v) => v.toFixed(1);
      s += `<line class="ar ${GCLS[bit]}${thick ? ' thick' : ''}" x1="${r(x + dx * a0)}" y1="${r(y + dy * a0)}" x2="${r(x + dx * a1)}" y2="${r(y + dy * a1)}" marker-end="url(#ah-${GCLS[bit]}${thick ? '-t' : ''})"/>`;
    }
    return s;
  }
  cellHTML(i, j) {
    const { S, raw, clamped } = this.dp;
    if (clamped[i][j]) return (this.c >= 54 ? `<s class="raw">${fmt(raw[i][j])}</s>` : '') + `<span>0</span>`;
    return `<span>${fmt(S[i][j])}</span>`;
  }

  /* ---- fase de preenchimento: passo k (0 = bordas; k ≥ 1 = célula k em ordem de leitura) ---- */
  renderFill(k, animate) {
    const dp = this.dp, { n, m, A, B, clamped, raw } = dp;
    const cur = k - 1;
    const ci = cur >= 0 ? Math.floor(cur / m) + 1 : -1, cj = cur >= 0 ? (cur % m) + 1 : -1;
    let arrows = '';
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const idx = i && j ? (i - 1) * m + (j - 1) : -1;
      const filled = idx <= cur;
      let cls = 'c';
      if (filled) cls += ' f';
      if (filled && clamped[i][j]) cls += ' clamp';
      if (idx === cur && cur >= 0) cls += ' cur' + (animate ? ' pop' : '');
      else if (cur >= 0 && i === ci - 1 && j === cj - 1) cls += ' nb-d';
      else if (cur >= 0 && i === ci - 1 && j === cj) cls += ' nb-u';
      else if (cur >= 0 && i === ci && j === cj - 1) cls += ' nb-l';
      if (animate && k === 0 && idx === -1) cls += ' pop';
      const e = this.cells[i][j];
      e.className = cls;
      e.innerHTML = filled ? this.cellHTML(i, j) : '';
      e.title = filled && clamped[i][j] ? `máx = ${fmt(raw[i][j])} → 0` : '';
      if (filled) arrows += this.arrows(i, j);
    }
    const match = cur >= 0 && A[ci - 1] === B[cj - 1];
    this.rowH.forEach((h, i) => { h.className = 'hd' + (cur >= 0 && i === ci ? (match ? ' hi match' : ' hi mis') : ''); });
    this.colH.forEach((h, j) => { h.className = 'hd' + (cur >= 0 && j === cj ? (match ? ' hi match' : ' hi mis') : ''); });
    this.svg.setAttribute('class', 'ov');
    this.svg.innerHTML = arrows;
    this.scoreEl.textContent = '';
    this.el.classList.remove('has-score');
    this.info.innerHTML = cur < 0 ? this.bordersHTML() : this.calcHTML(ci, cj);
  }
  bordersHTML() {
    if (this.mode === 'global') return `<div class="bord"><b>Bordas:</b> penalidade acumulada, −2 por letra pulada (0, −2, −4, …).</div>`;
    if (this.mode === 'semi') return `<div class="bord"><b>Bordas = 0:</b> começar com uma sequência “adiantada” não custa nada.</div>`;
    return `<div class="bord"><b>Bordas = 0</b> — e daqui em diante nenhum valor fica negativo.</div>`;
  }
  calcHTML(i, j) {
    const dp = this.dp, c = dp.cand[i][j], t = dp.ties[i][j], ch = dp.dir[i][j];
    const rows = [
      [DIR.D, `${fmt(dp.S[i - 1][j - 1])} ${c.s > 0 ? '+' : '−'} 1`, c.d],
      [DIR.U, `${fmt(dp.S[i - 1][j])} − 2`, c.u],
      [DIR.L, `${fmt(dp.S[i][j - 1])} − 2`, c.l],
    ];
    const nt = [DIR.D, DIR.U, DIR.L].filter((b) => t & b);
    let res;
    if (dp.mode === 'local' && c.best < 0) res = `máx = ${fmt(c.best)} → <b>0</b> <span class="badge clampb">negativo → 0</span>`;
    else if (dp.mode === 'local' && c.best === 0) res = `máx = <b>0</b> <span class="muted">· sem seta</span>`;
    else res = `máx = <b>${fmt(c.best)}</b> ${glyphHTML(ch)}` + (nt.length > 1 ? ` <span class="badge tieb">empate ${nt.map((b) => GLYPH[b]).join('')}</span>` : '');
    return `<div class="calc">${rows.map(([b, ex, v]) => {
      const cls = t & b ? (b === ch ? ' ch' : ' tie') : '';
      const tg = t & b ? (b === ch ? '◀ escolhida' : 'empate') : '';
      return `<div class="cr${cls}">${glyphHTML(b)}<span class="ex">${ex}</span><span class="eq">= ${fmt(v)}</span><span class="tg">${tg}</span></div>`;
    }).join('')}<div class="res">${res}</div></div>`;
  }

  /* ---- fase de traceback: passo t (0 = marca o início) ---- */
  renderTrace(t, animate, speed) {
    const dp = this.dp, { n, m, path, moves, clamped, mode } = dp;
    const r = Math.min(t, moves), done = t >= moves;
    const on = new Set(path.slice(0, r + 1).map(([i, j]) => i * 100 + j));
    const [si, sj] = dp.start;
    const scanning = t === 0 && mode !== 'global';
    const cand = (i, j) => mode === 'semi' ? i === n || j === m : true;
    const nC = mode === 'semi' ? n + m + 1 : (n + 1) * (m + 1);
    const anim = animate && !reduceMotion.matches;
    const scanMs = anim && scanning ? Math.min(750, speed * 0.6) : 0;
    let k = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      let cls = 'c f';
      if (clamped[i][j]) cls += ' clamp';
      if (on.has(i * 100 + j)) cls += ' path';
      else if (scanning && cand(i, j)) cls += anim ? ' cand' : ' region';
      const e = this.cells[i][j];
      e.className = cls;
      if (anim && scanning && cand(i, j)) e.style.setProperty('--dl', Math.round((k++ * scanMs) / nC) + 'ms');
      e.innerHTML = this.cellHTML(i, j);
    }
    this.rowH.forEach((h) => { h.className = 'hd'; });
    this.colH.forEach((h) => { h.className = 'hd'; });
    const c = this.c, x = (j) => this.cx(j).toFixed(1), y = (i) => this.cy(i).toFixed(1);
    let s = '';
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) s += this.arrows(i, j);
    if (r > 0) {
      const pts = path.slice(0, r + 1).map(([i, j]) => `${x(j)},${y(i)}`).join(' ');
      s += `<polyline class="trail-o" points="${pts}" stroke-width="${Math.max(7, c * 0.24).toFixed(1)}"/>`;
      s += `<polyline class="trail" points="${pts}" stroke-width="${Math.max(2.5, c * 0.075).toFixed(1)}"/>`;
    }
    const sw = Math.max(3, c * 0.085).toFixed(1), q = Math.max(8, c * 0.24);
    const delay = scanMs ? ` style="animation-delay:${scanMs + 150}ms"` : '';
    const px = this.cx(sj) + c * 0.38, py = this.cy(si) - c * 0.38;
    s += `<g class="${anim && t === 0 ? 'appear' : ''}"${delay}><circle class="ring" cx="${x(sj)}" cy="${y(si)}" r="${(c * 0.44).toFixed(1)}" stroke-width="${sw}"/>` +
      `<path class="tri" d="M${(px - q / 2).toFixed(1)},${(py - q / 2).toFixed(1)} L${(px + q / 2).toFixed(1)},${py.toFixed(1)} L${(px - q / 2).toFixed(1)},${(py + q / 2).toFixed(1)}z"/></g>`;
    if (done) {
      const [ei, ej] = dp.end, h = c * 0.46, bx = this.cx(ej) - c * 0.38, by = this.cy(ei) + c * 0.38;
      s += `<g class="${anim ? 'appear' : ''}"><rect class="sq" x="${(this.cx(ej) - h).toFixed(1)}" y="${(this.cy(ei) - h).toFixed(1)}" width="${(2 * h).toFixed(1)}" height="${(2 * h).toFixed(1)}" rx="3" stroke-width="${sw}"/>` +
        `<rect class="sqf" x="${(bx - q / 2).toFixed(1)}" y="${(by - q / 2).toFixed(1)}" width="${q.toFixed(1)}" height="${q.toFixed(1)}"/></g>`;
    }
    this.svg.setAttribute('class', 'ov dim');
    this.svg.innerHTML = s;
    this.scoreEl.textContent = 'score ' + fmtS(dp.score);
    this.el.classList.add('has-score');

    let status;
    if (t === 0) status = `<span class="s">▶ Início ${cellTxt(dp.start)}</span>: ${this.startReason()}`;
    else if (!done) {
      const [a, b] = [path[r - 1], path[r]];
      const d = a[0] - b[0] === 1 && a[1] - b[1] === 1 ? DIR.D : a[0] - b[0] === 1 ? DIR.U : DIR.L;
      status = `Movimento ${r} de ${moves}: ${glyphHTML(d)} ${DNAME[d]}`;
    } else status = `<span class="e">■ Fim ${cellTxt(dp.end)}</span>: ${moves === 0 && mode === 'local' ? 'nada positivo' : END_REASON[mode]}`;
    const w = alignmentWidth(dp.alignment, mode);
    const avail = Math.max(120, this.info.clientWidth || 300);
    const afz = clamp(Math.floor(avail / (w * 1.1 * 0.6)), 18, this.kind === 'single' ? 34 : this.compact ? 20 : 24);
    this.info.innerHTML = `<div class="tr-status">${status}</div>` +
      alignmentHTML(dp.alignment, mode, { r, done }).replace('class="aln"', `class="aln" style="--afz:${afz}px"`);
  }
  startReason() {
    const dp = this.dp, [i, j] = dp.start;
    if (dp.mode === 'global') return 'canto inferior direito';
    if (dp.mode === 'semi') {
      if (i === dp.n && j === dp.m) return 'canto: maior da última linha/coluna';
      return i === dp.n ? 'maior da última linha' : 'maior da última coluna';
    }
    return dp.score > 0 ? 'maior valor da matriz' : 'nenhum valor positivo';
  }
}

/* ===================================================================
   Player: 1 ou 3 painéis sincronizados + controles
   =================================================================== */
class Player {
  constructor(host, { modes, kind, A, B, tip }) {
    this.host = host; this.modes = modes; this.kind = kind;
    host.classList.add('player', kind);
    host.style.setProperty('--np', modes.length);
    host.innerHTML = `<div class="pl-head"><span class="phase"></span><span class="pl-status"></span><span class="legend"></span></div>
      <div class="panels"></div>
      <div class="pl-extra"></div>
      <div class="bar play-bar" role="group" aria-label="Controles da animação">
        <button class="btn" data-act="reset" title="Reiniciar a fase atual (R)">⏮&#xFE0E; Reiniciar</button>
        <button class="btn" data-act="prev" title="Passo anterior">◀&#xFE0E; Voltar</button>
        <button class="btn" data-act="next" title="Próximo passo">▶&#xFE0E; Próximo</button>
        <button class="btn primary" data-act="play" title="Play / pausa (Espaço)">⏯&#xFE0E; Play</button>
        <button class="btn" data-act="skip" title="Pular para o fim da fase">⏭&#xFE0E; Fim da fase</button>
        <label class="speed" title="Velocidade (+ / −)"><span>Velocidade</span><input type="range" min="300" max="2500" step="100" data-act="speed" aria-label="Velocidade"><output></output></label>
      </div>
      <div class="note" hidden><div class="note-txt"></div><button class="x" aria-label="Fechar nota" title="Fechar nota">×</button></div>`;
    this.head = { phase: $('.phase', host), status: $('.pl-status', host), legend: $('.legend', host) };
    this.panelsEl = $('.panels', host);
    this.extra = $('.pl-extra', host);
    this.noteEl = $('.note', host);
    this.panels = modes.map((md) => new Panel(md, kind));
    this.panels.forEach((p) => this.panelsEl.appendChild(p.el));
    if (tip) this.panels[0].side.appendChild(el('div', 'tip', tip));
    if (kind === 'single') this.panels[0].side.appendChild(this.noteEl);
    this.btn = {}; $$('[data-act]', host).forEach((b) => { this.btn[b.dataset.act] = b; });
    this.btn.reset.onclick = () => { this.pause(); this.resetPhase(); };
    this.btn.prev.onclick = () => { this.pause(); this.setStep(this.step - 1); };
    this.btn.next.onclick = () => { this.pause(); this.setStep(this.step + 1); };
    this.btn.play.onclick = () => this.toggle();
    this.btn.skip.onclick = () => { this.pause(); this.skip(); };
    this.btn.speed.oninput = () => setSpeed(2800 - +this.btn.speed.value);
    $('.x', this.noteEl).onclick = () => { this.noteEl.hidden = true; };
    this.step = 0; this.playing = false; this.timer = null; this.speedOverride = null;
    App.players.push(this);
    this.syncSpeed();
    this.setSequences(A, B);
  }
  setSequences(A, B) {
    this.pause();
    this.A = A; this.B = B; this.n = A.length; this.m = B.length;
    this.dps = this.modes.map((md) => computeDP(A, B, md));
    this.panels.forEach((p, k) => p.setDP(this.dps[k]));
    this.F = 1 + this.n * this.m;
    this.T = 1 + Math.max(...this.dps.map((d) => d.moves));
    this.buildNotes();
    this.layout();
    this.setStep(0, false);
  }
  get total() { return this.F + this.T; }
  layout() {
    const rows = this.n + 2, cols = this.m + 2;
    const maxC = this.kind === 'single' ? 84 : 72, minC = 26;
    const gapOf = (c) => (c >= 50 ? 4 : c >= 34 ? 3 : 2);
    const largest = (space, N) => { let c = Math.floor(space / N); while (c > minC && N * c + (N - 1) * gapOf(c) > space) c--; return c; };
    const fit = (p) => {
      const W = p.wrap.clientWidth - 6, H = p.wrap.clientHeight - 6;
      const byH = isMobile() ? Infinity : largest(H, rows);
      return clamp(Math.min(largest(W, cols), byH), minC, maxC);
    };
    if (this.kind === 'cmp') {
      this.host.classList.remove('compact'); this.panels.forEach((p) => { p.compact = false; });
      let c = Math.min(...this.panels.map(fit));
      if (c < 42 && !isMobile()) {
        this.host.classList.add('compact'); this.panels.forEach((p) => { p.compact = true; });
        c = Math.min(...this.panels.map(fit));
      }
      this.panels.forEach((p) => { p.setCell(c); p.el.classList.toggle('tight', p.el.clientWidth < 480); });
    } else this.panels.forEach((p) => p.setCell(fit(p)));
    this.host.style.setProperty('--play-h', $('.play-bar', this.host).offsetHeight + 'px');
    if (this.kind === 'cmp') this.host.style.setProperty('--seq-h', this.extra.offsetHeight + 'px');
  }
  setStep(k, animate = true) {
    k = clamp(k, 0, this.total - 1);
    this.step = k;
    const anim = animate && !reduceMotion.matches;
    if (k < this.F) this.panels.forEach((p) => p.renderFill(k, anim));
    else this.panels.forEach((p) => p.renderTrace(k - this.F, anim, this.speedOverride || App.speed));
    this.renderHead();
    this.renderNote();
    this.btn.prev.disabled = k === 0;
    this.btn.next.disabled = k === this.total - 1;
    if (this.onStep) this.onStep(k);
  }
  rerender() { this.setStep(this.step, false); }
  renderHead() {
    const k = this.step, { F, T, A, B } = this;
    const tr = k >= F;
    this.head.phase.textContent = tr ? 'Traceback' : 'Preenchimento';
    this.head.phase.classList.toggle('tr', tr);
    let s = `passo ${k + 1}/${this.total}`;
    if (!tr && k === 0) s += ' · bordas de uma vez';
    else if (!tr) {
      const i = Math.floor((k - 1) / this.m) + 1, j = ((k - 1) % this.m) + 1, a = A[i - 1], b = B[j - 1];
      s += ` · célula (${i},${j}) · <b class="lt">${a}</b>×<b class="lt">${b}</b> ` +
        (a === b ? '<span class="tag match">✓ match +1</span>' : '<span class="tag mis">✗ mismatch −1</span>');
    } else s += k === F ? ' · onde começa?' : ` · volta ${k - F}/${T - 1}`;
    this.head.status.innerHTML = s;
    this.head.legend.innerHTML = tr
      ? `<span><span class="s">▶</span> início</span><span><span class="e">■</span> fim</span><span>trilha = caminho de volta</span>`
      : `<span>${glyphHTML(DIR.D)}diag.</span><span>${glyphHTML(DIR.U)}cima</span><span>${glyphHTML(DIR.L)}esq.</span><span><i class="thin"></i>empate</span><span><i class="thick"></i>escolhida</span>` +
        (this.modes.includes('local') ? `<span><i class="hatch"></i>negativo→0</span>` : '');
  }
  buildNotes() {
    const notes = {}, add = (k, html) => { notes[k] = notes[k] ? notes[k] + ' ' + html : html; };
    const { n, m } = this;
    for (let idx = 0; idx < n * m; idx++) {
      const i = Math.floor(idx / m) + 1, j = (idx % m) + 1;
      const who = this.dps.filter((d) => { const t = d.ties[i][j]; return t & (t - 1); });
      if (who.length) {
        const names = this.modes.length > 1 ? ` (${who.map((d) => MODE_INFO[d.mode].name).join(', ')})` : '';
        add(idx + 1, `<b>Primeiro empate</b> em (${i},${j})${names}: setas finas = direções empatadas; a grossa segue a prioridade <b>diagonal &gt; cima &gt; esquerda</b>.`);
        break;
      }
    }
    const loc = this.dps.find((d) => d.mode === 'local');
    if (loc) {
      for (let idx = 0; idx < n * m; idx++) {
        const i = Math.floor(idx / m) + 1, j = (idx % m) + 1;
        if (loc.clamped[i][j]) {
          add(idx + 1, `<b>Primeira célula grampeada</b> do Local, em (${i},${j}): máx = ${fmt(loc.raw[i][j])}, mas negativo não entra → vira <b>0</b> (hachurado, sem seta).`);
          break;
        }
      }
    }
    add(this.F - 1, this.modes.length > 1
      ? '<b>Preenchimento completo.</b> Agora o traceback: cada algoritmo começa num lugar diferente e volta pelas setas grossas.'
      : '<b>Preenchimento completo.</b> Agora o traceback: começar no lugar certo e voltar seguindo as setas grossas.');
    const g = this.dps.find((d) => d.mode === 'global' && d.alt);
    if (g) {
      const a = g.alt;
      add(this.F + this.T - 1, `<b>Empate no caminho</b> em ${cellTxt(a.cell)}: seguindo ${glyphHTML(a.dir)} em vez de ${glyphHTML(g.dir[a.cell[0]][a.cell[1]])}, o Global daria <span class="mono">${a.alignment.textA} / ${a.alignment.textB}</span> (mesmo score ${fmtS(g.score)}). Desenhamos só um.`);
    }
    this.notes = notes;
  }
  renderNote() {
    const html = this.notes[this.step];
    this.noteEl.hidden = !html;
    if (html) $('.note-txt', this.noteEl).innerHTML = html;
  }
  resetPhase() { this.setStep(this.step < this.F ? 0 : this.F); }
  skip() {
    if (this.step < this.F - 1) this.setStep(this.F - 1);
    else if (this.step < this.total - 1) this.setStep(this.total - 1);
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  play(speed) {
    if (this.step >= this.total - 1) this.setStep(0);
    this.speedOverride = speed || null; // play automático usa velocidade própria; mexer no slider volta ao normal
    this.playing = true;
    this.btn.play.innerHTML = '⏸&#xFE0E; Pausa';
    this.tick();
  }
  tick() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      this.setStep(this.step + 1);
      if (this.step >= this.total - 1) this.pause(); else this.tick();
    }, this.speedOverride || App.speed);
  }
  pause() {
    this.playing = false; clearTimeout(this.timer);
    if (this.btn.play) this.btn.play.innerHTML = '⏯&#xFE0E; Play';
  }
  syncSpeed() {
    this.btn.speed.value = 2800 - App.speed;
    $('output', this.btn.speed.parentNode).textContent = (App.speed / 1000).toFixed(1).replace('.', ',') + ' s';
  }
}
function setSpeed(ms) {
  App.speed = clamp(Math.round(ms / 100) * 100, 300, 2500);
  App.players.forEach((p) => { p.speedOverride = null; p.syncSpeed(); });
}

/* ===================================================================
   Conteúdo das seções de algoritmo (2–4)
   =================================================================== */
const ICONS = {
  global: `<svg class="icon" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#E6EDF5"/><path d="M22 36h56M22 64h56" stroke="#1B4F8A" stroke-width="7" stroke-linecap="round"/><path d="M30 40v20M42 40v20M54 40v20M66 40v20" stroke="#1B4F8A" stroke-width="3"/></svg>`,
  semi: `<svg class="icon" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#E1F1EF"/><path d="M14 38h50M40 62h46" stroke="#0F766E" stroke-width="7" stroke-linecap="round"/><path d="M44 42v16M52 42v16M60 42v16" stroke="#0F766E" stroke-width="3"/><path d="M14 38h22M66 62h20" stroke="#9BC7C2" stroke-width="7" stroke-linecap="round"/></svg>`,
  local: `<svg class="icon" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#F3E4EB"/><circle cx="44" cy="44" r="20" fill="#fff" stroke="#8A1B4F" stroke-width="6"/><path d="M58 58l20 20" stroke="#8A1B4F" stroke-width="8" stroke-linecap="round"/><path d="M34 40h20M34 48h20" stroke="#8A1B4F" stroke-width="4" stroke-linecap="round"/></svg>`,
};
// esquemas da "forma" do alinhamento (barras)
function shapeSVG(mode) {
  const col = { global: '#1B4F8A', semi: '#0F766E', local: '#8A1B4F' }[mode];
  const bar = (x, y, w, c, lbl) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="${c}"/>` + (lbl ? `<text x="${x - 14}" y="${y + 22}" text-anchor="end" font-size="22" font-weight="700" fill="#1A1A1A" font-family="system-ui,Segoe UI,Arial">${lbl}</text>` : '');
  const links = (x0, x1) => { let s = ''; for (let x = x0 + 12; x < x1; x += 22) s += `<line x1="${x}" y1="62" x2="${x}" y2="88" stroke="${col}" stroke-width="3"/>`; return s; };
  const grey = '#C9C9C4';
  let s = '';
  if (mode === 'global') s = bar(40, 30, 440, col, 'A') + bar(40, 90, 440, col, 'B') + links(40, 480);
  else if (mode === 'semi') {
    const lbl = (y, t) => `<text x="40" y="${y}" font-size="22" font-weight="700" fill="#3F3F3F" font-family="system-ui,Segoe UI,Arial">${t}</text>`;
    const lk = (x0, x1, y) => { let r = ''; for (let x = x0 + 12; x < x1; x += 22) r += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 26}" stroke="${col}" stroke-width="3"/>`; return r; };
    s = lbl(22, 'sobreposição') + bar(40, 34, 300, grey, 'A') + bar(180, 34, 160, col) + bar(180, 94, 300, grey, 'B') + bar(180, 94, 160, col) + lk(180, 340, 66) +
      lbl(170, 'uma dentro da outra') + bar(40, 182, 440, grey, 'A') + bar(170, 182, 150, col) + bar(170, 242, 150, col, 'B') + lk(170, 320, 214);
    return `<svg viewBox="0 0 520 280" role="img" aria-label="Esquema da forma do alinhamento">${s}</svg>`;
  }
  else s = bar(40, 30, 440, grey, 'A') + bar(250, 30, 130, col) + bar(40, 90, 440, grey, 'B') + bar(150, 90, 130, col) + [0, 1, 2, 3, 4].map((k) => `<line x1="${262 + k * 26}" y1="62" x2="${162 + k * 26}" y2="88" stroke="${col}" stroke-width="3"/>`).join('');
  return `<svg viewBox="0 0 520 132" role="img" aria-label="Esquema da forma do alinhamento">${s}</svg>`;
}
function schematic(mode) {
  const R = 5, C = 6;
  let s = `<div class="schem" style="grid-template-columns:repeat(${C},auto)">`;
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const border = i === 0 || j === 0;
    let cls = border ? 'bd' : '', txt = '';
    if (border) txt = mode === 'global' ? fmt(-2 * (i + j)) : '0';
    if (mode === 'global') {
      if (i === R - 1 && j === C - 1) { cls += ' st'; txt = '<span class="ico s">▶</span>'; }
      if (i === 0 && j === 0) cls += ' en';
    } else if (mode === 'semi') {
      if (i === R - 1 || j === C - 1) cls += (i === R - 1 && j === 2) ? ' st' : ' st2';
      if (i === R - 1 && j === 2) txt = '<span class="ico s">▶</span>';
      if (border) cls += ' en';
    } else {
      if (!border) cls += ' st2';
      if (i === 3 && j === 4) { cls += ' st'; txt = '<span class="ico s">▶</span>'; }
      if (i === 1 && j === 2) { cls += ' en'; txt = '0'; }
      if (border) cls += ' en';
    }
    s += `<div class="${cls}">${txt}</div>`;
  }
  s += '</div>';
  const leg = {
    global: ['▶ começa no canto (n, m)', '■ termina em (0, 0)'],
    semi: ['▶ começa no maior da última linha ou coluna (verde)', '■ termina ao tocar a linha 0 ou a coluna 0'],
    local: ['▶ começa no maior valor de toda a matriz', '■ termina no primeiro 0 (borda ou interior)'],
  }[mode];
  return s + `<div class="sch-legend"><span class="s">${leg[0]}</span><span class="e">${leg[1]}</span></div>`;
}
const ALGOS = [
  {
    mode: 'global', num: 2, name: 'Global', full: 'Global · Needleman–Wunsch',
    use: 'Genes ortólogos entre espécies',
    usetxt: ['Duas sequências inteiras, de tamanho parecido e mesma origem evolutiva — por exemplo, o mesmo gene em humanos e em camundongos.',
      'Queremos comparar tudo, de ponta a ponta: cada letra de A e de B entra no alinhamento, inclusive as das pontas.'],
    q: 'as duas sequências, inteiras, são parecidas?',
    shapecap: 'A e B alinhadas do começo ao fim.',
    rules: [
      ['Bordas: −2·i e −2·j', 'Começar o alinhamento fora do canto significa pular letras — e cada letra pulada é um gap de −2.'],
      ['Início: canto inferior direito (n, m)', 'É ali que as duas sequências terminaram por inteiro.'],
      ['Fim: chegar em (0, 0)', 'Só acaba quando as duas foram consumidas desde a primeira letra. Nas bordas há setas: seguir por elas custa gap.'],
    ],
    A: 'ACT', B: 'AGT',
    tip: '<b>Repare nos empates</b> em (2,3) e (3,2): duas setas finas, e a grossa segue a prioridade diagonal &gt; cima &gt; esquerda. Resultado: <span class="mono">ACT / AGT</span>, score +1.',
  },
  {
    mode: 'semi', num: 3, name: 'Semi-Global', full: 'Semi-Global · pontas livres',
    use: 'Montagem de reads, primers e mapeamento',
    usetxt: ['Uma sequência pode se encaixar na outra de dois jeitos. Sobrepondo as pontas: na montagem de genomas, o fim de um read encaixa no começo do próximo.',
      'Ou uma inteira dentro da outra: um primer sobre o gene, ou um read sobre a sequência de referência. Nos dois casos, o que sobra nas pontas não deve ser penalizado.'],
    q: 'uma se encaixa na outra, sem pagar pelas pontas?',
    shapecap: 'Só a parte encaixada conta; as pontas soltas (cinza) são grátis.',
    rules: [
      ['Bordas: linha 0 e coluna 0 valem 0', 'Começar com uma sequência “adiantada” não custa nada: pontas soltas no início são grátis.'],
      ['Início: maior valor da última linha ou coluna', 'Uma das sequências precisa ter terminado, mas a outra pode sobrar livre no final. Empate: canto (n,m), depois última linha, depois última coluna.'],
      ['Fim: chegar na linha 0 ou na coluna 0', 'O que sobra no começo de uma delas também é grátis — não precisa voltar até (0,0).'],
    ],
    A: 'ACGT', B: 'CGTT',
    tip: '<b>Sobreposição:</b> o fim de A (“CGT”) encaixa no começo de B (“CGT”). O traceback começa em (4,3), na última linha, e para em (1,0), na borda: <span class="mono">ACGT- / -CGTT</span>, score +3.',
  },
  {
    mode: 'local', num: 4, name: 'Local', full: 'Local · Smith–Waterman',
    use: 'Domínios e motivos em comum (BLAST)',
    usetxt: ['Genes ou proteínas diferentes podem compartilhar só um trecho — um domínio que se liga ao DNA, um motivo regulador — e ser diferentes no resto.',
      'O alinhamento local procura o melhor trecho em comum e ignora o resto. É a mesma ideia por trás do BLAST, que busca sequências parecidas em bancos gigantes.'],
    q: 'qual o trecho mais parecido entre as duas?',
    shapecap: 'Só o melhor trecho em comum; o resto (cinza) fica de fora.',
    rules: [
      ['Bordas: linha 0 e coluna 0 valem 0', 'Como no Semi-Global: o trecho pode começar em qualquer posição de A e de B.'],
      ['Início: maior valor de toda a matriz', 'O melhor trecho pode terminar em qualquer lugar. Empate: a primeira ocorrência, lendo linha por linha.'],
      ['Fim: encontrar um 0', 'Antes do 0 só havia prejuízo — ali o trecho deixa de valer a pena.'],
    ],
    A: 'GACT', B: 'ACTG',
    tip: '<b>Muitas células grampeadas</b> (hachuradas): o máximo daria negativo e vira 0. O traceback começa no maior valor, 3 em (4,3), e para no primeiro 0: trecho <span class="mono">ACT / ACT</span>, score +3.',
  },
];
function algoSectionsHTML() {
  return ALGOS.map((a) => {
    const kick = `<p class="kicker">${a.num} · ${a.full}</p>`;
    const clampBox = a.mode === 'local' ? `<div class="clampbox"><h3>Nunca fica negativo</h3><p><span class="mono">S = máx(0, diagonal, cima, esquerda)</span>. Se todos os candidatos dão negativo, a célula é <b>grampeada em 0</b> — é como dizer “recomece daqui”. Ex.: máx(−1, −3, −3) = −1 → <b>0</b>.</p></div>` : '';
    return `
<section class="stop" data-sec="${a.mode}" aria-label="${a.name}: quando se usa">
  ${kick}<h2 class="t">Quando se usa na biologia</h2>
  <div class="body" style="align-items:center">
    <div class="col" style="flex:1.1"><div class="card use">${ICONS[a.mode]}<div><h3>${a.use}</h3>${a.usetxt.map((p) => `<p>${p}</p>`).join('')}</div></div>
      <p class="q">${a.q}</p></div>
    <div class="col" style="justify-content:center"><div class="card shape"><p style="font-weight:700;margin-bottom:8px">Forma do alinhamento</p>${shapeSVG(a.mode)}<p class="shape-cap">${a.shapecap}</p></div></div>
  </div>
</section>
<section class="stop" data-sec="${a.mode}" aria-label="${a.name}: a regra">
  ${kick}<h2 class="t">A regra: bordas e traceback</h2>
  <div class="body">
    <div class="col" style="flex:none;justify-content:center">${schematic(a.mode)}</div>
    <div class="col rules" style="justify-content:center">
      ${a.rules.map((r, k) => `<div class="rule"><span class="rn">${k + 1}</span><div><h3>${r[0]}</h3><p>${r[1]}</p></div></div>`).join('')}
      ${clampBox}
    </div>
  </div>
</section>
<section class="stop" data-sec="${a.mode}" data-kind="illus" aria-label="${a.name}: matriz ilustrativa">
  ${kick}<h2 class="t">Matriz ilustrativa: <span class="mono">${a.A}</span> × <span class="mono">${a.B}</span></h2>
  <div class="player-host" data-illus="${a.mode}"></div>
</section>`;
  }).join('');
}

/* ===================================================================
   Resultados + tabela comparativa
   =================================================================== */
function renderResults(dps, A, B) {
  $('#res-title').innerHTML = `Resultados: <span class="mono">${A}</span> × <span class="mono">${B}</span>`;
  const [g, s, l] = dps;
  const interp = {
    global: (d) => {
      let t = 'Alinha tudo, de ponta a ponta: toda letra de A e de B entra na conta, inclusive as das pontas.';
      if (d.alt) t += ` Empate no caminho em ${cellTxt(d.alt.cell)}: <span class="mono">${d.alt.alignment.textA} / ${d.alt.alignment.textB}</span> dá o mesmo score.`;
      return t;
    },
    semi: (d) => d.alignment.cols.length
      ? `Melhor encaixe: <span class="mono">${d.alignment.coreA}</span> sobre <span class="mono">${d.alignment.coreB}</span>. As pontas soltas, em cinza, saem de graça.`
      : 'Nenhuma sobreposição compensa: tudo fica nas pontas, de graça.',
    local: (d) => d.score > 0
      ? `Melhor trecho em comum: <span class="mono">${d.alignment.coreA}</span> / <span class="mono">${d.alignment.coreB}</span>. O resto, em cinza, é ignorado.`
      : 'Nenhum trecho tem score positivo: não há nada parecido o bastante.',
  };
  const plural = (k, w, p) => `${k} ${k === 1 ? w : p}`;
  const card = (d) => {
    const al = d.alignment;
    return `<div class="rc m-${d.mode}"><h3>${MODE_INFO[d.mode].name}<span class="sc">score ${fmtS(d.score)}</span></h3>` +
      alignmentHTML(al, d.mode, null) +
      `<div class="facts"><span>${plural(al.matches, 'match', 'matches')} · ${plural(al.mismatches, 'mismatch', 'mismatches')} · ${plural(al.gaps, 'gap', 'gaps')}</span>` +
      `<span><span class="s">▶ ${cellTxt(d.start)}</span> → <span class="e">■ ${cellTxt(d.end)}</span> · ${plural(d.moves, 'movimento', 'movimentos')}</span></div>` +
      `<p class="interp">${interp[d.mode](d)}</p></div>`;
  };
  const tb = (d) => `▶ ${cellTxt(d.start)} → ■ ${cellTxt(d.end)} · ${d.moves} mov.`;
  const ROWS = [
    ['Pergunta', 'As duas, inteiras, são parecidas?', 'Uma se encaixa na outra, sem pagar pelas pontas?', 'Qual o trecho mais parecido?'],
    ['Bordas', '−2·i e −2·j', '0', '0'],
    ['Negativos', 'permitidos', 'permitidos', 'viram 0'],
    ['Início do traceback', 'canto (n, m)', 'maior da última linha/coluna', 'maior de toda a matriz'],
    ['Fim do traceback', 'chegar em (0, 0)', 'chegar na linha 0 ou coluna 0', 'encontrar um 0'],
    ['Gaps nas pontas', 'custam −2 cada', 'grátis', 'ficam de fora'],
    ['Neste exemplo', tb(g), tb(s), tb(l), 'dyn'],
    ['Uso típico', 'genes ortólogos', 'montagem de reads, primers, mapeamento', 'domínios, motivos, BLAST'],
  ];
  const names = ['Global', 'Semi-Global', 'Local'];
  $('#res-cards').innerHTML = card(g) + card(s) + card(l);
  fitResultAlignments();
  $('#tab-title').innerHTML = `Tabela comparativa: <span class="mono">${A}</span> × <span class="mono">${B}</span>`;
  $('#res-grid').innerHTML = `<div class="rt hd"><div></div>${MODES.map((md) => `<div class="m-${md}">${MODE_INFO[md].name}</div>`).join('')}</div>` +
    ROWS.map((r) => `<div class="rt${r[4] ? ' ' + r[4] : ''}"><div>${r[0]}</div>${[1, 2, 3].map((k) => `<div class="v m-${['', 'global', 'semi', 'local'][k]}" data-m="${names[k - 1]}">${r[k]}</div>`).join('')}</div>`).join('');
}

// fonte dos alinhamentos nos cartões: a maior que cabe na largura do cartão
function fitResultAlignments() {
  $$('#res-cards .rc').forEach((rc) => {
    const aln = $('.aln', rc); if (!aln) return;
    const cols = $('.ar', aln).children.length;
    const avail = rc.clientWidth - 2 * parseFloat(getComputedStyle(rc).paddingLeft);
    aln.style.setProperty('--afz', clamp(Math.floor(avail / (cols * 0.68)), 20, 48) + 'px');
  });
}

/* ===================================================================
   Navegação por paradas
   =================================================================== */
const Nav = {
  blocks: [], cur: 0, lock: false, lockTimer: null,
  init() {
    this.deck = $('#deck');
    this.blocks = $$('.stop').map((e) => ({ el: e, sec: e.dataset.sec, kind: e.dataset.kind || 'plain', player: e._player || null }));
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const b = this.blocks.findIndex((x) => x.el === en.target);
        if (this.lock) { if (b === this.target && Math.abs(this.deck.scrollTop - en.target.offsetTop) < 2) this.unlockSoon(); continue; }
        if (b !== this.cur) { this.leave(); this.cur = b; this.enter(); this.update(); }
      }
    }, { root: this.deck, rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    this.blocks.forEach((b) => io.observe(b.el));
    this.deck.addEventListener('scrollend', () => { if (this.lock) this.unlockSoon(0); });
    this.update();
  },
  unlockSoon(ms = 120) { clearTimeout(this.lockTimer); this.lockTimer = setTimeout(() => { this.lock = false; }, ms); },
  count(b) { const bl = this.blocks[b]; return bl.kind === 'cmp' ? bl.player.total : 1; },
  offset(b) { let s = 0; for (let k = 0; k < b; k++) s += this.count(k); return s; },
  total() { return this.offset(this.blocks.length); },
  index() { const bl = this.blocks[this.cur]; return this.offset(this.cur) + (bl.kind === 'cmp' ? bl.player.step : 0); },
  leave() { const p = this.blocks[this.cur] && this.blocks[this.cur].player; if (p) p.pause(); },
  // ao chegar numa matriz ilustrativa: recomeça do passo 0 e toca sozinha, rápido
  enter() {
    const bl = this.blocks[this.cur];
    if (bl.kind === 'illus') { bl.player.setStep(0, false); bl.player.play(CONFIG.AUTOPLAY_MS); }
  },
  next() {
    const bl = this.blocks[this.cur], p = bl.player;
    if (bl.kind === 'cmp' && p.step < p.total - 1) { p.pause(); p.setStep(p.step + 1); return; }
    if (this.cur < this.blocks.length - 1) this.goBlock(this.cur + 1, 'start');
  },
  prev() {
    const bl = this.blocks[this.cur], p = bl.player;
    if (bl.kind === 'cmp' && p.step > 0) { p.pause(); p.setStep(p.step - 1); return; }
    if (this.cur > 0) this.goBlock(this.cur - 1, 'end');
  },
  goBlock(b, where) {
    this.leave();
    const far = Math.abs(b - this.cur) > 1; // saltos longos (menu) são instantâneos
    this.cur = b;
    const bl = this.blocks[b];
    if (bl.kind === 'cmp') bl.player.setStep(where === 'end' ? bl.player.total - 1 : 0, false);
    this.enter();
    this.lock = true; this.target = b; this.unlockSoon(1500);
    this.deck.scrollTo({ top: bl.el.offsetTop, behavior: reduceMotion.matches || far ? 'auto' : 'smooth' });
    this.update();
  },
  goSection(sec) { const b = this.blocks.findIndex((x) => x.sec === sec); if (b >= 0) this.goBlock(b, 'start'); },
  update() {
    const sec = this.blocks[this.cur].sec;
    $$('.sec-list a').forEach((a) => a.setAttribute('aria-current', a.dataset.go === sec ? 'true' : 'false'));
    const ind = $('#indicator');
    ind.querySelector('b').textContent = this.index() + 1;
    ind.querySelector('span:last-child').textContent = this.total();
  },
  current() { return this.blocks[this.cur]; },
};

/* ===================================================================
   Montagem
   =================================================================== */
function randomSeq(k) {
  const buf = new Uint8Array(k);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 256); });
  return Array.from(buf, (b) => 'ACGT'[b & 3]).join('');
}
const cleanSeq = (s) => s.toUpperCase().replace(/[^ACGT]/g, '').slice(0, CONFIG.MAX_LEN);

function initComparator() {
  const host = $('#cmp-host');
  const cmp = new Player(host, { modes: MODES, kind: 'cmp', A: CONFIG.DEFAULT_A, B: CONFIG.DEFAULT_B });
  host.closest('.stop')._player = cmp;
  $('.pl-head', host).insertAdjacentHTML('afterbegin', '<span class="kicker" style="margin-right:4px">5 · Comparador</span>');
  cmp.extra.className = 'bar seq-bar';
  cmp.extra.setAttribute('role', 'group'); cmp.extra.setAttribute('aria-label', 'Sequências');
  cmp.extra.innerHTML = `
    <label class="seq">A <input id="inA" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Sequência A (3 a 10 letras A, C, G, T)"></label>
    <label class="seq">B <input id="inB" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Sequência B (3 a 10 letras A, C, G, T)"></label>
    <button class="btn" id="btn-apply">Aplicar</button>
    <button class="btn" id="btn-rand" title="Sorteia A e B no tamanho atual">🎲 Randomizar</button>
    <label class="size" title="Tamanho de A e B (gera sequências novas)"><span>Tamanho</span><span class="size-track"><span class="proj-band" hidden></span><input type="range" id="size" min="${CONFIG.MIN_LEN}" max="${CONFIG.MAX_LEN}" step="1" aria-label="Tamanho das sequências"></span><output id="size-out"></output></label>
    <button class="btn" id="btn-restore" title="Volta para ${CONFIG.DEFAULT_A} / ${CONFIG.DEFAULT_B}">↺ Restaurar exemplo</button>
    <span class="seq-err" id="seq-err" role="alert"></span>`;
  const inA = $('#inA'), inB = $('#inB'), size = $('#size'), out = $('#size-out'), err = $('#seq-err');
  const band = $('.proj-band', host);
  if (CONFIG.PROJECTOR_RANGE) {
    const [lo, hi] = CONFIG.PROJECTOR_RANGE, span = CONFIG.MAX_LEN - CONFIG.MIN_LEN, th = 16;
    band.hidden = false;
    band.style.left = `calc(${th / 2}px + (100% - ${th}px) * ${(lo - 0.4 - CONFIG.MIN_LEN) / span})`;
    band.style.width = `calc((100% - ${th}px) * ${(hi - lo + 0.8) / span})`;
    band.parentNode.parentNode.title = `Tamanho de A e B (gera sequências novas) · faixa destacada ${lo}–${hi}: confortável para projetor`;
  }
  const use = (A, B) => {
    err.textContent = '';
    inA.value = A; inB.value = B;
    if (A.length === B.length) { size.value = A.length; }
    out.textContent = size.value;
    cmp.setSequences(A, B);
    renderResults(cmp.dps, A, B);
    Nav.update && Nav.blocks.length && Nav.update();
  };
  [inA, inB].forEach((inp) => inp.addEventListener('input', () => {
    const p = inp.selectionStart, v = cleanSeq(inp.value), d = inp.value.length - v.length;
    if (v !== inp.value) { inp.value = v; inp.setSelectionRange(Math.max(0, p - d), Math.max(0, p - d)); }
  }));
  const apply = () => {
    const A = cleanSeq(inA.value), B = cleanSeq(inB.value);
    if (A.length < CONFIG.MIN_LEN || B.length < CONFIG.MIN_LEN) { err.textContent = `Cada sequência precisa ter de ${CONFIG.MIN_LEN} a ${CONFIG.MAX_LEN} letras (A, C, G, T).`; return; }
    use(A, B);
  };
  $('#btn-apply').onclick = apply;
  cmp.apply = apply;
  $('#btn-rand').onclick = () => { const k = +size.value; use(randomSeq(k), randomSeq(k)); };
  size.oninput = () => { out.textContent = size.value; };
  size.onchange = () => { const k = clamp(+size.value, CONFIG.MIN_LEN, CONFIG.MAX_LEN); use(randomSeq(k), randomSeq(k)); };
  $('#btn-restore').onclick = () => use(CONFIG.DEFAULT_A, CONFIG.DEFAULT_B);
  size.value = CONFIG.DEFAULT_A.length;
  use(CONFIG.DEFAULT_A, CONFIG.DEFAULT_B);
  cmp.onStep = () => { if (Nav.blocks.length) Nav.update(); };
  return cmp;
}

function init() {
  // seções 2–4
  document.querySelector('#cmp-stop').insertAdjacentHTML('beforebegin', algoSectionsHTML());
  $$('[data-illus]').forEach((h) => {
    const a = ALGOS.find((x) => x.mode === h.dataset.illus);
    const p = new Player(h, { modes: [a.mode], kind: 'single', A: a.A, B: a.B, tip: a.tip });
    h.closest('.stop')._player = p;
  });
  // início: sequências lado a lado e matriz mínima
  const demo = { cols: [], pre: [], suf: [] };
  [['G', 'G'], ['A', 'A'], ['T', 'C'], ['T', 'T'], ['A', '-'], ['C', 'C'], ['A', 'A']].forEach(([a, b]) =>
    demo.cols.push({ a, b, type: a === '-' || b === '-' ? 'gap' : a === b ? 'match' : 'mismatch' }));
  demo.textA = 'GATTACA'; demo.textB = 'GACT-CA';
  $('#strands').innerHTML = alignmentHTML(demo, 'global', null).replace('class="aln"', 'class="aln strands"');
  $('#cover-aln').innerHTML = alignmentHTML(computeDP(CONFIG.DEFAULT_A, CONFIG.DEFAULT_B, 'global').alignment, 'global', null).replace('class="aln"', 'class="aln strands"');
  const mini = new Panel('global', 'mini');
  $('#mini').appendChild(mini.el);
  mini.setDP(computeDP('GA', 'GT', 'global'));
  mini.setCell(Math.round(clamp(window.innerHeight * 0.085, 48, 88)));
  mini.renderFill(4, false);
  App.mini = mini;
  // comparador, resultados, fechamento
  App.cmp = initComparator();
  const link = $('#site-link');
  link.href = CONFIG.SITE_URL; link.textContent = CONFIG.SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  try { $('#qr').innerHTML = qrSVG(CONFIG.SITE_URL); } catch (e) { $('#qr').hidden = true; }
  $('#goto-cmp').onclick = () => Nav.goSection('comparador');

  Nav.init();
  bindUI();
  relayout();
}

function relayout() {
  App.players.forEach((p) => { p.layout(); p.rerender(); });
  fitResultAlignments();
  if (App.mini) {
    App.mini.setCell(Math.round(clamp(window.innerHeight * 0.085, 48, 88)));
    App.mini.renderFill(4, false);
  }
  // mantém a parada atual alinhada depois de redimensionar
  const bl = Nav.current();
  if (bl && !isMobile()) Nav.deck.scrollTop = bl.el.offsetTop;
}

function toggleMenu() {
  if (isMobile()) { $('#nav').classList.toggle('open'); return; }
  document.body.classList.toggle('rail');
  setTimeout(relayout, reduceMotion.matches ? 0 : 320);
}
function toggleNotes() {
  App.notes = !App.notes;
  document.body.classList.toggle('no-notes', !App.notes);
  $('#btn-notes').setAttribute('aria-pressed', String(App.notes));
}
function toggleFull() {
  if (!document.fullscreenEnabled) return;
  const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  if (p && p.catch) p.catch(() => {});
}

function bindUI() {
  $$('.sec-list a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); $('#nav').classList.remove('open'); Nav.goSection(a.dataset.go);
  }));
  $('#btn-menu').onclick = toggleMenu;
  $('#btn-notes').onclick = toggleNotes;
  $('#btn-full').onclick = toggleFull;
  // clique com mouse não deixa foco preso em botões/sliders (as teclas de atalho continuam valendo)
  document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });
  document.addEventListener('pointerup', (e) => { if (e.target.matches && e.target.matches('input[type=range]')) setTimeout(() => e.target.blur(), 0); });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.matches && t.matches('input[type=text]')) {
      if (e.key === 'Enter') { e.preventDefault(); App.cmp.apply(); }
      else if (e.key === 'Escape') t.blur();
      return;
    }
    const kbdFocus = t.matches && t.matches(':focus-visible') && t.matches('button, a, input');
    const range = t.matches && t.matches('input[type=range]') && kbdFocus;
    const cur = Nav.current(), p = cur.player;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': if (range) return; e.preventDefault(); Nav.next(); break;
      case 'ArrowLeft': case 'PageUp': if (range) return; e.preventDefault(); Nav.prev(); break;
      case 'Enter': if (kbdFocus) return; e.preventDefault(); Nav.next(); break;
      case ' ': case 'Spacebar': if (kbdFocus && !range) return; e.preventDefault(); if (p) p.toggle(); break;
      case '+': case '=': e.preventDefault(); setSpeed(App.speed - 200); break;
      case '-': case '_': e.preventDefault(); setSpeed(App.speed + 200); break;
      case 'r': case 'R': if (p) { p.pause(); p.resetPhase(); } break;
      case 'f': case 'F': toggleFull(); break;
      case 'm': case 'M': toggleMenu(); break;
      case 'n': case 'N': toggleNotes(); break;
      case 'ArrowDown': case 'ArrowUp': case 'Home': case 'End':
        if (!isMobile()) e.preventDefault(); // a rolagem por teclado passa pelas paradas via ← →
        if (e.key === 'ArrowDown') Nav.goBlock(Math.min(Nav.cur + 1, Nav.blocks.length - 1), 'start');
        if (e.key === 'ArrowUp') Nav.goBlock(Math.max(Nav.cur - 1, 0), 'start');
        if (e.key === 'Home') Nav.goBlock(0, 'start');
        if (e.key === 'End') Nav.goBlock(Nav.blocks.length - 1, 'start');
        break;
      default: return;
    }
  });

  // deslizar para os lados (celular) troca de parada
  let sx = 0, sy = 0, sOk = false;
  document.addEventListener('touchstart', (e) => {
    const tt = e.touches[0]; sx = tt.clientX; sy = tt.clientY;
    sOk = !e.target.closest('.mx-wrap, input, .aln');
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!sOk) return;
    const tt = e.changedTouches[0], dx = tt.clientX - sx, dy = tt.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) { dx < 0 ? Nav.next() : Nav.prev(); }
  }, { passive: true });

  let rz = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); });
}

init();
