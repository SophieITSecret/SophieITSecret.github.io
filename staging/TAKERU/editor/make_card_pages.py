# -*- coding: utf-8 -*-
"""カードごとの共有ページ（Xなどでカードの絵を出すため。X発信の依頼 1-6、2026-10-14）

  https://takeru.ms-forum.com/c/<コード>.html … og:title（カードの題）・og:description（問いの一文）・
      og:image（そのカードの絵を 1200×630 に整えたもの）・twitter:card=summary_large_image を持ち、
      開いた人はすぐ /?card=<コード>&src=x へ移る（アプリはJavaScriptで画面を作るので、Xの読み取り役は
      アプリのページからカードの中身を読めない。そのための小さな静的ページ）
  https://takeru.ms-forum.com/c/img/<コード>.jpg … そのカードの共有用の絵

  作るのは公開済み（7列目が1）の講座のカードだけ。自由研究・案内は作らない（?study= を使う）。
  非公開に戻したカードのページは消す。中身が同じなら書き直さない（git に余計な差分を出さない）。

  使い方：python editor/make_card_pages.py   （TAKERU のフォルダの上で。作業台の「🚀 本番公開」の前に）
"""
import csv, io, os, re, sys, html, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, 'TAKERUcard.csv')
OUT = os.path.join(ROOT, 'c')
IMG_OUT = os.path.join(OUT, 'img')
SITE = 'https://takeru.ms-forum.com'
FONT_B = r'C:\Windows\Fonts\YuGothB.ttc'
FONT_R = r'C:\Windows\Fonts\YuGothM.ttc'
W, H = 1200, 630


def first_question(body):
    """本文の最初の一文（「？」か「。」まで）。100字を超えるなら切る"""
    t = re.sub(r'\s+', ' ', body.strip().split('\n')[0]).strip()
    m = re.search(r'^.*?[？?。！]', t)
    s = m.group(0) if m else t
    return s if len(s) <= 100 else s[:99] + '…'


def wrap(draw, text, font, width):
    # 行頭に来てはいけない字（小さい仮名・句読点・閉じ括弧など）は、前の字と一緒に次の行へ送る
    NO_HEAD = '、。，．・：；？！」』）】〕〉》ーっゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ…—'
    lines, cur = [], ''
    for ch in text:
        if draw.textlength(cur + ch, font=font) > width:
            if ch in NO_HEAD and len(cur) > 1:
                lines.append(cur[:-1]); cur = cur[-1] + ch
            else:
                lines.append(cur); cur = ch
        else:
            cur += ch
    if cur: lines.append(cur)
    return lines


def make_image(src, title):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.open(src).convert('RGB')
    canvas = Image.new('RGB', (W, H), (13, 13, 26))
    # 左：カードの絵（高さに合わせる。横が広すぎれば中央で切る）
    lw = 840
    s = H / im.height
    pic = im.resize((max(1, round(im.width * s)), H), Image.LANCZOS)
    if pic.width > lw:
        x0 = (pic.width - lw) // 2
        pic = pic.crop((x0, 0, x0 + lw, H))
    canvas.paste(pic, (0, 0))
    # 右：TAKERU と題
    d = ImageDraw.Draw(canvas)
    x, rw = lw + 28, W - lw - 56
    d.rectangle((lw, 0, lw + 6, H), fill=(232, 160, 48))
    f_logo = ImageFont.truetype(FONT_B, 54)
    f_sub = ImageFont.truetype(FONT_R, 22)
    f_title = ImageFont.truetype(FONT_B, 34)
    d.text((x, 44), 'TAKERU', font=f_logo, fill=(255, 207, 138))
    d.text((x, 112), '軍事戦略ジュニアコース', font=f_sub, fill=(200, 211, 224))
    lines = wrap(d, title, f_title, rw)[:6]
    y = 190
    for ln in lines:
        d.text((x, y), ln, font=f_title, fill=(240, 244, 250)); y += 50
    d.text((x, H - 58), 'MSフォーラム', font=f_sub, fill=(138, 151, 166))
    buf = io.BytesIO()
    canvas.save(buf, 'JPEG', quality=82, optimize=True)
    return buf.getvalue()


def page_html(code, title, desc):
    t, dsc = html.escape(title), html.escape(desc)
    url = f'{SITE}/c/{code}.html'
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{t}｜TAKERU</title>
<!-- このページは editor/make_card_pages.py が作ります。手で直さないでください -->
<meta name="robots" content="noindex">
<meta name="description" content="{dsc}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="軍事戦略ジュニアコース TAKERU（一般社団法人ＭＳフォーラム）">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{dsc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/c/img/{code}.jpg">
<meta property="og:image:width" content="{W}">
<meta property="og:image:height" content="{H}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<script>
  // TAKERU のアプリでこのカードを開く。どこから来たか（src）はそのまま渡す。無ければ x（Xの投稿から）
  (function () {{
    var s = 'x';
    try {{ var q = new URLSearchParams(location.search).get('src'); if (q && /^[a-z0-9]{{1,12}}$/i.test(q)) s = q; }} catch (e) {{}}
    location.replace('/?card={code}&src=' + encodeURIComponent(s));
  }})();
</script>
<style>body{{background:#0d0d1a;color:#dde3f0;font-family:sans-serif;padding:24px;line-height:1.7}}a{{color:#ffcf8a}}</style>
</head>
<body>
<p>TAKERU のカード「{t}」を開きます。</p>
<p><a href="/?card={code}&amp;src=x">開かないときは、ここを押してください</a></p>
</body>
</html>
'''


def write_if_changed(path, data):
    if isinstance(data, str): data = data.encode('utf-8')
    if os.path.exists(path):
        with open(path, 'rb') as f:
            if f.read() == data: return False
    with open(path, 'wb') as f: f.write(data)
    return True


def main():
    rows = list(csv.reader(io.open(CSV, encoding='utf-8-sig')))
    os.makedirs(IMG_OUT, exist_ok=True)
    keep, made, changed, noimg = set(), 0, 0, []
    for r in rows[1:]:
        if len(r) < 7 or not r[0].strip(): continue
        code, title, body, subject, pub = r[0].strip(), r[3].strip().lstrip('→').strip(), r[4], r[5].strip(), r[6].strip()
        if pub != '1' or subject in ('自由研究', '案内') or not re.fullmatch(r'[A-Za-z0-9]{1,20}', code): continue
        src = next((p for p in (os.path.join(ROOT, 'images', code + e) for e in ('.jpg', '.png')) if os.path.exists(p)), None)
        if not src:
            noimg.append(code); continue
        keep.add(code)
        changed += write_if_changed(os.path.join(IMG_OUT, code + '.jpg'), make_image(src, title))
        changed += write_if_changed(os.path.join(OUT, code + '.html'), page_html(code, title, first_question(body)))
        made += 1
    # 非公開に戻したカード・消したカードのページは消す
    removed = 0
    for d, ext in ((OUT, '.html'), (IMG_OUT, '.jpg')):
        for fn in os.listdir(d):
            if fn.endswith(ext) and fn[:-len(ext)] not in keep:
                os.remove(os.path.join(d, fn)); removed += 1
    print(f'共有ページ {made}枚（書き直し {changed}・消した {removed}）。絵が無いので作らなかった公開カード：{", ".join(noimg) or "なし"}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
