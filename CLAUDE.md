# Gジェネエターナル ファンツール開発（コード側の引き継ぎ）

Claude Codeがセッション開始時に読む引き継ぎ情報。**2026-09-29に圧縮した**（228KB→約30KB）。今後の開発に必要な「現状・ルール・手順・未完了事項」だけを置く。

- **過去の詳細な実装経緯**（各回の検証内容・判断理由・commit番号）は`../bk/履歴_20260929/CLAUDE_20260929.md`にある。丸数字（⑪・㉒など）や節名で検索して読む。必要なときだけ参照すること
- サイトの現状仕様（API・DB・処理・既知の制約）の正本は`../docs/WEBサイト仕様書.md`。DBのER図は`../docs/01_所持チェッカー・DB登録/㊳DB_ER図.pptx`
- Cowork側の設計資料の索引と実装待ちの一覧は`../docs/COWORK.md`

## プロジェクトの目的
Xアカウント（@polarbear148691）を軸に、スマホゲーム「Gジェネレーション エターナル」のファン向けWebツールを展開する。収益化はX公式機能（Creator Revenue Sharing等）のみ。

## 権利面の方針（重要・変更不可）
- サイト自体は完全に非商用（広告・アフィリエイトなし）。収益化はXの公式機能のみ
- 掲載画像は**運営者自身のゲーム内スクリーンショットのみ**（攻略サイトや公式プロモ素材は使わない）
- バンダイナムコのゲーム配信ガイドラインの「副次的収益」の解釈に基づく整理済みの方針。崩さないこと
- 全ページのフッターに非公式・権利帰属・免責・問い合わせ先（X）を表示している

## 確定済みの設計方針（変更不可）
- **チェッカーはログイン必須**（2026-09-26・㉘で転換）。未ログインはログイン案内（ガード）のみ。トップの導線は未ログインでも表示し、ガードから登録へつなげる。**例外：ユニット一覧`/unit-list`は見るだけならログイン不要**（ESP決定 2026-10-16。段階2から）
- 認証はユーザー名＋パスワードのみ（メール不要・個人情報を持たない）。**パスワードはPBKDF2（10万回）でハッシュ化**（`password_hash`。再設定は本人の変更画面`account.html`と運営者リセット`admin-account.html`のみ。メール・復旧コードは持たない。54）。**A-2が済むまでは`password`列に平文も残している**（A-1の切り戻し用。`worker.js`の`KEEP_PLAINTEXT_PASSWORD`）。セッションはHttpOnly Cookie（`Secure; SameSite=Lax`・30日・`sessions`TBL）
- ゲストの所持データは保存しない（`usage_counters`に匿名の利用回数だけ）。ゲスト時代のデータをアカウントへ引き継ぐ機能は作らない（ユーザー確認済み）
- コスト：Workers Paid（月5ドル）の枠内。上限超過は停止ではなく従量課金
- 所持率などの母数は「その機能でデータ登録済みのユーザー」（`users.*_first_registered_at IS NOT NULL`）。分子も同条件で`COUNT(DISTINCT user_uid)`

## インフラと運用
- GitHub → Cloudflare Workers 自動デプロイ（`main`へpushすると公開）
  - 本番：`https://ggene-ur-checker.polarbear14869.workers.dev/`
  - GitHub：`https://github.com/ESP148691/ggene-UR-checker-`
  - Cloudflare：`https://dash.cloudflare.com/d78525314dd74181c2dc4fea74c8844a/workers/services/view/ggene-ur-checker/production`
- `wrangler.jsonc`：プロジェクト`ggene-ur-checker`、assets=`./`、D1バインディング`DB`（`ggene-ur-checker-db`）、定期実行`0 19 * * *`（JST 4:00）、運営者`vars.ADMIN_USERNAMES`（カンマ区切り・大文字小文字を区別。**現在`ESP`**。増やすときはここに追記してpush＝トップの運営者欄・運営者ページ・`/api/admin/*`が連動）
- **D1へのSQL適用はClaude Codeがwranglerで行える（2026-10-04〜）**：`npx wrangler d1 execute ggene-ur-checker-db --remote --file=migrations/00NN_xxx.sql`（OAuthログイン済み。`--command`でSELECTも可。まれに認可エラー7403が一時的に出るので、その場合は再実行）。適用前に`sqlite_master`で既存TBLと衝突しないことを確認する
- ユーザーはシステム開発経験あり（技術説明は詳しくてよい）。ただしGitHub・Cloudflareの画面操作は不慣れなので手順は具体的に

## リポジトリ構成（2026-09-29時点）

| ファイル | 役割 |
|---|---|
| `top.html` | トップ（`/`で配信）。チェッカー欄（ユニット・サポート・エタロ）、ログイン会員限定欄（データ登録結果レポート・**推し情報設定（72で一般公開・登録状況バッジ`showFavoriteRegStatus()`は`showRegStatus()`から）**・自己紹介カード`#profileCardNav`）、運営者欄`#adminSection`（X投稿用レポート・自己紹介カード（試用）・チャレンジ）。導線カードの登録状況バッジ`.regBadge`、アイコンのランダム表示（`UNIT_IMAGES`・`SUPPORTER_IMAGES`・`ETERNAL_ROAD_IMAGES`・`data-pool`）、説明文の下のインフォバナー（`INFO_FEED`・71。**1件ずつスライド（10秒）＋各件の説明文だけが右から左へ流れる**＝72の4.7。短い説明は流さない・`reduceMotion`では「…」省略）、フッターの相互リンク |
| `unit.html` | URユニット所持率チェッカー（87機）。スクショ読み取り（`unit-scan.js`）・入手記録（入手日・ガシャ回数・メモ）つき。データ本体は`ur-units.js`。並び順（実装順の昇順・降順。端末保存`urchecker_view_v1`）・未所持のみ表示・未所持0件でコンプリート表示（76） |
| `ur-units.js` | URユニットの画面側マスター（`window.UR_UNITS`。`id`・`name`・`limited`・`type`・`imageUrl`・`released`（必須）・`wrap`（任意））。`unit.html`・`profile-card.html`が読む。**無いとユニットチェッカーが空になる**。実装日`released`はD1には無く、ここが正本 |
| `supporter.html` | URサポート所持率チェッカー（50体。データは`const UNITS`）。スクショ読み取り（`supporter-scan.js`）つき。**改行コードCRLF**（CRLFのまま編集）。並び順（端末保存`ggene_ur_supporter_view_v1`）・未所持のみ表示・コンプリート表示（76） |
| `complete-banner.css` / `complete-banner.js` | 4チェッカー共通のコンプリート表示（76。虹色の枠・オーロラ・きらめき・弾ける演出。`CompleteBanner.mount(slot).update({...})`。パネルは`.cp-panel`＝challenge.htmlの既存`.complete`と衝突させない。`unit.html`・`supporter.html`・`eternal-road.html`・`challenge.html`が`</head>`直前で読む＝**無いと各ページが止まる**ので4ページと同じcommitで入れる） |
| `unit-scan.js` / `supporter-scan.js` | スクショ読み取りの判定（`window.UnitScan`／`SupporterScan`、位置合わせ値`SCAN_FIT`） |
| `analytics.html` | データ登録結果レポート（ログイン限定。ユニット・サポートのティアリスト＋エタロ攻略タブ） |
| `analytics-admin.html` | 運営者向け分析（**運営者専用・恒久**＝ESPのみ。`adminGate()`。推し統計・所持率分布。64。API`/api/analytics/oshi`・`/distribution`も`requireAdmin`。一般公開しない） |
| `eternal-road.html` | エタロ攻略チェッカー（EXPERT・29ステージ・69ミッション）。「未達成ミッションのみ」×全ミッション達成でコンプリート表示（76） |
| `challenge.html` | チャレンジミッションチェッカー（HARDのみ・5シリーズ・15ステージ・30ミッション。㊵）。**一般公開済み**（2026-10-06。adminGate解除・トップの「チェッカー」欄へ移動）。「未達成ミッションのみ」×選択中シリーズタブの全ミッション達成でコンプリート表示（76） |
| `profile-card.html` | 自己紹介カード（テンプレート5〔標準・エタロ攻略・推しユニット・推し編成・推しキャラ〕×背景3の16:9 Canvas。描画は`CardRenderer`）。**一般公開中**（10-01夜〜。推し編成・推しキャラは10-10〜）。追加改修は`profile-card-trial.html`（運営者専用）で試してから反映 |
| `favorite-info.html` | 推し情報設定（68。推し4項目だけを登録。`/favorite-info`）。**段階1は運営者専用**（`adminGate()`）。本体は`#favoriteForm`だけで、`FavoriteForm`（`emptyMode:"hint"`）が4欄を出す。保存は`POST /api/favorite-info` |
| `favorite-form.js` / `favorite-form.css` / `favorite-logic.js` | 推し4欄の共通部品（68。`window.FavoriteForm`）／そのCSS／`FormationLogic`（バフ対象判定）＋`WorkLabel`（作品名の通称）。`favorite-info.html`・`profile-card-trial.html`が使う（`profile-card.html`は段階2で切り替え） |
| `unit-list.html` | ユニット一覧（75。`/unit-list`）。タグ別URユニット一覧の表（4種類：4大熟語タグ×機体タグ／他主要タグ／全UR×タイプ／自由に選ぶ）・拡大縮小（開いたときは全体表示）・画像で保存（Canvas。**画像で保存＝JPEG・高画質で保存＝PNG**。77）・表の種類はURL（`?v=A&dim=1`）。Xでシェア・「所持だけ」は試用中に廃止（10-16）。**2026-10-17に全員へ公開（`ADMIN_ONLY = false`・ログイン不要。切り戻しは`true`に戻す）**。所持の表示（未所持を暗くする・凸表示）はログイン中だけ。読むAPIは`/api/units`・`tags`・`leader-skills`・`supporters`・`effects`（＋`my-ownership`）。アイコンは`images/effects/`（16個） |
| `report.html` | X投稿用レポート（運営者専用。6種類×並び順3種。`GET /api/admin/report/ownership`） |
| `auth.css` / `auth.js` | ログイン・新規登録の共通UI。成功後は`/top`へ。`<body data-auth-stay>`のページはその場でリロード |
| `worker.js` | Cloudflare Workers（API・定期実行・静的配信）。API一覧は仕様書3章 |
| `migrations/` | D1マイグレーション（下の表） |
| `images/` | `profile-card/{standard,units,eternal}.jpg`（トップの自己紹介カード用アイコン。㊹）・`units/{id}.jpg`・`supporters/{id}.jpg`・`series/{work_id}.png`（作品ロゴ106）・`eternal-road/{1..29}.jpg`（バナー）・`eternal-road/icon/`（トップ用。`scripts/make_eternal_road_icons.py`で生成＝**バナーを変えたら再実行**）・`challenge/{series_code}.jpg`・`logo.png` |
| `scripts/card_check/` | 自己紹介カードの回帰チェック（下の「検証の方法」） |
| `scripts/extract_embedded_images.py` | base64埋め込み画像の外部化（冪等） |
| `design-proposal/` | トップのデザイン提案とプロトタイプ（配信対象外） |

