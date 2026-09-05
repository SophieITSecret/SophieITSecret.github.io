# VOICEPEAK 音声生成 引き継ぎ書

## BarSophie / TAKERU プロジェクト共通

作成：2026年6月  
用途：お酒の知識カンペ（300話以上）のSophie音声一括生成手順

---

## 1. 環境

|項目|設定値|
|---|---|
|ツール|VOICEPEAK（Windows版）|
|インストール先|`C:\Program Files\VOICEPEAK\`|
|**ナレーター名**|**`Japanese Female 1`**（※必ず英語名）|
|変換ツール|pydub（Python）|

---

## 2. ハマりポイント（実際に苦労した箇所）

1. **ナレーター名は英語名必須**  
    `女性1` では `Internal BUG` エラーが出て動かない。  
    必ず `Japanese Female 1` を使う。  
    確認コマンド：
    
    ```
    & "C:\Program Files\VOICEPEAK\voicepeak.exe" --list-narrator
    ```
    
2. **数字が含まれるとエラーになる場合がある**  
    `440` → `よんひゃくよんじゅう` など読み仮名に変換する。
    
3. **連続処理でVOICEPEAKが不安定になる**  
    `time.sleep(3.0)` を各生成後に入れる。  
    さらに5本ごとに10秒休憩を入れると安定する。  
    ※10秒は長すぎる可能性あり。5〜7秒程度に短縮しても動く可能性があるが未検証。
    
4. **エラーが出てもスキップして続行する設計にする**  
    後で `check_missing.py` で抜けを確認して再処理する方が効率的。
    
5. **Windowsのスリープをオフに**  
    長時間（数時間）実行するため、電源設定でスリープを「なし」にする。
    
6. **CSVのヘッダー行とカラム番号に注意**  
    BarSophie：ヘッダーあり、本文は `カンペ本文` 列  
    TAKERU：ヘッダーあり、本文は4列目（インデックス4）
    
7. **`cwd=VP_DIR` を指定する**  
    VOICEPEAKのインストールフォルダを作業場所として指定して実行する（「故郷モード」）。
    

---

## 3. 音声生成スクリプト（voicepeak_sophie.py）

```python
import os
import subprocess
import pandas as pd
import wave
import time

# ==========================================
# 設定項目
# ==========================================
VP_DIR = r"C:\Program Files\VOICEPEAK"
VP_EXE = "voicepeak.exe"
NARRATOR = "Japanese Female 1"   # ← 英語名必須！
EMOTION = "happy=40,fun=30"
SPEED = "100"
PITCH = "50"
CSV_FILE = os.path.abspath("お酒の話.csv")
OUTPUT_DIR = os.path.abspath("voices_wav")
TEMP_DIR = os.path.abspath("temp_work")

for d in [OUTPUT_DIR, TEMP_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

def combine_wav_files(file_list, output_path):
    if not file_list:
        return
    data = []
    for file in file_list:
        with wave.open(file, 'rb') as w:
            data.append([w.getparams(), w.readframes(w.getnframes())])
    with wave.open(output_path, 'wb') as output:
        output.setparams(data[0][0])
        for d in data:
            output.writeframes(d[1])

def generate():
    df = pd.read_csv(CSV_FILE, encoding='utf-8-sig')
    processed_count = 0

    for index, row in df.iterrows():
        talk_id = str(row['ID'])
        full_text = row['カンペ本文（250文字程度）']
        final_output = os.path.join(OUTPUT_DIR, f"{talk_id}.wav")

        if os.path.exists(final_output):
            continue

        sentences = [s.strip() + "。" for s in full_text.split('。') if s.strip()]
        chunk_files = []
        success = True
        print(f"処理中: {talk_id} ({len(sentences)}分割)")

        for i, chunk_text in enumerate(sentences):
            txt_path = os.path.join(TEMP_DIR, f"input_{talk_id}_{i}.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(chunk_text)

            chunk_file = os.path.join(TEMP_DIR, f"chunk_{talk_id}_{i}.wav")

            cmd = [
                os.path.join(VP_DIR, VP_EXE),
                "-t", txt_path,
                "-n", NARRATOR,
                "-e", EMOTION,
                "--speed", SPEED,
                "--pitch", PITCH,
                "-o", chunk_file
            ]

            result = subprocess.run(
                cmd,
                cwd=VP_DIR,          # ← 故郷を指定！
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                print(f"❌ エラー ({talk_id}-{i}): {result.stderr}")
                success = False
                break

            chunk_files.append(chunk_file)
            time.sleep(3.0)          # ← 安定のための待機

        if success:
            combine_wav_files(chunk_files, final_output)
            processed_count += 1

        for f in chunk_files:
            if os.path.exists(f):
                os.remove(f)

        if not success:
            print(f"⚠️ {talk_id} をスキップして続行")
            continue

        if processed_count % 5 == 0:
            print(f"--- {processed_count}本完了。10秒休憩中... ---")
            time.sleep(10)  # ※5〜7秒程度に短縮しても動く可能性あり（要検証）

    print(f"\n✨ 完了！")

if __name__ == "__main__":
    generate()
```

---

## 4. WAV→MP3変換スクリプト（wav_to_mp3.py）

```python
import os
from pydub import AudioSegment

INPUT_DIR = "voices_wav"
OUTPUT_DIR = "voices"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

files = sorted([f for f in os.listdir(INPUT_DIR) if f.endswith(".wav")])
total = len(files)
print(f"--- WAV→MP3 変換開始（全{total}本）---")

converted = 0
skipped = 0

for i, filename in enumerate(files):
    mp3_name = filename.replace(".wav", ".mp3")
    mp3_path = os.path.join(OUTPUT_DIR, mp3_name)

    if os.path.exists(mp3_path):
        print(f"[{i+1}/{total}] スキップ: {mp3_name}")
        skipped += 1
        continue

    wav_path = os.path.join(INPUT_DIR, filename)
    audio = AudioSegment.from_wav(wav_path)
    audio = audio.set_channels(1)      # モノラル（容量半減）
    audio.export(mp3_path, format="mp3", bitrate="128k")
    print(f"[{i+1}/{total}] 変換完了: {mp3_name}")
    converted += 1

print(f"\n✨ 完了！変換:{converted}本 スキップ:{skipped}本")
```

---

## 5. 抜けチェックスクリプト（check_missing.py）

```python
import os
import pandas as pd

CSV_FILE = "お酒の話.csv"
MP3_DIR = "voices"

df = pd.read_csv(CSV_FILE, encoding='utf-8-sig')
missing = [
    str(row['ID'])
    for _, row in df.iterrows()
    if not os.path.exists(os.path.join(MP3_DIR, f"{str(row['ID'])}.mp3"))
]

print(f"未完成: {len(missing)}本")
print("IDリスト:", missing)
```

---

## 6. 実績

|プロジェクト|本数|結果|
|---|---|---|
|BarSophie（お酒の知識）|360本|完了・GitHub Pagesデプロイ済み|
|TAKERU|約900本予定|スクリプト準備済み|

---

## 7. 次回の作業フロー

1. CSVファイルを用意（ID列 + 本文列）
2. `voicepeak_sophie.py` の設定項目を確認・修正
3. Windowsのスリープをオフに設定
4. スクリプト実行（長時間かかるので放置でOK）
5. 完了後 `check_missing.py` で抜けを確認
6. 抜けがあれば再実行（生成済みはスキップされる）
7. `wav_to_mp3.py` でMP3変換
8. `voices/` フォルダをGitHubにプッシュ