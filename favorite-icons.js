/* 推し情報設定の4項目アイコン（トップの4ボタン・推し情報設定の入口）。開くたびに次の画像からランダムに1枚ずつ選ぶ
 *  works     ＝作品ロゴ（images/series/{workId}.png。GET /api/works）
 *  units     ＝設定できるユニット（所持URユニット＋SSR・ULT。GET /api/my-ownership・/api/units・/api/ssr-units）。未ログイン・取れなければSSR・ULTだけ
 *  chars     ＝推しキャラの顔（GET /api/characters。10001〜のSSRセットは除く）
 *  formation ＝サポーター画像の右端（GET /api/supporters。右端のキャラ側を正方形に切り抜く）
 * 取れなかった項目は空配列＝呼び出し側は絵文字のままにする */
(function (root) {
  "use strict";
  function getJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  function load() {
    return Promise.all([
      getJson("/api/works"), getJson("/api/units"), getJson("/api/ssr-units"),
      getJson("/api/my-ownership"), getJson("/api/characters"), getJson("/api/supporters")
    ]).then(function (r) {
      const works = r[0] && Array.isArray(r[0].works) ? r[0].works : [];
      const urs = r[1] && Array.isArray(r[1].units) ? r[1].units : [];
      const ssrs = r[2] && Array.isArray(r[2].ssrUnits) ? r[2].ssrUnits : [];
      const own = r[3] && r[3].loggedIn && r[3].ownership ? r[3].ownership : {};
      const chars = r[4] && Array.isArray(r[4].characters) ? r[4].characters : [];
      const sups = r[5] && Array.isArray(r[5].supporters) ? r[5].supporters : [];
      return {
        works: works.map(w => "images/series/" + w.workId + ".png"),
        units: urs.filter(u => own[String(u.unitId)] != null).map(u => "images/units/" + u.unitId + ".jpg")
          .concat(ssrs.map(s => "images/ssr/" + s.unitId + ".jpg")),
        chars: chars.filter(c => c.charId < 10000).map(c => "images/characters/" + c.charId + ".jpg"),
        formation: sups.map(s => "images/supporters/" + s.supporterId + ".jpg")
      };
    });
  }
  // el（.ic）の中身を、pools[kind]からランダムに選んだ画像に差し替える。読み込めなければ元の絵文字のまま
  function fill(el, kind, pools) {
    const list = pools && pools[kind];
    if (!el || !list || !list.length) return;
    const img = document.createElement("img");
    img.className = "favIcImg " + kind; img.alt = ""; img.setAttribute("aria-hidden", "true");
    img.onload = function () { el.textContent = ""; el.classList.add("hasImg"); el.appendChild(img); };
    img.src = list[Math.floor(Math.random() * list.length)];
  }
  root.FavoriteIcons = { load, fill };
})(window);
