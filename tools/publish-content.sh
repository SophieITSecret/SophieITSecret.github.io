#!/usr/bin/env bash
# ============================================================
# TAKERU 内容の公開（牧村さん用・ダブルクリックから実行）
#   作業台で直した本文・画像・音声を、開発版(GitHub)と本番(Xserver)の
#   両方へ一気に反映する。
#
#   ・内容更新は sw版数を上げる必要がない（本文CSVは毎回サーバから取得、
#     新しい画像・音声は新ファイル名なのでそのまま出る）ため、--force で
#     版数ガードを飛ばして転送する。
#   ・未公開（公開フラグ=空）のカードは本番では表示されないので、
#     作りかけを反映しても本番には出ない。
# ============================================================
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || { echo "リポジトリが見つかりません"; exit 1; }

echo "============================================"
echo " TAKERU 内容の公開（開発版＋本番）"
echo "============================================"
echo ""

# 1) 内容ファイルをコミット（変更があれば）
git add staging/TAKERU/TAKERUcard.csv staging/TAKERU/MSlink.csv \
        staging/TAKERU/images staging/TAKERU/voices 2>/dev/null

if git diff --cached --quiet; then
  echo "▶ 新しい変更はありません（すでにコミット済みかも）。そのまま反映へ進みます。"
else
  git commit -m "内容更新 $(date '+%Y-%m-%d %H:%M')" || { echo "コミットに失敗しました"; exit 1; }
  echo "▶ コミットしました。"
fi
echo ""

# 2) GitHub へ push（開発版に反映）
echo "▶ GitHub（開発版）へ送信中..."
if ! git push origin main; then
  echo ""
  echo "❌ GitHubへの送信に失敗しました。ネット接続を確認してください。"
  exit 1
fi
echo "  開発版に反映しました。"
echo ""

# 3) 本番（Xserver）へ転送（版数バンプ不要なので --force）
echo "▶ 本番（takeru.ms-forum.com）へ転送中... 少し時間がかかります。"
if ! bash tools/deploy-takeru-prod.sh --force; then
  echo ""
  echo "❌ 本番への転送に失敗しました。（開発版は反映済みです）"
  exit 1
fi

echo ""
echo "============================================"
echo " ✅ 完了：開発版と本番の両方に反映しました"
echo "    本番 https://takeru.ms-forum.com/"
echo "============================================"
