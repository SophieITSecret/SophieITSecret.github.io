#!/usr/bin/env bash
# sw.js のキャッシュ版数を1つ上げる（takeru-vNN → vNN+1）。
# デプロイ前に必ず実行し、内容変更と同じコミットに含めること。
# これを上げないと、既にホーム画面に入れた端末が古いキャッシュのままになり、
# 新しく公開したカードが届かない＆更新トーストも出ない。
set -euo pipefail
SW="$(git rev-parse --show-toplevel)/staging/TAKERU/sw.js"
cur=$(grep -oE 'takeru-v[0-9]+' "$SW" | head -1 | grep -oE '[0-9]+')
next=$((cur + 1))
sed -i "s/takeru-v${cur}\b/takeru-v${next}/" "$SW"
echo "sw.js: takeru-v${cur} -> takeru-v${next}"
echo "→ 内容変更と一緒に commit してください。"
