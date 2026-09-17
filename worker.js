export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 所持データのログ収集エンドポイント
    // ここでの console.log は Cloudflare の Workers Logs（Observability）に記録され、
    // ダッシュボード上で検索・閲覧できる（利用者のブラウザには一切表示されない）
    if (url.pathname === "/api/log" && request.method === "POST") {
      try {
        const body = await request.text();
        console.log(JSON.stringify({
          type: "ur_ownership_log",
          ts: new Date().toISOString(),
          body: body
        }));
      } catch (e) {
        console.error("log parse error", e);
      }
      return new Response("ok", { status: 200 });
    }

    // 旧ルートURL（機体チェッカーが index.html だった頃のURL）を
    // 新しい /unit へ301リダイレクト。Xで共有済みのリンクを維持するための措置。
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const dest = new URL("/unit", url);
      return Response.redirect(dest.toString(), 301);
    }

    // /unit を機体チェッカー本体（unit.html）にマッピング
    if (url.pathname === "/unit") {
      const assetUrl = new URL("/unit.html", url);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // それ以外は静的アセット（unit.html, supporter.html, images/等）をそのまま配信
    return env.ASSETS.fetch(request);
  }
};
