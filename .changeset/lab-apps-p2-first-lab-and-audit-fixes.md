---
"@beep/repo-cli": patch
"@beep/identity": patch
---

Close the five create-package/changeset defects the first lab app would have
hit, and scaffold `apps/labs/trustgraph-workbench` as the D13 acceptance proof.

`--reuse-retired-name` now actually removes the entry from
`standards/changesets.retired-packages.json`, so a sanctioned recreation
restores the name's provenance instead of leaving the registry claiming a live
package is retired. Lab dependency tables declare only what the emitted
templates import, so a generated lab passes the Knip gate. `--parent-dir
apps/labs` without `--lab` is refused. The Fallow entry globs cover the
`service` AppKind's `src/main.ts`. And `bun.lock` is a lab-exempt companion
path, without which the ratified lab-only changeset exemption was unreachable
for every real lab PR.
