/* =========================================================
   ㉗ サポートのスクショ読み取り（運営者試用版）  supporter-scan.js
   ゲーム内「強化 > サポーター」一覧のスクショから、写っているURサポートと凸（★）を判定する。
   処理はすべてブラウザ内で完結し、画像はサーバーへ送信しない。

   unit-scan.js（ユニット版・本番使用中）をコピーして、サポート一覧の画面構成に合わせたもの。
   本番のユニット読み取りに影響させないため、試用段階ではファイルを分けている（docs/㉗ 3章）。

   ユニット版との違い
   - カードは横長（4列）。列の間隔 p に対して、外枠左・内枠左・内枠右・外枠右の縦線が
     0 / 0.085p / 0.746p / 0.829p、段の間隔は 0.487p、イラスト（内枠の中）の高さは 0.367p
   - 段の位置は「段の間隔が一定」として、全列の横線（内枠の上端・下端）が最もそろう位相で決める
   - 同じ艦を使うサポート（例：ブライト／フラウ＆ホワイトベース）を見分けるため、
     イラスト全体の相関に、キャラクターが写る右側だけの相関を半々で加えて判定する
   - ★（凸）はカードの下辺中央よりやや左（0.41p）に並ぶ。色と数の対応はユニットと同じ
     （★なし＝無凸、金★1＝1凸、金★2＝2凸、青★3＝完凸）

   新URサポートを追加したとき、または SCAN_FIT に無いサポートは、読み取り画面で
   「判定できなかったカード」を手動で割り当てると、その場で位置合わせ値を推定してこの端末に記憶する。
   ?scandebug=1 を付けて開くと、推定値を SCAN_FIT に貼れる形で表示する。
   ========================================================= */
(function(){
"use strict";

// サポートID → [A, bx, by]
// 参照画像のピクセル座標 = A × (イラスト左上を原点、列の間隔pを1とした座標) + (bx, by)
// 運営者のスクショ（2026-09-26・サポーター一覧2枚、31体）からCoworkが算出。無いIDは手動割り当てで学習する
const SCAN_FIT = {"1":[414.14,-49.7,-2.07],"2":[406.78,-14.24,-15.25],"3":[463.04,-85.66,-18.52],"4":[414.14,-48.66,-6.21],"6":[462.75,-56.69,-5.78],"8":[413.79,-14.48,-15.52],"10":[465.82,-107.14,-17.47],"11":[448.6,-28.04,-10.09],"12":[464.1,-111.38,-33.65],"13":[427.08,-55.52,-7.47],"14":[592.59,-108.15,-26.67],"16":[403.36,-12.1,-15.13],"17":[414.14,-49.7,-2.07],"18":[514.63,-75.91,5.15],"19":[534.18,-110.84,-18.7],"20":[558.14,-114.42,-12.56],"21":[410.64,-47.22,-5.13],"22":[414.14,-49.7,-1.04],"23":[414.58,-48.71,-0.0],"25":[420.83,-55.76,-8.42],"26":[500.0,-72.5,-22.5],"27":[506.98,-86.19,-24.08],"28":[418.37,-54.39,-8.37],"30":[418.37,-54.39,-6.28],"32":[413.79,-18.62,-15.52],"33":[432.43,-30.27,-3.24],"34":[418.37,-51.25,-5.23],"38":[406.78,-15.25,-15.25],"40":[418.37,-50.2,-8.37],"43":[414.14,-49.7,-8.28],"45":[418.37,-52.3,-14.64]};

const LEARN_KEY = "supporterscan_learned_fit_v1";
const K = 128;                                  // 比較用画像の解像度（列の間隔 p = 128px）
const AW = Math.floor(0.66 * K), AH = Math.floor(0.367 * K);   // イラスト部分のサイズ（84×46）
const PAD = 4;                                  // 位置ずれ吸収の余白
const XO = [0, 35/414, 309/414, 343/414];       // 外枠左・内枠左・内枠右・外枠右（pに対する比）
const ROW = 201.5 / 414;                        // 段の間隔 / p
const YO = [0, 152/414];                        // 内枠の上端・下端（T＝内枠の上端）
const WR = 0.5;                                 // キャラクター部分（右側）の相関の重み
// 運営者スクショ32枚での検証：正解の類似度 0.57〜0.98、2位との差は同じ艦のサポート同士で0.09〜0.15（docs/㉗ 3-6）
const ACCEPT = 0.55, SURE = 0.80, MARGIN = 0.08, SURE_MARGIN = 0.15;

function loadLearned(){
  try { return JSON.parse(localStorage.getItem(LEARN_KEY) || "{}"); } catch(e){ return {}; }
}
function saveLearned(obj){
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(obj)); } catch(e){}
}
function fitTable(){
  return Object.assign({}, SCAN_FIT, loadLearned());
}

