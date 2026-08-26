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

## 2026-08-26 — Codex background dispatch dies silently; wrapper claims success

- **What happened:** four analysis lanes were dispatched through the codex
  companion for the Session B research sweep. One returned a task id
  ("Codex Task started in the background as task-...") and then never
  appeared in `status --all` and never wrote a job state file under the
  companion state directory. Nothing surfaced the failure; the lane was
  simply absent from every poll.
- **Evidence:** the missing lane's task id had no
  `jobs/task-*.json` entry while its three siblings did; a relaunch of the
  identical prompt through a direct background `codex exec` succeeded first
  try.
- **What would have prevented it:** treat the wrapper's started message as an
  unverified claim — confirm the job state file exists before counting a lane
  as dispatched, and relaunch through direct `codex exec` rather than
  resuming.
- **Disposition:** operational protocol — folded into the codex fan-out
  memory; candidate for a dispatch-verification step in any future fan-out
  tooling.
- **Owner:** next multi-lane research session.

## 2026-08-26 — Codex sandbox rejects report paths outside its cwd root

- **What happened:** the rung-4 implementation lane was told to write its
  report to a staging directory outside the checkout. Its first action was
  rejected ("writing outside of the project"), it fell back to a temporary
  path, and the report had to be recovered from there by the orchestrator.
  The three analysis lanes, pointed at a path inside the repository, wrote
  where they were told with no friction.
- **Evidence:** the lane's own report records the rejection verbatim and
  names the blocked destination; the recovered copy carries the note.
- **What would have prevented it:** lane prompts that place every deliverable
  inside the repository the lane is rooted in — the sandbox's writable root
  is the lane's cwd.
- **Disposition:** prompt-template fix — the fan-out recipe now pins report
  paths under the packet's `research/` directory.
- **Owner:** next codex fan-out session.
