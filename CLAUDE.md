# Gジェネエターナル ファンツール開発

このファイルはClaude Codeがセッション開始時に自動で読み込む、プロジェクトの引き継ぎ情報です。
（Cowork側のProjectドキュメント `進捗と次スコープ.md` と `handover.md` の内容を統合したものです）

## プロジェクトの目的
Xアカウント（@polarbear148691 / フォロワー2,700人 / Premium会員450人）を軸に、スマホゲーム「Gジェネレーション エターナル」のファン向けWebツールを展開する。収益化はX公式機能（Creator Revenue Sharing等）のみを利用する。

## 権利面の方針（重要・変更不可）
- サイト自体は完全に非商用（広告・アフィリエイトなし）
- 収益化はXの公式機能のみ
- 掲載画像は運営者自身のゲーム内スクリーンショットのみを使用（攻略サイトや公式プロモ素材は使わない）
- バンダイナムコのゲーム配信ガイドラインの「副次的収益」の解釈に基づく整理済みの方針。崩さないこと

## リポジトリ構成
このリポジトリのルートには以下を配置する:
- `top.html` — ログイン後トップページ（ルートURL `/` で配信）。ログイン状態表示、機体版/サポート版/エタロ攻略チェッカーへの導線、今後のチェッカー（ROUTE 04）のComing Soon表示、ログイン中のみ表示される分析ページ導線
- `unit.html` — UR機体所持率チェッカー（84機収録）
- `supporter.html` — URサポート所持率チェッカー（49体収録）
- `analytics.html` — データ登録結果レポート（分析ページ。ログインユーザー限定・2026-09-19新設。2026-09-24に「みんなの所持率ランキング」→「全軍戦況レポート」→「ログインユーザーレポート」→「データ登録結果レポート」と改名し、エタロ攻略タブを追加）
- `eternal-road.html` — エタロ攻略チェッカー（エターナルロード エキスパート難易度。全29ステージ・69ミッション。2026-09-23新設・⑩⑭。同日⑮でバナー画像・通常クリア・3ボタン・フィルタ追加、**ログインユーザー限定**化）
- `profile-card.html` — 自己紹介カード作成ページ（㉒・2026-09-24新設。ログインユーザー限定。テンプレート3種×背景4種の16:9カードをCanvasで生成。描画は`docs/04_自己紹介カード/試作HTML/㉑自己紹介カード_試作5_プロトタイプ.html`から移植した`CardRenderer`。**トップページの導線`#profileCardNav`は`hidden`のまま**＝テスト運用後にユーザー指示で公開）
- `unit-scan.html` / `unit-scan.js` — ㉖段階A（㉕案3）：スクショ読み取り試験版（2026-09-25公開）。`unit.html`（2026-09-25時点）のコピー＋ゲームの「強化 > ユニット」一覧のスクショからURユニットと凸を判定する機能。判定はすべてブラウザ内（サーバー送信なし）、保存先は`unit.html`と同じ（同じlocalStorageキー・同じ`/api/log`）。`noindex`。**運営者専用**（2026-09-25ユーザー指示。`/api/admin/me`で判定し、運営者以外には「運営者専用ページです」だけを表示。トップの「運営者専用」節から遷移）。**`unit.html`を変更しても自動では反映されない**（試験運用後、別途指示で`unit.html`へ統合予定）
- `report.html` — ㉖段階C：週間UR所持率レポート作成ページ（**運営者専用**。`/api/admin/me`で判定し、運営者以外は「運営者専用ページです」のみ表示。`noindex`・トップからのリンクなし・`data-auth-stay`）。1200×675のレポート画像（背景は`profile-card.html`の銀河背景をスクリプトでコピーした`GalaxyBg`）と投稿文を作る。「今日の集計を今すぐ実行」ボタンあり
- `auth.css` / `auth.js` — ログイン・新規登録UIの共通部品。`top.html`・`unit.html`・`supporter.html`・`analytics.html`・`eternal-road.html`・`profile-card.html`から読み込む。ログイン成功後は`/top`へ遷移するが、`<body data-auth-stay>`のページ（`eternal-road.html`・`profile-card.html`）はその場でリロード（⑮）
- `worker.js` — Cloudflare Workers。認証API（`/api/register`・`/api/login`・`/api/logout`・`/api/me`）、所持データログ収集API（`/api/log`・`/api/log-supporter`。**ログイン済みユーザーのみD1保存、ゲストは匿名カウンタのみ加算＝2026-09-19〜**）、分析API（`/api/analytics/units`・`/api/analytics/supporters`、ログイン必須。2026-09-19新設。`/api/analytics/eternal-road`は2026-09-24新設）、自己紹介カードAPI（`/api/works`・`/api/profile-card`・`/api/profile`。㉒・2026-09-24新設）を処理し、それ以外は静的配信。ルートアクセス（`/`）は`top.html`を直接配信（旧`/unit`への301リダイレクトは廃止。`/index.html`の特別扱いも廃止済み＝2026-09-19、詳細後述）
- `wrangler.jsonc` — プロジェクト名 `ggene-ur-checker`、assetsのdirectoryは`./`、D1バインディング`DB`（`ggene-ur-checker-db`）設定済み。㉖で定期実行`triggers.crons: ["0 19 * * *"]`（UTC 19:00＝JST 4:00）と運営者ユーザー名`vars.ADMIN_USERNAMES`（カンマ区切り。**現在`ESP`**。運営者を増やすときはここに追記してpush）を追加
- `migrations/0001_add_user_auth.sql` — `users`テーブルへの`username`/`password`カラム追加、`sessions`テーブル新設。Cloudflareダッシュボード（D1 > Console）で手動適用済み
- `migrations/0002_populate_master_data.sql` — `units_master`/`supporters_master`への実データ投入（機体84件・サポート49件）。Cloudflareダッシュボード（D1 > Console）で手動適用済み（2026-09-19）
- `migrations/0003_purge_guest_data.sql` — 既存のゲスト所持データ・ゲストuser行の一括削除。**適用済み（2026-09-20、Cloudflareダッシュボードで手動適用）**
- `migrations/0004_usage_counters.sql` — ゲスト利用回数カウンタ`usage_counters`テーブル新設。**適用済み（2026-09-20、Cloudflareダッシュボードで手動適用）**
- `migrations/0005_fix_registered_at_to_jst.sql` — 既存の`units_ownership`/`supporters_ownership`の`registered_at`（UTC）をJST（`+09:00`）表記へ一括変換。スキーマ変更なし・冪等。**未適用（要Cloudflareダッシュボードでの手動適用）**
- `migrations/0006_add_first_registered_flag.sql` — `users`に`units_first_registered_at`/`supporters_first_registered_at`カラムを追加し、既存ownershipデータからバックフィル。冪等。**適用済み（2026-09-22、ユーザーが事前にCloudflareダッシュボードで手動適用）**
- `migrations/0007_dedupe_ownership.sql` — 当初は`units_ownership`/`supporters_ownership`の`(user_uid, unit_id)`重複行削除＋一意インデックス追加を想定していたが、**2026-09-23、本番D1で確認した結果、前提（重複行の存在）が誤りだったと判明。適用しない（経緯の記録として残す）**。詳細は下記「⑬」節の訂正を参照
- `migrations/0008_eternal_road_missions.sql` — ⑩エタロ攻略チェッカー（エキスパート難易度）のテーブル定義（`eternal_road_missions`・`eternal_road_mission_clears`）。**適用済み（2026-09-24にユーザー確認）**
- `migrations/0009_populate_eternal_road_missions.sql` — エキスパート全29ステージ・69ミッションのマスターデータ投入。**適用済み（2026-09-24にユーザー確認）**
- `migrations/0010_eternal_road_stage_clears.sql` — ⑮通常クリア用`eternal_road_stage_clears`テーブル新設・`users.eternal_road_first_registered_at`追加・既存ミッション達成からのバックフィル。**適用済み（2026-09-24にユーザー確認）**。INSERT/UPDATEは冪等だが、**`ALTER TABLE`は再実行するとエラーになるため、再実行時はALTER文だけ除いて実行すること**
- `migrations/0011_profile_card.sql` — ㉒自己紹介カードの5テーブル（`works_master`・`unit_work_map`・`user_profiles`・`user_favorite_works`・`user_favorite_units`）＋`idx_fav_work`。冪等（`CREATE TABLE IF NOT EXISTS`）。**適用済み（2026-09-24）**
- `migrations/0012_populate_works_master.sql` — 作品マスター106件＋URユニット→作品の対応84件の投入。冪等（`INSERT OR REPLACE`）。**適用済み（2026-09-24）**
- `migrations/0013_units_ownership_acquisition.sql` — ㉖段階B：`units_ownership`に入手記録の3列（`acquired_on` TEXT・`gasha_pulls` INTEGER・`memo` TEXT）を追加。`docs/05_機能拡張_有料プラン/データ/㉖0013_…sql`とバイト単位で同一。**`ALTER TABLE`のため再実行するとduplicate columnエラー（＝適用済みの意味）**。**コードより先に適用すること**（逆順だと入手記録付きの登録が`handleOwnershipLog()`のtry/catchで握りつぶされ、画面上は成功に見えて保存されない。また`/api/my-ownership`が列不在でエラーになり起動時の復元が止まる）。**適用済み（2026-09-25、ユーザーがD1 Consoleで実行）**
- `migrations/0014_analytics_daily.sql` — ㉖段階C：定時分析の`analytics_daily`・`analytics_daily_summary`（冪等）。`docs/05_…/データ/㉖0014_…sql`と同一。コードより先に適用すること（未適用だと定期実行・`/api/admin/*`がエラー。既存ページには影響なし）。**適用済み（2026-09-25）**
- `images/eternal-road/1.jpg`〜`29.jpg` — エタロのステージバナー（640×234px。ユーザー撮影のスクショからCoworkが切り出し。⑮）
- `images/eternal-road/icon/1.jpg`〜`29.jpg` — トップページのエタロ導線用アイコン（136×136px。各バナーの横中央・上端170×170を切り抜き。`scripts/make_eternal_road_icons.py`で生成。**バナーを差し替え・追加したら再実行すること**）
- `images/series/1.png`〜`106.png` — 作品アイコン（ゲーム内「シリーズ絞り込み」画面のロゴ。運営者のスクショからCoworkが切り出し、320×140。番号＝`works_master.work_id`）
- `images/`, `units/` — 外部化済みの画像アセット
- `scripts/extract_embedded_images.py` — base64埋め込み画像を外部ファイル化する汎用スクリプト（冪等・再実行安全）

**インフラ**: GitHub → Cloudflare Workers 自動デプロイ（このリポジトリにpushすると自動ビルド・公開）。
本番URL: `https://ggene-ur-checker.polarbear14869.workers.dev/`
GitHub: `https://github.com/ESP148691/ggene-UR-checker-`
Cloudflare: `https://dash.cloudflare.com/d78525314dd74181c2dc4fea74c8844a/workers/services/view/ggene-ur-checker/production`

## 実装済み機能（両チェッカー共通）
- 未所持/無凸/1凸/2凸/完凸の5段階を機体ごとに記録（localStorage保存、機体版とサポート版でキー分離）
- 統計表示（所持率%、所持数/総数、平均凸Lv、完凸数、期間限定所持数、タイプ別所持数）
- タイプ別フィルタタブ、一括操作ボタン
- 所持率カード画像生成（ネイティブCanvas API。html2canvasは不使用＝iOS対応のため）
- 画像プレビューモーダル（data URI方式。Blob URLは一部環境で非表示になるため不使用）
- Xシェア機能

### 技術的な注意点（ハマりポイント）
- `ctx.filter`はSafariで反映されないことがある → ピクセル操作で代替
- `getImageData`/`putImageData`は`ctx.scale()`の影響を受けない → 実ピクセル座標に変換が必要
- Blob URLは`<img>`タグで表示できない環境がある → data URIを使う
- localStorageのキーは機体版とサポート版で分離する
- **`/`や既存の公開URLに永続リダイレクト（301/308）を設定しない**（⑧で確定）。301は一度配信するとブラウザ（特にXアプリ内ブラウザ）がキャッシュし、サーバー側を後から直しても該当ユーザーには届かない。どうしてもリダイレクトが必要な場合は307/302を使う

## データベース（Cloudflare D1・作成済み）
```sql
CREATE TABLE users (
  user_uid TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE TABLE units_master (
  unit_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  limited INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL              -- '攻撃' / '支援' / '耐久'
);
CREATE TABLE supporters_master (
  supporter_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  limited INTEGER NOT NULL DEFAULT 0,
  skill TEXT NOT NULL             -- 'HP回復' / 'EN回復' / '複合'
);
CREATE TABLE units_ownership (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registered_at TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  level INTEGER NOT NULL,          -- 0=無凸, 1=1凸, 2=2凸, 3=完凸
  FOREIGN KEY (user_uid) REFERENCES users(user_uid),
  FOREIGN KEY (unit_id) REFERENCES units_master(unit_id)
);
CREATE TABLE supporters_ownership (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registered_at TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  supporter_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid),
  FOREIGN KEY (supporter_id) REFERENCES supporters_master(supporter_id)
);
```
### 認証関連の追加スキーマ（②で追加・適用済み。`migrations/0001_add_user_auth.sql`）
```sql
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN password TEXT;
CREATE UNIQUE INDEX idx_users_username ON users(username);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);
CREATE INDEX idx_sessions_user_uid ON sessions(user_uid);
```
カラム名は`password_hash`ではなく`password`とした（後述の通りハッシュ化せず平文で保存する方針のため、`_hash`という名前で平文を入れると将来の実装者を誤解させる）。

### マスターデータ投入（④で追加・要適用。`migrations/0002_populate_master_data.sql`）
`units_master`・`supporters_master`は当初スキーマのみでデータが空だった。`unit.html`/`supporter.html`の`UNITS`配列と完全一致するINSERT文（機体84件・サポート49件）を`migrations/0002_populate_master_data.sql`として追加済み。0001と同様、Cloudflareダッシュボード（D1 > Console）での手動適用が必要だったが、**2026-09-19に適用済み**。

ID体系: マスターのIDはチェッカー画面上の「No.」（機体1〜84、サポート1〜49）と一致。既存IDは変動しない前提（2026-09-18に機体83・84、サポート49を新規追加。追加時も既存IDは振り直していない）。
D1無料枠: 保存5GB（無期限）、1日500万行読み込み、1日10万行書き込み。

### ゲストデータ廃止・利用回数カウンタ新設（④で追加・要適用。`migrations/0003_purge_guest_data.sql`・`migrations/0004_usage_counters.sql`）
```sql
-- 0004で新設
CREATE TABLE usage_counters (
  counter_key TEXT PRIMARY KEY,   -- 'unit_guest' / 'supporter_guest'
  count INTEGER NOT NULL DEFAULT 0
);
```
2026-09-19、分析ページ（所持率ランキング）実装にあたり、ゲスト（未ログイン）の所持データ保存を廃止した。理由・詳細は`docs/02_分析ページ/④分析ページ設計_ゲストデータ廃止.md`（Cowork側資料）を参照。`worker.js`は既にこの新仕様でデプロイ済みだが、以下2件のマイグレーションは、Cloudflareダッシュボードでの手動適用が2026-09-20に完了した（適用前の状況の記録として下記を残す）。
- `migrations/0003_purge_guest_data.sql`: 既存のゲスト所持データ（`units_ownership`/`supporters_ownership`のゲスト分）・ゲストuser行（`users.username IS NULL`）を一括削除
- `migrations/0004_usage_counters.sql`: 上記`usage_counters`テーブルの新設

この2件の適用前は、ゲストの`/api/log`・`/api/log-supporter`送信時に`usage_counters`への書き込みがテーブル不在でエラーになる可能性があるが、`handleOwnershipLog()`はtry/catchで囲まれているためチェッカー本体（画像生成・プレビュー・シェア）の動作には影響しない（利用回数カウンタが記録されないだけ）。適用済みの現在は、カウンタも正常に記録される。

### ㉖入手記録・定時分析（`migrations/0013`・`0014`。2026-09-25追加・適用済み）
```sql
-- 0013
ALTER TABLE units_ownership ADD COLUMN acquired_on TEXT;     -- 入手日 YYYY-MM-DD または YYYY-MM
ALTER TABLE units_ownership ADD COLUMN gasha_pulls INTEGER;  -- ガシャ回数 1〜9999
ALTER TABLE units_ownership ADD COLUMN memo TEXT;            -- メモ 50文字以内
-- 0014
CREATE TABLE IF NOT EXISTS analytics_daily (
  snap_date TEXT NOT NULL, kind TEXT NOT NULL, item_id INTEGER NOT NULL,
  owned_count INTEGER NOT NULL, max_count INTEGER NOT NULL DEFAULT 0, total_users INTEGER NOT NULL,
  PRIMARY KEY (snap_date, kind, item_id)
);
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  snap_date TEXT PRIMARY KEY, accounts INTEGER NOT NULL, unit_users INTEGER NOT NULL,
  supporter_users INTEGER NOT NULL, er_users INTEGER NOT NULL, created_at TEXT NOT NULL
);
```
- `analytics_daily`の`kind`：`unit`／`supporter`（所持者数・完凸者数・該当種別の登録者数）、`er_stage`（クリア人数・**全ミッション達成人数**を`max_count`に流用・エタロ登録者数）、`er_mission`（達成人数・0・エタロ登録者数）。1日231行
- `units_ownership`の保存は2026-09-25から差分更新（`syncOwnership()`）。行を消さずにUPDATEするので`id`も保たれる

## 確定済みの設計方針（変更不可）
- **ログインは任意**。ログインなしでもチェッカーは従来通り使える（ゲスト利用を維持）。理由: Xからの流入で「すぐ使える」ことが拡散の原動力になっているため、入口に関門を作らない
- ログインの価値は「自己紹介カードの作成・保存」「端末をまたいだデータ引き継ぎ」「みんなの所持率ランキング（分析ページ）の閲覧」（④で追加・2026-09-19）
- 認証はユーザー名＋パスワードのみ（メールアドレス不要、個人情報は保存しない）
- コスト方針: **Workers Paid（月5ドル）の枠内で運用。上限を超えると停止ではなく従量課金になる**（2026-09-25にユーザーが有料プランへ移行。それまでは完全無料運用＝上限到達時は停止、だった）

## 将来の全体像（ゴールイメージ）
1. ユーザー登録・ログイン機能
2. ログイン後トップページから各チェッカーへ
3. エタロ攻略チェッカー（エキスパート難易度・2026-09-23実装済み＝⑩⑭。称号獲得チェッカーは引き続き今後）
4. 4種のチェッカー結果から自己紹介カードを自動生成
5. 推し作品を最大5つ選択（宇宙世紀／オルタナ別のシート、作品内時系列で表示）＋フリースペース入力
6. Xの #ジージェネエターナル タイムライン表示（おまけ扱い。X仕様変更で使えなくなっても全体に影響しない作りにする）
7. ガンダム豆知識リストの表示
8. 所持率・クリア率の分析結果ページ

## 完了済みの作業
### ① 画像の外部ファイル化（完了）
- `scripts/extract_embedded_images.py`でbase64埋め込み画像を外部ファイル化。冪等設計のため再実行しても安全
- `unit.html`: 823,201 bytes → 40,341 bytes（95.1%削減）、`supporter.html`: 714,580 bytes → 38,564 bytes（94.6%削減）
- Playwrightヘッドレステストで動作確認済み（カード枚数・画像読み込み・凸レベル変更・カード画像生成）

