# Cache baseline review: P2 moves `@beep/provenance` to `@beep/text`

Date: 2026-11-22. Lane: P2 of `goals/text-knowledge-stack-rebuild` (L1 text), lane base
`d9a5d241b0d`, recorded on top of `d1533ea9ef4`.

## What changed

P2 creates `@beep/text`, moves the three provenance modules into it and retires `@beep/provenance`
(`de45e1c1d67`, `010f21e3934`). Every consumer's manifest swaps the dependency, so every task that
depended on `@beep/provenance#build` (or `#transit`) now depends on `@beep/text#build`. Later commits
add edges for other reasons:

- `5211c736457`: `@beep/text` depends on `@beep/jsonc` (`definePreimage` mints occurrence ids and
  quote keys).
- `d885ffd40fc`: `@beep/law-practice-server` depends on `@beep/jsonc` (the mention preimage).
- `efb82ea41bb`: `@beep/rdf` depends on `@beep/text` (the Web Annotation codec).
- `2705cb40618`: `@beep/party-domain` depends on `@beep/text` (`TextOccurrence`).
- `e002c0381e7`: `@beep/md` depends on `@beep/text` (`Md.anchors`).

`010f21e3934` also replaces `packages/foundation/modeling/provenance/package.json` with
`packages/foundation/modeling/text/package.json` among the root task inputs in `turbo.json` (the
policy-fingerprint input list).

## Finding

`bun run beep cache audit` reported 111 blocking findings and one review finding:

- `configuration-drift` on the build, check, doctest, lint:deprecated-apis, test and test:property
  tasks of the 20 consumers below: the dependency edge renamed from `@beep/provenance` to
  `@beep/text`, plus the new edges listed above.
- `unreviewed-expansion` on the ten tasks of `@beep/text`, a new subject.
- `configuration-drift` on `//#lint:policy-fingerprint`, and `configuration-source-drift` on
  `turbo.json`: the renamed input path.

## Review

Every drift is a dependency edge or an input path that follows the moved package. No command, cache
flag, output, environment entry or pass-through variable changed in any consumer. `@beep/text` runs
the generated script block of `bun run beep create-package`; against the retired
`@beep/provenance` file it differs only in that generated block (the `test/integration/**` exclusion,
`--passWithNoTests` and the `test:integration` task that the scaffold writes) and in
the `@beep/jsonc` edge. The record grants no qualification.

The root re-record also takes one inherited change that the audit does not report, because it only
reduces reuse: `abfefff816c` (P1 PR C, in the lane base) set `"cache": false` on
`//#lint:identity-registry`, since the lint reads git state that no Turbo input hashes. The committed
root file still recorded `"cache": true`; it now records the task as uncached, as `turbo.json`
declares it.

## Subjects

`//`, `@beep/agent-memory-store`, `@beep/epistemic-domain`, `@beep/epistemic-server`,
`@beep/epistemic-tables`, `@beep/epistemic-ui`, `@beep/epistemic-use-cases`, `@beep/epistemics`,
`@beep/file-processing`, `@beep/langextract`, `@beep/law-practice-domain`,
`@beep/law-practice-server`, `@beep/law-practice-use-cases`, `@beep/lejeune-bolt-workbench`,
`@beep/md`, `@beep/party-domain`, `@beep/professional-desktop`, `@beep/rdf`, `@beep/repo-cli`,
`@beep/semantica`, `@beep/text` and `@beep/workspace-server`.

The retired `@beep/provenance` is not a subject: it is no longer in the task graph, and
`bun run beep cache baseline` refuses it as unknown. Its committed file's digest is in the request's
`previous`, and the command drops the file as a subject that left the graph.
