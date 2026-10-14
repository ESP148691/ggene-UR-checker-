/* favorite-form.js（68）：推し4欄（推し作品・推しユニット・推しキャラ・推し編成）の画面部品。
 * profile-card-trial.html の推し4欄の処理を動きを変えずに移したもの（66の同じユニット複数選択・n体目・枠ごとの凸、57の補充規則、2編成の同じサポーター禁止など）。
 * profile-card*.html（カード）と favorite-info.html（推し情報設定）が同じ部品を使う。内部の関数はIIFEの中に閉じ、グローバルに置くのは FavoriteForm だけ。
 * favorite-logic.js（FormationLogic・WorkLabel）を先に読むこと。
 *
 *   const form = FavoriteForm.create({ root, draft, options: { emptyMode, acqOptions }, onChange });
 *   form.setData({ api, works, characters, tags, leaderSkills });   // 各APIの応答そのまま（/api/profile-card・/api/works・/api/characters・/api/tags・/api/leader-skills。取れなかったものはnull）
 *   form.fromProfile(profile) → { favoriteWorks, favoriteUnits, favoriteCharacters, cardOptions, formations, useFm2 }
 *   form.sanitize() / form.payload() / form.renderAll() / form.ctx
 * options.emptyMode … "hide"＝選べない欄は欄ごと隠す（カード）／"hint"＝欄を出して案内とリンク（推し情報設定）
 * options.acqOptions … true＝入手記録の表示設定を出す（カード）／false＝出さない
 * draft はホストのオブジェクトをそのまま読み書きする（推し以外の項目が入っていてよい）。onChange は入力が変わるたびに呼ぶ */
(function (root) {
"use strict";

const MAX_FAV = 5;
const ERA_LABEL = { UC: "宇宙世紀", ALT: "オルタナティブ", ETC: "SD・ビルド他" };   // 2026-09-27「アナザー」から改称（略称は「オルタナ」）
const LV_LABEL = ["無凸", "1凸", "2凸", "完凸"];
const FM_SLOTS = 5, FM_LABEL_MAX = 10;
// ㉚ cardOptions：推しユニットカードに出す入手記録（acq＝入手日・ガシャ回数、memo＝メモ）。worker.jsのCARD_OPTIONS_DEFAULTと同じ既定値
const CARD_OPTIONS_DEFAULT = { acq: true, memo: false };
const emptyFormation = () => ({ label: "", supporterId: null, units: [null, null, null, null, null], pilots: [null, null, null, null, null], levels: [null, null, null, null, null] });   // pilots＝units と同じ位置の搭乗キャラ（charId）。66 levels＝枠ごとの凸（null＝ユニットチェッカーの凸）

const WorkLabel = root.WorkLabel, FormationLogic = root.FormationLogic;

const $ = id => document.getElementById(id);
  function el(tag, attrs, children){
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k in e && typeof attrs[k] !== "string") e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => c && e.appendChild(c));
    return e;
  }

const UNIT_LINK = `<a href="/unit" style="color:var(--cyan)">ユニットチェッカーを開く</a>`;

// 4欄のHTML（静的な文言だけ。ユーザー入力・DB由来の文字列は入れない）
function formHtml(acqOptions, hintMode) {
  return `
<section class="section">
  <h2>推し作品<span class="cnt" id="workCount">0 / 5</span></h2>
  <div class="picked" id="pickedWorks"></div>
  <div class="pickTabs" id="workTabs" role="tablist">
    <button type="button" data-era="UC">宇宙世紀</button>
    <button type="button" data-era="ALT">オルタナティブ</button>
    <button type="button" data-era="ETC">SD・ビルド・その他</button>
  </div>
  <div class="pickList" id="workList"></div>
  <p class="hint">タップで追加・もう一度タップで解除。最大5作品まで選べます。</p>
</section>

<section class="section">
  <h2>推しユニット<span class="cnt" id="unitCount">0 / 5</span></h2>
  <div class="picked" id="pickedUnits"></div>
  <div class="seg" id="unitSrcTabs" role="group" aria-label="ユニットの選び方" style="margin:0 0 10px" hidden>
    <button type="button" data-src="ur">URから選ぶ</button>
    <button type="button" data-src="ssr">SSRから選ぶ</button>
  </div>
  <div id="ssrPicker" hidden>
    <div class="filterRow"><input type="search" id="ssrSearch" placeholder="機体名で検索" aria-label="機体名で検索" autocomplete="off"></div>
    <div class="filterRow">
      <select id="ssrTypeFilter" aria-label="タイプで絞り込み">
        <option value="">タイプ：すべて</option>
        <option value="攻撃">攻撃</option><option value="支援">支援</option><option value="耐久">耐久</option>
      </select>
      <select id="ssrWorkFilter" aria-label="作品で絞り込み"><option value="">作品：すべて</option></select>
    </div>
    <div class="pickList" id="ssrList"></div>
    <p class="hint">SSRは所持の確認なしで選べます（同じ名前でタイプ違いの機体は別々に表示します）。URと合わせて最大5機まで。『標準』『推しユニット』のカードに表示されます。</p>
  </div>
  <div id="unitPicker">
    <div class="filterRow">
      <select id="unitTypeFilter" aria-label="タイプで絞り込み">
        <option value="">タイプ：すべて</option>
        <option value="攻撃">攻撃</option><option value="支援">支援</option><option value="耐久">耐久</option>
      </select>
      <select id="unitWorkFilter" aria-label="作品で絞り込み"><option value="">作品：すべて</option></select>
    </div>
    <div class="pickList" id="unitList"></div>
    <p class="hint">登録済みの所持URユニットから最大5機まで選べます。『標準』『推しユニット』のカードに表示されます。</p>${acqOptions ? `
    <!-- ㉚ 入手記録（ユニットチェッカーの📝）をカードに出すかどうか。メモは本人用に書かれることが多いため既定では出さない -->
    <div class="acqOpts" id="acqOpts">
      <div class="fieldLabel">『推しユニット』カードに表示する入手記録</div>
      <label class="chk"><input type="checkbox" id="optAcq"> 入手日・ガシャ回数</label>
      <label class="chk"><input type="checkbox" id="optMemo"> メモ</label>
      <p class="hint">入手記録はユニットチェッカーで『データ登録』した内容です。メモもカード画像に載るため、公開してよい内容か確認してください。各ユニットの実装日は常に表示します（入手日が実装日と同じ日のときは入手日を省きます）。</p>
    </div>` : ""}
  </div>
  <p class="hint" id="unitEmptyHint" hidden>URユニット所持率チェッカーで所持データを登録すると選べます。${hintMode ? UNIT_LINK : ""}</p>
</section>

<section class="section" id="charSection" hidden>
  <h2>推しキャラ<span class="cnt" id="charCount">0 / 5</span></h2>
  <div class="picked" id="pickedChars"></div>
  <div id="charPicker">
    <div class="filterRow">
      <select id="charTypeFilter" aria-label="タイプで絞り込み">
        <option value="">タイプ：すべて</option>
        <option value="攻撃">攻撃</option><option value="支援">支援</option><option value="耐久">耐久</option>
      </select>
      <select id="charWorkFilter" aria-label="作品で絞り込み"><option value="">作品：すべて</option></select>
    </div>
    <div class="pickList" id="charList"></div>
    <p class="hint">最大5人まで選べます。『推しキャラ』のカードに表示されます。所持しているURユニットがセットのキャラと、イベント配布キャラから選べます。ユニットを未所持にすると、そのキャラも推しキャラから外れます。</p>
  </div>
  ${hintMode
    ? `<p class="hint" id="charEmptyHint" hidden>URユニット所持率チェッカーで所持データを登録すると選べます。${UNIT_LINK}</p>
  <p class="hint" id="charLoadError" hidden>読み込みに失敗しました。時間をおいて再度お試しください。</p>`
    : `<p class="hint" id="charEmptyHint" hidden>URユニットを登録すると、セットのキャラを推しキャラに選べます。${UNIT_LINK}</p>`}
</section>

<section class="section" id="formationSection" hidden>
  <h2>推し編成</h2>
  <div id="fmBody">
    <label class="chk fmUse2"><input type="checkbox" id="fmUse2"> 2つ目の編成を使う</label>
    <div class="seg" id="fmTabs" role="group" aria-label="編成の切り替え" style="margin:0 0 12px">
      <button type="button" data-fm="0">編成1</button>
      <button type="button" data-fm="1">編成2</button>
    </div>
    <div class="field">
      <label class="fieldLabel" for="fmLabel">編成名（10文字まで・空でもOK）</label>
      <input type="text" id="fmLabel" maxlength="10" autocomplete="off">
    </div>
    <div class="field">
      <label class="fieldLabel" for="fmSupporter">推しサポーター</label>
      <select id="fmSupporter"></select>
    </div>
    <div class="fmInfo" id="fmSupInfo"></div>
    <div class="fieldLabel">ユニット（位置どおりにカードへ並びます。途中を空けてもOK）</div>
    <div id="fmSlots"></div>
    <label class="chk"><input type="checkbox" id="fmOnlyHit"> 候補をバフ対象のユニットだけにする</label>
    <div class="fmGauge" id="fmGauge"></div>
    <p class="hint">サポーターのリーダースキルの対象になるユニットがカードで金色に光ります。同じユニットを複数所持している場合は、同じユニットを何枠でも選べます（2つの編成をまたいでも可）。凸は枠ごとに、ユニットチェッカーで登録した凸まで選べます。2つの編成で同じサポーターは使えません。『推し編成』のカードに表示されます。</p>
  </div>
  <div class="hint" id="fmEmptyHint" hidden></div>
</section>`;
}
const PILOT_MODAL_HTML = `
<div class="box">
  <h3 id="pilotTitle">乗せ替え</h3>
  <p class="msg" id="pilotMsg" hidden></p>
  <div class="row"><button type="button" id="pilotReset">セットのキャラに戻す</button><button type="button" id="pilotClose">閉じる</button></div>
  <div class="pickList" id="pilotList"></div>
</div>`;

