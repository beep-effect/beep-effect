---
title: "YEET-08 slice 1: final-check receipts versioned by gate set"
date: 2026-11-13
kind: checkpoint
lane: "claude/stoic-torvalds-00017b"
reversal: "Revert the slice PR: receipts go back to yeet-final-check/v1 and lanes re-run yeet final-check once more"
---

Slice 3 lands. `yeet final-check` writes `yeet-final-check/v2` receipts that record the sorted `FinalCheckGate` set as `gateSetDigest`. `finalCheckRefusal` refuses a v1 receipt or a digest mismatch and names the cause; the ancestor refresh, the unchanged-rewrite carry (#3130) and `requireFinalCheck` refuse a carried one as `receipt-gate-set-mismatch`. The digest is the canonical gate list, not a hash, so a refusal can name the added and removed gates; reordering gates keeps receipts valid. A docs-drift test ties AGENTS.md, the yeet SKILL.md and the gates-and-proof gate table to the literals, and the repo-cli test, test:property and coverage tasks take those three files as Turbo inputs. Consequence: once this merges, every open lane's v1 receipt is refused by `yeet ready` and must be replaced by re-running `yeet final-check`.
