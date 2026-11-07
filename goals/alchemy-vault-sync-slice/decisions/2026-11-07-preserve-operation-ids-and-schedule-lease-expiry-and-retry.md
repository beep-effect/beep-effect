---
title: "Preserve operation ids and schedule lease expiry and retry"
date: 2026-11-07
reversal: "Introduce a versioned operation protocol and upcasters before changing identity"
---

Existing public operation ids are stable. Retarget and squash are events. Leases carry holder, attempt token and expiresAt; non-rejecting scheduled commands implement expiry and retry backoff. Terminal failure and supersession are separate facts.
