-- ②ユーザー登録・ログイン機能
-- users テーブルへ username / password カラムを追加し、セッション管理用の sessions テーブルを新設する。
--
-- 注意: パスワードは方針決定によりハッシュ化せず平文で保存する（handover.md記載の当初方針を踏襲）。
-- カラム名は将来ハッシュ化に切り替えた際に紛らわしくならないよう「password」とする
-- （password_hash という名前で平文を入れると将来の実装者を誤解させるため）。
--
-- 適用方法（このリポジトリにはwranglerのローカル実行環境がないため、以下いずれかで手動適用する）:
--   1. Cloudflareダッシュボード > Workers & Pages > D1 > 対象DB(ggene-ur-checker-db) > Console タブに
--      このファイルの内容を貼り付けて実行する
--   2. ローカルにwranglerがある場合: npx wrangler d1 execute ggene-ur-checker-db --remote --file=migrations/0001_add_user_auth.sql

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN password TEXT;

-- username はNULL可（未登録の匿名ユーザーを将来扱う可能性を考慮）だが、登録済みユーザー間では一意にする。
-- SQLiteのUNIQUE INDEXはNULL同士を重複とみなさないため、未登録ユーザーが複数いても衝突しない。
CREATE UNIQUE INDEX idx_users_username ON users(username);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);

CREATE INDEX idx_sessions_user_uid ON sessions(user_uid);