### ファイル命名・URL構成の統一（完了）
- `index.html` → `unit.html`にリネーム。`worker.js`で`/`・`/index.html`は`/unit`へ301リダイレクト、`/unit`はクリーンURLとして配信（この301リダイレクトは後述③で廃止しトップページ直接配信に変更済み）
- `wrangler.jsonc`の`name`を`ggene-ur-checker`に修正（旧`-retry`付きの誤ったproject名を修正）
- `unit.html`内`CONFIG.siteUrl`を`https://ggene-ur-checker.polarbear14869.workers.dev/unit`に修正

### ② ユーザー登録・ログイン機能（完了）
実装着手前にユーザーへ確認し、以下の方式で確定・実装した。
- **パスワード**: ハッシュ化せず平文で保存する方針を採用（ユーザーが明示的に選択。handover.mdの当初方針を踏襲）。DBカラム名は`password`（`password_hash`という名前で平文を入れると誤解を招くため）
- **セッション管理**: HttpOnly Cookie方式（`Secure; SameSite=Lax`）。有効期限は30日間。トークンはD1の`sessions`テーブルで管理し、ログアウト時に削除できる
- D1に`migrations/0001_add_user_auth.sql`を適用（`users`への`username`/`password`カラム追加、`sessions`テーブル新設）。適用はCloudflareダッシュボードのD1 Consoleで手動実行（このリポジトリの開発環境にwrangler CLIがなく直接実行できないため）
- `worker.js`に`POST /api/register`（重複チェック＋保存＋セッション発行）、`POST /api/login`（検証＋セッション発行）、`POST /api/logout`（セッション削除）、`GET /api/me`（ログイン状態確認）を追加
- `auth.css`・`auth.js`を新設し、`unit.html`・`supporter.html`に2行ずつ（`<link>`と`<script defer>`）追加する形でログイン導線を実装。画面右上に「ログイン」リンク／ログイン中はユーザー名とログアウトボタンを表示
- `/api/me`取得に失敗した場合は常にゲスト状態表示にフォールバックし、チェッカー本体の動作に影響しない設計
- ついでに、supporter.htmlが送信していた`/api/log-supporter`の受け口が存在しなかった不具合（404で握りつぶされていた）も修正
- ゲスト利用（未ログインでのチェッカー100%利用）への影響がないことを確認済み
- ログインボタンはその後、スクロール追従からヘッダー（`.wrap`）内の通常フロー要素（先頭固定配置・スクロールで流れる）に変更済み

### ③ ログイン後トップページ（完了）
- `top.html`を新設。ログイン状態表示（②のauth.js/auth.cssを再利用）、機体版/サポート版チェッカーへの導線カード、「エタロ攻略チェッカー」「称号獲得チェッカー」のComing Soon表示カードを配置
- `worker.js`でルートURL（`/`・`/index.html`）を`/unit`への301リダイレクトから`top.html`の直接配信に変更
- **注意（要フォロー）**: Xの固定ポストがルートURLをリンクしている場合、流入後の導線が「即チェッカー表示」から「トップページ経由（1タップ追加）」に変わる。従来通り0タップでチェッカーに到達させたい場合は、固定ポストのリンク先をルートURLから`/unit`に張り替える（X側の投稿編集のみで対応可、コード変更は不要）

### トップページ 銀河系デザイン 本実装（完了）
- Cowork側で検討・承認済みのデザイン提案（`design-proposal/galaxy-design-proposal.md`）とプロトタイプ（`design-proposal/top-galaxy-prototype.html`）を`top.html`に本実装した
- 背景：3層の星空パララックス（Canvas 2D）、手続き生成の渦巻銀河（エメラルドコア）、CSSネビュラ、流れ星、スキャンライン・ビネットを追加。外部ライブラリ（three.js等）は不使用
- チェッカー導線カードのアイコンにエメラルドのオーロラ後光、タイトルにシアン⇄ゴールドのグラデーションシマーを適用。実装済みチェッカー（機体/サポート）を主役として拡大、Coming Soon（ROUTE 03/04）は脇役として縮小
- アイコン画像は、プロトタイプのbase64埋め込み（各6枚）をやめ、`images/units/1.jpg`〜`82.jpg`／`images/supporters/1.jpg`〜`48.jpg`への相対パス参照＋全件からのランダム抽出に変更（5秒周期でフェード切替、タブ非アクティブ時停止、`prefers-reduced-motion`時は初期の1枚で固定）。サポート画像は`object-position:78% center`で右寄りトリミング（※このプール件数は後述「新規UR3件の追加とトップページ反映」で84/49件に更新済み）
- `auth.css`/`auth.js`によるログイン状態表示は変更せず、新しい配色（`--panel-2`を追加）に馴染むようにしたのみ。ログイン任意・ゲスト利用維持の方針への影響なし
- 760px以上の広い画面では2カラム全幅レイアウト、760px未満は既存同様の1カラムを維持
- 動作確認：Playwright（Python版、Chromium）でスマホ幅（320px/390px）・デスクトップ幅（1024px）・`prefers-reduced-motion: reduce`の3パターンをヘッドレステスト。表示崩れ・コンソールエラーなしを確認（ローカル静的サーバーのため`/api/me`が404になるのは想定内で、auth.js側のゲスト表示フォールバックが正常に機能することも確認済み）
- 未対応（要相談）：`unit.html`/`supporter.html`への同じ背景演出の展開は本作業のスコープ外のまま

### 新規UR3件の追加とトップページ反映（完了・2026-09-18）
※このセクションと次の「ログインモーダルのデザイン統一」は、実装後にCLAUDE.md・Cowork側ドキュメントのどちらにも記録しないままセッションを終えていたため、事後に追記したもの。

- 機体2体（No.83 ガンダムアヴァランチアストレア タイプFダッシュ(EX) / No.84 スサノオ(EX)）、サポート1体（No.49 シェリリン・ハイド＆エウクレイデス）を`unit.html`・`supporter.html`のマスターデータ（`UNITS`/`SUPPORTERS`配列）に追加。画像は`images/units/83.jpg`・`84.jpg`、`images/supporters/49.jpg`として配置済み
- 収録数は機体82→84、サポート48→49に更新（既存No.1〜82／1〜48のIDは振り直していない）
- `top.html`のランダムアイコン抽出プール（`UNIT_IMAGES`／`SUPPORTER_IMAGES`）も84件／49件に更新済み。この追随修正を怠ると新規追加した2機体・1体だけがトップページの銀河系背景アイコン演出に登場しない状態になるため、今後UR追加時は`unit.html`/`supporter.html`本体だけでなく`top.html`側の配列件数も必ずセットで更新すること

### ログインモーダルのデザイン統一（完了・2026-09-18）
- 課題: `auth.css`のログイン・新規登録モーダルは旧テーマの`:root`カラー変数に依存していたため、③で銀河系デザインへ全面刷新した`top.html`と、旧テーマのままの`unit.html`/`supporter.html`とで、モーダルの見た目（配色）が食い違っていた
- 対応: `auth.css`の`.authbar`/`.authModal`セレクタ内に、ホストページの`:root`に依存しない銀河系パレット（`--auth-void`/`--auth-panel`/`--auth-gold`/`--auth-cyan`等）を独自定義。これにより`top.html`・`unit.html`・`supporter.html`のどこからモーダルを開いても、同じガラス調パネル・シアン⇄ゴールドのシマー見出し・グラデーション枠線のデザインで統一表示されるようにした
- あわせて`auth.js`を変更し、ログイン・新規登録のいずれが成功した場合も`"/"`（ログイン後トップページ`top.html`）へ遷移するようにした（変更前は各チェッカー画面にとどまる挙動だった）
- `unit.html`/`supporter.html`本体の背景演出（銀河系パララックス等）まで展開したわけではない点に注意。これは引き続き未着手（上記「トップページ 銀河系デザイン 本実装」の「未対応（要相談）」のまま）

### ④ D1への所持データ保存（完了・2026-09-19）
- `worker.js`の`/api/log`・`/api/log-supporter`を、console.logのみだった実装からD1（`units_ownership`・`supporters_ownership`テーブル）へのINSERTに変更
- **旧console.logログの削除（2026-09-19）**: 実装当初はCloudflare Workers Logs（console.log）への記録をD1保存と併用で残していたが、ユーザーに確認の上、D1保存への一本化に伴い`handleOwnershipLog()`内のconsole.log呼び出しを削除した。所持データの記録先はD1のみとなる。あわせてリクエストボディの読み取りも`request.text()`→`JSON.parse()`から`request.json()`に簡略化した
- **識別子の決定方法**: ログイン中は`getSessionUser()`で取得したセッションの`user_uid`を優先。未ログイン時は、クライアント（`unit.html`/`supporter.html`）が`localStorage`（キー`urchecker_guest_uid`、両チェッカーで共通）に保持する匿名UUID（`crypto.randomUUID()`で発行、リクエストの`guestUid`として送信）を使う。どちらも取得できない場合はD1書き込みをスキップする（この場合、旧実装と異なりconsole.logへの記録も行われない＝記録は一切残らない）
- **usersテーブルのupsert**: 所持データ保存の直前に、対象`user_uid`が`users`テーブルになければ`username`/`password`を`NULL`のまま新規作成し、あれば`last_seen`のみ更新する（`INSERT ... ON CONFLICT(user_uid) DO UPDATE SET last_seen = ...`）。この`users`テーブルはもともと`user_uid`/`first_seen`/`last_seen`のみの匿名UID台帳として設計されていたものを、そのままゲスト管理に転用している
- **保存方式**: 送信のたびに、その`user_uid`の既存所持行を全削除してから現在の所持状態を入れ直す「最新スナップショット方式」を採用（履歴は積み上げない）。`env.DB.batch()`でDELETE+INSERT群を1回のラウンドトリップにまとめている
- **送信元・保存先の対応**: `unit.html`（`/api/log`）→`units_ownership`、`supporter.html`（`/api/log-supporter`）→`supporters_ownership`で完全に分離。`unit_id`/`supporter_id`の衝突は起きない
- **既存不具合の発見と対応（重要）**: `units_master`・`supporters_master`テーブルは作成時にスキーマのみ定義され、実データが投入されていなかった。`units_ownership`/`supporters_ownership`の`unit_id`/`supporter_id`はこのマスターへのFOREIGN KEYを持つため、環境でFK制約が有効化されている場合、マスターが空のままだと所持データのINSERTが（クライアントには見えない形で）静かに失敗する状態だった。これを解消するため、`unit.html`/`supporter.html`の`UNITS`配列から生成した`migrations/0002_populate_master_data.sql`を新規追加し、機体84件・サポート49件のマスターデータを投入するようにした
  - **対応済み**: `migrations/0002_populate_master_data.sql`は、`migrations/0001_add_user_auth.sql`のときと同様にCloudflareダッシュボード（D1 > Console）で手動実行が必要だった（このリポジトリの開発環境にwrangler CLIがなく直接適用できないため）。2026-09-19にユーザーが適用完了
- **検証方法**: 実際のD1に接続する手段がないため、`node:sqlite`でD1の`prepare/bind/run/first/batch`相当のAPIを再現したモック（`env.DB`）を作り、Node上でworker.jsの`fetch`ハンドラを直接呼び出すテストハーネスを新規作成して検証した（wrangler CLIなしでの検証という既存の運用方針を踏襲）
  - 回帰確認: `/api/register`・`/api/login`・`/api/logout`・`/api/me`が今回の変更後も従来通り動作すること
  - 新機能: ログイン中ユーザーはセッションの`user_uid`で保存されること、ゲストは`guestUid`で保存され`users`にも行ができること、不正な`guestUid`や壊れたリクエストボディはエラーにならず200 okを返しつつD1保存だけスキップされること、再送信で古い所持データが置き換わり履歴が積み上がらないこと、機体版とサポート版が別テーブルに正しく分かれること、`log`文字列内の壊れた要素だけを読み飛ばせること
  - FK制約についての参考検証: FK制約を有効化した状態で`units_master`が空だと保存が失敗すること、`migrations/0002`適用後（マスターデータ投入後）は同じFK制約下でも保存に成功することの両方を確認済み
- **意図的に対応していない点（ユーザー確認済み・対応不要）**: ゲスト状態で記録した所持データを、後から会員登録・ログインした際に既存アカウントへ引き継ぐ機能（ゲストUUID→アカウントuser_uidへのデータ移行）は実装していない。2026-09-19にユーザーへ確認し、「現状仕様のままでOK（対応不要）」と決定済み

### ④の設計確認（ユーザーレビュー・2026-09-19）
D1保存の設計についてユーザーから4点確認があり、以下の通り回答・対応した。
1. **機体チェッカー押下時はunits_ownershipのみ、サポートチェッカー押下時はsupporters_ownershipのみに保存されるか** → 確認済み。`unit.html`は`/api/log`のみ、`supporter.html`は`/api/log-supporter`のみを呼び、`handleOwnershipLog()`内で`isSupporter`フラグにより書き込み先テーブル（`units_ownership`/`supporters_ownership`）とIDカラム（`unit_id`/`supporter_id`）が完全に分岐しているため、一方の送信でもう一方のテーブルに書き込まれることはない。テストハーネスで実際に確認済み
2. **`users.first_seen`は不要では？** → ユーザーと相談し「残す（推奨案を採用）」で決定。現状どの機能からも参照していないが、実装コストが実質ゼロであることと、将来「登録からの継続日数」等の分析（ロードマップ8.）で使える可能性を優先し、スキーマ変更はしていない
3. **新規登録時にusernameがNULLで作成されないようにしてほしい（ユーザー/ゲストを確実に区別したい）** → 実装済みで既に満たされていることを確認。`isValidUsername()`が英数字・アンダースコア3〜20文字のみを許可し、空・未指定・不正な値は`/api/register`が400エラーで弾くため、この経路でusersにusername=NULLの行が作られることはない。一方④のゲスト行は`upsertOwnershipUser()`がusername/passwordを一切指定せず作成するためNULLのまま。「`username IS NULL` ⟺ ゲスト／`username IS NOT NULL` ⟺ 登録済みアカウント」という不変条件を`worker.js`の`isValidUsername()`直前にコメントとして明記し、テストケースも追加した（空文字・未指定・null・3文字未満・英数字以外の5パターンで400になることとusersにNULL行が作られないことを検証）
4. **FOREIGN KEY制約自体は無くてもよいが、どうするか** → ユーザーと相談し「宣言は残し、`worker.js`側でID範囲チェックを追加する」で決定。理由: SQLiteはALTER TABLEでFK制約だけを後から外せないためテーブル再作成が必要になり手間が大きい一方、D1側でFKが有効化されていてもいなくても矛盾なく動く安全策として、アプリ側の検証を追加する方が確実。`worker.js`に`MAX_UNIT_ID = 84`・`MAX_SUPPORTER_ID = 49`を定数として追加し、`parseCompactOwnershipLog()`がこの範囲外のIDを読み飛ばすように変更した。**この定数は、今後UR機体・サポートを追加した際、`top.html`のUNIT_IMAGES/SUPPORTER_IMAGES件数・`migrations/0002`の投入件数と必ずセットで更新すること**
- 上記の追加テスト（機体/サポート分離、first_seen不変性、username NULL不可、ID範囲チェック）もテストハーネスに追加し、全17ケースが成功することを確認済み
- ユーザー向けに公開したER図・DB設計リファレンス（Artifact）も、この確認内容に合わせて更新した

### `/index.html`特別扱いの廃止（2026-09-19）
`index.html`は以前`unit.html`へリネーム済みで、実ファイルとしては存在しない状態だったが、`worker.js`のルーティングには`if (url.pathname === "/" || url.pathname === "/index.html")`という条件が残っており、`/index.html`へのアクセスも`top.html`にすり替えて配信し続けていた。ユーザーから「index.htmlはすでに廃止済みなので、残っている条件は削除してよい」との指示を受け、以下の通り対応した。
- `worker.js`のルート判定を`if (url.pathname === "/")`のみに変更。`/index.html`への直接アクセスは今後、通常の静的アセットのcatch-all処理に渡されるため、実ファイルが存在しない以上404になる（意図した挙動。Xの固定ポスト等の流入経路はすべて`/`または`top.html`/`unit.html`等の実在パスを指しており、`/index.html`への外部リンクは存在しないため実害なし）
- テストハーネス（`harness.mjs`）に回帰テストを2件追加し、全19ケースが成功することを確認済み
  - 「`/`はtop.htmlを配信する」（従来通りの挙動が壊れていないことの確認）
  - 「`/index.html`はもう特別扱いされず、そのままcatch-allに渡される（top.htmlへは書き換わらない）」（今回の変更が正しく効いていることの確認）
- `unit.html`・`supporter.html`・`auth.js`・`auth.css`にも`index.html`への参照が残っていないことをgrepで確認済み（該当なし）

### git commit・push、マスターデータmigration適用（完了・2026-09-19）
④のD1保存実装（`worker.js`/`unit.html`/`supporter.html`の変更、`migrations/0002_populate_master_data.sql`の追加）は、実装した回のセッションでコードとしては完成していたが、git commit・pushをしないままセッションを終えていたため、リポジトリ・本番環境には未反映の状態が残っていた（Cowork側の`WEBサイト仕様書.md`に既知の制約として記録）。今回のセッションで以下を対応した。
- 未コミットの差分（worker.js・unit.html・supporter.html・CLAUDE.md・migrations/0002）をコードレビューし、設計方針との整合を確認（このリポジトリの開発環境にNode.jsがなく、既存のD1モックテストハーネスは再実行できなかったため、差分の目視レビューで代替）
- 無関係な未追跡ファイル（`ESP_sky_emerald1.png`。コードから参照されていないため対象外と判断）は含めずコミット
- `git commit` → `git push origin main`（コミット`18a667d`）。Cloudflare Workersの自動デプロイにより本番環境へ反映済み
- `migrations/0002_populate_master_data.sql`をユーザーがCloudflareダッシュボード（D1 > Console）で手動適用（2026-09-19）。これにより`units_master`/`supporters_master`に実データが投入され、FK制約有無に関わらず所持データ保存が正常に機能する状態になった

### トップページ視認性・チェッカー間導線・Xシェアタグの改善（完了・2026-09-19）
ユーザーからの4点の指示に対応した。

