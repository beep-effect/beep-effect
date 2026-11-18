---
title: "Record policy v2 as breaking in the packet; the private workspace takes no changeset"
date: 2026-11-14
lane: "feat/citation-native-lane"
reversal: "Add a major changeset for @beep/law-practice-use-cases if the package becomes publishable."
---

The design asks for a major changeset with policy v2. `repo-sanity:changeset-graph` forbids a changeset for a private workspace, and `@beep/law-practice-use-cases` is private, so the changeset is removed. The breaking change is recorded here and in the PR body: policy tag `citation-engine-policy/v2`; a policy with fewer regex process slots than operation slots, and any v1 payload, is refused. No limit field or default value changes.
