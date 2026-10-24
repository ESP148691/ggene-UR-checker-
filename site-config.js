/* サイト共通の設定（83追加改修3・2026-10-24 ESP指示）。リンクやアカウント名を変えるときは、このファイルだけを直してpushする。
   読み込み：各ページの <head> で <script src="site-config.js"></script>（ページの CONFIG より先に読む）。
   各ページは window.SITE_CONFIG の値を使い、読めなかったときはページに書いた予備の値で動く。 */
window.SITE_CONFIG = Object.freeze({
  siteName: "Gジェネエターナル ファンツール",                                   // サイト名（X投稿用レポートの画像など）
  origin: "https://ggene-ur-checker.polarbear14869.workers.dev",               // サイトのドメイン（末尾の / なし）。各ページはこの後ろに自分のパスを足す
  xAccount: "polarbear148691",                                                 // Xアカウント名（@なし）。表示や画像では "@" + xAccount
  quotePostUrl: "https://x.com/polarbear148691/status/2111356542410965244?s=46", // ［Xでシェア］で引用するポスト
  baseHashtag: "ジージェネエターナル"                                           // 全ページ共通のハッシュタグ（# なし）
});
