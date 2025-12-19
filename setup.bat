@echo off
REM Create snapshots folder
if not exist snapshots (
  mkdir snapshots
  echo Created snapshots folder.
) else (
  echo snapshots folder already exists.
)

REM Add snapshots to .gitignore if not present
findstr /C:"/snapshots" .gitignore >nul 2>&1
if errorlevel 1 (
  echo /snapshots>>.gitignore
  echo Added /snapshots to .gitignore
) else (
  echo /snapshots already in .gitignore
)

echo Setup complete. You can now start your AI, feed it BOOTSTRAP.txt and use SNAPSHOT commands.
pause
