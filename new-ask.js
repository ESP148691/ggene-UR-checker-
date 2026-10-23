/* 83 新URの入手状況（共通部品）。トップ（段階2）と運営者ページの試用タブ（段階1）で使う。
   NewAsk.mount(listEl, { preview, onGot, onShown })
     preview:true  … 運営者の試用。/api/new-units/ask?preview=1（運営者専用：所持・回答に関係なく期間内の新URを全部）を出し、押しても登録しない
     preview:false … 本番。未所持の新URだけ。「引いた」は凸を選んで所持に登録、「引いていない」は記録
   ESP指示（10-23）：2択（引いた／引いていない）、凸は「無凸・1凸・2凸・完凸・［登録］」の1行 */
(function(){
  "use strict";
  var CSS = [
    ".newAsk .askLead{font-size:12.5px;color:var(--muted);margin:0 0 10px;line-height:1.6;}",
    ".newAsk .askCard{display:flex;gap:10px;align-items:flex-start;background:var(--panel);border:1px solid var(--gold-dim);border-radius:4px;padding:10px 12px;margin-bottom:8px;}",
    ".newAsk .askCard img{width:44px;height:44px;border-radius:4px;border:1px solid var(--line-strong);object-fit:cover;flex:none;background:var(--panel-solid);}",
    ".newAsk .askBody{flex:1;min-width:0;}",
    ".newAsk .askName{font-weight:700;font-size:14px;line-height:1.35;}",
    ".newAsk .askMeta{font-size:11.5px;color:var(--muted);margin-top:2px;}",
    ".newAsk .askBtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;}",
    ".newAsk button{font:inherit;font-size:12.5px;font-weight:700;border-radius:5px;padding:6px 10px;cursor:pointer;border:1px solid var(--line-strong);background:var(--panel-2);color:var(--text);}",
    ".newAsk button.primary{background:var(--gold);color:#1b1503;border-color:var(--gold);}",
    ".newAsk button.on{background:rgba(218,185,73,.2);border-color:var(--gold);color:var(--gold);}",
    ".newAsk button:disabled{opacity:.45;cursor:default;}",
    ".newAsk .askGot{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line-strong);}",
    ".newAsk .askRow{display:flex;align-items:center;flex-wrap:nowrap;gap:5px;}",
    ".newAsk .askRow button{flex:none;padding:6px 8px;}",
    ".newAsk .askRow .send{margin-left:auto;}",
    "@media (max-width:360px){ .newAsk .askRow{gap:4px;} .newAsk .askRow button{padding:6px 6px;} }",
    ".newAsk .askErr{color:#e79c9c;font-size:12px;margin-top:6px;}",
    ".newAsk .askDone{background:rgba(107,224,224,.08);border:1px solid var(--cyan-dim);border-radius:4px;padding:9px 12px;margin-bottom:8px;font-size:12.5px;color:var(--cyan);}",
    ".newAsk .askMore{display:block;width:100%;margin-top:2px;}",
    ".newAsk [hidden]{display:none !important;}"
  ].join("\n");
  var LV = ["無凸", "1凸", "2凸", "完凸"], SHOW = 3;   // 最初に出すのは3機まで（トップのほかの導線を押し下げすぎないため）
  function injectCss(){
    if (document.getElementById("newAskCss")) return;
    var s = document.createElement("style"); s.id = "newAskCss"; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function card(u, opt){
    var c = el("div", "askCard");
    var img = el("img"); img.src = "images/units/" + u.unitId + ".jpg"; img.alt = ""; c.appendChild(img);
    var body = el("div", "askBody"); c.appendChild(body);
    body.appendChild(el("div", "askName", u.name));
    body.appendChild(el("div", "askMeta", "実装 " + Number(u.released.slice(5, 7)) + "/" + Number(u.released.slice(8, 10)) + (u.limited ? "・期間限定" : "") + (u.type ? "・" + u.type : "")));
    var btns = el("div", "askBtns"); body.appendChild(btns);
    var bGot = el("button", "primary", "引いた"), bNo = el("button", "", "引いていない");
    [bGot, bNo].forEach(function(b){ b.type = "button"; btns.appendChild(b); });
    var got = el("div", "askGot"); got.hidden = true; body.appendChild(got);
    var row = el("div", "askRow"); got.appendChild(row);   // 無凸・1凸・2凸・完凸・［登録］の1行
    var level = null, bSend;
    var lvBtns = LV.map(function(name, i){
      var b = el("button", "", name); b.type = "button";
      b.addEventListener("click", function(){ level = i; lvBtns.forEach(function(x, j){ x.classList.toggle("on", j === i); }); bSend.disabled = false; });
      row.appendChild(b); return b;
    });
    bSend = el("button", "primary send", "登録"); bSend.type = "button"; bSend.disabled = true; row.appendChild(bSend);
    var err = el("div", "askErr"); err.hidden = true; body.appendChild(err);
    function done(answer){
      var msg = answer === "got" ? "✓ " + u.name + "を所持（" + LV[level] + "）に登録しました" : "✓ " + u.name + "：引いていないと記録しました";
      if (opt.preview) msg += "（試用のため登録していません）";
      var d = el("div", "askDone", msg); d.setAttribute("role", "status");
      c.parentNode.replaceChild(d, c);
      if (answer === "got" && opt.onGot) opt.onGot(u);
    }
    function send(answer){
      if (opt.preview) { done(answer); return; }   // 試用：送らない
      var all = [bGot, bNo, bSend].concat(lvBtns); all.forEach(function(b){ b.disabled = true; });
      err.hidden = true;
      var payload = { unitId: u.unitId, answer: answer }; if (answer === "got") payload.level = level;
      fetch("/api/new-units/answer", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(x){ if (!x.ok || !x.j || !x.j.ok) throw new Error((x.j && x.j.message) || "登録できませんでした"); done(answer); })
        .catch(function(e){
          err.textContent = (e && e.message) || "通信エラーが発生しました。時間をおいて再度お試しください"; err.hidden = false;
          [bGot, bNo].concat(lvBtns).forEach(function(b){ b.disabled = false; }); bSend.disabled = level === null;
        });
    }
    bGot.addEventListener("click", function(){ got.hidden = false; bGot.classList.add("on"); });
    bNo.addEventListener("click", function(){ send("not_pulled"); });
    bSend.addEventListener("click", function(){ if (level !== null) send("got"); });
    return c;
  }

  // 戻り値：Promise<表示した機数>（0なら何も出していない）
  function mount(list, opt){
    opt = opt || {}; injectCss(); list.textContent = "";
    return fetch("/api/new-units/ask" + (opt.preview ? "?preview=1" : ""), { credentials: "same-origin" })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.loggedIn || !d.registered || !d.units || !d.units.length) return 0;
        d.units.forEach(function(u, i){ var c = card(u, opt); if (i >= SHOW) c.hidden = true; list.appendChild(c); });
        if (d.units.length > SHOW) {
          var more = el("button", "askMore", "ほかの新URも答える（" + (d.units.length - SHOW) + "機）"); more.type = "button";
          more.addEventListener("click", function(){ Array.prototype.forEach.call(list.querySelectorAll(".askCard"), function(c){ c.hidden = false; }); more.remove(); });
          list.appendChild(more);
        }
        return d.units.length;
      })
      .catch(function(){ return 0; });
  }
  window.NewAsk = { mount: mount };
})();
