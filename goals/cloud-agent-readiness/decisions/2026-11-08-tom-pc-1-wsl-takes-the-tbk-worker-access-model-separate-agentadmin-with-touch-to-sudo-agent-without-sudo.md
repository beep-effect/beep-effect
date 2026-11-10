---
title: "tom-pc-1-wsl takes the tbk-worker access model: separate agentadmin with touch-to-sudo, agent without sudo"
date: 2026-11-08
lane: "goals/t3code-fleet-rollout-tom-pc-1-wsl-access"
reversal: "Remove the two sshd drop-ins and the PAM line, delete agentadmin and the key files under /etc/ssh/authorized_keys and /etc/security/authorized_keys, delete the workstation key handle and wrapper, and fall back to the PC's Windows SSH route."
---

The distro runs its own ED25519-SK-only sshd on its tailnet node with tailnet-source AllowUsers. Development and the T3 service run as agent (no sudo, no agent forwarding); administration uses the separate agentadmin account, a distro-only YubiKey identity in a dedicated workstation agent, and libpam_rssh touch-to-sudo, the same module dankserver and tbk use. Account passwords are locked, so no password fallback exists. The checkout is the public clone; 1Password credentials remain an operator grant (GitHub push was added through a gh login on 2026-11-08). Taken on 2026-11-07 and filed on 2026-11-08 in a lane for goals/t3code-fleet-rollout that never published; recorded here on 2026-11-09 because that packet is archived. Receipt: history/2026-11-07-tom-pc-1-wsl-worker-access.md.