## データベース（Cloudflare D1）

TBLの一覧・列は仕様書4章とER図を正とする。ここには運用上の要点だけを書く。

- ID体系：`units_master.unit_id`（1〜87）・`supporters_master.supporter_id`（1〜50）はチェッカーのNo.と一致。**既存IDは振り直さない**
- 所持：`units_ownership`は差分更新（`syncOwnership()`。行を消さずUPDATE。入手記録3列あり）。`supporters_ownership`も同関数。未所持は行が無い。`(user_uid, unit_id)`に一意制約は無いが重複は出ていない
- 登録済みフラグ：`users.units_first_registered_at`・`supporters_first_registered_at`・`eternal_road_first_registered_at`・`challenge_first_registered_at`（JST。非NULL＝登録済み。「登録済みで0件」と「未登録」を区別する）
- エタロ・チャレンジ：マスター＋達成スナップショット＋ステージクリア（ミッション達成があるステージは必ずクリア行を持つ＝サーバーで正規化）。`mission_id = stage_id*10 + slot`。受付IDはマスターの集合で検証
- 自己紹介カード：`works_master`（106作品。`work_id`＝ゲーム内の並び順＝`images/series/{id}.png`）、`unit_work_map`、`user_profiles`（`card_options`はJSON）、`user_favorite_works`・`user_favorite_units`（slot 1〜5のスナップショット）
- ユニットの特定（㊶）：公式ユニットは**`(rarity_code, unit_id)`**で特定する（`unit_work_map`の主キー・`units_tags`も同じ）。コード値は`worker.js`の`RARITY_CODE`（0＝ユーザー登録、1＝UR、2＝SSR。SQLのコメント・マスターTBLには書かない）。SSRマスター`ssr_units_master`、タグ`tags_master`（143件・有効129）・`units_tags`（URのみ712件）、ビュー`v_all_units`。SSR名のUNIQUEは`(name, type)`
- 定時分析：`analytics_daily`（`kind`＝`unit`／`supporter`／`er_stage`／`er_mission`／`ch_stage`／`ch_mission`、`item_id`＝kindごとのID）・`analytics_daily_summary`
- FK宣言はあるが、アプリ側でもIDの実在を検証する（73から`worker.js`の`loadMasterIdSet(env, "unit"|"supporter"|"work")`＝マスターTBLのID集合を同じisolateで60秒使い回す。旧`MAX_UNIT_ID`・`MAX_SUPPORTER_ID`・`WORK_IDS`は廃止。取れなければ書き込まない側に倒す）
- 73 マスターの追加列（すべてNULL可）：`units_master.released_on`・`wrap`・`scan_fit`、`supporters_master.skill_detail`・`scan_fit`、`works_master.nick_name`・`group_label`、`tags_master.short_name`。画面は`/api/units`・`/api/supporters`・`/api/works`・`/api/tags`から読む（`master-data.js`）

### マイグレーションの状況

| 番号 | 内容 | D1 |
|---|---|---|
| 0001〜0004 | 認証・マスター投入・ゲストデータ削除・利用回数 | 適用済み |
| 0005 | 所持の`registered_at`をJSTへ一括変換（冪等） | **適用不要**（2026-10-17確認：`registered_at`が`Z`終わりの行は両TBLとも0件。流しても何も変わらない。ESP了承） |
| 0006 | 登録済みフラグ（ユニット・サポート） | 適用済み |
| 0007 | 重複行削除案 | **適用しない**（前提が誤りだった記録。⑬） |
| 0008〜0010 | エタロ | 適用済み |
| 0011〜0012 | 自己紹介カード・作品マスター | 適用済み |
| 0013〜0014 | 入手記録・定時分析 | 適用済み |
| 0015〜0017 | 作品区分・カード表示設定・名前の表記統一 | 適用済み |
| 0018 | ㉝ユーザー登録ユニット用に**予約**（未実装） | ― |
| 0019 | Gレコを宇宙世紀へ（UPDATE 1行） | 適用済み（2026-10-17確認：`works_master` work_id=85 が `era='UC'`） |
| 0020〜0021 | ㊵チャレンジ（TBL5つ・マスター） | 適用済み（2026-09-30ユーザー確認） |
| 0022 | ㊸ 9/30新UR（ユニット85〜87・サポート50） | 適用済み（2026-09-30ユーザー確認） |
| 0023 | ㊼ エタロ ステージ30 | 適用済み（2026-10-03ユーザー確認） |
| 0024 | ㊶ SSRマスター・`unit_work_map`作り直し・`user_favorite_units.rarity_code`（**1回だけ**。再実行は先頭ALTERが`duplicate column`で止まる）。SSR名のUNIQUE索引は`(name, type)`（㊻3章） | 適用済み（2026-10-04） |
| 0025〜0026 | ㊶ タグ・`units_tags`・`v_all_units`（0025）／タグ133件（0026） | 適用済み（2026-10-04） |
| 0027〜0028 | ㊾ タグ10件追加＋作品名タグ14件を無効化（0027）／URのタグ付け712件（0028。先頭で`DELETE FROM units_tags WHERE rarity_code = 1`） | 適用済み（2026-10-04） |
| 0029〜0030 | 51 推し編成：TBL4つ（`supporters_leader_rules`・`supporters_leader_targets`・`user_formations`・`user_formation_units`。0029）／URサポーター50体のリーダースキル（ルール55・条件75。0030。先頭で2TBLを全削除するので再実行可） | 適用済み（2026-10-04 Claude Code。確認SQLは期待値どおり） |
| 0031 | 54 パスワードのハッシュ化：`users`に`password_hash`・`password_changed_at`・`must_change_password`、新TBL`auth_rate_limits`（**1回だけ**。再実行は先頭ALTERが`duplicate column`で止まる） | 適用済み（2026-10-04 Claude Code。736人・未移行736・`auth_rate_limits`0件で期待どおり） |
| 0032 | 日別利用集計`daily_stats`（`stat_key`＝login／checker_use）・ビグ・ラングをMS IGLOO(23)、グレート・ジオング／ザンスパインをG GENERATION(106)へ（`unit_work_map`のUPDATE） | 適用済み（2026-10-06 Claude Code） |
| 0033〜0034 | 56 推しURキャラクター：TBL`characters_master`・`user_favorite_characters`新設＋`user_formation_units.pilot_char_id`（0033。**1回だけ**。再実行は`duplicate column name: pilot_char_id`で止まる）／キャラのマスター投入91件（セット87・イベント配布4。0034。先頭で全削除するので**何度でも流し直せる**。コード変更なし） | 適用済み（0033・78件版0034：2026-10-09。91件版0034に流し直し：2026-10-10 Claude Code。確認SQLは期待値どおり：total 91・event 4・set_chars 87、bad_id 0、orphan 0） |
| 0035 | 自己紹介カードのランク：`user_profiles.player_rank INTEGER`（**1回だけ**。再実行は`duplicate column`で止まる） | 適用済み（2026-10-09 Claude Code。プロフィール235件・ランク入力済み0件） |
| 0036 | 66 推し編成の枠ごとの凸：`user_formation_units.level INTEGER`（NULL＝ユニットチェッカーの凸に従う。**1回だけ**。再実行は`duplicate column name: level`で止まる） | 適用済み（2026-10-11 Claude Code。確認SQL：列あり1・`level IS NOT NULL`の行0） |
| 0037 | ㊻C-2 SSR332機の投入（`ssr_units_master`・`unit_work_map` rarity_code=2。`INSERT OR REPLACE`なので何度でも流せる） | 適用済み（2026-10-12 Claude Code。332／332／名前＋タイプ重複0） |
| 0038 | ㊻ SSR作品の直し32件（`unit_work_map` rarity_code=2の`work_id`のみ。`INSERT OR REPLACE`なので何度でも流せる） | 適用済み（2026-10-12 Claude Code。332のまま・32件とも`ssr_series_fix.csv`の`new_work_id`と一致） |
| 0039 | 73 マスターの列追加8つ（`units_master`：`released_on`・`wrap`・`scan_fit`／`supporters_master`：`skill_detail`・`scan_fit`／`works_master`：`nick_name`・`group_label`／`tags_master`：`short_name`。**1回だけ**。再実行は`duplicate column name: released_on`で止まる） | 適用済み（2026-10-15 Claude Code） |
| 0040 | 73 0039の列に今の値を投入（`COALESCE(列, '値')`で空の列だけ埋める＝何度流してもよい。D1で直した値は上書きしない） | 適用済み（2026-10-15 Claude Code。確認SQL1本目：units 87・units_no_released 0・units_wrap 9・units_fit 69・sups 50・sups_detail 4・sups_fit 31・works_nick 27・works_group 6・tags_short 2／2本目：すべて0） |
| 0041 | 74 `user_favorite_units.char_id`（NULL＝自動・0＝表示しない・ID）と`ssr_units_master.is_ult`の追加（**1回だけ**。再実行は`duplicate column name: char_id`で止まる） | 適用済み（2026-10-16 Claude Code。確認：char_id列1） |
| 0042 | 74 ULT 16機を`is_ult = 1`（何度でも） | 適用済み（2026-10-16 Claude Code。確認：total 332・ult 16） |
| 0043 | 75 `units_master`に`range_min`・`range_max`・`range_note`＋TBL`effects_master`・`units_effects`（**1回だけ**。再実行は`duplicate column name`） | 適用済み（2026-10-16 Claude Code） |
| 0044 | 75 射程87機・効果アイコン13種・`units_effects`123件（86機）・ル・シーニュに「ニュータイプ専用機」（何度でも） | 適用済み（2026-10-16。確認：units 87・with_range 87・with_note 1／effects 13／links 123・units_with_effects 86／孤児0／タグ1件） |
| 0045 | 75 UR機体のタグ修正：Zガンダム(17)に不撓不屈、レッドフレーム改(54)・天ミナ(55)にライバル（何度でも）。wiki・ESPのExcelと照合。リボーンズガンダム・イデオンはD1の87機に無い（新UR追加時に対応） | 適用済み（2026-10-17。不撓不屈17・ライバル28） |
| 0046 | 新UR 2機：88 リボーンズガンダム（限定・支援）・89 ガンダムデュナメス（恒常・攻撃）。units_master・射程・効果・作品(00)・タグ・characters_master（何度でも） | 適用済み（2026-10-17。画像`images/units/88・89.jpg`は運営者が用意。タグはwiki出どころ＝ゲーム内で確認したら`source`を`game`に） |
| 0047 | 新URサポーター51 カティ・マネキン&ウラル（恒常・HP回復。リーダースキル：指揮官機20→28%／指揮官機かつライバル30→44%）。タリア(32)は復刻で変更なし（何度でも） | 適用済み（2026-10-17。画像`images/supporters/51.jpg`済み・`scan_fit`は未） |
| 0048 | 79 マスターリーグのシーズンTBL：`ml_seasons`（season_code TEXT・name・starts_on・ends_on・stage・note・is_active・updated_at）・`ml_season_targets`（season_code・target_kind＝tag/work・target_id・sort_order）。`CREATE … IF NOT EXISTS`で何度でも。D1適用済み（2026-10-20） |
| 0049 | 79 SEASON 1〜17（11.5・15.5含む19シーズン・38対象）の登録。CSV（`docs/01_所持チェッカー・DB登録/データ/79_マスリ_シーズン一覧.csv`）から`79_build_ml_seasons_sql.py`で生成。タグ・作品は名前で引く。何度でも流せる。D1適用済み（2026-10-20。確認SQLは期待値どおり：19/19・各2対象・孤児0・S17の対象UR28） |
| 次の空き | 0041 | ― |

