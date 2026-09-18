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
- `top.html` — ログイン後トップページ（ルートURL `/`・`/index.html` で配信）。ログイン状態表示、機体版/サポート版への導線、今後のチェッカーのComing Soon表示
- `unit.html` — UR機体所持率チェッカー（82機収録）
- `supporter.html` — URサポート所持率チェッカー（48体収録）
- `auth.css` / `auth.js` — ログイン・新規登録UIの共通部品。`top.html`・`unit.html`・`supporter.html`から読み込む
- `worker.js` — Cloudflare Workers。認証API（`/api/register`・`/api/login`・`/api/logout`・`/api/me`）と所持データログ収集API（`/api/log`・`/api/log-supporter`、将来D1保存に変更予定）を処理し、それ以外は静的配信。ルートアクセス（`/`・`/index.html`）は`top.html`を直接配信（旧`/unit`への301リダイレクトは廃止）
- `wrangler.jsonc` — プロジェクト名 `ggene-ur-checker`、assetsのdirectoryは`./`、D1バインディング`DB`（`ggene-ur-checker-db`）設定済み
- `migrations/0001_add_user_auth.sql` — `users`テーブルへの`username`/`password`カラム追加、`sessions`テーブル新設。Cloudflareダッシュボード（D1 > Console）で手動適用済み
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

ID体系: マスターのIDはチェッカー画面上の「No.」（機体1〜82、サポート1〜48）と一致。既存IDは変動しない前提。
D1無料枠: 保存5GB（無期限）、1日500万行読み込み、1日10万行書き込み。

## 確定済みの設計方針（変更不可）
- **ログインは任意**。ログインなしでもチェッカーは従来通り使える（ゲスト利用を維持）。理由: Xからの流入で「すぐ使える」ことが拡散の原動力になっているため、入口に関門を作らない
- ログインの価値は「自己紹介カードの作成・保存」「端末をまたいだデータ引き継ぎ」に限定
- 認証はユーザー名＋パスワードのみ（メールアドレス不要、個人情報は保存しない）
- コスト方針: 完全無料運用を維持（Cloudflareは上限到達時に自動課金されず停止するため管理しやすい）

## 将来の全体像（ゴールイメージ）
1. ユーザー登録・ログイン機能
2. ログイン後トップページから各チェッカーへ
3. エタロ攻略チェッカー、称号獲得チェッカーを追加（今後）
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

### ③ ログイン後トップページ（完了）
- `top.html`を新設。ログイン状態表示（②のauth.js/auth.cssを再利用）、機体版/サポート版チェッカーへの導線カード、「エタロ攻略チェッカー」「称号獲得チェッカー」のComing Soon表示カードを配置
- `worker.js`でルートURL（`/`・`/index.html`）を`/unit`への301リダイレクトから`top.html`の直接配信に変更
- **注意（要フォロー）**: Xの固定ポストがルートURLをリンクしている場合、流入後の導線が「即チェッカー表示」から「トップページ経由（1タップ追加）」に変わる。従来通り0タップでチェッカーに到達させたい場合は、固定ポストのリンク先をルートURLから`/unit`に張り替える（X側の投稿編集のみで対応可、コード変更は不要）

### トップページ 銀河系デザイン 本実装（完了）
- Cowork側で検討・承認済みのデザイン提案（`design-proposal/galaxy-design-proposal.md`）とプロトタイプ（`design-proposal/top-galaxy-prototype.html`）を`top.html`に本実装した
- 背景：3層の星空パララックス（Canvas 2D）、手続き生成の渦巻銀河（エメラルドコア）、CSSネビュラ、流れ星、スキャンライン・ビネットを追加。外部ライブラリ（three.js等）は不使用
- チェッカー導線カードのアイコンにエメラルドのオーロラ後光、タイトルにシアン⇄ゴールドのグラデーションシマーを適用。実装済みチェッカー（機体/サポート）を主役として拡大、Coming Soon（ROUTE 03/04）は脇役として縮小
- アイコン画像は、プロトタイプのbase64埋め込み（各6枚）をやめ、`images/units/1.jpg`〜`82.jpg`／`images/supporters/1.jpg`〜`48.jpg`への相対パス参照＋全件からのランダム抽出に変更（5秒周期でフェード切替、タブ非アクティブ時停止、`prefers-reduced-motion`時は初期の1枚で固定）。サポート画像は`object-position:78% center`で右寄りトリミング
- `auth.css`/`auth.js`によるログイン状態表示は変更せず、新しい配色（`--panel-2`を追加）に馴染むようにしたのみ。ログイン任意・ゲスト利用維持の方針への影響なし
- 760px以上の広い画面では2カラム全幅レイアウト、760px未満は既存同様の1カラムを維持
- 動作確認：Playwright（Python版、Chromium）でスマホ幅（320px/390px）・デスクトップ幅（1024px）・`prefers-reduced-motion: reduce`の3パターンをヘッドレステスト。表示崩れ・コンソールエラーなしを確認（ローカル静的サーバーのため`/api/me`が404になるのは想定内で、auth.js側のゲスト表示フォールバックが正常に機能することも確認済み）
- 未対応（要相談）：`unit.html`/`supporter.html`への同じ背景演出の展開は本作業のスコープ外のまま

## 次にやること: ④ D1への所持データ保存
- `/api/log`・`/api/log-supporter`をconsole.logからD1（`units_ownership`・`supporters_ownership`テーブル）へのINSERTに変更
- ログイン時は②で発行した`user_uid`、ゲスト時は匿名UUIDを発行して記録する
- 実装後はゲスト利用・ログイン利用の両方でデータが正しく記録されることを確認する

## 作業上の注意
- ユーザーはシステム開発経験があるため、技術的な説明は詳しくして構わない
- ただしGitHub・Cloudflareの操作は不慣れなため、画面操作の手順は具体的に案内すること
- ファイルを作ったら必ず動作確認（Playwrightでのヘッドレステスト）を行ってから渡すこと
- 日本語で応答すること
- ファイル削除時は必ず確認することを原則とする
