# -*- coding: utf-8 -*-
"""
読みの検算（2026-11-19 牧村さんの発案・ソフィーの S-16）
  カードの音声（mp3）を Whisper で書き起こし、読ませた文と「音（発音のカタカナ）」で見比べて、
  ずれた所の一覧を JSON で標準出力に出す。作業台（server.js の /api/reading-check）が呼ぶ。

  使い方：python whisper_check.py --mp3 <mp3> --text <読ませた文の txt（UTF-8）> [--model small]
  要るもの：pip install faster-whisper fugashi unidic-lite
  限界：Whisper は聞いた音を漢字に直して書くので、漢字の別の読み（金沢柵をカナザワと読んだ、など）は拾いにくい。
"""
import argparse, difflib, json, re, sys, time

sys.stdout.reconfigure(encoding='utf-8')


def out(obj):
    print(json.dumps(obj, ensure_ascii=False))


# ---------------- 数の読み（作業台の public/reading.js の rdNum と同じ決まり。万・億まで） ----------------
DIG = ['', 'イチ', 'ニ', 'サン', 'ヨン', 'ゴ', 'ロク', 'ナナ', 'ハチ', 'キュウ']
HUN = ['', 'ヒャク', 'ニヒャク', 'サンビャク', 'ヨンヒャク', 'ゴヒャク', 'ロッピャク', 'ナナヒャク', 'ハッピャク', 'キュウヒャク']
THO = ['', 'セン', 'ニセン', 'サンゼン', 'ヨンセン', 'ゴセン', 'ロクセン', 'ナナセン', 'ハッセン', 'キュウセン']


def num4(n, before_nen=False):
    th, hu, te, on = n // 1000, n // 100 % 10, n // 10 % 10, n % 10
    s = THO[th] + HUN[hu]
    if te:
        s += ('' if te == 1 else DIG[te]) + 'ジュウ'
    if on:
        s += 'ヨ' if (before_nen and on == 4) else DIG[on]
    return s


