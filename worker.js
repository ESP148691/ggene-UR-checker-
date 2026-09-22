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

// Date（UTC内部値）を、JST（UTC+9）のウォールクロック時刻を数値として持つISO8601文字列に変換する。
// 実装: 内部時刻に9時間を加算してからtoISOString()し、末尾のZを+09:00に置き換える
// （加算後のtoISOString()の各桁はJSTの時刻と一致するため、オフセット表記だけ付け替えれば正しいJST表現になる）
// 適用対象はunits_ownership/supporters_ownershipのregistered_atのみ（⑪）。
// users/sessionsの他タイムスタンプはセッション有効期限判定等の内部比較に使われるためUTCのまま変更しない
function toJstIsoString(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().replace("Z", "+09:00");
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

// username・passwordが空文字/未指定/NULLだと弾く（3〜20文字の英数字・アンダースコアのみを要求）。
// 【重要な不変条件】usersへの行のINSERTはhandleRegister()経由（この関数を必ず通る）でのみ行われるため、
// username・passwordは常に非NULLになる。
// （旧仕様では④のゲスト所持ログ経由でusername IS NULLの行が作られていたが、2026-09-19の
// 「ゲストデータ廃止」対応でその経路自体を削除し、0003/0004マイグレーションで過去分も削除済み。
// usersテーブルは現在「登録済みアカウントのみ」を前提としている）
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

// ④ D1への所持データ保存（ログイン済みユーザーのみ。ゲスト保存は廃止・2026-09-19）
// 想定される最大件数（機体84・サポート49）より十分大きい安全マージン。不正に巨大な入力は無視する
const OWNERSHIP_LOG_MAX_ENTRIES = 300;

// マスターに実在するID範囲（= unit.html/supporter.htmlのUNITS配列の件数と一致させる）。
// units_ownership/supporters_ownershipのunit_id/supporter_idはunits_master/supporters_masterへの
// FOREIGN KEYだが、D1側でFK制約が有効化されているとは限らないため、アプリ側でも範囲チェックする。
// 新しいUR機体・サポートを追加した際は、この数値もtop.htmlのUNIT_IMAGES/SUPPORTER_IMAGESの件数・
// migrations/0002_populate_master_data.sqlの投入件数と合わせて必ず更新すること
const MAX_UNIT_ID = 84;
const MAX_SUPPORTER_ID = 49;

// "id:code,id:code,..." 形式のコンパクトログを { id, level } の配列にパースする。
// code(1=無凸,2=1凸,3=2凸,4=完凸) → level(0〜3) に変換。壊れた要素・範囲外のidは読み飛ばす
function parseCompactOwnershipLog(log, maxId) {
  if (typeof log !== "string" || !log) return [];
  const parts = log.split(",");
  if (parts.length > OWNERSHIP_LOG_MAX_ENTRIES) return [];
  const out = [];
  for (const part of parts) {
    const m = /^(\d+):([1-4])$/.exec(part.trim());
    if (!m) continue;
    const id = Number(m[1]);
    if (!Number.isInteger(id) || id < 1 || id > maxId) continue;
    out.push({ id, level: Number(m[2]) - 1 });
  }
  return out;
}

// ログイン中ユーザーのlast_seenを更新し、あわせて該当種別（ユニット/サポート）の初回データ登録日時を
// セットする。sessionUserは必ずusersテーブルの既存行（handleRegister()で作成済み）から取得されるため、
// ここで対象行が存在しないケースはない。
// ⑫ 初回登録日時はCOALESCEで一度だけセットする（2回目以降の登録では値が変化しない）。所持0件の登録でも
// この関数はentriesの件数に関わらず必ず呼ばれるため、「登録済みだが所持0」も正しくフラグが立つ
async function touchUserLastSeenAndMarkRegistered(env, userUid, isSupporter) {
  const now = new Date().toISOString(); // last_seenは⑪の対象外のままUTCを維持（既存方針を踏襲）
  const nowJst = toJstIsoString(new Date()); // 初回登録日時は⑪で導入したJST表記に統一
  const column = isSupporter ? "supporters_first_registered_at" : "units_first_registered_at";
  await env.DB.prepare(
    `UPDATE users SET last_seen = ?, ${column} = COALESCE(${column}, ?) WHERE user_uid = ?`
  ).bind(now, nowJst, userUid).run();
}

// ④ ゲスト（未ログイン）からの利用回数カウンタ。個人と紐付かない匿名の集計値として、
// チェッカーが何回使われたか程度の規模感を残す（真の利用者数ではない）
async function incrementUsageCounter(env, counterKey) {
  await env.DB.prepare(
    `INSERT INTO usage_counters (counter_key, count) VALUES (?, 1)
     ON CONFLICT(counter_key) DO UPDATE SET count = count + 1`
  ).bind(counterKey).run();
}

// 所持データは履歴を積み上げず「最新状態のスナップショット」として保持する。
// 送信の都度、そのuser_uidの既存行を削除してから現在の所持状態を入れ直す
// （バッチ処理のため、Workerからのラウンドトリップは1回で済む）
async function replaceOwnership(env, table, idColumn, userUid, entries) {
  const now = toJstIsoString(new Date()); // ⑪ 表示用のregistered_atはJST表記で保存する
  const statements = [
    env.DB.prepare(`DELETE FROM ${table} WHERE user_uid = ?`).bind(userUid)
  ];
  for (const entry of entries) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO ${table} (registered_at, user_uid, ${idColumn}, level) VALUES (?, ?, ?, ?)`
      ).bind(now, userUid, entry.id, entry.level)
    );
  }
  await env.DB.batch(statements);
}

// 所持データのログ収集エンドポイント（機体版・サポート版共通）
// ④ 所持データの保存対象はログイン済みユーザーのみとする（ゲストデータは保存しない・2026-09-19）。
// 理由：ゲストの識別子はlocalStorage単位でしか発行できず「人」と一致しないため、分析ページの母数・
// 所持率を歪める。ゲストの利用実績は個人と紐付かない匿名カウンタ（usage_counters）にのみ残す
async function handleOwnershipLog(request, env, isSupporter) {
  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  // ここで例外が起きてもチェッカー本体（画像生成・プレビュー・シェア）は常に成功させる
  let sessionUser = null;
  try {
    sessionUser = await getSessionUser(request, env);
    if (sessionUser && body) {
      const entries = parseCompactOwnershipLog(body.log, isSupporter ? MAX_SUPPORTER_ID : MAX_UNIT_ID);
      await touchUserLastSeenAndMarkRegistered(env, sessionUser.userUid, isSupporter);
      await replaceOwnership(
        env,
        isSupporter ? "supporters_ownership" : "units_ownership",
        isSupporter ? "supporter_id" : "unit_id",
        sessionUser.userUid,
        entries
      );
    } else if (!sessionUser) {
      await incrementUsageCounter(env, isSupporter ? "supporter_guest" : "unit_guest");
    }
  } catch (e) {
    console.error("ownership d1 write error", e);
  }

  // ⑪「データ登録」ボタンが結果をユーザーに明示できるよう、ログイン状態をJSONで返す
  // （btnSave/btnShareは従来通りレスポンス本文を読まないため影響なし）
  return jsonResponse({ ok: true, loggedIn: !!sessionUser }, 200);
}

// ④ 所持データの分析（全体所持率ランキング）API。ログイン済みユーザーのみ利用可能。
// ⑫ 母数（totalUsers）は「該当種別（ユニット/サポート）でデータ登録済みのユーザー」に限定する
// （usersテーブル全件だと、一度もチェッカーで登録していないアカウントまで母数に含まれ所持率が
// 実態より低く出てしまうため）。分子（owned_count）は元々ownershipテーブルの行数＝登録済み
// ユーザーの中の所持者数だったため、この変更でownedRateの定義が一貫する
// ⑦ ティアリスト化にあたり、ログイン中ユーザー自身の所持状況`mine`（id→凸レベル）も併せて返す
async function handleAnalytics(request, env, isSupporter) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) {
    return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  }

  const masterTable = isSupporter ? "supporters_master" : "units_master";
  const ownershipTable = isSupporter ? "supporters_ownership" : "units_ownership";
  const idColumn = isSupporter ? "supporter_id" : "unit_id";
  const attrColumn = isSupporter ? "skill" : "type";
  const registeredColumn = isSupporter ? "supporters_first_registered_at" : "units_first_registered_at";

  const { results } = await env.DB.prepare(
    `SELECT m.${idColumn} AS id, m.name AS name, m.${attrColumn} AS attr, m.limited AS limited,
            COUNT(o.id) AS owned_count
     FROM ${masterTable} m
     LEFT JOIN ${ownershipTable} o ON o.${idColumn} = m.${idColumn}
     GROUP BY m.${idColumn}
     ORDER BY owned_count DESC, m.${idColumn} ASC`
  ).all();

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM users WHERE ${registeredColumn} IS NOT NULL`
  ).first();
  const totalUsers = totalRow ? totalRow.c : 0;
  const idKey = isSupporter ? "supporterId" : "unitId";

  const ranking = results.map(r => ({
    [idKey]: r.id,
    name: r.name,
    [attrColumn]: r.attr,
    limited: !!r.limited,
    ownedCount: r.owned_count,
    ownedRate: totalUsers > 0 ? r.owned_count / totalUsers : 0
  }));

  const { results: mineRows } = await env.DB.prepare(
    `SELECT ${idColumn} AS id, level FROM ${ownershipTable} WHERE user_uid = ?`
  ).bind(sessionUser.userUid).all();
  const mine = {};
  for (const row of mineRows) {
    mine[String(row.id)] = row.level;
  }

  // ⑫ ログイン中ユーザー自身の初回データ登録フラグ（analytics.htmlのsyncNote判定に使用）
  const userRow = await env.DB.prepare(
    `SELECT ${registeredColumn} AS registeredAt FROM users WHERE user_uid = ?`
  ).bind(sessionUser.userUid).first();

  return jsonResponse({ totalUsers, ranking, mine, registered: !!(userRow && userRow.registeredAt) }, 200);
}

