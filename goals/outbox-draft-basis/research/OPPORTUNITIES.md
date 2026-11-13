# Opportunities and friction

Receipts recorded while the work happened, newest last.

## 2026-11-12: the packet changed on `main` while its lane held a private copy

- Doing: building the first pull request in a lane cut on 2026-11-10, when
  the packet existed only on a local branch and was copied into the lane.
- Evidence: #3120 merged the packet two days later with a new decision
  (`creation checks the caller's view before pinning`) that changed the
  `create_draft` contract. The lane had to drop its copy, fast-forward, and
  re-apply its packet edits by hand; the first build of `create_draft`
  lacked the check.
- Would have prevented it: landing a graduated packet on `main` before any
  lane starts work on it, so a lane never carries a private copy.

## 2026-11-12: a live re-check could not authenticate

- Doing: re-running a read-only live check of the basis reader with
  `op run --env-file=packages/drivers/m365-mcp/outbox.env`.
- Evidence: the service-account lane answered `Too many requests. Your
  client has been rate-limited`. With `OP_AGENT_BACKEND=connect` the env
  file resolved (`op run ... -- true` exited 0) but the first Graph call
  failed with an `M365Error` whose message was empty. Not diagnosed.
- Would have prevented it: a doctor line that proves the outbox env file
  yields a working token on each backend, and an `M365Error` message that
  names its redacted reason.

## 2026-11-12: `yeet repair` rewrote files outside the change

- Doing: `bun run beep yeet repair` on a lane that touched one package.
- Evidence: seven files under `packages/tooling/**` came back modified by
  the terse-helper fixer; they were reverted by hand.
- Would have prevented it: scoping repair's fixers to the changed packages.

## 2026-11-13: the mailbox answered 502 and 504 when the proof was due

- Doing: creating the tenant proof's test draft through the outbox's live
  services.
- Evidence: four read attempts on the mailbox's messages and events over
  about ten minutes answered `response status` 502 or 504, while
  `graph.microsoft.com/v1.0/$metadata` answered 200. The service-account
  1Password lane was still rate-limited, so the Connect backend was used.
- Would have prevented it: nothing on our side; a retry later is the fix.
  A driver error message that carried the status would have saved one
  diagnostic script.

## 2026-11-13: a pull request merged while its final-check was still running

- Doing: `bun run beep yeet final-check` on the first pull request's head.
- Evidence: #3137 was marked ready two minutes after it was published and
  merged 23 minutes later; the local final-check was 56 minutes in and had
  not finished. It was stopped by process id after the merge.
- Would have prevented it: a final-check that reports which gate it is on,
  so a stuck one is visible, and the merge gate waiting for the owner's
  ready flip.
