@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto missing
node "%~dp0scripts\setup.mjs" %*
if errorlevel 1 pause
exit /b
:missing
echo Node.js 22+ LTS is required / Node.js 22+ LTS est necessaire.
echo https://nodejs.org/
where winget >nul 2>&1
if errorlevel 1 goto end
choice /C YN /M "Install Node.js LTS with winget? Installer Node.js LTS avec winget?"
if errorlevel 2 goto end
winget install --id OpenJS.NodeJS.LTS --exact
echo Close this window and run setup.bat again / Ferme cette fenetre puis relance setup.bat.
:end
pause
exit /b 1
