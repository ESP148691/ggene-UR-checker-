/* 83 新ユニット所持率調査（共通部品）。トップ（段階2）と運営者ページの試用タブ（段階1）で使う。
   NewAsk.mount(listEl, { preview, onChanged }) → Promise<出したか（true/false）>
     対象：実装30日以内のURを全部。今の所持状況（所持＝今の凸／未所持＝引いていない）を選んだ状態で出す
     利用者は変わったところだけ直して［登録］を1回押す。変化がなければそのまま押して完了
     所持済みのURは凸を上げる方向にだけ変えられる（下の凸と「引いていない」は押せない）
     preview:true … 運営者の試用。押しても登録しない
   ESP指示（10-23 23:37） */
(function(){
  "use strict";
  var CSS = [
    ".newAsk .askLead{font-size:12.5px;color:var(--muted);margin:0 0 10px;line-height:1.6;}",
    ".newAsk .askUnit{background:var(--panel);border:1px solid var(--gold-dim);border-radius:4px;padding:10px 12px;margin-bottom:8px;}",
    ".newAsk .askHead{display:flex;gap:10px;align-items:center;}",
    ".newAsk .askHead img{width:40px;height:40px;border-radius:4px;border:1px solid var(--line-strong);object-fit:cover;flex:none;background:var(--panel-solid);}",
    ".newAsk .askName{font-weight:700;font-size:14px;line-height:1.35;}",
    ".newAsk .askMeta{font-size:11.5px;color:var(--muted);margin-top:1px;}",
    ".newAsk .askOpts{display:flex;flex-wrap:nowrap;gap:5px;margin-top:8px;}",
    ".newAsk button{font:inherit;font-size:12.5px;font-weight:700;border-radius:5px;padding:6px 8px;cursor:pointer;border:1px solid var(--line-strong);background:var(--panel-2);color:var(--text);}",
    ".newAsk .askOpts button{flex:1 1 auto;min-width:0;padding:6px 4px;white-space:nowrap;}",
    ".newAsk .askOpts button.on{background:rgba(218,185,73,.2);border-color:var(--gold);color:var(--gold);}",
    ".newAsk .askOpts button.chg{box-shadow:0 0 0 1px var(--gold) inset;}",
    ".newAsk button:disabled{opacity:.35;cursor:default;}",
    ".newAsk .askFoot{display:flex;align-items:center;gap:10px;margin-top:4px;}",
    ".newAsk .askFoot .cnt{font-size:12px;color:var(--muted);flex:1;}",
    ".newAsk .askFoot .send{background:var(--gold);color:#1b1503;border-color:var(--gold);padding:8px 22px;font-size:13.5px;}",
    "@media (max-width:360px){ .newAsk .askOpts{gap:4px;} .newAsk .askOpts button{font-size:12px;padding:6px 2px;} }",
    ".newAsk .askErr{color:#e79c9c;font-size:12px;margin-top:6px;}",
    ".newAsk .askDone{background:rgba(107,224,224,.08);border:1px solid var(--cyan-dim);border-radius:4px;padding:10px 12px;font-size:13px;color:var(--cyan);}",
    ".newAsk [hidden]{display:none !important;}"
  ].join("\n");
  var OPTS = [ { label: "引いていない", level: null }, { label: "無凸", level: 0 }, { label: "1凸", level: 1 }, { label: "2凸", level: 2 }, { label: "完凸", level: 3 } ];
  function injectCss(){
    if (document.getElementById("newAskCss")) return;
    var s = document.createElement("style"); s.id = "newAskCss"; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function md(d){ return Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10)); }

  function render(list, units, opt){
    var sel = {}, cur = {};   // unitId → 選んだ凸（null＝引いていない）／今の凸（null＝未所持）
    var foot = el("div", "askFoot"), cnt = el("span", "cnt"), send = el("button", "send", "登録"), err = el("div", "askErr");
    send.type = "button"; err.hidden = true;
    function changedCount(){ return units.filter(function(u){ return sel[u.unitId] !== cur[u.unitId]; }).length; }
    function refresh(){ var n = changedCount(); cnt.textContent = n ? "変更 " + n + "機" : "変更なし（そのまま登録できます）"; }
    units.forEach(function(u){
      cur[u.unitId] = u.level === null || u.level === undefined ? null : u.level;
      sel[u.unitId] = cur[u.unitId];
      var box = el("div", "askUnit");
      var head = el("div", "askHead"); box.appendChild(head);
      var img = el("img"); img.src = "images/units/" + u.unitId + ".jpg"; img.alt = ""; head.appendChild(img);
      var t = el("div"); head.appendChild(t);
      t.appendChild(el("div", "askName", u.name));
      t.appendChild(el("div", "askMeta", "実装 " + md(u.released) + (u.limited ? "・期間限定" : "") + (u.type ? "・" + u.type : "")));
      var row = el("div", "askOpts"); row.setAttribute("role", "radiogroup"); row.setAttribute("aria-label", u.name + "の所持状況"); box.appendChild(row);
      var btns = OPTS.map(function(o){
        var b = el("button", "", o.label); b.type = "button"; b.setAttribute("role", "radio");
        var c = cur[u.unitId];
        if (c !== null && (o.level === null || o.level < c)) b.disabled = true;   // 所持済みは下げられない
        b.addEventListener("click", function(){ sel[u.unitId] = o.level; paint(); refresh(); });
        row.appendChild(b); return { b: b, level: o.level };
      });
      function paint(){
        btns.forEach(function(x){
          var on = x.level === sel[u.unitId];
          x.b.classList.toggle("on", on); x.b.setAttribute("aria-checked", on ? "true" : "false");
          x.b.classList.toggle("chg", on && sel[u.unitId] !== cur[u.unitId]);
        });
      }
      paint();
      list.appendChild(box);
    });
    foot.appendChild(cnt); foot.appendChild(send); list.appendChild(foot); list.appendChild(err);
    refresh();
    function finish(changed){
      var msg = "✓ 登録しました（" + (changed ? "変更 " + changed + "機" : "変更なし") + "）。ご協力ありがとうございます";
      if (opt.preview) msg += "（試用のため登録していません）";
      list.textContent = ""; var d = el("div", "askDone", msg); d.setAttribute("role", "status"); list.appendChild(d);
      if (changed && opt.onChanged) opt.onChanged();
    }
    send.addEventListener("click", function(){
      var changed = changedCount();
      if (opt.preview) { finish(changed); return; }   // 試用：送らない
      send.disabled = true; err.hidden = true;
      var items = units.map(function(u){ var v = sel[u.unitId]; return v === null ? { unitId: u.unitId, answer: "not_pulled" } : { unitId: u.unitId, answer: "got", level: v }; });
      fetch("/api/new-units/survey", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items }) })
        .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(x){ if (!x.ok || !x.j || !x.j.ok) throw new Error((x.j && x.j.message) || "登録できませんでした"); finish(x.j.changed); })
        .catch(function(e){ err.textContent = (e && e.message) || "通信エラーが発生しました。時間をおいて再度お試しください"; err.hidden = false; send.disabled = false; });
    });
  }

  function mount(list, opt){
    opt = opt || {}; injectCss(); list.textContent = "";
    return fetch("/api/new-units/ask" + (opt.preview ? "?preview=1" : ""), { credentials: "same-origin" })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.loggedIn || !d.registered || !d.due || !d.units || !d.units.length) return false;
        render(list, d.units, opt); return true;
      })
      .catch(function(){ return false; });
  }
  window.NewAsk = { mount: mount };
})();
