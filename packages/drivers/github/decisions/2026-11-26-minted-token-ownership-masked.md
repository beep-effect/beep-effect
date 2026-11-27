---
title: A minted installation token is owned under an uninterruptible mask until it can be revoked
date: 2026-11-26
reversal: Run token minting and rotation interruptibly, and let the clientLayer finalizer take the rotation permit before revoking.
governs:
  - src/GitHubApp.ts#makeApp
  - src/GitHubApp.ts#makeRotatingClient
enforcedBy: []
---

`token` and the rotating client run under `Effect.uninterruptibleMask` and restore interruptibility only around the HTTP waits. Once a response arrives, its string `token` is handed to the mint observer while still masked, even if the rest of the payload fails decoding; rotation keeps that ownership masked across the handoff to client construction.
Reason: an interrupt between receiving a credential and recording it would leave a live token nobody revokes.
Closing never waits for the rotation permit: the finalizer marks the client closed, interrupts the in-flight refresh child, then revokes the credential it last recorded.
Rejected: an interruptible mint, which can drop a received token unrevoked; a finalizer that queues for the permit, which waits behind a hung mint.
