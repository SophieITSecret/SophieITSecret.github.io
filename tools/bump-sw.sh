#!/usr/bin/env bash
# sw.js のバージョンを1つ上げる。
#
#   SW_VERSION  … 設定画面の「現在のバージョン：」表示に使う（GET_VERSION で返す値）
#   CACHE_NAME  … キャッシュの世代。ここが変わると古いキャッシュが捨てられる
#
# この2つは必ず同じ番号で揃える。片方だけ上げると、
#   ・CACHE_NAME だけ → 更新は届くが、設定画面が古い番号を表示し続ける（診断が狂う）
#   ・SW_VERSION だけ → 表示は変わるが古いキャッシュが残る
# デプロイ前に実行し、内容変更と同じコミットに含めること。
#
# app.js の ASSET_V も一緒に上げる。画像と音声はブラウザ自身が長く抱えるため、
# URLに付ける印を変えないと差し替えても古いものが出続ける。
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SW="$ROOT/staging/TAKERU/sw.js"
APP="$ROOT/staging/TAKERU/app.js"

cur=$(grep -oE 'takeru-v[0-9]+' "$SW" | head -1 | grep -oE '[0-9]+')
next=$((cur + 1))

sed -i "s/takeru-v${cur}\b/takeru-v${next}/" "$SW"
sed -i "s/^const SW_VERSION = 'v[0-9]\+';/const SW_VERSION = 'v${next}';/" "$SW"
sed -i "s/^const ASSET_V = 'v[0-9]\+';/const ASSET_V = 'v${next}';/" "$APP"

# 上げ終わったら3つが一致しているか必ず検算する
a=$(grep -oE "SW_VERSION = 'v[0-9]+'" "$SW" | grep -oE '[0-9]+')
b=$(grep -oE 'takeru-v[0-9]+' "$SW" | head -1 | grep -oE '[0-9]+')
c=$(grep -oE "ASSET_V = 'v[0-9]+'" "$APP" | grep -oE '[0-9]+')
if [ "$a" != "$b" ] || [ "$a" != "$c" ]; then
  echo "ERROR: SW_VERSION(v$a) / CACHE_NAME(v$b) / ASSET_V(v$c) が一致しません。" >&2
  exit 1
fi

echo "v${cur} -> v${next}（sw.js の2つ ＋ app.js の ASSET_V）"
echo "→ 内容変更と一緒に commit してください。"
