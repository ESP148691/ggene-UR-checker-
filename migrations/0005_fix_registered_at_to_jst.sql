-- migrations/0005_fix_registered_at_to_jst.sql
-- 既存のunits_ownership/supporters_ownershipのregistered_at（UTC・末尾Z）を
-- JST（+09:00オフセット）表記へ一括変換する。
--
-- 背景: worker.jsのreplaceOwnership()がnew Date().toISOString()（UTC）を
-- そのまま保存していたため、既存行はすべてUTC表記（例 "2026-09-22T08:23:10.454Z"）になっている。
-- worker.js側の修正（toJstIsoString()の導入）は今後の新規保存分にのみ適用されるため、
-- 過去に保存済みの行はこのマイグレーションで一括補正する。
--
-- 冪等: 末尾が"Z"の行だけを対象にするため、再実行しても既にJST化済みの行（末尾+09:00）は
-- 再度変換されない。
--
-- 適用方法: 既存の0001〜0004と同様、Cloudflareダッシュボード（D1 > Console）で手動実行する。

-- ---- 適用前：対象件数を確認 ----
-- SELECT COUNT(*) FROM units_ownership WHERE registered_at LIKE '%Z';
-- SELECT COUNT(*) FROM supporters_ownership WHERE registered_at LIKE '%Z';

UPDATE units_ownership
SET registered_at = strftime('%Y-%m-%dT%H:%M:%f', registered_at, '+9 hours') || '+09:00'
WHERE registered_at LIKE '%Z';

UPDATE supporters_ownership
SET registered_at = strftime('%Y-%m-%dT%H:%M:%f', registered_at, '+9 hours') || '+09:00'
WHERE registered_at LIKE '%Z';

-- ---- 適用後：Z表記が0件になっていること、+09:00表記になっていることを確認 ----
-- SELECT COUNT(*) FROM units_ownership WHERE registered_at LIKE '%Z';
-- SELECT COUNT(*) FROM supporters_ownership WHERE registered_at LIKE '%Z';
-- SELECT registered_at FROM units_ownership ORDER BY id DESC LIMIT 5;
-- SELECT registered_at FROM supporters_ownership ORDER BY id DESC LIMIT 5;
