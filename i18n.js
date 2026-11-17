/* 101・102 英語対応の共通部品（i18n.js）。英語対応したページだけが <head> で読む（auth.js より先）。
   ・日本語はHTMLに書いたまま。英語のときだけ辞書で差し替える（辞書に無いキーは日本語のまま＝壊れない）
   ・言語の決め方：URLの ?lang=ja|en → 端末の記憶（localStorage "site_lang"）→ 公開後はブラウザの言語（日本語以外なら英語）→ 日本語
   ・英語対応していないページはこのファイルを読まないので、常に日本語（auth.js も window.I18N が無ければ日本語）
   使い方
     HTML ：<span data-i18n="top.h1">ファンツール トップ</span>（textContent を差し替え）
            data-i18n-html="キー"（中にリンク等のタグがあるとき。辞書の値は自前の固定文字列だけにする）
            data-i18n-attr="aria-label:キー;title:キー;placeholder:キー"
            data-i18n-page="unit-list"（英語未対応ページへのリンク。英語のとき「Japanese only」を付ける。READY_PAGES にあれば付けない）
     JS   ：I18N.t("キー", { n: 3 })  … {n} を置き換える。英語の辞書に無ければ日本語（ja）、それも無ければキー
            I18N.err(data.error, data.message) … サーバーのエラーコードを英語に（日本語のときは message をそのまま）
            I18N.md("2026-11-17") … 日本語 11/17 ／英語 Nov 17
     辞書 ：I18N.add({ "キー": { ja: "…", en: "…" } })。HTMLだけで使うキーは ja を省略してよい */
