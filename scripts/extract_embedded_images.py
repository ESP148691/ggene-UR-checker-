#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_embedded_images.py

HTMLファイル内にBase64で直接埋め込まれた画像を、外部の画像ファイルとして
書き出し、HTML側の参照を相対パスへ書き換えるためのスクリプト。

対象とする埋め込みパターンは2種類:

  1. ロゴ画像
       <img class="logo" src="data:image/png;base64,....">
     のような <img class="logo" ...> タグの src 属性。

  2. データ配列内の画像
       const UNITS = [{"id": 1, ..., "imageUrl": "data:image/jpeg;base64,...."}, ...];
     のように、JS の `const <配列名> = [ {...}, {...} ];` という形で埋め込まれた
     JSONライクな配列の中の、指定フィールド（既定は imageUrl）。

このスクリプトは「Gジェネエターナル UR/サポート所持率チェッカー」向けに書かれて
いるが、同じ埋め込み方式（ロゴ<img>＋ const 配列内の base64 画像）を使う限り、
今後追加予定の他のチェッカー（エタロ攻略チェッカー、称号獲得チェッカー等）にも
そのまま流用できる。

使い方:
    # 機体版（UNITS配列 + ロゴ）
    python scripts/extract_embedded_images.py index.html \\
        --array-name UNITS \\
        --out-dir images/units \\
        --logo-out images/logo.png

    # サポート版（同じロゴを再利用するので --skip-logo-write を付ける）
    python scripts/extract_embedded_images.py supporter.html \\
        --array-name UNITS \\
        --out-dir images/supporters \\
        --logo-out images/logo.png \\
        --skip-logo-write

すでに外部ファイル化済み（imageUrlがdata:で始まらない）の項目はスキップされる
ため、このスクリプトは何度実行しても安全（冪等）。

