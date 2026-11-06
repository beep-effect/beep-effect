---
title: "tom-pc-1's WSL distro joins the tailnet as its own node, not through the Windows node"
date: 2026-11-06
reversal: "tailscale logout inside the distro and delete the node in the admin console; switch .wslconfig to networkingMode=mirrored and open a Hyper-V firewall rule for 3773 instead"
---

The agent distro (t3-agent, Ubuntu 26.04, user agent, automount and interop off, systemd on) runs its own tailscaled and publishes T3 with t3 pair --tailscale (Serve, no Funnel). The Windows node already carries a pre-existing Funnel route (a loopback proxy that is not ours), so adding T3 to the Windows Serve config would risk publishing it, and mirrored networking would change a global .wslconfig setting that the preserved Ubuntu distro shares. Cost: one operator login approval for the new node, and a second tailnet node for the same PC.