function canvas(w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function ctx2d(c){
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  return x;
}
function loadImage(src){
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}
function fileToImage(file){
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { resolve(im); setTimeout(() => URL.revokeObjectURL(url), 0); };
    im.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    im.src = url;
  });
}
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------- 1. カードの格子を検出 ---------- */
function detectCells(img){
  const W0 = img.naturalWidth, H0 = img.naturalHeight;
  const H = 600, f = H / H0, W = Math.round(W0 * f);
  const c = canvas(W, H), x = ctx2d(c);
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const G = new Float32Array(W * H);
  for (let i = 0, j = 0; i < G.length; i++, j += 4) G[i] = 0.299 * d[j] + 0.587 * d[j+1] + 0.114 * d[j+2];
  const gx = (xx, yy) => (xx < 1 || xx >= W - 1) ? 0 : Math.abs(G[yy*W + xx + 1] - G[yy*W + xx - 1]);
  const gy = (xx, yy) => (yy < 1 || yy >= H - 1) ? 0 : Math.abs(G[(yy+1)*W + xx] - G[(yy-1)*W + xx]);
  const pk = (arr, xx) => {
    const i = Math.round(xx);
    let m = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(arr.length - 1, i + 1); j++) if (arr[j] > m) m = arr[j];
    return m;
  };

  // 列方向のエッジ強度プロファイル
  const P = new Float32Array(W);
  const y0 = Math.floor(0.1 * H), y1 = Math.floor(0.8 * H);
  for (let xx = 0; xx < W; xx++){
    let s = 0;
    for (let yy = y0; yy < y1; yy++) s += gx(xx, yy);
    P[xx] = s / (y1 - y0);
  }
  const Pd = new Float32Array(W);
  for (let i = 0; i < W; i++){
    let s = 0;
    for (let k = -15; k <= 15; k++){ const j = i + k; if (j >= 0 && j < W) s += P[j]; }
    Pd[i] = P[i] - s / 31;
  }
  // 周期（列の間隔）。横長カード4列のため、画面の高さの0.25〜0.45倍の範囲で探す
  let bestLag = 0, bestV = -Infinity;
  for (let lag = Math.floor(0.25 * H); lag < Math.floor(0.45 * H); lag++){
    let s = 0;
    for (let i = 0; i + lag < W; i++) s += Pd[i] * Pd[i + lag];
    s /= (W - lag);
    if (s > bestV){ bestV = s; bestLag = lag; }
  }
  // 周期と位相：カード1枚に4本ある縦線（外枠・内枠の左右）がそろう位置
  const comb = (ph, p) => {
    let s = 0, n = 0;
    for (let k = 0; ph + k * p <= W; k++){
      for (const o of XO){
        const xx = ph + k * p + o * p;
        if (xx >= 1 && xx < W - 1){ s += pk(P, xx); n++; }
      }
    }
    return n ? s / n : 0;
  };
  let best = { v: -1, p: bestLag, ph: 0 };
  for (let p = bestLag - 1.5; p < bestLag + 1.5; p += 0.1){
    for (let ph = 0; ph < p; ph += 0.5){
      const v = comb(ph, p);
      if (v > best.v) best = { v, p, ph };
    }
  }
  const p = best.p, ph = best.ph;
  const sorted = Array.from(P).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const cols = [];
  for (let k = 0; ph + k * p <= W; k++){
    const L = ph + k * p;
    if (L + XO[3] * p < W - 1 && pk(P, L + XO[1] * p) > 1.5 * med && pk(P, L + XO[2] * p) > 1.5 * med) cols.push(L);
  }
  if (cols.length < 2) return { cells: [], p: p / f };

  // 段：段の間隔は列の間隔の一定比。全列の横エッジで「内枠の上端・下端」が最もそろう位相を探す
  const r = ROW * p;
  const Q = new Float32Array(H);
  cols.forEach(L => {
    const xa = Math.floor(L + 0.1 * p), xb = Math.floor(L + 0.72 * p);
    for (let yy = 0; yy < H; yy++){
      let s = 0;
      for (let xx = xa; xx < xb; xx++) s += gy(xx, yy);
      Q[yy] += s / Math.max(1, xb - xa) / cols.length;
    }
  });
  let rb = { v: -1, ph: 0 };
  for (let ph2 = 0; ph2 < r; ph2 += 0.25){
    let s = 0, n = 0;
    for (let k = 0; ph2 + k * r < H; k++){
      for (const o of YO){
        const yy = ph2 + k * r + o * p;
        if (yy >= 1 && yy < H - 1){ s += pk(Q, yy); n++; }
      }
    }
    const v = n ? s / n : 0;
    if (v > rb.v) rb = { v, ph: ph2 };
  }
  const cells = [];
  for (let k = 0; rb.ph + k * r < H; k++){
    const T = rb.ph + k * r;
    if (T + 0.42 * p > H) continue;   // ★（カードの下）まで写っていない段は使わない
    const ya = Math.floor(T + 0.02 * p), yb = Math.floor(T + 0.35 * p);
    cols.forEach((L, ci) => {
      // 内枠の左右の縦線が、その段の高さの半分以上で続いていればカードとみなす（空き枠・画面下のボタン帯を除く）
      const x1 = Math.round(L + XO[1] * p), x2 = Math.round(L + XO[2] * p);
      let on = 0;
      for (let yy = ya; yy < yb; yy++){
        let a = 0, b = 0;
        for (let j = -1; j <= 1; j++){ a = Math.max(a, gx(x1 + j, yy)); b = Math.max(b, gx(x2 + j, yy)); }
        if (Math.min(a, b) > 8) on++;
      }
      if (on > 0.5 * (yb - ya)) cells.push({ col: ci, L: L / f, T: T / f, p: p / f });
    });
  }
  return { cells, p: p / f };
}

