#!/usr/bin/env python3
"""TAKERU 音声生成サーバー — localhost:5000"""
import os, subprocess, time, wave, shutil
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# ==================== 設定 ====================
VP_DIR      = r"C:\Program Files\VOICEPEAK"
VP_EXE      = os.path.join(VP_DIR, "voicepeak.exe")
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
VOICES_DIR  = os.path.join(BASE_DIR, "voices")
BACKUP_DIR  = os.path.join(BASE_DIR, "voices_backup")
TEMP_DIR    = os.path.join(BASE_DIR, "voices_temp")
# ==============================================

for d in [VOICES_DIR, BACKUP_DIR, TEMP_DIR]:
    os.makedirs(d, exist_ok=True)

app = Flask(__name__)
CORS(app)   # file:// から fetch できるよう CORS を許可


# ---------- WAV結合 ----------
def combine_wav(files, out_path):
    data = []
    for f in files:
        with wave.open(f, 'rb') as w:
            data.append((w.getparams(), w.readframes(w.getnframes())))
    with wave.open(out_path, 'wb') as out:
        out.setparams(data[0][0])
        for _, frames in data:
            out.writeframes(frames)


# ---------- WAV→MP3 ----------
def wav_to_mp3(wav_path, mp3_path):
    from pydub import AudioSegment
    audio = AudioSegment.from_wav(wav_path)
    audio = audio.set_channels(1)
    audio.export(mp3_path, format='mp3', bitrate='128k')


# ==================== エンドポイント ====================

@app.route('/narrators')
def get_narrators():
    """VOICEPEAKのナレーター一覧を返す"""
    try:
        r = subprocess.run(
            [VP_EXE, '--list-narrator'],
            cwd=VP_DIR, capture_output=True, text=True, timeout=10
        )
        if r.returncode == 0:
            narrators = [n.strip() for n in r.stdout.strip().splitlines() if n.strip()]
            return jsonify({'ok': True, 'narrators': narrators})
        return jsonify({'ok': False, 'error': r.stderr.strip()})
    except FileNotFoundError:
        return jsonify({'ok': False, 'error': f'VOICEPEAK が見つかりません: {VP_EXE}'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})


@app.route('/status/<code>')
def get_status(code):
    """MP3 の存在確認"""
    exists = os.path.exists(os.path.join(VOICES_DIR, f"{code}.mp3"))
    return jsonify({'exists': exists})


@app.route('/audio/<code>')
def get_audio(code):
    """MP3 をストリーム返却（ブラウザ再生用）"""
    mp3 = os.path.join(VOICES_DIR, f"{code}.mp3")
    if not os.path.exists(mp3):
        return jsonify({'error': 'not found'}), 404
    return send_file(mp3, mimetype='audio/mpeg')


@app.route('/generate', methods=['POST'])
def generate():
    """音声生成メイン処理"""
    d        = request.json or {}
    code     = (d.get('code')     or '').strip()
    text     = (d.get('text')     or '').strip()
    narrator = (d.get('narrator') or 'Japanese Female 1').strip()
    emotion  = (d.get('emotion')  or 'happy=40,fun=30')
    speed    = str(d.get('speed',  100))
    pitch    = str(d.get('pitch',  50))

    if not code or not text:
        return jsonify({'ok': False, 'error': 'code と text は必須です'}), 400

    mp3_path = os.path.join(VOICES_DIR, f"{code}.mp3")

    # 既存MP3 → バックアップ
    if os.path.exists(mp3_path):
        ts  = datetime.now().strftime('%Y%m%d_%H%M%S')
        bak = os.path.join(BACKUP_DIR, f"{code}_{ts}.mp3")
        shutil.copy2(mp3_path, bak)
        print(f"  バックアップ: {bak}")

    # 「。」で分割
    sentences = [s.strip() + '。' for s in text.split('。') if s.strip()]
    if not sentences:
        return jsonify({'ok': False, 'error': 'テキストが空です'}), 400

    print(f"[{code}] {len(sentences)}文 / narrator={narrator} speed={speed} pitch={pitch} emotion={emotion}")

    chunk_wavs = []
    try:
        for i, chunk in enumerate(sentences):
            txt_path = os.path.join(TEMP_DIR, f"{code}_{i}.txt")
            wav_path = os.path.join(TEMP_DIR, f"{code}_{i}.wav")

            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(chunk)

            cmd = [VP_EXE,
                   '-t', txt_path,
                   '-n', narrator,
                   '-e', emotion,
                   '--speed', speed,
                   '--pitch', pitch,
                   '-o', wav_path]

            r = subprocess.run(cmd, cwd=VP_DIR, capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                raise RuntimeError(f"VOICEPEAK エラー（文{i}）: {r.stderr.strip()}")

            chunk_wavs.append(wav_path)
            print(f"  [{i+1}/{len(sentences)}] 完了")
            time.sleep(3.0)   # VOICEPEAK 安定待機

        # WAV 結合
        combined = os.path.join(TEMP_DIR, f"{code}_combined.wav")
        if len(chunk_wavs) == 1:
            shutil.copy(chunk_wavs[0], combined)
        else:
            combine_wav(chunk_wavs, combined)

        # MP3 変換
        wav_to_mp3(combined, mp3_path)
        print(f"  ✅ {code}.mp3 完成")
        return jsonify({'ok': True, 'message': f'{code}.mp3 を生成しました'})

    except Exception as e:
        print(f"  ❌ エラー: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500

    finally:
        # 一時ファイルを削除
        for f in chunk_wavs:
            if os.path.exists(f): os.remove(f)
        c = os.path.join(TEMP_DIR, f"{code}_combined.wav")
        if os.path.exists(c): os.remove(c)


# ==================== 起動 ====================
if __name__ == '__main__':
    print('=' * 55)
    print('  TAKERU 音声生成サーバー')
    print(f'  VOICEPEAK : {VP_EXE}')
    print(f'  音声保存  : {VOICES_DIR}')
    print(f'  バックアップ: {BACKUP_DIR}')
    print('  URL       : http://localhost:5000')
    print('  停止      : Ctrl+C')
    print('=' * 55)
    print()
    app.run(host='127.0.0.1', port=5000, debug=False)
