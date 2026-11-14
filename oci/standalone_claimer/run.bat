@echo off
title Share2Me - OCI ARM Auto-Claimer
echo ===================================================
echo Starting Share2Me OCI Capacity Claimer
echo ===================================================
cd /d "%~dp0"
python claimer.py
pause

