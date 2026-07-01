@echo off
chcp 65001 > nul
echo.
echo ■ TAKERU 地図データ作成ツール
echo   Natural Earth からデータをダウンロードして SVG に変換します
echo   （インターネット接続が必要です）
echo.
node "%~dp0make_maps.js"
echo.
pause
