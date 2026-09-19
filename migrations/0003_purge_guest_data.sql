-- ④ 分析ページ実装にあたり、ゲスト（未ログイン）の所持データ保存を廃止する。
--
-- 背景: ゲストの識別子（guestUid）はクライアント側のlocalStorageで発行される仕組みのため、
-- 実際には「人」ではなく「ブラウザのlocalStorageインスタンス」単位の識別になっている。
-- 同一人物でもブラウザを変える・シークレットモードを使う・localStorageをクリアする・複数端末で使う、
-- といった操作のたびに新しいguestUidが発行され、usersテーブル上は別人として登録されるため、
-- 分析ページで「真の所持率」を計算する前提が崩れる。worker.js側の保存ロジックは既にログイン済み
-- ユーザーのみを対象とするよう変更済み（handleOwnershipLog）。このマイグレーションは、
-- それ以前に蓄積された既存のゲスト所持データ・ゲストユーザー行を一括削除するもの。
--
-- 適用方法（このリポジトリにはwranglerのローカル実行環境がないため、以下いずれかで手動適用する）:
--   1. Cloudflareダッシュボード > Workers & Pages > D1 > 対象DB(ggene-ur-checker-db) > Console タブに
--      このファイルの内容を貼り付けて実行する
--   2. ローカルにwranglerがある場合: npx wrangler d1 execute ggene-ur-checker-db --remote --file=migrations/0003_purge_guest_data.sql
--
-- 適用後、usersテーブルは「登録済みアカウント（username IS NOT NULL）のみ」になる。

DELETE FROM units_ownership WHERE user_uid IN (SELECT user_uid FROM users WHERE username IS NULL);
DELETE FROM supporters_ownership WHERE user_uid IN (SELECT user_uid FROM users WHERE username IS NULL);
DELETE FROM users WHERE username IS NULL;
