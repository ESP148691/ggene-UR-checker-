-- migrations/0006_add_first_registered_flag.sql
-- 「URを1件も所持していないユーザがデータ登録したケース」と
-- 「そもそもデータ登録していないユーザのケース」を区別するためのカラムを追加する。
--
-- 背景: units_ownership / supporters_ownership は「その時点の所持状況のスナップショット」
-- のみを保持する（送信のたびに全削除→入れ直し）ため、所持数0で登録した場合はDBに
-- 行が一切残らず、「未登録」と区別できない。これにより analytics.html の同期案内
-- （syncNote）が、登録済み・所持0のユーザーにも「まだ同期されていません」と誤表示していた。
-- 加えて、handleAnalytics()の所持率（ownedRate）の母数totalUsersも、本カラムを使って
-- 「該当種別でデータ登録済みのユーザーのみ」に絞り込む変更を行う（worker.js側で対応）。
--
-- 方針: users テーブルに、ユニット／サポートそれぞれの初回データ登録日時（JST・TEXT）を追加。
-- 非NULLかどうかを「登録済みフラグ」として使う（IS NOT NULL 判定）。
-- ユニット／サポートを分けるのは、一方のチェッカーしか使わないユーザーの状態を
-- 正しく表現するため。
--
-- 冪等性: ALTER TABLE ADD COLUMN は再実行するとエラーになる（カラムが既に存在するため）。
-- 一度だけ適用すること。バックフィルのUPDATEは WHERE ... IS NULL を条件に含めているため、
-- 誤って複数回実行しても既にセット済みの値は上書きされない（冪等）。
--
-- 適用方法: 既存の0001〜0005と同様、Cloudflareダッシュボード（D1 > Console）で手動実行する。
-- worker.js側のコード修正（今後の新規登録分の自動フラグ立て）とは独立しているが、
-- 運用上は「このバックフィルを先に適用 → worker.jsをデプロイ」の順を推奨する
-- （逆順だと、デプロイ直後の一瞬、既存ユーザーが軒並み「未登録」に見えてしまうため）。

-- ---- 適用前：対象件数の目安を確認 ----
-- SELECT COUNT(DISTINCT user_uid) FROM units_ownership;
-- SELECT COUNT(DISTINCT user_uid) FROM supporters_ownership;

ALTER TABLE users ADD COLUMN units_first_registered_at TEXT;
ALTER TABLE users ADD COLUMN supporters_first_registered_at TEXT;

-- 既存データの反映（2026-09-22改訂）：
-- 現在ownershipテーブルに行が残っているユーザーは「登録済み」とみなし、
-- 初回登録日時は本マイグレーション適用日時（JST・今日の日付）を一律で設定する。
-- 行が存在しないユーザーはNULLのまま（＝未登録）とする。
--
-- 日時の値について：真の初回登録日時はDBに残っていない（復元不能）ため代用値が必要だが、
-- 「現存する行のregistered_at（最新の同期時刻）」を近似値にするのではなく、
-- マイグレーション適用日で統一する方式を採用した（ユーザー指示）。
--
-- 既知の制約：所持0件で登録した履歴はownershipテーブルに痕跡が残らない設計のため、
-- 「一度も登録したことがない」ユーザーと「過去に所持0件で登録したことがある」ユーザーは
-- 区別できない。後者は保守的に「未登録」のまま扱われる。この制約は本機能の適用以降の
-- 新規登録では発生しない（以降は所持件数に関わらず必ずフラグが立つため）。

UPDATE users
SET units_first_registered_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours') || '+09:00'
WHERE units_first_registered_at IS NULL
  AND user_uid IN (SELECT DISTINCT user_uid FROM units_ownership);

UPDATE users
SET supporters_first_registered_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours') || '+09:00'
WHERE supporters_first_registered_at IS NULL
  AND user_uid IN (SELECT DISTINCT user_uid FROM supporters_ownership);

-- ---- 適用後：カラムが追加され、既存ユーザーの一部に今日の日付でバックフィルされていることを確認 ----
-- SELECT user_uid, units_first_registered_at, supporters_first_registered_at FROM users LIMIT 10;
-- SELECT COUNT(*) FROM users WHERE units_first_registered_at IS NOT NULL;
-- SELECT COUNT(*) FROM users WHERE supporters_first_registered_at IS NOT NULL;
