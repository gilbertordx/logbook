@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0..\.."
title Logbook (Rust) - menu

where cargo >nul 2>nul
if errorlevel 1 (
  echo.
  echo Rust is not installed yet.
  echo Install it from https://rustup.rs  ^(it also asks for the Visual Studio C++ Build Tools^),
  echo then double-click this shortcut again.
  pause
  exit /b 1
)

:menu
cls
echo ============================================================
echo   Logbook - Rust ^(WebAssembly^) remaster
echo ============================================================
echo   [1] Run the app with live reload  ^(opens http://127.0.0.1:8080^)
echo       edit a file in rust\web\src and the page rebuilds by itself
echo   [2] Run the tests
echo   [3] Build the release version     ^(rust\web\dist^)
echo   [4] Open the project folder
echo   [5] Open the learning guide
echo   [6] Quit
echo.
echo   Tip: this app keeps its data in the browser at 127.0.0.1:8080, separate from
echo   your real logbook. Use [EXP] on the old one and [IMP] here to test with real data.
echo.
choice /c 123456 /n /m "Choose 1-6: "
if errorlevel 6 goto quit
if errorlevel 5 goto guide
if errorlevel 4 goto folder
if errorlevel 3 goto release
if errorlevel 2 goto tests
if errorlevel 1 goto run

:prereqs
where trunk >nul 2>nul
if errorlevel 1 (
  echo.
  echo The web build tool ^(trunk^) is not installed. Installing it takes about 5 minutes, once.
  choice /c YN /n /m "Install it now? [Y/N] "
  if errorlevel 2 exit /b 1
  cargo install trunk --locked
  if errorlevel 1 ( echo Install failed. & exit /b 1 )
)
rustup target add wasm32-unknown-unknown
exit /b 0

:run
call :prereqs
if errorlevel 1 ( pause & goto menu )
echo.
echo Starting... the first build takes a few minutes. Press Ctrl+C to stop.
pushd rust\web
trunk serve --open
popd
pause
goto menu

:tests
cargo test --workspace --manifest-path rust\Cargo.toml
pause
goto menu

:release
call :prereqs
if errorlevel 1 ( pause & goto menu )
pushd rust\web
trunk build --release
popd
echo.
echo Built into rust\web\dist
pause
goto menu

:folder
start "" "%CD%"
goto menu

:guide
start "" "docs\RUST_LEARNING.md"
goto menu

:quit
endlocal
exit /b 0
