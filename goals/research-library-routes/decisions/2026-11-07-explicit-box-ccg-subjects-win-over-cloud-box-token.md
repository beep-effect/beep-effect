---
title: "Explicit Box CCG subjects win over CLOUD_BOX_TOKEN"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Give CLOUD_BOX_TOKEN first precedence again in libraryBoxAuthMode"
---

Intake review found that Bun loads a worktree .env holding an expired desktop CLOUD_BOX_TOKEN, so every acquire --route box failed with 'Box file lookup failed: sdk thrown' even with DMS_BOX_USER_ID set. libraryBoxAuthMode now selects the CCG user subject, then an explicit enterprise subject, then a non-empty developer token, then the BEEP_SECRETS enterprise subject. A live probe with a bogus CLOUD_BOX_TOKEN plus DMS_BOX_USER_ID captured readable.
