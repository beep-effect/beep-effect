---
title: "Allow one decision-pointer comment for a hazard with no better home"
date: 2026-11-22
lane: "goals/comment-law-gate"
reversal: "Drop the decision-pointer kind from the grammar; such comments count as prose again."
---

The single allow-listed form is a line comment that is exactly 'decision: <slug>'. The slug names a file under the owning package decisions/ directory, and beep decisions check rejects a pointer with no file. It replaces free-text KEEP notes; anything else on the line makes it prose.
