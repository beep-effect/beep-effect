---
"@beep/infra": patch
---

Spread the heavy CI Spot fleet across more capacity pools: `capacity-optimized` allocation,
eight 64 GiB x86_64 instance types and public subnets in five availability zones. The fleet
stays all-Spot with a two-worker cap and no On-Demand fallback.
