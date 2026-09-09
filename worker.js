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

    // それ以外は静的アセット（index.html等）をそのまま配信
    return env.ASSETS.fetch(request);
  }
};