### D1マイグレーションのルール（過去の不具合から）
- **適用はD1が先、pushが後**。逆にすると新コードが未作成のTBL・列を読んで500や保存漏れになる（⑬のデプロイギャップ）。**バックフィルは必ず冪等に書き、間が空いたら再実行する**
- **`--`コメント行は入れない**（D1 Consoleにコピペで実行できないため。依頼書付属のSQLにコメントがあれば、本体はそのままでコメント行だけ削除して置く）
- `ALTER TABLE ADD COLUMN`は再実行すると`duplicate column`（＝適用済みの意味）。1回だけ実行するファイルはそう案内する
- 新コードは、未適用のTBL・列に当たっても既存機能が壊れないように`try/catch`で囲む（その機能だけ無効にする）
- 設計書のマイグレーション番号は仮。**実装時点の次の空き番号に振り直す**
- マスター系API（`/api/units`・`/api/supporters`・`/api/works`・`/api/tags`・`/api/leader-skills`・`/api/characters`・`/api/challenge/master`）は`Cache-Control: max-age=300`（`worker.js`の`MASTER_CACHE`。73）。マスターをSQLで変えてから最大5分は古い内容が見えることがある

## 技術的な注意点（ハマりポイント）
- **`/`や公開URLに301/308を設定しない**。ブラウザ（特にXアプリ内）が永続キャッシュし、後から直しても届かない（⑧）。必要なら307/302
- **トップへのリンク・遷移先は`/top`**（`/`ではない。昔の301キャッシュを避けるため）。`isTopPage`は`/`・`/top`・`/top.html`を許容
- Cloudflareの静的配信は`/xxx.html`を`/xxx`へリダイレクトする。`location.pathname`で判定するときは両方を考える
- `ctx.filter`はSafariで効かないことがある → ピクセル操作で代替。`getImageData`/`putImageData`は`ctx.scale()`の影響を受けない
- 画像プレビューはdata URI（Blob URLは表示されない環境がある）。Canvasはネイティブ（html2canvas不使用＝iOS対応）。**ダウンロードはBlob URL**（Chromeは約2MBを超えるdata URLをダウンロードできない）。長押し保存させたい画像はdata URIを1.9MB以下に（77）
- `hidden`属性は、要素に`display`を指定するCSSがあると打ち消される → `.xxx[hidden]{display:none}`を明示
- ユーザー入力・DB由来の文字列は`textContent`かCanvasの`fillText`で出す（`innerHTML`に入れない）
- 送信は`fetch(..., {keepalive:true})`（Xシェアの`window.open`直後でも送り切るため）
- `restoreOwnershipFromServer()`は`data.registered`のときだけ上書きする（新規登録直後に端末の状態を消さない。㉘）
- **同じものを複数か所に持っている箇所**（変えるときは全部そろえる）
  - ミッションの短い表示名：`eternal-road.html`の`missionLabel()`・`profile-card.html`の`CardRenderer`内・`analytics.html`の`erMissionLabel()`
  - カードのテンプレート：`worker.js`の`CARD_TEMPLATES`と`profile-card*.html`の`TEMPLATE_LABEL`（`formation`＝推し編成、`characters`＝推しキャラ）
  - 搭乗キャラの補充規則：`worker.js`の`normalizePilots()`と`favorite-form.js`の`normalizeDraftPilots()`／`onUnitChanged()`（72で本番`profile-card.html`も共通部品に切り替え済み＝画面側は`favorite-form.js`の1か所。サーバー側`worker.js`と順番・規則を同じに保つ。依頼書57の4.3。**66で候補順を変更**：①編成に入っていないユニットのセットキャラ→②イベント配布キャラ→③編成に入っているユニットのセットキャラ。画面側は`firstUnusedChar()`／`reservedChars()`）
  - カード表示設定の既定値`CARD_OPTIONS_DEFAULT`（`{acq:true, memo:false}`）：`favorite-form.js`と`worker.js`（72で本番・試用とも画面側は`favorite-form.js`の1か所）
  - 作品ID：`works_master`・`images/series/`（73で`worker.js`の`WORK_IDS`は廃止）
  - ユニット・サポート：D1が正本（73）。`ur-units.js`・`supporter.html`の`const UNITS`・`unit-scan.js`/`supporter-scan.js`の`SCAN_FIT`・`favorite-logic.js`の`WORK_NICK`等は**APIが取れないときの予備**で、更新しない（消すのは承諾後。73の確認事項3）

## 共通の実装パターン
- **ログインガード**：`<head>`で`html.loginLocked`を付け、CSSで本体（authbar・ガード以外と`.actionbar`）を隠す。`/api/me`が`loggedIn:true`なら解除。失敗時はガードのまま。`<body data-auth-stay>`でログイン後にその場へ戻す
- **運営者専用ページ**：`/api/admin/me`で判定（`adminGate()`）。運営者以外は案内だけ出し、ページ用APIは呼ばない。クライアント側の表示制御なので、サーバーに運営者用データを置くAPIは`requireAdmin`で守る。**一般公開の手順**：`adminGate()`と`#adminOnlyView`を削除して`/api/me`のログイン判定から直接起動、`top.html`の導線を運営者欄から一般の欄へ移す（`hidden`を外す）
- **チェッカーの3ボタン**：データ登録／画像で保存／Xでシェア（どれもDBへ送る）。起動時に`/api/my-*`からDBの内容を復元。登録状況の表示（`#regStatus`・トップの`.regBadge`）
- **Xシェア**：`&via=polarbear148691`、引用ポスト`CONFIG.quotePostUrl`＝`https://x.com/polarbear148691/status/2103111095745675510?s=46`（4ページ共通）、ハッシュタグ`#ジージェネエターナル`＋ページ別。画像は自動添付しない（手動添付の運用）。280文字の判定は全角2・半角1・URL23

