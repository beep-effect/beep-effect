# Fixtures

## `exit3.mjs`

Hand-written for `CliTest.test.ts` — there is no tool that generates a CLI
fixture bin, so this is not a re-baselinable oracle output; it is a small
program authored to pin `CliTest.run`'s contract.

It exits `3`, writes exactly one line to `stdout` and one to `stderr`, and
echoes anything it received on `stdin` back on `stdout` prefixed
`stdin=`. It exists to prove three things `CliTest.run` promises:

- a **non-zero exit code comes back as data**, not as a failed effect;
- **both streams are captured independently** (the `stdout` line differs from
  the `stderr` line, so a test that swaps them fails);
- `stdin` reaches the child, and **omitted or empty stdin still lets the
  process exit** — it must never hang waiting on an open pipe. The
  `stdin=` line is only written when input was non-empty, so its absence in
  the omitted/empty case is itself part of what the fixture pins.

`process.env.HOME` is echoed so a test can assert `CliTest.sandbox`'s `HOME`
reached the child process, proving the sandbox environment — not the host's —
was used.

## `live-view.ts`

Hand-written for `ui/CliUi.live.reach.test.ts` and `ui/CliUi.live.final.test.ts`: a live view's own module, as a
consumer writes one, importing Ink and React as values and counting its loads on `globalThis.liveViewLoads`. It is
only ever reached through `CliUi.lazyView`, so a test can tell whether a run loaded it, and with it React and Ink.