def num_read(n, before_nen=False):
    if n == 0:
        return 'ゼロ'
    parts = []
    for unit, name in ((10 ** 8, 'オク'), (10 ** 4, 'マン')):
        if n >= unit:
            parts.append(num4(n // unit % 10000) + name)
            n %= unit
    if n:
        parts.append(num4(n, before_nen))
    return ''.join(parts)


def digits_to_kana(text):
    """数字（全角も・桁区切りのカンマも）をカタカナの読みに。返り値：(新しい文, 元の文の位置の表)"""
    text = text.translate(str.maketrans('０１２３４５６７８９，', '0123456789,'))
    res, idx, i = [], [], 0
    for m in re.finditer(r'\d{1,3}(?:,\d{3})+|\d+', text):
        res.append(text[i:m.start()]); idx.extend(range(i, m.start()))
        s = m.group().replace(',', '')
        nxt = text[m.end():m.end() + 1]
        if len(s) > 12 or (len(s) > 1 and s.startswith('0')):
            k = ''.join('ゼロ' if c == '0' else DIG[int(c)] for c in s)   # 電話番号のような並び
        else:
            k = num_read(int(s), before_nen=(nxt == '年'))
        res.append(k); idx.extend([m.start()] * len(k))
        i = m.end()
    res.append(text[i:]); idx.extend(range(i, len(text)))
    return ''.join(res), idx


# ---------------- 音（発音のカタカナ）にならす ----------------
_tagger = None


def tagger():
    global _tagger
    if _tagger is None:
        import fugashi
        _tagger = fugashi.Tagger()
    return _tagger


def hira2kata(s):
    return ''.join(chr(ord(c) + 0x60) if 'ぁ' <= c <= 'ゖ' else c for c in s)


O_ROW = set('オコソトノホモヨロゴゾドボポョォ')
U_ROW = set('ウクスツヌフムユルグズヅブプュゥ')
E_ROW = set('エケセテネヘメレゲゼデベペェ')
SAME = str.maketrans({'ヲ': 'オ', 'ヅ': 'ズ', 'ヂ': 'ジ', 'ヮ': 'ワ', 'ヵ': 'カ', 'ヶ': 'ケ'})


def flatten(k):
    """長音のゆれ（ジュウ／ジュー、エイ／エー）と、同じ音の字を、同じ形にそろえる"""
    k = k.translate(SAME)
    o = []
    for c in k:
        if c == 'ー':
            continue
        if o and ((c == 'ウ' and (o[-1] in O_ROW or o[-1] in U_ROW)) or (c == 'イ' and o[-1] in E_ROW)):
            continue
        o.append(c)
    return ''.join(o)


def to_sound(text):
    """文を音のカタカナの列にする。返り値：(音の文字列, 各文字の元の文での位置)"""
    t2, idx2 = digits_to_kana(text)
    sound, pos = [], []
    p = 0
    for w in tagger()(t2):
        surf = w.surface
        at = t2.find(surf, p)
        if at < 0:
            at = p
        p = at + len(surf)
        pron = None
        try:
            pron = w.feature.pron
        except Exception:
            pass
        if not pron or pron == '*':
            pron = hira2kata(surf)
        pron = hira2kata(pron)
        keep = ''.join(c for c in pron if ('ァ' <= c <= 'ヶ') or c == 'ー' or c.isalnum())
        keep = flatten(keep).upper()
        src = idx2[at] if at < len(idx2) else (idx2[-1] if idx2 else 0)
        for c in keep:
            sound.append(c); pos.append(src)
    return ''.join(sound), pos


# ---------------- 本体 ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mp3', required=True)
    ap.add_argument('--text', required=True)
    ap.add_argument('--model', default='small')
    a = ap.parse_args()
    try:
        from faster_whisper import WhisperModel
        import fugashi  # noqa: F401
    except ImportError as e:
        out({'ok': False, 'error': f'検算の道具が入っていません（{e.name}）。黒い画面で次を打ってください：python -m pip install faster-whisper fugashi unidic-lite'})
        return
    script = open(a.text, encoding='utf-8').read().replace('【間】', '　').strip()
    t0 = time.time()
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    segs, info = model.transcribe(a.mp3, language='ja', beam_size=5, word_timestamps=True, condition_on_previous_text=False)
    heard, times, segments = '', [], []
    for s in segs:
        segments.append({'start': round(s.start, 1), 'end': round(s.end, 1), 'text': s.text})
        for w in (s.words or []):
            heard += w.word
            times.extend([w.start] * len(w.word))
    a_snd, a_pos = to_sound(script)
    b_snd, b_pos = to_sound(heard)
    sm = difflib.SequenceMatcher(None, a_snd, b_snd, autojunk=False)
    ops = [o for o in sm.get_opcodes() if o[0] != 'equal']
    # 近いずれ（間が2音以下）は1件にまとめる
    merged = []
    for o in ops:
        if merged and o[1] - merged[-1][2] <= 2 and o[3] - merged[-1][4] <= 2:
            m = merged[-1]; merged[-1] = ('replace', m[1], o[2], m[3], o[4])
        else:
            merged.append(o)
    diffs = []
    for _, i1, i2, j1, j2 in merged:
        sa = a_pos[i1] if i1 < len(a_pos) else len(script)
        ea = (a_pos[i2 - 1] + 1) if i2 > i1 else sa
        sb = b_pos[j1] if j1 < len(b_pos) else len(heard)
        eb = (b_pos[j2 - 1] + 1) if j2 > j1 else sb
        # 見やすいよう、前後に少し文を足す
        ctx = lambda s, x, y, n=6: (s[max(0, x - n):x], s[x:max(y, x + 1)], s[max(y, x + 1):max(y, x + 1) + n])
        pa, ma, na = ctx(script, sa, ea)
        # 読ませた文がカタカナだけの所は数えない。VOICEPEAK はカタカナを書いたとおりに読むので、
        # ずれは Whisper が漢字で書いた（上杉→植杉 など）のを読み違えた空振り（2026-11-20 城攻め1で 99件中63件がこれ）
        if ma.strip() and re.fullmatch(r'[ァ-ヶー・\s、。（）「」]+', ma):
            continue
        pb, mb, nb = ctx(heard, sb, eb)
        at = times[min(sb, len(times) - 1)] if times else 0
        diffs.append({
            'at': round(max(0.0, at - 0.5), 1),
            'script': f'{pa}【{ma}】{na}', 'script_word': ma,
            'heard': f'{pb}【{mb}】{nb}', 'heard_word': mb,
            'said': a_snd[i1:i2], 'got': b_snd[j1:j2],
        })
    ratio = sm.ratio()
    out({'ok': True, 'model': a.model, 'seconds': round(time.time() - t0, 1), 'duration': round(info.duration, 1),
         'match': round(ratio, 3), 'heard': heard, 'segments': segments, 'diffs': diffs})


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        out({'ok': False, 'error': f'{type(e).__name__}: {e}'})
