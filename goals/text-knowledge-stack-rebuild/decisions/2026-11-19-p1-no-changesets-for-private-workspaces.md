---
title: "P1: no changeset is written for a private workspace; each breaking change is recorded in a P1 decision file"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Make the touched packages public by a decision file and write their changesets in the PR that publishes them; the P1 decision files then become the changeset text."
---

P1 ruling 11, withdrawing section 5.5 (changesets) of the registry-first design. Every package P1 touches is private (package.json private true: @beep/identity 0.1.1, @beep/schema 0.1.2, @beep/semantic-web 0.0.2, @beep/jsonc, @beep/rdf, @beep/test-runner and @beep/ontology 0.0.0, and the slice packages), and repo-sanity forbids a changeset that names a private workspace (packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts:652-671, "private workspaces must not accumulate release notes"). So P1 writes no changeset. Each breaking change is recorded in a P1 decision file instead: the composer surface and annotation record of @beep/identity (2026-11-19-p1-registry-first-fold-terms-declared), the fold signature of @beep/ontology (same file), the IRI schema move out of @beep/rdf (2026-11-19-p1-iri-schemas-re-home-under-identity), the test-runner identifiers (2026-11-19-p1-test-runner-iris-re-minted-from-the-registry) and the IdentityEntry shape of @beep/semantic-web (2026-11-19-p1-identity-authority-moves-to-its-own-module). The SPEC Constraints Delivery sentence about majors is amended to say so.
