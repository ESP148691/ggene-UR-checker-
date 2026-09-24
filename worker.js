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
//
// ⑬ 補足（2026-09-22時点で懸念、2026-09-23訂正）：所持率100%超え不具合の調査当初、複数端末・
// 複数タブからの送信競合で同一(user_uid, idColumn)の重複行が残る可能性を懸念し、この関数をON
// CONFLICTによるUPSERT方式に変更する改善案を検討したが、本番D1で実際に確認した結果、重複行は
// 存在しなかった。真の原因はmigrations/0006のバックフィル適用とworker.jsデプロイの間の「デプロイ
// ギャップ」で、これは冪等なバックフィルSQLの再実行のみで解消済み（詳細はdocs/⑬所持率100%超え
// 不具合_調査と改善設計.md末尾の訂正）。そのため、この関数のUPSERT化・migrations/0007
// （一意インデックス追加案）は前提が誤りだったとして見送りのまま据え置く（適用しない）
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

// ⑩ エタロ攻略チェッカー（エキスパート難易度）。
// マスターに実在するmission_id（stage_id*10+slotのため1〜N連番ではなく飛び飛び）の正規集合。
// units_ownership等のMAX_UNIT_ID方式（範囲チェック）が使えないため、代わりに集合の包含チェックを行う。
// migrations/0009でこのマスターデータを追加・変更した場合は、この集合も必ず更新すること
const ETERNAL_ROAD_MISSION_IDS = new Set([
  11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 51, 52, 61, 62, 71, 72, 81, 82, 91, 92,
  101, 102, 111, 112, 121, 122, 131, 132, 133, 141, 142, 143, 151, 152, 161, 162,
  171, 172, 173, 181, 182, 183, 191, 192, 201, 202, 211, 212, 221, 222, 223,
  231, 232, 233, 241, 242, 243, 251, 252, 253, 261, 262, 271, 272, 281, 282, 291, 292
]);
const ETERNAL_ROAD_CLEAR_MAX_ENTRIES = 100; // 想定最大69件より十分大きい安全マージン
// ⑮ 通常クリア（ステージクリア）用のstage_id正規集合（29件）。ステージのマスターテーブルは持たないため
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
async function handleAnalyticsEternalRoad(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) {
    return jsonResponse({ error: "not_logged_in", message: "ログインが必要です" }, 401);
  }

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

// ================= ㉒ 自己紹介カード（profile-card.html） =================
// 作品マスター（works_master）の正規ID集合。work_id＝ゲーム内「シリーズ絞り込み」の並び順＝images/series/{id}.png。
// migrations/0012で作品を追加・変更した場合は、この集合も必ず更新すること（ETERNAL_ROAD_MISSION_IDSと同じ運用）
const WORK_IDS = new Set(Array.from({ length: 106 }, (_, i) => i + 1));
const CARD_TEMPLATES = new Set(["standard", "eternal", "units"]);
// ジャングル（"jungle"）は2026-09-24に選択肢から削除。保存済みの"jungle"は読み出し時に"galaxy"として返す
const CARD_THEMES = new Set(["galaxy", "earth", "sky"]);
const PROFILE_BODY_MAX_BYTES = 4096;
const FAVORITES_MAX = 5;
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

// GET /api/works（認証不要）。作品マスター＋作品ごとのURユニット。0011未適用なら{works:[]}を返す
async function handleWorks(request, env) {
  let rows;
  try {
    ({ results: rows } = await env.DB.prepare(
      `SELECT w.work_id, w.era, w.universe, w.sort_order, w.name, w.short_name, w.timeline_label,
              u.unit_id, u.name AS unit_name, u.type AS unit_type, u.limited AS unit_limited
       FROM works_master w
       LEFT JOIN unit_work_map m ON m.work_id = w.work_id
       LEFT JOIN units_master u ON u.unit_id = m.unit_id
       ORDER BY w.sort_order ASC, w.work_id ASC, u.unit_id ASC`
    ).all());
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
    favoriteWorks: [], favoriteUnits: [], updatedAt: null
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
    ({ results: units } = await env.DB.prepare(
      `SELECT f.slot, f.unit_id FROM user_favorite_units f
       WHERE f.user_uid = ? AND EXISTS (SELECT 1 FROM units_ownership o WHERE o.user_uid = f.user_uid AND o.unit_id = f.unit_id)
       ORDER BY f.slot`
    ).bind(userUid).all());
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
    favoriteUnits: units.map(r => ({ slot: r.slot, unitId: r.unit_id })),
    updatedAt: row ? row.updated_at : null
  };
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
  delete supporters.ownership; // サポートの所持内訳はカードで使わない
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
  const comment = normalizeProfileText(body.comment, 40, true);
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

    // ⑩ エタロ攻略チェッカー（エキスパート難易度）
    if (url.pathname === "/api/eternal-road/missions" && request.method === "GET") {
      return handleEternalRoadMissions(request, env);
    }
    if (url.pathname === "/api/log-eternal-road-missions" && request.method === "POST") {
      return handleLogEternalRoadMissions(request, env);
    }
    if (url.pathname === "/api/my-eternal-road" && request.method === "GET") {
      return handleMyEternalRoad(request, env);
    }
    // データ登録結果レポート（analytics.html）の「エタロ攻略」タブ用の集計API。ログイン必須
    if (url.pathname === "/api/analytics/eternal-road" && request.method === "GET") {
      return handleAnalyticsEternalRoad(request, env);
    }

    // ㉒ 自己紹介カード
    if (url.pathname === "/api/works" && request.method === "GET") {
      return handleWorks(request, env);
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
  }
};
