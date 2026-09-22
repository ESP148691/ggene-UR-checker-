-- migrations/0008_eternal_road_missions.sql
-- ⑩ エタロ攻略チェッカー（エキスパート難易度）のテーブル定義。
-- 元の設計（docs/⑩エタロ攻略チェッカー_エキスパート詳細設計.md 5章）では
-- migrations/0005_eternal_road_missions.sqlという名前だったが、その番号は
-- ⑪（JST化）で既に使用済みだったため、実装時に0008へ繰り下げた。
--
-- 1ステージに最大3つの独立したミッション（報酬付き）がある構成のため、
-- 「ステージ」ではなく「ミッション」を主キーとしたテーブル設計にしている。
-- クリア状況は他チェッカー（units_ownership等）と同じ「最新スナップショット方式」
-- （同期の都度、既存行を削除して入れ直す）を踏襲する。

CREATE TABLE eternal_road_missions (
  mission_id INTEGER PRIMARY KEY,      -- stage_id*10+slot（例: 11, 12, 13）
  stage_id INTEGER NOT NULL,           -- エキスパートNo.（1〜29）
  stage_name TEXT NOT NULL,
  mission_slot INTEGER NOT NULL,       -- 1〜3
  mission_type TEXT NOT NULL,          -- 'dev' / 'survive' / 'tag' / 'sr'
  mission_text TEXT NOT NULL,
  reward TEXT NOT NULL,
  is_title INTEGER NOT NULL DEFAULT 0, -- 称号報酬か（0/1）
  tag TEXT,                            -- タグ縛りの対象タグ名（type='tag'/'sr'のみ）
  title_name TEXT,                     -- 称号名（is_title=1のみ）
  confidence TEXT NOT NULL,            -- '確認済' / '実機確認済'
  sort_order INTEGER NOT NULL
);

CREATE TABLE eternal_road_mission_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  mission_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid),
  FOREIGN KEY (mission_id) REFERENCES eternal_road_missions(mission_id)
);
