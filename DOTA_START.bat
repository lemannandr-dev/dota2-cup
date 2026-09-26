@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File "%~dp0DOTA_SETUP.ps1"