1. **`top.html`見出し・説明文の視認性改善**：`.eyebrow .jp`・`h1`・`.sub`に`text-shadow`（暗いハロー）を追加し、背景の銀河グロー・星空と重なっても文字が沈まないようにした。`.sub`は色を`var(--muted)`（低コントラストな灰色）から明るめの`#c7d2dc`に、フォントサイズも12.5px→14pxに変更。スマホ幅での改行崩れ対策として、`h1`と`.eyebrow .jp`に`word-break:keep-all`を指定（"トップ"が"ト"/"ップ"に、"エターナル"が"エ"/"ターナル"に分断される問題を解消）。`.sub`は元々スペースなしの地の文のため`keep-all`だけでは効果がなく、代わりに文節区切りに`<wbr>`を挿入して自然な位置で改行されるようにした。Playwrightで320px/390px/1024px幅のスクリーンショットを撮って改善を確認済み
2. **ログイン後のトップページ遷移**：`auth.js`を確認したところ、ログイン・新規登録成功時に`window.location.href = "/"`へ遷移する処理は既に実装済み（2026-09-18の「ログインモーダルのデザイン統一」で対応済み）で、本番の`auth.js`にも反映されていた。Playwrightで`/api/login`をモックし実際にログイン操作を行うE2Eテストを実施し、送信後に`/`へ遷移することを確認済み（コード上の不具合は見つからず）。ユーザーが体感した「チェッカーに居残る」挙動が再現する場合は、ブラウザキャッシュや具体的な操作手順の追加確認が必要
3. **チェッカー画面からトップへ戻る導線**：`auth.js`の`renderLoggedIn()`に、ログイン中かつ`top.html`（`/`）以外のページでのみ「トップに戻る」リンク（`/`へのリンク）をヘッダー（`.authbar`）内に表示する処理を追加。未ログイン時・トップページ自体では表示されない。あわせて`auth.css`の`.authbar`に`flex-wrap:wrap`、各ボタン/リンクに`white-space:nowrap`を追加し、項目が3つに増えても320px幅でボタン内の文字が折り返さず、行単位で綺麗に折り返すようにした
4. **Xシェアのハッシュタグ変更**：`unit.html`/`supporter.html`の`CONFIG.hashtags`を、従来の`["Gジェネエターナル", "UR(サポート)所持率チェッカー"]`（2タグ）から、機体版は`["GGETユニット所持率チェッカー"]`、サポート版は`["GGETサポート所持率チェッカー"]`（単一タグ）に変更。Playwrightで実際に共有ボタンを押し、生成されるツイート本文のハッシュタグ部分が意図通りであることを確認済み

検証はPythonのPlaywright（Chromium、ローカル`python -m http.server`での静的配信）で実施。3ページ（`top.html`/`unit.html`/`supporter.html`）でconsoleエラーが出ないことも確認済み。このリポジトリの開発環境にはNode.jsがないため、`worker.js`を使うD1モックテストハーネス（`harness.mjs`）は今回のスコープ外（`worker.js`自体は変更していない）。

### 上記の追加修正（完了・2026-09-19）
上記デプロイ後、ユーザーからの実機確認で4点の追加修正指示があった。

1. **ログインモーダルの表示位置**：`auth.css`の`.authModal`を画面中央寄せ（`align-items:center`）から上寄せ（`align-items:flex-start` + 上部に`calc(48px + safe-area-inset-top)`のpadding）に変更し、`overflow-y:auto`も追加。スマホでソフトウェアキーボードが開いた際に入力欄がキーボードと重なって隠れる問題に対応。Playwrightでビューポート高さ400px（キーボード表示時を想定した縮小状態）でモーダルを開き、ユーザー名入力欄が画面内に収まっていることを確認済み
2. **「トップに戻る」ボタンがtop.html自体にも表示される不具合の修正**：本番環境（`https://ggene-ur-checker.polarbear14869.workers.dev/`）に対しPlaywrightで実際にアクセスして調査した結果、原因が判明した。Cloudflareの静的アセット配信（`env.ASSETS.fetch`）が`/top.html`を拡張子なしの`/top`へ自動リダイレクトしており、遷移後の`location.pathname`は`/top.html`ではなく`/top`になる。`auth.js`の`isTopPage`判定が`"/"`と`"/top.html"`しか許容していなかったため、トップページ自身でも「トップに戻る」ボタンが表示されてしまっていた。`isTopPage`の条件に`"/top"`を追加して解消。本番相当の挙動（`location.pathname === "/top"`）を再現するPlaywrightテストで、ボタンが表示されなくなったことを確認済み
   - **重要な学び**: このサイトでは`/xxx.html`へのアクセスがCloudflare側で`/xxx`へリダイレクトされる。`location.pathname`に依存するJSを書く際は、`.html`付き・なしの両方を考慮すること（`/unit`・`/unit.html`のような組み合わせも同様の可能性があるため、今後同種の判定を追加する場合は要注意）
3. **チェッカーカードタイトルの改行不具合**：`top.html`のnavcard内「UR機体所持率チェッカー」「URサポート所持率チェッカー」が、スマホ幅で長音記号「ー」だけが次行に孤立する不自然な改行になっていた問題を、`.navcard .name`に`word-break:keep-all`を指定し、テキスト中の「所持率」と「チェッカー」の間に`<wbr>`を挿入することで解消（「UR機体所持率」/「チェッカー」で改行されるようになった）
4. **見出しフォントの改善**：`h1`・`.navcard .name`・`.soonTitle`は`font-family:'Rajdhani',sans-serif`を指定していたが、Rajdhaniは日本語グリフを持たないため、これらの要素の文字（すべて日本語）は実際にはブラウザの汎用フォールバックフォントで描画されており、これが「フォントがチープ」に見える原因だった。Google Fontsに`Zen Kaku Gothic New`（weight 700/900）を追加し、`font-family:'Zen Kaku Gothic New','Rajdhani',sans-serif`として日本語見出し用のフォントを明示的に指定するように変更（`h1`はfont-weightも700→900に強調）
5. **ロゴマークとタイトルの間隔調整**：`.titlerow`の`gap`を18px→30pxに拡大。ロゴの装飾リング（`.logo-wrap .ring-2`が`inset:-20px`でロゴ本体の52px枠から20px外側にはみ出す装飾）を考慮すると、従来の18pxではリングとタイトル文字が視覚的にほぼ接触する状態だったため、実際の見た目上の余白を十分に確保できる値に調整した

いずれもPythonのPlaywright（ローカル静的配信、および2の不具合調査は本番URLに対して直接）で確認済み。3ページ（`top.html`/`unit.html`/`supporter.html`）でconsoleエラーが出ないことも再確認済み。

### さらなる追加修正6点（完了・2026-09-19）
上記デプロイ後、ユーザーから実機確認で6点の追加指示があった。

1. **Xシェアに`#ジージェネエターナル`タグを追加**：`unit.html`/`supporter.html`の`CONFIG.hashtags`の先頭に`"ジージェネエターナル"`を追加（既存の`GGETユニット/サポート所持率チェッカー`タグは維持し、2タグ構成に）
2. **ヘッダーボタン（ログイン/ログアウト/トップに戻る）の押下時の強調表現を強化**：`auth.css`の`.authbar .authlink, .authbar button`に`:active`スタイルを追加し、押下中は背景をゴールド単色で塗りつぶし・文字色を濃色に反転・`transform:scale(.93)`で縮小するようにした。スマホはhoverが効かないため、従来はタップしても押した瞬間の視覚フィードバックがほぼ無かった。あわせて`-webkit-tap-highlight-color:transparent`と`touch-action:manipulation`も追加し、OS標準のタップハイライトとの重複・タップ反応の遅延要因を排除
3. **「トップに戻る」ボタン押下時の体感速度改善**：`unit.html`/`supporter.html`の`<head>`に`<link rel="prefetch" href="/">`と`<link rel="prefetch" href="images/logo.png">`を追加し、チェッカー画面を開いている間にトップページ本体とロゴ画像をブラウザが先読みするようにした。あわせて3ページすべてに`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`を追加（従来は`fonts.googleapis.com`のみpreconnectしており、実際のフォントファイルを配信する`fonts.gstatic.com`への接続確立が本番等でわずかな遅延要因になり得た）。フルページ遷移である以上、SPA化のような抜本的な体感速度向上（画面遷移中の白/黒フラッシュの解消等）は本対応のスコープ外
4. **表記揺れ「機体」→「ユニット」に統一**：調査の結果、`unit.html`自身は既に「ユニット」表記で統一されていたが、`top.html`のnavcardだけ「UR機体所持率チェッカー」「全84機のUR機体所持状況を記録・可視化」という表記になっていたため、「URユニット所持率チェッカー」「全84機のURユニット所持状況を記録・可視化」に修正。カードタイトルの改行位置も、文字数が増えたことで再度不自然な改行（「所」だけ次行等）が発生したため、`<wbr>`を「ユニット」「所持率」「チェッカー」の各区切りに追加して調整
5. **見出し・説明文とESPロゴマークの間隔調整**：`.sub`（説明文）の`margin-top`を14px→24pxに拡大。ロゴの装飾リング（`.logo-wrap .ring-2`）がロゴ本体の下側にも20px分はみ出す仕様のため、従来のtitlerowの余白（collapseした約14px）では説明文の1行目がリングの下端と視覚的に近接していた。余白を広げてバランスを調整
6. **フッターの追加**：`top.html`・`unit.html`・`supporter.html`の3ページすべてに、以下を内容とするフッター（`.pageFooter`）を追加
   - ファンが個人で制作した非公式ツールであること
   - バンダイナムコエンターテインメント・サンライズ等、作品に関連する権利元・企業とは一切関係がないこと
   - 掲載しているゲーム内画像・キャラクター名・データ等の著作権・知的財産権は権利元に帰属すること、掲載画像はすべて運営者自身が撮影したゲーム内スクリーンショットであること
   - 掲載データの正確性を保証しないこと、利用により生じた損害について運営者は責任を負わないこと（免責事項）
   - お問い合わせ先としてX（@polarbear148691）へのリンク
   - ユーザーからの指定はなかったが、フリーテキストで指示された「他に明記する必要がある内容」として免責事項とお問い合わせ先はこちらの判断で追加した項目。文言は法的な正式表現の保証はできないため、正確な著作権表記が必要な場合は改めて権利元のガイドラインを確認することが望ましい旨、ユーザーに口頭で伝達済み

いずれもPythonのPlaywright（ローカル静的配信）で確認済み。320px/390px幅でのスクリーンショット、Xシェアの実際のツイート文面デコード、`:active`状態のスクリーンショット、`<link rel=prefetch>`の存在確認、3ページのconsoleエラーなしを一通り確認済み。

### ロゴの装飾リング強調・フッター改行の追加修正（完了・2026-09-19）
1. **ロゴの装飾リングを虹色で強調**：`top.html`のロゴ（`.logo-wrap`）に新しいリング要素`.ring-rainbow`を追加。所持率チェッカーの完凸カード画像生成（Canvas）で使っている虹色グラデーション（`#ff5f6d → #ffc371 → #9dff8a → #5b8def → #c471f5`）と同じ色をconic-gradientで再現し、ぼかし（blur）をかけて回転させることで、ロゴ周りに柔らかい虹色のハローを追加した。既存の`ring-1`（シアン破線）・`ring-2`（ゴールド実線）もopacityを引き上げて（0.5/0.3→0.75/0.45）少し目立つように調整。これにより、チェッカー側の「完凸＝虹色」というサイトの世界観とトップページのロゴ演出がつながるようにした
2. **フッター文言の改行修正**：`.pageFooter p`に`word-break:keep-all;overflow-wrap:break-word;`を追加した上で、各段落に`<wbr>`を文節区切りで挿入し、「エターナル」「バンダイナムコエンターテインメント」「著作権」「スクリーンショット」「負いかねます」等が単語の途中で改行される問題を解消（`top.html`・`unit.html`・`supporter.html`の3ページとも同一のフッター文言のため、同じ修正を3ファイルに適用）

Playwrightで320px/390px幅のスクリーンショットを撮り、ロゴの虹色リングの見え方とフッターの改行位置を確認済み。3ページのconsoleエラーなしも再確認済み。

### Xアカウントのフォロー・リポスト・いいね促進（完了・2026-09-19）
ユーザーから「Xアカウントのフォロー・リポスト・いいねを推進したい」との要望があり、「ユーザーがうっとうしく思わない範囲」という条件のもとで以下を実装した。

1. **`via`パラメータの付与**：`unit.html`/`supporter.html`の「Xでシェア」ボタンが生成するツイートインテントURLに`&via=polarbear148691`を追加。これによりシェアされたツイートに運営アカウントが自動的にクレジットされ、ユーザー側の追加操作なしで露出が増える
2. **フッターへの控えめなフォロー導線**：`top.html`・`unit.html`・`supporter.html`のフッター最下部に「更新情報はXで発信しています。よろしければフォローしていただけると励みになります。」の一文と、Xのフォローインテントリンク（`https://x.com/intent/follow?screen_name=polarbear148691`）を追加。ポップアップやフォロー必須ゲートは、ログイン任意・0タップ到達を重視する本サイトの方針に反するため採用せず、フッターの控えめな1行に留めた
3. **指定ポストへの引用RT機能**：Xのツイートインテントに`url`パラメータで既存ポストのURLを渡すと、そのポストを引用する形でツイート作成画面が開く仕組みを利用し、`unit.html`/`supporter.html`の`CONFIG`に`quotePostUrl`を追加。ユーザーから受け取ったツール公開ポストのURL（`https://x.com/polarbear148691/status/2099326904625135970?s=46`）を設定済み。「Xでシェア」実行時、インテントURLに`&url=`としてこのURLが自動付加され、指定ポストへの引用RTになる

Playwrightでシェアボタン押下時に実際に生成されるインテントURLをデコードし、`via`パラメータおよび`url`パラメータ（指定ポストのURL）が意図通り付加されることを確認済み。3ページのconsoleエラーなしも確認済み。

### ④ 所持データ分析ページ・ゲストデータ廃止（コード実装完了・2026-09-19。D1マイグレーションは2026-09-20に適用済み）
Cowork側の設計資料`docs/02_分析ページ/④分析ページ設計_ゲストデータ廃止.md`に基づき実装した。背景・設計判断の詳細は同資料および本ファイル「データベース」章の該当セクションを参照。

1. **ゲストの所持データ保存を廃止**：`worker.js`の`handleOwnershipLog()`を変更し、`getSessionUser()`が取れない（未ログイン）場合は`units_ownership`/`supporters_ownership`への書き込みを一切行わないようにした。旧仕様の`isValidGuestUid()`・クライアント側の`guestUid`発行ロジック（`unit.html`/`supporter.html`の`GUEST_UID_KEY`/`getOrCreateGuestUid()`）は削除済み
2. **匿名利用回数カウンタを新設**：ゲストからの`/api/log`・`/api/log-supporter`送信時は、代わりに`usage_counters`テーブルの該当キー（`unit_guest`/`supporter_guest`）を+1する（`incrementUsageCounter()`）。個人とは紐付かない
3. **既存ゲストデータの削除マイグレーション**：`migrations/0003_purge_guest_data.sql`を新規作成（Cloudflareダッシュボードでの手動適用が必要だったが、**2026-09-20に適用済み**）
4. **分析API新設**：`GET /api/analytics/units`・`GET /api/analytics/supporters`（`handleAnalytics()`）。ログイン必須（未ログインは401）。`units_master`/`supporters_master`を軸に`units_ownership`/`supporters_ownership`を`LEFT JOIN`し、所持数降順のランキングと母数（`totalUsers`=`users`の全件数）をJSONで返す
5. **分析ページ新設**：`analytics.html`を新規作成。未ログイン時はログイン案内のみ表示しAPIは叩かない（`unit.html`等と同じ「`/api/me`失敗時はゲスト表示にフォールバック」方針を踏襲）。ログイン中は機体/サポート2タブでランキング（アイコン・名称・タイプ/スキル・期間限定バッジ・バー・所持率%・所持人数）を表示し、冒頭に「集計対象：登録ユーザー n人のデータ」を明記。デザインは`top.html`と同じ銀河系パレット・フォントを踏襲（背景の動くCanvas演出のみ、データ量の多いページのため軽量な静止ネビュラに変更）。バー表現は`dataviz`スキルの指針（単一系列＝1色の単色バー、4px丸め角のdata-end、値はバー外側に配置等）に沿って実装
6. **top.htmlへのログイン限定導線**：`top.html`に`/api/me`を個別に呼び出し、ログイン中のみ「みんなの所持率ランキング」カード（`#analyticsSection`）を表示する`toggleAnalyticsNav()`を追加

**検証**：このリポジトリの開発環境にはNode.jsが無く、既存のNode/`node:sqlite`ベースのテストハーネスは今回使えなかったため、CDN経由でsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込み、D1の`prepare/bind/run/first/all/batch`相当のAPIを再現したモックと`worker.js`本体をESモジュールとしてブラウザ内で直接importして`fetch`ハンドラを呼び出す新方式のテストハーネスを構築した（`migrations/0003`・`0004`も実ファイルを`fetch()`して実行し内容を検証）。全30ケース成功（認証まわりの回帰、ゲスト/ログイン済みでの所持ログ保存の分岐、分析APIのログインガード・ランキング内容・母数、マイグレーションの削除範囲）。あわせてPlaywrightでUIレベルの検証（`analytics.html`のガード表示・ランキング描画・タブ切替、`top.html`の導線表示切替、`unit.html`のゲスト送信payloadに`guestUid`が含まれないこと・チェッカー本体が引き続き動くこと）も実施し、4ページ全てでconsoleエラーが出ないことを確認済み。テストハーネス自体は検証用の一時ファイルでリポジトリには含めていない（検証後削除）。