/* ---------- 2. イラスト部分の比較 ---------- */
function makeMask(rightOnly){
  const m = new Uint8Array(AW * AH).fill(1);
  const zone = (x0, x1, y0, y1) => {
    for (let y = Math.floor(y0 * AH); y < Math.min(AH, Math.floor(y1 * AH)); y++)
      for (let x = Math.floor(x0 * AW); x < Math.min(AW, Math.floor(x1 * AW)); x++) m[y * AW + x] = 0;
  };
  zone(0, 0.17, 0, 0.36);      // 左上の時計アイコン
  zone(0, 1, 0.72, 1);         // 下部のLV・名前（LVで変わるため）
  zone(0.80, 1, 0.55, 1);      // 右下のお気に入り
  zone(0.92, 1, 0, 0.16);      // 右上のバッジ
  for (let y = 0; y < AH; y++){ m[y*AW] = m[y*AW+1] = m[y*AW+AW-1] = m[y*AW+AW-2] = 0; }
  if (rightOnly) zone(0, 0.55, 0, 1);   // キャラクターが写る右側だけ
  return m;
}
const MASK = makeMask(false), RMASK = makeMask(true);
const countOf = m => { let n = 0; for (const v of m) n += v; return n; };
const MASK_COUNT = countOf(MASK), RMASK_COUNT = countOf(RMASK);

