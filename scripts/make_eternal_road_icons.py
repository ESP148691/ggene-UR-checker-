"""エタロのステージバナー（images/eternal-road/N.jpg、640x234）から、トップページ用の正方形アイコン
（images/eternal-road/icon/N.jpg、136x136）を切り抜く。

切り抜き範囲は横中央・上端の170x170（x 235〜405、y 0〜170）。ステージ名（y≈180〜225）と
左下の「EXPERT」ラベル（x≈10〜95）にかからない範囲として、全29枚を目視確認して決めた。
バナーを差し替え・追加したときに再実行する（上書き・冪等）。

実行: checker/ をカレントにして `python scripts/make_eternal_road_icons.py`（Playwright＋Chromiumが必要）
"""
import base64
import os
from playwright.sync_api import sync_playwright

SX, SY, SIZE, OUT = 235, 0, 170, 136  # 出力はトップの68px表示の2倍
STAGES = 29


def main():
    root = os.getcwd()
    os.makedirs("images/eternal-road/icon", exist_ok=True)

    def handle(route):
        path = route.request.url.split("://", 1)[1].split("/", 1)[1]
        fp = os.path.join(root, path)
        if os.path.isfile(fp):
            return route.fulfill(path=fp)
        return route.fulfill(status=200, content_type="text/html", body="<body></body>")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route("http://local/**", handle)
        page.goto("http://local/blank.html")
        for n in range(1, STAGES + 1):
            data = page.evaluate(
                """async ([n, sx, sy, size, o]) => {
                  const img = new Image(); img.src = `/images/eternal-road/${n}.jpg`; await img.decode();
                  const c = document.createElement('canvas'); c.width = o; c.height = o;
                  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, o, o);
                  return c.toDataURL('image/jpeg', 0.88);
                }""",
                [n, SX, SY, SIZE, OUT],
            )
            with open(f"images/eternal-road/icon/{n}.jpg", "wb") as f:
                f.write(base64.b64decode(data.split(",", 1)[1]))
        browser.close()
    print(f"{STAGES}枚を書き出しました")


if __name__ == "__main__":
    main()
