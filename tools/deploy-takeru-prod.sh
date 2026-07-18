#!/usr/bin/env bash
# ============================================================
# TAKERU 本番デプロイ（ローカル実行用）
#   git のコミット済みツリー（=GitHub Pages開発版と同一）を
#   Xserver の takeru.ms-forum.com 公開フォルダへ転送する。
#
#   ・GitHub Actions は Xserver の国外IP制限で弾かれるため使わない。
#     日本国内のこのPCから流すことで制限を回避する。
#   ・editor/ だけ本番に送らない（VOICEPEAKパス等を含むため）。
#   ・tar展開方式なので既存ファイルの削除は起きない（追加・上書きのみ）。
#
# 使い方:  bash tools/deploy-takeru-prod.sh
# 前提:    ~/.ssh/takeru_deploy （デプロイ用SSH秘密鍵）が存在すること。
# ============================================================
set -euo pipefail

KEY="$HOME/.ssh/takeru_deploy"
HOST="xs302342.xsrv.jp"
USER="xs302342"
PORT="10022"
DEST="~/ms-forum.com/public_html/takeru"

SSH="ssh -i $KEY -p $PORT -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=20"

if [ ! -f "$KEY" ]; then
  echo "ERROR: SSH鍵が見つかりません: $KEY" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> コミット済みツリーを展開中..."
cd "$REPO_ROOT"
git archive HEAD:staging/TAKERU | tar -x -C "$STAGE"

# 本番に送らないもの
rm -rf "$STAGE/editor"

echo "==> 送信内容（トップ階層）:"
ls -1 "$STAGE"
echo "==> 合計サイズ: $(du -sh "$STAGE" | cut -f1)"

echo "==> Xserver へ転送中 ..."
tar czf - -C "$STAGE" . | $SSH "$USER@$HOST" "cd $DEST && tar xzf - && echo DONE_DEPLOY"

echo "==> 完了。 https://takeru.ms-forum.com/ を確認してください。"
