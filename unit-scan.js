/* =========================================================
   ㉕ 案3：スクショ読み取り（試験版）  unit-scan.js
   ゲーム内「強化 > ユニット」一覧のスクショから、写っているURユニットと凸（★）を判定する。
   処理はすべてブラウザ内で完結し、画像はサーバーへ送信しない。

   仕組み（詳細は docs/㉕有料プラン移行に伴う機能拡張_対応案.md の5章）
   1. カードの並び（格子）を、カード枠の縦線の周期から検出する
   2. 各カードのイラスト部分を、UNITS の画像（images/units/{id}.jpg）と比較する
      - 参照画像はカードより広い範囲を写しているため、ユニットごとの位置合わせ値
        （SCAN_FIT：参照画像のどこがカードのどこに当たるか）を使って重ね合わせ、
        マスク付きの相関（NCC）で似ている度合いを出す
   3. カード下部の★の数と色から凸を判定する（金★1＝1凸、金★2＝2凸、青★3＝完凸、★なし＝無凸）

   新URを追加したときは、UNITS に画像を足すだけでは自動判定されない（位置合わせ値が無いため）。
   読み取り画面で「判定できなかったカード」を手動で割り当てると、その場で位置合わせ値を推定して
   この端末に記憶する。?scandebug=1 を付けて開くと、推定値を SCAN_FIT に貼れる形で表示する。
   ========================================================= */