## 検証の方法（Playwright必須）
ファイルを作ったら必ずPlaywright（Python版・Chromium）で動作確認してから渡す。
- **画面**：APIを`page.route`でモックし、320/390/1024px（必要に応じ1100px）で横スクロールなし・JSエラーなしを確認。スクリーンショットを目視
- **`worker.js`**：Nodeが無いので、`worker.js`をヘッドレスChromium内でESモジュールとして読み込み、`env.DB`をPythonのsqlite3（`migrations`の実ファイルを番号順に適用。0007は除く）へ`expose_function`でブリッジするハーネスを使う（㉘段階C・㊵と同じ方式）。ブラウザの`Request`はCookieヘッダーを落とすので、疑似Requestオブジェクトを渡す
- **自己紹介カードの回帰チェック**`scripts/card_check/`：`server.mjs`（Node 22.5以上＋`node:sqlite`で`worker.js`を動かし、マイグレーションと`seed.sql`を投入）＋`card_check.py`（11枚を描画し、JSエラー・12px未満の文字・フッターのコントラスト・フォント読み込み・機体名の泣き別れを確認）。実行時はスクラッチパッドにポータブル版Node（`node-v22.x-win-x64.zip`）とNoto Sans JP（`NotoJP-Regular.otf`・`-Bold.otf`）を置き、`CARD_CHECK_FONT_DIR`と`PYTHONIOENCODING=utf-8`を指定
- テストハーネスはリポジトリに含めない（検証後に削除）
- 未確認で残りがちなもの：iOS Safari実機での大きい画像の保存・フォント読み込み

## 新ユニット・作品の追加手順

**トップのお知らせ・リンクを追加するとき**：`top.html`の`INFO_FEED`（配列）に1件足す・書き換えるだけ（`href: ''`は非表示、`end`で期限、全部消せば欄ごと消える）。D1・API変更なし。切替間隔は`INFO_FEED_MS`（10秒。説明文が流れ切るのに足りないときは流れ切って+1秒）、流す速さは`INFO_FEED_DESC_SPEED`（50px/秒）。流す処理`applyFlow()`を呼ばなければ「…」省略表示に戻る。

**URユニットを追加するとき（73以降。SQL＋画像だけ）**
1. **画像を先にpush**：`images/units/{id}.jpg`、（キャラが分かれば）`images/characters/{id}.jpg`。画像だけならどこにも出ないので先に入れてよい（既存IDは振り直さない）
2. **SQL**（次の番号のマイグレーションとしても残す）：
   - `INSERT INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (88, '…', 1, '攻撃', '2026-10-30', NULL);`（`released_on`＝ゲーム内の実装日＝ガシャ初登場日・JSTは必須。入手日の初期値・カードの実装日。`wrap`は任意＝カードで機体名を2行に折る位置を「|」で指定。「|」を除いて`name`と一字一句同じ）
   - `INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, 88, …);`（無いとカードの推しユニット・作品名に出ない）
   - タグ：`INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES (1, …, …, 'game', '…');`（運営者がゲーム内ユニット詳細の「タグ」欄で確認）
3. 最大5分で全画面（ユニットチェッカー・トップの件数・推しユニット・推し編成）に出る。`worker.js`・`ur-units.js`・`top.html`の件数・`unit-scan.js`の編集は**不要**
4. スクショ読み取り：運営者が`/unit?scandebug=1`で手動で割り当て→表示された`UPDATE units_master SET scan_fit = '[A,bx,by]' WHERE unit_id = N;`をD1に流す
5. 名前は下の「名前の表記ルール」に従う

**URサポートを追加するとき（73以降）**：画像`images/supporters/{id}.jpg`を先にpush→`INSERT INTO supporters_master (supporter_id, name, limited, skill[, skill_detail]) VALUES (…)`（`skill`＝HP回復／EN回復／複合。効果の詳しい表記は`skill_detail`に、例：`HP回復/防御UP`）。スクショ読み取りは`/supporter?scandebug=1`のUPDATE文（`supporters_master.scan_fit`）。`supporter.html`・`worker.js`・`top.html`の編集は不要

**URユニットのセットのキャラ（56）**：新URユニットを足したら、`characters_master`に1行（`char_id = unit_id`・`set_rarity_code = 1`・`set_unit_id = unit_id`・名前）と`images/characters/{id}.jpg`（150×150）を足す（次の番号のマイグレーションとして）。名前が分からないうちは入れなくてよい（搭乗キャラの補充規則で動く）。**新しいイベント配布キャラ**は`char_id`を1001番台の次の番号・`set_*`はNULL・`type`・`work_id`を入れる＋画像。`char_id`の範囲は`worker.js`の`CHAR_ID`のコメント（1〜999＝URセット、1001〜1999＝イベント配布、10001〜＝将来のSSRセット）。0034の再投入は`docs/04_自己紹介カード/データ/56_build_characters_sql.py <CSV>`で作る

**URサポーターを追加するとき（51）**：上の手順に加えて、`supporters_leader_rules`・`supporters_leader_targets`に行を足す（Coworkが攻略サイト・ゲーム内で対象を確認して下書き）。`docs/04_自己紹介カード/データ/51_シナジー判定_確認SQL.sql`の先頭3本で孤児0件を確認。新しいタグがリーダースキルの対象になるなら、`tags_master`に先に追加する

**作品（推し作品の選択肢）を追加するとき（73以降）**：`works_master`に1行（`INSERT OR REPLACE`。`work_id`はゲーム内「シリーズ絞り込み」の並び順。`nick_name`＝カードで短縮名が収まらないときの通称・`group_label`＝推し編成のチップでまとめる名前は任意）。ロゴ`images/series/{work_id}.png`は後から置けばよい（無いあいだは作品名を文字で出す）。`worker.js`の変更は不要。作品の付け替え（URユニットの`unit_work_map`）もSQLだけ

**チャレンジの新シリーズ・ステージ・ミッション**：`challenge_series`・`challenge_stages`・`challenge_missions`にSQLを足すだけ（`worker.js`の変更は不要）。バナーは`images/challenge/{series_code}.jpg`

**名前の表記ルール（㉚・ユーザー決定）**
- **ユニット名・サポート名＝ゲーム内の表記**（運営の公式X・お知らせの表記）：括弧は**半角「()」**、Ζ・ΖΖは**半角英字「Z」「ZZ」**（例：`フルアーマーZZガンダム`・`キュベレイ(ZZ版)`）、つなぎは**半角「&」**
- **ゲーム内の名前の末尾に付く「(EX)」は付けない**（公式Xで「スサノオ(EX)」でも登録名は「スサノオ」）
- **作品名（`works_master`）＝アニメの公式タイトル**：「機動戦士Ζガンダム」「Ζ-MSV」のようにギリシャ文字「Ζ」
- D1（`units_master.name`・`supporters_master.name`）が正本。予備の静的ファイル（`ur-units.js`・`supporter.html`）は更新しない

## Coworkとの連携ルール（詳細は`../README.md`）
- Coworkは`docs/`に設計資料・実装依頼書を置く。「docsに資料を追加した」と伝えられたら、それを読んで実装する（依頼書に「優先」と書かれた資料が正）
- Coworkが`checker/`を直接編集することがある（**未commit**）。依頼書に対象ファイルが書いてあるので、差分を確認してからcommit・pushする
- **実装が終わったら、このファイルの「完了済みの作業（索引）」に1行と、必要なら「未完了・次にやること」を更新してからセッションを終える**。仕様が変わったら`docs/WEBサイト仕様書.md`も更新する
- 経緯の詳しい記録が必要なら、このファイルではなく`docs/`の依頼書の末尾（または仕様書）に書く。**このファイルを再び肥大化させない**

## 完了済みの作業（索引）
詳細は`../bk/履歴_20260929/CLAUDE_20260929.md`（2026-09-29以前）と各依頼書。

