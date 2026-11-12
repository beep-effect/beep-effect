---
title: "Job-level lane relevance for Codegen, Ecosystem, Nix, IPC, SAST and Security, and the docs-only Security and SAST skip"
date: 2026-11-12
lane: "perf/ci-applicable-checks"
reversal: "Revert the perf/ci-applicable-checks PR; or delete the lanes rows from ciOperationalPatterns and drop the needs and if lines from the security and sast jobs, which restores today's always-run Security and SAST."
---

The operator asked on 2026-11-10 for CI to run only the checks applicable to a change, in one PR. That PR lands PERIH-04's job-level relevance and extends it to SAST and Security.

- `beep ci change-profile` emits `codegen_relevant`, `ecosystem_relevant`, `nix_relevant`, `desktop_ipc_relevant`, `sast_relevant` and `security_relevant` from the `lanes` rows of the pattern data. Codegen, Ecosystem, Nix and IPC carry the path gates those jobs applied after checkout, widened with the gate sources (CiLane.ts, the CiOperational files, check.yml) and, for Codegen, the merge-driver bootstrap inputs (.gitattributes, the Git and Worktree commands).
- Every job guard reads `!= 'false'`. The pinned binary (beep-ci-d15ecf4ca610) predates the outputs, so the job-level skips take effect only at the next pin bump. Until then the step gates read the same rows with jq and grep -E; a test proves grep -E and the binary's RegExp agree on every row.
- Labs stays excluded, as the PERIH-04 ruling requires.
- Security and SAST now wait on Change Profile. On a docs_only diff, or when their relevance is false, they skip at job level. Security's verdict then depends only on main plus the live advisory database and GitHub settings. Every main push still runs it, because a push always gets the full profile. This reverses the agent choice in #2935 that kept Security and SAST in force on docs-only PRs. Semgrep never scans Markdown, and docs_only no longer admits JS/TS or dependency manifests.
- Security's relevance covers every manifest GitHub's dependency graph recognizes, plus the whole `@beep/repo-cli` workspace closure that implements its GitHub policy reads. SAST's covers the same closure, which dispatches it. A census test walks the workspace graph from `@beep/repo-cli` and fails if a closure member leaves those rows. An independent review (Codex `gpt-6.1-sol`) found both gaps in the first draft of this PR.
- CodeRabbit found two more gaps in the carried-over gates. Codegen's row now covers the generators' workspace closure (codegen-kit, identity, schema, utils), inside the same CLI closure its `worktree prepare` bootstrap runs through. Every lane's gate sources now include the shared setup actions (setup-monorepo-ci, setup-bun, fetch-beep-ci). The census test now checks each lane against the closure of the workspaces its job executes.
- PERIH-05 and PERIH-06 (Nix, Security and SAST without the workspace install) and HOST-09 (the PR Size fold) remain open.
