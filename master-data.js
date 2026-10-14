/* 73 マスターデータの読み込み（URユニット・URサポート）。unit.html・supporter.html・top.html・profile-card*.html が読む。
   D1（GET /api/units・GET /api/supporters）が正本。ur-units.js・supporter.html の const UNITS は「APIが取れないときの予備」
   （最後に確認したスナップショット）として残し、新ユニット・新サポートの追加時に更新しなくてよい。
   使い方：
     const MASTER_READY = MasterData.refreshUnits(UNITS).then(ok => { if (ok) { 件数の表示を直す; render(); updateStats(); } });
     … DB復元・スクショ読み取り・画像作成の前に await MASTER_READY;
   refreshUnits/refreshSupporters は、渡した配列の中身を API の内容に「その場で」入れ替える（const UNITS の参照はそのまま使える）。
   APIが空・失敗のときは何もしないで false を返す（予備のまま動く） */
(function (root) {
  "use strict";
  function unitFromApi(u) {
    const x = { id: u.unitId, name: u.name, limited: !!u.limited, type: u.type, imageUrl: "images/units/" + u.unitId + ".jpg" };
    if (u.released) x.released = u.released;
    if (u.wrap) x.wrap = u.wrap;
    if (u.workId != null) x.workId = u.workId;
    if (Array.isArray(u.scanFit)) x.scanFit = u.scanFit;
    return x;
  }
  function supporterFromApi(s) {
    const x = { id: s.supporterId, name: s.name, limited: !!s.limited, heal: s.skillDetail || s.skill, healGroup: s.skill,
                imageUrl: "images/supporters/" + s.supporterId + ".jpg" };
    if (Array.isArray(s.scanFit)) x.scanFit = s.scanFit;
    return x;
  }
  const memo = {};
  function getJson(url) {
    if (!memo[url]) memo[url] = fetch(url, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
    return memo[url];
  }
  async function fetchList(kind) {
    const j = await getJson(kind === "units" ? "/api/units" : "/api/supporters");
    const list = j && Array.isArray(j[kind]) ? j[kind] : null;
    if (!list || !list.length) return null;
    return list.map(kind === "units" ? unitFromApi : supporterFromApi);
  }
  async function refresh(kind, target) {
    const items = await fetchList(kind);
    if (!items) return false;
    // 0039の適用前にpushされた場合の保険：APIに無い項目（実装日・改行位置・効果の詳細）は予備の値で補う
    const fb = new Map((target || []).map(x => [x.id, x]));
    for (const x of items) {
      const f = fb.get(x.id);
      if (!f) continue;
      for (const k of ["released", "wrap", "heal"]) if (x[k] == null && f[k] != null) x[k] = f[k];
      if (kind === "supporters" && f.heal && x.heal === x.healGroup && f.healGroup === x.healGroup) x.heal = f.heal;
    }
    if (Array.isArray(target)) target.splice(0, target.length, ...items);
    return true;
  }
  root.MasterData = {
    refreshUnits: (arr) => refresh("units", arr),
    refreshSupporters: (arr) => refresh("supporters", arr),
    fetchUnits: () => fetchList("units"),
    fetchSupporters: () => fetchList("supporters"),
    unitFromApi, supporterFromApi
  };
})(typeof window !== "undefined" ? window : globalThis);
