@echo off
setlocal
cd /d "%~dp0"
if exist "_worker.js" (
 set "RA_UPLOAD_DIR=."
) else (
 set "RA_UPLOAD_DIR=dist"
)
if not exist "%RA_UPLOAD_DIR%\_worker.js" (
 echo Extract the entire download first, then run this file again.
 pause
 exit /b 1
)
where npx >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 LTS once from https://nodejs.org/ then run this file again.
 pause
 exit /b 1
)
echo Uploading the finished Redmont Archives site to your existing Cloudflare project.
echo Sign in to Cloudflare if its browser window opens.
call npx --yes wrangler@4.157.0 pages deploy "%RA_UPLOAD_DIR%" --project-name redmontarchives --branch main
if errorlevel 1 (
 echo Upload stopped. The error is shown above.
 pause
 exit /b 1
)
echo Upload complete. Open https://redmontarchives.com
echo The site applies its database upgrade automatically when first opened.
pause
