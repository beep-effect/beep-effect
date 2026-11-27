---
title: The privileged OpenClaw scripts trust nothing the operator's user can write
date: 2026-11-26
reversal: Render the scripts as login bash over the inherited PATH, look up sudo by name and drop trustedToolchainLines from the stage script.
governs:
  - src/OpenClawGeneration.ts#bashScript
  - src/OpenClawGeneration.ts#trustedBasePath
  - src/OpenClawGeneration.ts#defaultNodeBinDir
  - src/OpenClawGeneration.ts#trustedToolchainLines
  - src/OpenClawGeneration.ts#renderOpenClawPreflightScript
enforcedBy: []
---

The scripts run while the operator's sudo ticket is live, so any file or variable an unprivileged user controls could intercept a privileged command. They run as `/bin/bash --noprofile --norc -p`: a login shell (`-l`) sources `/etc/profile` and the user-writable `~/.bash_profile` first, where a `sudo` function or a PATH entry could be planted, and `-p` refuses functions exported through the environment, the only other way to inject one.
Every script pins `PATH=/usr/bin:/bin` before anything else runs, because the deploying process inherits the operator's PATH, which on a workstation leads with user-writable runtime-manager directories; scripts that need the pinned Node export their own PATH after it. Preflight asserts `/usr/bin/sudo` is the setuid-root binary at its absolute path, because a lookup by name is satisfied by any shim earlier on PATH.
Staging runs `npm install` as root, so the Node toolchain is inside the trust boundary: it lives under the root-owned `/opt/beep/openclaw` tree, and the stage script resolves the pinned directory, `node` and `npm` with `readlink -f` (`npm` is commonly a wrapper that execs a sibling `node`) and walks each to `/`, requiring uid 0 and no group or world write bit. `--ignore-scripts` is no defense when the package manager binary itself is writable. The mode test writes both operands as `8#`, since a bare `022` is octal in bash but decimal in some other shells.
Rejected: a login shell over the inherited PATH with `sudo` found by name and Node from a per-user runtime manager directory, each of which lets an unprivileged user run code as root.
