---
title: "Fold the remote cursor into the destination aggregate"
date: 2026-11-07
reversal: "Introduce a separately versioned cursor aggregate if account-wide polling becomes independent"
---

The current cursor scope is one workspace plus provider, so its position and poll failure state belong to SyncDestination. A failed poll preserves the last durable position.
