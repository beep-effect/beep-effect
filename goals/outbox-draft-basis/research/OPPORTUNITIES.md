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
