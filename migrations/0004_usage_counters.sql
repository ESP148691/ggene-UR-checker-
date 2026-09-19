-- ④ 分析ページ実装に伴う、ゲスト（未ログイン）の匿名利用回数カウンタ新設。
--
-- ゲストの所持データそのものは0003で廃止・削除したが、個人と紐付かない集計値として
-- 「チェッカーが何回使われたか」程度の規模感は残す。counter_keyは 'unit_guest' / 'supporter_guest' の2種類
-- （ログイン済みユーザーの利用実績はunits_ownership/supporters_ownershipの行数から把握できるため対象外）。
--
-- 適用方法（このリポジトリにはwranglerのローカル実行環境がないため、以下いずれかで手動適用する）:
--   1. Cloudflareダッシュボード > Workers & Pages > D1 > 対象DB(ggene-ur-checker-db) > Console タブに
--      このファイルの内容を貼り付けて実行する
--   2. ローカルにwranglerがある場合: npx wrangler d1 execute ggene-ur-checker-db --remote --file=migrations/0004_usage_counters.sql

CREATE TABLE usage_counters (
  counter_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
