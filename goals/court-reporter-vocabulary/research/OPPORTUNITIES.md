# Court reporter vocabulary execution opportunities

## 2026-08-27 - Architecture concept generation conflicts with the live barrel

- Work: add the `CourtReporterVocabulary` value concept through the required
  architecture generator.
- Evidence: `bun run beep architecture add concept law-practice
  CourtReporterVocabulary --domain-kind values --stage core` failed with
  `Architecture operation would overwrite a differing file:
  packages/law-practice/domain/src/values/index.ts`.
- Prevention: the architecture planner should merge a new concept export into
  an evolved package barrel, or emit only the new concept files when existing
  package-level files differ from the accepted proof template.

## 2026-08-27 - Focused package build consumed stale dependency declarations

- Work: run the law-practice-domain package audit after the public contract and
  tests were green in source mode.
- Evidence: `bun run --cwd packages/law-practice/domain beep:audit` failed in
  pre-existing entity models because the built shared-domain `ProductEntity`
  declaration lacked `pg` and `Entity`; the package's `tsgo` source check
  passed immediately beforehand.
- Prevention: package audit should either build workspace dependencies first or
  resolve workspace source declarations consistently, so a focused audit cannot
  silently depend on stale `dist/` state.

## 2026-08-27 - Repository proof coordinator delayed final verification

- Work: run the authoritative `bun run beep yeet verify` after a green repair.
- Evidence: Yeet refused to start because a live sibling checkout owned the
  shared full-proof lock, identifying `beep-effect9` and its active verify PID.
- Prevention: expose a queue or wait mode for the shared proof coordinator so
  an agent can subscribe to lock release without polling or risking overlap.

## 2026-08-27 - Yeet misrouted a policy failure as a security audit

- Work: attribute the final full-proof failure after the typecheck lanes passed.
- Evidence: the pre-push summary identified `quality:lint-policy`, and the
  persisted log identified `lint:jsdoc`, but the generated root packet labeled
  the issue `security-audit` and suggested rerunning OSV even though the
  security lane had passed.
- Prevention: build Yeet repair routing from the failing nested lane rather
  than the parent pre-push step's default category, and retain the nested
  command's diagnostics in the generated packet.

## 2026-08-27 - Dirty-tree verification did not scan staged generated data

- Work: commit the fully verified court/reporter vocabulary artifacts through
  Yeet.
- Evidence: the full verify secrets lane reported `0 commits scanned` and
  passed, while the subsequent pre-commit scan found 48 `generic-api-key`
  matches in public court semantic and lineage identifiers.
- Prevention: on a dirty tree, the verification secrets lane should scan the
  staged and untracked publication scope or report that it has not proved that
  content; generated public-data targets should also declare narrow,
  rule-specific scanner policy when identifier entropy triggers detectors.

## 2026-08-27 - Detached proof accepted residue its reuse guard rejected

- Work: reuse the successful exact-commit proof for a clean push-only publish.
- Evidence: the detached-head verifier completed every lane against commit
  `f1c12a03e9`, but `yeet publish --push-only --reuse-verified` then refused
  with `diff fingerprint changed` after unrelated `.codex` residue was parked.
- Prevention: verification should either require a clean source worktree before
  starting or fingerprint only the detached commit it actually proves; the
  stored proof identity and its reuse predicate must describe the same state.

## 2026-08-27 - Compatibility fixtures covered labels but not semantic fields

- Work: close the hosted review after publishing the vocabulary compatibility
  classifier.
- Evidence: PR review found that retained records with changed hierarchy,
  jurisdiction, parent, or range boundaries could keep the same stable key and
  range count and therefore produce no drift change.
- Prevention: compatibility fixtures should mutate every public semantic field
  family and range boundary, not only produce one example of every emitted
  change label.