| 番号・名前 | 日付 | 内容 |
|---|---|---|
| ①〜③ | 〜09-18 | 画像の外部化、URL構成、ユーザー登録・ログイン、トップページ、銀河系デザイン、新UR3件 |
| ④ | 09-19 | D1への所持データ保存、分析ページ新設、ゲストデータ廃止（0002〜0004） |
| ⑦⑨ | 09-20〜21 | 分析ページのティアリスト化（10%刻み・絞り込み・対象外非表示） |
| ⑧ | 09-20 | X経由で「トップに戻る」が効かない件：遷移先を`/top`に（301キャッシュ対策） |
| ⑪ | 09-22 | JST化・keepalive・「データ登録」ボタン・起動時のDB復元（0005は適用不要） |
| ⑫⑬ | 09-22〜23 | 登録済みフラグと母数の絞り込み（0006）。100%超えは重複ではなくデプロイギャップが原因（0007は適用しない） |
| ⑩⑭⑮ | 09-23 | エタロ攻略チェッカー（0008〜0010）。バナー・通常クリア・3ボタン・ログイン必須・全完了ボタン |
| ⑯・登録状況表示 | 09-23〜24 | データ未登録の文言、チェッカー・トップの登録状況バッジ |
| ㉔ | 09-24 | エタロの画像出力を文言チップ・虹枠強化（案D）に |
| 分析ページ改名 | 09-24 | 「データ登録結果レポート」＋エタロ攻略タブ（`/api/analytics/eternal-road`） |
| ㉒ | 09-24 | 自己紹介カード（0011・0012）。ジャングル背景は廃止（描画コードは残置） |
| ㉖ | 09-25 | 入手記録（0013）・スクショ読み取り・定時分析と週間レポート（0014）・運営者欄 |
| スクショ本番化 | 09-26〜27 | ユニット・サポートとも各チェッカーへ統合（試験版ページは削除） |
| ㉘ | 09-26 | チェッカーのログイン必須化・復元条件の修正・カード「標準」改修・レポート6種類 |
| ㉙㉚ | 09-27 | 入手日の初期値・`ur-units.js`切り出し・カード改善・表記統一（0015〜0017）・回帰チェック |
| ㉞㉟A | 09-28 | カード公開前の修正（0019は未適用）。一般公開は`release/profile-card-public`に準備済み |
| ㊱ | 09-29 | X投稿用レポートの並び順3種（`report.html`のみ） |
| ㊵ | 09-29 | チャレンジミッションチェッカー（0020・0021は適用済み・push済み。運営者専用で稼働中） |
| ㊸ | 09-30 | 9/30新UR：ユニット85〜87・サポート50を追加（`ur-units.js`・`supporter.html`・画像・`top.html`・`worker.js`の`MAX_*_ID`・0022）。D1適用・push済み。本番確認（依頼書8章）とSCAN_FIT学習が残り |
| ㉟A・㊹ | 10-01 | 自己紹介カード一般公開（adminGate解除・導線表示。運営者向け試用版`profile-card-trial.html`を残す。0019適用済み）。㊹：トップの導線アイコンを試作カード縮小画像（`images/profile-card/{standard,units,eternal}.jpg`。カードのデザインを大きく変えたら`docs/04_自己紹介カード/データ/㊹カードアイコン生成.py`で作り直す）に差し替え。本番確認（依頼書4章A-4・㊹8章）が残り。2026-10-01：画面の「ログイン会員限定」「ログインユーザー限定」表記を削除（全機能ログイン必須のため。トップの節見出しは「レポート・カード」） |
| ㊶A・㊾ | 10-04 | ㊶段階A：`migrations/0024〜0026`（SSRマスター・`unit_work_map`作り直し・`rarity_code`・タグ）、`worker.js`の`RARITY_CODE`・`/api/works`と`loadProfile`のURだけ読み＋旧SQLへのフォールバック（`rarityCode: 1`を返す）・新API`GET /api/tags`。㊾：`0027`（タグ10件追加・作品名タグ14件無効）・`0028`（URタグ付け712件）。**段階B（`ssr-tool.html`等）とSSR関連（㊻C-1・C-2）は保留**。0024の索引は㊻3章どおり`(name, type)`。D1適用（0024→0028の順）→push の順で。仕様書4章・3章は更新済み |
| 51・52 推し編成・タグ傾向（段階1） | 10-04 | 0029・0030をD1適用済み。`worker.js`：`GET /api/leader-skills`、`/api/profile-card`に`profile.formations`・`supporters.ownership`・`supporters.master`（依頼書に無い追加。サポーター名・限定・skillを画面側が持たないため）、`POST /api/profile`の`formations`（別バッチ・送らなければ不変・2編成の重複は後ろを読み飛ばす）。`profile-card-trial.html`：テンプレート「推し編成」（1編成・2編成の描画、フォーム、Xシェア）と推しユニットカードの特徴タグ・得意タグ。**本番`profile-card.html`への反映と`scripts/card_check/`への追加は段階2（運営者の確認後）**。左パネル・結果の「サポートスキル」表示は`supporters_master.skill`（HP回復/EN回復/複合）で、試作の「HP回復/防御UP」等の詳細表記は出ない。`scripts/card_check/seed.sql`は`user_favorite_units`の列数が0024以降に合わず古い（段階2で直す） |
| 54 パスワード変更・運営者リセット・ハッシュ化（段階A-1） | 10-04 | 0031をD1適用→push。`worker.js`：PBKDF2ヘルパー・`KEEP_PLAINTEXT_PASSWORD = true`・回数制限（`auth_rate_limits`）・登録/ログイン/`/api/me`の変更（ログイン時に未移行者を自動ハッシュ化、`mustChangePassword`）・`POST /api/account/password`・`POST /api/admin/reset-password`・`GET /api/admin/password-status`・`POST /api/admin/hash-migrate`・`scheduled()`で古い制限記録の掃除。画面：`account.html`・`admin-account.html`・`auth.js`（ユーザー名リンク・「パスワードを忘れた方」・仮パスワードログイン後の遷移）・`top.html`の運営者欄に導線。0031未適用でも動くフォールバックあり。案内文のXアカウントは`@polarbear148691`で実装（依頼書の確認事項1）。仮パスワードのままでも他ページは使える（確認事項2）。**A-2（平文を消す）は約1週間後**。依頼書：`docs/05_機能拡張_有料プラン/54_…実装依頼書.md` |
| チャレンジ公開・作品紐付け修正・利用集計 | 10-06 | ㊵チャレンジを一般公開（`challenge.html`のadminGate削除、`top.html`の導線を「チェッカー」欄へ）。0032適用（上表）。`worker.js`：`bumpDailyStat`（登録・ログイン成功時に`login`、`/api/log`・`/api/log-supporter`・`/api/log-eternal-road-missions`・`/api/log-challenge`の200で`checker_use`）・`GET /api/admin/usage-stats`。`admin-account.html`に「利用状況」（累計／本日のログイン数・チェッカー利用数。集計は0032適用後から。日付JST） |
| 56・57 推しURキャラクター（段階1） | 10-09 | 0033・0034をD1適用済み（上表）。`worker.js`：`GET /api/characters`、`loadSelectableCharacters()`・`normalizePilots()`（補充規則）、`/api/profile-card`に`profile.favoriteCharacters`と`formations[].units[].pilotCharId`、`POST /api/profile`の`favoriteCharacters`・`formations[].pilots`（別バッチ・未適用ならフォールバック）、`CARD_TEMPLATES`に`characters`。`profile-card-trial.html`：テンプレート「推しキャラ」（`layoutCharacters`。イベント配布キャラは「セット」の代わりに「イベント配布」チップ）、推しキャラ欄、推し編成の搭乗キャラ（顔・名前・推しはピンク＋ハート）・乗せ替え画面（搭乗中のキャラを選ぶと入れ替え）、1編成の特徴タグを外した（「編成のタグ」の帯は残す）、Xシェア。`images/characters/`（91枚）。**本番`profile-card.html`への反映と`scripts/card_check/`への追加は段階2（運営者の確認後。`seed.sql`が古い件は53の段階2と合わせて直す）**。確認待ち：依頼書57の8章の画面観点。未確認だった分は10-10に確定済み（91件版0034・画像91枚。1005は66に統合して入れない） |
| 66 推し編成：同一ユニットの複数選択（段階1） | 10-11 | 0036をD1適用済み（上表）。`worker.js`：`validFormationLevel()`、`normalizeFormations()`（ユニット重複を許可・`levels`・登録の凸が上限）、保存・`loadFormations()`の`level`列フォールバック、`normalizePilots()`の補充順変更、`/api/analytics/oshi`の`formations.mine.units`は重複を除く（参考パッチに無く追加）。`profile-card-trial.html`：同じユニットを何枠でも選択・枠ごとの凸・フォームだけの「n体目」。**本番`profile-card.html`への反映と`scripts/card_check/seed.sql`への追加は段階2（運営者の試用確認後）** |
| 56追加改修（試用版） | 10-09 | ユーザーの試用要望：①カードのデザイン選択を3列2段に ②実績の登録状況に推し編成・推しキャラ（保存済みなら登録済み）③プロフィールにランク入力欄（1〜999・空欄で非表示。`user_profiles.player_rank`＝0035、`worker.js`の`PLAYER_RANK_MAX`・`loadPlayerRank()`・`POST /api/profile`の`playerRank`＝送らなければ不変・nullで消去・範囲外は400 `invalid_rank`。カードは名前の見出し行の右にバッジ：100未満は控えめ・100以上は金・150以上は虹の縁取り＋光＋きらめき。全テンプレート共通の`identity()`／`identityBand()`）④推し編成・推しキャラに簡易情報（UR所持率＋推し作品ロゴ最大5つ＝`infoMini()`。1編成は右上パネルのゲージを短くして右に置き「サポーターの対象n機」を削除、2編成は名前の下に帯を追加して行を下げた）⑤推しキャラは1位を大きくせず5人横並び（顔・名前・タイプ/作品・セットのユニット）、下段に「推し作品」（ロゴ＋作品名）と「推しユニット」（画像＋機体名）。設計書への反映はCowork |
| 56追加改修2（試用版） | 10-09 | ランクバッジの上辺を「ユーザーネーム」見出しの上辺に揃えた／150以上は虹の輪郭＋虹のボディ（100以上の金は据え置き）。推しキャラカード：カードを詰め（高さ300）、下段を全幅の2段に：推し作品は標準カードと同じ大きさのロゴ（146×64）、推しユニットは画像＋機体名＋凸（限定は出さない）。2編成：`unitImage()`に`limitedMini`（「限定」だけの小バッジ）、簡易情報の帯を高さ60にして作品ロゴを大きく（96×42）、行を圧縮（行の上端206）。`infoMini()`は幅600未満なら2段・以上なら1行。1編成は据え置き |
| 56追加改修3（試用版） | 10-09 | 推しキャラ：「推し作品」「推しユニット」の見出しを上寄りにしてアイコンと重ならないように、推しユニットの凸は標準カードと同じ★（`totsuStars`）、推しユニット欄の下辺を左パネルの下辺（H-58）に合わせ、浮いた分を推し作品欄の下余白に。推し編成2編成：ユニット画像を最大化（★・タイプ・名前は補足の小表示、タグ・「対象外」表記を廃止、バフ対象だけ名前の右に上昇率）。1編成：「編成のタグ」の帯を廃止し、その帯に「UR所持率＋推し作品ロゴ」（`infoMini`）を表示（右上パネルは元の「サポーターの対象n機」に戻した） |
| 56追加改修4（試用版） | 10-09 | 推しキャラ：推しユニットの★を枠内の最下段・同じ高さに。推し編成：搭乗キャラの顔をユニット画像の右下を埋める大きさ（画像の46%）に。**1編成のレイアウト`layoutFormation`を廃止**し、1編成だけのときも2編成のレイアウトで編成1だけ埋める（編成2は「未設定」の枠）。前回の「1編成の下段に推し作品・所持率」は不要になった |
| 56追加改修5（試用版） | 10-09 | 推しキャラのハートを顔の右下に（`pilotBadge`）。推しキャラカードの顔画像の左上に、セットのユニットが期間限定なら「限定」の小バッジ（`limitedBadgeMini`。推し編成2編成と同じ大きさ。イベント配布キャラは出さない） |
| 56追加改修6（試用版） | 10-09 | 推しキャラ・推し編成のタイプ色を攻撃＝赤・支援＝黄・耐久＝青に（`TYPE_COL2`。推しユニット・標準は従来の`TYPE_COL`のまま） |
| 56追加改修7（試用版） | 10-09 | タイプ色（攻撃＝赤・支援＝黄・耐久＝青）を全テンプレート共通の`TYPE_COL`に統一（`TYPE_COL2`は廃止）。推しキャラのハートを「推」バッジ（ピンクの丸に白抜き。`oshiBadge`）に変更、フォームの搭乗表示は「【推】」 |
| 56追加改修8（試用版） | 10-09 | 「推」バッジをピンクから落ち着いた紫に、文字は細字（標準の太さ）に。顔の縁（`OSHI`）とフォームの搭乗表示の色も紫にそろえた |
| 56追加改修9（試用版） | 10-09 | 推しキャラの印を「推」から星に変更（紫の丸に白抜きの星。`oshiBadge`）。フォームの搭乗表示は「★」 |
| 56追加改修10（試用版） | 10-09 | 推しキャラの星バッジ・顔の縁を虹色に（フォームの搭乗表示も虹色の文字）。推しユニットの左パネルの「得意タグ」（52案D-3）を廃止し推しキャラと同じ表示に（`by`の余白も40pxに戻した。`tagTrend`の計算とデータは残置・1位カードの特徴タグは据え置き）。ランク欄の「100以上は金…」の説明文を削除。推しキャラのタイプ・作品チップを名前の行数によらず同じ高さ（セット欄の区切り線のすぐ上）に |
| 64 運営者向け分析（推し統計・所持率分布） | 10-10 | **ユーザー決定：運営者ページとして正式運用・一般公開しない（ESPのみ。10-13 12:11）**。`worker.js`：`GET /api/analytics/oshi`・`GET /api/analytics/distribution?kind=`（どちらも`requireAdmin`。D1変更なし）、定数`OSHI_SLOT_POINTS`・`OSHI_RATE_MIN_OWNERS`。新ページ`analytics-admin.html`（`analytics.html`は無変更）、`top.html`運営者欄に導線。動画SQL`shorts/sql/export_oshi_data.sql`・`export_oshi_chars.sql`を63の定義にそろえ`score`列を追加。API検証はNode＋`node:sqlite`のハーネス（依頼書8章の1〜12・14の観点。無凸79機→90%以上を確認）、画面は320/390/1024px。一般公開の予定なし（公開するなら要再相談） |
| 71 トップのインフォバナー（相互リンク） | 10-12 | D1変更なし・`top.html`のみ。説明文の下に`#infoFeed`（`INFO_FEED`定数・`initInfoFeed()`。6秒ごとスライド、ホバー/フォーカス/非表示タブ/一時停止/`reduceMotion`で停止、スワイプ対応、期限`start`/`end`はJST）。1件目は相互リンク（ジージェネエターナル 総合データベース `https://athena-gget.com/`・別タブ、ロゴ`images/partners/athena-gget.jpg`を新規追加）、2件目はチャレンジ公開のお知らせ（〜10-31）、ESP studioは`href:''`で非表示。フッターに相互リンク1行。参考パッチを`git apply --ignore-whitespace`で適用。依頼書：`docs/08_トップページ/71_…依頼書.md`。切り戻しは`INFO_FEED`を空配列に |
| 73 作品・ユニット・サポートの追加をSQLだけで済ませる作り | 10-15 | 0039（列8つ）・0040（今の値）をD1適用（確認SQLは期待値どおり）。`worker.js`：`loadMasterIdSet`（旧`MAX_UNIT_ID`・`MAX_SUPPORTER_ID`・`WORK_IDS`を廃止）・`GET /api/units`・`GET /api/supporters`・`/api/works`に`nickName`・`groupLabel`・units の`released`・`wrap`・`/api/tags`に`shortName`・マスター系APIのキャッシュを300秒に。新規`master-data.js`（配列の中身をAPIでその場で入れ替える。取れなければ予備の静的ファイル）。`unit.html`・`supporter.html`・`top.html`・`unit-scan.js`・`supporter-scan.js`（`scan_fit`をD1から。`?scandebug=1`にD1用UPDATE文）・`favorite-logic.js`（`WorkLabel.setWorks`）・`favorite-form.js`（ロゴが無ければ文字）・`profile-card*.html`。試用版カードから`ssr-units.js`を外した（SSR中止）。追加手順は上の「新ユニット・作品の追加手順」 |
| 72 推し情報設定の一般公開・本番カードの共通部品化（68段階2＋66段階2）＋インフォバナー変更 | 10-14 | D1変更なし。`profile-card.html`：推し4欄を`favorite-form.js`/`.css`・`favorite-logic.js`に切り替え（同じユニットを複数枠・枠ごとの凸・「n体目」が本番に入る）。**`CardRenderer`は変えず、試用版のSSR対応描画（㊻）は持ち込まない**・`ssr-units.js`は読み込まない（`SSR_UNITS`未定義でも「SSRから選ぶ」は出ない）。`favorite-info.html`：`adminGate()`・`#adminOnlyView`・`ssr-units.js`を外して一般公開、「自己紹介カードを作る」は`/profile-card`へ。`top.html`：推し情報設定のカードを「レポート・カード」欄の自己紹介カードの前へ（名前・説明から「試用」「運営者専用」を外す）、バッジは`showRegStatus()`から。インフォバナー：`INFO_FEED_MS`＝10000・説明文`.dsc>.dscIn`を右から左へ流す（`applyFlow()`・`INFO_FEED_DESC_SPEED`＝50・`ResizeObserver`で再判定）・推し情報設定のお知らせを2件目に追加（2026-10-14〜10-28）。`scripts/card_check/`：`seed.sql`に`u2`（運営者以外・同じユニット23を3枠・枠ごとの凸）・`u3`（未登録）を追加、`card_check.py`に本番カード（重複編成×3背景・保存→再読み込み）と推し情報設定（運営者以外で開ける・未登録の案内・保存→`/profile-card`・未ログインのガード）の確認を追加。検証：切り替え前後でカード画像17枚が一致、ハーネス全成功、トップ320/390/1024pxで横はみ出しなし・JSエラーなし。依頼書：`docs/04_自己紹介カード/72_…依頼書.md`。切り戻しはcommitのrevert（D1なし） |
| 74 推しユニットにキャラ表示・SSR／ULTの本番公開 | 10-16 | 0041→0042をD1適用済み（上表）。`worker.js`：`GET /api/ssr-units`、`favoriteUnitKey()`、`favoriteUnitChars`（`/api/profile`・`/api/favorite-info`。不正値はnull・キー無しは引き継ぎ・別バッチ）、`loadProfile`の`charId`。`favorite-form.js/.css`：SSR・ULT選択、キャラ選択`#unitCharModal`、端末の画像（localStorage`favunit_img_v1`・サーバー非送信）。`profile-card.html`・`-trial.html`は同じ`CardRenderer`（ULT紫ロゴ・SSR/ULTは★なし・顔＋名前）。`ssr-units.js`は読み込まない予備。SSRの中止（㊻・68の③）は**74で再開・本番公開**。新SSR/ULT追加手順：`ssr_units_master`へINSERT＋`unit_work_map`＋`images/ssr/{id}.jpg`、ULTなら`is_ult = 1`。「同じものを複数か所」：`favoriteUnitKey`（worker.js）＝`favKey`（favorite-form.js）。回帰チェック全成功（フォント確認(5)は未実施）。ESP確認待ち：8章13・14、確認事項1〜4 |
| 75 ユニット一覧（タグ別URユニット一覧） | 10-16 | 0043→0044をD1適用（確認SQLは期待値どおり）。`worker.js`：`GET /api/units`に`rangeMin`・`rangeMax`・`rangeNote`・`effects`（0043未適用なら付けない）、新規`GET /api/effects`。`master-data.js`の`unitFromApi`に通す。新規`unit-list.html`（段階1＝運営者専用）・`images/effects/`、`top.html`に「ユニット一覧」欄（お知らせの下・チェッカー欄の上。段階1は運営者だけ＝`toggleAdminNav()`が`#unitListSection`も出す）。検証（模擬APIでの確認）：戦闘タグ×機体の種類＝20/22/23/21/無所属1・「該当なし」行なし／疾風迅雷18・不撓不屈16・サイコミュ26・ライバル26／全UR 38・29・20＝87／並びは限定→恒常×攻撃→支援→耐久／画像で保存のPNG生成／320pxで横はみ出しなし。**段階2（10-17 公開済み）**：`ADMIN_ONLY`を`false`、`#unitListSection`の`hidden`と運営者だけに出す処理を外した。切り戻しは`ADMIN_ONLY = true`＋`#unitListSection`に`hidden`＋`toggleAdminNav()`で出す処理を戻す。試用改善（10-16〜17：表の名称変更・拡大縮小・凸表示の選択式・所持だけ／Xシェア廃止など）の一覧は依頼書11章。確認事項（Excel 2つ目とD1のタグの違い6機）は10-17に解決（0045）。ESP確認待ち：依頼書8章（件数は0046後の89機の期待値に更新済み）。新ユニット追加時はSQLだけ（依頼書6章：`range_*`のUPDATE＋`units_effects`のINSERT）。**追加改修（10-17夜・Claudeがクラウドから直接編集・未commit）**：`unit-list.html`のみ。ログイン中で所持データがあれば、画面（表示オプションの横）と保存画像（ヘッダー下の2枚のパネル）に**所持率・完凸率**（表に載っているURが対象。全URなら「※全URユニットが対象」、一部なら「※表内のUR n機が対象」。整数%）。**凸表示ONの完凸は虹色の枠＋白い光**（画面はconic-gradient＋mask、画像はcreateConicGradient。無い環境は斜めの線形）、凸バッジ「完凸」も虹色。実装30日以内の赤枠と重なる時は赤枠を内側に細く。凡例に「完凸」を追加（凸表示ON時）。あわせて画像の左上で「ALL」と機数が重なっていたのを修正（サポーター無しの見出しは機数を右寄せ）。模擬APIで画面・画像（全UR×タイプ／他主要タグ／未ログイン／390px）を確認済み。**同日23時の再改修（ESP指示）**：①**平均凸Lv**を追加（所持ユニットの凸段階0〜3の平均・小数1桁。UR所持率チェッカーと同じ定義）②**画像の大きさはスマホ表示に合わせた現行のまま**（`TOP=96`固定。最初の版で入れたヘッダー下のパネルは廃止し、タイトル行の右に小さな札3つ＝所持率／完凸率／平均凸Lvで並べる。入りきらない時は札を縮小。@ハンドルは副題の右に入ればそこへ、入らなければ右上端）。ログイン有無で画像サイズが同じことを確認済み ③完凸の虹枠を細く（画像2.5px・画面2px）。**10-18の再改修（ESP：虹枠がユニット画像と同系色で見えにくい）**：虹は絵に乗せず**絵の外側（暗い背景の上）**に2.5pxで引き、その外へ虹色の光をにじませる（光は絵の外だけにクリップ）。絵の縁には黒の細線。画面は`.tile.max`を`overflow:visible`・`z-index:1`にして`::before`を外側`inset:-3.5px`のリングに。「完凸」札は大きめ（画像13px・幅40px、画面12px、どちらも黒の縁取り）。実装30日以内の赤枠は通常位置に戻した。凡例の「完凸」見本も同じ描き方。模擬データ（マイグレーションから作った本番同等のマスター＋仮の所持）で、デフォルト表示＋凸表示の画像が2200×3932のままであることを確認済み。※10-17夜の2回目の書き戻しはPCに反映されていなかった（10-18に判明・反映済み）。**10-18 微修正（ESP：H採用）**：①実装30日以内の赤枠は、完凸のときは黒の細線の代わりに虹枠のすぐ内側へ隣接（3px）②**サポートにも凸表示**（凸表示ONで`/api/my-ownership-supporter`の凸段階を札で右上に表示。完凸はユニットと同じ外側の虹枠＋虹色の「完凸」札）③**完凸サポートのバフ対象エリア**（その列・行の全体）を細い虹枠（2px）で囲む。画面は`.matrix`を`position:relative`にして、グリッドの列・行に絶対配置した`.area`を重ねる（自動配置を崩さない）。凡例に「完凸サポートの対象」。模擬データで未ログイン／凸OFF／全UR×タイプ／他主要タグ＋暗くするも確認（エラーなし、画像サイズは凸表示の有無で変わらない）。**10-18 再微修正**：完凸＋実装30日以内は「虹枠→黒の細線→赤枠3px」の順に内側へ重ね、赤枠も角丸で黒線に沿わせる（①の「黒線の代わり」は撤回）。サポートの限定★がはみ出していたので画像の内側へ（画像18px・左下、画面も同じ）。**10-18 差分確認・模擬APIでの動作確認（未ログイン／ログイン凸OFF・ON／4種類の表＋暗くする／390px・コンソールエラーなし）のうえcommit・push・デプロイ済み**。**10-18 追修正（ESP）**：凡例の「完凸サポートの対象」を画面・画像とも廃止。画面の対象エリア虹枠はグリッド配置に頼ると全体にかかる環境があったため、見出しセルの実寸（`placeAreas()`）から絶対配置する方式に変更。**微調整**：サポートの凸段階の札を画像の中央下段（左下の★・右下のスキル表記と並列）へ移動／未所持を暗くする時はユニットのタイプアイコンも暗くする（画面・画像）。**再微調整**：ユニットの凸段階の札は中央下段に移し、完凸の札は小さく（画像32×14）・それ以外は大きく（34×17・12px）して★との重なりを解消。サポートの完凸札も通常の凸札と同じ大きさ（画像26×13・10px）に縮小。**初期表示**：ログイン中は「未所持を暗くする」「凸表示」を最初からON（URLは`dim`・`lv`が`0`の時だけOFF。未ログインは従来どおり） |
| 68 推し情報設定ページ（段階1） | 10-11 | D1変更なし。新規`favorite-logic.js`（`FormationLogic`を移動＋`WorkLabel`。`CardRenderer`は`WorkLabel`を参照）・`favorite-form.js`/`.css`（試用版カードの推し4欄を動きを変えずに移した`FavoriteForm`。`emptyMode:"hide"`＝カード／`"hint"`＝推し情報設定）・`favorite-info.html`（運営者専用・下書き`favoriteinfo_draft_v1`・未保存表示・「自己紹介カードを作る ›」）。`worker.js`：`favoriteWorkStatements()`・`favoriteUnitStatements()`・`saveFormations()`・`saveFavoriteCharacters()`を`handleSaveProfile()`から切り出し、`POST /api/favorite-info`（送ったキーだけ処理・`user_profiles`行が無くても作る）・`GET /api/favorite-info/summary`。`profile-card-trial.html`を共通部品へ切り替え（推し欄の上に推し情報設定への案内を1行追加）。`top.html`運営者欄に導線と登録状況バッジ（`showFavoriteRegStatus()`）。検証：切り替え前後でカード画像15枚・`/api/profile`の送信本文・4欄の操作結果が一致、`/api/favorite-info`の保存・null・不正値・行なしユーザー、320/390/1024px、運営者以外・未ログイン・未登録ユーザーの案内。**`profile-card.html`への反映・一般公開は段階2（ESPの確認後）** |
| ㊻ 推しユニットにSSR（C-1・C-2、試用版） | 10-12 | 0037をD1適用→push。`worker.js`：`normalizeFavoriteUnits()`（整数＝UR・`{"s":id}`＝SSR。SSRは所持確認なし・マスターに無いID／重複／合計5件超は400）、`favoriteUnitStatements()`が`rarity_code`を書く、`loadProfile`がSSR行も`rarityCode: 2`で返す。`ssr-units.js`・`images/ssr/`（332枚）。`favorite-form.js`：推しユニット欄に「URから選ぶ／SSRから選ぶ」（`SSR_UNITS`が空なら出ない。draftはUR＝整数・SSR＝`{s:id}`で持つ＝送信形式と同じ。依頼書の`{r,id}`より旧下書き互換を優先）。`profile-card-trial.html`・`favorite-info.html`が`ssr-units.js`を読む。カードはSSRバッジ（金）、画像`images/ssr/`。**本番`profile-card.html`は未反映**（SSR行を読み飛ばすだけ。本番で保存するとSSRの推しは消える）。反映は68の段階2と合わせる。`ssr-tool.html`（4-4）は段階B未実装のため未対応。`scripts/card_check/`への追加は未 |
| ㊻ SSR作品の直し32件 | 10-12 | 0038をD1適用→`ssr-units.js`の`workId`32件を差し替えてpush。名前・タイプ・unit_id・画像は不変 |
| 76 所持チェッカーの並び順・未所持のみ表示＋コンプリート表示 | 10-17 | D1・`worker.js`変更なし。`unit.html`・`supporter.html`：実装順（No.順）の古い順／新しい順（端末保存）・未所持のみ表示（所持にした行は切り替えるまで`keepIds`で残す）・未所持0件でコンプリート表示。`eternal-road.html`・`challenge.html`：「未達成ミッションのみ」ON×全達成でコンプリート表示（チャレンジはシリーズタブごと）。共通部品`complete-banner.css`/`.js`を新規追加。参考パッチ4本が`git apply --directory=checker`で通りそのまま適用。Playwright（Chrome・390px・APIモック）で8章と11.5のうち「参考実装で済み」の項目（unit/supporter 1〜9-5・14、E1〜E9）を再確認、全成功。残り＝ESP確認：8章9-6・10〜12、11.5のE10・E11（実機・本番データ）。依頼書：`docs/01_所持チェッカー・DB登録/76_…設計・実装依頼書.md` |
| ㊼ | 10-03 | エタロ攻略にステージ30（機動戦士Vガンダム）を追加：全30ステージ・71ミッション（`eternal-road.html`の表記・合計、一括達成の確認文は`stages.length`参照に）、`images/eternal-road/30.jpg`・`icon/30.jpg`（`scripts/make_eternal_road_icons.py`更新）、`worker.js`、`top.html`、自己紹介カード`profile-card.html`・`profile-card-trial.html`のエタロ分母を30に、`migrations/0023_eternal_road_stage30.sql`（ミッション301・302）。0023はD1適用済み（2026-10-03ユーザー確認）。本番確認が残り |

