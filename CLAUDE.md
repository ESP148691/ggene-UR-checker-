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
- **チェッカーはログイン必須**（2026-09-26・㉘で転換）。未ログインはログイン案内（ガード）のみ。トップの導線は未ログインでも表示し、ガードから登録へつなげる
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
| `top.html` | トップ（`/`で配信）。チェッカー欄（ユニット・サポート・エタロ）、ログイン会員限定欄（データ登録結果レポート・自己紹介カード`#profileCardNav`＝**hidden**）、運営者欄`#adminSection`（X投稿用レポート・自己紹介カード（試用）・チャレンジ）、ROUTE 04 Coming Soon。導線カードの登録状況バッジ`.regBadge`、アイコンのランダム表示（`UNIT_IMAGES`・`SUPPORTER_IMAGES`・`ETERNAL_ROAD_IMAGES`・`data-pool`） |
| `unit.html` | URユニット所持率チェッカー（87機）。スクショ読み取り（`unit-scan.js`）・入手記録（入手日・ガシャ回数・メモ）つき。データ本体は`ur-units.js` |
| `ur-units.js` | URユニットの画面側マスター（`window.UR_UNITS`。`id`・`name`・`limited`・`type`・`imageUrl`・`released`（必須）・`wrap`（任意））。`unit.html`・`profile-card.html`が読む。**無いとユニットチェッカーが空になる**。実装日`released`はD1には無く、ここが正本 |
| `supporter.html` | URサポート所持率チェッカー（50体。データは`const UNITS`）。スクショ読み取り（`supporter-scan.js`）つき。**改行コードCRLF**（CRLFのまま編集） |
| `unit-scan.js` / `supporter-scan.js` | スクショ読み取りの判定（`window.UnitScan`／`SupporterScan`、位置合わせ値`SCAN_FIT`） |
| `analytics.html` | データ登録結果レポート（ログイン限定。ユニット・サポートのティアリスト＋エタロ攻略タブ） |
| `analytics-admin.html` | 運営者向け分析（**運営者専用・恒久**＝ESPのみ。`adminGate()`。推し統計・所持率分布。64。API`/api/analytics/oshi`・`/distribution`も`requireAdmin`。一般公開しない） |
| `eternal-road.html` | エタロ攻略チェッカー（EXPERT・29ステージ・69ミッション） |
| `challenge.html` | チャレンジミッションチェッカー（HARDのみ・5シリーズ・15ステージ・30ミッション。㊵）。**一般公開済み**（2026-10-06。adminGate解除・トップの「チェッカー」欄へ移動） |
| `profile-card.html` | 自己紹介カード（テンプレート3×背景3の16:9 Canvas。描画は`CardRenderer`）。**運営者専用で試用中**（`adminGate()`）。一般公開の変更はブランチ`release/profile-card-public`に準備済み |
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
- FK宣言はあるが、アプリ側でもID範囲・集合を検証する（`MAX_UNIT_ID`・`MAX_SUPPORTER_ID`・`WORK_IDS`など）

### マイグレーションの状況

| 番号 | 内容 | D1 |
|---|---|---|
| 0001〜0004 | 認証・マスター投入・ゲストデータ削除・利用回数 | 適用済み |
| 0005 | 所持の`registered_at`をJSTへ一括変換（冪等） | **未適用**（⑪から残） |
| 0006 | 登録済みフラグ（ユニット・サポート） | 適用済み |
| 0007 | 重複行削除案 | **適用しない**（前提が誤りだった記録。⑬） |
| 0008〜0010 | エタロ | 適用済み |
| 0011〜0012 | 自己紹介カード・作品マスター | 適用済み |
| 0013〜0014 | 入手記録・定時分析 | 適用済み |
| 0015〜0017 | 作品区分・カード表示設定・名前の表記統一 | 適用済み |
| 0018 | ㉝ユーザー登録ユニット用に**予約**（未実装） | ― |
| 0019 | Gレコを宇宙世紀へ（UPDATE 1行） | **未適用**（㉟A） |
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
| 次の空き | 0036 | ― |