**Cowork側資料の同期**：`docs/WEBサイト仕様書.md`も今回の変更内容に合わせて更新済み（ファイル構成・API一覧・DB設計・テストケース一覧・既知の制約の各章）。ただし外部Artifact「[UR所持データDB設計（ER図）](https://claude.ai/artifact/CckCfCzdc3cvmdYbptvrDa)」は`usage_counters`新設・ゲストデータ廃止を反映できておらず要更新（Cowork側での対応が必要）。

### ⑦ 所持率ランキング表示の改良（ティアリスト化）（コード実装・検証完了・2026-09-20。git commit・push・本番反映も完了＝下記「⑦のgit commit・push」参照）
Cowork側の設計資料`docs/02_分析ページ/⑦ランキング表示改良_ティアリスト設計.md`に基づき実装した。ユーザーが離席前提で「判断に悩む箇所は一旦コード側で判断して進めてよい」と指示したため、以下は設計資料の範囲内でコード側が判断した実装詳細である。

1. **`analytics.html`の全面刷新**：従来の1行カード縦並び（`.rankList`/`.rankRow`）を廃止し、所持率の固定閾値（80%以上／60〜79%／40〜59%／20〜39%／20%未満、`TIERS`定数1箇所にまとめて調整しやすくした）で帯分けしたティアリスト型グリッド表示に置き換えた。該当0件の帯は帯ごと非表示。同率は機体No.昇順、順位は競技順位方式（1,2,2,4…）で算出
2. **タイル表示**：アイコン＋直下に所持率%、帯の色（シアン系5段階、`docs/02_分析ページ/⑦ランキング表示改良_ティアリスト設計.md`記載のdataviz検証済みカラーをそのまま使用）の1px枠、期間限定バッジ（金色「限」）、自分の所持チップ（✓）。順位・凸レベルはタイルに出さず、タップ時の詳細（ボトムシート）でのみ表示
3. **タイプ別絞り込み**：機体「すべて／攻撃／支援／耐久」、サポート「すべて／HP回復／EN回復／複合」のチップ。非該当タイルは削除せず`opacity`で薄く表示し帯の位置関係を保持。チップ選択は機体/サポートのタブそれぞれ独立して保持（`state.units.filter`/`state.supporters.filter`）
4. **自分の所持の重ね表示**：「自分の所持を表示」チェックボックス（既定ON、機体/サポートそれぞれ独立）。`mine`が空のときは「所持データがまだ同期されていません。チェッカーで『画像で保存』を押すと、ここに反映されます」の案内を表示
5. **詳細表示**：設計資料は「スマホはボトムシート、PCはタイル近傍のポップオーバー」としていたが、仮実装として**PCも含め全幅でボトムシート形式に統一**した（`max-width:460px`で中央寄せ）。タイル近傍への動的ポップオーバー配置は実装コストに対して仮実装の価値が低いと判断し、次期本実装時にPC専用のポップオーバーへ分岐させることを推奨する
6. **ページ幅**：PC（880px以上）でランキング部分は`max-width:880px`に拡大しつつ、ヘッダー・凡例・フィルタ行など（`.headArea`クラス）は`max-width:640px`のまま中央寄せにして、設計資料の「ヘッダー・導線部は従来幅のまま」を実現
7. **`totalUsers===0`の特別表示**：機体/サポート両方の`totalUsers`は同一クエリ（`SELECT COUNT(*) FROM users`）のため必ず同値になる。個別に判定せず、`contentView`直下に共通の「集計対象のユーザーがまだいません」を1つだけ表示する実装にした（設計資料はタブごとの表現を明示していなかったため、シンプルな方を採用）
8. **`worker.js`変更**：`handleAnalytics()`に`mine`（ログイン中ユーザー自身の所持状況、`{id: level}`形式）を追加。既存の`ranking`・`totalUsers`の算出方法は変更していない。追加クエリは`SELECT {idColumn}, level FROM {ownershipTable} WHERE user_uid = ?`の1本のみ
9. **`docs/WEBサイト仕様書.md`の同期**：2.5節（分析ページ機能）・3章（APIレスポンス）・5章（テストケース。⑦分を5.0として追加し、旧5.0/5.1を5.1/5.2に繰り下げ）・6章（既知の制約）・7章（関連資料）を更新済み

**検証**：この開発環境にはNode.jsが無いため、`worker.js`の`mine`追加はCDN経由のsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込むブラウザ内テストハーネスで検証（ownedCount降順の維持・未ログイン401・`mine`が対象ユーザーの所持行と一致すること・所持0件時に`mine`が空オブジェクトになることを確認）。`analytics.html`側は`/api/me`・`/api/analytics/*`をモックしたPlaywright UIテストで、84機を5帯すべてに分散させたケース／サポート側で80%以上・60〜79%を意図的に空にしたケース／`totalUsers=0`ケース／未ログインのガードケースの4パターンを、スマホ（390px）・タブレット（700px）・PC（1024px）の3幅で実施。帯の表示・非表示、グリッド列数（6/8/12列）・横スクロールなし、タイプ絞り込みのdim件数、✓バッジの有無、同期案内の表示条件、詳細ボトムシートの表示内容、タブ切り替え後のフィルタ状態保持、コンソールエラーなしをいずれも確認済み。テストハーネス自体はリポジトリには含めていない（検証後削除）。

**未対応（要対応）**：
- PCでの詳細表示のポップオーバー化（上記5.参照）、タイル長押しでの比較機能などは設計資料側で明示的にスコープ外とされているため未実装のまま

### ⑦のgit commit・push（完了・2026-09-20）
前回セッションで離席指示により未実施だったcommit・pushを、差分レビュー（`analytics.html`・`worker.js`・本ファイルの3ファイル、+392/-71行）の上で実行した。内容は上記「⑦ 所持率ランキング表示の改良」節の記載と一致していることを確認済み。`git commit`（コミット`dfd3fff`）→`git push origin main`。Cloudflare Workersの自動デプロイにより本番環境へ反映済み。

### ⑧「トップに戻る」が効かない不具合（X経由）への対策（解決済み・2026-09-20）
Cowork側の設計資料`docs/09_その他・アーカイブ/⑧トップに戻る不具合_原因調査と対策.md`に基づき実装した。ユーザー報告：Xの投稿内リンクからチェッカーを開き、ログイン後「トップに戻る」を押してもトップに遷移しない（通常ブラウザでは正常）。

- **原因（最有力仮説）**：過去に`/`を`/unit`へ301（永続）リダイレクトしていた時期があり（③のトップページ実装で廃止済み）、その301をブラウザ（特にXアプリ内ブラウザ）がキャッシュしたまま残っていると、`worker.js`側を直しても該当ユーザーの`/`は`/unit`（チェッカー）に化け続ける。現在のコードには本症状を再現する箇所は見つからず、`worker.js`にも現時点でリダイレクト処理は存在しない
- **対策**：`auth.js`の「トップに戻る」リンク（`href`）とログイン・新規登録成功後の遷移先（`window.location.href`）を、`"/"`から`"/top"`に変更した。`/top`はWorkerが一度もリダイレクト対象にしたことがないURLのため、古い301キャッシュを持つユーザーでも到達できる。既存の`isTopPage`判定（`/`・`/top`・`/top.html`のいずれも許容）は変更不要で、`/top`遷移後にボタンが誤表示されることもない
- **付随修正**：`unit.html`・`supporter.html`・`analytics.html`の`<link rel="prefetch" href="/">`も`/top`に変更（`/`の先読みは古い301キャッシュに当たるだけで無意味なため）
- **再発防止**：「`/`や既存の公開URLに永続リダイレクト（301/308）を設定しない」を上記「技術的な注意点」に追記した
- **検証**：ローカル静的配信（`python -m http.server`）上でPlaywright（Python版）により、(1) ログイン中の3ページ（`unit.html`/`supporter.html`/`analytics.html`）で「トップに戻る」リンクの`href`が`/top`になっていること、(2) ログイン・新規登録成功後の実際の遷移先が`/top`であること（実ナビゲーションを監視して確認）、(3) `isTopPage`判定が`/`・`/top`・`/top.html`のいずれでも真になり、実際に`top.html`を開いた状態で「トップに戻る」ボタンが表示されないこと、(4) 3ページの`prefetch`リンクの`href`が`/top`になっていること、をいずれも確認した。ローカル配信には`/top`という拡張子なしパスの実体がないため、遷移先を`/top`にしたことで発生するconsoleの404は本番（Cloudflareが`/top`を配信）では起きない想定内のノイズとして除外して判定した
- `git commit`（コミット`b30fe90`）→`git push origin main`。Cloudflare Workersの自動デプロイにより本番環境へ反映済み
- **実機確認（完了・2026-09-20）**：ユーザーがXアプリ内ブラウザで動作を確認し、改善を確認済み（Cowork側`docs/WEBサイト仕様書.md` 5.0.1節・6章に記録）。原因の厳密な切り分け（`/top`直接アクセス等での確定）は行っていないが、症状自体は解消

### ④マイグレーション（`0003`・`0004`）のD1適用（完了・2026-09-20）
`migrations/0003_purge_guest_data.sql`（既存ゲスト所持データ・ゲストuser行の削除）・`migrations/0004_usage_counters.sql`（`usage_counters`テーブル新設）を、ユーザーがCloudflareダッシュボード（D1 > Console）で手動適用済み（Cowork側`docs/WEBサイト仕様書.md`で確認記録済み）。これにより既存ゲストデータが削除され、ゲストの利用回数カウンタ（`usage_counters`）も正常に記録されるようになった。

### ⑨ 所持率ランキングページ改良第2弾（コード実装・検証完了・2026-09-21）
Cowork側の設計資料`docs/02_分析ページ/⑨ランキングページ改良第2弾_設計.md`に基づき実装した。⑦（ティアリスト化）後にユーザーから寄せられた8点の改善指示をまとめたもので、変更は`analytics.html`のみ（`worker.js`・DBは変更なし。`limited`・`ownedCount`・`totalUsers`は既にAPIが返していたため）。

1. **用語統一**：分析ページのタブ「UR機体」→「URユニット」、説明文「UR機体・URサポート」→「URユニット・URサポート」に変更（他ページは既に「ユニット」で統一済みだったため今回はこの2か所のみ）
2. **ティアを10%刻み10段に再設計**：旧5段（80%以上／60〜79%／40〜59%／20〜39%／20%未満）を廃止し、90%以上〜10%未満の10段に変更。**帯の判定と表示の両方を「実数の切り捨て整数」に統一**したことで、旧実装で起きていた「20%未満の帯なのにタイルには20%と表示される」（判定は四捨五入前の実数・表示は四捨五入という不一致が原因）矛盾を構造的に解消した。色は10段の単色明度ランプが検証ツール（`validate_palette.js --ordinal`）の基準を満たせなかったため、⑦で検証済みの5色を隣接2段で共有する方式にした
3. **表示精度**：タイルは整数（切り捨て）、詳細は所持率を小数第1位（切り捨て）まで表示（登録ユーザーが1,000人を超えたら小数第2位に切替。`decimals = totalUsers > 1000 ? 2 : 1`）。順位は所持人数降順の全体順位のままで、絞り込みの影響を受けない（詳細のラベルに「全体」を付けて明示）
4. **絞り込みの強化**：既存の「タイプ」チップ（攻撃/支援/耐久、サポートはHP回復/EN回復/複合）に加えて「区分」チップ（すべて／期間限定／恒常）を新設し、両方を**AND条件**で併用可能にした。絞り込みが1つでも有効なときだけ「該当N/M機」を表示（`aria-live="polite"`）。区分の呼称は当初「通常」としていたが、ユーザー指示によりコミュニティでの一般的な呼び方「恒常」に変更した
5. **「対象外を非表示」チェックを追加**：既定OFFでは⑦と同じく対象外を薄く表示するのみだが、ONにすると対象外のタイルをDOMから除外して対象のみ詰めて表示し、0件になった帯は帯見出しごと消える。全体で0件になった場合は帯の代わりに「条件に一致するユニット（サポート）がありません」を表示
6. **サポートアイコンの右端基準トリミング**：サポート画像は横長で右側にキャラの顔があるため、`.supIcon`クラス（`object-position:right center`）をサポートのタイル・詳細画像に追加。ユニット画像はほぼ正方形のため変更なし
7. 上記1〜6はユニット/サポート両タブに同じロジックを共用して適用（絞り込み状態はタブごとに独立、ページ再読み込みで既定に戻る＝保存はしない）

**検証**：この開発環境にはNode.jsが無いため`worker.js`側の検証は不要（変更なし）。Python版PlaywrightでローカルHTTPサーバー（`http.server`）を立て、`/api/me`・`/api/analytics/units`・`/api/analytics/supporters`をモックしたUIテストを実施。境界値（実数90.0%/20.0%/10.0%ちょうど・7.5%等、割り切れない母数40）で帯名と表示数字が一致すること、10段のうち「20%未満」という旧ラベルが存在しないこと、詳細の小数第1位/第2位切替、順位ラベルの「全体」表記、タイプ×区分のAND絞り込み、「対象外を非表示」のON/OFF（DOM除外・帯消滅・0件案内・復帰）、タブ間の状態独立、サポート画像の`.supIcon`付与（詳細シートも含む）、タブ表記の「URユニット」化、`totalUsers=0`・未ログインガードの回帰、スマホ(390px)/PC(1024px)幅でのレイアウト崩れなしとconsoleエラーなしを確認済み（テストハーネスは検証用の一時ファイルでリポジトリには含めていない）。
`docs/WEBサイト仕様書.md`も2.5節（分析ページ機能）・5章（5.0.2として新規テストケース追加）・6章（既知の制約）・7章（関連資料）を今回の内容に合わせて更新済み。

### Xシェア時の所持データ登録（完了・2026-09-22）
ユーザーから「DB登録が『画像で保存』ボタン押下時のみになっているが、『Xでシェア』ボタン押下時も登録するようにしたい」との指示があり対応した。

- 調査の結果、`unit.html`/`supporter.html`とも`sendOwnershipLog()`（`/api/log`・`/api/log-supporter`への送信）は`btnSave`（画像で保存）のクリックハンドラ内でのみ呼ばれており、`btnShare`（Xでシェア）のクリックハンドラには含まれていないことを確認した
- `unit.html`・`supporter.html`の`btnShare`クリックハンドラ末尾（ツイートインテントを`window.open`した直後）に`sendOwnershipLog()`呼び出しを追加。既存の`sendOwnershipLog()`自体は変更していないため、ログイン中はセッションの`user_uid`で保存、未ログインは`usage_counters`の匿名カウンタ加算という既存の分岐（④）はそのまま踏襲される
- **検証**：Python版Playwrightで、ローカル静的配信（`http.server`）上の`unit.html`/`supporter.html`を開き、`window.open`をモックした上で「Xでシェア」ボタンをクリックし、それぞれ`/api/log`・`/api/log-supporter`へのリクエストが実際に発生することをネットワークイベントの監視で確認した。`worker.js`は変更していないためD1モックテストハーネスでの回帰確認は不要と判断
- `git commit`→`git push origin main`。Cloudflare Workersの自動デプロイにより本番環境へ反映済み

### ⑪ DB登録機能 不具合修正・機能追加（コード実装・検証完了・2026-09-22。git commit・push・本番デプロイ完了。**D1マイグレーション適用は未実施**）
Cowork側の設計資料`docs/01_所持チェッカー・DB登録/⑪DB登録機能_実装設計.md`に基づき実装した。元になった調査は`docs/01_所持チェッカー・DB登録/⑪DB登録機能_不具合調査と機能追加設計.md`（ユーザー指摘6項目のうち⑥所持状況参照画面は対象外、残り5項目が対象）。

1. **①`registered_at`のJST化**：`worker.js`に`toJstIsoString(date)`ヘルパーを追加し、`replaceOwnership()`内の`registered_at`生成に適用（`units_ownership`・`supporters_ownership`のみ対象。`users`/`sessions`の他タイムスタンプはセッション有効期限判定等の内部比較に使われるためUTCのまま変更していない）。既存データの一括補正用に`migrations/0005_fix_registered_at_to_jst.sql`を新規追加（`registered_at LIKE '%Z'`の行のみが対象のため冪等。**Cloudflareダッシュボードでの手動適用が必要・未適用**）
2. **②画像保存・Xシェア送信の堅牢化**：`sendOwnershipLog()`の`fetch`に`keepalive: true`を追加。Xシェアの`window.open()`直後の送信がページ遷移（特にXアプリ内蔵ブラウザ）で打ち切られるリスクに対応
3. **③「データ登録」ボタン新設**：`.actionbar`の左端（画像で保存の左）に追加し、既存の`flex:1`をそのまま継承して3等分に自動対応。DBへの登録のみを行い、結果を画面下部の簡易トースト（`#registerToast`・`showRegisterToast()`）で明示する。配色は暫定でグリーン系（`#7fd9a0`）。`sendOwnershipLog()`をPromiseを返す形に変更し、`worker.js`の`handleOwnershipLog()`のレスポンスも`new Response("ok")`から`{ok:true, loggedIn:true/false}`のJSONに変更した（既存の`btnSave`/`btnShare`はレスポンス本文を読まないため後方互換）
4. **④チェッカー起動時の所持状況自動復元**：トリガーは「ログイン」ではなく「チェッカーのページ読み込み」。新規API`/api/my-ownership`・`/api/my-ownership-supporter`（`handleMyOwnership()`）を追加し、`unit.html`/`supporter.html`の読み込み時に自動取得して`state`へ反映する。DB取得が完了する前にユーザーが凸レベルを変更していた場合（`userEditedSinceLoad`フラグ）は上書きをスキップし、直近の編集を優先する
5. **⑤ユニット・サポート両対応**：③④とも`unit.html`・`supporter.html`に完全に並行した実装で適用（diffの行数も一致することを確認済み）

**検証**：この開発環境にはNode.jsが無いため、`worker.js`の変更はCDN経由のsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込むブラウザ内テストハーネスで検証した。当初、ブラウザの`fetch`APIが`Request`オブジェクトへの`Cookie`ヘッダー設定を禁止ヘッダーとして無視する（`new Headers().set("Cookie",...)`が`Request`に渡すと消える）ためテストが正しく動かない問題があり、`url`/`method`/`headers.get`/`json`のみを持つ疑似Requestオブジェクトに差し替えて解決した（worker.js自体の不具合ではない。本番のCloudflare Workersではこの制限は存在しない）。全16件のアサーションが成功。`migrations/0005`のSQLも同様にsql.js上で直接実行し、通常ケース・日付をまたぐケース（UTC 15:59→JST翌日0:59）の変換正しさ・冪等性を確認済み（全5件成功）。`unit.html`/`supporter.html`はPlaywright UIテストで、ページ読み込み時のDB復元・`userEditedSinceLoad`ガード（DB取得を遅延させたモックで検証）・データ登録ボタンの3パターン（成功/未ログイン/通信エラー）のトースト表示・320px幅での3ボタンレイアウト崩れなしを、両チェッカーで確認済み（全26件成功。テストハーネス自体はリポジトリには含めず検証後削除）。ローカル静的配信固有の`/top`プリフェッチ404（未変更の`top.html`でも同様に発生することを確認済み）は既知のノイズとして除外している。
`docs/WEBサイト仕様書.md`も1.2節（ファイル構成）・2.1節（チェッカー機能）・2.4節（サーバーサイド処理）・3章（API一覧）・5.-1節（新規テストケース）・6章（既知の制約）・7章（関連資料）を更新済み。

git commit（コミット`331868a`）→ `git push origin main`実行済み。Cloudflare Workersの自動デプロイにより本番環境へ反映される見込み。

**未実施（要対応）**：
- `migrations/0005_fix_registered_at_to_jst.sql`のCloudflareダッシュボードでの手動適用（0001〜0004と同じ手順。D1 > Console）
- 本番デプロイ後の実機確認（PC/スマホ通常ブラウザ/スマホXアプリ内蔵ブラウザ × 画像保存/Xシェア/データ登録。特にXアプリ内蔵ブラウザでの`keepalive`の効果を重点確認）

### ⑫ 初回データ登録フラグ（コード実装・検証・git commit・push完了・2026-09-22。D1マイグレーションは事前にユーザーが適用済み）
Cowork側の設計資料`docs/01_所持チェッカー・DB登録/⑫初回データ登録フラグ_設計.md`に基づき実装した。⑪完了後、ユーザーから「URを1件も所持していないユーザがデータ登録したケース」と「そもそもデータ登録していないユーザのケース」を区別したい、との追加要望があった。**このセッション開始時点で、必要な`migrations/0006_add_first_registered_flag.sql`はユーザーが既にCloudflareダッシュボードで本番D1に適用済みだった**（コード側はリポジトリへのファイル追加のみ）。

1. **背景**：`units_ownership`等は「その時点の所持状況のスナップショット」のみを保持するため、所持0件で登録した場合はDBに行が一切残らず、「未登録」と区別できなかった。この結果、`analytics.html`の同期案内（`syncNote`）が、登録済み・所持0のユーザーにも「まだ同期されていません」と誤表示し続けていた
2. **`users`テーブルへのカラム追加**：`units_first_registered_at`／`supporters_first_registered_at`（TEXT・JST）を追加。**ユニット／サポートで別カラムに分けた**（④の設計確認で「機体チェッカー押下時はunits_ownershipのみに保存」を重視した past decisionと同じ考え方で、片方のチェッカーしか使わないユーザーの状態を正しく表現するため）。真偽値ではなく日時にしたのは、`toJstIsoString()`との表記統一と、`users.first_seen`を残した過去判断と同じ理由（将来の分析転用の可能性）
3. **`worker.js`の変更**：`touchUserLastSeen()`を`touchUserLastSeenAndMarkRegistered(env, userUid, isSupporter)`に置き換え、`UPDATE users SET last_seen = ?, ${column} = COALESCE(${column}, ?) WHERE user_uid = ?`で初回登録日時を一度だけセットする。`handleOwnershipLog()`はentriesの件数に関わらずこの関数を必ず呼ぶ既存の作り（コード変更不要）だったため、所持0件の登録でも確実にフラグが立つ。`handleMyOwnership()`・`handleAnalytics()`のレスポンスに`registered`フィールドを追加した
4. **所持率の母数フィルタ（追加スコープ）**：設計提示後、ユーザーから「未登録ユーザーは所持率分析の対象外とすべきでは」との確認があり、調査の結果、当初案では`handleAnalytics()`の`totalUsers`（母数）が`users`全件数のままだったことが判明。分子（`owned_count`）は元々「データ登録済みユーザーの中の所持者数」だったため、分母もこれに揃えるべきと合意し、`totalUsers`のクエリを`WHERE ${registeredColumn} IS NOT NULL`に変更した。**この変更により、デプロイ後は各ユニット・サポートの表示所持率が一段階上昇する**（母数縮小のため。意図した挙動）
5. **`analytics.html`の変更**：`dataCache`に`registered`を追加してキャッシュし、`syncNote`の表示条件を`Object.keys(mine).length > 0`（所持データの件数）から`dataCache[tabKey].registered`（登録済みフラグ）に変更。これが今回のユーザー実害（登録済み・所持0でも同期案内が出続ける）の直接修正
6. **`unit.html`／`supporter.html`は変更不要**：`/api/my-ownership`系のレスポンスに`registered`が増えるが、現状のクライアント側は`ownership`のみ参照しており動作に影響しない（将来の⑥所持状況参照画面で活用予定）
7. **既存データのバックフィル（`migrations/0006`）**：「現在ownershipテーブルに行が残っているユーザーのみ」を登録済みとみなす（過去に所持0件で登録した可能性のあるユーザーは区別できないため、保守的に「未登録」のまま扱う。実害は少ない側に倒す判断）。バックフィルする初回登録日時は、当初案「現存する行のregistered_at（近似値）」から**ユーザー指示によりマイグレーション適用日（JST・一律）に変更**した

**検証**：この開発環境にはNode.jsが無いため、`worker.js`の変更はCDN経由のsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込むブラウザ内テストハーネスで検証（全13件成功：所持0件登録でのフラグ立て、`COALESCE`による再登録時の非上書き、`handleMyOwnership()`/`handleAnalytics()`の`registered`、ユニット/サポートの独立性、`totalUsers`の母数フィルタ、既存回帰）。`migrations/0006`のバックフィルSQLも同様にsql.js上で直接実行し、ユニット/サポート独立の判定・JST形式・冪等性を確認済み（全7件成功）。`analytics.html`はPlaywright UIテストで、`registered:false`／`registered:true`+所持0件（実害の直接確認）／`registered:true`+所持あり（回帰）の3パターンをユニット・サポート両タブで確認済み（全6件成功）。ローカル静的配信固有の`/top`プリフェッチ404は既知のノイズとして除外している（テストハーネスはリポジトリには含めず検証後削除）。
`docs/WEBサイト仕様書.md`も1.2節（マイグレーション一覧）・2.5節（分析ページ機能）・3章（API一覧）・4章（DB設計）・5.-2節（新規テストケース）・6章（既知の制約）・7章（関連資料）を更新済み。

git commit → `git push origin main`。Cloudflare Workersの自動デプロイにより本番環境へ反映される見込み（ユーザーの承認を得てcommit・push済み）。

### ⑬ 所持率100%超え不具合の原因調査と改善（コード実装（①のみ）・検証・git commit・push完了・2026-09-22。③bは意図的に見送り）
Cowork側の設計資料`docs/01_所持チェッカー・DB登録/⑬所持率100%超え不具合_調査と改善設計.md`に基づき対応した。⑫デプロイ後、ランキングページで一部の機体の所持率が100%を超えて表示される不具合が報告された。

1. **原因**：`handleAnalytics()`の所持数集計が`COUNT(o.id)`（**行数**）になっており、`units_ownership`/`supporters_ownership`には`(user_uid, unit_id)`の一意制約が存在しない。同一ユーザー・同一機体の重複行がDBにあると、その分だけ`owned_count`（分子）が水増しされる一方、`totalUsers`（分母）はユニークユーザー数のままだったため、非対称な計算になっていた。この潜在バグは⑫以前から存在したが、⑫で母数を「データ登録済みユーザーのみ」に絞ったことで初めて100%超えという形で顕在化した
2. **重複行が生じうる経路**：`replaceOwnership()`は「そのユーザーの既存行を全削除→現在の所持状態を入れ直す」方式のため、同一ユーザーからの2つの独立したリクエストがほぼ同時に届く（複数端末・複数タブでの利用等）と、DELETE→DELETE→INSERT→INSERTの順に処理され重複行が残ることがある
3. **①即時修正（実装・デプロイ済み）**：`handleAnalytics()`の集計を`COUNT(o.id)`から`COUNT(DISTINCT o.user_uid)`に変更。DBに重複行が残っていても`ownedRate`が数学的に100%を超えなくなる。**単独で本番の表示不具合を解消できる、リスクのない変更**として最優先で適用した
4. **②データクレンジング＋③a一意インデックス（設計通りマイグレーション化）**：`migrations/0007_dedupe_ownership.sql`を新規追加。同一`(user_uid, unit_id)`の重複行のうち`MAX(id)`（最後に書き込まれた行）だけを残して削除した後、`(user_uid, unit_id)`への一意インデックスを作成する（DELETE→CREATE UNIQUE INDEXの順を厳守）。**Cloudflareダッシュボードでの手動適用が必要・未適用**
5. **③b `replaceOwnership()`のUPSERT化は意図的に見送った（重要な判断）**：設計資料は`replaceOwnership()`を`INSERT ... ON CONFLICT(user_uid, idColumn) DO UPDATE`によるUPSERT方式に変更する再発防止案を提示しており、当初はこれも実装したが、**レビューの結果、本番デプロイ前に重大なリスクがあると判断し実装を取り下げた**。理由：`ON CONFLICT(user_uid, idColumn)`は対象カラムへの一意インデックス（`migrations/0007`で追加）が本番D1に存在することが前提であり、インデックスが無い状態でこのSQLを実行すると「ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint」で**全件エラーになる**（`handleOwnershipLog()`のtry/catchで握りつぶされクライアントには200が返るため、症状としては「データ登録してもDBに何も保存されない」が無言で発生する）。このセッションでは`migrations/0007`が本番適用済みである確認が取れなかった（⑫と異なり、ユーザーから「SQL適用済み」の申告はなかった）ため、pushしたコードが本番D1に反映された瞬間から全ユーザーのデータ保存が機能しなくなるリスクを避けるため、`replaceOwnership()`は**変更前の「全削除→全挿入」のまま維持**した（①の集計修正はこの関数と無関係のため、このリスクとは独立して安全に適用できる）。`worker.js`にはこの経緯と「`migrations/0007`適用後にUPSERT化を追加実装すること」をコメントで明記した
6. **設計資料との差分**：設計資料の「変更対象ファイルと影響範囲」表は`replaceOwnership()`の変更も含んでいたが、上記の理由により今回はこの部分のみ未実装。②③a（`migrations/0007`）はファイルとして追加済みだが、Cloudflareダッシュボードでの手動適用はまだ

**検証**：この開発環境にはNode.jsが無いため、CDN経由のsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込むブラウザ内テストハーネスで検証。①の集計修正は、意図的に重複行を仕込んだDB状態に対し`handleAnalytics()`を呼び、`owned_count`が重複を含まないユニークユーザー数になり`ownedRate`が100%を超えないことを確認（一意インデックスが無い、現在の本番相当のスキーマ状態で検証）。`migrations/0007`のSQL自体も、重複行を用意したDBに対して直接実行し、`MAX(id)`の行だけが残ること・一意インデックスが作成されることを確認済み。`replaceOwnership()`（変更なし）についても、一意インデックスが無い状態で単発の送信・再送信が正しく動作し、JST化（⑪）・登録済みフラグ（⑫）に回帰がないことを確認済み（全8件成功。テストハーネスはリポジトリには含めず検証後削除）。
`docs/WEBサイト仕様書.md`もDB設計（一意インデックス予定の記載）・API仕様（`ownedRate`計算式の説明）・既知の制約（③bの見送りとその理由）を更新済み。

**訂正（2026-09-23・解決済み）**：ユーザーが本番D1で診断SQLを実行した結果、**上記の「重複行が原因」という診断は誤りだったと判明した**。実際の原因は`migrations/0006`のバックフィルSQL適用時点と対応する`worker.js`デプロイ時点の間の「デプロイギャップ」で、その間にデータ登録した一部ユーザーが初期登録フラグを取得できないまま残っていたこと（フラグの付け方・計算式ロジックいずれにも誤りはなかった）。ユーザーが同じ冪等なバックフィルUPDATEを本番D1で再実行してフラグを付与し直し、対象3機体（ル・シーニュ／νガンダム／エアリアル）とも100%超えの解消を確認済み。**`worker.jsのコード修正は不要`**。`migrations/0007_dedupe_ownership.sql`（重複行削除・一意インデックス追加案）は前提が誤りだったため**適用しない**（ファイル自体は経緯の記録として残し、ヘッダーコメントに訂正を追記済み）。`replaceOwnership()`のUPSERT化（③b）も同様に不要と判断し実装しない。再発防止として、バックフィルを伴う今後の機能追加では「バックフィルSQL適用とコードデプロイを同時に行う／間が空く場合は冪等なSQLを再実行する」運用ルールと、「バックフィルSQLは必ず冪等に設計する」ルールを推奨（Cowork側`docs/01_所持チェッカー・DB登録/⑬所持率100%超え不具合_調査と改善設計.md`末尾の訂正・`docs/COWORK.md`の記録より）。`handleAnalytics()`の`COUNT(DISTINCT o.user_uid)`への変更自体は無害（重複が無くても結果は`COUNT(o.id)`と一致する）なため、安全側の措置としてそのまま維持している。

### ⑩⑭ エタロ攻略チェッカー（エキスパート難易度）新設（コード実装・検証・git commit・push完了・2026-09-23。D1マイグレーション未適用）
Cowork側の設計資料`docs/03_エタロ攻略チェッカー/⑩エタロ攻略チェッカー_エキスパート詳細設計.md`（設計本体）・`docs/03_エタロ攻略チェッカー/⑭エタロ攻略チェッカー_要確認事項_実機確認結果.md`（⑩9章の要確認33項目の実機確認結果。称号名10件・No.6・No.24・2ミッション構成17ステージの網羅性が全件解消）に基づき実装した。エターナルロード エキスパート難易度の全29ステージ・69ミッション（うち称号ミッション11件）をチェックリスト形式で記録できる新規チェッカーページ。

1. **マイグレーション番号の繰り下げ**：設計書は`migrations/0005_eternal_road_missions.sql`・`migrations/0006_populate_eternal_road_missions.sql`という番号を想定していたが、その番号は実装時点で既に⑪・⑫が使用済みだったため、`migrations/0008_eternal_road_missions.sql`（テーブル定義）・`migrations/0009_populate_eternal_road_missions.sql`（マスターデータ投入）に繰り下げて実装した
2. **DB設計**：`eternal_road_missions`（ミッションマスター。`mission_id`は`stage_id*10+slot`）・`eternal_road_mission_clears`（クリア状況。`units_ownership`等と同じ最新スナップショット方式）の2テーブル。設計⑤時点の「ステージ＝1つの勝利条件」ではなく「1ステージに最大3ミッション」という⑩の設計をそのまま実装
3. **マスターデータのインポート元**：⑭の指示通り、⑩付属の元CSV（`エタロエキスパート_ミッションマスター案.csv`）ではなく、実機確認済みの`docs/03_エタロ攻略チェッカー/データ/エタロエキスパート_ミッションマスター案_確定版.csv`（称号名10件＋No.24の3件が確定反映済み）から69行のINSERT文を生成した。CSVの手動転記による誤りを避けるため、Pythonで直接パースしてSQL文を生成する方式を採った。`evidence`・`ingame_check_needed`列はCowork側の調査記録用のためテーブルスキーマには含めず、インポート対象から除外した
4. **`worker.js`**：`GET /api/eternal-road/missions`（マスターデータ取得。認証不要）・`POST /api/log-eternal-road-missions`（クリア状況のD1同期。ログイン必須。未ログイン時は`{ok:true, loggedIn:false}`を返すのみでD1書き込みは行わない）を追加。`mission_id`はunit/supporterの`MAX_UNIT_ID`方式（連番の範囲チェック）が使えない（`stage_id*10+slot`で飛び飛びの値になるため）ため、69件の正規IDを`Set`で持つ方式でバリデーションした
5. **`eternal-road.html`新設**：⑩7章の画面設計通り、アイコン画像は使わずテキストベースのチェックリスト。難易度タブは「エキスパート」のみ活性、「ノーマル」「ハード」は無効化＋「準備中」表示。上部に「ミッション達成数：n/69」「称号ミッション達成数：n/11」のサマリー、「称号ミッションのみ表示」「未達成のみ表示」の絞り込み（該当しない行・0件になったステージカードは非表示）。称号報酬は`is_title`の行のみ`称号「${title_name}」`という表示に組み立て、⑭で全称号名が確定済みのため「(確認中)」注記は実装しなかった（⑭3章の指示通り）
6. **同期方式（他チェッカーとの違い）**：他チェッカーは「画像で保存」等のボタン押下時にD1同期するが、エタロ攻略チェッカーは画像生成を伴わないチェックリストのため、⑩8章の判断通り専用の「保存」ボタンを新設し、押下時に`localStorage`の状態をそのまま`/api/log-eternal-road-missions`へ送信する方式にした。**DBからの復元（他チェッカーの⑪で実装した自動復元とは異なり）は行わない**：⑩7章の設計に明示的な復元エンドポイントの記載がなく、状態は常に`localStorage`が正（「保存」は一方向のアップロードのみ）という設計のまま実装した。将来、端末をまたいだ復元が必要になった場合は別途設計が必要
7. **`top.html`のROUTE 03導線（一旦差し戻し済み・2026-09-23）**：当初、⑭で要確認事項が解消されたことを受けComing Soonカードを実カードに差し替えたが、**ユーザーから「トップページからはまだ利用できないようにしてほしい。テスト運用後に自分で解放する」との指示があり、ROUTE 03のComing Soon表示に差し戻した**（`.soonGroup`もROUTE 03・04の2カード表示に復元）。`eternal-road.html`自体・`worker.js`のAPI・マイグレーションは実装済みのまま変更していないため、直接URL（`/eternal-road.html`）からはユーザー自身がテスト運用できる。トップページへの導線復活は、ユーザーが指示するまでコード側からは行わないこと

**マイグレーションのコメント除去（2026-09-23）**：ユーザーから「Cloudflareダッシュボードにコピペで実行できない」との指摘があり、未適用の`migrations/0005`・`0008`・`0009`から`--`コメント行（ヘッダー説明・適用前後の確認クエリ例）を全て削除し、SQL文のみのファイルにした（適用済みの0001〜0004・0006、および「適用しないこと」という警告コメント自体が本体の0007は対象外。0007のコメントを消すと警告が失われるため意図的に据え置いた）。コメント除去後も内容は変更していないため、sql.js上での再検証（0008+0009で69件投入・0005でJST変換）で問題ないことを確認済み

**検証**：この開発環境にはNode.jsが無いため、`worker.js`の新規エンドポイントはCDN経由のsql.js（WebAssembly版SQLite）をPlaywrightのChromiumページ上に読み込むブラウザ内テストハーネスで検証（`migrations/0008`・`0009`の実ファイルを`fetch()`して実行し内容も検証）。マイグレーションのデータ整合性（69件・称号11件・29ステージ）、マスターAPI（並び順・確定済み称号名3件のピンポイント確認）、クリア状況同期API（正常系・範囲外ID破棄・重複排除・ゲストの書き込みスキップ・空配列送信での全削除）を含む全17件が成功。`eternal-road.html`はPlaywright UIテストで、レンダリング・サマリー更新・称号報酬表示・localStorage永続化・2種類の絞り込み・保存ボタンの3パターン（成功/ゲスト/通信エラー）・難易度タブの無効化・console エラーなしを確認済み（全15件成功。テストハーネスはリポジトリには含めず検証後削除）。`top.html`は320/390/1024px幅でスクリーンショット確認し、3カード化後のレイアウト崩れがないことを目視確認済み。
`docs/WEBサイト仕様書.md`も1.2節（ファイル構成）・2章（処理一覧に新規チェッカーの節を追加）・3章（API一覧）・4章（DB設計）・5章（新規テストケース節）・6章（既知の制約）・7章（関連資料）を更新済み。

**未実施（要対応）**：
- ~~`migrations/0008`・`0009`のCloudflareダッシュボードでの手動適用~~ → 適用済み（2026-09-24にユーザー確認）
- 適用後、ユーザーが`/eternal-road.html`に直接アクセスしてテスト運用
- **テスト運用完了後、ユーザーからの指示があったら`top.html`のROUTE 03をComing Soonから実カードへ差し替える**（差し替え方法は上記7.の「実装済み導線に差し替え」時のコード＝コミット`36fa384`時点の`top.html`の該当箇所を参照すれば良い）

### ⑮ エタロ攻略チェッカー 機能追加（コード実装・検証・git commit・push完了・2026-09-23。D1マイグレーション0010は適用済み＝2026-09-24にユーザー確認）
Cowork側の設計資料`docs/03_エタロ攻略チェッカー/⑮エタロ攻略チェッカー_機能追加設計.md`に基づき実装した。テスト運用前のユーザー要望7点（アイコン追加／通常クリア追加／データ登録・画像で保存・Xでシェア／全達成で虹枠・通常クリアで金枠／フィルタ／ノーマル・ハード非表示／ログイン限定）への対応。**⑩からの方針変更2点**：「ゲスト利用可」→**ログイン必須**、「DBからの復元なし」→**起動時に`/api/my-eternal-road`から復元**（他チェッカーの⑪と揃えた）。

1. **`migrations/0010_eternal_road_stage_clears.sql`（新規）**：設計書どおり（`--`コメントなし）。通常クリアは別テーブル`eternal_road_stage_clears`（疑似ミッション方式はミッション数・称号集計の意味を変えるため不採用）。`users.eternal_road_first_registered_at`で「登録済み0件」と「未登録」を区別（⑫と同じ）。バックフィルは既存ミッション達成からステージクリア（`cleared_at`はMIN）と初回登録日時を作る冪等SQL
2. **`worker.js`**：`ETERNAL_ROAD_STAGE_IDS`（ミッションID集合から導出した29件）と共通パーサ`parseEternalRoadIdList()`を追加。`POST /api/log-eternal-road-missions`に`clearedStageIds`を追加し、欠落時（旧クライアント）は`clearedIds`から導出、保存するステージ集合は`clearedStageIds ∪ {floor(mission_id/10)}`に正規化。`replaceEternalRoadClears()`は1回の`batch()`でミッション・ステージ両テーブルのDELETE→INSERTと`users`の`eternal_road_first_registered_at = COALESCE(...)`・`last_seen`更新を行う。`GET /api/my-eternal-road`（`handleMyEternalRoad()`）を新設
3. **`eternal-road.html`（全面改修）**：ログインガード（`analytics.html`と同じクライアント側方式）、バナー画像付きステージカード（画像欠損時はNo.＋ステージ名のプレースホルダー）、クリアトグル（バナータップでも可）、未クリア=グレースケール／通常クリア=金枠／全ミッション達成=虹枠（DOMは背景グラデーション＋paddingで枠を描画）、整合ルール（ミッションチェックでクリア自動ON、クリアOFFでミッション全解除＋トースト）、サマリー（ステージクリア主指標＋クリア率・全達成・ミッション・称号。分母はマスターから算出し`TOTAL_TITLE_MISSIONS`定数は廃止）、フィルタ（ステータス4択＋トグル3種、`eternalroad_filter_v1`に保存）、localStorage v2（`eternalroad_expert_v2`、v1からの1回移行）、`unit.html`と同じ3ボタン・トースト・プレビューモーダル、Canvas画像（3列×10行のバナー、ピップ表示）、Xシェア。難易度タブはCSS・マークアップをコメントアウトで残し非表示、`EXPERT`ラベルのみ表示。カードは初回に1度だけDOMを組み立て以降はクラス更新のみ（再描画のたびに画像を読み直さないため）。キャンバスのロゴ取得元として見出しにESPロゴを追加
4. **`auth.js`（設計書にない追加変更）**：ログイン成功後は常に`/top`へ遷移する仕様だったが、トップページのROUTE 03が未公開のため、ガードからログインするとエタロに戻る導線が無くなる。そこで`<body data-auth-stay>`属性を持つページではトップへ遷移せずその場でリロードするようにした（他ページは挙動不変）
5. **DB復元のタイミング**：設計の`userEditedSinceLoad`フラグは実装したが、今回はマスター取得と`/api/my-eternal-road`を並行取得し、両方そろってから一覧を描画するため、復元前にユーザーが操作できる時間帯は実質存在しない（フラグは保険として残置）

**検証**：⑩と同じ方式。`worker.js`・`migrations/0008〜0010`はsql.js＋Playwrightのブラウザ内ハーネスで実ファイルを検証し全24件成功（バックフィルの内容・冪等性・ALTER再実行でエラーになること、POSTの各パターン＝ステージのみ／ミッションのみ補完／範囲外・重複破棄／旧クライアント互換／件数上限／空送信／未ログイン／他ユーザー非干渉、初回登録日時のJST・不変性、GETの3パターン）。`eternal-road.html`はAPIモックによるPlaywright UIテストで全53件成功（ガード表示とガードからのログイン→同ページリロード、29カード・画像・alt・欠損時プレースホルダー、整合ルール、2/3ミッションのステージでの枠3種、サマリー、フィルタ全種と件数・0件表示・リロード復元、v1→v2移行、DB復元の分岐、3ボタンの送信内容、シェア文、未ログイン応答トースト、consoleエラーなし、320/390/1024pxで横スクロールなし）。生成画像（1640×2660px）と各幅のスクリーンショットを目視確認済み。途中、UIテストで`loadChecker()`内の変数スコープの不具合（`try`ブロック内の`const`を外で参照）を検出し修正済み。テストハーネスはリポジトリに含めず、検証後に削除。
`docs/WEBサイト仕様書.md`も1.2節・2.3節・2.6節（全面書き換え）・3章・3.1節・4章・5.-5節（新規）・6章・7章を更新済み。

**未実施（要対応）**：
- ~~git commit・push~~ → ユーザー承認を得てcommit（`4321386`）・`git push origin main`済み（2026-09-23）。Cloudflare Workersの自動デプロイで本番反映される
- ~~Cloudflareダッシュボードでのマイグレーション適用~~ → 0008・0009・0010とも適用済み（2026-09-24にユーザー確認）。以下は当時の記録：**0008→0009（未適用なら）→0010の順**。**0010はpush（自動デプロイ）と同じタイミングで適用する**（⑬のデプロイギャップ対策。間が空いた場合は0010のINSERT/UPDATE 2文を再実行すればよい）。なお0008・0009が未適用のまま新コードがデプロイされても、エタロページがエラー表示になるだけで他ページへの影響はない
- ~~ユーザーによる`/eternal-road.html`でのテスト運用（トップページROUTE 03はComing Soonのまま。解放はユーザー指示後）~~ → 2026-09-24にトップページへ公開（下記「エタロ攻略チェッカーの本番化」参照）
- ~~公開告知ポスト作成後、`eternal-road.html`の`CONFIG.quotePostUrl`を設定（現在`null`）~~ → 2026-09-24に4ページ共通の新ポストを設定済み

### エタロ攻略チェッカーに「全完了」ボタンを追加（2026-09-23・ユーザーからの直接依頼）
「1つずつ達成にするのが大変」とのユーザー要望で、Coworkの設計資料なしにコード側で直接対応した。

- `eternal-road.html`のサマリー直下に「全ステージ・全ミッションを達成にする」ボタン（`#btnAllComplete`）を追加。押すと全29ステージのクリアと全69ミッションの達成をONにし、localStorageへ保存して再描画する
- 全件を上書きする操作のため`confirm()`で確認を挟む（キャンセル時は何も変えない）。完了時は「全ミッションを達成にしました。DBへの反映は「データ登録」から」とトースト表示。他の操作と同じく、DBへの送信はボタン押下時には行わない（「データ登録」等の3ボタンで送信）
- 画面上の一括操作のみで、`worker.js`・DBの変更はない。対になる「全解除」ボタンは依頼範囲外のため追加していない
- **検証**：Playwright UIテストで、キャンセル時は状態不変、承諾時にサマリー29/29・29/29・69/69・11/11・クリア率100%、全カード虹枠・69件チェック、ステータス件数、localStorage、データ登録で69件＋29ステージが送信されること、320/390pxで横スクロールなし、consoleエラーなしを確認（⑮の既存テストと合わせて全63件成功）
- ユーザー承認を得てcommit（`331061a`）・`git push origin main`済み（2026-09-23）。Cloudflare Workersの自動デプロイで本番反映

### ランキングページの集計対象表示・チェッカーのデータ登録状況表示（2026-09-23・ユーザーからの直接依頼）
Coworkの設計資料なしにコード側で直接対応した2点。`worker.js`・DBの変更はない（既存APIの`totalUsers`・`registered`・`ownership`を使うのみ）。

1. **`analytics.html`の集計対象表示**：ページ上部の「集計対象：登録ユーザー n人」はユニット側の`totalUsers`しか表示していなかった（⑫以降、母数はユニット・サポートで別々）。「集計対象（データ登録済みユーザー）：URユニット n人 ／ URサポート m人」と両方を表示するよう変更（`#totalUsersUnits`・`#totalUsersSupporters`）
2. **`unit.html`／`supporter.html`のデータ登録状況表示**：所持率ゲージの上に`#regStatus`を追加（ログイン中のみ）。起動時の`/api/my-ownership(-supporter)`の`registered`・`ownership`から、登録済みなら「✓ データ登録済み　登録中の所持率 n%（x / 総数）」をDB上の所持状況で表示し、画面上の所持状況と差がある場合は「登録後に変更した内容があります」と注記。未登録なら「まだデータ登録されていません」＋データ登録を促す案内。データ登録・画像で保存・Xでシェアの送信を`sendOwnershipLogAndTrack()`経由にし、ログイン中として成功したら送信時点の所持状況を登録内容として表示を更新。2ファイルは完全に並行した差分（語句「機/体」とAPIパスのみ異なる）
- **検証**：Playwright UIテスト全34件成功（分析ページの両人数表示・320/1024px、両チェッカーで未ログイン非表示／未登録の促し→データ登録で登録済みに／登録済みのDB所持率表示／編集で注記・元に戻すと消える／画像で保存・Xでシェア後の追従／320px／consoleエラーなし）
- **仕様として確定（ユーザー判断・2026-09-23）**：`restoreOwnershipFromServer()`は`data.ownership`が空オブジェクトでも上書きするため、ログイン中だが未登録のユーザーは、データ登録せずにページを開き直すと所持状況が空に戻る。当初は不具合として指摘したが、**ユーザーから「仕様。入力したら画面遷移する前にデータ登録をマストとする運用」との判断があり、この挙動は変更しない**（上書き条件に`data.registered`を加える修正は行わないこと）。未登録時の促し表示（上記2.）がこの運用を支える
- ユーザー承認を得てcommit（`7afc1b9`）・`git push origin main`済み（2026-09-23）

### トップページにデータ登録状況を表示（2026-09-23・ユーザーからの直接依頼）
チェッカー側に追加したデータ登録状況（上記節）を、トップページ（`top.html`）のURユニット／URサポート導線カードにも表示してほしいとの依頼に対応した。

- 各カードの説明文の下に`.regBadge`（`data-reg="unit"`／`"supporter"`）を追加。**ログイン中のみ**、`/api/me`でログインを確認した後に`/api/my-ownership`・`/api/my-ownership-supporter`を取得し、登録済みなら「✓ データ登録済み　所持率 n%（x / 84機）」（DBに登録されている所持状況から計算。総数は`UNIT_IMAGES`／`SUPPORTER_IMAGES`の件数）、未登録なら「未登録　開いて「データ登録」を押してください」を表示。未ログイン・取得失敗時は表示しない。カードは多少縦に伸びる（ユーザー了承済み）
- `.navcard .regBadge{display:inline-flex}`が`hidden`属性を打ち消していたため、`.regBadge[hidden]{display:none}`を明示（テストで検出して修正）
- **検証**：Playwright UIテスト全10件成功（未ログインで非表示、ユニット登録済み＋サポート未登録、範囲外IDを所持数に数えない、登録済み所持0件、ランキング導線の回帰、320/390/1024pxで横スクロールなし、consoleエラーなし）
- **PC幅の互い違いレイアウトも修正（ユーザー指示・同日）**：760px以上の2カラムレイアウトでは、`.route`・`.soonGroup`グリッドの最初のセルを見出し（`.sectionLabel`）が占めるため、カードが互い違いに並んでいた（変更前からの既存挙動）。メディアクエリ内で`.sectionLabel`に`grid-column:1 / -1`を指定して見出しを全幅にし、ユニット／サポート、ROUTE 03／04がそれぞれ横一列に揃うようにした。760/1024/1280pxで2枚の上端が一致し横スクロールが無いこと、スマホ幅（メディアクエリ外）は不変であることを確認
- ユーザーの事前指示により、実装・検証後にそのままcommit・`git push origin main`済み（2026-09-23）

### ⑯ データ未登録メッセージの文言修正（2026-09-23・Coworkで直接修正）
空データ（所持状況を入力しないままの登録）は所持率分析の母数に「所持0件のユーザー」として混入し真の所持率を歪めるため、「ボタンを押すこと」ではなく「正しい所持内容を登録すること」を促す文言に統一した（ユーザー指定の文言）。表示条件・ロジックは変更なし。

- `top.html`の`.regBadge.todo`：「未登録」→「**データ未登録**」、「開いて「データ登録」を押してください」→「**所持データを登録ください。**」。320px幅で「登録く／ださい。」と語中で折り返したため、「所持データを」「登録ください。」を`white-space:nowrap`のspanに分けて改行位置を固定
- `unit.html`・`supporter.html`の`.regStatus.todo`：「まだデータ登録されていません」→「**データ未登録**」、「下の「データ登録」を押すと所持状況が保存され、みんなの所持率ランキングにも反映されます」→「**所持状況をチェックしてから、下の「データ登録」で所持データを登録ください。みんなの所持率ランキングにも反映されます**」
- `analytics.html`の`.syncNote`（ユニット・サポート両方）：「所持データがまだ同期されていません。チェッカーで「画像で保存」を押すと、ここに反映されます」→「**所持データがまだ登録されていません。チェッカーで所持データを登録すると、ここに反映されます**」（「画像で保存」でも同期はされるが、ボタン操作を促す表現だったため同方針で修正）
- 変更しなかったもの：登録済み・変更ありの「「データ登録」を押すと反映されます」（更新の案内のため）、エタロ「全完了」トースト、`auth.js`の「未登録」（アカウント登録の意味）
- **検証**：Playwright（API応答をモック：ログイン中・未登録）で`top.html`・`unit.html`・`supporter.html`を320/390/1024pxで表示確認。改行崩れ・横スクロール・JSエラーなし
- Cowork側で実装・検証まで実施。commit（`d09c3b2`）・`git push origin main`はClaude Code側でユーザー指示により実施（2026-09-23）

### ㉔ エタロ画像出力の表記を自己紹介カードに統一（2026-09-24）
Cowork側の設計資料`docs/03_エタロ攻略チェッカー/㉔エタロ画像出力_自己紹介カード表記への統一_設計.md`に基づき実装した。付属の`docs/03_エタロ攻略チェッカー/試作HTML/㉔eternal-road_改修参考実装.html`（現行`eternal-road.html`をベースにした反映済み全文）との差分が`generateShareImage()`周辺とシェア文1行のみであることを確認した上で取り込んだ。変更は`eternal-road.html`のみ（`worker.js`・DB・画面上の表記は変更なし）。

- **画像の表記**：ミッション表示を右下の●ピップから、バナー下のチップ帯（24px）に並べる文言チップ（`missionLabel()`：称号獲得／開発縛り／生存10機／`{tag}縛り`／SR縛り）に変更。達成=塗り（金、称号は紫`CARD_VIOLET`=`#a58cf0`）、未達成=枠線のみ。主指標は「ステージクリア」ラベル→`n / 29`→右端に`%`とし、サブ指標から「クリア率」を削除して3つに（称号獲得の数値は紫）。最後のマスに凡例（枠3種・チップ4種）。出力サイズは1640×2660→**1640×3140px**
- **全ミッション達成の強調（案D）**：太い虹枠（`rainbowRepeat()`で4周期繰り返し）＋白グロー＋内側白線＋右上の虹色★バッジ（`drawPerfectFrame()`・`drawStarBadge()`）＋チップ全て虹色。**自己紹介カード（㉒）より強い表現で、カードとは一致しない**（カード側への移植は未決定）
- **Xシェア文**：`【Gジェネエターナル】エタロEXPERT ステージクリア n/29・全ミッション達成 n/29・称号 n/11`（「攻略」と「ミッション n/69」を外した）
- 参考実装からの調整：使われなくなった`rainbowGradient()`を削除（設計3.4で削除可）。参考実装で消えていた既存の説明コメント（`ctx.filter`をSafari対策で使わない理由、画像読み込み失敗時のフォールバック）は残した
- **検証**：Playwright（`migrations/0008`・`0009`から生成したマスターとAPIモック、390/1024px）で設計5章の観点を全50件確認（全29ステージのチップが帯に収まる／No.24の文言／文言5種のみ／出力1640×3140／「クリア率」が無く%が右端／サブ指標3種／●ピップ無し／見出し・フッター維持／凡例7語／★バッジ数＝全達成数＋凡例1・はみ出し無し／シェア文完全一致／consoleエラーなし）。生成画像をフルサイズと幅400pxの縮小で目視し、縮小しても全達成と金枠が区別できることを確認。**iOS Safari実機での画像保存（高さ3140px）は未確認**
- `docs/WEBサイト仕様書.md`の2.6節（画像生成・Xシェア文）・5.-6節（新規テスト）・6章・7章を更新済み
- ユーザーの事前指示により、実装・検証後にそのままcommit（`19b7155`）・`git push origin main`済み（2026-09-24）

### エタロ攻略チェッカーの本番化（トップページに導線追加・2026-09-24・ユーザーからの直接依頼）
テスト運用を終えたユーザーから「エタロ攻略チェッカーを本番化（トップページにリンク追加）」との指示があり、⑩⑭で差し戻していたROUTE 03を解放した。`worker.js`・DB・`eternal-road.html`の機能は変更なし。

- **`top.html`**：「チェッカー」欄（`.route`）のURサポートの次に、`/eternal-road.html`への導線カード（🚩アイコン・`analyticsIcon`クラス、`36fa384`時点のカードを流用）を追加し、説明文末尾に「（ログイン会員限定）」を追記。⑮でログイン必須になったが、**未ログインでも導線は表示する**（開いた先のログインガードからログインすると`data-auth-stay`で同じページに戻るため、登録への導線になる）。「ログイン会員限定」欄（ログイン中のみ表示）に置く案は、ゲストに存在が伝わらないため採らなかった。今後追加予定欄からROUTE 03のComing Soonカードを削除し、ROUTE 04のみに
- **PC幅（760px以上）のレイアウト**：チェッカーが3枚になり、3枚目が左半分に1枚だけ残るため、`.route`／`.soonGroup`で最後のカードが奇数枚目（見出しが1番目の子なので`:last-child:nth-child(even)`）の場合は`grid-column:1 / -1`で全幅にした。1枚だけになったROUTE 04も同じルールで全幅になる
- データ登録状況バッジ（`.regBadge`）は当初付けていなかったが、同日のユーザー依頼で追加した（下記節）
- `auth.js`・`eternal-road.html`の`data-auth-stay`に関するコメントを「トップからの導線が未公開のため」から実態に合わせて修正（挙動は不変）
- **検証**：Playwright（API応答をモック、未ログイン／ログイン中×320/390/1024px）で、エタロのカードが1枚表示されリンク先が`/eternal-road.html`であること、ROUTE 03表示が無くROUTE 04が1枚であること、横スクロールなし、JSエラーなし、1024pxでユニット／サポートが横並び・エタロとROUTE 04が全幅であることを確認し、スクリーンショットを目視確認
- `docs/WEBサイト仕様書.md`の2.2節（トップページ）・2.3節（auth.js）・⑮の状況表を更新済み
- 「本番化」の指示に基づき、実装・検証後にそのままcommit（`553a41c`）・`git push origin main`済み（2026-09-24）

### トップページのエタロカードにデータ登録状況を表示（2026-09-24・ユーザーからの直接依頼）
URユニット／URサポートのカードと同じ`.regBadge`（`data-reg="eternal-road"`）をエタロのカードにも追加した。`worker.js`・DBの変更なし（既存API2本を使うのみ）。

- `showRegStatus()`から`showEternalRoadRegStatus()`を呼ぶ（ログイン確認後のみ）。`/api/eternal-road/missions`（マスター）と`/api/my-eternal-road`を並行取得し、`registered:true`なら「✓ データ登録済み　ステージクリア n / 29（ミッション m / 69）」、未登録なら「データ未登録　攻略データを登録ください。」（⑯の文言方針に合わせ「ボタンを押す」ではなく「データを登録する」表現）
- 分母は`eternal-road.html`（⑮で定数廃止）と同じくマスターから算出し、クリア済みIDはマスターに存在するものだけ数える（ユニット側の範囲外ID除外と同じ考え方）。どちらかの取得に失敗したら非表示
- 320px幅で「3 / 29」が途中で改行されたため、`.navcard .regBadge .rate`に`white-space:nowrap`を追加（ユニット／サポートの「n%」は元々1語のため見た目の変化なし）
- **検証**：Playwright（`migrations/0009`から生成した69件のマスターとAPIモック）で、未ログイン非表示／登録済み（範囲外ID 999・ステージ77を数えない＝3 / 29・4 / 69）／登録済み0件／未登録／マスター取得失敗で非表示、の5パターン×320/390/1024pxの全15件成功（横スクロールなし・JSエラーなし・ユニット側バッジの回帰なし）。スクリーンショットを目視確認
- `docs/WEBサイト仕様書.md`の2.2節（データ登録状況）を更新済み
- 前回の本番化と同じ流れで、実装・検証後にそのままcommit（`3b49f4c`）・`git push origin main`済み（2026-09-24）

### 全軍戦況レポート：分析ページの改名とエタロ攻略タブの追加（2026-09-24・ユーザーからの直接依頼）
ユーザーから「エタロチェッカーの攻略状況結果を所持率ランキングに追加。所持率とは異なるため『みんなのデータ集計結果』をかっこよく表現したタイトルに改名」との依頼。Coworkの設計資料なしにコード側で直接対応した。DBスキーマの変更・マイグレーションはない（0008〜0010の既存テーブルを読むだけ）。

1. **改名**：「みんなの所持率ランキング」→「**全軍戦況レポート**」（eyebrow `ALL FORCES REPORT`）。所持＝戦力、攻略＝戦況をまとめて表す名前としてコード側で決めた。変更箇所は`analytics.html`（`<title>`・見出し・説明文・ガード文言）、`top.html`（導線カード名「全軍戦況レポート」・説明「みんなの所持率ランキングとエタロ攻略のクリア状況を集計」）、`unit.html`／`supporter.html`（未登録案内の「全軍戦況レポートの所持率ランキングにも反映されます」）。ページ内のユニット／サポートのタブは引き続き「所持率ランキング」の中身
2. **`worker.js`**：`GET /api/analytics/eternal-road`（`handleAnalyticsEternalRoad()`）を新設。ログイン必須（401）。母数はエタロ登録済みユーザー、**分子もJOINで同条件に限定**（⑬のデプロイギャップと同じ状況でも100%を超えない）し`COUNT(DISTINCT user_uid)`。返す値はステージ別`clearedCount`・`perfectCount`（ステージ内全ミッション達成）、ミッション別`achievedCount`、`allClearCount`（全ステージクリア）・`allPerfectCount`（全ミッション達成）、自分の`mine`・`registered`。分母のステージ数・ミッション数はマスターから算出
3. **`analytics.html`**：3つ目のタブ「エタロ攻略」。所持率とは性質が違うためティアリストではなく、ステージ順の一覧（バナー・クリア率バー・全達成率バー・ミッション別達成率チップ）＋サマリー3枚＋並び順チップ（ステージ順／クリア率が低い順／全達成率が低い順）＋「自分の攻略状況を表示」＋行タップの詳細シート。バー色はdatavizスキルの`validate_palette.js`（暗色・surface `#121924`）で検証し、サイトの`--gold`／`--cyan`は明度が基準帯を外れたため一段落とした`#b09020`（クリア）／`#2f9aa0`（全達成）を採用（全チェック合格）。バーは8px・端4px丸め、ラベルは常にテキスト併記。エタロAPIだけ失敗してもユニット／サポートは表示を続ける。タブ表示を`updateAreas()`に集約し、ユニット集計0人の「集計対象のユーザーがまだいません」がエタロタブに出ないようにした。`missionLabel()`相当の`erMissionLabel()`を追加（「作業上の注意」参照、3か所目）
4. **テスト中に見つけて直した不具合**：詳細シートのバナー画像（プレースホルダーより前面に出すため`z-index:1`）が×ボタンを覆ってクリックできなかった→バナーを下にずらし×ボタンを`z-index:2`に。自分が未登録の案内が0人時に非表示の親要素内にあった→外へ移動。320px幅でタブが右端に寄りサマリーのラベルが語中改行→狭幅時のタブ余白縮小・`keep-all`
- **検証**：API＝sql.js＋Playwrightのブラウザ内ハーネス（`migrations/0008`〜`0010`実ファイル）で全19件成功。UI＝APIモック（`migrations/0009`から生成した69件）で`analytics.html`を320/390/1024px、通常／エタロAPI失敗／0人・未登録／未登録／ユニット0人／ゲストの各パターン、`top.html`の導線表示を確認し53件中51件成功。残り2件はテスト側の判定の誤り（サマリーの「2 / 29」の文字列結合位置、エタロAPI失敗パターンで意図的に返した500のconsoleログ）で、実装の問題ではないことを確認済み。スクリーンショットを目視確認
- `docs/WEBサイト仕様書.md`の1.2節・2.2節・2.5節・3章・3.1節・5.-7節（新規）を更新済み
- 同セッションの流れどおり、実装・検証後にそのままcommit（`90eae53`）・`git push origin main`済み（2026-09-24）

### 分析ページ名を「ログインユーザーレポート」に再改名・ログイン会員限定の明記（2026-09-24・ユーザーからの直接依頼）
本番で表示を確認したユーザーから「全軍戦況レポートは『ログインユーザーレポート』に変更。レポートもログイン会員限定なので、エタロチェッカー同様にログイン会員限定の説明文言を追加」との指示。機能・APIの変更はない。

- 名称の置換：`analytics.html`（`<title>`・見出し・ガード文言、eyebrowは`LOGIN USER REPORT`）、`top.html`（導線カード名）、`unit.html`／`supporter.html`（未登録案内の「ログインユーザーレポートの所持率ランキングにも反映されます」）、`worker.js`（コメントのみ）
- `top.html`の導線カードの説明末尾に「（ログイン会員限定）」を追加（エタロのカードと同じ書き方）。`analytics.html`の説明文は元々「（ログインユーザー限定機能）」とあり、`eternal-road.html`の説明文と同じ表記のため変更なし
- 320px幅でカード名が「ログインユーザ／ーレポート」と長音で折り返したため、「ログイン<wbr>ユーザー<wbr>レポート」に。あわせてエタロタブのサマリーの見出し（「全ステージ制覇」が「制／覇」で折り返し）にも`<wbr>`を入れた
- **検証**：前回のUIテスト（新名称に更新＋トップの説明文・320/1024pxの横スクロール確認を追加）で55件中53件成功（失敗2件は前回と同じテスト側の判定の誤り）。320px幅のスクリーンショットで改行位置を目視確認
- `docs/WEBサイト仕様書.md`の名称・2.5節の改名経緯・5.-7節を更新済み
- 実装・検証後にそのままcommit（`4f5a4c1`）・`git push origin main`済み（2026-09-24）

### 分析ページ名を「データ登録結果レポート」に再々改名（2026-09-24・ユーザーからの直接依頼）
ユーザーから「『ログインユーザーレポート』ではなく、データ登録結果レポート」との指示。前節の「ログインユーザーレポート」を全て置換した（機能・APIの変更なし）。

- `analytics.html`（`<title>`・見出し・ガード文言、eyebrowは`REGISTERED DATA REPORT`）、`top.html`（導線カード名「データ登録<wbr>結果<wbr>レポート」。説明末尾の「（ログイン会員限定）」は維持）、`unit.html`／`supporter.html`（未登録案内「データ登録結果レポートの所持率ランキングにも反映されます」）、`worker.js`（コメントのみ）
- **検証**：UIテスト55件中53件成功（失敗2件は従来と同じテスト側の判定の誤り）。320px幅でカード名が「データ登録結果／レポート」と自然に改行され、見出しが1行に収まることを目視確認
- `docs/WEBサイト仕様書.md`の名称・2.5節の改名経緯を更新済み
- 実装・検証後にそのままcommit（`ebe08f5`）・`git push origin main`済み（2026-09-24）

### トップページのエタロアイコンをステージバナーの切り抜きランダム表示に変更（2026-09-24・ユーザーからの直接依頼）
「エタロ攻略チェッカーのアイコンを、各ステージの横長アイコンの中央を切り抜いた画像のランダム表示に。ステージ名がかからないように」との指示。

- **切り抜き範囲**：全29枚のバナー（640×234）を確認し、ステージ名はどれも下部（y≈180〜225）、「EXPERT」ラベルは左下（x≈10〜95・y≈143〜165）にあった。そこで横中央・上端の170×170（x 235〜405、y 0〜170）を切り抜き、68px表示の2倍の136×136px・JPEG品質0.88で`images/eternal-road/icon/1〜29.jpg`に出力（計約280KB）。元バナーに切り抜き枠を重ねた一覧画像で、29枚すべて文字にかからないことを目視確認した
- **生成スクリプト**：`scripts/make_eternal_road_icons.py`（PIL が無い環境のため、Playwright＋Chromiumのcanvasで切り抜く）。冪等で、再実行しても同一ファイルになることを確認済み
- **`top.html`**：エタロのカードを🚩（`analyticsIcon`）から、ユニット／サポートと同じ`data-pool`方式（オーロラ枠・フェード付きで5秒周期のランダム切替、非表示タブでは停止、視差効果を減らす設定では最初の1枚で固定）に変更。`ETERNAL_ROAD_IMAGES`（29件）を追加し`poolFor()`を3種対応に
- **検証**：Playwrightで18件成功（320/390/1024pxで初期画像が`icon/1〜29`のいずれか・読込成功（136px）・🚩が無い・横スクロールなし・JSエラーと画像404なし、5秒後に別画像へ切替、ユニット／サポートのプール不変、reduced-motionで固定）。スクリーンショットを目視確認
- `docs/WEBサイト仕様書.md`の2.2節を更新済み
- 実装・検証後にそのままcommit（`ee617e4`）・`git push origin main`済み（2026-09-24）

### ㉒ 自己紹介カード作成ページ（profile-card.html）新設（コード実装・検証・git commit・push完了・2026-09-24。D1マイグレーション0011・0012はユーザーが適用後にpush）
Cowork側の実装依頼書`docs/04_自己紹介カード/㉒自己紹介カード_実装依頼書.md`に基づき実装した（⑰〜㉑と食い違う箇所は㉒を優先。描画は㉑プロトタイプから移植）。

1. **マイグレーション**：`docs/04_自己紹介カード/データ/㉒0011_profile_card.sql`・`㉒0012_populate_works_master.sql`を`migrations/0011_profile_card.sql`・`0012_populate_works_master.sql`としてそのまま配置（バイト単位で同一を確認。`--`コメントなし）
2. **`worker.js`**：API 3本と定数を追加
   - `GET /api/works`（`handleWorks()`・認証不要）：`works_master`＋作品ごとのURユニット（`unit_work_map`×`units_master`、`unit_id`昇順）を`sort_order`順で返す。`Cache-Control: public, max-age=3600`。0011未適用なら`{works:[]}`を200
   - `GET /api/profile-card`（`handleProfileCard()`・ログイン必須401）：`profile`（未作成・0011未適用なら既定値）、`units`・`supporters`（`computeOwnershipStats()`＝`unit.html`の`computeStats()`と同じ定義。マスターに無いIDは数えない。`units.ownership`のみ返す）、`eternalRoad`（クリア済みIDの配列＋`earnedTitles`。0008〜0010未適用なら`null`）、`titles:null`。未達成の称号は`titleMissionId:null`、現在所持していない推しユニット・`works_master`に無い作品は除いて返す（slotは詰め直さない）
   - `POST /api/profile`（`handleSaveProfile()`・ログイン必須）：4KB超・壊れたJSONは`400 invalid_body`。表示名16文字・ひとこと40文字（`[...str].length`でサロゲートペアを1文字、ひとことの改行は空白に置換、制御文字は400）、推し作品は`WORK_IDS`、推しユニットは本人が現在所持しているIDのみ（6件以上・配列でない→400、未知・未所持は読み飛ばし、重複は後ろを捨てる）、称号は`is_title`かつ本人達成のみ（それ以外はNULL）、テンプレート・テーマは不正なら既定値。`DB.batch()`で`user_profiles`をUPSERT（`updated_at`はJST）→推し作品・推しユニットをDELETE→INSERT→`users.last_seen`更新
   - 定数`WORK_IDS`（1〜106の集合。**0012と必ず同期**）・`CARD_TEMPLATES`・`CARD_THEMES`
3. **`profile-card.html`（新規）**：ログインガード（`/api/me`が未ログイン・失敗なら他のAPIを呼ばない）、プレビュー（300msデバウンス。オフスクリーンに描いて最新の要求だけを反映）、テンプレート3種（エタロ未登録・ユニット0機のときは無効化＋案内、保存値が選べなければ標準で描く）、背景4種のサムネイル（プレビュー描画後に1枚ずつ生成）、実績の登録状況（`eternalRoad:null`ならエタロの行を出さない）、表示名・ひとこと（残り文字数）・表示称号、推し作品（3タブ・`universe`小見出し・作品アイコン・追加／解除／▲▼・5件で他を無効化）、推しユニット（所持分のみ・タイプと作品で絞り込み・5機まで）、3ボタン（プロフィール保存＋「●未保存」／画像で保存＝保存→2400×1350のdata URIプレビュー／Xでシェア＝`window.open`を先に同期で開き保存は`keepalive`）。下書きは`profilecard_draft_v1`に**ユーザー名つき**で保存し（他ユーザーの下書きは使わない）、サーバーの`updatedAt`の方が新しければサーバーを優先。ユーザー入力・DB由来の文字列は`textContent`とCanvasの`fillText`だけで描き、`innerHTML`は使わない。スマホ1カラム、760px以上は左にstickyのプレビュー
4. **カード描画**：㉑プロトタイプの21〜939行目（共通ヘルパー・`THEMES`と背景4種・部品・テンプレート3種・`workLogo`・`missionLabel`/`missionChips`・`totsuStars`・`drawProfileCard`）を**スクリプトで抜き出してそのまま埋め込んだ**（手での書き写しなし）。名前の衝突を避けるため即時関数`CardRenderer`で包んだ。変更は2点のみ：`BASE`を`""`に、`identity()`の表示名の縮小下限を22px→18px（全角16文字が左カラム290pxの「エタロ攻略」「推しユニット」で省略されずに収まるように。8章9の観点で検出）
5. **Xシェア文**（㉒6.4）：テンプレート別の2行目、推し作品0件なら行を省く、全角2・半角1・URL23で数えて280を超えたら推し作品行を「推し作品5選は画像で！」に、なお超えたら表示名を10文字に。`&via=polarbear148691`
6. **`top.html`**：「ログイン会員限定」欄に導線カード`#profileCardNav`（🪪）を**`hidden`で**追加。`.navcard`の`display`指定が`hidden`属性を打ち消さないよう`.navcard[hidden]{display:none}`を追加。公開時は`hidden`属性を外すだけ（節ごとログイン中のみ表示）
7. **`images/series/1.png`〜`106.png`**（Cowork配置済み）をコミットに含めた

**検証（依頼書8章）**：
- マイグレーション＋API：sql.js＋Playwrightのブラウザ内ハーネス（`migrations/0002`・`0008`〜`0012`の実ファイル）で**60件成功**。0011→0012の重複実行で106件・84件・参照切れ0件、`/api/works`の並び・対応表・0011未適用時の`{works:[]}`、`/api/profile-card`の既定値・401・`registered`・所持0件・`computeStats()`と独立に計算した値との一致・範囲外ID除外・未達成称号のnull・未所持推しユニットの除外・エタロ未適用で`eternalRoad:null`、`/api/profile`の保存と再取得の一致・slot順・重複除去・6件で400・16/17文字・絵文字（サロゲートペア）16/17個・41文字・改行・制御文字・未知ID／未所持の読み飛ばし・不正テンプレート／テーマの既定値・401・4KB超・UPSERT・エタロ未適用環境での保存
- 画面：APIモック（マイグレーション実ファイルから生成）で**62件成功**。ガード（プロフィール系APIを呼ばない）、テンプレートの有効・無効、背景切替とサムネイル、推し作品（3タブ51/37/18件・小見出し・アイコン読込・追加・▲▼・解除・5件で無効化）、推しユニット（所持分のみ・絞り込み・5機）、12通り×（通常・長い入力）の描画でconsoleエラーなし、3ボタン（トースト・送信内容・2400×1350のdata URI・テンプレート別のシェア文・280超えの置換）、下書きの復元／サーバー優先／他ユーザーの下書きを無視、320/390/1024pxで横スクロールなし、PCでsticky、回帰（トップの導線は`hidden`のまま・既存4ページでJSエラーなし）
- 12通りを`㉑カードモック_一覧.jpg`と見比べ、レイアウト・配色・部品が一致することを目視確認。全角16文字の表示名・40文字のひとこと（2行）・長いユニット名（2行・禁則）を実寸（2400×1350）で確認
- 既存のテスト（データ登録結果レポートのAPI 19件・画面、トップのアイコン18件）も再実行し回帰なし
- **未確認（8章14）**：iOS Safari実機での背景生成時間（テーマ切替の初回）と2400×1350の画像保存
- `docs/WEBサイト仕様書.md`の1.2節・2.2節・2.7節（新規）・3章・4章・5.-8節（新規）・6章を更新済み
- commit（`111924a`、`images/series/`の106枚を含む）。ユーザーがD1に0011→0012を適用した直後に`git push origin main`（2026-09-24）。本番で`/api/works`が106作品・84機、`/profile-card.html`が200、未ログインの`/api/profile-card`が401、トップの導線が`hidden`のままであることを確認

**未実施（要対応）**：
- ~~D1への0011→0012の適用とpush~~ → 完了（2026-09-24）。以下は当時の記録：**Cloudflareダッシュボード（D1 > Console）で`migrations/0011`→`0012`の順に実行し、その直後に`git push origin main`（自動デプロイ）**（⑬の教訓。どちらも冪等なので、間が空いたら両方とも再実行すればよい）。pushすると自動デプロイされるため、commitまで済ませてpushは適用の連絡を待っている。なお新コードはテーブル未作成でも既存ページに影響しない（`/api/works`は`{works:[]}`、`/api/profile-card`は既定値を返し、影響は非公開の`profile-card.html`の保存のみ）
- `/profile-card.html`に直接アクセスしてテスト運用。問題なければユーザー指示で`top.html`の`#profileCardNav`の`hidden`を外す
- iOS Safari実機確認（上記）

## 新ユニット・作品の追加手順
URユニット・URサポート・作品を追加するときに、そろえて更新する箇所の一覧（各節に散らばっていた内容を2026-09-24に集約）。

**URユニット（URサポートも同様）を追加するとき**
1. `unit.html`（`supporter.html`）の`UNITS`（`SUPPORTERS`）配列に追加し、画像を`images/units/{id}.jpg`（`images/supporters/{id}.jpg`）に置く（既存IDは振り直さない）
2. `top.html`の`UNIT_IMAGES`（`SUPPORTER_IMAGES`）の件数を更新
3. `worker.js`の`MAX_UNIT_ID`（`MAX_SUPPORTER_ID`）を更新
4. D1の`units_master`（`supporters_master`）に1行追加（`migrations/0002`と同じ形式のINSERTをCloudflareダッシュボードで実行）
5. **URユニットのみ：`unit_work_map`に1行追加する（`INSERT OR REPLACE INTO unit_work_map (unit_id, work_id) VALUES (…, …);`）**。`work_id`はゲーム内の主シリーズ表記に合わせる。これが無いと自己紹介カードの推しユニット一覧・作品名に出ない

6. **URユニットのみ：スクショ読み取り（`unit-scan.js`）の位置合わせ値`SCAN_FIT`を追加する**（㉖）。新URを追加しても、`SCAN_FIT`にそのユニットの値が無いと自動判定されない（「判定できなかったカード」に入る）
   - 追加方法：運営者がそのユニットの写ったスクショで`/unit-scan.html?scandebug=1`を開いて読み取り、「判定できなかったカード」でそのユニットを手動で割り当てる → 画面下に表示される「学習した位置合わせ値」のJSONの該当IDの値を`unit-scan.js`の`SCAN_FIT`に追記してpush
   - 2026-09-25時点で`SCAN_FIT`があるのは84機中69機（運営者の所持一覧スクショに写っていた分）

**作品（推し作品の選択肢）を追加するとき**
- **`works_master`（D1への`INSERT OR REPLACE`）・`worker.js`の`WORK_IDS`・`images/series/{work_id}.png`の3点を必ずそろえる**。`work_id`はゲーム内「シリーズ絞り込み」の並び順＝アイコン画像の番号。`WORK_IDS`に無いIDは`POST /api/profile`で読み飛ばされ、画像が無いとアイコンが空のプレートになる

### 自己紹介カードのジャングル背景削除・トップの英字表記修正（2026-09-24・ユーザーからの直接依頼）
「ジャングルの背景は不要。選択肢から削除し、画像はdocsに保管」「トップページの英字はGJENEではなくGGENE」との指示。

- **ジャングル背景の削除**：`profile-card.html`の背景ボタンから削除し3列に。`sanitizeDraft()`と`worker.js`の`CARD_THEMES`からも外したため、`POST /api/profile`の`"jungle"`は`"galaxy"`で保存され、保存済みの`"jungle"`も`GET /api/profile-card`で`"galaxy"`として返る（D1の変更は不要）。**描画コード（`THEMES.jungle`・`bgJungle`・`leafFrond`等）は㉑プロトタイプとの対応を保つため残置**（復活させる場合はボタン・`sanitizeDraft()`・`CARD_THEMES`の3か所に戻す）
- **保管用画像**：削除前の描画を`docs/04_自己紹介カード/画像/自己紹介カード_ジャングル背景（廃止・保管用）_標準.jpg`・`_エタロ攻略.jpg`・`_推しユニット.jpg`・`_背景のみ.jpg`（2400×1350、JPEG品質0.9）として保存。テスト用モックデータで描いたため、フッターのホスト名は`t.local`
- **英字表記**：`top.html`の見出し上の英字「GJENERATION ETERNAL」を「GGENERATION ETERNAL」に修正。同じ誤記があった`eternal-road.html`も合わせて修正（旧プロトタイプ`design-proposal/top-galaxy-prototype.html`は配信対象外のため据え置き）
- **検証**：APIハーネス62件（`jungle`の保存・読み出しが`galaxy`になる2件を追加）、画面66件（サムネイル3枚・ジャングルの選択肢が無い・保存済み／下書きの`jungle`は宇宙世紀・トップの表記を追加）、トップのアイコン18件、すべて成功
- `docs/WEBサイト仕様書.md`の2.7節を更新済み
- commit（`b783423`）・`git push origin main`済み（2026-09-24）

### Xシェアの引用ポストを4ページ共通の新しいポストに変更（2026-09-24・ユーザーからの直接依頼）
「Xでシェアする際のポストリンクを`https://x.com/polarbear148691/status/2103111095745675510?s=46`に書き換え」との指示。対象はユーザー判断で**4ページすべて**。

- `unit.html`・`supporter.html`の`CONFIG.quotePostUrl`を旧ポスト（`…/status/2099326904625135970`）から新ポストに差し替え。`eternal-road.html`（`null`だった）と`profile-card.html`（設定欄なし＝㉒6.4では「未設定」）にも同じURLを設定し、`profile-card.html`は他ページと同じく`&url=`で付ける処理を追加
- `profile-card.html`の280文字判定は、Xが引用URLを本文に付けて数える分（URL23＋区切り1）を上限から引くようにした
- **画像の自動添付はしない（ユーザー判断）**：Xの投稿画面のURL（intent）は仕様上画像を添付できず、できるのはスマホの共有機能（Web Share API）経由のみのため提案したが、「これまでどおりで自動添付は無し」と決定。画像は「画像で保存」してから手動で添付する運用のまま
- **検証**：4ページで「Xでシェア」の投稿画面URLの`url`が新しいポスト・`via=polarbear148691`であることを確認（自己紹介カードは画面テスト67件に含め、引用URL込みで280文字以内も確認）。JSエラーなし
- `docs/WEBサイト仕様書.md`の2.7節（Xシェア文）を更新済み
- commit（`460fc1d`）・`git push origin main`済み（2026-09-24）

### ㉖ 入手記録・スクショ読み取り・定時分析（2026-09-25。段階A〜Cすべてcommit・push済み。D1の0013・0014はユーザーが適用後にpush）
Cowork側の実装依頼書`docs/05_機能拡張_有料プラン/㉖入手記録・スクショ読み取り・定時分析_実装依頼書.md`に基づき実装した（㉕と食い違う箇所は㉖を優先）。運営者ユーザーはユーザー指定で`ESP`。

**全段階共通**
- 「確定済みの設計方針」のコスト方針を「Workers Paid（月5ドル）の枠内で運用。上限を超えると停止ではなく従量課金」に更新（2026-09-25にユーザーが有料プランへ移行済み）
- docsのフォルダ再編（2026-09-25）に合わせ、このファイルと`docs/WEBサイト仕様書.md`の`docs/◯◯.md`形式の参照（計50か所）を新しい場所（例：`docs/03_エタロ攻略チェッカー/⑩…md`）にスクリプトで置換。ファイル名が一意に決まるものだけ置換し、`docs/⑦...`等の省略表記は手で直した

**段階A：スクショ読み取り試験版の公開（commit `215cec9`・push済み）**
- Cowork配置の`unit-scan.html`・`unit-scan.js`を確認（`unit.html`との差分は読み取りUI・CSS・`noindex`・タイトルのみ。`worker.js`・D1の変更なし）してcommit・push
- **検証**：Playwrightで検証用スクショ`docs/05_機能拡張_有料プラン/画像/所持一覧１〜６.png`を読み込み、カード89枚→URユニット69機（確実56・要確認13）・判定できなかった11枚＝㉕の試験結果と一致。「チェッカーに反映」で69機が`state`に入り、「データ登録」で`/api/log`に送られることを確認。`?scandebug=1`の学習値表示も確認。本番で`/unit-scan`・`/unit-scan.js`が200・`noindex`を確認
- 「新ユニット・作品の追加手順」に6（`SCAN_FIT`の追加方法）を追記
- **未確認**：実機（スマホ）でのスクショ読み取り。テスト運用で問題なければ別途指示で`unit.html`へ統合（今回の範囲外）

**段階B：入手記録（commit `8e27cdc`。push済み）**
1. **`worker.js`**
   - `replaceOwnership()`（全削除→入れ直し）を`syncOwnership(env, table, idColumn, userUid, entries, acqMap)`（差分更新）に置き換え、ユニット・サポートの両方で使用。既存IDを`SELECT DISTINCT`で読み、今回も所持→UPDATE（`level`・`registered_at`。`acqMap`にあるIDは入手記録3列も）、新規→INSERT、未所持→DELETE を1回の`DB.batch()`で実行。同じIDが1回のリクエストに複数あるときは後の値を採用（旧方式は重複行を作り、読み出しでは後の行が勝っていたため、それに合わせた。実際のクライアントは重複を送らない）
   - `parseAcqMap()`・`normalizeAcqDate()`：依頼書B-3どおり（キー数84超は全体無視、値`null`は3列NULL、項目単位で不正ならNULL、範囲外IDは読み飛ばし）。メモは既存の`normalizeProfileText(m, 50, false)`
   - `jstDateString()`を追加（入手日の上限判定と段階Cの`snap_date`で共用）
   - `/api/my-ownership`（ユニット版のみ）に`acq`を追加。サポート版は変更なし
   - `SELECT *`が無いことを確認（既存の分析・自己紹介カード・`/api/profile`は列名指定のため影響なし）
2. **`unit.html`**：入手記録UI（アイコンで開閉する`.acq-panel`・📝・未所持時の`confirm`・dirty方式の送信・起動時の復元）。詳細は`docs/WEBサイト仕様書.md`2.1節。仕様書にない細部：アイコンに`role="button" tabindex="0"`を付けEnter/Spaceでも開閉、入力値はHTMLに埋め込まず`value`で入れる、幅360px以下では項目名を入力欄の上に置く（320pxで日のプルダウンが折り返すため）、送信中に編集されたIDは送信成功後もdirtyに残す
3. `supporter.html`・`unit-scan.html`・画像出力・Xシェア文は変更なし
- **検証**：sql.js＋D1互換モックのハーネス（`migrations/0001`〜`0013`の実ファイル）で66件成功（依頼書B-7の1〜5：運用パターン1〜13、不正値、キー85個、変更前の`worker.js`と同じ操作列でサポート・ユニットの保存結果と`/api/analytics/*`・`/api/profile-card`の結果が一致、0013未適用＋新コードでは`acq`付き登録が保存されない＝逆順NGの確認）。画面はAPIモックで53件成功（B-7の6）。320px・390pxのスクリーンショットを目視確認

**段階C：定時分析＋週間レポート（commit `90763cc`。push済み）**
1. **`worker.js`**
   - `handleAnalyticsEternalRoad()`の集計部分を`queryEternalRoadCounts()`に切り出し（既存APIの結果が変わらないことをテストで確認）。ユニット／サポートは`queryOwnershipCounts()`（`handleAnalytics()`と同じ`COUNT(DISTINCT user_uid)`＋完凸者数）
   - `runDailySnapshot(env, snapDate)`：231行＋summary1行を`INSERT OR REPLACE`で1回の`DB.batch()`
   - `scheduled()`：`jstDateString(new Date(controller.scheduledTime))`で`ctx.waitUntil(runDailySnapshot(...))`。失敗は`console.error`
   - `/api/admin/me`・`POST /api/admin/run-snapshot`・`GET /api/admin/report/weekly`・`GET /api/analytics/trend`（依頼書C-4・C-5どおり）。運営者判定は`isAdminUser()`（`env.ADMIN_USERNAMES`、大文字小文字を区別）。run-snapshot・weekly・trendは`withJsonError()`で包み、0014未適用などの例外を500のJSONで返す。weeklyの`date`形式違いは400、データが無ければ404 `no_data`、`gainers`の`deltaPt`は小数第1位に丸めて0以下を除外
2. **`wrangler.jsonc`**：`triggers.crons`・`vars.ADMIN_USERNAMES = "ESP"`
3. **`report.html`（新規）**：依頼書C-6どおり。背景は`profile-card.html`の`mulberry`〜`bgGalaxy`（82行）をスクリプトで抜き出して`GalaxyBg`に埋め込み（銀河の位置は`layout!=="standard"`側＝右上）。投稿文が280を超える場合は赤で「（超過）」と出すだけで自動短縮はしない（依頼書どおり。上位のユニット名が長いと超えうるので、その場合は手で編集）
- **検証**：ハーネスで50件成功（C-9の1〜6＋trend）。`report.html`はAPIモックで21件成功（C-9の7）。生成画像（通常・gainersなし）を目視確認
- 既存のエタロ・分析・自己紹介カードAPIの結果が変更前と同じことをハーネスで確認

**運営者専用ページの表示制御（2026-09-25・ユーザーからの直接依頼。D1適用の報告時に「運営者アカウントESPにのみ、レポートとユニットスキャンページを表示」との指示）**
- `top.html`：「ログイン会員限定」の下に`#adminSection`（「運営者専用」：週間所持率レポート→`/report.html`、スクショ読み取り（試験版）→`/unit-scan.html`）を`hidden`で追加。ログイン中なら`toggleAdminNav()`が`/api/admin/me`を呼び、`admin:true`のときだけ表示
- `unit-scan.html`：`report.html`と同じく`/api/admin/me`で判定するガードを追加。判定が済むまで`html.scanLocked`で本体（`.wrap`内のauthbar以外・`.actionbar`）を隠し、運営者なら解除、それ以外（未ログイン含む）は「運営者専用ページです」だけを表示。`<body data-auth-stay>`を付けてこのページでログインしたらその場で戻るようにした。**クライアント側の表示制御のみ**（HTML・JS自体は誰でも取得できるが、読み取り処理はブラウザ内で完結しサーバーに運営者用のデータは無いため問題なし）
- 検証：Playwrightで12件成功（未ログイン・一般ユーザー・ESPの3通りでトップの導線とunit-scanのガード、ESPで読み取り69機、JSエラーなし）
- commit `80f160f`、段階B・Cとあわせて`git push origin main`（2026-09-25）。本番で未ログイン時に`/api/admin/me`が`{admin:false}`、`run-snapshot`・`weekly`・`trend`が401、`/api/my-ownership`が`{loggedIn:false}`、`/report`・`/unit-scan`・`/top`・`/unit`が200で新コード（`adminSection`・`scanLocked`・`acq-panel`）を配信していることを確認（デプロイ直後の1分ほどは旧版が混在した）
- 運営者を増やすときは`wrangler.jsonc`の`ADMIN_USERNAMES`に追記するだけで、トップの導線・`report.html`・`unit-scan.html`・`/api/admin/*`がすべて連動する

**追加改修：読み取り結果の一括選択ボタン（2026-09-25・ユーザー要望。依頼書㉖末尾「追加改修」）**
- Coworkが`unit-scan.html`を直接編集（未commit）したものを確認してcommit・push。読み取り結果の見出しの下に「全選択（件数）」「全解除」「変化点のみ（件数）＝新規・凸UP・凸DOWNだけ」の3ボタン。既定のチェック（新規・凸UPのみ）は従来どおりで、ボタンで変えた選択は再描画しても保持（`rows[].userChecked`）
- 確認時の修正は1点のみ：クリック処理内の`const mode`が外側の`mode`（写っていないユニットの扱い）と同名で紛らわしいため`kind`に改名（ブロックスコープなので動作は同じ）
- 検証：Playwright・検証用スクショ6枚で12件成功（初回＝既定69・全解除0で反映ボタン無効・全選択69、手動選択が凸変更後も保持、2回目（1機だけ凸を下げた状態）＝既定1・変化点のみ1で該当機のみ、390pxで横スクロールなし、JSエラーなし）
- **`unit.html`へ統合するときは、このボタンも一緒に移すこと**

**追加改修：期間限定UR 所持率レポート・自己紹介カードの運営者専用試用（2026-09-25夜。依頼書㉖末尾「コード側への引き継ぎ」）**
- Coworkが直接編集（未commit）した3ファイルを確認してcommit・push。`worker.js`・`wrangler.jsonc`・D1の変更なし
- `report.html`：ページ名を「X投稿用レポート」に。種類の切り替え（週間 UR所持率／期間限定UR 所持率）、期間限定のときだけ「見出しの横に出す一言」（20文字まで）。期間限定のデータは`/api/analytics/units`で期間限定ユニットを取り、ユニットごとに`/api/analytics/trend`（26件並列）から**選んだ集計日**の所持者数・完凸者数・母数を取る。画像は全26機を所持率順に左右2列（所持率・完凸率・所持率に比例した帯・1〜3位はメダル）、右上に「期間限定UR 26機｜1人あたり平均X.X機所持」（所持者数の合計÷母数）。投稿文は280を超えると3位→2位の順に省く
  - **確認時の修正1点**：一言バッジが長いと右上の2行目（期間限定UR 26機｜…）と重なっていた（20文字の全角で確認）。空いている幅に収まるよう17px→12pxまで縮め、それでも入らなければ「…」で省略するようにした。「データ登録100人突破！」程度なら従来どおり17pxのまま
- `profile-card.html`：`adminGate()`を追加。ログイン済みでも`/api/admin/me`が`admin:true`のときだけ`init()`、それ以外は「自己紹介カードは現在テスト運用中のため、運営者専用ページです。」（カード用APIは呼ばない）。未ログインは従来どおりログイン案内。**一般公開するときは、`top.html`の`#profileCardNav`の`hidden`を外し、`adminGate()`をやめて`init()`を直接呼び、運営者欄の自己紹介カードを削除**
- `top.html`：運営者欄に「自己紹介カード（試用）」を追加し、「週間所持率レポート」を「X投稿用レポート」に改名（運営者欄は3つ）。一般向けの`#profileCardNav`は`hidden`のまま
- 検証：Playwright（APIモック）で17件成功（週間は従来どおり、期間限定で一言欄の表示・26件のtrend取得・投稿文と280以内・1人あたり平均の計算・一言20文字・一言なし・データの無い日、profile-cardの未ログイン／一般／運営者、トップの運営者欄3つ・一般と未ログインは非表示・`#profileCardNav`はhidden、JSエラーなし）。既存の`report.html`テスト21件も成功。期間限定の画像（一言あり・20文字・なし）を目視確認

**未実施（要対応）**
- ~~デプロイ手順（段階B・C）~~ → 2026-09-25にユーザーがD1で0013→0014を実行後、push済み
- push後：運営者（`ESP`）でログインし`/report.html`の「今日の集計を今すぐ実行」→ D1 Consoleで`SELECT COUNT(*) FROM analytics_daily`＝231、`SELECT * FROM analytics_daily_summary`＝1行を確認。翌朝4時以降、定期実行で翌日分が入っていることを確認（ダッシュボード > Workers > ggene-ur-checker の「トリガー」「ログ」でも確認できる）
- 本番で`unit.html`の入手記録（入力→データ登録→別端末・再読み込みで復元）を実機確認
- `SCAN_FIT`が無い15機（運営者の所持一覧スクショに写っていなかったユニット）の追加（手順は「新ユニット・作品の追加手順」6）
- `analytics.html`への推移グラフ（データが7日分以上たまってから別途依頼）、テンプレートB〜E、X APIでの自動投稿は今回の範囲外

## 次にやること
- ㉖：push済み。本番での`report.html`の手動集計（231行の確認）・翌朝4時の定期実行の確認・入手記録の実機確認（「㉖」節の「未実施（要対応）」）。スクショ読み取り試験版（運営者専用）のテスト運用
- ㉒：D1適用・push済み。、`/profile-card.html`のテスト運用、iOS Safari実機確認、指示後にトップ導線の`hidden`を外す
- ⑮：`migrations/0008`〜`0010`は適用済み、トップページへの導線も2026-09-24に公開済みで完了。`CONFIG.quotePostUrl`も2026-09-24に設定済み
- ⑬は解決済み（上記訂正参照）。追加対応は不要
- ㉔：iOS Safari実機でエタロの「画像で保存」（1640×3140px）が保存できるかユーザー確認
- ⑪の未実施項目：`migrations/0005`のD1適用、本番実機確認（PC/スマホ通常ブラウザ/スマホXアプリ内蔵ブラウザ × 画像保存/Xシェア/データ登録）
- ⑫のデプロイ後確認：本番の所持率表示が母数フィルタ適用後に上昇していること（急な低下があれば`registeredColumn`の指定誤りを疑う）。数値変化のX等での告知要否はユーザー判断
- ⑦・⑨から継続：凸レベル別内訳（完凸率等）、期間限定/恒常別の切り替え集計、PCでのポップオーバー化、タイル長押し比較、絞り込み条件の複数選択（例：攻撃と支援を同時に）、絞り込み状態の保存（`localStorage`）、所持率の並べ替え切り替え（No.順・名前順）
- 次にどのテーマ（エタロ攻略/称号獲得チェッカー追加、自己紹介カード自動生成、「クリア率」分析 等）に着手するかは、次回セッション冒頭でユーザーに確認すること

## 作業上の注意
- ユーザーはシステム開発経験があるため、技術的な説明は詳しくして構わない
- ただしGitHub・Cloudflareの操作は不慣れなため、画面操作の手順は具体的に案内すること
- ファイルを作ったら必ず動作確認（Playwrightでのヘッドレステスト）を行ってから渡すこと
- 日本語で応答すること
- ファイル削除時は必ず確認することを原則とする
- **ミッションの短い表示名`missionLabel()`は`eternal-road.html`（㉔）・自己紹介カード（㉒）・`analytics.html`（`erMissionLabel()`。APIがキャメルケースのため引数の形だけ異なる）の3か所（自己紹介カードは`profile-card.html`の`CardRenderer`内）で別々に持っている。ミッション種別を追加・変更するときは3か所とも同時に直すこと**
- **作業を閉じる前に、その回で実装・変更した内容を必ずこのCLAUDE.md（「完了済みの作業」セクション）に追記してからセッションを終えること。今回、新規UR3件追加とログインモーダルのデザイン統一の2件が未記載のままクローズされ、事後追記が必要になった**
- Cowork側（claude.ai）との役割分担・橋渡しルール（`../docs/`の新規資料確認、`../docs/WEBサイト仕様書.md`との内容同期など）は`../README.md`に正本があるので、作業開始前と作業を閉じる前に確認すること
