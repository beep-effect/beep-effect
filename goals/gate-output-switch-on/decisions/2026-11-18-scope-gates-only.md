---
title: "Gates only: the fixes touch output of gates the repo owns"
date: 2026-11-18
reversal: "Widen SPEC.md Non-Goals to admit a wrapper around agent-chosen commands"
---

This goal changes only what repo-owned gates print: test, check, lint, build, docgen, quality, Yeet and CI logs. Output of commands an agent chooses for itself (rg, cat, git) and any wrapper around commands the repo does not own stay out of scope; that larger problem has its own exploration entry in explorations/INBOX.md. Ruling: explorations/agent-verification-output/DECISIONS.md, entry scope-gates-only.
