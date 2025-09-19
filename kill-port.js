// Kill process listening on PORT before starting dev server (best-effort, cross-platform)
const { execSync } = require('child_process')

const port = process.env.PORT || 4000

try {
  if (process.platform === 'win32') {
    // Use PowerShell Get-NetTCPConnection to find owning process and kill it
    const cmd = `powershell -NoProfile -Command "$p=(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if($p){ Stop-Process -Id $p -Force }"`
    execSync(cmd, { stdio: 'ignore' })
  } else {
    // Unix-like: use lsof to find pid then kill -9
    const cmd = `bash -lc 'PID=$(lsof -ti :${port} || echo); if [ -n "$PID" ]; then kill -9 $PID; fi'`
    execSync(cmd, { stdio: 'ignore' })
  }
} catch (_) {
  // ignore errors; this is best-effort
}

process.exit(0)


