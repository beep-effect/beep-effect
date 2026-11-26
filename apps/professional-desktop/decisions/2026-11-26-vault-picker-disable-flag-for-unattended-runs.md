---
title: An explicit environment flag, not a missing display, disables the sidecar's native vault folder dialog
date: 2026-11-26
reversal: Drop BEEP_DESKTOP_VAULT_PICKER_DISABLED and rely on unset DISPLAY/WAYLAND_DISPLAY to keep headless sidecars from opening a dialog.
governs:
  - src/intake/VaultDirectoryPickerOrchestrator.ts#vaultPickerDisabled
enforcedBy: []
---

kdialog reaches the operator's desktop through the D-Bus portal even when DISPLAY and WAYLAND_DISPLAY are unset, so an unattended or QA sidecar cannot suppress the folder picker by stripping display variables; it would pop a dialog on whatever desktop owns the session bus. With `BEEP_DESKTOP_VAULT_PICKER_DISABLED=true`, PickVaultDirectory fails at once with its typed error, which routes the renderer to the manual vault-path form.
Rejected: inferring headlessness from display variables (the portal ignores them).
