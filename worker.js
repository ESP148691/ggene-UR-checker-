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

// JSTの日付 YYYY-MM-DD（㉖ 入手日の上限判定・定時分析のsnap_date）
function jstDateString(date) {
  return toJstIsoString(date).slice(0, 10);
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
// usernameは常に非NULL。passwordは54のA-2以降NULL（照合はpassword_hash）。
// （旧仕様では④のゲスト所持ログ経由でusername IS NULLの行が作られていたが、2026-09-19の
// 「ゲストデータ廃止」対応でその経路自体を削除し、0003/0004マイグレーションで過去分も削除済み。
// usersテーブルは現在「登録済みアカウントのみ」を前提としている）
function isValidUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_]{3,20}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 100;
}

// 54 パスワードのハッシュ化 参考実装（Cowork作成・Node 22のWeb Crypto で動作確認済み）
// worker.js にそのまま貼れる形。Cloudflare Workers の crypto.subtle は PBKDF2 の回数上限が 100000。
const PBKDF2_ITERATIONS = 100000;
const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";

function bytesToBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// → "pbkdf2-sha256$100000$<salt base64>$<hash base64>"
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PASSWORD_HASH_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

// 保存値の形式が壊れていれば false（例外にしない）
async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  let salt, expected;
  try { salt = base64ToBytes(parts[2]); expected = base64ToBytes(parts[3]); } catch (e) { return false; }
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqualBytes(actual, expected);
}

function timingSafeEqualBytes(a, b) {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
function timingSafeEqualStr(a, b) {
  const enc = new TextEncoder();
  return timingSafeEqualBytes(enc.encode(String(a)), enc.encode(String(b)));
}

// 存在しないユーザー名でも同じだけ計算するためのダミー（モジュール読み込み時に1回だけ作る）
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("dummy-password-for-timing");
  return dummyHashPromise;
}

// 仮パスワード：12文字。紛らわしい 0 O o 1 l I を除いた英数字（56種）。偏りが出ないよう棄却サンプリング
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateTempPassword(length = 12) {
  const chars = TEMP_PASSWORD_CHARS;
  const limit = 256 - (256 % chars.length);
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit) out += chars[b % chars.length];
      if (out.length === length) break;
    }
  }
  return out;
}

// 54 A-1はtrue（平文も書く）。A-2でfalseにする
const KEEP_PLAINTEXT_PASSWORD = true;

// 列・TBLが無い（0031未適用）ときのエラーか
function isMissingSchemaError(e) {
  return /no such (column|table)|has no column/i.test(String(e && e.message || e));
}

// パスワードを設定する（登録以外のすべての経路で使う）
async function setUserPassword(env, userUid, newPassword, mustChange) {
  const hash = await hashPassword(newPassword);
  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, password = ?, password_changed_at = ?, must_change_password = ? WHERE user_uid = ?"
  ).bind(hash, KEEP_PLAINTEXT_PASSWORD ? newPassword : null, new Date().toISOString(), mustChange ? 1 : 0, userUid).run();
}

// セッションの失効。exceptTokenを渡すとその1つだけ残す
async function revokeSessions(env, userUid, exceptToken) {
  if (exceptToken) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_uid = ? AND token <> ?").bind(userUid, exceptToken).run();
  } else {
    await env.DB.prepare("DELETE FROM sessions WHERE user_uid = ?").bind(userUid).run();
  }
}

// 現在のパスワードの照合（ログイン・パスワード変更で共用）。rowは SELECT * FROM users の行
async function checkUserPassword(row, password) {
  if (row.password_hash) return verifyPassword(password, row.password_hash);
  return typeof row.password === "string" && row.password !== "" && timingSafeEqualStr(password, row.password);
}

// 54 回数制限（auth_rate_limits。無い＝0031未適用のときは制限なしで動く）
const RL_WINDOW_MS = 15 * 60 * 1000;
const RL_LIMIT_USER = 10;
const RL_LIMIT_IP = 30;
const TOO_MANY_ATTEMPTS_MESSAGE = "ログインの失敗が続いたため、しばらく時間をおいてお試しください";

function loginUserKey(username) { return "login:u:" + username; }
function loginIpKey(request) { return "login:ip:" + (request.headers.get("CF-Connecting-IP") || "unknown"); }

async function isRateLimited(env, key, limit) {
  try {
    const row = await env.DB.prepare("SELECT fail_count, window_start FROM auth_rate_limits WHERE rl_key = ?").bind(key).first();
    if (!row) return false;
    const since = new Date(Date.now() - RL_WINDOW_MS).toISOString();
    return row.window_start >= since && row.fail_count >= limit;
  } catch (e) {
    return false;
  }
}
async function recordAuthFailure(env, key) {
  try {
    const nowDate = new Date();
    await env.DB.prepare(
      `INSERT INTO auth_rate_limits (rl_key, window_start, fail_count) VALUES (?1, ?2, 1)
       ON CONFLICT(rl_key) DO UPDATE SET
        fail_count = CASE WHEN window_start < ?3 THEN 1 ELSE fail_count + 1 END,
        window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END
       RETURNING fail_count`
    ).bind(key, nowDate.toISOString(), new Date(nowDate.getTime() - RL_WINDOW_MS).toISOString()).first();
  } catch (e) {
    if (!isMissingSchemaError(e)) console.error("rate limit record error", e);
  }
}
async function clearAuthFailures(env, key) {
  try {
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE rl_key = ?").bind(key).run();
  } catch (e) {
    // 0031未適用などは無視
  }
}
function tooManyAttempts() {
  return jsonResponse({ error: "too_many_attempts", message: TOO_MANY_ATTEMPTS_MESSAGE }, 429);
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
  try {
    const hash = await hashPassword(password);
    await env.DB.prepare(
      "INSERT INTO users (user_uid, first_seen, last_seen, username, password, password_hash, password_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userUid, now, now, username, KEEP_PLAINTEXT_PASSWORD ? password : null, hash, now).run();
  } catch (e) {
    // 0031未適用（列が無い）のときだけ従来のINSERTで登録する
    if (!isMissingSchemaError(e)) throw e;
    await env.DB.prepare(
      "INSERT INTO users (user_uid, first_seen, last_seen, username, password) VALUES (?, ?, ?, ?, ?)"
    ).bind(userUid, now, now, username, password).run();
  }

  await bumpDailyStat(env, "login");
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

  const userKey = loginUserKey(username);
  const ipKey = loginIpKey(request);
  if (await isRateLimited(env, userKey, RL_LIMIT_USER) || await isRateLimited(env, ipKey, RL_LIMIT_IP)) {
    return tooManyAttempts();
  }

  const row = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  let ok = false;
  if (!row) {
    // 存在しないユーザー名でも同じだけ計算し、応答時間でユーザーの有無が分からないようにする
    await verifyPassword(password, await getDummyHash());
  } else {
    ok = await checkUserPassword(row, password);
  }
  if (!ok) {
    await recordAuthFailure(env, userKey);
    await recordAuthFailure(env, ipKey);
    return jsonResponse({ error: "invalid_credentials", message: "ユーザー名またはパスワードが違います" }, 401);
  }

  // 未移行（password_hashがNULL。0031適用済みのときだけ"password_hash"キーがある）：その場でハッシュを保存
  if ("password_hash" in row && !row.password_hash) {
    try {
      const hash = await hashPassword(password);
      const nowIso = new Date().toISOString();
      if (KEEP_PLAINTEXT_PASSWORD) {
        await env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE user_uid = ? AND password_hash IS NULL").bind(hash, nowIso, row.user_uid).run();
      } else {
        await env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, password = NULL WHERE user_uid = ? AND password_hash IS NULL").bind(hash, nowIso, row.user_uid).run();
      }
    } catch (e) {
      console.error("password hash migrate error", e);
    }
  }
  await clearAuthFailures(env, userKey);

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET last_seen = ? WHERE user_uid = ?").bind(now, row.user_uid).run();

  await bumpDailyStat(env, "login");
  const token = await createSession(env, row.user_uid);
  return jsonResponse(
    { username, mustChangePassword: row.must_change_password === 1 },
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
  let mustChangePassword = false;
  try {
    const r = await env.DB.prepare("SELECT must_change_password FROM users WHERE user_uid = ?").bind(user.userUid).first();
    mustChangePassword = !!r && r.must_change_password === 1;
  } catch (e) {
    // 0031未適用（列が無い）はfalse
  }
  return jsonResponse({ loggedIn: true, username: user.username, mustChangePassword }, 200);
}

// 54 POST /api/account/password（ログイン必須）：自分でパスワードを変更。今の端末以外はログアウトされる
async function handleAccountPassword(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  const { currentPassword, newPassword } = body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  const userKey = loginUserKey(sessionUser.username);
  if (await isRateLimited(env, userKey, RL_LIMIT_USER)) return tooManyAttempts();

  const row = await env.DB.prepare("SELECT * FROM users WHERE user_uid = ?").bind(sessionUser.userUid).first();
  if (!row) return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  if (!("password_hash" in row)) return jsonResponse({ error: "not_ready" }, 503);

  if (!(await checkUserPassword(row, currentPassword))) {
    await recordAuthFailure(env, userKey);
    return jsonResponse({ error: "invalid_credentials", message: "現在のパスワードが違います" }, 401);
  }
  if (!isValidPassword(newPassword)) {
    return jsonResponse({ error: "invalid_password", message: "パスワードは6〜100文字で入力してください" }, 400);
  }
  if (newPassword === currentPassword) {
    return jsonResponse({ error: "same_password", message: "現在と同じパスワードは使えません" }, 400);
  }
  await setUserPassword(env, sessionUser.userUid, newPassword, false);
  await revokeSessions(env, sessionUser.userUid, sessionUser.token);
  await clearAuthFailures(env, userKey);
  return jsonResponse({ ok: true }, 200);
}

// ④ D1への所持データ保存（ログイン済みユーザーのみ。ゲスト保存は廃止・2026-09-19）
// 想定される最大件数（機体87・サポート50）より十分大きい安全マージン。不正に巨大な入力は無視する
const OWNERSHIP_LOG_MAX_ENTRIES = 300;

// マスターに実在するID範囲（= unit.html/supporter.htmlのUNITS配列の件数と一致させる）。
// units_ownership/supporters_ownershipのunit_id/supporter_idはunits_master/supporters_masterへの
// FOREIGN KEYだが、D1側でFK制約が有効化されているとは限らないため、アプリ側でも範囲チェックする。
// 新しいUR機体・サポートを追加した際は、この数値もtop.htmlのUNIT_IMAGES/SUPPORTER_IMAGESの件数・
// migrations/0002_populate_master_data.sqlの投入件数と合わせて必ず更新すること
const MAX_UNIT_ID = 87;
const MAX_SUPPORTER_ID = 50;

// レアリティ区分（rarity_code）。(rarity_code, unit_id) で公式ユニットを特定する。詳細は docs ㊳詳細設計 1章
const RARITY_CODE = Object.freeze({ CUSTOM: 0, UR: 1, SSR: 2 });  // SR以下を実装するときは SR: 3, R: 4, N: 5

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

// 運営者向けの利用集計（日別カウンタ。stat_key＝login／checker_use）。0032未適用や失敗でも本処理は止めない
async function bumpDailyStat(env, statKey) {
  try {
    await env.DB.prepare(
      `INSERT INTO daily_stats (stat_date, stat_key, count) VALUES (?, ?, 1)
       ON CONFLICT(stat_date, stat_key) DO UPDATE SET count = count + 1`
    ).bind(jstDateString(new Date()), statKey).run();
  } catch (e) {
    console.error("daily_stats error", e);
  }
}

// 所持データは履歴を積み上げず「最新状態のスナップショット」として保持する。
// ㉖ 入手記録（acquired_on・gasha_pulls・memo）を行に持たせるため、「全削除→入れ直し」から
// 「差分更新」に変更した（入れ直しだと、acqを送らない登録のたびに入手記録が消えてしまう）。
//   既存にあって今回も所持 → UPDATE（凸・登録日時。acqMapにIDがあれば入手記録の3列も）
//   既存に無く今回所持     → INSERT（入手記録はacqMapにあればその値、無ければNULL）
//   既存にあって今回未所持 → DELETE（入手記録も消える）
// すべて1回のenv.DB.batch()で実行する（D1のbatchはトランザクションとして扱われる）。
// acqMapはユニットのみ（サポートはnull）。acqMapに無いIDの入手記録の列には一切触れない
//
// ⑬ 補足（2026-09-22時点で懸念、2026-09-23訂正）：所持率100%超え不具合の調査当初、複数端末・
// 複数タブからの送信競合で同一(user_uid, idColumn)の重複行が残る可能性を懸念したが、本番D1で
// 確認した結果、重複行は存在しなかった（詳細はdocs/01_所持チェッカー・DB登録/⑬所持率100%超え
// 不具合_調査と改善設計.md末尾の訂正）。差分更新でも(user_uid, idColumn)単位で扱うため、万一重複行が
// あってもUPDATE/DELETEは全行に効く
async function syncOwnership(env, table, idColumn, userUid, entries, acqMap) {
  const now = toJstIsoString(new Date()); // ⑪ 表示用のregistered_atはJST表記で保存する
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT ${idColumn} AS id FROM ${table} WHERE user_uid = ?`
  ).bind(userUid).all();
  const existing = new Set(results.map(r => r.id));
  // 同じIDが複数回送られた場合は後の値を採用（旧方式は重複行を作り、読み出し側では後の行が残っていた）
  const levels = new Map();
  for (const entry of entries) levels.set(entry.id, entry.level);
  const current = new Set(levels.keys());
  const statements = [];
  for (const [id, level] of levels) {
    const entry = { id, level };
    const acq = acqMap && acqMap.has(entry.id) ? acqMap.get(entry.id) : undefined;
    if (existing.has(entry.id)) {
      if (acq !== undefined) {
        statements.push(env.DB.prepare(
          `UPDATE ${table} SET level = ?, registered_at = ?, acquired_on = ?, gasha_pulls = ?, memo = ?
           WHERE user_uid = ? AND ${idColumn} = ?`
        ).bind(entry.level, now, acq.d, acq.n, acq.m, userUid, entry.id));
      } else {
        statements.push(env.DB.prepare(
          `UPDATE ${table} SET level = ?, registered_at = ? WHERE user_uid = ? AND ${idColumn} = ?`
        ).bind(entry.level, now, userUid, entry.id));
      }
    } else if (acq !== undefined) {
      statements.push(env.DB.prepare(
        `INSERT INTO ${table} (registered_at, user_uid, ${idColumn}, level, acquired_on, gasha_pulls, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(now, userUid, entry.id, entry.level, acq.d, acq.n, acq.m));
    } else {
      statements.push(env.DB.prepare(
        `INSERT INTO ${table} (registered_at, user_uid, ${idColumn}, level) VALUES (?, ?, ?, ?)`
      ).bind(now, userUid, entry.id, entry.level));
    }
  }
  for (const id of existing) {
    if (!current.has(id)) {
      statements.push(env.DB.prepare(
        `DELETE FROM ${table} WHERE user_uid = ? AND ${idColumn} = ?`
      ).bind(userUid, id));
    }
  }
  if (statements.length) await env.DB.batch(statements);
}

