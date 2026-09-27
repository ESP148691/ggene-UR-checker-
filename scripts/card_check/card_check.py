"""自己紹介カードの回帰チェック（㉚）。
使い方（checker/ で）:
  node scripts/card_check/server.mjs . 8787 &          # worker.jsをNode＋node:sqliteで起動（migrations/を順に適用し、seed.sqlを投入）
  python3 scripts/card_check/card_check.py 8787 out/    # 3テンプレート×3背景＋表示オプション違いを描画してチェック
前提: Python3＋playwright（Chromium）＋Pillow、フォント確認用に fonttools とシステムの Noto Sans CJK（無ければ5を省略）。
画像は checker/images/ のものを使う（server.mjs が静的配信）。
チェック内容:
  1. 9通り（標準・エタロ攻略・推しユニット × 宇宙・地球・空中）と、推しユニットのメモ表示ON・入手記録OFFを描画し、PNGを out/ に保存
  2. JSエラー（pageerror・console.error。画像の404は除く）が無い
  3. カードに描いた文字の最小サイズ：論理12px未満は例外リスト（エタロのバナー内チップ・凡例）だけ
  4. フッター文字（@アカウント・ハッシュタグ）の背景とのコントラスト比 4.5 以上
  5. 初回プレビューがWebフォント（Noto Sans JP）の読み込み後に描かれている（フォントを遅延配信して確認）
  6. 機体名の折り返しで、2行目が2文字以下の「泣き別れ」が無い（ur-units.jsの全84機・3種類の幅）
out/ のPNGは docs/04_自己紹介カード/画像/ の最新モックと目で見比べる。
"""
import sys, os, re, json, asyncio, base64, io, tempfile
from playwright.async_api import async_playwright
from PIL import Image

PORT = sys.argv[1] if len(sys.argv) > 1 else "8787"
OUT = sys.argv[2] if len(sys.argv) > 2 else "card_check_out"
HERE = os.path.dirname(os.path.abspath(__file__))
# Noto Sans JP の代わりに配信するフォント（NotoJP-Regular.otf / NotoJP-Bold.otf）。無ければ make_fonts() が
# システムの Noto Sans CJK（/usr/share/fonts/opentype/noto/）から一時フォルダに作る。リポジトリには置かない（約33MB）
FONT_DIR = os.environ.get("CARD_CHECK_FONT_DIR") or os.path.join(tempfile.gettempdir(), "card_check_fonts")
os.makedirs(OUT, exist_ok=True)
BASE = f"http://localhost:{PORT}"
# 12px未満を許す文字（エタロ攻略のバナー内チップは幅に合わせて7.5〜10px、30マス目の凡例は10〜11px）
SMALL_OK = {"開発縛り", "生存10機", "称号獲得", "SR縛り", "ミッション", "全ミッション達成", "ステージクリア", "未クリア", "達成", "称号達成", "未達成"}
SMALL_OK_RE = re.compile(r".+縛り$")

def make_fonts():
    if all(os.path.exists(os.path.join(FONT_DIR, f"NotoJP-{w}.otf")) for w in ("Regular", "Bold")): return True
    try:
        from fontTools.ttLib import TTCollection
        os.makedirs(FONT_DIR, exist_ok=True)
        for w in ("Regular", "Bold"):
            c = TTCollection(f"/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc")
            f = next(f for f in c.fonts if "JP" in f["name"].getDebugName(1))
            f.save(os.path.join(FONT_DIR, f"NotoJP-{w}.otf"))
        return True
    except Exception as e:
        print("フォントを用意できないため、フォント読み込みのチェック（5）を省略:", e); return False

FONTCSS = """@font-face{font-family:'Noto Sans JP';font-weight:400;src:url(/__font/NotoJP-Regular.otf) format('opentype');}
@font-face{font-family:'Noto Sans JP';font-weight:700;src:url(/__font/NotoJP-Bold.otf) format('opentype');}"""
RECORDER = """(()=>{ window.__texts=[]; const P=CanvasRenderingContext2D.prototype, f=P.fillText;
  P.fillText=function(t,...a){ if(window.__rec) window.__texts.push([String(t),this.font]); return f.call(this,t,...a); };
  let v=0; Object.defineProperty(window,'__previewRendered',{get(){return v},set(x){v=x; const ok=document.fonts.check('700 16px "Noto Sans JP"','ガンダム'); window.__chkLast=ok; if(x===1){ window.__chk1=ok; window.__t1=performance.now(); }}}); })()"""

