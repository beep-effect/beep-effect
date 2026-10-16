# Reviewer host access and ready-event gap

Date: 2026-10-14 (America/Chicago). PR: #1750.

## Observed cause and recovery

DankStation could ping `grok-bot-box-1.tailc7c348.ts.net` (`100.114.108.14`),
but TCP 22 and 2222 over IPv4 and TCP 22 over Tailscale IPv6 were refused.
The authenticated Grok Bot gateway on TCP 1340 remained available.

The operator authorized a bounded read-only diagnostic message to Greptile
through that gateway. It reported hostname `grok-bot-vm-402905734`, runtime user
`box`, PID 1 `tini`, no systemd, no installed/running sshd or SSH listener, and
Tailscale `RunSSH: false`. Firewall and privilege observations were inconclusive;
no firewall claim is needed to explain the absent listener.

A fresh read of the live tailnet policy confirmed the owner already has network
access and a Tailscale SSH rule permitting `box` on `tag:grok-bot`. No policy
change was needed. The operator separately authorized enabling Tailscale SSH.

Greptile reported:

1. `tailscale set --ssh=true` as `box` failed with access denied and changed nothing.
2. The same command through existing `sudo -n` exited zero; `RunSSH` became true.
3. No packages, credentials, ACLs, firewall, reviewer routines, or checkouts changed.

A fresh command from DankStation verified the real access path:

```sh
tailscale ssh box@grok-bot-box-1.tailc7c348.ts.net \
  'hostname; id -un; test -z "${SSH_AUTH_SOCK:-}"'
```

It exited zero and returned the expected hostname and `box`; no agent was
forwarded. The gateway remained reachable after enabling SSH. This verifies
command execution, not a reboot-persistence or privileged-workload test.

Rollback on the bot, through its existing privilege route:

```sh
sudo -n tailscale set --ssh=false
```

Keep the authenticated gateway available if rollback is needed. No SSH daemon
installation or authentication-policy weakening was performed. Credentials were
resolved through the approved agent-side `op` path and retained in process memory;
none were sent in messages, printed, or committed.

## Why the required review was absent

The reviewer itself is active. Its reported CLI checkout is
`/workspace/beep-reviewer-app`, detached at
`4c8a184bad23c9b4263ed415402bf7795d3d0a47`. The local workflow is
`/home/box/agent-data/workflows/greptile-format-pr-review/`; the routine identifier
is `beep-effect-greptile-pr-review`. Its server-saved prompt is not readable from
that host, so the exact persisted routine text was not independently inspected.

Greptile initially repeated an older draft-skip log. A requested live re-read
confirmed #1750 was ready at `95de14e8c29d4740b14b2a1f19a4fe371a78a628`.
Its previous push-triggered run had read draft=true around 5:02 p.m. Central.
The routine handles opened, pushed, merged and commented events, but not
`ready_for_review`; the later ready transition did not enqueue the same head.
A new push/comment or explicit manual review is required. No review or successful
check was requested or fabricated during this diagnostic. Trigger parity is an
observed follow-up; no routine was changed.

## Main reconciliation and qualification boundary

The old head's hosted Heavy Check, Build, Docgen, Doctest and Integration checks
passed. Coverage and Lint Policy were still running at the observation. Those
results qualify that source head only.

Main subsequently landed #1775, which duplicates this branch's required-context
repair and additionally validates the reviewer App binding. The merge conflict
in CiGovernance is resolved by adopting main's canonical implementation and test
file, retiring the branch-only validator export/test. Exact-name validation and
App integration checks remain enabled; no live ruleset is changed. Fresh focused
checks and hosted qualification belong to the new merged head.

### Publication unblock follow-up

The first publish attempt after reconciliation passed 15 of 16 cheap gates and
stopped without pushing. Its sole failure was the inherited knowledge-App
bootstrap export `makeKnowledgeMintHandler`, consumed through a subprocess test.
PR #1782 was closed without merging because #1781 had already landed the canonical
symbol-scoped Fallow entry on main (`bfe6176ca24c3127151c3192c0c203cee9baa965`).
The readiness branch adopted that landed repair through main; it did not duplicate
the competing suppression or waive the gate. Publication must rerun on the merged
head. Earlier hosted success and the failed local preflight remain source-bound.

The retry after adopting #1781 passed every Fallow check. Main's newly introduced
observability catalog gate was its sole failure: this branch adds 16 tooling
span declarations relative to main's generated catalog. The canonical
`beep observability catalog --write` refreshed the catalog and generated standard
section; a separate `--check` passed. No policy or regression baseline changed.
The subsequent publication rerun qualifies the final committed generated inputs.
