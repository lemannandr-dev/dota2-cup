@echo off
setlocal
set "CODE=%~1"
set "SERVER=%~2"
if "%SERVER%"=="" set "SERVER=http://localhost:3002"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DotaSyncHelper.ps1" -ServerUrl "%SERVER%" -Code "%CODE%" -Confirm
