# TAKERU 作業台：Node.js版への移行指示書

## 概要

現在HTML単体で動いている「TAKERU作業台（takeru_editor.html）」を、Node.jsのローカルサーバーとして再構築する。見た目とUIは現行のまま引き継ぎ、ブラウザの制限で実現できなかった機能を追加する。将来の拡張（画像加工・VOICEPEAK音声生成）の土台とする。

## 現行HTMLの機能（すべて引き継ぐ）

- 3ペイン構成：左（カード一覧）・中央（スマホ風プレビュー）・右（編集エリア）
- CSVファイル読み込み・編集・保存
- 画像フォルダ読み込み・プレビュー表示
- ユニット選択でフィルター
- 講座名（subject列）でグループ区切り表示
- サブユニットでグループ見出し表示
- 史実/解説バッジ（軍事と戦略以外）
- 本文未作成カードに●印
- 中央プレビュー：ユニット名・サブユニット名・タイトルの3段表示
- ◀▶ボタンとキーボード矢印でカード送り・戻し
- 編集リアルタイムプレビュー・文字数カウント
- 「一括取り込み」機能（@コード形式のテキストを貼り付けて本文一括反映）
- 未保存時のブラウザ閉じ防止警告

## Node.js化で追加する機能

### フェーズ1（今回やる）

1. **CSVの直接読み書き**
   - デフォルトのCSVパス：`D:\Sophie\SophieITSecret.github.io\staging\TAKERU\TAKERUcard.csv`
   - サーバー起動時に自動的にこのCSVを読み込む（ファイル選択不要）
   - 「保存」ボタンで同じファイルに直接上書き保存（ダウンロードではなく）
   - バックアップ：保存時に `TAKERUcard_backup_YYYYMMDD_HHMMSS.csv` を自動作成

2. **画像フォルダの自動読み込み**
   - デフォルトの画像フォルダ：`D:\Sophie\SophieITSecret.github.io\staging\TAKERU\images`
   - サーバー起動時に自動的にimagesフォルダを読み込み、カードIDと画像ファイル名を照合して表示
   - 画像フォルダ選択ボタンは不要に

3. **起動の簡易化**
   - `TAKERU作業台.bat` をプロジェクトルートに作成
   - ダブルクリックで `node server.js` を起動し、ブラウザで `http://localhost:3000` を自動で開く
   - コンソールの黒い窓を閉じれば終了

### フェーズ2（将来の拡張・今回は土台だけ）

4. **画像加工機能**（将来）
   - アップロードした画像を4:3にトリミング・リサイズ
   - 加工した画像を `images/` フォルダに `{カードID}.png` として直接保存
   - 今回は、拡張しやすいディレクトリ構造とAPIエンドポイントの設計だけしておく

5. **VOICEPEAK連携**（将来）
   - カードの本文をVOICEPEAKに渡してMP3を生成
   - 生成した音声を `voices/{カードID}.mp3` として保存
   - VOICEPEAKのコマンドラインインターフェースを利用（パスは設定ファイルで指定）
   - 今回は、設定ファイルの雛形とAPIエンドポイントの設計だけしておく

## 技術構成

```
takeru-editor/
├── server.js           ← Node.jsサーバー本体（Express）
├── config.json          ← 設定ファイル（パス等）
├── TAKERU作業台.bat      ← 起動用バッチ
├── package.json
├── public/
│   ├── index.html       ← 現行のHTMLを移植（UIそのまま）
│   ├── style.css        ← スタイル（HTMLから分離してもよい）
│   └── app.js           ← クライアント側JS（HTMLから分離してもよい）
```

### config.json（設定ファイル）

```json
{
  "csvPath": "D:\\Sophie\\SophieITSecret.github.io\\staging\\TAKERU\\TAKERUcard.csv",
  "imagesDir": "D:\\Sophie\\SophieITSecret.github.io\\staging\\TAKERU\\images",
  "voicesDir": "D:\\Sophie\\SophieITSecret.github.io\\staging\\TAKERU\\voices",
  "voicepeakPath": "",
  "port": 3000
}
```

### APIエンドポイント（server.js）

```
GET  /api/csv              → CSVを読み込んで返す
POST /api/csv              → CSVを上書き保存（バックアップ自動作成）
GET  /api/images           → imagesフォルダのファイル一覧を返す
GET  /api/images/:filename → 個別画像を返す（プレビュー用）
POST /api/images/process   → （将来）画像加工
POST /api/voice/generate   → （将来）VOICEPEAK連携
```

### TAKERU作業台.bat

```bat
@echo off
cd /d "%~dp0"
echo TAKERU 作業台を起動しています...
start http://localhost:3000
node server.js
```

## 移行手順

1. 牧村さんのPCにNode.jsがインストールされているか確認。なければインストール。
2. 上記のディレクトリ構成でファイルを作成。
3. `npm init -y && npm install express` で依存パッケージをインストール。
4. 現行の `takeru_editor.html` のUI・ロジックを `public/` 以下に移植。CSVの読み書きをfetch APIでサーバー経由に変更。
5. config.jsonのパスを牧村さんの環境に合わせて設定。
6. `TAKERU作業台.bat` をダブルクリックして動作確認。

## 重要な注意

- 現行HTMLのUI・操作感は変えない。見た目は同じ、できることが増える、が原則。
- CSS・HTMLの変更は最小限に。ペインの配置、色、フォント、ボタン位置はそのまま。
- config.jsonでパスを外出しにすることで、他の環境でも使えるようにする。
- server.jsのコードは、将来の画像加工・VOICEPEAK連携のエンドポイントを追加しやすい構造にする（ルーティングを分離するなど）。
- フェーズ1の動作確認が完了してから、フェーズ2に進む。
