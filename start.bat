@echo off
cd /d "%~dp0"

echo Loading environment variables...
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "%%A=%%B"
)

echo Installing dependencies...
call npm install

echo Pushing database schema...
call npx drizzle-kit push --force

echo Starting dev server on http://localhost:5000 ...
set NODE_ENV=development
call npx tsx server/index.ts