// ㉖ 入手記録の入手日。YYYY-MM-DD または YYYY-MM。実在する日付で、2025-01以降かつJSTの今日（YYYY-MMは今月）以前。
// 不正ならnull（リクエスト全体は失敗させない）
const ACQ_MIN_MONTH = "2025-01";
function normalizeAcqDate(value, todayJst) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (m[3]) {
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  }
  if (value.slice(0, 7) < ACQ_MIN_MONTH) return null;
  if (m[3] ? value > todayJst : value > todayJst.slice(0, 7)) return null;
  return value;
}

// ㉖ リクエストのacq（{ "id": {d,n,m} | null }）を Map(id → {d,n,m}) に正規化する。
// acqが無い・オブジェクトでない・キー数がMAX_UNIT_IDを超える → null（入手記録には一切触れない）。
// 値がnull → 3列ともNULL（記録の削除）。各項目は不正ならその項目だけNULL。範囲外IDは読み飛ばす
function parseAcqMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length > MAX_UNIT_ID) return null;
  const today = jstDateString(new Date());
  const map = new Map();
  for (const key of keys) {
    if (!/^\d+$/.test(key)) continue;
    const id = Number(key);
    if (id < 1 || id > MAX_UNIT_ID) continue;
    const v = raw[key];
    if (v === null) { map.set(id, { d: null, n: null, m: null }); continue; }
    if (typeof v !== "object" || Array.isArray(v)) continue;
    const n = Number.isInteger(v.n) && v.n >= 1 && v.n <= 9999 ? v.n : null;
    const memo = normalizeProfileText(v.m, 50, false);
    map.set(id, { d: normalizeAcqDate(v.d, today), n, m: memo === undefined ? null : memo });
  }
  return map;
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
      await syncOwnership(
        env,
        isSupporter ? "supporters_ownership" : "units_ownership",
        isSupporter ? "supporter_id" : "unit_id",
        sessionUser.userUid,
        entries,
        isSupporter ? null : parseAcqMap(body.acq)
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

  // ⑬ COUNT(o.id)（行数）ではなくCOUNT(DISTINCT o.user_uid)（ユニークユーザー数）を使う。
  // 100%超え不具合の調査当初、重複行による分子の水増しを疑ってこの変更を先行適用したが、
  // 本番D1で確認した結果、重複行自体は存在しなかった（真の原因はmigrations/0006のバックフィルと
  // デプロイの間の「デプロイギャップ」。詳細はdocs/⑬所持率100%超え不具合_調査と改善設計.md末尾）。
  // この変更自体は無害（重複が無ければCOUNT(o.id)と結果は一致する）なため、安全側の措置として維持
  const { results } = await env.DB.prepare(
    `SELECT m.${idColumn} AS id, m.name AS name, m.${attrColumn} AS attr, m.limited AS limited,
            COUNT(DISTINCT o.user_uid) AS owned_count
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

  // ㉖ ユニット版のみ入手記録（acq）も返す。3列のどれかがNULLでない行だけ、NULLの項目はキーごと省く
  const { results } = await env.DB.prepare(
    isSupporter
      ? `SELECT ${idColumn} AS id, level FROM ${table} WHERE user_uid = ?`
      : `SELECT ${idColumn} AS id, level, acquired_on, gasha_pulls, memo FROM ${table} WHERE user_uid = ?`
  ).bind(sessionUser.userUid).all();

  const ownership = {};
  const acq = {};
  for (const row of results) {
    ownership[String(row.id)] = row.level;
    if (isSupporter) continue;
    const rec = {};
    if (row.acquired_on != null) rec.d = row.acquired_on;
    if (row.gasha_pulls != null) rec.n = row.gasha_pulls;
    if (row.memo != null) rec.m = row.memo;
    if (Object.keys(rec).length) acq[String(row.id)] = rec;
  }
  const data = {
    loggedIn: true,
    registered: !!(userRow && userRow.registeredAt),
    ownership
  };
  if (!isSupporter) data.acq = acq;
  return jsonResponse(data, 200);
}

// ⑩ エタロ攻略チェッカー（エキスパート難易度）。
// マスターに実在するmission_id（stage_id*10+slotのため1〜N連番ではなく飛び飛び）の正規集合。
// units_ownership等のMAX_UNIT_ID方式（範囲チェック）が使えないため、代わりに集合の包含チェックを行う。
// migrations/0009でこのマスターデータを追加・変更した場合は、この集合も必ず更新すること
// （2026-10-03 ㊼：No.30「機動戦士Vガンダム」の301・302を追加＝migrations/0023）
const ETERNAL_ROAD_MISSION_IDS = new Set([
  11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 51, 52, 61, 62, 71, 72, 81, 82, 91, 92,
  101, 102, 111, 112, 121, 122, 131, 132, 133, 141, 142, 143, 151, 152, 161, 162,
  171, 172, 173, 181, 182, 183, 191, 192, 201, 202, 211, 212, 221, 222, 223,
  231, 232, 233, 241, 242, 243, 251, 252, 253, 261, 262, 271, 272, 281, 282, 291, 292,
  301, 302
]);
const ETERNAL_ROAD_CLEAR_MAX_ENTRIES = 100; // 想定最大71件より十分大きい安全マージン
// ⑮ 通常クリア（ステージクリア）用のstage_id正規集合（30件）。ステージのマスターテーブルは持たないため
// ミッションIDの集合から導出する（mission_id = stage_id*10+slot）
const ETERNAL_ROAD_STAGE_IDS = new Set([...ETERNAL_ROAD_MISSION_IDS].map(id => Math.floor(id / 10)));

// ⑮ "1,2,..."形式のカンマ区切りID文字列を、正規集合に含まれる整数IDの重複なし配列にパースする。
// 件数上限を超える不正に巨大な入力はnull（＝書き込みしない）を返す
function parseEternalRoadIdList(raw, validIds) {
  const parts = (typeof raw === "string" ? raw : "").split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length > ETERNAL_ROAD_CLEAR_MAX_ENTRIES) return null;
  return [...new Set(parts.map(Number))].filter(id => Number.isInteger(id) && validIds.has(id));
}

// ⑩ エタロ攻略チェッカーのマスターデータ（ステージ・ミッション一覧）取得。
// unit.html/supporter.htmlのUNITS配列に相当する静的参照データのため認証不要
async function handleEternalRoadMissions(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT mission_id, stage_id, stage_name, mission_slot, mission_type, mission_text, reward,
            is_title, tag, title_name, confidence, sort_order
     FROM eternal_road_missions
     ORDER BY sort_order ASC`
  ).all();
  return jsonResponse({ missions: results }, 200);
}