function cardArt(img, cell){
  const c = canvas(AW, AH), x = ctx2d(c);
  const p = cell.p;
  x.drawImage(img, cell.L + XO[1] * p, cell.T, AW * p / K, AH * p / K, 0, 0, AW, AH);
  return x.getImageData(0, 0, AW, AH).data;
}

// 参照画像を位置合わせ値でカード座標に写した比較用画像（余白付き）と、参照画像が写っている範囲
function warpRef(refImg, fit, w, h, pad){
  const [A, bx, by] = fit;
  const s = K / A;
  const c = canvas(w, h), x = ctx2d(c);
  x.setTransform(s, 0, 0, s, pad - bx * s, pad - by * s);
  x.drawImage(refImg, 0, 0);
  const data = x.getImageData(0, 0, w, h).data;
  const cov = new Uint8Array(w * h);
  const left = pad - bx * s + 1, top = pad - by * s + 1;
  const right = pad + (refImg.naturalWidth - bx) * s - 1, bottom = pad + (refImg.naturalHeight - by) * s - 1;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++)
      cov[yy * w + xx] = (xx >= left && xx < right && yy >= top && yy < bottom) ? 1 : 0;
  return { data, cov, w, h };
}

function nccMask(art, tpl, dx, dy, mask, maskCount){
  let n = 0, sa = [0,0,0], sb = [0,0,0];
  const tw = tpl.w;
  for (let y = 0; y < AH; y++){
    for (let x = 0; x < AW; x++){
      const mi = y * AW + x;
      if (!mask[mi]) continue;
      const ti = (y + dy) * tw + (x + dx);
      if (!tpl.cov[ti]) continue;
      const a = mi * 4, b = ti * 4;
      sa[0] += art[a]; sa[1] += art[a+1]; sa[2] += art[a+2];
      sb[0] += tpl.data[b]; sb[1] += tpl.data[b+1]; sb[2] += tpl.data[b+2];
      n++;
    }
  }
  if (n < 0.4 * maskCount) return -1;
  const ma = sa.map(v => v / n), mb = sb.map(v => v / n);
  let num = 0, da = 0, db = 0;
  for (let y = 0; y < AH; y++){
    for (let x = 0; x < AW; x++){
      const mi = y * AW + x;
      if (!mask[mi]) continue;
      const ti = (y + dy) * tw + (x + dx);
      if (!tpl.cov[ti]) continue;
      const a = mi * 4, b = ti * 4;
      for (let ch = 0; ch < 3; ch++){
        const u = art[a+ch] - ma[ch], v = tpl.data[b+ch] - mb[ch];
        num += u * v; da += u * u; db += v * v;
      }
    }
  }
  return num / Math.sqrt(da * db + 1e-6);
}
// イラスト全体と、キャラクター部分（右側）の相関を半々で合わせる
function ncc(art, tpl, dx, dy){
  return (1 - WR) * nccMask(art, tpl, dx, dy, MASK, MASK_COUNT) + WR * nccMask(art, tpl, dx, dy, RMASK, RMASK_COUNT);
}

function bestScore(art, tpl, full){
  let best = ncc(art, tpl, PAD, PAD);
  if (!full) return best;
  for (let dy = 0; dy <= 2 * PAD; dy += 2)
    for (let dx = 0; dx <= 2 * PAD; dx += 2){
      if (dx === PAD && dy === PAD) continue;
      const v = ncc(art, tpl, dx, dy);
      if (v > best) best = v;
    }
  return best;
}

