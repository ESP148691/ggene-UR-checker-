const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30日間

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  });
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const match = header.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function buildSessionCookie(token, maxAgeSeconds) {
  // Secure: Cloudflare WorkersはHTTPS配信のみのためSecure属性を付与して問題ない
  // SameSite=Lax: 自サイト内の通常ナビゲーション・fetchでは送信され、CSRFの主要経路（他サイトからの自動送信）は防げる
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

async function getSessionUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT sessions.user_uid AS user_uid, sessions.expires_at AS expires_at, users.username AS username
     FROM sessions JOIN users ON sessions.user_uid = users.user_uid
     WHERE sessions.token = ?`
  ).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { userUid: row.user_uid, username: row.username, token };
}

async function createSession(env, userUid) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_uid, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(token, userUid, now.toISOString(), expires.toISOString()).run();
  return token;
}

function isValidUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_]{3,20}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 100;
}

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  const { username, password } = body || {};
  if (!isValidUsername(username)) {
    return jsonResponse({ error: "invalid_username", message: "ユーザー名は英数字・アンダースコアのみ、3〜20文字で入力してください" }, 400);
  }
  if (!isValidPassword(password)) {
    return jsonResponse({ error: "invalid_password", message: "パスワードは6〜100文字で入力してください" }, 400);
  }

  const existing = await env.DB.prepare("SELECT user_uid FROM users WHERE username = ?").bind(username).first();
  if (existing) {
    return jsonResponse({ error: "username_taken", message: "そのユーザー名はすでに使われています" }, 409);
  }

  const userUid = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO users (user_uid, first_seen, last_seen, username, password) VALUES (?, ?, ?, ?, ?)"
  ).bind(userUid, now, now, username, password).run();

  const token = await createSession(env, userUid);
  return jsonResponse(
    { username },
    200,
    { "Set-Cookie": buildSessionCookie(token, SESSION_MAX_AGE_SECONDS) }
  );
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  const { username, password } = body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const row = await env.DB.prepare("SELECT user_uid, password FROM users WHERE username = ?").bind(username).first();
  if (!row || row.password !== password) {
    return jsonResponse({ error: "invalid_credentials", message: "ユーザー名またはパスワードが違います" }, 401);
  }

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET last_seen = ? WHERE user_uid = ?").bind(now, row.user_uid).run();

  const token = await createSession(env, row.user_uid);
  return jsonResponse(
    { username },
    200,
    { "Set-Cookie": buildSessionCookie(token, SESSION_MAX_AGE_SECONDS) }
  );
}

async function handleLogout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": buildSessionCookie("", 0) });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return jsonResponse({ loggedIn: false }, 200);
  return jsonResponse({ loggedIn: true, username: user.username }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 認証API（②ユーザー登録・ログイン機能）
    // ゲスト利用（未ログイン）には一切影響しない。既存チェッカーは今まで通り無ログインで動作する
    if (url.pathname === "/api/register" && request.method === "POST") {
      return handleRegister(request, env);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return handleLogout(request, env);
    }
    if (url.pathname === "/api/me" && request.method === "GET") {
      return handleMe(request, env);
    }

    // 所持データのログ収集エンドポイント（機体版・サポート版共通）
    // ここでの console.log は Cloudflare の Workers Logs（Observability）に記録され、
    // ダッシュボード上で検索・閲覧できる（利用者のブラウザには一切表示されない）
    if ((url.pathname === "/api/log" || url.pathname === "/api/log-supporter") && request.method === "POST") {
      try {
        const body = await request.text();
        console.log(JSON.stringify({
          type: url.pathname === "/api/log-supporter" ? "ur_supporter_ownership_log" : "ur_ownership_log",
          ts: new Date().toISOString(),
          body: body
        }));
      } catch (e) {
        console.error("log parse error", e);
      }
      return new Response("ok", { status: 200 });
    }

    // ルートURL（旧index.html含む）はトップページ（top.html）を配信する。
    // トップページ自体はログイン不要で機体版/サポート版チェッカーへ直接遷移できるため、
    // Xの固定ポスト等からの流入でもゲスト利用の導線は塞がれない。
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const assetUrl = new URL("/top.html", url);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // /unit を機体チェッカー本体（unit.html）にマッピング
    if (url.pathname === "/unit") {
      const assetUrl = new URL("/unit.html", url);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // それ以外は静的アセット（unit.html, supporter.html, images/等）をそのまま配信
    return env.ASSETS.fetch(request);
  }
};