### D1マイグレーションのルール（過去の不具合から）
- **適用はD1が先、pushが後**。逆にすると新コードが未作成のTBL・列を読んで500や保存漏れになる（⑬のデプロイギャップ）。**バックフィルは必ず冪等に書き、間が空いたら再実行する**
- **`--`コメント行は入れない**（D1 Consoleにコピペで実行できないため。依頼書付属のSQLにコメントがあれば、本体はそのままでコメント行だけ削除して置く）
- `ALTER TABLE ADD COLUMN`は再実行すると`duplicate column`（＝適用済みの意味）。1回だけ実行するファイルはそう案内する
- 新コードは、未適用のTBL・列に当たっても既存機能が壊れないように`try/catch`で囲む（その機能だけ無効にする）
- 設計書のマイグレーション番号は仮。**実装時点の次の空き番号に振り直す**
- `/api/works`・`/api/challenge/master`は`Cache-Control: max-age=3600`。マスター変更後、最大1時間は古い内容が見えることがある

## 技術的な注意点（ハマりポイント）
- **`/`や公開URLに301/308を設定しない**。ブラウザ（特にXアプリ内）が永続キャッシュし、後から直しても届かない（⑧）。必要なら307/302
- **トップへのリンク・遷移先は`/top`**（`/`ではない。昔の301キャッシュを避けるため）。`isTopPage`は`/`・`/top`・`/top.html`を許容
- Cloudflareの静的配信は`/xxx.html`を`/xxx`へリダイレクトする。`location.pathname`で判定するときは両方を考える
- `ctx.filter`はSafariで効かないことがある → ピクセル操作で代替。`getImageData`/`putImageData`は`ctx.scale()`の影響を受けない
- 画像プレビューはdata URI（Blob URLは表示されない環境がある）。Canvasはネイティブ（html2canvas不使用＝iOS対応）
- `hidden`属性は、要素に`display`を指定するCSSがあると打ち消される → `.xxx[hidden]{display:none}`を明示
- ユーザー入力・DB由来の文字列は`textContent`かCanvasの`fillText`で出す（`innerHTML`に入れない）
- 送信は`fetch(..., {keepalive:true})`（Xシェアの`window.open`直後でも送り切るため）
- `restoreOwnershipFromServer()`は`data.registered`のときだけ上書きする（新規登録直後に端末の状態を消さない。㉘）
- **同じものを複数か所に持っている箇所**（変えるときは全部そろえる）
  - ミッションの短い表示名：`eternal-road.html`の`missionLabel()`・`profile-card.html`の`CardRenderer`内・`analytics.html`の`erMissionLabel()`
  - カードのテンプレート：`worker.js`の`CARD_TEMPLATES`と`profile-card*.html`の`TEMPLATE_LABEL`（`formation`＝推し編成、`characters`＝推しキャラ）
  - 搭乗キャラの補充規則：`worker.js`の`normalizePilots()`と`profile-card-trial.html`の`normalizeDraftPilots()`／`onUnitChanged()`（順番・規則を同じに保つ。依頼書57の4.3）
  - カード表示設定の既定値`CARD_OPTIONS_DEFAULT`（`{acq:true, memo:false}`）：`profile-card.html`と`worker.js`
  - 作品ID：`worker.js`の`WORK_IDS`・`works_master`・`images/series/`
  - ユニット件数：`ur-units.js`・`top.html`の`UNIT_IMAGES`・`worker.js`の`MAX_UNIT_ID`・D1（サポートも同様）

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

