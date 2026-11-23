---
title: "P2: the agent-memory read-time OccurrenceId lands before feat/agent-memory-store-p3, as a function outside the payload schema"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Drop occurrenceIdOf and its fixture test; the stored events and every schema stay as they were."
---

Decision p0-rq4 sequences this after that goal's open lane merges. The lane (c93b36cb77a, unpushed, no PR, last commit 2026-11-13) does not touch OccurrenceAnchor, SpanAnchor.models.ts or the anchor field of NodeCreated; its only overlap is the import line. Waiting on it has no end condition, so P2 lands first and the lane merges main. The derivation is occurrenceIdOf(anchor) in SpanAnchor.models.ts: it builds the receipt from source and anchor, maps the stored utf16 literal to utf16-code-unit by matching TextUnit, and calls mintOccurrenceId. It is not a payload transform: an effectful payload schema would put Digest into the event journal's decoding services. The stored literal, the three keys and the encoded field shapes stay, so the SchemaBinary layout is unchanged, and a fixture captured from the code before P2 proves it: frozen bytes decode, derive the golden id sha256:654d949fc9259fd7b3b3d90ef96c270b444cfece9feb03f15dfe29013001a06d and re-encode to the same bytes.
