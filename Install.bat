@echo off
chcp 1252 >nul
title ROQAM - Install
rem Installs ROQAM (English or German) into %USERPROFILE%\.claude\mods and updates settings.json.
rem Backups go to .claude\backups first; nothing is deleted.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"
echo.
pause
