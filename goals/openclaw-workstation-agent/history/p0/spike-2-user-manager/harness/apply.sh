#!/usr/bin/env bash
# P0 spike 2 — applicator apply prototype (disposable spike code).
# Preflight gates every mutation: a failed preflight exits before any
# systemd or filesystem change. Mutations: install spike unit,
# daemon-reload, enable, start, stop.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
exp="${1:?usage: apply.sh <expected.json>}"

echo "== context: tty=$(tty 2>&1 || true) sid=$(ps -o sid= -p $$ | tr -d ' ') env-keys=$(env | cut -d= -f1 | sort | tr '\n' ',')"

"$here/preflight.sh" "$exp"

# Exact env a privileged applicator would construct for the target user:
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

unitdir="$HOME/.config/systemd/user"
install -Dm0644 "$here/openclaw-spike.service" "$unitdir/openclaw-spike.service"
echo "== unit installed: $unitdir/openclaw-spike.service"
systemctl --user daemon-reload                     && echo "== daemon-reload OK"
systemctl --user enable openclaw-spike.service     && echo "== enable OK"
systemctl --user start openclaw-spike.service      && echo "== start OK"
echo "== is-active: $(systemctl --user is-active openclaw-spike.service)"
systemctl --user stop openclaw-spike.service       && echo "== stop OK"
echo "== is-active after stop: $(systemctl --user is-active openclaw-spike.service || true)"
echo "APPLY-OK"
