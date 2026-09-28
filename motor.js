/* motor.js — motor de programação dinâmica (global / semi-global / local)
   Parte do site "Alinhamento de Sequências de DNA" (https://github.com/Lucas7Ramos/alinhamento-dna). */
'use strict';
/* ENGINE-START */
/* ===== Motor de programação dinâmica (genérico: global / semi / local) ===== */
const SCORE = Object.freeze({ match: 1, mismatch: -1, gap: -2 });
const DIR = Object.freeze({ D: 1, U: 2, L: 4 });
const MODES = ['global', 'semi', 'local'];

function subScore(a, b) { return a === b ? SCORE.match : SCORE.mismatch; }

function computeDP(A, B, mode) {
  const n = A.length, m = B.length, G = SCORE.gap;
  const mk = (v) => Array.from({ length: n + 1 }, () => new Array(m + 1).fill(v));
  const S = mk(0), raw = mk(0), ties = mk(0), dir = mk(0), clamped = mk(false), cand = mk(null);

  // Bordas
  for (let i = 0; i <= n; i++) {
    S[i][0] = raw[i][0] = mode === 'global' ? G * i : 0;
    if (mode === 'global' && i > 0) ties[i][0] = dir[i][0] = DIR.U;
  }
  for (let j = 0; j <= m; j++) {
    S[0][j] = raw[0][j] = mode === 'global' ? G * j : 0;
    if (mode === 'global' && j > 0) ties[0][j] = dir[0][j] = DIR.L;
  }

  // Preenchimento
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = subScore(A[i - 1], B[j - 1]);
      const d = S[i - 1][j - 1] + s, u = S[i - 1][j] + G, l = S[i][j - 1] + G;
      const best = Math.max(d, u, l);
      const t = (d === best ? DIR.D : 0) | (u === best ? DIR.U : 0) | (l === best ? DIR.L : 0);
      cand[i][j] = { d, u, l, s, best };
      raw[i][j] = best;
      if (mode === 'local' && best <= 0) {
        S[i][j] = 0;
        clamped[i][j] = best < 0;
      } else {
        S[i][j] = best;
        ties[i][j] = t;
        dir[i][j] = t & DIR.D ? DIR.D : t & DIR.U ? DIR.U : DIR.L;
      }
    }
  }

  // Início do traceback
  let start = [n, m];
  if (mode === 'semi') {
    const order = [[n, m]];
    for (let j = m - 1; j >= 0; j--) order.push([n, j]);
    for (let i = n - 1; i >= 0; i--) order.push([i, m]);
    start = order[0];
    for (const c of order) if (S[c[0]][c[1]] > S[start[0]][start[1]]) start = c;
  } else if (mode === 'local') {
    start = [0, 0];
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= m; j++)
        if (S[i][j] > S[start[0]][start[1]]) start = [i, j];
  }

  const isEnd = (i, j) =>
    mode === 'global' ? i === 0 && j === 0 :
    mode === 'semi' ? i === 0 || j === 0 :
    S[i][j] === 0;

  // Segue as setas a partir de uma célula; `override` força a direção numa célula (caminho alternativo)
  function follow(si, sj, override) {
    const path = [[si, sj]];
    let i = si, j = sj;
    while (!isEnd(i, j)) {
      const k = override && override.i === i && override.j === j ? override.dir : dir[i][j];
      if (k === DIR.D) { i--; j--; } else if (k === DIR.U) { i--; } else if (k === DIR.L) { j--; } else break;
      path.push([i, j]);
    }
    return path;
  }

  const path = follow(start[0], start[1]);
  const alignment = buildAlignment(A, B, mode, path);
  const endCell = path[path.length - 1];

  // Empate ao longo do caminho → alinhamento alternativo com o mesmo score
  let alt = null;
  for (let k = 0; k < path.length - 1 && !alt; k++) {
    const [i, j] = path[k];
    const other = ties[i][j] & ~dir[i][j];
    if (other) {
      const od = other & DIR.D ? DIR.D : other & DIR.U ? DIR.U : DIR.L;
      const altPath = follow(start[0], start[1], { i, j, dir: od });
      alt = { cell: [i, j], dir: od, path: altPath, alignment: buildAlignment(A, B, mode, altPath) };
    }
  }

  let clampCount = 0;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) if (clamped[i][j]) clampCount++;

  return {
    mode, A, B, n, m, S, raw, ties, dir, clamped, cand, clampCount,
    start, end: endCell, path, moves: path.length - 1,
    score: S[start[0]][start[1]], alignment, alt,
  };
}

// path: do início (fim da sequência) até o fim do traceback
function buildAlignment(A, B, mode, path) {
  const cols = []; // em ordem da esquerda p/ direita
  for (let k = path.length - 1; k > 0; k--) {
    const [pi, pj] = path[k], [i, j] = path[k - 1];
    let a, b;
    if (i === pi + 1 && j === pj + 1) { a = A[pi]; b = B[pj]; }
    else if (i === pi + 1) { a = A[pi]; b = '-'; }
    else { a = '-'; b = B[pj]; }
    const type = a === '-' || b === '-' ? 'gap' : a === b ? 'match' : 'mismatch';
    cols.push({ a, b, type, cell: [i, j] });
  }
  const [si, sj] = path[0], [ei, ej] = path[path.length - 1];
  const res = { cols, pre: [], suf: [], flank: null };
  if (mode === 'semi') {
    // pontas soltas (grátis) viram colunas de gap em cinza
    for (let k = 0; k < ei; k++) res.pre.push({ a: A[k], b: '-', type: 'free' });
    for (let k = 0; k < ej; k++) res.pre.push({ a: '-', b: B[k], type: 'free' });
    for (let k = si; k < A.length; k++) res.suf.push({ a: A[k], b: '-', type: 'free' });
    for (let k = sj; k < B.length; k++) res.suf.push({ a: '-', b: B[k], type: 'free' });
  } else if (mode === 'local') {
    // letras que ficam de fora do trecho local
    res.flank = { aPre: A.slice(0, ei), bPre: B.slice(0, ej), aSuf: A.slice(si), bSuf: B.slice(sj) };
  }
  const count = (t) => cols.filter((c) => c.type === t).length;
  res.matches = count('match'); res.mismatches = count('mismatch'); res.gaps = count('gap');
  res.textA = [...res.pre, ...cols, ...res.suf].map((c) => c.a).join('');
  res.textB = [...res.pre, ...cols, ...res.suf].map((c) => c.b).join('');
  res.coreA = cols.map((c) => c.a).join('');
  res.coreB = cols.map((c) => c.b).join('');
  return res;
}
/* ENGINE-END */
