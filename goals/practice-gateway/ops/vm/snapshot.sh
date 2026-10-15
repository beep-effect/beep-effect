#!/usr/bin/env bash
# Capture (snapshot.sh save <name>) or restore (snapshot.sh revert <name>) the
# proof VM's full state while it is shut off: a qcow2 internal disk snapshot
# plus copies of the UEFI variable store and the swtpm state, which libvirt's
# own snapshots do not cover for UEFI/TPM guests.
set -euo pipefail
ACTION="${1:?usage: snapshot.sh save|revert <name>}"
SNAP="${2:?usage: snapshot.sh save|revert <name>}"
NAME="${VM_NAME:-practice-gateway-win11}"
STATE="${VM_STATE:-$HOME/VMs/practice-gateway}"
CONN="qemu:///session"
v() { virsh -c "$CONN" "$@"; }

[[ "$(v domstate "$NAME")" == "shut off" ]] || { echo "shut $NAME down first" >&2; exit 1; }
DISK="$STATE/disk.qcow2"
NVRAM="$(v dumpxml "$NAME" | sed -n 's:.*<nvram[^>]*>\(.*\)</nvram>.*:\1:p')"
TPM_DIR="$HOME/.config/libvirt/qemu/swtpm/$(v domuuid "$NAME")"
SAVE="$STATE/snapshots/$SNAP"

case "$ACTION" in
  save)
    mkdir -p "$SAVE"
    chmod 700 "$STATE/snapshots" "$SAVE"
    qemu-img snapshot -d "$SNAP" "$DISK" 2>/dev/null || true
    qemu-img snapshot -c "$SNAP" "$DISK"
    cp -f "$NVRAM" "$SAVE/nvram.fd"
    rm -rf "$SAVE/swtpm" && cp -a "$TPM_DIR" "$SAVE/swtpm"
    echo "saved $SNAP"
    ;;
  revert)
    [[ -d "$SAVE" ]] || { echo "no snapshot $SNAP" >&2; exit 1; }
    qemu-img snapshot -a "$SNAP" "$DISK"
    cp -f "$SAVE/nvram.fd" "$NVRAM"
    rm -rf "$TPM_DIR" && cp -a "$SAVE/swtpm" "$TPM_DIR"
    echo "reverted to $SNAP"
    ;;
  *) echo "unknown action $ACTION" >&2; exit 1 ;;
esac
