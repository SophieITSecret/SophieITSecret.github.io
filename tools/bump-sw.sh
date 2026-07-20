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
set -euo pipefail
SW="$(git rev-parse --show-toplevel)/staging/TAKERU/sw.js"

cur=$(grep -oE 'takeru-v[0-9]+' "$SW" | head -1 | grep -oE '[0-9]+')
next=$((cur + 1))

sed -i "s/takeru-v${cur}\b/takeru-v${next}/" "$SW"
sed -i "s/^const SW_VERSION = 'v[0-9]\+';/const SW_VERSION = 'v${next}';/" "$SW"

# 上げ終わったら2つが一致しているか必ず検算する
a=$(grep -oE "SW_VERSION = 'v[0-9]+'" "$SW" | grep -oE '[0-9]+')
b=$(grep -oE 'takeru-v[0-9]+' "$SW" | head -1 | grep -oE '[0-9]+')
if [ "$a" != "$b" ]; then
  echo "ERROR: SW_VERSION(v$a) と CACHE_NAME(v$b) が一致しません。sw.js を確認してください。" >&2
  exit 1
fi

echo "sw.js: v${cur} -> v${next}（SW_VERSION / CACHE_NAME 両方）"
echo "→ 内容変更と一緒に commit してください。"