def lum(rgb):
    def c(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb; return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def footer_contrast(img, box):
    """box内の画素を明暗2群に分け、明るい側（文字）と暗い側（背景）の平均色のコントラスト比"""
    raw = img.crop(box).convert("RGB").tobytes(); px = [tuple(raw[i:i+3]) for i in range(0, len(raw), 3)]; px.sort(key=lum)
    n = len(px); dark = px[: n * 6 // 10]; light = px[-max(1, n // 25):]
    avg = lambda a: tuple(sum(p[i] for p in a) / len(a) for i in range(3))
    return contrast(avg(light), avg(dark))

async def main():
    fonts_ok = make_fonts()
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1100, "height": 900})
        await ctx.add_cookies([{"name": "session", "value": "tok", "url": BASE}])
        await ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(body=FONTCSS, content_type="text/css") if fonts_ok else r.abort())
        await ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        async def lf(route):
            await asyncio.sleep(0.8)   # フォントを遅らせて配信（5のチェック）
            n = route.request.url.split("/__font/")[1]
            await route.fulfill(body=open(os.path.join(FONT_DIR, n), "rb").read(), content_type="font/otf")
        await ctx.route("**/__font/**", lf)
        await ctx.add_init_script(RECORDER)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
        await page.goto(BASE + "/profile-card.html")
        await page.wait_for_selector("#contentView:not([hidden])", timeout=30000)
        await page.wait_for_function("window.__previewRendered>=1", timeout=60000)
        if fonts_ok and not await page.evaluate("window.__chk1"):
            # 待ち時間の上限（5秒）を超えた場合は代替フォントで描き、フォントが届いた時点で描き直す仕様。
            # テスト用フォントは約16MBと大きく、初回は5秒を超えることがあるため、その場合は描き直しを確認する
            t1 = await page.evaluate("window.__t1")
            try: await page.wait_for_function("window.__previewRendered>=2 && window.__chkLast", timeout=15000); redrawn = True
            except Exception: redrawn = False
            if not (t1 >= 4900 and redrawn):
                fails.append(f"5: 初回プレビューがWebフォントの読み込み前に描かれた（{t1:.0f}ms、描き直し{'あり' if redrawn else 'なし'}）")

        async def shot(name):
            await page.evaluate("window.__texts=[]; window.__rec=true")
            await page.click("#btnSave"); await page.wait_for_selector("#previewModal.show", timeout=60000)
            src = await page.get_attribute("#previewImg", "src"); await page.click("#btnClosePreview")
            texts = await page.evaluate("window.__rec=false; window.__texts")
            data = base64.b64decode(src.split(",", 1)[1]); open(f"{OUT}/{name}.png", "wb").write(data)
            img = Image.open(io.BytesIO(data)); sc = img.width / 1200
            small = sorted({(t, fnt) for t, fnt in texts if (m := re.search(r"([\d.]+)px", fnt)) and float(m.group(1)) < 12
                            and t.strip() and t not in SMALL_OK and not SMALL_OK_RE.match(t)})
            if small: fails.append(f"3: {name} 12px未満の文字 {small[:6]}")
            for label, box in [("右下", (900, 640, 1164, 662)), ("左下", (36, 640, 180, 662))]:
                cr = footer_contrast(img, tuple(int(v * sc) for v in box))
                if cr < 4.5: fails.append(f"4: {name} フッター{label}のコントラスト {cr:.2f}")
            return len(data)

        sizes = {}
        # 表示オプションを既定（入手日・ガシャ回数＝表示、メモ＝非表示）に揃える（「画像で保存」はプロフィールも保存するため、前回の実行の状態が残っている場合がある）
        if await page.query_selector("#optAcq"):
            if not await page.is_checked("#optAcq"): await page.click("#optAcq")
            if await page.is_checked("#optMemo"): await page.click("#optMemo")
        for t in ["standard", "eternal", "units"]:
            for th in ["galaxy", "earth", "sky"]:
                await page.click(f'#tplButtons button[data-tpl="{t}"]'); await page.click(f'#themeButtons button[data-theme="{th}"]')
                sizes[f"{t}_{th}"] = await shot(f"{t}_{th}")
        # 表示オプション：メモON／入手記録すべてOFF
        await page.click('#tplButtons button[data-tpl="units"]'); await page.click('#themeButtons button[data-theme="galaxy"]')
        if await page.query_selector("#optMemo") is None:
            fails.append("E3: 入手記録の表示オプション（#optAcq・#optMemo）が無い")
        else:
            if not await page.is_checked("#optMemo"): await page.click("#optMemo")
            sizes["units_galaxy_memo"] = await shot("units_galaxy_memo")
            await page.click("#optMemo"); await page.click("#optAcq")
            sizes["units_galaxy_noacq"] = await shot("units_galaxy_noacq")
            await page.click("#optAcq")
        # 6. 機体名の泣き別れ
        wraps = await page.evaluate("""()=>{ if(!CardRenderer.wrapName) return ['wrapName未実装']; const c=document.createElement('canvas').getContext('2d'), F="'Noto Sans JP',sans-serif", bad=[];
          for(const u of window.UR_UNITS) for(const [w,b] of [[294,21],[139,15],[295,16]]){
            const r=CardRenderer.wrapName(c,u.name,w,s=>`bold ${s}px ${F}`,b,u.id);
            if(r.lines.length===2 && [...r.lines[1].replace('…','')].length<=2) bad.push(u.name+' → '+r.lines.join(' / ')); }
          return bad; }""")
        if wraps: fails.append(f"6: 泣き別れ {wraps}")
        if errs: fails.append(f"2: JSエラー {errs[:5]}")
        await b.close()
    print("画像サイズ(byte):", json.dumps(sizes, ensure_ascii=False))
    print("結果:", "すべて成功" if not fails else "失敗あり")
    for f in fails: print("  NG", f)
    sys.exit(1 if fails else 0)

asyncio.run(main())