/* ---------- 3. ★（凸）の判定 ---------- */
// ★はカードの下辺（内枠の下端の少し下）に、左から0.41pを中心に並ぶ。
// カードの下辺には虹色に光る横線があり、色だけで数えると光の線を★と取り違えるため、
// 金・青の画素を★の形（塗りつぶした五芒星）の型と重ねて、型によく重なり型の外にはみ出しが少ない位置を★とする
const STAR_SIZE = 0.053, STAR_THR = 0.40, STAR_PEN = 0.5;
const starTplCache = {};
function starTemplate(S){
  if (starTplCache[S]) return starTplCache[S];
  const c = canvas(S, S), x = c.getContext("2d");
  const cx = S / 2, R = S / 2, r = R * 0.45;
  x.beginPath();
  for (let i = 0; i < 10; i++){
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    x.lineTo(cx + rr * Math.cos(a), cx + rr * Math.sin(a));
  }
  x.closePath(); x.fillStyle = "#fff"; x.fill();
  const d = x.getImageData(0, 0, S, S).data;
  const m = new Uint8Array(S * S);
  let n = 0;
  for (let i = 0; i < S * S; i++){ m[i] = d[i * 4 + 3] >= 128 ? 1 : 0; n += m[i]; }
  return (starTplCache[S] = { m, n, S });
}
function readStars(img, cell){
  const p = cell.p;
  const cx = cell.L + 0.41 * p, cy = cell.T + 0.384 * p;
  const sx = Math.floor(cx - 0.13 * p), sy = Math.floor(cy - 0.045 * p);
  const w = Math.max(8, Math.floor(0.26 * p)), h = Math.max(8, Math.floor(0.09 * p));
  const c = canvas(w, h), x = ctx2d(c);
  x.imageSmoothingEnabled = false;
  x.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const hit = new Uint8Array(w * h), isG = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++){
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
    const gold = r > 180 && g > 120 && r - b > 60 && r >= g - 5;
    const blue = b > 200 && r > 100 && g > 100 && b - r > 30;
    if (gold || blue){ hit[i] = 1; if (gold) isG[i] = 1; }
  }
  const t = starTemplate(Math.max(6, Math.round(STAR_SIZE * p)));
  const S = t.S, outN = S * S - t.n;
  const best = new Float32Array(w).fill(-9), bestY = new Int16Array(w);
  for (let xx = 0; xx + S <= w; xx++){
    for (let yy = 0; yy + S <= h; yy++){
      let inS = 0, outS = 0;
      for (let v = 0; v < S; v++){
        const row = (yy + v) * w + xx, trow = v * S;
        for (let u = 0; u < S; u++){
          if (!hit[row + u]) continue;
          if (t.m[trow + u]) inS++; else outS++;
        }
      }
      const sc = inS / t.n - STAR_PEN * outS / outN;
      if (sc > best[xx]){ best[xx] = sc; bestY[xx] = yy; }
    }
  }
  // 山の高い順に、★1個分（0.05p）以上離れた位置だけを数える
  const order = Array.from(best.keys()).sort((a, b) => best[b] - best[a]);
  const peaks = [];
  for (const i of order){
    if (best[i] < STAR_THR) break;
    if (peaks.every(j => Math.abs(i - j) >= 0.05 * p)) peaks.push(i);
    if (peaks.length >= 3) break;
  }
  let gold = 0, blue = 0;
  peaks.forEach(px => {
    const py = bestY[px];
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++){
      const i = (py + v) * w + px + u;
      if (t.m[v * S + u] && hit[i]){ if (isG[i]) gold++; else blue++; }
    }
  });
  const n = peaks.length;
  return { stars: n, color: n ? (gold > blue ? "gold" : "blue") : "" };
}

function thumb(img, cell){
  const p = cell.p, w = 172, h = 100;
  const c = canvas(w, h), x = ctx2d(c);
  x.drawImage(img, cell.L, cell.T - 0.02 * p, 0.829 * p, 0.48 * p, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.8);
}

/* ---------- 全体の流れ ---------- */
let templateCache = null;
async function buildTemplates(units, onProgress){
  const fits = fitTable();
  const out = {};
  const refs = {};
  let i = 0;
  for (const u of units){
    i++;
    const im = await loadImage(u.imageUrl);
    refs[u.id] = im;
    const fit = fits[u.id];
    if (im && fit) out[u.id] = warpRef(im, fit, AW + 2 * PAD, AH + 2 * PAD, PAD);
    if (onProgress && i % 8 === 0){ onProgress(`参照画像を準備中… ${i}/${units.length}`); await tick(); }
  }
  return { tpl: out, refs, fitsKey: JSON.stringify(fits) };
}

