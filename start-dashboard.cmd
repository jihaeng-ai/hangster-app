@echo off
rem Launcher for the dashboard. All logic (with Korean messages) is in scripts\launcher\start-dashboard.ps1
rem Keep this file ASCII-only: cmd.exe misreads UTF-8 batch files.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\start-dashboard.ps1"