**URユニット（URサポートも同様）を追加するとき**
1. 画面側のデータに1件追加し、画像を`images/units/{id}.jpg`（`images/supporters/{id}.jpg`）に置く（既存IDは振り直さない）
   - URユニット：`ur-units.js`の`window.UR_UNITS`に1行。例：`{"id": 85, "name": "…", "limited": true, "type": "攻撃", "imageUrl": "images/units/85.jpg", "released": "YYYY-MM-DD"}`
     - **`released`（ゲーム内の実装日＝ガシャ初登場日・JST）は必須**。入手記録の欄を開いたときに入手日として記録され、カードでは常に「実装日」として表示する
     - `wrap`（任意）：カードで機体名を2行に折る位置を「|」で指定（例：`"インフィニット|ジャスティスガンダム"`）。「|」を除いて`name`と一字一句同じでないと無視される
   - URサポート：`supporter.html`の`const UNITS`に追加（**CRLFのまま**編集）
   - 名前は下の「名前の表記ルール」に従う。D1の`units_master.name`（`supporters_master.name`）と同じ文字列にする
2. `top.html`の`UNIT_IMAGES`（`SUPPORTER_IMAGES`）の件数を更新
3. `worker.js`の`MAX_UNIT_ID`（`MAX_SUPPORTER_ID`）を更新
4. D1の`units_master`（`supporters_master`）に1行追加（`migrations/0002`と同じ形式のINSERT。次の番号のマイグレーションとしても残す）
5. **URユニットのみ：`unit_work_map`に1行追加**。これが無いと自己紹介カードの推しユニット一覧・作品名に出ない
   - ㊶（0024）の適用前：`INSERT OR REPLACE INTO unit_work_map (unit_id, work_id) VALUES (…, …);`
   - **㊶の0024の適用後**：`INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, …, …);`（旧い形は`NOT NULL constraint failed`で止まる）
6. **URユニットのみ：スクショ読み取りの位置合わせ値`SCAN_FIT`を`unit-scan.js`に追加**。無いと自動判定されない（「判定できなかったカード」に入る）。運営者がそのユニットの写ったスクショで`/unit?scandebug=1`を開いて読み取り、手動で割り当て → 画面下の「学習した位置合わせ値」のJSONの該当IDを追記。2026-09-30時点で87機中69機にあり
7. **URサポートのみ：`supporter-scan.js`の`SCAN_FIT`を追加**。手順は同じで`/supporter?scandebug=1`（「強化 > サポーター」一覧のスクショ）。50体中31体にあり
8. ㊶・㊾の適用後：新URの**タグ**を`INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES (1, …, …, 'game', '…');`で入れる（運営者がゲーム内ユニット詳細の「タグ」欄で確認。**「シリーズ」欄の作品名はタグではない**）。新しいタグ名が出たら`tags_master`に次の`tag_id`（144〜）で追加。その後、㊳詳細設計5章の確認SQL（3本とも0件が正常）を流す

**URユニットのセットのキャラ（56）**：新URユニットを足したら、`characters_master`に1行（`char_id = unit_id`・`set_rarity_code = 1`・`set_unit_id = unit_id`・名前）と`images/characters/{id}.jpg`（150×150）を足す（次の番号のマイグレーションとして）。名前が分からないうちは入れなくてよい（搭乗キャラの補充規則で動く）。**新しいイベント配布キャラ**は`char_id`を1001番台の次の番号・`set_*`はNULL・`type`・`work_id`を入れる＋画像。`char_id`の範囲は`worker.js`の`CHAR_ID`のコメント（1〜999＝URセット、1001〜1999＝イベント配布、10001〜＝将来のSSRセット）。0034の再投入は`docs/04_自己紹介カード/データ/56_build_characters_sql.py <CSV>`で作る

**URサポーターを追加するとき（51）**：上の手順に加えて、`supporters_leader_rules`・`supporters_leader_targets`に行を足す（Coworkが攻略サイト・ゲーム内で対象を確認して下書き）。`docs/04_自己紹介カード/データ/51_シナジー判定_確認SQL.sql`の先頭3本で孤児0件を確認。新しいタグがリーダースキルの対象になるなら、`tags_master`に先に追加する

**作品（推し作品の選択肢）を追加するとき**：`works_master`（`INSERT OR REPLACE`）・`worker.js`の`WORK_IDS`・`images/series/{work_id}.png`の3点を必ずそろえる。`work_id`はゲーム内「シリーズ絞り込み」の並び順

