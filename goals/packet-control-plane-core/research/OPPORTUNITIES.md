# Opportunities — friction receipts

## 2026-08-26 — Unrelated fixer writes surface as another package's test failure

- **What happened:** `bun run beep yeet repair` on the rung-4 branch ran its
  repo-wide deterministic fixers, which rewrote nine files across five
  packages the branch never touched (semantica lab, runpod driver, ui-system
  editor, codegen-kit, docgen internals). The only visible symptom was
  `feedback:test` failing with `@beep/repo-cli#test`, and the resulting quality
  packet named a `changeset-policy` error against `@beep/repo-cli` and routed
  it to `quality-review-fix-loop`. The tests were green throughout. The real
  cause was `changeset-status` counting those five untouched packages as
  changed product workspaces with no changeset naming them.
- **Evidence:** `.beep/yeet/packets/beep_repo-cli.md` (changeset-policy, 1
  blocking); the repair log's `feedback:04-test` failure; `git checkout --` on
  the nine unrelated paths followed by `beep quality changeset-status --since
  origin/main` reporting `product_workspaces=0 blocking_paths=0
  verdict=enforced` with no other change.
- **What would have prevented it:** two things. The changeset gate should name
  the working-tree paths that made each package count as changed, so the
  operator can see at a glance that the paths are not theirs. And repair
  should report the files its repo-wide fixers wrote outside the branch's
  own change set, rather than leaving them to be discovered through a
  downstream lane failure attributed to a different package.
- **Disposition:** tooling fix — candidate for the fleet campaign's own
  quality rungs, since that campaign will run repair across every packet and
  will hit this on every wave.
- **Owner:** next repo-quality lane.