async function scanFiles(files, units, onProgress){
  const fitsKey = JSON.stringify(fitTable());
  if (!templateCache || templateCache.fitsKey !== fitsKey) templateCache = await buildTemplates(units, onProgress);
  const { tpl } = templateCache;
  const ids = Object.keys(tpl).map(Number);
  const cards = [];
  let fi = 0;
  for (const file of files){
    fi++;
    const img = await fileToImage(file);
    if (!img){ cards.push({ file: fi, error: "画像を開けませんでした" }); continue; }
    onProgress && onProgress(`${fi}/${files.length}枚目：カードを探しています…`);
    await tick();
    const { cells } = detectCells(img);
    if (!cells.length){ cards.push({ file: fi, error: "サポーター一覧の画面として認識できませんでした" }); continue; }
    let ci = 0;
    for (const cell of cells){
      ci++;
      const art = cardArt(img, cell);
      const rough = ids.map(id => [bestScore(art, tpl[id], false), id]).sort((a, b) => b[0] - a[0]).slice(0, 5);
      const fine = rough.map(([_, id]) => [bestScore(art, tpl[id], true), id]).sort((a, b) => b[0] - a[0]);
      const [s1, id1] = fine[0] || [-1, null];
      const s2 = fine[1] ? fine[1][0] : -1;
      const st = readStars(img, cell);
      const ok = s1 >= ACCEPT && (s1 - s2) >= MARGIN;
      const sure = ok && s1 >= SURE && (s1 - s2) >= SURE_MARGIN;
      cards.push({
        file: fi, cell, art, img,
        unitId: ok ? id1 : null,             // 画面側（unit.html由来のUI）と同じ項目名で返す（中身はサポートID）
        guessId: id1, score: s1, second: s2,
        sure,
        stars: st.stars, starColor: st.color,
        level: st.stars,
        thumb: thumb(img, cell)
      });
      if (ci % 4 === 0){ onProgress && onProgress(`${fi}/${files.length}枚目：判定中… ${ci}/${cells.length}`); await tick(); }
    }
  }
  return cards;
}

// 手動で割り当てたカードから、そのサポートの位置合わせ値を推定して学習する
async function learnFit(card, unit){
  const refImg = (templateCache && templateCache.refs[unit.id]) || await loadImage(unit.imageUrl);
  if (!refImg) return null;
  const rw = refImg.naturalWidth;
  const search = (ws, x0s, y0s) => {
    let best = { v: -1 };
    for (const wN of ws){
      const A = rw / wN;
      for (const x0 of x0s){
        for (const y0 of y0s){
          const fit = [A, -x0 * A, -y0 * A];
          const t = warpRef(refImg, fit, AW, AH, 0);
          const v = ncc(card.art, t, 0, 0);
          if (v > best.v) best = { v, wN, x0, y0, fit };
        }
      }
    }
    return best;
  };
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  let b = search(lin(0.40, 0.95, 12), lin(-0.10, 0.30, 11), lin(-0.12, 0.16, 8));
  await tick();
  b = search(lin(b.wN - 0.03, b.wN + 0.03, 5), lin(b.x0 - 0.02, b.x0 + 0.02, 5), lin(b.y0 - 0.02, b.y0 + 0.02, 5));
  await tick();
  b = search(lin(b.wN - 0.01, b.wN + 0.01, 5), lin(b.x0 - 0.006, b.x0 + 0.006, 5), lin(b.y0 - 0.006, b.y0 + 0.006, 5));
  if (b.v < 0.5) return { score: b.v, fit: null };
  const fit = b.fit.map(v => Math.round(v * 100) / 100);
  const learned = loadLearned();
  learned[unit.id] = fit;
  saveLearned(learned);
  templateCache = null;
  return { score: b.v, fit };
}

window.SupporterScan = { scanFiles, learnFit, loadLearned, SCAN_FIT, ACCEPT, SURE, detectCells, readStars };
})();
