# YubiKey prompt ergonomics — 2026-10-14

The operator reported missing beep-worker authentication prompts because the
SSH wrapper used notify-send without the normal authentication sound. Preserve
the configured FIDO key, dedicated agent, strict host checking, tailnet address,
password/keyboard-interactive denial and opt-in admin forwarding.

Installed ops/ssh-beep-worker-yubi.sh as DankStation's
~/.local/bin/ssh-beep-worker-yubi. It calls the existing yubikey-touch-alert
helper used by yubi-sudo/yubi-pkexec: persistent critical Plasma notification
and the existing dialog-warning-auth.oga sound at volume 0.65 with Alarm media
role. The helper and its security/notification settings were not changed.

A unique wrapper alert source is cleared after SSH authentication through a
local SSH callback and on exit/signals. Admin mode starts a separate admin-phase
alert after the SSH phase ends; it covers the forwarded admin session and closes
on session completion. It does not parse or claim to detect individual remote
PAM prompts. Long admin commands can retain that phase alert until completion.
No askpass helper, raw credential transport or password substitute was added.

Validation: bash syntax passes; canonical eight-second alert test completes;
fresh read-only key-authenticated SSH succeeds; a separate admin PTY running
sudo -v && sudo -n true succeeds with SSH and remote sudo touches. Journal shows
four Alarm playback starts across the test, SSH and two-stage admin checks.
The alert helper reports active_sources=0 afterward, and no authentication wait
remains pending. The installed wrapper matches the tracked operational artifact.
No remote privileged mutation was performed by these checks.

The prior wrapper is retained mode 0600 in private local
~/.cache/beep/pr1750/ssh-beep-worker-yubi.before. Restore it to roll back only
this wrapper; do not alter the canonical alert helper or unrelated key holders.
