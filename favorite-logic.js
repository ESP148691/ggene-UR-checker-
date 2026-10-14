/* favorite-logic.js（68）：推し編成の判定ロジック（FormationLogic）と作品名の通称（WorkLabel）。
 * favorite-form.js・profile-card*.html が読む。FormationLogicの中身は profile-card-trial.html の2つ目の<script>から変えずに移した */
/* 51・52 推し編成のバフ対象判定とタグ傾向の計算（参考実装。profile-card.html の画面側に移植する想定）
 * 入力はどれも既存／新設APIの応答そのまま：
 *   leader  = GET /api/leader-skills  → { rules:[{supporterId,ruleNo,rates:[lv0,lv1,lv2,lv3]}], targets:[{supporterId,ruleNo,condNo,kind:'tag'|'work',id}] }
 *   tagsApi = GET /api/tags           → { tags:[{tagId,name,...}], unitTags:[{rarityCode,unitId,tagId}] }
 *   unitWork= Map(unitId → workId)    → GET /api/works から（画面は既に unitsById で持っている）
 *   workLabel(workId) → カードに出す作品名（短縮名。収まらなければ WORK_NICK の通称）
 * 判定の規則（51 4.4）：ルール内の条件(condNo)はすべて満たす（AND）、条件内の候補はどれか1つ（OR）。
 *   該当ルールのうち、サポーターの凸での上昇率が一番高い1つをそのユニットの結果にする（効果は重複しない）。
 *   凸の値が null のルールは完凸(lv3)の値で比べ、表示は「+lv0〜lv3%」。
 * UR以外（rarityCode≠1）は今回は判定しない（SSRは㊻の再開後に unitTags の rarityCode=2 を足すだけで動く形）。
 */
