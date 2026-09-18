// 認証UI（ログイン/新規登録）共通スクリプト。unit.html / supporter.html 両方から読み込む。
// ログインは任意機能。/api/me が失敗・エラーになってもゲスト状態として扱い、
// チェッカー本体（凸レベル記録・所持率計算・画像生成）には一切影響させない。
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const authbar = document.createElement("div");
  authbar.className = "authbar";
  // ヘッダー（.wrap）の先頭に差し込み、スクロールに追従しない通常フローの要素として表示する
  const headerAnchor = document.querySelector(".wrap");
  if (headerAnchor) {
    headerAnchor.insertBefore(authbar, headerAnchor.firstChild);
  } else {
    document.body.insertBefore(authbar, document.body.firstChild);
  }

  const modal = document.createElement("div");
  modal.className = "authModal";
  modal.id = "authModal";
  modal.innerHTML = `
    <div class="box">
      <div class="tabs">
        <button type="button" data-tab="login" class="active">ログイン</button>
        <button type="button" data-tab="register">新規登録</button>
      </div>
      <h2 id="authTitle">ログイン</h2>
      <p class="hint">登録すると自己紹介カードの保存・端末をまたいだデータ引き継ぎが利用できます（任意機能。未登録でもチェッカーは今まで通り使えます）。</p>
      <form id="authForm">
        <input type="text" id="authUsername" placeholder="ユーザー名（英数字・_、3〜20文字）" autocomplete="username" required>
        <input type="password" id="authPassword" placeholder="パスワード（6文字以上）" autocomplete="current-password" required style="margin-top:8px;">
        <div class="err" id="authErr"></div>
        <div class="row">
          <button type="button" class="btn-cancel" id="authCancel">閉じる</button>
          <button type="submit" class="btn-submit" id="authSubmit">ログイン</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const form = document.getElementById("authForm");
  const errEl = document.getElementById("authErr");
  const titleEl = document.getElementById("authTitle");
  const submitBtn = document.getElementById("authSubmit");
  const usernameInput = document.getElementById("authUsername");
  const passwordInput = document.getElementById("authPassword");
  const tabs = modal.querySelectorAll(".tabs button");
  let mode = "login";

  function setMode(m) {
    mode = m;
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === m));
    titleEl.textContent = m === "login" ? "ログイン" : "新規登録";
    submitBtn.textContent = m === "login" ? "ログイン" : "登録する";
    passwordInput.autocomplete = m === "login" ? "current-password" : "new-password";
    errEl.textContent = "";
  }
  tabs.forEach(b => b.addEventListener("click", () => setMode(b.dataset.tab)));

  function openModal(initialMode) {
    setMode(initialMode || "login");
    errEl.textContent = "";
    form.reset();
    modal.classList.add("show");
    usernameInput.focus();
  }
  function closeModal() {
    modal.classList.remove("show");
  }

  document.getElementById("authCancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  function renderLoggedOut() {
    authbar.innerHTML = `<a href="#" class="authlink" id="authOpenLink">ログイン</a>`;
    document.getElementById("authOpenLink").addEventListener("click", (e) => {
      e.preventDefault();
      openModal("login");
    });
  }

  function renderLoggedIn(username) {
    authbar.innerHTML = `<span class="authuser">${escapeHtml(username)} さん</span><button type="button" id="authLogoutBtn">ログアウト</button>`;
    document.getElementById("authLogoutBtn").addEventListener("click", doLogout);
  }

  async function refreshAuthState() {
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      const data = await res.json();
      if (data && data.loggedIn) {
        renderLoggedIn(data.username);
      } else {
        renderLoggedOut();
      }
    } catch (e) {
      // ネットワークエラー時はゲスト状態表示にフォールバックする（チェッカー本体は無関係に動作継続）
      renderLoggedOut();
    }
  }

  async function doLogout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch (e) {
      // ログアウトAPI失敗時も表示だけはログアウト状態に戻す
    }
    refreshAuthState();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    submitBtn.disabled = true;
    try {
      const res = await fetch(mode === "login" ? "/api/login" : "/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errEl.textContent = data.message || "エラーが発生しました";
        return;
      }
      closeModal();
      // ログイン・新規登録どちらも成功後はトップページへ遷移する
      window.location.href = "/";
    } catch (e) {
      errEl.textContent = "通信エラーが発生しました。時間をおいて再度お試しください";
    } finally {
      submitBtn.disabled = false;
    }
  });

  refreshAuthState();
})();