(function(){
"use strict";

// ユニットID → [A, bx, by]
// 参照画像のピクセル座標 = A × (カードのイラスト左上を原点、カード間隔pを1とした座標) + (bx, by)
// 運営者のスクショ（2026-09-25・所持一覧1〜6）からCoworkが算出。無いIDは手動割り当てで学習する
const SCAN_FIT = {"1":[128.54,35.45,-0.32],"2":[122.79,10.01,4.5],"3":[118.03,33.87,-0.66],"4":[129.09,-2.6,-34.52],"5":[148.14,3.6,-11.02],"6":[148.97,28.0,-19.75],"7":[125.46,5.36,-6.7],"8":[103.7,27.26,0.75],"9":[132.93,6.62,-18.76],"10":[131.7,15.33,-23.41],"11":[142.13,25.98,-15.98],"12":[133.51,29.72,-31.15],"13":[133.39,29.59,-20.84],"14":[116.99,36.46,-13.69],"15":[179.04,13.82,-69.46],"16":[148.23,2.29,-11.25],"17":[172.5,-22.2,4.72],"18":[115.71,20.63,-16.34],"19":[121.94,26.63,-18.22],"20":[118.28,23.41,0.04],"21":[153.74,-11.95,-25.61],"22":[137.91,2.17,-26.58],"23":[157.88,20.94,-42.41],"24":[146.34,-15.74,-42.16],"25":[138.17,15.7,-22.97],"27":[155.57,1.9,-27.64],"28":[138.78,10.25,-32.54],"29":[118.39,24.44,-15.15],"30":[121.88,7.46,-11.95],"31":[142.07,24.08,-2.15],"32":[143.64,14.93,-37.08],"34":[127.32,25.9,-23.38],"35":[173.24,-9.29,-16.36],"36":[132.99,33.65,-43.34],"37":[152.08,14.43,-33.54],"40":[143.77,36.2,-21.55],"41":[173.72,-1.52,-40.9],"42":[115.97,22.32,-4.6],"43":[161.94,-7.81,-27.7],"44":[114.08,44.0,-22.24],"46":[162.15,-27.85,-50.99],"47":[115.08,13.07,-18.36],"48":[157.3,16.87,-26.96],"49":[122.9,34.11,-32.62],"50":[168.09,-12.63,-67.7],"52":[122.81,11.36,-19.69],"53":[159.35,1.84,-61.12],"55":[137.18,-3.74,-19.03],"56":[138.18,-2.09,-17.71],"57":[132.01,12.58,-22.74],"59":[154.29,14.46,-49.04],"60":[127.48,8.16,-10.29],"61":[96.13,43.55,1.41],"62":[127.97,24.57,-11.17],"64":[168.05,17.25,-13.23],"65":[91.76,29.19,9.18],"66":[115.53,31.53,-7.39],"68":[169.37,13.68,-26.91],"69":[135.41,17.48,-8.3],"70":[136.7,27.31,-29.92],"73":[135.99,23.72,-43.13],"74":[118.11,26.13,-19.29],"75":[133.3,22.64,-12.41],"77":[131.49,20.48,-17.66],"78":[120.98,31.56,-18.49],"79":[122.54,29.75,-11.27],"80":[140.5,23.87,2.63],"81":[122.01,27.14,-10.7],"82":[145.04,0.81,-5.03]};

const LEARN_KEY = "unitscan_learned_fit_v1";
const K = 64;                                  // 比較用画像の解像度（カード間隔p = 64px）
const AW = Math.floor(0.73 * K), AH = Math.floor(1.28 * K);   // イラスト部分のサイズ
const PAD = 4;                                 // 位置ずれ吸収の余白
const ACCEPT = 0.65, SURE = 0.80, MARGIN = 0.10, SURE_MARGIN = 0.15;

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
  // 周期（カード間隔）
  let bestLag = 0, bestV = -Infinity;
  for (let lag = Math.floor(0.12 * H); lag < Math.floor(0.25 * H); lag++){
    let s = 0;
    for (let i = 0; i + lag < W; i++) s += Pd[i] * Pd[i + lag];
    s /= (W - lag);
    if (s > bestV){ bestV = s; bestLag = lag; }
  }
  const pk = (arr, xx) => {
    const i = Math.round(xx);
    let m = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(arr.length - 1, i + 1); j++) if (arr[j] > m) m = arr[j];
    return m;
  };
  const comb = (ph, p) => {
    let s = 0, n = 0;
    for (let k = 0; k <= Math.floor(W / p) + 1; k++){
      const i = Math.round(ph + k * p);
      if (i >= 1 && i < W - 1){ s += pk(P, i); n++; }
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
  let p = best.p, ph = best.ph;
  let dBest = { v: -1, d: 0.8 * p };
  for (let dd = 0.1 * p; dd < 0.9 * p; dd += 0.5){
    const v = comb((ph + dd) % p, p);
    if (v > dBest.v) dBest = { v, d: dd };
  }
  let dW = dBest.d;
  if (dW < 0.5 * p){ ph = (ph + dW) % p; dW = p - dW; }   // 見つけた位相が右端だった場合は入れ替える

  const sorted = Array.from(P).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const cols = [];
  for (let k = 0; k <= Math.floor(W / p) + 1; k++){
    const l = ph + k * p, r = l + dW;
    if (r >= W - 1) continue;
    if (pk(P, l) > 1.5 * med && pk(P, r) > 1.5 * med) cols.push([l, r]);
  }
  if (cols.length < 2) return { cells: [], p: p / f };

  // 列ごとにカード枠の縦線が続く範囲からカードの上下を決める
  const cells = [];
  const colProf = [];
  cols.forEach(([l, r], ci) => {
    const on = new Uint8Array(H);
    const li = Math.round(l), ri = Math.round(r);
    for (let yy = 0; yy < H; yy++){
      let a = 0, b = 0;
      for (let j = -1; j <= 1; j++){ a = Math.max(a, gx(li + j, yy)); b = Math.max(b, gx(ri + j, yy)); }
      on[yy] = Math.min(a, b) > 12 ? 1 : 0;
    }
    const prof = new Float32Array(H);
    const xa = Math.floor(l + 3), xb = Math.floor(r - 3);
    for (let yy = 0; yy < H; yy++){
      let s = 0;
      for (let xx = xa; xx < xb; xx++) s += gy(xx, yy);
      prof[yy] = s / Math.max(1, xb - xa);
    }
    colProf[ci] = prof;
    let yy = 0;
    while (yy < H){
      if (on[yy]){
        const s = yy; let gap = 0;
        while (yy < H && gap <= 4){ gap = on[yy] ? 0 : gap + 1; yy++; }
        const e = yy - gap;
        if (e - s > 1.5 * p){
          let bt = null, bv = -1;
          for (let t = Math.max(0, s - 12); t < Math.min(H - 1, s + 12); t++){
            const t2 = Math.round(t + 1.31 * p);
            if (t2 >= H) continue;
            const v = prof[t] + prof[t2];
            if (v > bv){ bv = v; bt = t; }
          }
          if (bt !== null && bt + 1.78 * p <= H){
            cells.push({ col: ci, L: l / f, R: r / f, T: bt / f, p: p / f });
          }
        }
      } else yy++;
    }
  });
  // 同じ段のカードは上端がそろっているはずなので、段ごとの中央値に合わせて列ごとのずれを補正する
  const byT = cells.slice().sort((a, b) => a.T - b.T);
  let group = [];
  const flush = () => {
    if (!group.length) return;
    const ts = group.map(c => c.T * f).sort((a, b) => a - b);
    const mid = ts[Math.floor(ts.length / 2)];
    // 段全体（その段の全カード）の「イラスト上端＋名前欄の境目」のエッジが最も強い位置に合わせ直す
    let bt = mid, bv = -1;
    const w = Math.ceil(0.15 * p);
    for (let t = Math.max(0, Math.round(mid) - w); t <= Math.min(H - 1, Math.round(mid) + w); t++){
      const t2 = Math.round(t + 1.31 * p);
      if (t2 >= H) continue;
      let v = 0;
      group.forEach(c => { const pr = colProf[c.col]; v += pr[t] + pr[t2]; });
      if (v > bv){ bv = v; bt = t; }
    }
    group.forEach(c => { c.T = bt / f; });
    group = [];
  };
  byT.forEach(c => {
    if (group.length && c.T - group[0].T > 0.4 * p / f) flush();
    group.push(c);
  });
  flush();
  return { cells: cells.filter(c => c.T >= 0 && (c.T + 1.78 * c.p) * f <= H), p: p / f };
}

/* ---------- 2. イラスト部分の比較 ---------- */
const MASK = (() => {
  const m = new Uint8Array(AW * AH).fill(1);
  const zone = (x0, x1, y0, y1) => {
    for (let y = Math.floor(y0 * K); y < Math.min(AH, Math.floor(y1 * K)); y++)
      for (let x = Math.floor(x0 * K); x < Math.min(AW, Math.floor(x1 * K)); x++) m[y * AW + x] = 0;
  };
  zone(0, 0.28, 0, 0.48);        // 左上の属性・状態アイコン
  zone(0.45, 0.73, 0, 0.22);     // 右上のバッジ（ULT等）
  zone(0.45, 0.73, 1.02, 1.28);  // 右下のお気に入り
  for (let y = 0; y < AH; y++){ m[y*AW] = m[y*AW+1] = m[y*AW+AW-1] = m[y*AW+AW-2] = 0; }
  return m;
})();
let MASK_COUNT = 0; for (const v of MASK) MASK_COUNT += v;

function cardArt(img, cell){
  const c = canvas(AW, AH), x = ctx2d(c);
  const p = cell.p;
  x.drawImage(img, cell.L + 0.07 * p, cell.T, AW * p / K, AH * p / K, 0, 0, AW, AH);
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
  // 参照画像の範囲（端のにじみを除くため、内側1px）
  const left = pad - bx * s + 1, top = pad - by * s + 1;
  const right = pad + (refImg.naturalWidth - bx) * s - 1, bottom = pad + (refImg.naturalHeight - by) * s - 1;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++)
      cov[yy * w + xx] = (xx >= left && xx < right && yy >= top && yy < bottom) ? 1 : 0;
  return { data, cov, w, h };
}

function ncc(art, tpl, dx, dy){
  let n = 0, sa = [0,0,0], sb = [0,0,0];
  const tw = tpl.w;
  for (let y = 0; y < AH; y++){
    for (let x = 0; x < AW; x++){
      const mi = y * AW + x;
      if (!MASK[mi]) continue;
      const ti = (y + dy) * tw + (x + dx);
      if (!tpl.cov[ti]) continue;
      const a = mi * 4, b = ti * 4;
      sa[0] += art[a]; sa[1] += art[a+1]; sa[2] += art[a+2];
      sb[0] += tpl.data[b]; sb[1] += tpl.data[b+1]; sb[2] += tpl.data[b+2];
      n++;
    }
  }
  if (n < 0.4 * MASK_COUNT) return -1;
  const ma = sa.map(v => v / n), mb = sb.map(v => v / n);
  let num = 0, da = 0, db = 0;
  for (let y = 0; y < AH; y++){
    for (let x = 0; x < AW; x++){
      const mi = y * AW + x;
      if (!MASK[mi]) continue;
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
function readStars(img, cell){
  const p = cell.p;
  const cx = cell.L + 0.42 * p, cy = cell.T + 1.676 * p;
  const sx = Math.floor(cx - 0.2 * p), sy = Math.floor(cy - 0.045 * p);
  const w = Math.max(4, Math.floor(0.4 * p)), h = Math.max(4, Math.floor(0.09 * p));
  const c = canvas(w, h), x = ctx2d(c);
  x.imageSmoothingEnabled = false;
  x.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const colCount = new Uint16Array(w);
  const hit = new Uint8Array(w * h);
  let gold = 0, blue = 0;
  for (let yy = 0; yy < h; yy++){
    for (let xx = 0; xx < w; xx++){
      const i = (yy * w + xx) * 4, r = d[i], g = d[i+1], b = d[i+2];
      const isGold = r > 180 && g > 120 && r - b > 60 && r >= g - 5;
      const isBlue = b > 200 && r > 100 && g > 100 && b - r > 30;
      if (isGold) gold++;
      if (isBlue) blue++;
      if (isGold || isBlue){ colCount[xx]++; hit[yy * w + xx] = 1; }
    }
  }
  // ★らしさの確認：縦にもある程度の高さがあること（イラストの端や背景の光の線を除く）
  const tallEnough = (x0, x1) => {
    let rowsHit = 0;
    for (let yy = 0; yy < h; yy++){
      for (let xx = x0; xx < x1; xx++){ if (hit[yy * w + xx]){ rowsHit++; break; } }
    }
    return rowsHit >= 0.045 * p;
  };
  const minCol = Math.max(2, Math.floor(0.02 * p));
  const on = Array.from(colCount, v => v >= minCol);
  let runs = 0, xx = 0;
  while (xx < w){
    if (on[xx]){
      const s = xx;
      while (xx < w && (on[xx] || (xx + 1 < w && on[xx+1]))) xx++;
      if (xx - s >= 0.04 * p && xx - s <= 0.2 * p && tallEnough(s, xx)) runs++;
    } else xx++;
  }
  const n = Math.min(runs, 3);
  return { stars: n, color: n ? (gold > blue ? "gold" : "blue") : "" };
}

function thumb(img, cell){
  const p = cell.p, w = 82, h = 180;
  const c = canvas(w, h), x = ctx2d(c);
  x.drawImage(img, cell.L, cell.T, 0.82 * p, 1.8 * p, 0, 0, w, h);
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
    if (!cells.length){ cards.push({ file: fi, error: "ユニット一覧の画面として認識できませんでした" }); continue; }
    let ci = 0;
    for (const cell of cells){
      ci++;
      const art = cardArt(img, cell);
      // 1段目：位置ずれなしで全ユニットと比較 → 上位5件だけ位置ずれを探す
      const rough = ids.map(id => [bestScore(art, tpl[id], false), id]).sort((a, b) => b[0] - a[0]).slice(0, 5);
      const fine = rough.map(([_, id]) => [bestScore(art, tpl[id], true), id]).sort((a, b) => b[0] - a[0]);
      const [s1, id1] = fine[0] || [-1, null];
      const s2 = fine[1] ? fine[1][0] : -1;
      const st = readStars(img, cell);
      const ok = s1 >= ACCEPT && (s1 - s2) >= MARGIN;       // 採用：一定以上似ていて、2位と差がある
      const sure = ok && s1 >= SURE && (s1 - s2) >= SURE_MARGIN; // 確実：さらに十分似ている
      cards.push({
        file: fi, cell, art, img,
        unitId: ok ? id1 : null,
        guessId: id1, score: s1, second: s2,
        sure,
        stars: st.stars, starColor: st.color,
        level: st.stars,                    // ★の数 = 凸（0=無凸〜3=完凸）
        thumb: thumb(img, cell)
      });
      if (ci % 4 === 0){ onProgress && onProgress(`${fi}/${files.length}枚目：判定中… ${ci}/${cells.length}`); await tick(); }
    }
  }
  return cards;
}

// 手動で割り当てたカードから、そのユニットの位置合わせ値を推定して学習する
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
  let b = search(lin(0.82, 1.65, 10), lin(-0.45, 0.2, 9), lin(-0.12, 0.42, 8));
  await tick();
  b = search(lin(b.wN - 0.06, b.wN + 0.06, 5), lin(b.x0 - 0.05, b.x0 + 0.05, 5), lin(b.y0 - 0.05, b.y0 + 0.05, 5));
  if (b.v < 0.55) return { score: b.v, fit: null };
  const fit = b.fit.map(v => Math.round(v * 100) / 100);
  const learned = loadLearned();
  learned[unit.id] = fit;
  saveLearned(learned);
  templateCache = null;
  return { score: b.v, fit };
}

window.UnitScan = { scanFiles, learnFit, loadLearned, SCAN_FIT, ACCEPT, SURE };
})();
