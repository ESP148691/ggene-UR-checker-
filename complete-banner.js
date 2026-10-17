/* 76 コンプリート表示（共通部品）。complete-banner.css とセットで読む。
   使い方：
     const cb = CompleteBanner.mount(document.getElementById("completeSlot"));
     // 描画のたびに呼ぶ
     cb.update({
       show,        // 出すか（例：未所持のみON かつ 範囲の未所持0件）
       scopeKey,    // 範囲の名前（タブ・シリーズなど）。同じ範囲のまま残り>0→0になったときだけ弾ける
       remaining,   // 範囲の残り件数（未所持数・未達成ミッション数）。show に関係なく毎回渡す
       kicker,      // 小見出し（英字。例 "ALL OWNED"）
       ja,          // 日本語の見出し（例 "コンプリート！"）
       subHtml,     // 件数の行（HTML。数字は <b> で虹色。呼び出し側でエスケープ済みのこと）
       stats,       // 小さな札 [[ラベル, 値], ...]
       allowBurst   // false なら弾けない（読み込み直後のDB復元で揃ったときなど。各ページは userEditedSinceLoad を渡す）
     });
   パネルは出し続けている間は作り直さない（アニメーションが途切れないよう、文字だけ差し替える）。
   弾けるときだけ作り直す */
(function (root) {
  "use strict";
  const COLORS = ["#ff2d55", "#ff8a00", "#ffe600", "#3dff6e", "#00e5ff", "#3b6bff", "#b14bff", "#ff3ec8"];
  const STARS = [[6,14],[18,70],[30,24],[44,86],[58,12],[70,64],[84,22],[93,78],[12,44],[50,48],[78,40],[36,92],[64,90],[88,52]];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function build(burst) {
    const el = document.createElement("div");
    el.className = "cp-panel" + (burst ? " burst" : "");
    el.setAttribute("role", "status");
    const stars = STARS.map(([x, y], i) =>
      `<span class="cp-star" style="left:${x}%;top:${y}%;color:${COLORS[i % 8]};animation-delay:${((i * 0.37) % 2.4).toFixed(2)}s">✦</span>`).join("");
    const parts = burst ? Array.from({ length: 28 }, (_, i) =>
      `<i style="--a:${i * (360 / 28)}deg;--d:-${70 + (i % 4) * 22}px;color:${COLORS[i % 8]};animation-delay:${(i % 3) * 0.06}s"></i>`).join("") : "";
    el.innerHTML = `
      <div class="cp-inner">
        <div class="cp-aurora"></div><div class="cp-ribbon"></div>${stars}
        <div class="cp-burst">${parts}</div>
        <div class="cp-body">
          <div class="cp-kicker"></div>
          <div class="cp-title">COMPLETE</div>
          <div class="cp-ja"></div>
          <div class="cp-sub"></div>
          <div class="cp-stats"></div>
        </div>
      </div>`;
    return el;
  }
  function fill(el, o) {
    el.querySelector(".cp-kicker").textContent = o.kicker || "";
    el.querySelector(".cp-ja").textContent = o.ja || "コンプリート！";
    el.querySelector(".cp-sub").innerHTML = o.subHtml || "";
    el.querySelector(".cp-stats").innerHTML = (o.stats || []).map(([l, v]) => `<span>${esc(l)}<b>${esc(v)}</b></span>`).join("");
  }
  function mount(slot) {
    let last = { key: null, n: -1 };
    let panel = null;
    return {
      update(o) {
        const burst = !!o.show && o.allowBurst !== false && o.remaining === 0 && last.key === o.scopeKey && last.n > 0;
        last = { key: o.scopeKey, n: o.remaining };
        if (!o.show) { if (panel) { panel.remove(); panel = null; } return false; }
        if (!panel || burst) {
          const p = build(burst);
          if (panel) panel.replaceWith(p); else slot.prepend(p);
          panel = p;
          if (burst) setTimeout(() => p.classList.remove("burst"), 1600);   // 演出が終わったら印を外す
        }
        fill(panel, o);
        return true;
      },
      get shown() { return !!panel; }
    };
  }
  root.CompleteBanner = { mount, escape: esc };
})(typeof window !== "undefined" ? window : globalThis);
