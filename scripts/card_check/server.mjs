// 自己紹介カードの回帰チェック用ハーネス（㉚ 2026-09-27 Cowork作成）
// worker.jsをNode（22.5以上。node:sqliteを使う）で動かし、D1をメモリ上のSQLiteで代替する。
//   使い方（checker/ で）: node scripts/card_check/server.mjs . 8787
//   - migrations/ を番号順に適用（0007は適用しない＝前提が誤りだった重複削除案）。SKIP_MIG=0016 のように指定すると、そのマイグレーションを飛ばす（未適用環境の確認用）
//   - 同じフォルダの seed.sql（テスト用ユーザー esp／セッション tok・所持データ・入手記録・エタロ・プロフィール）を投入
//   - ADMIN_USERNAMES=esp（profile-card.html は運営者専用の試用中のため）
//   - 本番のD1とは無関係。データはプロセス終了で消える
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL, fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(process.argv[2] || ".");
const PORT = Number(process.argv[3] || 8787);
const IMG = process.env.IMG_DIR || path.join(ROOT, "images");
const SKIP = (process.env.SKIP_MIG || "").split(",").filter(Boolean);

const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE users (user_uid TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
CREATE TABLE units_master (unit_id INTEGER PRIMARY KEY, name TEXT NOT NULL, limited INTEGER NOT NULL DEFAULT 0, type TEXT NOT NULL);
CREATE TABLE supporters_master (supporter_id INTEGER PRIMARY KEY, name TEXT NOT NULL, limited INTEGER NOT NULL DEFAULT 0, skill TEXT NOT NULL);
CREATE TABLE units_ownership (id INTEGER PRIMARY KEY AUTOINCREMENT, registered_at TEXT NOT NULL, user_uid TEXT NOT NULL, unit_id INTEGER NOT NULL, level INTEGER NOT NULL);
CREATE TABLE supporters_ownership (id INTEGER PRIMARY KEY AUTOINCREMENT, registered_at TEXT NOT NULL, user_uid TEXT NOT NULL, supporter_id INTEGER NOT NULL, level INTEGER NOT NULL);`);
for (const f of fs.readdirSync(path.join(ROOT, "migrations")).sort()) {
  if (SKIP.some(s => f.startsWith(s))) continue;
  if (f.startsWith("0007")) continue;
  try { db.exec(fs.readFileSync(path.join(ROOT, "migrations", f), "utf8")); }
  catch (e) { console.error("migration", f, e.message); }
}
// 検証用データ
const seedFile = path.join(HERE, "seed.sql");
const seed = fs.existsSync(seedFile) ? fs.readFileSync(seedFile, "utf8") : "";
if (seed) db.exec(seed);

const norm = v => v === undefined ? null : (typeof v === "boolean" ? (v ? 1 : 0) : v);
class Stmt {
  constructor(sql) { this.sql = sql; this.args = []; }
  bind(...a) { const s = new Stmt(this.sql); s.args = a.map(norm); return s; }
  _st() { return db.prepare(this.sql); }
  async first(col) { const r = this._st().get(...this.args); if (!r) return null; return col ? r[col] : { ...r }; }
  async all() { return { results: this._st().all(...this.args).map(r => ({ ...r })) }; }
  async run() { const i = this._st().run(...this.args); return { meta: { changes: i.changes, last_row_id: Number(i.lastInsertRowid) } }; }
}
const DB = {
  prepare: sql => new Stmt(sql),
  batch: async stmts => { db.exec("BEGIN"); try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } },
  exec: async sql => db.exec(sql)
};
globalThis.__db = db;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const ASSETS = { fetch: async req => {
  let p = decodeURIComponent(new URL(req.url).pathname);
  if (p === "/") p = "/top.html";
  let file = p.startsWith("/images/") && !fs.existsSync(path.join(ROOT, p)) ? path.join(IMG, p.slice(8)) : path.join(ROOT, p);
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" } });
} };
const env = { DB, ASSETS, ADMIN_USERNAMES: "esp" };
// worker.jsはESモジュールとして読み込むため、一時フォルダに.mjsとしてコピーする（リポジトリ内にファイルを作らない）
const tmpWorker = path.join(os.tmpdir(), `card_check_worker_${process.pid}.mjs`);
fs.copyFileSync(path.join(ROOT, "worker.js"), tmpWorker);
const worker = (await import(pathToFileURL(tmpWorker).href)).default;

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request("http://localhost:" + PORT + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  try {
    const r = await worker.fetch(request, env, { waitUntil() {} });
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log("listening", PORT, ROOT));
