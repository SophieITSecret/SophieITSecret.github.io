# ============================================================
# 宣伝用のQRコードを作る（作業台の「🔳 QR」から呼ばれる）
#   2種類を書き出す：QRだけ／下に説明の3行をつけたもの
#   使い方: python make_qr.py <住所> <出力フォルダ> <ファイル名の頭> <1行目> <2行目>
#   結果は JSON で1行だけ標準出力に出す（作業台が読む）
# ============================================================
import json
import os
import sys

try:
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    print(json.dumps({"ok": False, "error": "Python の qrcode / Pillow がありません: %s" % e}, ensure_ascii=False))
    sys.exit(0)

url, out_dir, base, line1, line2 = sys.argv[1:6]
os.makedirs(out_dir, exist_ok=True)

q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=4)
q.add_data(url)
q.make(fit=True)
img = q.make_image(fill_color="black", back_color="white").convert("RGB")
plain = os.path.join(out_dir, base + "（QRだけ）.png")
img.save(plain)

# 説明つき。日本語はメイリオの太字（Windows標準）。長い題は入るまで字を小さくする
FONT = "C:/Windows/Fonts/meiryob.ttc"
def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()

W, H = img.size
PAD = 70
canvas = Image.new("RGB", (W + PAD * 2, H + 240), "white")
canvas.paste(img, (PAD, 0))
d = ImageDraw.Draw(canvas)
CW = canvas.size[0]
y = H - 10
for text, size, color in [(line1, 40, "#1a3a72"), (line2, 36, "#14202e"),
                          ("スマホのカメラで読み取ると、すぐ開きます", 26, "#4a5a6c")]:
    f = font(size)
    while d.textlength(text, font=f) > CW - 40 and size > 18:
        size -= 2
        f = font(size)
    w = d.textlength(text, font=f)
    d.text(((CW - w) / 2, y), text, font=f, fill=color)
    y += size + 26
labeled = os.path.join(out_dir, base + "（説明つき）.png")
canvas.save(labeled)

print(json.dumps({"ok": True, "plain": plain, "labeled": labeled}, ensure_ascii=False))
