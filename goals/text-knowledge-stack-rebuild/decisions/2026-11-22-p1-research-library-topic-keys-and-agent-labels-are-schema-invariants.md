---
title: "P1: research-library topic keys and agent labels are schema invariants"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p1c-bindings"
pullRequest: 3449
reversal: "Type LibraryModelRun and LibraryFinding keys as S.String again and mint them inside catalogDataset."
---

`Registry.mint` checks each segment and throws for an empty one. The composer expression it replaced checked the composed string, so a catalog with an empty `model` or `effort` projected before commit 13 and threw inside `catalogDataset` after it. Topic keys were minted the same way from free text: a topic key with a space or a leading or trailing slash threw too.

1. **The schema carries the invariant.** `LibraryAgentLabel` is a label `libraryAgentIri` accepts, and `LibraryTopicId` is a key `libraryTopicIri` accepts. Both checks call the minter itself, so they cannot drift from what the registry accepts. `LibraryModelRun`, `LibrarySynthesisAuthor`, `LibraryMineProfile` and `LibraryVidbeeBinding` use the first for `model` and `effort`. `LibraryFinding.topicIds` and `LibraryTopic.id` use the second. A refused value is a decode error that names its field, and the projection mints only checked keys.
2. **Why a decode error.** No import path writes a refused value: mining profiles are constants, the VidBee import requires a model and writes `unrecorded` for a missing effort, a synthesis author was already non-empty, and mining keeps only topic keys of the packet list. An empty model or effort therefore names no agent, and keeping the old IRI with an empty segment would publish a resource for it.
3. **What is still accepted.** A label is percent-encoded, so spaces, slashes and angle brackets stay legal in `model` and `effort`. Only the empty string and a lone surrogate, which has no UTF-8 form, are refused. A topic key is used as it stands, so a space, an angle bracket, a stray `%` and a leading or trailing slash are refused.
4. **Free text stays out of the key set.** A packet's initiative id is free text (the goal template's is a placeholder in angle brackets), so mining offers a finding only the ids that are topic keys. A packet directory whose name forms no IRI is skipped and counted with the unreadable manifests.
5. **No published byte changes.** The T-Box and SHACL Turtle are byte-identical, and the live catalog (3,465 model runs, 12,330 findings) decodes and projects to the same quads before and after.
