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
#     → リポジトリから消した/リネームした旧ファイルは本番に残る。
#       年1回程度、下部「棚卸し」の手順で確認するとよい。
#
# 使い方:  bash tools/deploy-takeru-prod.sh          （通常）
#          bash tools/deploy-takeru-prod.sh --force  （sw版据置きでも強行）
# 前提:    ~/.ssh/takeru_deploy （デプロイ用SSH秘密鍵）が存在すること。
# ============================================================
set -euo pipefail

KEY="$HOME/.ssh/takeru_deploy"
HOST="xs302342.xsrv.jp"
USER="xs302342"
PORT="10022"
DEST="~/ms-forum.com/public_html/takeru"
PROD_URL="https://takeru.ms-forum.com"

FORCE=0
for a in "$@"; do [ "$a" = "--force" ] && FORCE=1; done

SSH="ssh -i $KEY -p $PORT -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=20"

if [ ! -f "$KEY" ]; then
  echo "ERROR: SSH鍵が見つかりません: $KEY" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ------------------------------------------------------------
# ガード: sw.js のキャッシュ版数が本番より上がっているか確認。
#   上がっていないと、既存端末が古いキャッシュのままになり
#   新規公開が届かない（更新トーストも出ない）。上げ忘れをここで止める。
# ------------------------------------------------------------
SW_SRC=$(git show HEAD:staging/TAKERU/sw.js)
# SW_VERSION（設定画面の表示）と CACHE_NAME（キャッシュ世代）のズレを検出する
SW_DISP=$(printf '%s' "$SW_SRC" | grep -oE "SW_VERSION = 'v[0-9]+'" | grep -oE '[0-9]+' || true)
SW_CACHE=$(printf '%s' "$SW_SRC" | grep -oE 'takeru-v[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
if [ -n "$SW_DISP" ] && [ -n "$SW_CACHE" ] && [ "$SW_DISP" != "$SW_CACHE" ]; then
  echo "ERROR: sw.js の SW_VERSION(v$SW_DISP) と CACHE_NAME(v$SW_CACHE) が食い違っています。" >&2
  echo "  設定画面が誤ったバージョンを表示します。bash tools/bump-sw.sh で揃えてください。" >&2
  exit 1
fi
NEW_SW="$SW_CACHE"
LIVE_SW=$(curl -sS --max-time 15 "$PROD_URL/sw.js" 2>/dev/null | grep -oE 'takeru-v[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
echo "==> sw版数: 今回=v${NEW_SW:-?}  本番=v${LIVE_SW:-?}"
if [ -n "$NEW_SW" ] && [ -n "$LIVE_SW" ]; then
  if [ "$NEW_SW" -le "$LIVE_SW" ] && [ "$FORCE" != "1" ]; then
    echo "" >&2
    echo "ERROR: sw.js のバージョンが上がっていません（本番=v$LIVE_SW / 今回=v$NEW_SW）。" >&2
    echo "  これを直さずに転送すると、既にホーム画面に入れた端末へ新カードが届きません。" >&2
    echo "  対処: bash tools/bump-sw.sh で版を上げ、内容変更と一緒に commit → push → 再実行。" >&2
    echo "  （同一版の再送が本当に必要な時だけ --force）" >&2
    exit 1
  fi
else
  echo "WARN: sw版数の比較をスキップ（本番未到達 or 解析失敗）。転送は続行します。"
fi

# ------------------------------------------------------------
# コミット済みツリーを展開 → editor除外 → 転送
# ------------------------------------------------------------
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> コミット済みツリーを展開中..."
git archive HEAD:staging/TAKERU | tar -x -C "$STAGE"
rm -rf "$STAGE/editor"   # 本番に送らない

echo "==> 送信内容（トップ階層）:"
ls -1 "$STAGE"
echo "==> 合計サイズ: $(du -sh "$STAGE" | cut -f1)"

echo "==> Xserver へ転送中 ..."
tar czf - -C "$STAGE" . | $SSH "$USER@$HOST" "cd $DEST && tar xzf - && echo DONE_DEPLOY"

# ------------------------------------------------------------
# 記録: 「いつ何を出したか」を git tag で残す（手動デプロイの台帳）。
# ------------------------------------------------------------
TAG="prod-$(date +%Y%m%d-%H%M%S)"
git tag -a "$TAG" -m "本番デプロイ sw=v${NEW_SW:-?} @ $(date '+%Y-%m-%d %H:%M')" HEAD 2>/dev/null || true
if git push origin "$TAG" >/dev/null 2>&1; then
  echo "==> 記録タグ: $TAG （push済）"
else
  echo "==> 記録タグ: $TAG （ローカルのみ。後で 'git push origin $TAG'）"
fi

echo "==> 完了。 $PROD_URL/ を確認してください。"

# ------------------------------------------------------------
# 【棚卸しの参考】本番に残った孤児ファイル（リポジトリから消えた旧ファイル）の確認:
#   $SSH "cd $DEST && find . -type f" > /tmp/prod_list.txt
#   git archive HEAD:staging/TAKERU | tar -t     # と突き合わせて差分を確認
#   不要と確認できたものだけ手動で削除する。
# ------------------------------------------------------------
