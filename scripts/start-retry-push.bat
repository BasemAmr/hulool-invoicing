@echo off
title Git Push Retry Monitor
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0retry-push.ps1"
pause