(function (root) {
  "use strict";
  // ---- 設定 ----
  var PUBLIC = false;                 // 公開前は false：ブラウザの言語で自動では英語にしない（?lang=en か切り替えボタンを押した人だけ英語）
  var READY_PAGES = ["top", "unit-list"];   // 英語対応済みのページ。104（段階2）で "unit-list" を追加。段階3で "unit"、段階4で "supporter" を足す
  var KEY = "site_lang";

  function q(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }
  function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var lang = "ja";
  var p = q("lang");
  if (p === "ja" || p === "en") { lang = p; save(p); }
  else {
    var s = load();
    if (s === "ja" || s === "en") lang = s;
    else if (PUBLIC) {
      var l = (navigator.languages && navigator.languages[0]) || navigator.language || "ja";
      lang = /^ja\b/i.test(l) ? "ja" : "en";
    }
  }

  var dict = {};
  function add(d) { for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) dict[k] = d[k]; }
  function fill(s, v) { return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; }
  function t(key, v) {
    var e = dict[key];
    if (!e) return key;
    var s = (lang === "en" && e.en != null) ? e.en : (e.ja != null ? e.ja : e.en);
    return fill(s, v);
  }
  function has(key) { var e = dict[key]; return !!(e && (lang === "en" ? e.en != null : e.ja != null)); }

  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function md(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "";
    return lang === "en" ? MON[Number(m[2]) - 1] + " " + Number(m[3]) : Number(m[2]) + "/" + Number(m[3]);
  }
  function err(code, message) {
    if (lang === "en" && code && has("err." + code)) return t("err." + code);
    if (lang === "en") return t("err.generic");
    return message || t("err.generic");
  }

  // 英語のときだけ、差し替えが終わるまで本文を隠す（日本語が一瞬見えるのを防ぐ。1.5秒で必ず出す）
  var de = document.documentElement;
  de.setAttribute("lang", lang);
  if (lang === "en") {
    de.classList.add("lang-en", "i18n-pending");
    setTimeout(function () { de.classList.remove("i18n-pending"); }, 1500);
    var st = document.createElement("style");
    st.textContent = ".i18n-pending body{visibility:hidden}" +
      ".jaOnly{display:inline-block;margin-left:6px;padding:1px 6px;border:1px solid rgba(159,176,192,.45);border-radius:3px;" +
      "font:600 9.5px/1.4 'Rajdhani','Noto Sans JP',sans-serif;letter-spacing:.04em;color:#9fb0c0;vertical-align:middle;white-space:nowrap;text-transform:none}";
    (document.head || de).appendChild(st);
  }

  function apply(rootEl) {
    if (lang !== "en") return;
    var r = rootEl || document;
    r.querySelectorAll("[data-i18n]").forEach(function (el) { var k = el.getAttribute("data-i18n"); if (has(k)) el.textContent = t(k); });
    r.querySelectorAll("[data-i18n-html]").forEach(function (el) { var k = el.getAttribute("data-i18n-html"); if (has(k)) el.innerHTML = t(k); });
    r.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var i = pair.indexOf(":"); if (i < 0) return;
        var a = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
        if (has(k)) el.setAttribute(a, t(k));
      });
    });
    r.querySelectorAll("[data-i18n-page]").forEach(function (el) {
      if (READY_PAGES.indexOf(el.getAttribute("data-i18n-page")) >= 0 || el.querySelector(".jaOnly")) return;
      var slot = el.querySelector("[data-jaonly-slot]") || el;
      var b = document.createElement("span"); b.className = "jaOnly"; b.textContent = "Japanese only";
      slot.appendChild(b);
    });
    if (has("meta.title")) document.title = t("meta.title");
    var md_ = document.querySelector('meta[name="description"]'); if (md_ && has("meta.description")) md_.setAttribute("content", t("meta.description"));
  }

  // 言語の切り替え（日本語 / English）。押したら記憶して ?lang= を付け直して読み直す
  function mountSwitch(el) {
    if (!el) return;
    el.classList.add("langSwitch");
    el.innerHTML = "";
    [["ja", "日本語"], ["en", "English"]].forEach(function (x, i) {
      if (i) { var sep = document.createElement("span"); sep.className = "sep"; sep.textContent = "|"; el.appendChild(sep); }
      var b = document.createElement("button");
      b.type = "button"; b.textContent = x[1]; b.setAttribute("lang", x[0]);
      if (x[0] === lang) { b.className = "on"; b.setAttribute("aria-pressed", "true"); } else b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (x[0] === lang) return;
        save(x[0]);
        try { var u = new URL(location.href); u.searchParams.set("lang", x[0]); location.replace(u.toString()); }
        catch (e) { location.reload(); }
      });
      el.appendChild(b);
    });
  }

  function ready() {
    try { apply(document); } finally { de.classList.remove("i18n-pending"); }
    document.querySelectorAll("[data-lang-switch]").forEach(mountSwitch);
    // 公開前（切り替えが運営者だけ）でも、英語で開いた人には日本語へ戻れるよう切り替えを出す
    // 104 公開後（PUBLIC）は全員に、公開前でも英語で開いた人には切り替えを出す（TOPの運営者向け表示は top.html の data-admin-only で別に出る）
    if (lang === "en" || PUBLIC) document.querySelectorAll("[data-lang-switch]").forEach(function (el) { var bar = el.closest("[hidden]"); if (bar) bar.hidden = false; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  root.I18N = { lang: lang, isEn: lang === "en", t: t, has: has, add: add, apply: apply, md: md, err: err, mountSwitch: mountSwitch, READY_PAGES: READY_PAGES };

  // ---- 全ページ共通の辞書（ログイン画面・サーバーのエラー・サイト名） ----
  add({
    "site.name":        { ja: "Gジェネエターナル ファンツール", en: "G Generation Eternal Fan Tool" },
    "auth.login":       { ja: "ログイン", en: "Log in" },
    "auth.register":    { ja: "新規登録", en: "Sign up" },
    "auth.registerBtn": { ja: "登録する", en: "Sign up" },
    "auth.loginOrRegister": { ja: "ログイン / 新規登録", en: "Log in / Sign up" },
    "auth.hint":        { ja: "各チェッカーは新規登録・ログインしてご利用いただけます（無料・メールアドレス不要。ユーザー名とパスワードだけで登録できます）。登録したデータはサーバーに保存され、機種変更や別の端末でも引き継げます。",
                          en: "Sign up or log in to use the checkers (free, no email needed – just a username and password). Your data is saved on the server, so it carries over when you change devices." },
    "auth.username":    { ja: "ユーザー名（英数字・_、3〜20文字）", en: "Username (letters, numbers, _ / 3–20 chars)" },
    "auth.password":    { ja: "パスワード（6文字以上）", en: "Password (6+ characters)" },
    "auth.close":       { ja: "閉じる", en: "Close" },
    "auth.forgot":      { ja: "パスワードを忘れた方", en: "Forgot your password?" },
    "auth.forgotInfo":  { ja: "パスワードを忘れた場合は、運営者のXアカウント（@polarbear148691）へDMでユーザー名をお知らせください。",
                          en: "If you forgot your password, send your username by DM to the operator's X account (@polarbear148691). English or Japanese is fine." },
    "auth.backTop":     { ja: "トップに戻る", en: "Back to Top" },
    "auth.userLabel":   { ja: "{name} さん", en: "{name}" },
    "auth.logout":      { ja: "ログアウト", en: "Log out" },
    "err.generic":      { ja: "エラーが発生しました", en: "Something went wrong." },
    "err.network":      { ja: "通信エラーが発生しました。時間をおいて再度お試しください", en: "Connection error. Please try again later." },
    // worker.js が返す error（コード）→ 英語。日本語のときはサーバーの message をそのまま出す
    "err.invalid_username":    { en: "Username must be 3–20 characters using letters, numbers and underscores only." },
    "err.invalid_password":    { en: "Password must be 6–100 characters." },
    "err.username_taken":      { en: "That username is already taken." },
    "err.invalid_credentials": { en: "Incorrect username or password." },
    "err.not_logged_in":       { en: "Please log in." },
    "err.same_password":       { en: "You can't reuse your current password." },
    "err.user_not_found":      { en: "That username was not found." },
    "err.no_data":             { en: "No aggregated data yet." },
    "err.not_registered":      { en: "Please register your unit ownership data first." },
    "err.invalid_params":      { en: "Please choose a status for every unit before registering." },
    "err.cannot_lower":        { en: "You can't lower the Limit Break of a unit you already own." },
    // 104 フッター（全ページ共通。i18n-top.js にも同じキーがあり、TOPではそちらが後から上書きする）
    "foot.1": { en: "This site is an unofficial tool made personally by a fan of “SD Gundam G Generation ETERNAL.” It has no affiliation with BANDAI NAMCO Entertainment Inc., SUNRISE Inc., or any other rights holders or companies related to the game." },
    "foot.2": { en: "Copyrights and other intellectual property rights to in-game images, character names, data, etc. belong to their respective owners. All images on this site are in-game screenshots taken by the operator." },
    "foot.3": { en: "The accuracy of the data is not guaranteed, and the operator accepts no liability for any damage arising from the use of this site." },
    "foot.contact": { en: 'Contact: <a href="https://x.com/polarbear148691" target="_blank" rel="noopener">X (formerly Twitter) @polarbear148691</a> (English or Japanese)' }
  });
})(window);