**チャレンジの新シリーズ・ステージ・ミッション**：`challenge_series`・`challenge_stages`・`challenge_missions`にSQLを足すだけ（`worker.js`の変更は不要）。バナーは`images/challenge/{series_code}.jpg`

**名前の表記ルール（㉚・ユーザー決定）**
- **ユニット名・サポート名＝ゲーム内の表記**（運営の公式X・お知らせの表記）：括弧は**半角「()」**、Ζ・ΖΖは**半角英字「Z」「ZZ」**（例：`フルアーマーZZガンダム`・`キュベレイ(ZZ版)`）、つなぎは**半角「&」**
- **ゲーム内の名前の末尾に付く「(EX)」は付けない**（公式Xで「スサノオ(EX)」でも登録名は「スサノオ」）
- **作品名（`works_master`）＝アニメの公式タイトル**：「機動戦士Ζガンダム」「Ζ-MSV」のようにギリシャ文字「Ζ」
- 画面側（`ur-units.js`・`supporter.html`）とD1は同じ文字列にそろえる

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
| ⑪ | 09-22 | JST化・keepalive・「データ登録」ボタン・起動時のDB復元（0005は未適用） |
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
| 64 運営者向け分析（推し統計・所持率分布） | 10-10 | **ユーザー決定：今後も運営者専用（ESPのみ）**。。`worker.js`：`GET /api/analytics/oshi`・`GET /api/analytics/distribution?kind=`（どちらも`requireAdmin`。D1変更なし）、定数`OSHI_SLOT_POINTS`・`OSHI_RATE_MIN_OWNERS`。新ページ`analytics-admin.html`（`analytics.html`は無変更）、`top.html`運営者欄に導線。動画SQL`shorts/sql/export_oshi_data.sql`・`export_oshi_chars.sql`を63の定義にそろえ`score`列を追加。API検証はNode＋`node:sqlite`のハーネス（依頼書8章の1〜12・14の観点。無凸79機→90%以上を確認）、画面は320/390/1024px。一般公開の予定なし（公開するなら要再相談） |
| ㊼ | 10-03 | エタロ攻略にステージ30（機動戦士Vガンダム）を追加：全30ステージ・71ミッション（`eternal-road.html`の表記・合計、一括達成の確認文は`stages.length`参照に）、`images/eternal-road/30.jpg`・`icon/30.jpg`（`scripts/make_eternal_road_icons.py`更新）、`worker.js`、`top.html`、自己紹介カード`profile-card.html`・`profile-card-trial.html`のエタロ分母を30に、`migrations/0023_eternal_road_stage30.sql`（ミッション301・302）。0023はD1適用済み（2026-10-03ユーザー確認）。本番確認が残り |

