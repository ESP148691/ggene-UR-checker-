-- ㊵ チャレンジミッションチェッカー（メインステージCHALLENGE）：テーブル定義
-- 保持方法はエタロ攻略チェッカー（0008・0010）と同じ：マスター＋達成スナップショット＋ステージクリア＋初回登録日時
-- シリーズ表 challenge_series を新設し、ステージ表からシリーズ名・work_idを外した（表記・並び順・バナーを1か所で管理）
-- 対象はHARDステージのみ（2026-09-29 ユーザー決定：ノーマルのクリア状況は記録しない）
-- 適用順：このSQL → 0021（マスター）をD1に適用 → その後に worker.js・challenge.html をpush
-- 最後のALTER TABLEだけは再実行すると duplicate column エラーになる（＝適用済みの意味。無視してよい）

-- シリーズ（CHALLENGEの作品）。series_code は追加された順に振り、振り直さない（stage_id の百の位）
CREATE TABLE IF NOT EXISTS challenge_series (
  series_code  INTEGER PRIMARY KEY,          -- 1＝ガンダム 2＝SEED 3＝Ζ 4＝W 5＝ΖΖ（追加順。新シリーズは6から）
  series_name  TEXT NOT NULL,                -- 作品の公式タイトル（㉚の表記ルール：Ζはギリシャ文字）
  short_name   TEXT NOT NULL,                -- タブ・画像用の短い名前
  work_id      INTEGER,                      -- works_master.work_id（作品ロゴ images/series/{work_id}.png）
  sort_order   INTEGER NOT NULL,             -- 画面の並び順（追加順＝series_codeと同じ。ユーザー決定）
  released_on  TEXT                          -- CHALLENGEに追加された日（分かる分だけ）
);

-- ステージ（HARDのみ）。stage_id ＝ series_code*100 + 90 + stage_no　例：ガンダムのHARD-2＝192、ΖΖのHARD-3＝593
--   ＋90は当初案の採番のまま（ノーマルを将来入れる場合に series_code*100 + stage_no を空けておくため）
CREATE TABLE IF NOT EXISTS challenge_stages (
  stage_id     INTEGER PRIMARY KEY,
  series_code  INTEGER NOT NULL,
  difficulty   TEXT NOT NULL DEFAULT 'HARD', -- 現状は 'HARD' のみ
  stage_no     INTEGER NOT NULL,
  stage_label  TEXT NOT NULL,                -- 画面の表記（HARD-2）
  sort_order   INTEGER NOT NULL,
  confidence   TEXT NOT NULL,
  FOREIGN KEY (series_code) REFERENCES challenge_series(series_code)
);
CREATE INDEX IF NOT EXISTS idx_challenge_stages_series ON challenge_stages(series_code);

-- ミッション。mission_id ＝ stage_id*10 + mission_slot（エタロと同じ規則）
CREATE TABLE IF NOT EXISTS challenge_missions (
  mission_id      INTEGER PRIMARY KEY,
  stage_id        INTEGER NOT NULL,
  mission_slot    INTEGER NOT NULL,
  mission_type    TEXT NOT NULL,             -- 'tag'（タグ縛り）| 'series'（シリーズ縛り）| 'turn'（nターン以内）| 'other'
  mission_text    TEXT NOT NULL,             -- ゲーム内の文言
  reward          TEXT NOT NULL,
  tag_id          INTEGER,                   -- 将来のタグマスター適用時のtag_id（tagのとき）
  tag_name        TEXT,                      -- タグ名（タグマスター未適用でも表示できるよう文字でも持つ）
  param           TEXT,                      -- series＝作品名、turn＝ターン数
  short_label     TEXT,                      -- チップの表記（例「赤色縛り」「0083縛り」「2ターン」）。NULLなら画面側で組み立てる
  includes_secret INTEGER NOT NULL DEFAULT 0, -- 「（シークレットバトル含む）」
  confidence      TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  FOREIGN KEY (stage_id) REFERENCES challenge_stages(stage_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_missions_stage ON challenge_missions(stage_id);

-- 達成状況（最新スナップショット。保存のたびにそのユーザーの行を入れ直す＝エタロと同じ）
CREATE TABLE IF NOT EXISTS challenge_mission_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  mission_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);
CREATE INDEX IF NOT EXISTS idx_challenge_mission_clears_user ON challenge_mission_clears(user_uid);

-- ステージクリア（ミッション達成があるステージは必ずクリア行を持つ＝サーバーで正規化。エタロの0010と同じ）
CREATE TABLE IF NOT EXISTS challenge_stage_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  stage_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);
CREATE INDEX IF NOT EXISTS idx_challenge_stage_clears_user ON challenge_stage_clears(user_uid);

-- 「登録済みで0件」と「未登録」を区別する（⑫・⑮と同じ）
ALTER TABLE users ADD COLUMN challenge_first_registered_at TEXT;
