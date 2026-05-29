# scripts/dev-cdp.ps1
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
$env:WEBVIEW2_USER_DATA_FOLDER="$env:TEMP\reinamanager-webview2-cdp"
pnpm tauri dev
