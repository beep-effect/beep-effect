---
title: "Swapped encoders' differential tests keep the legacy column as a record"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Restore the slice A versions of the two differential test files from history; they need the legacy encoders, so revert the swap commits first."
---

Once an encoder is the owner, its byte-equality property compares the owner with itself, so those properties and their generator are gone. What carries information stays. The off-domain tables now assert what each export does (the owner's refusal, read back by code; PacketCore's undefined-member row still emits through the option), beside a legacy column recorded from slice A, since that code no longer exists to observe. The depth-cap and NaN rows assert that the exports refuse. The md block pins the frontmatter text and both render outcomes. The packet event replay, the W1 corpus hash replay and the execution-seal replay are unchanged in substance and still pass. Existing property tests whose schema-derived free text produced an unpaired surrogate now either expect the seal or the owner's refusal, or draw well-formed text through a repo-cli test helper where the property is about canonical bytes.
