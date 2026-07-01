@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ================================================
echo   TAKERU 音声生成サーバー
echo ================================================
echo.
echo 必要なパッケージを確認しています...
python -m pip install flask flask-cors pydub --quiet --disable-pip-version-check
if errorlevel 1 (
    echo.
    echo [エラー] Python または pip が見つかりません。
    echo Python 3.x がインストールされているか確認してください。
    pause
    exit /b 1
)

echo.
echo サーバーを起動します。
echo このウィンドウを開いたままにしてください（閉じると停止します）。
echo.
python voicepeak_server.py
echo.
echo サーバーが停止しました。
pause