## 未完了・次にやること（2026-09-30 08:30時点・Coworkが進捗を反映）
- **54 パスワードのハッシュ化**：段階A-1を実装・D1(0031)適用・push済み（2026-10-04）。残り：①運営者（ESP）の本番確認（依頼書7章3：ログアウト→ログイン→D1で`password_hash`確認→`account.html`で変更→テスト用アカウントで仮パスワード発行・ログイン・変更）②約1週間後に`admin-account.html`で「一括移行」（`remaining`が0になるまで）③**段階A-2**：`worker.js`の`KEEP_PLAINTEXT_PASSWORD = false`でpush→D1で`UPDATE users SET password = NULL WHERE password_hash IS NOT NULL;`＋確認SQL2本が0（依頼書7章）。A-2以降は、A-1より前のコードには戻せない。ER図の更新はCowork（`ggene-er-diagram`）
- **㊵チャレンジ**：実装・push・D1（0020・0021）適用済み（2026-09-30ユーザー確認）。運営者専用で稼働中。**一般公開は後日**（ユーザー決定。公開時は上の「一般公開の手順」）。設計書9章の後回し（分析ページのタブ・カードへの掲載・タグ縛り）は未着手
- **㉟A 自己紹介カード一般公開・㊹（2026-10-01夜に再公開）**：朝にいったん公開→ユーザー指示で夜公開に変更（非公開に戻した）→夜に再公開（revertのrevert）。残り：依頼書4章A-4と㊹8章の本番確認（iOS Safariの画像保存を含む）。追加改修は運営者用の試用版`profile-card-trial.html`で試してから`profile-card.html`へ反映（ユーザー決定）。切り戻しは㉟依頼書4章・㊹はcommitのrevert
- **㉟A 自己紹介カードの一般公開**：①ユーザーがD1に0019を適用（UPDATE文の1行だけを貼る）②運営者ページで最終確認 ③`git checkout main && git merge --ff-only release/profile-card-public && git push origin main` ④依頼書4章A-4のチェックリストで本番確認（iOS Safariの画像保存を含む）。切り戻しは依頼書どおり
- **㊸ 9/30新UR**：実装・D1(0022)適用・push済み（2026-09-30）。残り：依頼書8章の本番確認（特に#5データ登録→復元、#9カード）、`SCAN_FIT`の学習
- **㊶ユニットのタグ・SSRマスター**（`docs/01_所持チェッカー・DB登録/㊶…実装依頼書（㊳の実装）.md`）：段階A＋㊾のSQLを実装・D1適用（0024〜0028。2026-10-04にClaude Codeがwranglerで適用し確認SQLも期待値どおり）・push済み。本番確認（`/api/works`のユニット数・推しユニットの表示保存・`/api/tags`が129件）が残り。段階B（`ssr-tool.html`・`ssr-units.js`・`images/ssr/`・topの導線）・㊻C-1/C-2（SSRの推しユニット）は保留
- **㉝ UR以外の推しユニット（ユーザー登録）**（`docs/04_自己紹介カード/㉝…実装依頼書.md`）：実装待ち。0018。㊶との順番の注意は㊶7章
- ⑪の残り：`migrations/0005`のD1適用、本番実機確認（通常ブラウザ／Xアプリ内ブラウザ×画像保存・Xシェア・データ登録）
- `SCAN_FIT`の学習：ユニット18機（新85〜87を含む）・サポート19体（新50を含む）。新3機・新サポートは写ったスクショで`?scandebug=1`から学習
- 本番・実機で未確認：iOS Safariでのエタロ画像（1640×3140）とカード画像（2400×1350）の保存、カードのフォント読み込み待ち、入手記録の表示
- 継続案（⑦⑨）：凸レベル別内訳、PCでのポップオーバー、タイル長押し比較、絞り込みの複数選択と保存、並べ替え切り替え
- **51・52 推し編成・タグ傾向（53依頼書）**：段階1（D1・`worker.js`・試用版`profile-card-trial.html`）は実装済み（10-04）。追加改修（56と共通の10件・10-09）も試用版に反映済み。**段階2（本番`profile-card.html`への反映・`scripts/card_check/`追加）は運営者の試用確認後**。`scripts/card_check/seed.sql`の列数不整合（0024以降）も段階2で直す
- **55〜57 推しURキャラクター**：段階1は実装済み（10-09）。未確認14人も確定し91件版0034へ流し直し済み（10-10）。**段階2（本番`profile-card.html`への反映・`scripts/card_check/`追加）は運営者の試用確認後**（53の段階2と同時か後）。設計書（51・52・55〜57）への追加改修の反映はCowork側の作業として残っている
- 次にどのテーマに着手するかは、セッション冒頭でユーザーに確認する

## 作業上の注意
- 日本語で応答する
- ファイル削除は必ずユーザーに確認してから（`git rm`も同じ）
- commit・pushはユーザーの指示・承認に従う。D1の適用が要る変更は、適用の連絡を待ってからpushする
- このファイルは改行コードCRLF
- `.claude/worktrees/data-notice/`（ブランチ`worktree-data-notice`）は**古新聞・参照不要**（2026-09-22の注記追加1件。`main`未反映・内容も㉘以降は古い。コミットはGitHubにある）。2026-10-01のフォルダ移動で作業ツリーのリンクが切れ`git worktree list`でprunable表示になるが、修正不要。片付けるなら`git worktree prune`→フォルダ削除（削除はユーザー確認のうえ）