書き換え後のHTMLは既定では入力ファイルに上書きされる。--output で別ファイルに
書き出すことも可能（動作確認用）。
"""

import argparse
import base64
import json
import os
import re
import sys


# MIMEタイプ -> 拡張子
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}

DATA_URI_RE = re.compile(
    r'^data:(?P<mime>[a-zA-Z0-9.+/-]+);base64,(?P<b64>.+)$', re.DOTALL
)


def to_posix_rel_path(out_dir, filename, html_dir):
    """out_dir/filename を html_dir から見た相対パス（'/'区切り）に変換する。"""
    abs_target = os.path.normpath(os.path.join(out_dir, filename))
    rel = os.path.relpath(abs_target, start=os.path.normpath(html_dir))
    return rel.replace(os.sep, "/")


def decode_data_uri(data_uri):
    """data:...;base64,... 文字列から (mime, バイト列) を取り出す。埋め込みでなければ None。"""
    m = DATA_URI_RE.match(data_uri)
    if not m:
        return None
    mime = m.group("mime")
    raw = base64.b64decode(m.group("b64"))
    return mime, raw


def extract_logo(html, out_dir_for_logo, logo_out_path, skip_write):
    """<img class="logo" src="data:...;base64,...."> を探して外部ファイル化する。

    見つからなければ html をそのまま返す（変更なし）。
    """
    pattern = re.compile(
        r'(<img\b[^>]*\bclass="logo"[^>]*\bsrc=")'
        r'(data:[a-zA-Z0-9.+/-]+;base64,[^"]+)'
        r'(")',
        re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        print("  [logo] 埋め込みロゴが見つかりません（既に外部化済み、または対象なし）")
        return html, False

    decoded = decode_data_uri(match.group(2))
    if decoded is None:
        print("  [logo] src が data URI ではありません。スキップします。")
        return html, False

    mime, raw = decoded
    ext = MIME_TO_EXT.get(mime, os.path.splitext(logo_out_path)[1] or ".bin")
    logo_path = logo_out_path
    if not os.path.splitext(logo_path)[1]:
        logo_path += ext

    if not skip_write:
        os.makedirs(os.path.dirname(logo_path) or ".", exist_ok=True)
        with open(logo_path, "wb") as f:
            f.write(raw)
        print(f"  [logo] {len(raw):,} bytes -> {logo_path}")
    else:
        print(f"  [logo] 書き出しはスキップ（既存の {logo_path} を参照）")

    rel_path = to_posix_rel_path(
        os.path.dirname(logo_path) or ".", os.path.basename(logo_path), out_dir_for_logo
    )
    new_html = html[: match.start()] + match.group(1) + rel_path + match.group(3) + html[match.end() :]
    return new_html, True


def extract_array_images(html, array_name, id_field, image_field, out_dir, html_dir):
    """const <array_name> = [...]; を探して、image_field の base64 を外部化する。"""
    pattern = re.compile(
        r"const\s+" + re.escape(array_name) + r"\s*=\s*(\[.*?\]);", re.DOTALL
    )
    match = pattern.search(html)
    if not match:
        print(f"  [{array_name}] 配列が見つかりません。--array-name を確認してください。")
        return html, 0, 0

    array_text = match.group(1)
    try:
        data = json.loads(array_text)
    except json.JSONDecodeError as e:
        print(f"  [{array_name}] JSONとして解析できませんでした: {e}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    extracted = 0
    skipped = 0
    for item in data:
        image_value = item.get(image_field, "")
        if not isinstance(image_value, str) or not image_value.startswith("data:"):
            skipped += 1
            continue

        decoded = decode_data_uri(image_value)
        if decoded is None:
            skipped += 1
            continue

        mime, raw = decoded
        ext = MIME_TO_EXT.get(mime, ".bin")
        item_id = item.get(id_field)
        filename = f"{item_id}{ext}"
        out_path = os.path.join(out_dir, filename)
        with open(out_path, "wb") as f:
            f.write(raw)

        item[image_field] = to_posix_rel_path(out_dir, filename, html_dir)
        extracted += 1

    new_array_text = json.dumps(data, ensure_ascii=False)
    new_html = html[: match.start(1)] + new_array_text + html[match.end(1) :]
    return new_html, extracted, skipped


def main():
    parser = argparse.ArgumentParser(
        description="HTMLに埋め込まれたBase64画像を外部ファイルへ抽出する。"
    )
    parser.add_argument("html_file", help="対象のHTMLファイルパス")
    parser.add_argument(
        "--array-name",
        default="UNITS",
        help="データ配列のJS変数名（既定: UNITS）",
    )
    parser.add_argument(
        "--id-field", default="id", help="ファイル名に使うIDフィールド名（既定: id）"
    )
    parser.add_argument(
        "--image-field",
        default="imageUrl",
        help="画像データが入っているフィールド名（既定: imageUrl）",
    )
    parser.add_argument(
        "--out-dir",
        required=True,
        help="配列内の画像を書き出すディレクトリ（HTMLファイルからの相対パスで指定）",
    )
    parser.add_argument(
        "--logo-out",
        default=None,
        help="ロゴ画像の書き出し先パス（HTMLファイルからの相対パスで指定）。"
        "省略時はロゴの抽出を行わない。",
    )
    parser.add_argument(
        "--skip-logo-write",
        action="store_true",
        help="ロゴのファイル書き出しはせず、HTML内のsrc参照のみ --logo-out のパスに置き換える"
        "（複数HTMLで同じロゴを共有する場合の2回目以降に使用）",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="書き換え後HTMLの出力先（省略時は入力ファイルに上書き）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ファイルを一切書き込まず、抽出件数だけ確認する",
    )
    args = parser.parse_args()

    html_dir = os.path.dirname(os.path.abspath(args.html_file)) or "."

    with open(args.html_file, "r", encoding="utf-8") as f:
        html = f.read()

    original_size = len(html.encode("utf-8"))
    print(f"=== {args.html_file} ===")

    if args.dry_run:
        print("(dry-run: ファイルの書き込みは行いません)")

    out_dir_abs = os.path.join(html_dir, args.out_dir)

    if args.logo_out and not args.dry_run:
        logo_out_abs = os.path.join(html_dir, args.logo_out)
        html, _ = extract_logo(
            html,
            out_dir_for_logo=html_dir,
            logo_out_path=logo_out_abs,
            skip_write=args.skip_logo_write,
        )
    elif args.logo_out and args.dry_run:
        print("  [logo] dry-runのため処理をスキップ")

    if not args.dry_run:
        html, extracted, skipped = extract_array_images(
            html,
            array_name=args.array_name,
            id_field=args.id_field,
            image_field=args.image_field,
            out_dir=out_dir_abs,
            html_dir=html_dir,
        )
        print(f"  [{args.array_name}] 抽出: {extracted} 件 / スキップ(既に外部化済み等): {skipped} 件")

        output_path = args.output if args.output else args.html_file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

        new_size = len(html.encode("utf-8"))
        saved = original_size - new_size
        print(
            f"  HTMLサイズ: {original_size:,} bytes -> {new_size:,} bytes "
            f"({saved:,} bytes 削減, {saved / original_size * 100:.1f}%)"
        )
        print(f"  出力: {output_path}")
    else:
        print("  dry-run: 実際の抽出・書き込みは行っていません")


if __name__ == "__main__":
    main()
