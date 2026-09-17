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
- `unit.html` — UR機体所持率チェッカー（82機収録）
- `supporter.html` — URサポート所持率チェッカー（48体収録）
- `worker.js` — Cloudflare Workers。`/api/log`・`/api/log-supporter`へのPOSTを受けログ出力（将来D1保存に変更予定）、それ以外は静的配信。ルートアクセスは`/unit`へ301リダイレクト
- `wrangler.jsonc` — プロジェクト名 `ggene-ur-checker`、assetsのdirectoryは`./`
- `images/`, `units/` — 外部化済みの画像アセット
- `scripts/extract_embedded_images.py` — base64埋め込み画像を外部ファイル化する汎用スクリプト（冪等・再実行安全）

**インフラ**: GitHub → Cloudflare Workers 自動デプロイ（このリポジトリにpushすると自動ビルド・公開）。
本番URL: `https://ggene-ur-checker.polarbear14869.workers.dev/`
GitHub: `https://github.com/ESP148691/ggene-ur-checker`
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
※ユーザーマスターにはユーザー名・パスワード用カラムの追加が未実施（②のスコープ）。
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
- `index.html` → `unit.html`にリネーム。`worker.js`で`/`・`/index.html`は`/unit`へ301リダイレクト、`/unit`はクリーンURLとして配信
- `wrangler.jsonc`の`name`を`ggene-ur-checker`に修正（旧`-retry`付きの誤ったproject名を修正）
- `unit.html`内`CONFIG.siteUrl`を`https://ggene-ur-checker.polarbear14869.workers.dev/unit`に修正

## 次にやること: ② ユーザー登録・ログイン機能

### 最重要方針: 既存の固定ポスト・ゲスト利用への影響ゼロで進めること
現在Xに固定しているポストから流入するユーザーは、ログイン機能実装後も**引き続きログイン不要でチェッカーを利用できる状態を維持する**。
- `/unit`・`/supporter.html`は未ログイン状態でも従来通り100%の機能が使えること。ログイン導線を追加する場合も既存のゲストフローを塞いだり必須化したりしない
- 実装・検証の過程で、既存の固定ポストのリンク（ルートURL→`/unit`）からの導線を壊していないか、Playwright等でログイン機能追加前後のゲスト動作を必ず回帰確認してから引き渡す
- ログインの価値は「自己紹介カードの作成・保存」「端末をまたいだデータ引き継ぎ」に限定し、チェッカー単体の利用体験には影響を与えない設計とする

### 実装着手前に確認すべきこと
1. **パスワードの扱い**: handover.mdでは「暗号化なし」と明記されているが、平文DB保存はセキュリティ上望ましくない。ハッシュ化（bcrypt等）を導入するか、方針通り平文運用にするか
2. **セッション管理方式**: Cookie vs localStorageトークン、有効期限をどうするか
3. **D1インスタンス情報**: 作成済みD1のdatabase_id・バインディング名（wrangler.jsoncへの追加に必要）

### タスク分解
- `users`テーブルへ`username`/`password_hash`カラム追加（マイグレーションSQL要作成）
- `POST /api/register`（重複チェック＋ハッシュ化して保存）, `POST /api/login`（検証＋セッショントークン発行）を`worker.js`に追加
- フロント側に登録・ログインフォームを追加（既存チェッカー画面には強制せず、任意導線として追加）
- 実装後はPlaywrightでの動作確認・headless testを実施してから引き渡す。あわせて「ゲスト利用に影響がないこと」の回帰確認も実施

### ③④（②実装後に着手、未着手）
- ③ ログイン後トップページ: ログイン状態判定、機体版/サポート版への導線、今後のチェッカーをComing Soon表示、ゲスト利用維持。ルートURL（`/`）の301リダイレクトをトップページ表示に置き換える
- ④ D1への所持データ保存: `/api/log`・`/api/log-supporter`をconsole.logからD1 INSERTに変更、`wrangler.jsonc`にD1バインディング追加、ログイン時は`user_uid`・ゲスト時は匿名UUID発行

## 作業上の注意
- ユーザーはシステム開発経験があるため、技術的な説明は詳しくして構わない
- ただしGitHub・Cloudflareの操作は不慣れなため、画面操作の手順は具体的に案内すること
- ファイルを作ったら必ず動作確認（Playwrightでのヘッドレステスト）を行ってから渡すこと
- 日本語で応答すること
- ファイル削除時は必ず確認することを原則とする
