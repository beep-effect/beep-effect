#!/usr/bin/env sh
# Standalone QA environment probe — fallback for `bun run beep qa doctor`
# when the CLI itself is unavailable. POSIX sh; read-only.

fail=0
probe() { # name, command...
  name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'ok   %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name"; fail=1
  fi
}

# Optional (lane B only): failure warns without touching the exit code —
# matches the CLI doctor's required-vs-optional probe semantics.
warn() { # name, command...
  name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'ok   %s\n' "$name"
  else
    printf 'warn %s (lane B only)\n' "$name"
  fi
}

probe "ffmpeg" ffmpeg -version
probe "ffprobe" ffprobe -version
probe "exiftool" exiftool -ver
probe "playwright chromium" sh -c 'ls "$HOME"/.cache/ms-playwright/chromium-* 2>/dev/null | head -1 | grep -q chromium'
warn "obs binary" obs --version
warn "obs-websocket port 4455" sh -c 'command -v nc >/dev/null && nc -z 127.0.0.1 4455'

ws_cfg="$HOME/.config/obs-studio/plugin_config/obs-websocket/config.json"
if [ -f "$ws_cfg" ] && grep -q '"server_enabled": true' "$ws_cfg"; then
  printf 'ok   obs-websocket enabled in config\n'
else
  printf 'warn obs-websocket enabled in config (lane B only) (%s)\n' "$ws_cfg"
fi

if [ -f .beep/qa/current.json ]; then
  printf 'note live session handle present: .beep/qa/current.json\n'
fi

exit "$fail"
