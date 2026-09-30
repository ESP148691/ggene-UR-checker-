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
- 認証はユーザー名＋パスワードのみ（メール不要・個人情報を持たない）。**パスワードは平文で保存**（ユーザーが選択。列名は`password`）。セッションはHttpOnly Cookie（`Secure; SameSite=Lax`・30日・`sessions`TBL）
- ゲストの所持データは保存しない（`usage_counters`に匿名の利用回数だけ）。ゲスト時代のデータをアカウントへ引き継ぐ機能は作らない（ユーザー確認済み）
- コスト：Workers Paid（月5ドル）の枠内。上限超過は停止ではなく従量課金
- 所持率などの母数は「その機能でデータ登録済みのユーザー」（`users.*_first_registered_at IS NOT NULL`）。分子も同条件で`COUNT(DISTINCT user_uid)`

## インフラと運用
- GitHub → Cloudflare Workers 自動デプロイ（`main`へpushすると公開）
  - 本番：`https://ggene-ur-checker.polarbear14869.workers.dev/`
  - GitHub：`https://github.com/ESP148691/ggene-UR-checker-`
  - Cloudflare：`https://dash.cloudflare.com/d78525314dd74181c2dc4fea74c8844a/workers/services/view/ggene-ur-checker/production`
- `wrangler.jsonc`：プロジェクト`ggene-ur-checker`、assets=`./`、D1バインディング`DB`（`ggene-ur-checker-db`）、定期実行`0 19 * * *`（JST 4:00）、運営者`vars.ADMIN_USERNAMES`（カンマ区切り・大文字小文字を区別。**現在`ESP`**。増やすときはここに追記してpush＝トップの運営者欄・運営者ページ・`/api/admin/*`が連動）
- **この開発PCにはwrangler・Nodeが無い**。D1へのSQL適用は**ユーザーがCloudflareダッシュボード（D1 > Console）で手動実行**する。コード側は「どのSQLをどの順で流すか」を案内する
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
| `eternal-road.html` | エタロ攻略チェッカー（EXPERT・29ステージ・69ミッション） |
| `challenge.html` | チャレンジミッションチェッカー（HARDのみ・5シリーズ・15ステージ・30ミッション。㊵）。**運営者専用で本番稼働中**（`adminGate()`。push・D1適用済み。一般公開は後日） |
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
| 次の空き | ㊶タグ・SSRマスター3本＝0023〜0025 | ― |

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
   - ㊶（0023〜）の適用前：`INSERT OR REPLACE INTO unit_work_map (unit_id, work_id) VALUES (…, …);`
   - **㊶の適用後**：`INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, …, …);`（旧い形は`NOT NULL constraint failed`で止まる）
6. **URユニットのみ：スクショ読み取りの位置合わせ値`SCAN_FIT`を`unit-scan.js`に追加**。無いと自動判定されない（「判定できなかったカード」に入る）。運営者がそのユニットの写ったスクショで`/unit?scandebug=1`を開いて読み取り、手動で割り当て → 画面下の「学習した位置合わせ値」のJSONの該当IDを追記。2026-09-30時点で87機中69機にあり
7. **URサポートのみ：`supporter-scan.js`の`SCAN_FIT`を追加**。手順は同じで`/supporter?scandebug=1`（「強化 > サポーター」一覧のスクショ）。50体中31体にあり
8. ㊶の適用後は、タグを`units_tags`へ入れ、㊳詳細設計5章の確認SQLを流す（タグ付けの運用が始まってから）

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
| ㉟A・㊹ | 10-01 | 自己紹介カード一般公開（adminGate解除・導線表示。運営者向け試用版`profile-card-trial.html`を残す。0019適用済み）。㊹：トップの導線アイコンを試作カード縮小画像（`images/profile-card/{standard,units,eternal}.jpg`。カードのデザインを大きく変えたら`docs/04_自己紹介カード/データ/㊹カードアイコン生成.py`で作り直す）に差し替え。本番確認（依頼書4章A-4・㊹8章）が残り |

## 未完了・次にやること（2026-09-30 08:30時点・Coworkが進捗を反映）
- **㊵チャレンジ**：実装・push・D1（0020・0021）適用済み（2026-09-30ユーザー確認）。運営者専用で稼働中。**一般公開は後日**（ユーザー決定。公開時は上の「一般公開の手順」）。設計書9章の後回し（分析ページのタブ・カードへの掲載・タグ縛り）は未着手
- **㉟A 自己紹介カード一般公開・㊹（2026-10-01）**：`main`へff merge・push済み。残り：依頼書4章A-4と㊹8章の本番確認（iOS Safariの画像保存を含む）。追加改修は運営者用の試用版`profile-card-trial.html`で試してから`profile-card.html`へ反映する（ユーザー決定）。切り戻しは㉟依頼書4章・㊹はcommitのrevert
- **㉟A 自己紹介カードの一般公開**：①ユーザーがD1に0019を適用（UPDATE文の1行だけを貼る）②運営者ページで最終確認 ③`git checkout main && git merge --ff-only release/profile-card-public && git push origin main` ④依頼書4章A-4のチェックリストで本番確認（iOS Safariの画像保存を含む）。切り戻しは依頼書どおり
- **㊸ 9/30新UR**：実装・D1(0022)適用・push済み（2026-09-30）。残り：依頼書8章の本番確認（特に#5データ登録→復元、#9カード）、`SCAN_FIT`の学習
- **㊶ユニットのタグ・SSRマスター**（`docs/01_所持チェッカー・DB登録/㊶…実装依頼書（㊳の実装）.md`）：段階A・Bが実装待ち
- **㉝ UR以外の推しユニット（ユーザー登録）**（`docs/04_自己紹介カード/㉝…実装依頼書.md`）：実装待ち。0018。㊶との順番の注意は㊶7章
- ⑪の残り：`migrations/0005`のD1適用、本番実機確認（通常ブラウザ／Xアプリ内ブラウザ×画像保存・Xシェア・データ登録）
- `SCAN_FIT`の学習：ユニット18機（新85〜87を含む）・サポート19体（新50を含む）。新3機・新サポートは写ったスクショで`?scandebug=1`から学習
- 本番・実機で未確認：iOS Safariでのエタロ画像（1640×3140）とカード画像（2400×1350）の保存、カードのフォント読み込み待ち、入手記録の表示
- 継続案（⑦⑨）：凸レベル別内訳、PCでのポップオーバー、タイル長押し比較、絞り込みの複数選択と保存、並べ替え切り替え
- 次にどのテーマに着手するかは、セッション冒頭でユーザーに確認する

## 作業上の注意
- 日本語で応答する
- ファイル削除は必ずユーザーに確認してから（`git rm`も同じ）
- commit・pushはユーザーの指示・承認に従う。D1の適用が要る変更は、適用の連絡を待ってからpushする
- このファイルは改行コードCRLF
- `.claude/worktrees/data-notice/`（ブランチ`worktree-data-notice`）は**古新聞・参照不要**（2026-09-22の注記追加1件。`main`未反映・内容も㉘以降は古い。コミットはGitHubにある）。2026-10-01のフォルダ移動で作業ツリーのリンクが切れ`git worktree list`でprunable表示になるが、修正不要。片付けるなら`git worktree prune`→フォルダ削除（削除はユーザー確認のうえ）
