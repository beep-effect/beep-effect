---
"@beep/infra": patch
---

Harden the CI fleet controller for the P2 cutover: 64 GB memory-optimized
instance types so cold heavy typecheck compiles fit, and a post-install
iptables OWNER-match rule dropping ec2-user access to IMDS as the CSF-003
host credential-theft mitigation.
