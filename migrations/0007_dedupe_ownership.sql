-- migrations/0007_dedupe_ownership.sql
--
-- 【2026-09-23追記・重要】本番D1で確認した結果、このマイグレーションの前提（重複行の存在）は
-- 誤りだったことが判明した。実際の原因は migrations/0006 のバックフィルSQL適用時点と
-- worker.jsデプロイ時点の間の「デプロイギャップ」で、その間にデータ登録した一部ユーザーが
-- 初期登録フラグを取得できないまま残っていたこと（ユーザーが同じ冪等なバックフィルUPDATEを
-- 再実行して解消済み）。重複行は存在しなかったため、【このマイグレーションは適用しないこと】。
-- 詳細はdocs/⑬所持率100%超え不具合_調査と改善設計.mdの末尾の訂正、checker/CLAUDE.mdを参照。
-- ファイル自体は経緯の記録として残す。
--
-- ⑬ 所持率100%超え不具合の改善SQL（当初案。上記の通り前提が誤りだったため未適用）。
--
-- 背景: units_ownership / supporters_ownership に (user_uid, unit_id) の一意制約がなく、
-- 同一ユーザーが複数端末・複数タブからほぼ同時にデータ登録した場合などに、
-- replaceOwnership()のDELETE→INSERTが競合し、同一ユーザー・同一機体の重複行が
-- 生じうる状態だった。handleAnalytics()の所持数集計(COUNT(o.id))は「行数」を数えるため、
-- 重複行がある分だけ所持率(ownedRate)が水増しされ、100%を超える表示になっていた。
--
-- このマイグレーションは (1) 既存の重複行を削除し (2) 今後重複行が作られないよう
-- 一意インデックスを追加する。DELETEを先に行うこと（重複が残っているとCREATE UNIQUE INDEXが失敗する）。
--
-- 適用方法: 既存の0001〜0006と同様、Cloudflareダッシュボード（D1 > Console）で手動実行する。
-- 適用前に docs/⑬診断用SQL_所持率不整合の原因確認.sql の実行結果を確認しておくことを推奨する。
--
-- 前提: worker.jsのhandleAnalytics()側の修正（COUNT(o.id) → COUNT(DISTINCT o.user_uid)）は
-- このマイグレーションとは独立に、先にデプロイしておくことを推奨する（①の修正だけでも
-- 表示上の不整合はすぐに解消できるため）。

-- ---- 適用前：重複行の件数を確認 ----
-- SELECT COUNT(*) FROM (
--   SELECT user_uid, unit_id FROM units_ownership GROUP BY user_uid, unit_id HAVING COUNT(*) > 1
-- );
-- SELECT COUNT(*) FROM (
--   SELECT user_uid, supporter_id FROM supporters_ownership GROUP BY user_uid, supporter_id HAVING COUNT(*) > 1
-- );

-- (1) 重複行の削除：同一 (user_uid, unit_id) のうち、最も新しい行（idが最大＝最後に書き込まれた行）
--     だけを残し、それ以外を削除する。AUTOINCREMENTのidは単調増加のため、
--     「最新の登録内容を正とする」現行のスナップショット仕様と整合する。
DELETE FROM units_ownership
WHERE id NOT IN (
  SELECT MAX(id) FROM units_ownership GROUP BY user_uid, unit_id
);

DELETE FROM supporters_ownership
WHERE id NOT IN (
  SELECT MAX(id) FROM supporters_ownership GROUP BY user_uid, supporter_id
);

-- (2) 一意インデックスの追加：今後、同一ユーザー・同一機体の重複行が作られないようにする。
--     worker.js側のreplaceOwnership()は既にON CONFLICT(user_uid, unit_id)を使ったUPSERTに
--     変更済みで、このインデックスが対象になる。
CREATE UNIQUE INDEX idx_units_ownership_user_unit ON units_ownership(user_uid, unit_id);
CREATE UNIQUE INDEX idx_supporters_ownership_user_supporter ON supporters_ownership(user_uid, supporter_id);

-- ---- 適用後：重複行が0件になっていること、インデックスが作成されていることを確認 ----
-- SELECT COUNT(*) FROM (
--   SELECT user_uid, unit_id FROM units_ownership GROUP BY user_uid, unit_id HAVING COUNT(*) > 1
-- );
-- SELECT COUNT(*) FROM (
--   SELECT user_uid, supporter_id FROM supporters_ownership GROUP BY user_uid, supporter_id HAVING COUNT(*) > 1
-- );
-- SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
--   'idx_units_ownership_user_unit', 'idx_supporters_ownership_user_supporter'
-- );