(function (root) {
  "use strict";
  const RARITY_UR = 1;
  const TAG_SHORT = { "阿頼耶識システム": "阿頼耶識", "モビル・トレース・システム": "MTS" };   // 結果チップ用の短い表記（73 予備。正本はD1のtags_master.short_name）

  function buildIndex(leader, tagsApi, unitWork) {
    const tagName = new Map((tagsApi.tags || []).map(t => [t.tagId, t.name]));
    const tagShort = new Map((tagsApi.tags || []).filter(t => t.shortName).map(t => [t.name, t.shortName]));   // 73 D1（tags_master.short_name）。無ければTAG_SHORT
    const unitTagIds = new Map();                       // unitId → Set(tagId)（URだけ）
    for (const r of tagsApi.unitTags || []) {
      if (r.rarityCode !== RARITY_UR || !tagName.has(r.tagId)) continue;
      if (!unitTagIds.has(r.unitId)) unitTagIds.set(r.unitId, new Set());
      unitTagIds.get(r.unitId).add(r.tagId);
    }
    const freq = new Map();                             // tagId → そのタグを持つURの数
    for (const set of unitTagIds.values()) for (const t of set) freq.set(t, (freq.get(t) || 0) + 1);
    const rules = new Map();                            // supporterId → [{ruleNo, rates, conds: Map(condNo → [{kind,id}])}]
    for (const r of leader.rules || []) {
      if (!rules.has(r.supporterId)) rules.set(r.supporterId, []);
      rules.get(r.supporterId).push({ ruleNo: r.ruleNo, rates: r.rates, conds: new Map() });
    }
    for (const t of leader.targets || []) {
      const rule = (rules.get(t.supporterId) || []).find(x => x.ruleNo === t.ruleNo);
      if (!rule) continue;
      if (!rule.conds.has(t.condNo)) rule.conds.set(t.condNo, []);
      rule.conds.get(t.condNo).push({ kind: t.kind, id: t.id });
    }
    for (const list of rules.values()) list.sort((a, b) => a.ruleNo - b.ruleNo);
    return { tagName, tagShort, unitTagIds, freq, rules, unitWork };
  }

  function rateAt(rates, lv) { const v = rates[lv]; return v == null ? null : v; }
  function rateText(rates, lv) { const v = rateAt(rates, lv); return v == null ? `+${rates[0]}〜${rates[3]}%` : `+${v}%`; }
  function hasKey(ix, unitId, c) {
    return c.kind === "tag" ? !!(ix.unitTagIds.get(unitId) && ix.unitTagIds.get(unitId).has(c.id))
                            : ix.unitWork.get(unitId) === c.id;
  }

  // ユニット1機の判定。対象外は null
  function judge(ix, supporterId, level, unitId, workLabel) {
    const list = ix.rules.get(supporterId) || [];
    let best = null;
    const comparable = r => rateAt(r.rates, level) ?? r.rates[3];
    for (const r of list) {
      const matched = [];
      let ok = r.conds.size > 0;
      for (const cands of r.conds.values()) {
        const m = cands.find(c => hasKey(ix, unitId, c));
        if (!m) { ok = false; break; }
        matched.push(m);
      }
      if (!ok) continue;
      const rate = comparable(r);
      if (best && best.rate >= rate) continue;
      best = {
        rate, rateText: rateText(r.rates, level), ruleNo: r.ruleNo,
        label: matched.map(m => m.kind === "tag" ? (ix.tagShort.get(ix.tagName.get(m.id)) || TAG_SHORT[ix.tagName.get(m.id)] || ix.tagName.get(m.id)) : workLabel(m.id)).join("＋"),
        byWork: matched.some(m => m.kind === "work"),
        tags: matched.filter(m => m.kind === "tag").map(m => ix.tagName.get(m.id))
      };
    }
    if (best && list.length > 1) best.top = best.rate === Math.max(...list.map(comparable));   // 低い方のルールに該当＝数字を白に
    return best;
  }

  // 左パネルのリーダースキル表示。2つ目以降のルールが1つ目の対象をすべて含むなら差分だけ（extra=true。「＋阿頼耶識システム」）
  function ruleView(ix, supporterId, workLabelFull) {
    const list = ix.rules.get(supporterId) || [];
    const keys = r => new Set([...r.conds.values()].flat().map(c => c.kind + ":" + c.id));
    const first = list[0] ? keys(list[0]) : new Set();
    return list.map((r, i) => {
      const k = keys(r), extra = i > 0 && [...first].every(x => k.has(x));
      const items = [], seen = new Set();
      for (const c of [...r.conds.values()].flat()) {
        if (extra && first.has(c.kind + ":" + c.id)) continue;
        const label = c.kind === "tag" ? ix.tagName.get(c.id) : workLabelFull(c.id);
        if (seen.has(label)) continue;                  // SEED ASTRAY系の6作品は1つのラベルにまとまる
        seen.add(label); items.push({ kind: c.kind, label });
      }
      return { rates: r.rates, items, extra };
    });
  }

  // 「対象のURユニット n機中 所持m機」
  function targetCount(ix, supporterId, ownedSet) {
    const all = [...ix.unitWork.keys()].filter(u => judge(ix, supporterId, 3, u, () => ""));
    return { total: all.length, owned: all.filter(u => ownedSet.has(u)).length };
  }

  // 52 案D-2：特徴タグ（URの中で付いている機体が少ない順。同じなら tagId 順）
  function featureTags(ix, unitId, n, exclude) {
    const ex = new Set(exclude || []);
    return [...(ix.unitTagIds.get(unitId) || [])]
      .sort((a, b) => ix.freq.get(a) - ix.freq.get(b) || a - b)
      .map(t => ix.tagName.get(t)).filter(name => !ex.has(name)).slice(0, n);
  }
  // 52 案D-1：編成の共通タグ（2機以上。多い順、同じなら名前順）
  function sharedTags(ix, unitIds) {
    const cnt = new Map();
    for (const u of unitIds) for (const t of ix.unitTagIds.get(u) || []) { const nm = ix.tagName.get(t); cnt.set(nm, (cnt.get(nm) || 0) + 1); }
    return [...cnt].filter(([, c]) => c >= 2).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
  // 52 案D-3：得意タグ（URが3機以上あるタグのうち、所持率の高い順。同じなら総数の多い順、さらに同じなら tagId 順）
  function tagTrend(ix, ownedSet, n) {
    const rows = [];
    for (const [t, total] of ix.freq) {
      if (total < 3) continue;
      let owned = 0;
      for (const u of ownedSet) if (ix.unitTagIds.get(u) && ix.unitTagIds.get(u).has(t)) owned++;
      rows.push({ tagId: t, name: ix.tagName.get(t), owned, total });
    }
    return rows.sort((a, b) => b.owned / b.total - a.owned / a.total || b.total - a.total || a.tagId - b.tagId).slice(0, n);
  }

  // 編成1つ分のカード用データ（slotの位置のまま。空き枠は null）
  function formationData(ix, f, unitById, supporterById, levels, workLabel, workLabelFull, ownedSet) {
    if (!f || !f.supporterId) return null;
    const lv = levels.supporters[f.supporterId] ?? 0;
    const slots = [null, null, null, null, null];
    for (const s of f.units) {
      const u = unitById.get(s.unitId); if (!u || s.slot < 1 || s.slot > 5) continue;
      const hit = judge(ix, f.supporterId, lv, s.unitId, workLabel);
      slots[s.slot - 1] = Object.assign({}, u, { level: s.level ?? levels.units[s.unitId] ?? 0, hit,   // 66 枠ごとの凸を優先
        featureTags: featureTags(ix, s.unitId, 2, hit ? hit.tags : []) });
    }
    const filled = slots.filter(Boolean), count = filled.filter(u => u.hit).length;
    const sup = supporterById.get(f.supporterId);
    return {
      label: f.label || null,
      supporter: Object.assign({}, sup, { level: lv, rules: ruleView(ix, f.supporterId, workLabelFull), targetUr: targetCount(ix, f.supporterId, ownedSet) }),
      units: slots,
      synergy: { count, total: filled.length, full: filled.length > 0 && count === filled.length },   // 描画側の既存名（synergy）のまま。表示文言は「バフ対象」
      sharedTags: sharedTags(ix, filled.map(u => u.unitId))
    };
  }

  root.FormationLogic = { buildIndex, judge, ruleView, targetCount, featureTags, sharedTags, tagTrend, formationData, rateText };
})(typeof window !== "undefined" ? window : globalThis);

/* 作品名の通称（68。CardRendererとfavorite-form.jsが共用する）。73から通称・まとめはD1（works_master.nick_name・group_label。/api/works）が正本で、
 * WorkLabel.setWorks(works) で取り込む。下の組み込みの表は、D1の列が無い（0039・0040の適用前）ときの予備（以後は更新しない）
 * ㉟ カード内で短縮名（short_name）が枠に収まらないときだけ使う通称。通称でも収まらないときは通称を「…」で省略する。フォームの一覧・Xのシェア文は従来どおり短縮名
 * 51 バフ対象の結果チップ用の作品名（通称優先。SEED ASTRAY系の作品はまとめて「SEED ASTRAY」） */
(function (root) {
  "use strict";
  const WORK_NICK = {1:"ファースト",2:"Ζ新訳",3:"ΖΖ",5:"UC",6:"NT",7:"閃ハサ",9:"Gガンダム",10:"ガンダムW",11:"W EW",12:"ガンダムX",
    13:"SEED",14:"DESTINY",17:"鉄血",28:"BLUE DESTINY",42:"Ζガンダム",46:"センチネル",48:"ライデンの帰還",60:"クロスボーン",
    61:"Vガンダム",67:"ASTRAY",75:"天空の皇女",85:"Gレコ",88:"鉄血MSV",89:"PROLOGUE",91:"GBF",94:"SD外伝",106:"Gジェネ"};   // 予備（0040で投入した値と同じ）
  const GROUP = {};                                   // workId → まとめ名（D1の group_label）
  [67, 68, 69, 70, 74, 75].forEach(id => { GROUP[id] = "SEED ASTRAY"; });   // 予備
  const SHORT = {};                                   // workId → 短縮名（ロゴが無いときの文字表示）
  let fromApi = false;
  // /api/works の応答（works配列）を渡す。nickName・groupLabel を持つ作品が1つでもあれば D1 の値で置き換える
  function setWorks(works) {
    if (!Array.isArray(works) || !works.length) return;
    for (const w of works) SHORT[w.workId] = w.shortName || w.name || "";
    if (!works.some(w => w.nickName || w.groupLabel)) return;   // 0039・0040の適用前：予備のまま
    for (const k of Object.keys(WORK_NICK)) delete WORK_NICK[k];
    for (const k of Object.keys(GROUP)) delete GROUP[k];
    for (const w of works) { if (w.nickName) WORK_NICK[w.workId] = w.nickName; if (w.groupLabel) GROUP[w.workId] = w.groupLabel; }
    fromApi = true;
  }
  function workLabel(workId, short) { return GROUP[workId] || WORK_NICK[workId] || short || SHORT[workId] || ""; }
  function shortName(workId) { return SHORT[workId] || ""; }
  root.WorkLabel = { WORK_NICK, GROUP, setWorks, workLabel, shortName, get fromApi() { return fromApi; } };
})(typeof window !== "undefined" ? window : globalThis);
