@echo off
chcp 65001 > nul
title 開票ライブの係（この窓を閉じると止まります）
cd /d "%~dp0"
node live.js
pause