// 所持データ（units_ownership等）と同じ「最新スナップショット方式」。
// 送信の都度、そのuser_uidの既存クリア行（ミッション達成・ステージクリアの両方）を全削除してから
// 現在のクリア状態を入れ直す。⑮ 初回登録日時（⑫と同じ考え方）の更新も同じbatchで行う
async function replaceEternalRoadClears(env, userUid, missionIds, stageIds) {
  const nowJst = toJstIsoString(new Date());
  const nowUtc = new Date().toISOString(); // last_seenは⑪の対象外のままUTCを維持（既存方針を踏襲）
  const statements = [
    env.DB.prepare("DELETE FROM eternal_road_mission_clears WHERE user_uid = ?").bind(userUid),
    env.DB.prepare("DELETE FROM eternal_road_stage_clears WHERE user_uid = ?").bind(userUid)
  ];
  for (const missionId of missionIds) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO eternal_road_mission_clears (user_uid, mission_id, cleared_at) VALUES (?, ?, ?)"
      ).bind(userUid, missionId, nowJst)
    );
  }
  for (const stageId of stageIds) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO eternal_road_stage_clears (user_uid, stage_id, cleared_at) VALUES (?, ?, ?)"
      ).bind(userUid, stageId, nowJst)
    );
  }
  statements.push(
    env.DB.prepare(
      `UPDATE users SET eternal_road_first_registered_at = COALESCE(eternal_road_first_registered_at, ?), last_seen = ?
       WHERE user_uid = ?`
    ).bind(nowJst, nowUtc, userUid)
  );
  await env.DB.batch(statements);
}

// ⑩⑮ エタロ攻略チェッカーの「データ登録」「画像で保存」「Xでシェア」押下時の同期エンドポイント。ログイン必須。
// 未ログイン時はD1への保存を行わない。
// ⑮ clearedStageIds（通常クリア）を追加。旧クライアント（キャッシュ）対策として欠落時はclearedIdsから導出し、
// 「ミッション達成があるステージはクリア扱い」にサーバー側でも正規化する
async function handleLogEternalRoadMissions(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ ok: true, loggedIn: false }, 200);

  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  try {
    const missionIds = parseEternalRoadIdList(body && body.clearedIds, ETERNAL_ROAD_MISSION_IDS);
    const stageIds = parseEternalRoadIdList(body && body.clearedStageIds, ETERNAL_ROAD_STAGE_IDS);
    if (missionIds && stageIds) {
      const stageSet = new Set(stageIds);
      for (const id of missionIds) stageSet.add(Math.floor(id / 10));
      await replaceEternalRoadClears(env, sessionUser.userUid, missionIds, [...stageSet].sort((a, b) => a - b));
    }
  } catch (e) {
    console.error("eternal road clears write error", e);
  }

  return jsonResponse({ ok: true, loggedIn: true }, 200);
}

// エタロ攻略状況の集計API（データ登録結果レポートの「エタロ攻略」タブ用・2026-09-24）。ログイン必須。
// 母数はエタロでデータ登録済みのユーザー（eternal_road_first_registered_at IS NOT NULL）。
// 分子も同じ条件のユーザーに限定する（⑬のデプロイギャップのように、フラグ未付与のクリア行があっても
// 率が100%を超えないようにするため）
// エタロ分析の集計部分。/api/analytics/eternal-road と ㉖定時分析（runDailySnapshot）で共用する
async function queryEternalRoadCounts(env) {
  const REGISTERED_JOIN = "JOIN users u ON u.user_uid = c.user_uid AND u.eternal_road_first_registered_at IS NOT NULL";

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM users WHERE eternal_road_first_registered_at IS NOT NULL"
  ).first();
  const totalUsers = totalRow ? totalRow.c : 0;

  const { results: missionRows } = await env.DB.prepare(
    `SELECT m.mission_id, m.stage_id, m.stage_name, m.mission_slot, m.mission_type, m.mission_text,
            m.is_title, m.tag, m.title_name, m.sort_order,
            (SELECT COUNT(DISTINCT c.user_uid) FROM eternal_road_mission_clears c ${REGISTERED_JOIN}
              WHERE c.mission_id = m.mission_id) AS achieved_count
     FROM eternal_road_missions m
     ORDER BY m.sort_order ASC`
  ).all();

  const { results: clearRows } = await env.DB.prepare(
    `SELECT c.stage_id AS stage_id, COUNT(DISTINCT c.user_uid) AS cleared_count
     FROM eternal_road_stage_clears c ${REGISTERED_JOIN}
     GROUP BY c.stage_id`
  ).all();

  // ステージ内の全ミッションを達成したユーザー数（ステージごと）
  const { results: perfectRows } = await env.DB.prepare(
    `SELECT x.stage_id AS stage_id, COUNT(*) AS perfect_count
     FROM (SELECT c.user_uid, m.stage_id, COUNT(DISTINCT c.mission_id) AS n
           FROM eternal_road_mission_clears c ${REGISTERED_JOIN}
           JOIN eternal_road_missions m ON m.mission_id = c.mission_id
           GROUP BY c.user_uid, m.stage_id) x
     JOIN (SELECT stage_id, COUNT(*) AS total FROM eternal_road_missions GROUP BY stage_id) t
       ON t.stage_id = x.stage_id
     WHERE x.n = t.total
     GROUP BY x.stage_id`
  ).all();

  return { REGISTERED_JOIN, totalUsers, missionRows, clearRows, perfectRows };
}

async function handleAnalyticsEternalRoad(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) {
    return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  }

  const { REGISTERED_JOIN, totalUsers, missionRows, clearRows, perfectRows } = await queryEternalRoadCounts(env);

  // 全ステージクリア・全ミッション達成のユーザー数（分母はマスターの件数）
  const stageTotal = new Set(missionRows.map(r => r.stage_id)).size;
  const missionTotal = missionRows.length;
  const allClearRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM (
       SELECT c.user_uid FROM eternal_road_stage_clears c ${REGISTERED_JOIN}
       WHERE c.stage_id IN (SELECT DISTINCT stage_id FROM eternal_road_missions)
       GROUP BY c.user_uid HAVING COUNT(DISTINCT c.stage_id) >= ?)`
  ).bind(stageTotal).first();
  const allPerfectRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM (
       SELECT c.user_uid FROM eternal_road_mission_clears c ${REGISTERED_JOIN}
       WHERE c.mission_id IN (SELECT mission_id FROM eternal_road_missions)
       GROUP BY c.user_uid HAVING COUNT(DISTINCT c.mission_id) >= ?)`
  ).bind(missionTotal).first();

  const clearedByStage = new Map(clearRows.map(r => [r.stage_id, r.cleared_count]));
  const perfectByStage = new Map(perfectRows.map(r => [r.stage_id, r.perfect_count]));
  const stages = [];
  for (const r of missionRows) {
    let s = stages.find(x => x.stageId === r.stage_id);
    if (!s) {
      s = {
        stageId: r.stage_id,
        stageName: r.stage_name,
        clearedCount: clearedByStage.get(r.stage_id) || 0,
        perfectCount: perfectByStage.get(r.stage_id) || 0,
        missions: []
      };
      stages.push(s);
    }
    s.missions.push({
      missionId: r.mission_id,
      slot: r.mission_slot,
      type: r.mission_type,
      text: r.mission_text,
      isTitle: !!r.is_title,
      tag: r.tag,
      titleName: r.title_name,
      achievedCount: r.achieved_count
    });
  }

  const { results: myMissions } = await env.DB.prepare(
    "SELECT mission_id FROM eternal_road_mission_clears WHERE user_uid = ?"
  ).bind(sessionUser.userUid).all();
  const { results: myStages } = await env.DB.prepare(
    "SELECT stage_id FROM eternal_road_stage_clears WHERE user_uid = ?"
  ).bind(sessionUser.userUid).all();
  const userRow = await env.DB.prepare(
    "SELECT eternal_road_first_registered_at AS registeredAt FROM users WHERE user_uid = ?"
  ).bind(sessionUser.userUid).first();

  return jsonResponse({
    totalUsers,
    allClearCount: allClearRow ? allClearRow.c : 0,
    allPerfectCount: allPerfectRow ? allPerfectRow.c : 0,
    stages,
    mine: {
      clearedIds: myMissions.map(r => r.mission_id),
      clearedStageIds: myStages.map(r => r.stage_id)
    },
    registered: !!(userRow && userRow.registeredAt)
  }, 200);
}

// ================= ㉖ 定時分析（analytics_daily）・運営者用レポート =================
// 1日1回（Cron Triggers：UTC 19:00＝JST 4:00）、分析APIと同じ定義で集計してD1に積み上げる。
// snap_dateは「その日のJST 4:00時点の状態」。同じ日付で何度実行しても結果は同じ（INSERT OR REPLACE）
const SNAPSHOT_KINDS = new Set(["unit", "supporter", "er_stage", "er_mission", "ch_stage", "ch_mission"]);

