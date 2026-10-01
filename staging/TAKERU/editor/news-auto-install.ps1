# ============================================================
# TAKERUニュース 土曜の自動取り込みを、Windowsのタスクスケジューラに登録する
#   毎週土曜 12:00 に editor/news-auto.js を動かす。
#   担当B（Coworkのルーチン）は土曜9時台に書き終えるので、昼なら必ず揃っている。
#   その時刻にPCが切れていたら、次に電源が入ったときに追いかけて動く。
#
#   登録:  powershell -ExecutionPolicy Bypass -File editor\news-auto-install.ps1
#   解除:  Unregister-ScheduledTask -TaskName "TAKERU ニュース自動取り込み" -Confirm:$false
#   手で今すぐ: Start-ScheduledTask -TaskName "TAKERU ニュース自動取り込み"
# ============================================================
$ErrorActionPreference = 'Stop'
$name   = 'TAKERU ニュース自動取り込み'
$script = Join-Path $PSScriptRoot 'news-auto.js'
$node   = (Get-Command node).Source

# 黒い窓を出さずに動かす。失敗したときだけ news-auto.js が知らせの窓を出す。
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
             -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$node' '$script'`"" `
             -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At '12:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
             -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
# ログオン中の本人として動かす（gitの資格情報とSSH鍵が使えるように。パスワードは保存しない）
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description 'TAKERUニュース（ガーディアン）の週次ダイジェストを取り込み、開発版と本番へ出す。editor/news-auto.js' -Force | Out-Null
Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