function create(cfg) {
  const host = cfg.root, draft = cfg.draft;
  const opts = Object.assign({ emptyMode: "hide", acqOptions: false }, cfg.options || {});
  const hintMode = opts.emptyMode === "hint";
  const $ = id => document.getElementById(id);

  // ---- 状態 ----
  let api = null;           // GET /api/profile-card の応答
  let works = [];           // GET /api/works
  const worksById = new Map();
  const unitsById = new Map();  // unitId -> {unitId,name,type,limited,workId}
  const CHARS = new Map();  // 56 GET /api/characters：charId -> {charId,name,setUnitId,type,workId}（char_id昇順）。空なら推しキャラ・乗せ替えは無効
  let fmIx = null;          // 51 FormationLogic.buildIndex()の結果。/api/tags・/api/leader-skillsが取れなければnull（推し編成は無効）
  let fmTab = 0;            // 編成フォームで開いているタブ（0／1）
  let currentEra = "UC";
  // ㊻ SSR（ssr-units.js の window.SSR_UNITS）。空なら「SSRから選ぶ」は出さない。推しユニットのdraftは UR＝整数・SSR＝{s: id}（送信形式と同じ）
  const ssrById = new Map((root.SSR_UNITS || []).map(u => [u.id, u]));
  let unitSrc = "ur";       // 推しユニット欄の「URから選ぶ／SSRから選ぶ」
  const isSsr = v => !!v && typeof v === "object" && Number.isInteger(v.s);
  const ssrNorm = s => String(s || "").normalize("NFKC").replace(/Ζ/g, "Z").toLowerCase();   // ㉚の表記ルール（Ζ→Z・全角括弧→半角）で検索語と名前を比べる

  function onChange() { if (cfg.onChange) cfg.onChange(); }

  // ---- 選べるかどうか ----
  function unitsAvailable(){ return !!(api && api.units && api.units.registered && api.units.owned > 0); }
  function supportersAvailable(){ return ownedSupporterList().length > 0; }
  function formationAvailable(){ return !!fmIx && unitsAvailable() && supportersAvailable(); }
  function charsAvailable(){ return CHARS.size > 0; }
  function charactersAvailable(){ return charsAvailable() && unitsAvailable() && selectableChars().setIds.length > 0; }
  function ownedUnitIds(){ return new Set(Object.keys((api && api.units && api.units.ownership) || {}).map(Number)); }
  // ---- 56 キャラ ----
  // 選べるキャラ（worker.jsのloadSelectableCharacters()と同じ判定）：イベント配布キャラ全員＋所持しているユニットがセットのキャラ
  function selectableChars(){
    const own = ownedUnitIds(), sel = { all: new Set(), setByUnit: new Map(), setIds: [], eventIds: [] };
    for (const c of CHARS.values()) {
      if (c.setUnitId == null) { sel.all.add(c.charId); sel.eventIds.push(c.charId); }
      else if (own.has(c.setUnitId)) { sel.all.add(c.charId); sel.setByUnit.set(c.setUnitId, c.charId); sel.setIds.push(c.charId); }
    }
    return sel;
  }
  function charUnit(c){ return c.setUnitId == null ? null : unitsById.get(c.setUnitId) || null; }
  function charType(c){ const u = charUnit(c); return u ? u.type : (c.type || ""); }
  function charWorkId(c){ const u = charUnit(c); return u ? u.workId : (c.workId == null ? null : c.workId); }
  function charSubText(c){ const u = charUnit(c); return u ? `セット：${u.name}` : ""; }
  function activeFormations(){ return draft.useFm2 ? draft.formations : [draft.formations[0]]; }
  // 搭乗キャラの補充規則（worker.jsのnormalizePilots()と同じ順番・規則。変えるときは両方そろえる）
  // 66 編成に入っているユニットのセットキャラは後回し（worker.jsのnormalizePilots()と同じ）
  function reservedChars(sel){
    const r = new Set();
    for (const f of activeFormations()) for (const id of f.units) { const own = id == null ? null : sel.setByUnit.get(id); if (own != null) r.add(own); }
    return r;
  }
  function firstUnusedChar(sel, used){
    const reserved = reservedChars(sel);
    return sel.setIds.find(c => !used.has(c) && !reserved.has(c)) ?? sel.eventIds.find(c => !used.has(c)) ?? sel.setIds.find(c => !used.has(c)) ?? null;
  }
  function normalizeDraftPilots(){
    if (!charsAvailable()) { for (const f of draft.formations) f.pilots = f.units.map(() => null); return; }
    const sel = selectableChars(), used = new Set();
    for (const f of activeFormations()) {
      f.units.forEach((unitId, i) => {
        if (unitId == null) { f.pilots[i] = null; return; }
        const req = f.pilots[i];
        let pilot = null;
        if (Number.isInteger(req) && sel.all.has(req) && !used.has(req)) pilot = req;
        else {
          const own = sel.setByUnit.get(unitId);
          pilot = own != null && !used.has(own) ? own : firstUnusedChar(sel, used);
        }
        if (pilot != null) used.add(pilot);
        f.pilots[i] = pilot;
      });
    }
  }
  // slot(f,i)以外で搭乗中のキャラ → 位置
  function pilotHolders(f, i){
    const m = new Map();
    activeFormations().forEach((g, gi) => g.pilots.forEach((cid, j) => { if (cid != null && !(g === f && j === i)) m.set(cid, { gi, j }); }));
    return m;
  }
  // ユニットを選んだ・外したときの搭乗キャラ。セットのキャラが他の枠で搭乗中なら { own, holder } を返す（乗せ替えの選択画面を開く用）
  function onUnitChanged(f, i){
    f.levels[i] = null;   // 66 ユニットを変えたら凸はユニットチェッカーの値に戻す
    if (!charsAvailable()) return null;
    f.pilots[i] = null;
    if (f.units[i] == null) return null;
    const sel = selectableChars(), holders = pilotHolders(f, i), own = sel.setByUnit.get(f.units[i]);
    if (own != null && !holders.has(own)) { f.pilots[i] = own; return null; }
    f.pilots[i] = firstUnusedChar(sel, new Set(holders.keys()));
    if (own == null) return null;
    // 66 セットのキャラが同じユニットの別の枠（2体目以降）に搭乗中なら、選択画面は開かずに補充規則のまま（乗せ替えボタンで変えられる）
    const h = holders.get(own);
    if (activeFormations()[h.gi].units[h.j] === f.units[i]) return null;
    return { own, holder: h };
  }
  // 66 同じユニットの何体目か（編成1の1枠目→…→編成2の最後の枠の順）。1体目なら1
  function unitOrdinal(f, i){
    let n = 0;
    for (const g of activeFormations()) for (let j = 0; j < g.units.length; j++) {
      if (g.units[j] === f.units[i]) n++;
      if (g === f && j === i) return n;
    }
    return n;
  }
  function assignPilot(f, i, cid){
    const holder = pilotHolders(f, i).get(cid);
    if (holder) draft.formations[holder.gi].pilots[holder.j] = f.pilots[i];   // 搭乗中のキャラを選ぶと入れ替え
    f.pilots[i] = cid;
  }
  // 入力値の正規化（サーバーと同じ条件で、存在しない・選べない値を落とす）。推し4項目だけ
  function sanitize() {
    const owned = ownedUnitIds();
    draft.favoriteWorks = [...new Set(draft.favoriteWorks)].filter(id => worksById.has(id)).slice(0, MAX_FAV);
    const seenFav = new Set();
    draft.favoriteUnits = (Array.isArray(draft.favoriteUnits) ? draft.favoriteUnits : []).filter(v => {
      const key = isSsr(v) ? "s" + v.s : Number.isInteger(v) ? "u" + v : null;
      if (key == null || seenFav.has(key) || !(isSsr(v) ? ssrById.has(v.s) : owned.has(v))) return false;
      seenFav.add(key); return true;
    }).slice(0, MAX_FAV);
    sanitizeFormations(owned);
    const selOk = charsAvailable() ? selectableChars().all : new Set();
    draft.favoriteCharacters = [...new Set(Array.isArray(draft.favoriteCharacters) ? draft.favoriteCharacters : [])].filter(id => selOk.has(id)).slice(0, MAX_FAV);
  }
  // 51 所持していないサポーター・ユニットを外し、2つの編成の重複サポーターは後ろを落とす。slotは詰めない
  // 66 ユニットの重複は許す（同じユニットの複数所持）。枠ごとの凸levelsは登録の凸より低い0〜3かnull（worker.jsのvalidFormationLevel()と同じ）
  function fmValidLevel(v, unitId){
    const own = ((api && api.units && api.units.ownership) || {})[String(unitId)];
    const cap = Number.isInteger(own) ? Math.min(own, 3) : 3;
    return Number.isInteger(v) && v >= 0 && v < cap ? v : null;
  }
  function sanitizeFormations(owned){
    const supOwned = new Set(ownedSupporterList().map(s => s.id));
    if (!Array.isArray(draft.formations)) draft.formations = [];
    draft.formations = [0, 1].map(i => {
      const f = draft.formations[i] && typeof draft.formations[i] === "object" ? draft.formations[i] : {};
      const units = Array.isArray(f.units) ? f.units.slice(0, FM_SLOTS) : [];
      while (units.length < FM_SLOTS) units.push(null);
      const rawPilots = Array.isArray(f.pilots) ? f.pilots : [], rawLevels = Array.isArray(f.levels) ? f.levels : [];
      const okUnit = id => Number.isInteger(id) && owned.has(id);
      return { label: String(f.label || "").slice(0, FM_LABEL_MAX),
               supporterId: Number.isInteger(f.supporterId) && supOwned.has(f.supporterId) ? f.supporterId : null,
               units: units.map(id => okUnit(id) ? id : null),
               pilots: units.map((id, i) => okUnit(id) && Number.isInteger(rawPilots[i]) ? rawPilots[i] : null),
               levels: units.map((id, i) => okUnit(id) ? fmValidLevel(rawLevels[i], id) : null) };
    });
    const [a, b] = draft.formations;
    if (b.supporterId != null && b.supporterId === a.supporterId) b.supporterId = null;
    draft.useFm2 = !!draft.useFm2;
    normalizeDraftPilots();
  }
  function fromProfile(p) {
    const bySlot = arr => (arr || []).slice().sort((a, b) => a.slot - b.slot);
    return {
      favoriteWorks: bySlot(p.favoriteWorks).map(f => f.workId),
      favoriteUnits: bySlot(p.favoriteUnits).map(f => f.rarityCode === 2 ? { s: f.unitId } : f.unitId),   // ㊻ rarityCode 2＝SSR
      favoriteCharacters: bySlot(p.favoriteCharacters).map(f => f.charId),
      cardOptions: Object.assign({}, CARD_OPTIONS_DEFAULT, p.cardOptions || {}),
      formations: [0, 1].map(i => {
        const f = (p.formations || [])[i], out = emptyFormation();
        if (f) {
          out.label = f.label || ""; out.supporterId = f.supporterId == null ? null : f.supporterId;
          for (const u of f.units || []) if (u.slot >= 1 && u.slot <= FM_SLOTS) {
            out.units[u.slot - 1] = u.unitId; out.pilots[u.slot - 1] = u.pilotCharId == null ? null : u.pilotCharId;
            out.levels[u.slot - 1] = Number.isInteger(u.level) ? u.level : null;   // 66
          }
        }
        return out;
      }),
      useFm2: (p.formations || []).length > 1
    };
  }
  // 51 保存・未保存判定に使う編成（使わない2つ目と、空の編成は除く。サーバーも空の編成は保存しない）
  function formationsPayload(){
    const act = draft.useFm2 ? draft.formations : [draft.formations[0]];
    return act.map(f => Object.assign({ label: f.label.trim() || null, supporterId: f.supporterId, units: f.units.slice(),
        levels: f.levels.map((lv, i) => f.units[i] == null ? null : lv) },   // 66 枠ごとの凸
        charsAvailable() ? { pilots: f.pilots.slice() } : {}))
      .filter(f => f.supporterId != null || f.units.some(id => id != null));
  }
  // 保存する推し4項目（キーは /api/profile・/api/favorite-info と同じ。favoriteCharactersは選べるときだけ）
  function payload() {
    return Object.assign({ favoriteWorks: draft.favoriteWorks.slice(), favoriteUnits: draft.favoriteUnits.map(v => isSsr(v) ? { s: v.s } : v), formations: formationsPayload() },
      charsAvailable() ? { favoriteCharacters: draft.favoriteCharacters.slice() } : {});
  }

  // ---- カード用データ・索引 ----
  // 51 推し編成・タグ傾向のカード用データ。fmIxが無ければ空（推し編成のバフ対象判定とタグ表示だけ無効）
  function ownedSupporterList(){
    const own = (api && api.supporters && api.supporters.ownership) || {};
    return ((api && api.supporters && api.supporters.master) || []).filter(s => own[String(s.id)] !== undefined && fmIx && fmIx.rules.has(s.id));
  }
  function fmWorkLabel(id){ const w = worksById.get(id); return WorkLabel.workLabel(id, w ? w.shortName : ""); }
  function fmUnitObj(id){
    const u = unitsById.get(id); if (!u) return null;
    return { unitId: u.unitId, name: u.name, type: u.type, limited: u.limited,
             workShort: (worksById.get(u.workId) || {}).shortName || "", workId: u.workId };
  }
  function fmFormationData(f){
    const own = (api.units && api.units.ownership) || {}, sOwn = (api.supporters && api.supporters.ownership) || {};
    const unitById = new Map(), supporterById = new Map();
    for (const id of f.units) if (id != null && !unitById.has(id)) { const o = fmUnitObj(id); if (o) unitById.set(id, o); }
    for (const s of (api.supporters && api.supporters.master) || []) supporterById.set(s.id, { id: s.id, name: s.name, limited: s.limited, heal: s.skill });
    const units = [];
    f.units.forEach((id, i) => { if (id != null) units.push({ slot: i + 1, unitId: id, level: f.levels[i] }); });   // 66 枠ごとの凸
    const F = FormationLogic.formationData(fmIx, { label: f.label.trim() || null, supporterId: f.supporterId, units },
      unitById, supporterById, { supporters: sOwn, units: own }, fmWorkLabel, fmWorkLabel, ownedUnitIds());
    // 56 搭乗キャラ（推しキャラならfav＝星バッジ）
    if (F && charsAvailable()) F.units.forEach((u, i) => {
      const c = u && f.pilots[i] != null ? CHARS.get(f.pilots[i]) : null;
      if (c) u.pilot = { charId: c.charId, name: c.name, fav: draft.favoriteCharacters.includes(c.charId) };
    });
    return F;
  }
  // 56 推しキャラカード用のキャラ（セットのユニットの凸はカードに出さない）
  function cardChar(id){
    const c = CHARS.get(id); if (!c) return null;
    const u = charUnit(c), own = (api.units && api.units.ownership) || {}, wid = charWorkId(c);
    return { charId: c.charId, name: c.name, type: charType(c), workId: wid, workShort: (worksById.get(wid) || {}).shortName || "",
             unit: u ? { unitId: u.unitId, name: u.name, type: u.type, limited: u.limited, level: own[String(u.unitId)] || 0,
                         workShort: (worksById.get(u.workId) || {}).shortName || "", workId: u.workId } : null };
  }
  function fmCardFormations(){
    if (!fmIx) return [];
    const act = draft.useFm2 ? draft.formations : [draft.formations[0]];
    return act.filter(f => f.supporterId != null).map(fmFormationData).filter(Boolean).slice(0, 2);
  }

  // ---- 画面の描画 ----
  // 選択済みリスト（推し作品・推しユニット共通）
  function renderPicked(container, ids, makeBody, onMove, onRemove){
    container.textContent = "";
    if (!ids.length) { container.appendChild(el("div", { class: "empty", text: "まだ選ばれていません" })); return; }
    ids.forEach((id, i) => {
      const up = el("button", { type: "button", text: "▲", "aria-label": "上へ" }); up.disabled = i === 0;
      const down = el("button", { type: "button", text: "▼", "aria-label": "下へ" }); down.disabled = i === ids.length - 1;
      const rm = el("button", { type: "button", text: "×", "aria-label": "解除" });
      up.addEventListener("click", () => onMove(i, -1));
      down.addEventListener("click", () => onMove(i, 1));
      rm.addEventListener("click", () => onRemove(i));
      container.appendChild(el("div", { class: "pickedRow" }, [
        el("span", { class: "no", text: String(i + 1).padStart(2, "0") }),
        ...makeBody(id),
        el("span", { class: "ops" }, [up, down, rm])
      ]));
    });
  }
  function moveIn(arr, i, d){ const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

  // 73 ロゴ画像が無い作品（SQLで足したばかり等）は、画像の代わりに短縮名の文字を出す
  function workLogoImg(id, cls){
    const img = el("img", { class: cls, src: `images/series/${id}.png`, alt: "", loading: "lazy" });
    img.addEventListener("error", () => {
      const w = worksById.get(id);
      img.replaceWith(el("span", { class: cls + " logoText", text: (w && w.shortName) || WorkLabel.shortName(id) }));
    }, { once: true });
    return img;
  }

  function renderWorks(){
    $("workCount").textContent = `${draft.favoriteWorks.length} / ${MAX_FAV}`;
    renderPicked($("pickedWorks"), draft.favoriteWorks, id => {
      const w = worksById.get(id);
      return [workLogoImg(id, "logo"), el("span", { class: "nm" }, [
        document.createTextNode(w.shortName),
        el("small", {}, [el("span", { class: "eraChip " + w.era, text: ERA_LABEL[w.era] }), document.createTextNode(w.timeline || "")])
      ])];
    }, (i, d) => { moveIn(draft.favoriteWorks, i, d); renderWorks(); onChange(); },
       i => { draft.favoriteWorks.splice(i, 1); renderWorks(); onChange(); });

    document.querySelectorAll("#workTabs button").forEach(b => {
      b.classList.toggle("active", b.dataset.era === currentEra);
      b.setAttribute("aria-selected", b.dataset.era === currentEra ? "true" : "false");
    });
    const list = $("workList"), keepScroll = list.scrollTop;
    list.textContent = "";
    const full = draft.favoriteWorks.length >= MAX_FAV;
    let lastUniverse = null;
    for (const w of works) {
      if (w.era !== currentEra) continue;
      if (w.universe !== lastUniverse) { list.appendChild(el("div", { class: "pickHead", text: w.universe })); lastUniverse = w.universe; }
      const sel = draft.favoriteWorks.includes(w.workId);
      const b = el("button", { type: "button", class: "pickItem" + (sel ? " sel" : ""), "data-work": String(w.workId),
                               "aria-pressed": sel ? "true" : "false" }, [
        workLogoImg(w.workId, "logo"),
        el("span", { class: "nm" }, [document.createTextNode(w.name), el("small", { text: w.timeline || "" })]),
        el("span", { class: "mark", text: sel ? "✓" : "" })
      ]);
      b.disabled = full && !sel;
      b.addEventListener("click", () => {
        const k = draft.favoriteWorks.indexOf(w.workId);
        if (k >= 0) draft.favoriteWorks.splice(k, 1);
        else if (draft.favoriteWorks.length < MAX_FAV) draft.favoriteWorks.push(w.workId);
        renderWorks(); onChange();
      });
      list.appendChild(b);
    }
    list.scrollTop = keepScroll;
  }

  function renderUnits(){
    const own = (api.units && api.units.ownership) || {};
    const ownedIds = Object.keys(own).map(Number).filter(id => unitsById.has(id)).sort((a, b) => a - b);
    // ㊻ SSRのデータ（ssr-units.js）があるときだけ「URから選ぶ／SSRから選ぶ」を出す。所持URが無ければSSRのみ
    const ssrOn = ssrById.size > 0, hasUr = ownedIds.length > 0;
    const src = ssrOn && (unitSrc === "ssr" || !hasUr) ? "ssr" : "ur";
    $("unitSrcTabs").hidden = !ssrOn;
    document.querySelectorAll("#unitSrcTabs button").forEach(b => {
      b.classList.toggle("active", b.dataset.src === src);
      b.setAttribute("aria-pressed", b.dataset.src === src ? "true" : "false");
      if (b.dataset.src === "ur") b.disabled = !hasUr;
    });
    $("ssrPicker").hidden = src !== "ssr";
    $("unitPicker").hidden = src !== "ur" || !hasUr;
    $("unitEmptyHint").hidden = src !== "ur" || hasUr;
    $("unitCount").textContent = `${draft.favoriteUnits.length} / ${MAX_FAV}`;
    renderPicked($("pickedUnits"), draft.favoriteUnits, v => {
      if (isSsr(v)) {
        const s = ssrById.get(v.s);
        return [el("img", { class: "thumb", src: `images/ssr/${v.s}.jpg`, alt: "", loading: "lazy" }),
                el("span", { class: "nm" }, [document.createTextNode(s.name), el("small", {}, [el("span", { class: "ssrBadge", text: "SSR" }), document.createTextNode(s.type)])])];
      }
      const u = unitsById.get(v);
      return [el("img", { class: "thumb", src: `images/units/${v}.jpg`, alt: "", loading: "lazy" }),
              el("span", { class: "nm" }, [document.createTextNode(u.name), el("small", { text: `${u.type}・${LV_LABEL[own[String(v)]] || ""}` })])];
    }, (i, d) => { moveIn(draft.favoriteUnits, i, d); renderUnits(); onChange(); },
       i => { draft.favoriteUnits.splice(i, 1); renderUnits(); onChange(); });
    if (src === "ssr") renderSsrList();

    // 作品の絞り込み候補は所持ユニットのある作品だけ（作品の並び順）
    const wf = $("unitWorkFilter"), keep = wf.value;
    const workIds = new Set(ownedIds.map(id => unitsById.get(id).workId));
    wf.textContent = "";
    wf.appendChild(el("option", { value: "", text: "作品：すべて" }));
    for (const w of works) if (workIds.has(w.workId)) wf.appendChild(el("option", { value: String(w.workId), text: w.shortName }));
    wf.value = workIds.has(Number(keep)) ? keep : "";

    const type = $("unitTypeFilter").value, work = Number(wf.value) || null;
    const list = $("unitList"), keepScroll = list.scrollTop;
    list.textContent = "";
    const full = draft.favoriteUnits.length >= MAX_FAV;
    let shown = 0;
    for (const id of ownedIds) {
      const u = unitsById.get(id);
      if (type && u.type !== type) continue;
      if (work && u.workId !== work) continue;
      const sel = draft.favoriteUnits.includes(id);
      const b = el("button", { type: "button", class: "pickItem" + (sel ? " sel" : ""), "data-unit": String(id),
                               "aria-pressed": sel ? "true" : "false" }, [
        el("img", { class: "thumb", src: `images/units/${id}.jpg`, alt: "", loading: "lazy" }),
        el("span", { class: "nm" }, [document.createTextNode(u.name),
          el("small", { text: `${u.type}・${LV_LABEL[own[String(id)]] || ""}・${(worksById.get(u.workId) || {}).shortName || ""}` })]),
        el("span", { class: "mark", text: sel ? "✓" : "" })
      ]);
      b.disabled = full && !sel;
      b.addEventListener("click", () => {
        const k = draft.favoriteUnits.indexOf(id);
        if (k >= 0) draft.favoriteUnits.splice(k, 1);
        else if (draft.favoriteUnits.length < MAX_FAV) draft.favoriteUnits.push(id);
        renderUnits(); onChange();
      });
      list.appendChild(b); shown++;
    }
    if (!shown && ownedIds.length) list.appendChild(el("div", { class: "stateMsg", text: "条件に一致するユニットがありません" }));
    list.scrollTop = keepScroll;
  }

  // ㊻ SSR候補（所持の確認なし。約330機あるので、タイプ・作品の絞り込みか名前検索があるときだけ並べる）
  function renderSsrList(){
    const wf = $("ssrWorkFilter"), keep = wf.value;
    if (!wf.dataset.built) {
      const workIds = new Set([...ssrById.values()].map(s => s.workId));
      for (const w of works) if (workIds.has(w.workId)) wf.appendChild(el("option", { value: String(w.workId), text: w.shortName }));
      wf.dataset.built = "1"; wf.value = keep;
    }
    const q = ssrNorm($("ssrSearch").value.trim()), type = $("ssrTypeFilter").value, work = Number(wf.value) || null;
    const list = $("ssrList"), keepScroll = list.scrollTop;
    list.textContent = "";
    if (!q && !type && !work) { list.appendChild(el("div", { class: "stateMsg", text: "タイプ・作品で絞り込むか、機体名で検索すると候補が表示されます" })); return; }
    const full = draft.favoriteUnits.length >= MAX_FAV;
    let shown = 0;
    for (const s of ssrById.values()) {
      if (type && s.type !== type) continue;
      if (work && s.workId !== work) continue;
      if (q && !ssrNorm(s.name).includes(q)) continue;
      const k = draft.favoriteUnits.findIndex(v => isSsr(v) && v.s === s.id), sel = k >= 0;
      const b = el("button", { type: "button", class: "pickItem" + (sel ? " sel" : ""), "data-ssr": String(s.id), "aria-pressed": sel ? "true" : "false" }, [
        el("img", { class: "thumb", src: `images/ssr/${s.id}.jpg`, alt: "", loading: "lazy" }),
        el("span", { class: "nm" }, [document.createTextNode(s.name),
          el("small", {}, [el("span", { class: "ssrBadge", text: "SSR" }), document.createTextNode(`${s.type}・${(worksById.get(s.workId) || {}).shortName || ""}`)])]),
        el("span", { class: "mark", text: sel ? "✓" : "" })
      ]);
      b.disabled = full && !sel;
      b.addEventListener("click", () => {
        const j = draft.favoriteUnits.findIndex(v => isSsr(v) && v.s === s.id);
        if (j >= 0) draft.favoriteUnits.splice(j, 1);
        else if (draft.favoriteUnits.length < MAX_FAV) draft.favoriteUnits.push({ s: s.id });
        renderUnits(); onChange();
      });
      list.appendChild(b); shown++;
    }
    if (!shown) list.appendChild(el("div", { class: "stateMsg", text: "条件に一致するSSRがありません" }));
    list.scrollTop = keepScroll;
  }

  // ---- 56 推しキャラ欄・乗せ替え ----
  function charFace(id, cls){
    const c = CHARS.get(id), img = el("img", { class: cls + " cface", src: `images/characters/${id}.jpg`, alt: "", loading: "lazy" });
    img.addEventListener("error", () => img.replaceWith(el("span", { class: cls + " cface noimg", text: c ? [...c.name][0] : "?" })));
    return img;
  }
  function charSub(c){
    const u = charUnit(c);
    return u ? el("small", { text: `${u.type}・${charSubText(c)}` }) : el("small", {}, [el("span", { class: "evBadge", text: "イベント配布" }), document.createTextNode(c.type || "")]);
  }
  // 候補1件（推しキャラ欄・乗せ替えの選択画面で共用）
  function charPickItem(c, opts){
    const b = el("button", { type: "button", class: "pickItem" + (opts.sel ? " sel" : ""), "data-char": String(c.charId), "aria-pressed": opts.sel ? "true" : "false" }, [
      charFace(c.charId, "thumb"),
      el("span", { class: "nm" }, [document.createTextNode(c.name), charSub(c), opts.note ? el("small", { text: opts.note }) : null]),
      el("span", { class: "mark", text: opts.sel ? "✓" : "" })
    ]);
    b.disabled = !!opts.disabled;
    b.addEventListener("click", opts.onClick);
    return b;
  }
  function renderChars(){
    const sec = $("charSection");
    if (hintMode) {
      // 欄を出したまま、キャラのデータが取れなかったときは候補の代わりに案内を出す
      const ok = charsAvailable();
      sec.hidden = false;
      $("pickedChars").hidden = !ok; $("charPicker").hidden = !ok; $("charLoadError").hidden = ok;
      if (!ok) { $("charEmptyHint").hidden = true; $("charCount").textContent = `0 / ${MAX_FAV}`; return; }
    } else {
      sec.hidden = !charsAvailable();
      if (sec.hidden) return;
    }
    const sel = selectableChars(), ids = [...sel.all];
    $("charEmptyHint").hidden = sel.setIds.length > 0;
    $("charCount").textContent = `${draft.favoriteCharacters.length} / ${MAX_FAV}`;
    const afterChange = () => { renderChars(); renderFormation(); onChange(); };
    renderPicked($("pickedChars"), draft.favoriteCharacters, id => {
      const c = CHARS.get(id);
      return [charFace(id, "thumb"), el("span", { class: "nm" }, [document.createTextNode(c.name), charSub(c)])];
    }, (i, d) => { moveIn(draft.favoriteCharacters, i, d); afterChange(); },
       i => { draft.favoriteCharacters.splice(i, 1); afterChange(); });
    // 作品の絞り込み候補は候補のキャラがいる作品だけ＋「イベント配布」
    const wf = $("charWorkFilter"), keep = wf.value;
    const workIds = new Set(ids.map(id => CHARS.get(id)).filter(c => c.setUnitId != null).map(charWorkId));
    wf.textContent = "";
    wf.appendChild(el("option", { value: "", text: "作品：すべて" }));
    wf.appendChild(el("option", { value: "event", text: "イベント配布" }));
    for (const w of works) if (workIds.has(w.workId)) wf.appendChild(el("option", { value: String(w.workId), text: w.shortName }));
    wf.value = keep === "event" || workIds.has(Number(keep)) ? keep : "";
    const type = $("charTypeFilter").value, work = wf.value;
    const list = $("charList"), keepScroll = list.scrollTop;
    list.textContent = "";
    const full = draft.favoriteCharacters.length >= MAX_FAV;
    let shown = 0;
    for (const id of ids) {
      const c = CHARS.get(id);
      if (type && charType(c) !== type) continue;
      if (work === "event" ? c.setUnitId != null : (work && charWorkId(c) !== Number(work))) continue;
      const on = draft.favoriteCharacters.includes(id);
      list.appendChild(charPickItem(c, { sel: on, disabled: full && !on, onClick: () => {
        const k = draft.favoriteCharacters.indexOf(id);
        if (k >= 0) draft.favoriteCharacters.splice(k, 1);
        else if (draft.favoriteCharacters.length < MAX_FAV) draft.favoriteCharacters.push(id);
        afterChange();
      } }));
      shown++;
    }
    if (!shown) list.appendChild(el("div", { class: "stateMsg", text: "条件に一致するキャラがいません" }));
    list.scrollTop = keepScroll;
  }
  // 乗せ替えの選択画面。閉じたときの搭乗キャラは、開く前に補充規則で決めてある値のまま
  let pilotTarget = null;
  function openPilotPicker(f, i, message){
    pilotTarget = { f, i };
    const sel = selectableChars(), holders = pilotHolders(f, i), own = sel.setByUnit.get(f.units[i]);
    const fi = draft.formations.indexOf(f) + 1;
    $("pilotTitle").textContent = `乗せ替え（編成${fi}の${String(i + 1).padStart(2, "0")}）`;
    $("pilotMsg").textContent = message || ""; $("pilotMsg").hidden = !message;
    $("pilotReset").disabled = own == null;
    const list = $("pilotList"); list.textContent = "";
    for (const id of sel.all) {
      const c = CHARS.get(id), h = holders.get(id);
      list.appendChild(charPickItem(c, { sel: f.pilots[i] === id, note: h ? `搭乗中：編成${h.gi + 1}の${String(h.j + 1).padStart(2, "0")}（選ぶと入れ替え）` : "",
        onClick: () => pilotChosen(id) }));
    }
    $("pilotModal").classList.add("show");
  }
  function pilotChosen(cid){
    if (!pilotTarget) return;
    assignPilot(pilotTarget.f, pilotTarget.i, cid);
    closePilotPicker();
  }
  function closePilotPicker(){ pilotTarget = null; $("pilotModal").classList.remove("show"); renderFormation(); onChange(); }

  // ---- 51 推し編成フォーム ----
  function fmSupporterLevel(id){ const o = (api.supporters && api.supporters.ownership) || {}; return o[String(id)] == null ? 0 : o[String(id)]; }
  function fmJudge(supporterId, unitId){
    return supporterId == null || !fmIx ? null : FormationLogic.judge(fmIx, supporterId, fmSupporterLevel(supporterId), unitId, fmWorkLabel);
  }
  // 推し情報設定：欄は常に出し、選べないときは理由の案内とチェッカーへのリンクに置き換える
  function hintLine(text, href, label){
    return el("div", {}, [document.createTextNode(text + " "), el("a", { href, text: label, style: "color:var(--cyan)" })]);
  }
  function renderFormationHint(){
    const ok = formationAvailable(), box = $("fmEmptyHint");
    $("formationSection").hidden = false;
    $("fmBody").hidden = !ok; box.hidden = ok;
    if (ok) return;
    box.textContent = "";
    if (!fmIx) { box.textContent = "読み込みに失敗しました。時間をおいて再度お試しください。"; return; }
    if (!unitsAvailable()) box.appendChild(hintLine("URユニット所持率チェッカーで所持データを登録すると選べます。", "/unit", "ユニットチェッカーを開く"));
    if (!supportersAvailable()) box.appendChild(hintLine("URサポート所持率チェッカーで所持データを登録すると選べます。", "/supporter.html", "サポートチェッカーを開く"));
  }
  function renderFormation(){
    const sec = $("formationSection");
    if (hintMode) {
      renderFormationHint();
      if (!formationAvailable()) return;
    } else {
      sec.hidden = !(fmIx && unitsAvailable() && supportersAvailable());
      if (sec.hidden) return;
    }
    if (!draft.useFm2 && fmTab === 1) fmTab = 0;
    const f = draft.formations[fmTab], other = draft.formations[1 - fmTab];
    const own = (api.units && api.units.ownership) || {};
    $("fmUse2").checked = draft.useFm2;
    $("fmTabs").hidden = !draft.useFm2;
    document.querySelectorAll("#fmTabs button").forEach(b => {
      const on = Number(b.dataset.fm) === fmTab;
      b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if ($("fmLabel") !== document.activeElement) $("fmLabel").value = f.label;
    // サポーター（もう一方の編成で使用中のものは選べない）
    const sel = $("fmSupporter"); sel.textContent = "";
    sel.appendChild(el("option", { value: "", text: "未選択" }));
    for (const s of ownedSupporterList()) {
      const o = el("option", { value: String(s.id), text: `${s.name}（${LV_LABEL[fmSupporterLevel(s.id)]}）` });
      if (other.supporterId === s.id && draft.useFm2) { o.disabled = true; o.text += " ※もう一方の編成で使用中"; }
      sel.appendChild(o);
    }
    sel.value = f.supporterId == null ? "" : String(f.supporterId);
    // リーダースキルの説明と対象ユニット数
    const info = $("fmSupInfo"); info.textContent = "";
    if (f.supporterId != null) {
      const lv = fmSupporterLevel(f.supporterId);
      const rules = FormationLogic.ruleView(fmIx, f.supporterId, fmWorkLabel);
      for (const r of rules) {
        const names = r.items.map(it => (it.kind === "work" ? "シリーズ " : "") + it.label).join("・");
        info.appendChild(el("div", {}, [document.createTextNode("リーダースキル："),
          el("b", { text: (r.extra ? "＋" : "") + names }), document.createTextNode(` ${FormationLogic.rateText(r.rates, lv)}`)]));
      }
      const tc = FormationLogic.targetCount(fmIx, f.supporterId, ownedUnitIds());
      info.appendChild(el("div", { text: `対象のURユニット ${tc.total}機中 所持${tc.owned}機` }));
    } else {
      info.textContent = "サポーターを選ぶと、リーダースキルの対象になるユニットが分かります。";
    }
    // ユニット5枠（位置どおり。途中を空けてよい）
    const onlyHit = $("fmOnlyHit").checked && f.supporterId != null;
    const slots = $("fmSlots"); slots.textContent = "";
    const ids = Object.keys(own).map(Number).filter(id => unitsById.has(id)).sort((a, b) => a - b);
    f.units.forEach((cur, i) => {
      const s = el("select", { "aria-label": `ユニット${i + 1}` });
      s.appendChild(el("option", { value: "", text: "（空き枠）" }));
      for (const id of ids) {
        const hit = fmJudge(f.supporterId, id);
        if (onlyHit && !hit && id !== cur) continue;
        const u = unitsById.get(id);
        s.appendChild(el("option", { value: String(id), text: `${hit ? "◎対象 " + hit.rateText + "｜" : ""}${u.name}（${u.type}・${LV_LABEL[own[String(id)]] || ""}）` }));   // 66 選択中のユニットも選べる
      }
      s.value = cur == null ? "" : String(cur);
      s.addEventListener("change", () => {
        f.units[i] = s.value === "" ? null : Number(s.value);
        const conflict = onUnitChanged(f, i);
        renderFormation(); onChange();
        if (conflict) {
          const c = CHARS.get(conflict.own);
          openPilotPicker(f, i, `${c.name}は編成${conflict.holder.gi + 1}の${String(conflict.holder.j + 1).padStart(2, "0")}に搭乗中です。乗せるキャラを選んでください`);
        }
      });
      // 66 枠ごとの凸（既定＝ユニットチェッカーの凸）と「n体目」
      let lvSel = null, dup = null;
      if (cur != null) {
        // 登録の凸が上限：先頭「{登録の凸}（登録）」＋登録より低い凸だけ。登録が無凸なら選べない
        const reg = Number.isInteger(own[String(cur)]) ? own[String(cur)] : 0;
        lvSel = el("select", { "aria-label": `ユニット${i + 1}の凸` });
        lvSel.appendChild(el("option", { value: "", text: `${LV_LABEL[reg]}（登録）` }));
        for (let lv = 0; lv < reg; lv++) lvSel.appendChild(el("option", { value: String(lv), text: LV_LABEL[lv] }));
        lvSel.disabled = reg === 0;
        lvSel.value = f.levels[i] == null ? "" : String(f.levels[i]);
        lvSel.addEventListener("change", () => { f.levels[i] = lvSel.value === "" ? null : Number(lvSel.value); onChange(); });
        const n = unitOrdinal(f, i);
        if (n > 1) dup = el("span", { class: "dup", text: `${n}体目` });
      }
      slots.appendChild(el("div", { class: "fmSlot" }, [el("span", { class: "no", text: String(i + 1).padStart(2, "0") }), s]));
      if (lvSel) slots.appendChild(el("div", { class: "fmOpt" }, [el("span", { text: "凸" }), lvSel, dup]));
      if (charsAvailable() && cur != null) {
        const pid = f.pilots[i], pc = pid == null ? null : CHARS.get(pid), fav = pc && draft.favoriteCharacters.includes(pid);
        const btn = el("button", { type: "button", text: "乗せ替え" });
        btn.addEventListener("click", () => openPilotPicker(f, i, ""));
        slots.appendChild(el("div", { class: "fmPilot" }, [
          pc ? charFace(pid, "thumb") : null,
          el("span", { class: "pn" + (fav ? " fav" : ""), text: pc ? `搭乗：${fav ? "★ " : ""}${pc.name}` : "搭乗キャラなし" }),
          btn
        ]));
      }
    });
    // バフ対象のゲージ
    const g = $("fmGauge"); g.textContent = "";
    const filled = f.units.filter(id => id != null);
    const cnt = f.supporterId == null ? 0 : filled.filter(id => fmJudge(f.supporterId, id)).length;
    const bar = el("span", { class: "bar" + (filled.length && cnt === filled.length ? " full" : "") });
    for (let i = 0; i < filled.length; i++) bar.appendChild(el("i", { class: i < cnt ? "on" : "" }));
    g.appendChild(el("span", { text: "バフ対象" }));
    g.appendChild(el("b", { text: `${cnt}/${filled.length}` }));
    g.appendChild(bar);
  }
  function renderAcqOpts(){ if (!opts.acqOptions) return; $("optAcq").checked = !!draft.cardOptions.acq; $("optMemo").checked = !!draft.cardOptions.memo; }
  function renderAll() {
    renderWorks(); renderUnits(); renderChars(); renderFormation(); renderAcqOpts();
  }

  // ---- 入力イベント ----
  function bind() {
    $("workTabs").addEventListener("click", e => {
      const b = e.target.closest("button[data-era]"); if (!b) return;
      currentEra = b.dataset.era; $("workList").scrollTop = 0; renderWorks();
    });
    $("unitTypeFilter").addEventListener("change", () => { $("unitList").scrollTop = 0; renderUnits(); });
    $("unitWorkFilter").addEventListener("change", () => { $("unitList").scrollTop = 0; renderUnits(); });
    $("unitSrcTabs").addEventListener("click", e => {
      const b = e.target.closest("button[data-src]"); if (!b || b.disabled) return;
      unitSrc = b.dataset.src; renderUnits();
    });
    $("ssrSearch").addEventListener("input", () => { $("ssrList").scrollTop = 0; renderSsrList(); });
    $("ssrTypeFilter").addEventListener("change", () => { $("ssrList").scrollTop = 0; renderSsrList(); });
    $("ssrWorkFilter").addEventListener("change", () => { $("ssrList").scrollTop = 0; renderSsrList(); });
    $("charTypeFilter").addEventListener("change", () => { $("charList").scrollTop = 0; renderChars(); });
    $("charWorkFilter").addEventListener("change", () => { $("charList").scrollTop = 0; renderChars(); });
    $("fmTabs").addEventListener("click", e => {
      const b = e.target.closest("button[data-fm]"); if (!b) return;
      fmTab = Number(b.dataset.fm); renderFormation();
    });
    $("fmUse2").addEventListener("change", () => { draft.useFm2 = $("fmUse2").checked; if (!draft.useFm2) fmTab = 0; sanitize(); renderFormation(); onChange(); });
    $("fmLabel").addEventListener("input", () => { draft.formations[fmTab].label = $("fmLabel").value.slice(0, FM_LABEL_MAX); onChange(); });
    $("fmOnlyHit").addEventListener("change", renderFormation);
    $("fmSupporter").addEventListener("change", () => {
      const f = draft.formations[fmTab]; f.supporterId = $("fmSupporter").value === "" ? null : Number($("fmSupporter").value);
      sanitize(); renderFormation(); onChange();
    });
    if (opts.acqOptions) {
      $("optAcq").addEventListener("change", () => { draft.cardOptions = Object.assign({}, draft.cardOptions, { acq: $("optAcq").checked }); onChange(); });
      $("optMemo").addEventListener("change", () => { draft.cardOptions = Object.assign({}, draft.cardOptions, { memo: $("optMemo").checked }); onChange(); });
    }
    $("pilotClose").addEventListener("click", closePilotPicker);
    $("pilotReset").addEventListener("click", () => { if (pilotTarget) pilotChosen(selectableChars().setByUnit.get(pilotTarget.f.units[pilotTarget.i])); });
    $("pilotModal").addEventListener("click", e => { if (e.target === $("pilotModal")) closePilotPicker(); });
  }

  // APIの応答からworksById・unitsById・CHARS・fmIxを作る
  function setData(d) {
    api = d.api;
    works = (d.works && d.works.works) || [];
    WorkLabel.setWorks(works);   // 73 通称・まとめをD1の値に（無ければ組み込みの予備）
    worksById.clear(); unitsById.clear(); CHARS.clear(); fmIx = null;
    for (const w of works) {
      worksById.set(w.workId, w);
      for (const u of w.units || []) unitsById.set(u.unitId, Object.assign({ workId: w.workId }, u));
    }
    for (const c of (d.characters && d.characters.characters) || []) CHARS.set(c.charId, c);
    // 51・52 バフ対象の判定とタグ傾向の索引（両APIにデータがあるときだけ有効）
    if (d.tags && d.leaderSkills && (d.tags.tags || []).length && (d.leaderSkills.rules || []).length) {
      const unitWork = new Map(); for (const [id, u] of unitsById) unitWork.set(id, u.workId);
      fmIx = FormationLogic.buildIndex(d.leaderSkills, d.tags, unitWork);
    }
  }

  // ---- 組み立て ----
  host.innerHTML = formHtml(opts.acqOptions, hintMode);
  const modal = document.createElement("div");
  modal.className = "pilotModal"; modal.id = "pilotModal";
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "pilotTitle");
  modal.innerHTML = PILOT_MODAL_HTML;
  document.body.appendChild(modal);
  bind();

  return {
    setData, fromProfile, sanitize, payload, renderAll,
    ctx: {
      worksById, unitsById, ssrById, chars: CHARS,
      get fmIx() { return fmIx; },
      available: { units: unitsAvailable, supporters: supportersAvailable, formation: formationAvailable, chars: charsAvailable, characters: charactersAvailable },
      ownedUnitIds, ownedSupporterList, selectableChars, fmFormationData, fmCardFormations, cardChar, workLabel: fmWorkLabel
    }
  };
}

root.FavoriteForm = { create, MAX_FAV, FM_SLOTS, FM_LABEL_MAX, CARD_OPTIONS_DEFAULT, emptyFormation };
})(typeof window !== "undefined" ? window : globalThis);