// ユニット／サポートの所持者数（handleAnalyticsと同じCOUNT(DISTINCT user_uid)）・完凸者数。マスターの全IDを返す
async function queryOwnershipCounts(env, isSupporter) {
  const masterTable = isSupporter ? "supporters_master" : "units_master";
  const ownershipTable = isSupporter ? "supporters_ownership" : "units_ownership";
  const idColumn = isSupporter ? "supporter_id" : "unit_id";
  const registeredColumn = isSupporter ? "supporters_first_registered_at" : "units_first_registered_at";
  const { results } = await env.DB.prepare(
    `SELECT m.${idColumn} AS id,
            COUNT(DISTINCT o.user_uid) AS owned_count,
            COUNT(DISTINCT CASE WHEN o.level = 3 THEN o.user_uid END) AS max_count
     FROM ${masterTable} m
     LEFT JOIN ${ownershipTable} o ON o.${idColumn} = m.${idColumn}
     GROUP BY m.${idColumn}
     ORDER BY m.${idColumn} ASC`
  ).all();
  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM users WHERE ${registeredColumn} IS NOT NULL`
  ).first();
  return { rows: results, totalUsers: totalRow ? totalRow.c : 0 };
}

async function runDailySnapshot(env, snapDate) {
  const units = await queryOwnershipCounts(env, false);
  const supporters = await queryOwnershipCounts(env, true);
  const er = await queryEternalRoadCounts(env);
  const ch = await queryChallengeCounts(env);
  const accountsRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();

  const rows = [];
  for (const r of units.rows) rows.push(["unit", r.id, r.owned_count, r.max_count, units.totalUsers]);
  for (const r of supporters.rows) rows.push(["supporter", r.id, r.owned_count, r.max_count, supporters.totalUsers]);
  const clearedByStage = new Map(er.clearRows.map(r => [r.stage_id, r.cleared_count]));
  const perfectByStage = new Map(er.perfectRows.map(r => [r.stage_id, r.perfect_count]));
  const stageIds = [...new Set(er.missionRows.map(r => r.stage_id))].sort((a, b) => a - b);
  for (const id of stageIds) rows.push(["er_stage", id, clearedByStage.get(id) || 0, perfectByStage.get(id) || 0, er.totalUsers]);
  for (const r of er.missionRows) rows.push(["er_mission", r.mission_id, r.achieved_count, 0, er.totalUsers]);
  const chClearedByStage = new Map(ch.clearRows.map(r => [r.stage_id, r.cleared_count]));
  const chPerfectByStage = new Map(ch.perfectRows.map(r => [r.stage_id, r.perfect_count]));
  const chStageIds = [...new Set(ch.missionRows.map(r => r.stage_id))].sort((a, b) => a - b);
  for (const id of chStageIds) rows.push(["ch_stage", id, chClearedByStage.get(id) || 0, chPerfectByStage.get(id) || 0, ch.totalUsers]);
  for (const r of ch.missionRows) rows.push(["ch_mission", r.mission_id, r.achieved_count, 0, ch.totalUsers]);

  const insert = "INSERT OR REPLACE INTO analytics_daily (snap_date, kind, item_id, owned_count, max_count, total_users) VALUES (?, ?, ?, ?, ?, ?)";
  const statements = rows.map(r => env.DB.prepare(insert).bind(snapDate, ...r));
  statements.push(env.DB.prepare(
    `INSERT OR REPLACE INTO analytics_daily_summary (snap_date, accounts, unit_users, supporter_users, er_users, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(snapDate, accountsRow ? accountsRow.c : 0, units.totalUsers, supporters.totalUsers, er.totalUsers, toJstIsoString(new Date())));
  await env.DB.batch(statements);
  return { snapDate, rows: rows.length };
}

// 運営者の判定：ログインユーザー名がenv.ADMIN_USERNAMES（カンマ区切り、前後空白除去）に含まれるか
function isAdminUser(sessionUser, env) {
  if (!sessionUser || !sessionUser.username) return false;
  const names = String(env.ADMIN_USERNAMES || "").split(",").map(s => s.trim()).filter(Boolean);
  return names.includes(sessionUser.username);
}
// 運営者専用APIの入口。未ログイン401・運営者でなければ403（Responseを返す）、運営者ならsessionUser
async function requireAdmin(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  if (!isAdminUser(sessionUser, env)) return jsonResponse({ error: "forbidden" }, 403);
  return sessionUser;
}

// GET /api/admin/me（report.htmlの表示切り替え用。Cookie任意）
async function handleAdminMe(request, env) {
  const sessionUser = await getSessionUser(request, env);
  return jsonResponse({ admin: isAdminUser(sessionUser, env) }, 200);
}

// POST /api/admin/run-snapshot（運営者のみ）：今日（JST）の日付で集計を実行
async function handleAdminRunSnapshot(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  const result = await runDailySnapshot(env, jstDateString(new Date()));
  return jsonResponse({ ok: true, snapDate: result.snapDate, rows: result.rows }, 200);
}

// 54 POST /api/admin/reset-password（運営者のみ）：仮パスワードを発行。対象の全端末をログアウトする
async function handleAdminResetPassword(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  const username = body && body.username;
  if (typeof username !== "string" || !username) return jsonResponse({ error: "invalid_body" }, 400);

  const target = await env.DB.prepare("SELECT user_uid, username FROM users WHERE username = ?").bind(username).first();
  if (!target) return jsonResponse({ error: "user_not_found", message: "そのユーザー名は見つかりません" }, 404);

  const tempPassword = generateTempPassword();
  try {
    await setUserPassword(env, target.user_uid, tempPassword, true);
  } catch (e) {
    if (isMissingSchemaError(e)) return jsonResponse({ error: "not_ready" }, 503);
    throw e;
  }
  await revokeSessions(env, target.user_uid);
  await clearAuthFailures(env, loginUserKey(target.username));
  console.log("admin reset-password", { by: admin.username, target: target.username, at: new Date().toISOString() });
  return jsonResponse({ username: target.username, tempPassword }, 200);
}

// チェッカーの利用（データ登録の保存成功）を1回として数える
async function countCheckerUse(response, env) {
  if (response.status === 200) await bumpDailyStat(env, "checker_use");
  return response;
}

// GET /api/admin/usage-stats（運営者のみ）：累計ログイン数・本日のログイン数・チェッカー利用数（累計・本日）
async function handleAdminUsageStats(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  try {
    const today = jstDateString(new Date());
    const { results } = await env.DB.prepare(
      `SELECT stat_key,
              COALESCE(SUM(count), 0) AS total,
              COALESCE(SUM(CASE WHEN stat_date = ? THEN count ELSE 0 END), 0) AS today,
              MIN(stat_date) AS since
       FROM daily_stats GROUP BY stat_key`
    ).bind(today).all();
    const by = {};
    for (const r of results) by[r.stat_key] = r;
    const pick = (k) => ({ total: by[k] ? by[k].total : 0, today: by[k] ? by[k].today : 0 });
    let since = null;
    for (const r of results) if (!since || r.since < since) since = r.since;
    return jsonResponse({ date: today, since, login: pick("login"), checkerUse: pick("checker_use") }, 200);
  } catch (e) {
    if (isMissingSchemaError(e)) return jsonResponse({ error: "not_ready" }, 503);
    throw e;
  }
}

