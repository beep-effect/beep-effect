#!/usr/bin/env bash
# Persistent privileged session: ONE YubiKey tap arms a pty whose sudo ticket
# stays warm; subsequent commands are fed in over a FIFO and run inside it.
set -uo pipefail
FIFO=/home/elpresidank/.cache/beep-sudo-session.fifo
LOG=/home/elpresidank/.cache/beep-sudo-session.log
: > "$LOG"
rm -f "$FIFO"; mkfifo -m 600 "$FIFO"

tty -s || { echo "FATAL: needs a pty (script -qec ...)" | tee -a "$LOG"; exit 1; }
echo ">>> TAP YOUR YUBIKEY NOW — one tap arms the whole session" | tee -a "$LOG"
if ! sudo -v; then echo "SESSION-FAILED: tap window expired" | tee -a "$LOG"; rm -f "$FIFO"; exit 1; fi
echo "SESSION-ARMED" | tee -a "$LOG"

( while sleep 45; do sudo -n -v 2>/dev/null || exit 0; done ) &
KEEPER=$!
trap 'kill "$KEEPER" 2>/dev/null; rm -f "$FIFO"' EXIT

while read -r line < "$FIFO"; do
  [ "$line" = "__QUIT__" ] && break
  {
    echo "=== RUN: $line"
    bash -c "$line" 2>&1
    echo "=== EXIT: $?"
  } >> "$LOG"
done
echo "SESSION-CLOSED" >> "$LOG"