| 77 ユニット一覧の画像保存（JPEG標準・PNG高画質） | 10-18 | D1・`worker.js`変更なし・`unit-list.html`のみ。Android Chromeで保存できない原因＝PNGのdata URLが8〜13MBでChromeの上限（約2MB）超。「画像で保存」＝JPEG（画質0.85→0.6で`toDataURL`が1.9MB以下になるものを採用。`encodeJpeg`）、「高画質で保存（PNG）」ボタン追加（`btnSaveHq`）。プレビューの`<img>`はdata URIのまま、「ダウンロード」はどちらもBlob URL（`canvasToBlob`→`createObjectURL`、閉じるまで解放しない）。プレビューに形式・大きさを表示。参考パッチ適用。他ページ（unit・eternal-road等）は範囲外（確認事項1）。実機確認（Android Chrome・iPhone Safari・Xアプリ内）はESP待ち。依頼書`docs/01_所持チェッカー・DB登録/77_…実装依頼書.md` |
| 79 マスターリーグのブースト対象をユニット一覧・トップに表示 | 10-20 | 0048→0049をD1適用（確認SQLは期待値どおり）。`worker.js`：新規`GET /api/ml-seasons`（認証不要・`MASTER_CACHE`。0048未適用なら`{seasons:[]}`）。`unit-list.html`：マスリの帯・表の種類「マスリ対象」(`v=M`)・自由に選ぶの「マスリ対象」チップ・対象を強調(`ml=1`)・詳細・画像保存。`top.html`：インフォバナーの先頭に開催中／14日以内の次回を自動で1件（2.5秒で返らなければ出さない）。Cowork試作を無改変で適用（試作HTMLとバイト一致）。本番データ＋本番D1のシーズンでローカル動作確認（API失敗時は従来表示）。**新シーズンの登録手順**：CSVに1行足して`python 79_build_ml_seasons_sql.py 79_マスリ_シーズン一覧.csv > …`で0049相当のSQLを作り流す（依頼書7.1）。依頼書：`docs/01_所持チェッカー・DB登録/79_…設計・実装依頼書.md` |
| 79追加改修（ESP指示：履歴選択の見た目） | 10-20 | `unit-list.html`のみ（D1変更なし）。①`seasonLabel`を「SEASON n」だけに（「ガンダムファイト」「GWスペシャル」を画面・詳細・画像から削除。`ml_seasons.name`はD1に残す）②帯：プルダウンは「SEASON n」だけ（最大9.5em）で「マスターリーグ｜SEASON n▼｜状態」を同じ行に、「対象を強調」をブースト対象の隣へ（入りきらない時はチェックごと次の行の左端。対象名は途中で割らない）、期間・ステージ・注記・対象のUR数は2行目。Coworkのパッチ（置き換え7か所）を無改変で適用。本番データでのローカル確認（1400／390pxとも選択肢19件・横はみ出しなし・JSエラーなし・S9にテーマ名が出ない）。依頼書の末尾「追加改修」。**続き（ESP指示）**：「オルタナティブシリーズ」を帯・詳細・画像の注記・トップのバナーで「オルタナ」と略表示（`unit-list.html`の`mlShort`／`top.html`。タグ名・判定・表の行列・チップは正式名のまま。D1変更なし）。**続き2（ESP指示）**：マスリの帯を折りたたみ式に（1行目＝マスターリーグ｜SEASON｜状態＋開閉ボタン▼だけ常に表示。2行目＝ブースト対象＋「対象を強調」（右端固定）、3行目以降＝期間など。既定は閉じ、開閉は`localStorage`の`ulMlOpen`に記憶）。強調ONのまま閉じても強調は有効 |
## 未完了・次にやること（2026-09-30 08:30時点・Coworkが進捗を反映）
- **㊵チャレンジ**：実装・push・D1（0020・0021）適用済み（2026-09-30ユーザー確認）。運営者専用で稼働中。**一般公開は後日**（ユーザー決定。公開時は上の「一般公開の手順」）。設計書9章の後回し（分析ページのタブ・カードへの掲載・タグ縛り）は未着手
- **㉟A 自己紹介カード一般公開・㊹（2026-10-01夜に再公開）**：朝にいったん公開→ユーザー指示で夜公開に変更（非公開に戻した）→夜に再公開（revertのrevert）。残り：依頼書4章A-4と㊹8章の本番確認（iOS Safariの画像保存を含む）。追加改修は運営者用の試用版`profile-card-trial.html`で試してから`profile-card.html`へ反映（ユーザー決定）。切り戻しは㉟依頼書4章・㊹はcommitのrevert
- **㊸ 9/30新UR**：実装・D1(0022)適用・push済み（2026-09-30）。残り：依頼書8章の本番確認（特に#5データ登録→復元、#9カード）、`SCAN_FIT`の学習
- **㊶ユニットのタグ・SSRマスター**（`docs/01_所持チェッカー・DB登録/㊶…実装依頼書（㊳の実装）.md`）：段階A＋㊾のSQLを実装・D1適用（0024〜0028。2026-10-04にClaude Codeがwranglerで適用し確認SQLも期待値どおり）・push済み。本番確認（`/api/works`のユニット数・推しユニットの表示保存・`/api/tags`が129件）が残り。段階B（`ssr-tool.html`・topの導線）は中止。㊻C-1/C-2（SSRの推しユニット）は74で本番公開済み（10-16）
- **㉝ UR以外の推しユニット（ユーザー登録）**（`docs/04_自己紹介カード/㉝…実装依頼書.md`）：実装待ち。0018。㊶との順番の注意は㊶7章
- ⑪の残り：なし（`migrations/0005`は適用不要。本番実機確認はESP確認済み 10-17）
- `SCAN_FIT`の学習：ユニット18機（新85〜87を含む）・サポート19体（新50を含む）。新3機・新サポートは写ったスクショで`?scandebug=1`から学習
- 本番・実機で未確認：iOS Safariでのエタロ画像（1640×3140）とカード画像（2400×1350）の保存、カードのフォント読み込み待ち、入手記録の表示
- 継続案（⑦⑨）：凸レベル別内訳、PCでのポップオーバー、タイル長押し比較、絞り込みの複数選択と保存、並べ替え切り替え
- **51・52 推し編成・タグ傾向（53依頼書）**：段階1（10-04）・段階2（本番`profile-card.html`への反映。commit「自己紹介カード：推し編成・推しキャラを本番profile-card.htmlへ反映」）とも完了。**2026-10-10に一般公開済み**（ESP確認。2026-10-11 Coworkが進捗を反映）
- **55〜57 推しURキャラクター**：段階1（10-09）・段階2（本番反映。53と同じcommit）とも完了。**2026-10-10に一般公開済み**。設計書（51・52・55〜57）への試用版追加改修の反映はCowork側の作業として残っている
- **66 推し編成：同一ユニットの複数選択**：段階1（10-11）・段階2（72で本番公開。2026-10-14 push済み）とも完了。残り＝ESPの本番確認（72の8章の「本番確認」の行）
- **67・68 推し情報設定ページ`favorite-info.html`**：段階1（10-11）・段階2（72で一般公開・2026-10-14 push済み）とも完了。残り＝ESPの本番確認（72の8章）。**③SSRの推しユニットの本番公開（調整中・別途）**：公開時は`profile-card.html`・`favorite-info.html`に`ssr-units.js`の読み込みと、`CardRenderer`のSSR対応（試用版の`f.ssr`分岐・`totsuStars`のkind）を足す（70を先に入れた場合は読み込み不要）。それまで運営者は**SSRを含む推しを試用版カードで保存**する（共通部品がSSRを知らない状態で保存し直すとSSRの推しが落ちる）
- **SSR・ULTの推しユニット（㊻・68の③）は10-16に再開し、74で本番公開済み。このまま公開とする（ESP 10-17）**。`/api/ssr-units`・`favorite-info`・`profile-card.html`が使っている。`profile-card-trial.html`も公開側と同じ（10-17に一度外したが戻した）。D1のSSRデータ（`ssr_units_master`332件・`unit_work_map`のrarity_code=2）・`images/ssr/`・`worker.js`のSSR対応は使用中＝**削除しない**。中止のまま残るのは㊶段階B（SSR登録ツール`ssr-tool.html`）だけ
- **73 ESPの本番確認**（73の8章13番：トップの件数・ユニット／サポートチェッカーの表示と登録・カードの表示）。確認事項2〜5（㉝の扱い・予備ファイル・エタロ新ステージ・キャッシュ5分）の回答待ち
- 次にどのテーマに着手するかは、セッション冒頭でユーザーに確認する

## 作業上の注意
- 日本語で応答する
- ファイル削除は必ずユーザーに確認してから（`git rm`も同じ）
- commit・pushはユーザーの指示・承認に従う。D1の適用が要る変更は、適用の連絡を待ってからpushする
- このファイルは改行コードCRLF
- `.claude/worktrees/data-notice/`（ブランチ`worktree-data-notice`）は**古新聞・参照不要**（2026-09-22の注記追加1件。`main`未反映・内容も㉘以降は古い。コミットはGitHubにある）。2026-10-01のフォルダ移動で作業ツリーのリンクが切れ`git worktree list`でprunable表示になるが、修正不要。片付けるなら`git worktree prune`→フォルダ削除（削除はユーザー確認のうえ）