// ⑪ チェッカー起動時（ページ読み込み時）に、ログイン中ユーザー自身の所持データだけを軽量に返す。
// handleAnalytics()のmine取得ロジックと同等だが、ランキング集計を伴わない専用エンドポイントとして切り出す
// ⑫ 「登録済みだが所持0件」と「未登録」を区別できるよう、初回データ登録フラグ`registered`も返す
async function handleMyOwnership(request, env, isSupporter) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ loggedIn: false }, 200);

  const table = isSupporter ? "supporters_ownership" : "units_ownership";
  const idColumn = isSupporter ? "supporter_id" : "unit_id";
  const registeredColumn = isSupporter ? "supporters_first_registered_at" : "units_first_registered_at";

  const userRow = await env.DB.prepare(
    `SELECT ${registeredColumn} AS registeredAt FROM users WHERE user_uid = ?`
  ).bind(sessionUser.userUid).first();

  const { results } = await env.DB.prepare(
    `SELECT ${idColumn} AS id, level FROM ${table} WHERE user_uid = ?`
  ).bind(sessionUser.userUid).all();

  const ownership = {};
  for (const row of results) ownership[String(row.id)] = row.level;
  return jsonResponse({
    loggedIn: true,
    registered: !!(userRow && userRow.registeredAt),
    ownership
  }, 200);
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
    // ④ ログイン済みユーザーのみunits_ownership/supporters_ownershipに保存。ゲストは匿名カウンタのみ加算
    if ((url.pathname === "/api/log" || url.pathname === "/api/log-supporter") && request.method === "POST") {
      return handleOwnershipLog(request, env, url.pathname === "/api/log-supporter");
    }

    // ④ 所持データ分析（全体所持率ランキング）API。ログイン済みユーザーのみ利用可能
    if ((url.pathname === "/api/analytics/units" || url.pathname === "/api/analytics/supporters") && request.method === "GET") {
      return handleAnalytics(request, env, url.pathname === "/api/analytics/supporters");
    }

    // ⑪ チェッカー起動時に、ログイン中ユーザー自身の所持状況を復元するための読み出し専用API
    if ((url.pathname === "/api/my-ownership" || url.pathname === "/api/my-ownership-supporter") && request.method === "GET") {
      return handleMyOwnership(request, env, url.pathname === "/api/my-ownership-supporter");
    }

    // ルートURLはトップページ（top.html）を配信する。index.htmlは廃止済み（unit.htmlへリネーム済み）のため、
    // ルーティングとしても特別扱いしない（/index.htmlへのアクセスは以後、静的アセットとして404になる）。
    // トップページ自体はログイン不要で機体版/サポート版チェッカーへ直接遷移できるため、
    // Xの固定ポスト等からの流入でもゲスト利用の導線は塞がれない。
    if (url.pathname === "/") {
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