// 54 GET /api/admin/password-status（運営者のみ）
async function handleAdminPasswordStatus(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END), 0) AS hashed,
              COALESCE(SUM(CASE WHEN password_hash IS NULL THEN 1 ELSE 0 END), 0) AS unmigrated,
              COALESCE(SUM(CASE WHEN must_change_password = 1 THEN 1 ELSE 0 END), 0) AS mustChange
       FROM users`
    ).first();
    return jsonResponse({ total: r.total, hashed: r.hashed, unmigrated: r.unmigrated, mustChange: r.mustChange }, 200);
  } catch (e) {
    if (isMissingSchemaError(e)) return jsonResponse({ error: "not_ready" }, 503);
    throw e;
  }
}

// 54 POST /api/admin/hash-migrate（運営者のみ）：未移行ユーザーを50件ずつハッシュ化
async function handleAdminHashMigrate(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  try {
    const { results } = await env.DB.prepare(
      `SELECT user_uid, password FROM users
       WHERE password_hash IS NULL AND password IS NOT NULL AND password <> ''
       LIMIT 50`
    ).all();
    const nowIso = new Date().toISOString();
    const sql = KEEP_PLAINTEXT_PASSWORD
      ? "UPDATE users SET password_hash = ?, password_changed_at = COALESCE(password_changed_at, ?) WHERE user_uid = ? AND password_hash IS NULL"
      : "UPDATE users SET password_hash = ?, password_changed_at = COALESCE(password_changed_at, ?), password = NULL WHERE user_uid = ? AND password_hash IS NULL";
    const statements = [];
    for (const row of results) {
      const hash = await hashPassword(row.password);
      statements.push(env.DB.prepare(sql).bind(hash, nowIso, row.user_uid));
    }
    if (statements.length) await env.DB.batch(statements);
    const rem = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE password_hash IS NULL").first();
    return jsonResponse({ converted: statements.length, remaining: rem.c }, 200);
  } catch (e) {
    if (isMissingSchemaError(e)) return jsonResponse({ error: "not_ready" }, 503);
    throw e;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// GET /api/admin/report/weekly?date=YYYY-MM-DD（運営者のみ）：週間UR所持率レポート（テンプレートA）のデータ
const WEEKLY_TOP_N = 10;
const WEEKLY_GAINERS_N = 3;
const WEEKLY_GAINER_MIN_OWNED = 10; // 少人数で誤解を招く数字を出さないため、今回の所持者数が10人未満のユニットは除外
async function handleAdminWeeklyReport(request, env, url) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  let date = url.searchParams.get("date");
  if (date != null && date !== "" && !DATE_RE.test(date)) return jsonResponse({ error: "invalid_date" }, 400);
  if (!date) {
    const latest = await env.DB.prepare("SELECT MAX(snap_date) AS d FROM analytics_daily WHERE kind = 'unit'").first();
    date = latest && latest.d;
    if (!date) return jsonResponse({ error: "no_data", message: "集計データがまだありません" }, 404);
  }
  const unitRows = async (d) => (await env.DB.prepare(
    `SELECT a.item_id AS id, a.owned_count, a.total_users, m.name, m.limited
     FROM analytics_daily a LEFT JOIN units_master m ON m.unit_id = a.item_id
     WHERE a.snap_date = ? AND a.kind = 'unit'`
  ).bind(d).all()).results;
  const cur = await unitRows(date);
  if (!cur.length) return jsonResponse({ error: "no_data", message: "指定日の集計データがありません" }, 404);

  const prevRow = await env.DB.prepare(
    "SELECT MAX(snap_date) AS d FROM analytics_daily WHERE kind = 'unit' AND snap_date <= ?"
  ).bind(addDays(date, -7)).first();
  const prevDate = prevRow && prevRow.d ? prevRow.d : null;
  const prev = prevDate ? await unitRows(prevDate) : [];

  const rate = (r) => r.total_users > 0 ? r.owned_count / r.total_users : 0;
  const top = cur.slice()
    .sort((a, b) => rate(b) - rate(a) || a.id - b.id)
    .slice(0, WEEKLY_TOP_N)
    .map(r => ({ unitId: r.id, name: r.name, limited: !!r.limited, ownedCount: r.owned_count, ownedRate: rate(r) }));

  const prevById = new Map(prev.map(r => [r.id, r]));
  const gainers = cur
    .filter(r => r.owned_count >= WEEKLY_GAINER_MIN_OWNED && prevById.has(r.id))
    .map(r => {
      const p = prevById.get(r.id);
      const deltaPt = Math.round((rate(r) - rate(p)) * 1000) / 10;
      return { unitId: r.id, name: r.name, ownedRate: rate(r), prevRate: rate(p), deltaPt };
    })
    .filter(g => g.deltaPt > 0)
    .sort((a, b) => b.deltaPt - a.deltaPt || a.unitId - b.unitId)
    .slice(0, WEEKLY_GAINERS_N);

  return jsonResponse({
    date,
    prevDate,
    totalUsers: cur[0].total_users,
    prevTotalUsers: prev.length ? prev[0].total_users : null,
    top,
    gainers
  }, 200);
}

// GET /api/admin/report/ownership?kind=unit|supporter&date=YYYY-MM-DD（運営者のみ）
// ㉘ X投稿用レポート（report.html）の共通データ。analytics_dailyの1日分を全件返す。
// 対象の絞り込み（全／恒常／期間限定）・並べ替え・上位30位の切り出しは画面側（buildReportData）で行う。
// 伸び率（1週間前との比較）はユーザー指示で廃止したため、比較用の値は返さない
async function handleAdminReportOwnership(request, env, url) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  const kind = url.searchParams.get("kind");
  if (kind !== "unit" && kind !== "supporter") return jsonResponse({ error: "invalid_params" }, 400);
  let date = url.searchParams.get("date");
  if (date != null && date !== "" && !DATE_RE.test(date)) return jsonResponse({ error: "invalid_date" }, 400);
  if (!date) {
    const latest = await env.DB.prepare("SELECT MAX(snap_date) AS d FROM analytics_daily WHERE kind = ?").bind(kind).first();
    date = latest && latest.d;
    if (!date) return jsonResponse({ error: "no_data", message: "集計データがまだありません" }, 404);
  }
  const join = kind === "unit" ? "units_master m ON m.unit_id = a.item_id" : "supporters_master m ON m.supporter_id = a.item_id";
  const { results } = await env.DB.prepare(
    `SELECT a.item_id AS id, a.owned_count, a.max_count, a.total_users, m.name, m.limited
     FROM analytics_daily a LEFT JOIN ${join}
     WHERE a.snap_date = ? AND a.kind = ? ORDER BY a.item_id`
  ).bind(date, kind).all();
  if (!results.length) return jsonResponse({ error: "no_data", message: "指定日の集計データがありません" }, 404);
  return jsonResponse({
    kind, date,
    totalUsers: results[0].total_users,
    items: results.map(r => ({
      id: r.id, name: r.name || `No.${r.id}`, limited: !!r.limited,
      ownedCount: r.owned_count, maxCount: r.max_count
    }))
  }, 200);
}

// GET /api/analytics/trend?kind=unit&id=12&days=90（ログイン必須）：特定IDの推移（今後のレポート・グラフ用）
async function handleAnalyticsTrend(request, env, url) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  const kind = url.searchParams.get("kind");
  const idRaw = url.searchParams.get("id");
  const daysRaw = url.searchParams.get("days");
  if (!SNAPSHOT_KINDS.has(kind) || !/^\d+$/.test(idRaw || "")) return jsonResponse({ error: "invalid_params" }, 400);
  let days = 90;
  if (daysRaw != null && daysRaw !== "") {
    if (!/^\d+$/.test(daysRaw) || Number(daysRaw) < 1 || Number(daysRaw) > 365) return jsonResponse({ error: "invalid_params" }, 400);
    days = Number(daysRaw);
  }
  const id = Number(idRaw);
  const since = addDays(jstDateString(new Date()), -(days - 1));
  const { results } = await env.DB.prepare(
    `SELECT snap_date, owned_count, max_count, total_users FROM analytics_daily
     WHERE kind = ? AND item_id = ? AND snap_date >= ? ORDER BY snap_date ASC`
  ).bind(kind, id, since).all();
  return jsonResponse({
    kind, id,
    points: results.map(r => ({ date: r.snap_date, ownedCount: r.owned_count, maxCount: r.max_count, totalUsers: r.total_users }))
  }, 200);
}

// ================= ㉒ 自己紹介カード（profile-card.html） =================
// 作品マスター（works_master）の正規ID集合。work_id＝ゲーム内「シリーズ絞り込み」の並び順＝images/series/{id}.png。
// migrations/0012で作品を追加・変更した場合は、この集合も必ず更新すること（ETERNAL_ROAD_MISSION_IDSと同じ運用）
const WORK_IDS = new Set(Array.from({ length: 106 }, (_, i) => i + 1));
const CARD_TEMPLATES = new Set(["standard", "eternal", "units", "formation"]);   // 51：推し編成を追加
const FORMATIONS_MAX = 2, FORMATION_SLOTS = 5, FORMATION_LABEL_MAX = 10;
// ジャングル（"jungle"）は2026-09-24に選択肢から削除。保存済みの"jungle"は読み出し時に"galaxy"として返す
const CARD_THEMES = new Set(["galaxy", "earth", "sky"]);
const PROFILE_BODY_MAX_BYTES = 4096;
const FAVORITES_MAX = 5;
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

// GET /api/works（認証不要）。作品マスター＋作品ごとのURユニット。0011未適用なら{works:[]}を返す
async function handleWorks(request, env) {
  let rows;
  const worksSql = (mapJoin) =>
    `SELECT w.work_id, w.era, w.universe, w.sort_order, w.name, w.short_name, w.timeline_label,
            u.unit_id, u.name AS unit_name, u.type AS unit_type, u.limited AS unit_limited
     FROM works_master w
     LEFT JOIN unit_work_map m ON ${mapJoin}
     LEFT JOIN units_master u ON u.unit_id = m.unit_id
     ORDER BY w.sort_order ASC, w.work_id ASC, u.unit_id ASC`;
  try {
    try {
      // ㊶ 0024適用後：URの行だけにする（SSRの行を混ぜない）
      ({ results: rows } = await env.DB.prepare(worksSql("m.work_id = w.work_id AND m.rarity_code = ?"))
        .bind(RARITY_CODE.UR).all());
    } catch (e) {
      // 0024未適用（rarity_code列が無い）：従来のSQL
      ({ results: rows } = await env.DB.prepare(worksSql("m.work_id = w.work_id")).all());
    }
  } catch (e) {
    return jsonResponse({ works: [] }, 200);
  }
  const works = [];
  const byId = new Map();
  for (const r of rows) {
    let w = byId.get(r.work_id);
    if (!w) {
      w = {
        workId: r.work_id, era: r.era, universe: r.universe, sortOrder: r.sort_order,
        name: r.name, shortName: r.short_name, timeline: r.timeline_label || "", units: []
      };
      byId.set(r.work_id, w);
      works.push(w);
    }
    if (r.unit_id != null) {
      w.units.push({ unitId: r.unit_id, name: r.unit_name, type: r.unit_type, limited: !!r.unit_limited });
    }
  }
  return jsonResponse({ works }, 200, { "Cache-Control": "public, max-age=3600" });
}

// ㊶ GET /api/tags（認証不要）。有効なタグ＋ユニットへのタグ付与（UR・SSR）。0025未適用なら空配列
async function handleTags(request, env) {
  let tags, unitTags;
  try {
    ({ results: tags } = await env.DB.prepare(
      `SELECT tag_id, name, category, applies_to, sort_order FROM tags_master
       WHERE is_active = 1 ORDER BY sort_order ASC, tag_id ASC`
    ).all());
    ({ results: unitTags } = await env.DB.prepare(
      `SELECT rarity_code, unit_id, tag_id FROM units_tags ORDER BY rarity_code, unit_id, tag_id`
    ).all());
  } catch (e) {
    return jsonResponse({ tags: [], unitTags: [] }, 200);
  }
  return jsonResponse({
    tags: tags.map(r => ({ tagId: r.tag_id, name: r.name, category: r.category, appliesTo: r.applies_to, sortOrder: r.sort_order })),
    unitTags: unitTags.map(r => ({ rarityCode: r.rarity_code, unitId: r.unit_id, tagId: r.tag_id }))
  }, 200, { "Cache-Control": "public, max-age=3600" });
}

// 51 GET /api/leader-skills（認証不要）。URサポーターのリーダースキル（ルールと対象）。0029未適用なら空配列
async function handleLeaderSkills(request, env) {
  let rules, targets;
  try {
    ({ results: rules } = await env.DB.prepare(
      `SELECT supporter_id, rule_no, rate_lv0, rate_lv1, rate_lv2, rate_lv3 FROM supporters_leader_rules ORDER BY supporter_id, rule_no`
    ).all());
    ({ results: targets } = await env.DB.prepare(
      `SELECT supporter_id, rule_no, cond_no, target_kind, target_id FROM supporters_leader_targets ORDER BY supporter_id, rule_no, cond_no, target_id`
    ).all());
  } catch (e) {
    return jsonResponse({ rules: [], targets: [] }, 200);
  }
  return jsonResponse({
    rules: rules.map(r => ({ supporterId: r.supporter_id, ruleNo: r.rule_no, rates: [r.rate_lv0, r.rate_lv1, r.rate_lv2, r.rate_lv3] })),
    targets: targets.map(r => ({ supporterId: r.supporter_id, ruleNo: r.rule_no, condNo: r.cond_no, kind: r.target_kind, id: r.target_id }))
  }, 200, { "Cache-Control": "public, max-age=3600" });
}

// 所持データの集計（unit.html／supporter.htmlのcomputeStats()と同じ定義）
async function computeOwnershipStats(env, userUid, isSupporter) {
  const masterTable = isSupporter ? "supporters_master" : "units_master";
  const ownershipTable = isSupporter ? "supporters_ownership" : "units_ownership";
  const idColumn = isSupporter ? "supporter_id" : "unit_id";
  const attrColumn = isSupporter ? "skill" : "type";
  const registeredColumn = isSupporter ? "supporters_first_registered_at" : "units_first_registered_at";
  const attrs = isSupporter ? ["HP回復", "EN回復", "複合"] : ["攻撃", "支援", "耐久"];

  const userRow = await env.DB.prepare(
    `SELECT ${registeredColumn} AS registeredAt FROM users WHERE user_uid = ?`
  ).bind(userUid).first();
  const { results: master } = await env.DB.prepare(
    `SELECT ${idColumn} AS id, ${attrColumn} AS attr, limited FROM ${masterTable}`
  ).all();
  const { results: owned } = await env.DB.prepare(
    `SELECT ${idColumn} AS id, level FROM ${ownershipTable} WHERE user_uid = ?`
  ).bind(userUid).all();

  const byId = new Map(master.map(m => [m.id, m]));
  const ownership = {};
  for (const r of owned) if (byId.has(r.id)) ownership[String(r.id)] = r.level; // マスターに無いIDは数えない
  const ids = Object.keys(ownership).map(Number);
  const levels = ids.map(id => ownership[String(id)]);
  const total = master.length;
  const byType = {};
  for (const a of attrs) byType[a] = { owned: 0, total: 0 };
  for (const m of master) if (byType[m.attr]) byType[m.attr].total++;
  for (const id of ids) { const m = byId.get(id); if (byType[m.attr]) byType[m.attr].owned++; }
  return {
    registered: !!(userRow && userRow.registeredAt),
    total,
    owned: ids.length,
    pct: total ? Math.round(ids.length / total * 100) : 0,
    avgLevel: ids.length ? levels.reduce((a, b) => a + b, 0) / ids.length : 0,
    maxCount: levels.filter(l => l === 3).length,
    limitedOwned: ids.filter(id => byId.get(id).limited).length,
    limitedTotal: master.filter(m => m.limited).length,
    byType,
    ownership
  };
}

// エタロのクリア済みIDと獲得称号。0008〜0010未適用の環境ではnull
async function loadEternalRoadForCard(env, userUid) {
  try {
    const userRow = await env.DB.prepare(
      "SELECT eternal_road_first_registered_at AS registeredAt FROM users WHERE user_uid = ?"
    ).bind(userUid).first();
    const { results: stages } = await env.DB.prepare(
      "SELECT DISTINCT stage_id FROM eternal_road_stage_clears WHERE user_uid = ? ORDER BY stage_id"
    ).bind(userUid).all();
    const { results: missions } = await env.DB.prepare(
      "SELECT DISTINCT mission_id FROM eternal_road_mission_clears WHERE user_uid = ? ORDER BY mission_id"
    ).bind(userUid).all();
    const { results: titles } = await env.DB.prepare(
      `SELECT m.mission_id, m.title_name FROM eternal_road_missions m
       WHERE m.is_title = 1 AND EXISTS (SELECT 1 FROM eternal_road_mission_clears c WHERE c.user_uid = ? AND c.mission_id = m.mission_id)
       ORDER BY m.sort_order`
    ).bind(userUid).all();
    return {
      registered: !!(userRow && userRow.registeredAt),
      clearedStageIds: stages.map(r => r.stage_id),
      clearedMissionIds: missions.map(r => r.mission_id),
      earnedTitles: titles.map(r => ({ missionId: r.mission_id, titleName: r.title_name }))
    };
  } catch (e) {
    return null;
  }
}

// 保存済みプロフィール（4.2のprofile形式）。未作成・0011未適用なら既定値。
// 推し作品はworks_masterに無いものを、推しユニットは現在所持していないものを除く
async function loadProfile(env, userUid, earnedTitles) {
  const empty = {
    displayName: null, comment: null, titleMissionId: null,
    cardTemplate: "standard", cardTheme: "galaxy",
    favoriteWorks: [], favoriteUnits: [], updatedAt: null,
    cardOptions: Object.assign({}, CARD_OPTIONS_DEFAULT),
    formations: []
  };
  let row, works, units;
  try {
    row = await env.DB.prepare(
      `SELECT display_name, comment, title_mission_id, card_template, card_theme, updated_at
       FROM user_profiles WHERE user_uid = ?`
    ).bind(userUid).first();
    ({ results: works } = await env.DB.prepare(
      `SELECT f.slot, f.work_id FROM user_favorite_works f
       JOIN works_master w ON w.work_id = f.work_id
       WHERE f.user_uid = ? ORDER BY f.slot`
    ).bind(userUid).all());
    try {
      // ㊶ 0024適用後：URの行だけ（rarity_code = UR）
      ({ results: units } = await env.DB.prepare(
        `SELECT f.slot, f.unit_id FROM user_favorite_units f
         WHERE f.user_uid = ? AND f.rarity_code = ?
           AND EXISTS (SELECT 1 FROM units_ownership o WHERE o.user_uid = f.user_uid AND o.unit_id = f.unit_id)
         ORDER BY f.slot`
      ).bind(userUid, RARITY_CODE.UR).all());
    } catch (e) {
      // 0024未適用（rarity_code列が無い）：従来のSQL
      ({ results: units } = await env.DB.prepare(
        `SELECT f.slot, f.unit_id FROM user_favorite_units f
         WHERE f.user_uid = ? AND EXISTS (SELECT 1 FROM units_ownership o WHERE o.user_uid = f.user_uid AND o.unit_id = f.unit_id)
         ORDER BY f.slot`
      ).bind(userUid).all());
    }
  } catch (e) {
    return empty;
  }
  const titleIds = new Set((earnedTitles || []).map(t => t.missionId));
  return {
    displayName: row ? row.display_name : null,
    comment: row ? row.comment : null,
    titleMissionId: row && titleIds.has(row.title_mission_id) ? row.title_mission_id : null,
    cardTemplate: row && CARD_TEMPLATES.has(row.card_template) ? row.card_template : "standard",
    cardTheme: row && CARD_THEMES.has(row.card_theme) ? row.card_theme : "galaxy",
    favoriteWorks: works.map(r => ({ slot: r.slot, workId: r.work_id })),
    favoriteUnits: units.map(r => ({ slot: r.slot, unitId: r.unit_id, rarityCode: RARITY_CODE.UR })),
    updatedAt: row ? row.updated_at : null,
    cardOptions: row ? await loadCardOptions(env, userUid) : Object.assign({}, CARD_OPTIONS_DEFAULT),
    formations: await loadFormations(env, userUid)
  };
}

// 51 推し編成（user_formations・user_formation_units）。現在所持していないサポーターはnull、所持していないユニットは除く（slotは詰めない）。
// サポーターもユニットも無い編成は返さない。0029未適用なら空配列
async function loadFormations(env, userUid) {
  try {
    const { results: fRows } = await env.DB.prepare(
      `SELECT f.formation_no, f.label,
              CASE WHEN EXISTS (SELECT 1 FROM supporters_ownership so WHERE so.user_uid = f.user_uid AND so.supporter_id = f.supporter_id)
                   THEN f.supporter_id ELSE NULL END AS supporter_id
       FROM user_formations f WHERE f.user_uid = ? ORDER BY f.formation_no`
    ).bind(userUid).all();
    const { results: uRows } = await env.DB.prepare(
      `SELECT u.formation_no, u.slot, u.rarity_code, u.unit_id FROM user_formation_units u
       WHERE u.user_uid = ? AND u.rarity_code = ?
         AND EXISTS (SELECT 1 FROM units_ownership o WHERE o.user_uid = u.user_uid AND o.unit_id = u.unit_id)
       ORDER BY u.formation_no, u.slot`
    ).bind(userUid, RARITY_CODE.UR).all();
    const out = [];
    for (const f of fRows) {
      const units = uRows.filter(u => u.formation_no === f.formation_no)
        .map(u => ({ slot: u.slot, rarityCode: u.rarity_code, unitId: u.unit_id }));
      if (f.supporter_id == null && !units.length) continue;
      out.push({ formationNo: f.formation_no, label: f.label, supporterId: f.supporter_id, units });
    }
    return out;
  } catch (e) {
    return [];
  }
}

// ㉚ カードの表示オプション（user_profiles.card_options。JSON文字列）。
// migrations/0016未適用（列が無い）でもプロフィールの読み書きが壊れないよう、この列だけ別のクエリで読み、失敗したら既定値にする
//   acq  : 推しユニットカードに入手日・ガシャ回数を出す（既定 true）
//   memo : 推しユニットカードに入手記録のメモを出す（既定 false。チェッカーのメモは本人用に書かれることが多く、画像で公開される前提ではないため）
const CARD_OPTIONS_DEFAULT = { acq: true, memo: false };
function normalizeCardOptions(value) {
  const out = Object.assign({}, CARD_OPTIONS_DEFAULT);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of Object.keys(CARD_OPTIONS_DEFAULT)) if (typeof value[k] === "boolean") out[k] = value[k];
  }
  return out;
}
async function loadCardOptions(env, userUid) {
  try {
    const r = await env.DB.prepare("SELECT card_options FROM user_profiles WHERE user_uid = ?").bind(userUid).first();
    return normalizeCardOptions(r && r.card_options ? JSON.parse(r.card_options) : null);
  } catch (e) {
    return Object.assign({}, CARD_OPTIONS_DEFAULT);
  }
}

// GET /api/profile-card（ログイン必須）
async function handleProfileCard(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ error: "not_logged_in" }, 401);
  const uid = sessionUser.userUid;

  const [units, supporters, eternalRoad] = await Promise.all([
    computeOwnershipStats(env, uid, false),
    computeOwnershipStats(env, uid, true),
    loadEternalRoadForCard(env, uid)
  ]);
  // 51 推し編成でサポーターの凸を使うため、supporters.ownershipも返す（形はunits.ownershipと同じ）。
  // 画面側にサポーターの名前等のマスターが無いため、supporters.masterとして添える（所持分のみ）
  try {
    const { results: sm } = await env.DB.prepare(
      `SELECT m.supporter_id AS id, m.name, m.limited, m.skill FROM supporters_master m
       WHERE EXISTS (SELECT 1 FROM supporters_ownership o WHERE o.user_uid = ? AND o.supporter_id = m.supporter_id)
       ORDER BY m.supporter_id`
    ).bind(uid).all();
    supporters.master = sm.map(r => ({ id: r.id, name: r.name, limited: !!r.limited, skill: r.skill }));
  } catch (e) { supporters.master = []; }
  // ㉙ 推しユニットカードに入手記録（入手日・ガシャ回数・メモ）を出すため、ユニットの入手記録を添える（/api/my-ownershipのacqと同じ形）
  units.acq = {};
  try {
    const { results: acqRows } = await env.DB.prepare(
      `SELECT unit_id, acquired_on, gasha_pulls, memo FROM units_ownership
       WHERE user_uid = ? AND (acquired_on IS NOT NULL OR gasha_pulls IS NOT NULL OR memo IS NOT NULL)`
    ).bind(uid).all();
    for (const r of acqRows) {
      const rec = {};
      if (r.acquired_on != null) rec.d = r.acquired_on;
      if (r.gasha_pulls != null) rec.n = r.gasha_pulls;
      if (r.memo != null) rec.m = r.memo;
      units.acq[String(r.unit_id)] = rec;
    }
  } catch (e) { /* 0013未適用などで失敗しても、カードは入手記録なしで描く */ }
  const profile = await loadProfile(env, uid, eternalRoad ? eternalRoad.earnedTitles : []);

  return jsonResponse({ username: sessionUser.username, profile, units, supporters, eternalRoad, titles: null }, 200);
}

// 表示名・ひとことの正規化。不正ならundefinedを返す
function normalizeProfileText(value, maxLen, allowNewline) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  let s = allowNewline ? value.replace(/\r\n|\r|\n/g, " ") : value;
  s = s.trim();
  if (!s) return null;
  if (CONTROL_CHARS.test(s)) return undefined;
  if ([...s].length > maxLen) return undefined; // サロゲートペア（絵文字等）を1文字として数える
  return s;
}

// 推し作品・推しユニットの配列。6件以上・配列でない→null（400）。許可集合外は読み飛ばし、重複は後ろを捨てる
function normalizeFavoriteIds(value, allowed) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > FAVORITES_MAX) return null;
  const out = [];
  for (const v of value) {
    if (Number.isInteger(v) && allowed.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

// 51 推し編成の保存値を検証・正規化する。formationsが無い→null（保存しない）。不正→undefined（400）。
// 戻り値：[{ label, supporterId, units:[{slot, unitId}] }]（最大2件。サポーターもユニットも無い編成は除く）
async function normalizeFormations(env, uid, value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > FORMATIONS_MAX) return undefined;
  const { results: ownedUnits } = await env.DB.prepare("SELECT DISTINCT unit_id FROM units_ownership WHERE user_uid = ?").bind(uid).all();
  let ownedSupporters = new Set();
  try {
    const { results } = await env.DB.prepare("SELECT supporter_id FROM supporters_ownership WHERE user_uid = ?").bind(uid).all();
    ownedSupporters = new Set(results.map(r => r.supporter_id));
  } catch (e) { /* 所持なし扱い */ }
  const ownedU = new Set(ownedUnits.map(r => r.unit_id));
  const usedUnits = new Set(), usedSupporters = new Set();
  const out = [];
  for (const f of value) {
    if (!f || typeof f !== "object" || Array.isArray(f)) return undefined;
    const label = normalizeProfileText(f.label, FORMATION_LABEL_MAX, false);
    if (label === undefined) return undefined;
    if (f.units != null && (!Array.isArray(f.units) || f.units.length > FORMATION_SLOTS)) return undefined;
    // 2つの編成で同じサポーター・ユニットは使えない（後の編成の重複は読み飛ばす）
    const supporterId = Number.isInteger(f.supporterId) && ownedSupporters.has(f.supporterId) && !usedSupporters.has(f.supporterId)
      ? f.supporterId : null;
    if (supporterId != null) usedSupporters.add(supporterId);
    const units = [];
    (f.units || []).forEach((id, i) => {
      if (Number.isInteger(id) && ownedU.has(id) && !usedUnits.has(id)) { usedUnits.add(id); units.push({ slot: i + 1, unitId: id }); }
    });
    if (supporterId == null && !units.length) continue;
    out.push({ label, supporterId, units });
  }
  return out;
}

// POST /api/profile（ログイン必須）
async function handleSaveProfile(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ error: "not_logged_in" }, 401);
  const uid = sessionUser.userUid;

  let body;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > PROFILE_BODY_MAX_BYTES) throw new Error("too large");
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not object");
  } catch (e) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const displayName = normalizeProfileText(body.displayName, 16, false);
  if (displayName === undefined) return jsonResponse({ error: "invalid_display_name" }, 400);
  const comment = normalizeProfileText(body.comment, 60, true);   // 2026-09-27に40→60（profile-card.htmlのCOMMENT_MAXと合わせる）
  if (comment === undefined) return jsonResponse({ error: "invalid_comment" }, 400);

  const favoriteWorks = normalizeFavoriteIds(body.favoriteWorks, WORK_IDS);
  if (!favoriteWorks) return jsonResponse({ error: "invalid_favorites" }, 400);
  const { results: ownedRows } = await env.DB.prepare(
    "SELECT DISTINCT unit_id FROM units_ownership WHERE user_uid = ?"
  ).bind(uid).all();
  const favoriteUnits = normalizeFavoriteIds(body.favoriteUnits, new Set(ownedRows.map(r => r.unit_id)));
  if (!favoriteUnits) return jsonResponse({ error: "invalid_favorite_units" }, 400);

  const eternalRoad = await loadEternalRoadForCard(env, uid);
  const earnedIds = new Set(eternalRoad ? eternalRoad.earnedTitles.map(t => t.missionId) : []);
  const titleMissionId = Number.isInteger(body.titleMissionId) && earnedIds.has(body.titleMissionId) ? body.titleMissionId : null;
  const cardTemplate = CARD_TEMPLATES.has(body.cardTemplate) ? body.cardTemplate : "standard";
  const cardTheme = CARD_THEMES.has(body.cardTheme) ? body.cardTheme : "galaxy";

  // 51 推し編成。formationsが送られてこなければ保存済みの値を変えない（nullなら触らない）
  const formations = await normalizeFormations(env, uid, body.formations);
  if (formations === undefined) return jsonResponse({ error: "invalid_formations" }, 400);

  const nowJst = toJstIsoString(new Date());
  const statements = [
    env.DB.prepare(
      `INSERT INTO user_profiles (user_uid, display_name, comment, title_mission_id, card_template, card_theme, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_uid) DO UPDATE SET display_name = excluded.display_name, comment = excluded.comment,
         title_mission_id = excluded.title_mission_id, card_template = excluded.card_template,
         card_theme = excluded.card_theme, updated_at = excluded.updated_at`
    ).bind(uid, displayName, comment, titleMissionId, cardTemplate, cardTheme, nowJst),
    env.DB.prepare("DELETE FROM user_favorite_works WHERE user_uid = ?").bind(uid),
    ...favoriteWorks.map((id, i) =>
      env.DB.prepare("INSERT INTO user_favorite_works (user_uid, slot, work_id) VALUES (?, ?, ?)").bind(uid, i + 1, id)),
    env.DB.prepare("DELETE FROM user_favorite_units WHERE user_uid = ?").bind(uid),
    ...favoriteUnits.map((id, i) =>
      env.DB.prepare("INSERT INTO user_favorite_units (user_uid, slot, unit_id) VALUES (?, ?, ?)").bind(uid, i + 1, id)),
    env.DB.prepare("UPDATE users SET last_seen = ? WHERE user_uid = ?").bind(new Date().toISOString(), uid)
  ];
  await env.DB.batch(statements);
  // ㉚ 表示オプションは0016未適用でも保存全体が失敗しないよう、バッチの外で別に更新する（失敗は無視＝既定値で表示される）。
  // cardOptionsを送ってこない（㉚より前の画面を開いたままの）保存では、保存済みの値を変えない
  if (body.cardOptions && typeof body.cardOptions === "object" && !Array.isArray(body.cardOptions)) {
    try {
      await env.DB.prepare("UPDATE user_profiles SET card_options = ? WHERE user_uid = ?")
        .bind(JSON.stringify(normalizeCardOptions(body.cardOptions)), uid).run();
    } catch (e) { /* migrations/0016 未適用 */ }
  }

  // 51 推し編成は別のバッチ。0029未適用でも他の保存は成功させる
  if (formations) {
    try {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM user_formation_units WHERE user_uid = ?").bind(uid),
        env.DB.prepare("DELETE FROM user_formations WHERE user_uid = ?").bind(uid),
        ...formations.flatMap((f, i) => [
          env.DB.prepare("INSERT INTO user_formations (user_uid, formation_no, label, supporter_id, updated_at) VALUES (?, ?, ?, ?, ?)")
            .bind(uid, i + 1, f.label, f.supporterId, nowJst),
          ...f.units.map(u =>
            env.DB.prepare("INSERT INTO user_formation_units (user_uid, formation_no, slot, rarity_code, unit_id) VALUES (?, ?, ?, ?, ?)")
              .bind(uid, i + 1, u.slot, RARITY_CODE.UR, u.unitId))
        ])
      ]);
    } catch (e) { /* migrations/0029 未適用 */ }
  }

  const profile = await loadProfile(env, uid, eternalRoad ? eternalRoad.earnedTitles : []);
  return jsonResponse({ ok: true, profile }, 200);
}

// ⑮ エタロ攻略チェッカー起動時の復元用（handleMyOwnership()のエタロ版）
async function handleMyEternalRoad(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ loggedIn: false }, 200);

  const userRow = await env.DB.prepare(
    "SELECT eternal_road_first_registered_at AS registeredAt FROM users WHERE user_uid = ?"
  ).bind(sessionUser.userUid).first();
  const { results: missionRows } = await env.DB.prepare(
    "SELECT mission_id FROM eternal_road_mission_clears WHERE user_uid = ? ORDER BY mission_id"
  ).bind(sessionUser.userUid).all();
  const { results: stageRows } = await env.DB.prepare(
    "SELECT stage_id FROM eternal_road_stage_clears WHERE user_uid = ? ORDER BY stage_id"
  ).bind(sessionUser.userUid).all();

  return jsonResponse({
    loggedIn: true,
    registered: !!(userRow && userRow.registeredAt),
    clearedIds: missionRows.map(r => r.mission_id),
    clearedStageIds: stageRows.map(r => r.stage_id)
  }, 200);
}

// ================= ㊵ チャレンジミッションチェッカー（メインステージCHALLENGE・HARDのみ。運営者試用） =================
// エタロ（⑩⑮）と同じ保持方式だが、受付IDはworker.js内の固定Setではなくマスター（challenge_stages/challenge_missions）で
// 検証する。新シリーズの追加をD1（migrations）だけで反映でき、worker.jsの変更が不要になるため
const CHALLENGE_CLEAR_MAX_ENTRIES = 200; // 現状15＋30。シリーズが増えても十分な上限

// "1,2,..."形式のカンマ区切りID文字列を、重複なしの整数配列にパースする（マスターとの照合はしない）。
// 件数上限を超える不正に巨大な入力や非整数を含む入力はnull（＝書き込みしない）を返す
function parseChallengeIdListRaw(raw, maxEntries) {
  const parts = (typeof raw === "string" ? raw : "").split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length > maxEntries) return null;
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n))) return null;
  return [...new Set(nums)];
}

// マスターに実在するstage_id・mission_idの集合を毎回D1から取得する（固定Setを持たない）
async function loadChallengeIdSets(env) {
  const [st, ms] = await Promise.all([
    env.DB.prepare("SELECT stage_id FROM challenge_stages").all(),
    env.DB.prepare("SELECT mission_id, stage_id FROM challenge_missions").all()
  ]);
  return {
    stageIds: new Set(st.results.map(r => r.stage_id)),
    missionStage: new Map(ms.results.map(r => [r.mission_id, r.stage_id]))
  };
}

// チャレンジのマスターデータ（シリーズ・ステージ・ミッション）取得。認証不要
async function handleChallengeMaster(request, env) {
  const [series, stages, missions] = await Promise.all([
    env.DB.prepare("SELECT series_code, series_name, short_name, work_id, sort_order, released_on FROM challenge_series ORDER BY sort_order ASC").all(),
    env.DB.prepare("SELECT stage_id, series_code, difficulty, stage_no, stage_label, sort_order FROM challenge_stages ORDER BY sort_order ASC").all(),
    env.DB.prepare(
      `SELECT mission_id, stage_id, mission_slot, mission_type, mission_text, reward, tag_id, tag_name, param, short_label, includes_secret, sort_order
       FROM challenge_missions ORDER BY sort_order ASC`
    ).all()
  ]);
  return jsonResponse({
    series: series.results, stages: stages.results, missions: missions.results
  }, 200, { "Cache-Control": "public, max-age=3600" });
}

// チャレンジチェッカー起動時の復元用（handleMyEternalRoad()のチャレンジ版）
async function handleMyChallenge(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ loggedIn: false }, 200);

  const userRow = await env.DB.prepare(
    "SELECT challenge_first_registered_at AS registeredAt FROM users WHERE user_uid = ?"
  ).bind(sessionUser.userUid).first();
  const { results: stageRows } = await env.DB.prepare(
    "SELECT stage_id FROM challenge_stage_clears WHERE user_uid = ? ORDER BY stage_id"
  ).bind(sessionUser.userUid).all();
  const { results: missionRows } = await env.DB.prepare(
    "SELECT mission_id FROM challenge_mission_clears WHERE user_uid = ? ORDER BY mission_id"
  ).bind(sessionUser.userUid).all();

  return jsonResponse({
    loggedIn: true,
    registered: !!(userRow && userRow.registeredAt),
    clearedStageIds: stageRows.map(r => r.stage_id),
    clearedMissionIds: missionRows.map(r => r.mission_id)
  }, 200);
}

// 所持データ・エタロと同じ「最新スナップショット方式」。送信の都度、そのuser_uidの既存クリア行を全削除してから
// 現在のクリア状態を入れ直す。初回登録日時の更新も同じbatchで行う
async function replaceChallengeClears(env, userUid, missionIds, stageIds) {
  const nowJst = toJstIsoString(new Date());
  const nowUtc = new Date().toISOString();
  const statements = [
    env.DB.prepare("DELETE FROM challenge_mission_clears WHERE user_uid = ?").bind(userUid),
    env.DB.prepare("DELETE FROM challenge_stage_clears WHERE user_uid = ?").bind(userUid)
  ];
  for (const missionId of missionIds) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO challenge_mission_clears (user_uid, mission_id, cleared_at) VALUES (?, ?, ?)"
      ).bind(userUid, missionId, nowJst)
    );
  }
  for (const stageId of stageIds) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO challenge_stage_clears (user_uid, stage_id, cleared_at) VALUES (?, ?, ?)"
      ).bind(userUid, stageId, nowJst)
    );
  }
  statements.push(
    env.DB.prepare(
      `UPDATE users SET challenge_first_registered_at = COALESCE(challenge_first_registered_at, ?), last_seen = ?
       WHERE user_uid = ?`
    ).bind(nowJst, nowUtc, userUid)
  );
  await env.DB.batch(statements);
}

// チャレンジチェッカーの「データ登録」「画像で保存」「Xでシェア」押下時の同期エンドポイント。ログイン必須。
// 未ログイン時はD1への保存を行わない。ミッション達成があるステージはサーバー側でもクリアへ正規化する
async function handleLogChallenge(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) return jsonResponse({ ok: true, loggedIn: false }, 200);

  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  try {
    const rawMissionIds = parseChallengeIdListRaw(body && body.clearedMissionIds, CHALLENGE_CLEAR_MAX_ENTRIES);
    const rawStageIds = parseChallengeIdListRaw(body && body.clearedStageIds, CHALLENGE_CLEAR_MAX_ENTRIES);
    if (rawMissionIds && rawStageIds) {
      const { stageIds: validStageIds, missionStage } = await loadChallengeIdSets(env);
      const missionIds = rawMissionIds.filter(id => missionStage.has(id));
      const stageSet = new Set(rawStageIds.filter(id => validStageIds.has(id)));
      for (const id of missionIds) stageSet.add(missionStage.get(id));
      await replaceChallengeClears(env, sessionUser.userUid, missionIds, [...stageSet].sort((a, b) => a - b));
    }
  } catch (e) {
    console.error("challenge clears write error", e);
  }

  return jsonResponse({ ok: true, loggedIn: true }, 200);
}

// ㉖定時分析用の集計部分（母数はchallenge_first_registered_at IS NOT NULLのユーザー。queryEternalRoadCountsと同じ定義）
async function queryChallengeCounts(env) {
  const REGISTERED_JOIN = "JOIN users u ON u.user_uid = c.user_uid AND u.challenge_first_registered_at IS NOT NULL";

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM users WHERE challenge_first_registered_at IS NOT NULL"
  ).first();
  const totalUsers = totalRow ? totalRow.c : 0;

  const { results: missionRows } = await env.DB.prepare(
    `SELECT m.mission_id, m.stage_id,
            (SELECT COUNT(DISTINCT c.user_uid) FROM challenge_mission_clears c ${REGISTERED_JOIN}
              WHERE c.mission_id = m.mission_id) AS achieved_count
     FROM challenge_missions m
     ORDER BY m.sort_order ASC`
  ).all();

  const { results: clearRows } = await env.DB.prepare(
    `SELECT c.stage_id AS stage_id, COUNT(DISTINCT c.user_uid) AS cleared_count
     FROM challenge_stage_clears c ${REGISTERED_JOIN}
     GROUP BY c.stage_id`
  ).all();

  // ステージ内の全ミッションを達成したユーザー数（ステージごと）
  const { results: perfectRows } = await env.DB.prepare(
    `SELECT x.stage_id AS stage_id, COUNT(*) AS perfect_count
     FROM (SELECT c.user_uid, m.stage_id, COUNT(DISTINCT c.mission_id) AS n
           FROM challenge_mission_clears c ${REGISTERED_JOIN}
           JOIN challenge_missions m ON m.mission_id = c.mission_id
           GROUP BY c.user_uid, m.stage_id) x
     JOIN (SELECT stage_id, COUNT(*) AS total FROM challenge_missions GROUP BY stage_id) t
       ON t.stage_id = x.stage_id
     WHERE x.n = t.total
     GROUP BY x.stage_id`
  ).all();

  return { totalUsers, missionRows, clearRows, perfectRows };
}

async function withJsonError(fn, label) {
  try {
    return await fn();
  } catch (e) {
    console.error(label + " error", e);
    return jsonResponse({ error: "server_error", message: String(e && e.message || e) }, 500);
  }
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
    if (url.pathname === "/api/account/password" && request.method === "POST") {
      return withJsonError(() => handleAccountPassword(request, env), "account-password");
    }

    // 所持データのログ収集エンドポイント（機体版・サポート版共通）
    // ④ ログイン済みユーザーのみunits_ownership/supporters_ownershipに保存。ゲストは匿名カウンタのみ加算
    if ((url.pathname === "/api/log" || url.pathname === "/api/log-supporter") && request.method === "POST") {
      return countCheckerUse(await handleOwnershipLog(request, env, url.pathname === "/api/log-supporter"), env);
    }

    // ④ 所持データ分析（全体所持率ランキング）API。ログイン済みユーザーのみ利用可能
    if ((url.pathname === "/api/analytics/units" || url.pathname === "/api/analytics/supporters") && request.method === "GET") {
      return handleAnalytics(request, env, url.pathname === "/api/analytics/supporters");
    }

    // ⑪ チェッカー起動時に、ログイン中ユーザー自身の所持状況を復元するための読み出し専用API
    if ((url.pathname === "/api/my-ownership" || url.pathname === "/api/my-ownership-supporter") && request.method === "GET") {
      return handleMyOwnership(request, env, url.pathname === "/api/my-ownership-supporter");
    }

    // ⑩ エタロ攻略チェッカー（エキスパート難易度）
    if (url.pathname === "/api/eternal-road/missions" && request.method === "GET") {
      return handleEternalRoadMissions(request, env);
    }
    if (url.pathname === "/api/log-eternal-road-missions" && request.method === "POST") {
      return countCheckerUse(await handleLogEternalRoadMissions(request, env), env);
    }
    if (url.pathname === "/api/my-eternal-road" && request.method === "GET") {
      return handleMyEternalRoad(request, env);
    }
    // データ登録結果レポート（analytics.html）の「エタロ攻略」タブ用の集計API。ログイン必須
    if (url.pathname === "/api/analytics/eternal-road" && request.method === "GET") {
      return handleAnalyticsEternalRoad(request, env);
    }

    // ㊵ チャレンジミッションチェッカー（メインステージCHALLENGE・HARDのみ。運営者試用。画面側のadminGateで制御）
    if (url.pathname === "/api/challenge/master" && request.method === "GET") {
      return handleChallengeMaster(request, env);
    }
    if (url.pathname === "/api/my-challenge" && request.method === "GET") {
      return handleMyChallenge(request, env);
    }
    if (url.pathname === "/api/log-challenge" && request.method === "POST") {
      return countCheckerUse(await handleLogChallenge(request, env), env);
    }

    // ㉒ 自己紹介カード
    // ㉖ 定時分析・運営者用レポート（0014未適用などで失敗した場合も500のJSONで返す）
    if (url.pathname === "/api/admin/me" && request.method === "GET") {
      return handleAdminMe(request, env);
    }
    if (url.pathname === "/api/admin/run-snapshot" && request.method === "POST") {
      return withJsonError(() => handleAdminRunSnapshot(request, env), "run-snapshot");
    }
    // 54 パスワードの運営者リセット・移行状況・一括ハッシュ化
    if (url.pathname === "/api/admin/reset-password" && request.method === "POST") {
      return withJsonError(() => handleAdminResetPassword(request, env), "reset-password");
    }
    if (url.pathname === "/api/admin/usage-stats" && request.method === "GET") {
      return handleAdminUsageStats(request, env);
    }
    if (url.pathname === "/api/admin/password-status" && request.method === "GET") {
      return withJsonError(() => handleAdminPasswordStatus(request, env), "password-status");
    }
    if (url.pathname === "/api/admin/hash-migrate" && request.method === "POST") {
      return withJsonError(() => handleAdminHashMigrate(request, env), "hash-migrate");
    }
    if (url.pathname === "/api/admin/report/weekly" && request.method === "GET") {
      return withJsonError(() => handleAdminWeeklyReport(request, env, url), "weekly-report");
    }
    // ㉘ X投稿用レポート（6種類）の共通データ。weeklyはreport.htmlから使わなくなったが互換のため残す
    if (url.pathname === "/api/admin/report/ownership" && request.method === "GET") {
      return withJsonError(() => handleAdminReportOwnership(request, env, url), "report-ownership");
    }
    if (url.pathname === "/api/analytics/trend" && request.method === "GET") {
      return withJsonError(() => handleAnalyticsTrend(request, env, url), "trend");
    }

    if (url.pathname === "/api/works" && request.method === "GET") {
      return handleWorks(request, env);
    }
    if (url.pathname === "/api/tags" && request.method === "GET") {
      return handleTags(request, env);
    }
    if (url.pathname === "/api/leader-skills" && request.method === "GET") {
      return handleLeaderSkills(request, env);
    }
    if (url.pathname === "/api/profile-card" && request.method === "GET") {
      return handleProfileCard(request, env);
    }
    if (url.pathname === "/api/profile" && request.method === "POST") {
      return handleSaveProfile(request, env);
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
  },

  // ㉖ 定期実行（wrangler.jsonc の triggers.crons：UTC 19:00＝JST 4:00）。PCの電源とは無関係にCloudflare側で動く
  async scheduled(controller, env, ctx) {
    const snapDate = jstDateString(new Date(controller.scheduledTime));
    ctx.waitUntil(runDailySnapshot(env, snapDate).catch(e => {
      console.error("daily snapshot error", snapDate, e);
    }));
    // 54 回数制限の古い記録を掃除（定時分析の結果に影響させないよう別のtry/catch）
    ctx.waitUntil((async () => {
      try {
        const cutoff = new Date(controller.scheduledTime - 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_start < ?").bind(cutoff).run();
      } catch (e) {
        console.error("auth_rate_limits cleanup error", e);
      }
    })());
  }
};
