# Opportunities

## beep-heavy misreads `--` and breaks under the Nix devshell bash

- **Work:** Timing `@beep/schema` builds four ways for Experiment 2, with every
  variant inside one `beep-heavy` admission job (2026-10-09).
- **Friction:** Two separate failures before the driver ran. Passing
  `beep-heavy -- <cmd>` execs `--` itself as the command. Inside the repo's Nix
  devshell, `env bash` resolves to a Nix bash without the `compgen` builtin, so
  the wrapper's env forwarding fails.
- **Evidence:** From
  [`experiments/schema-build-timings.md`](./experiments/schema-build-timings.md)
  "Caveats": "`beep-heavy` must be called as
  `/usr/bin/bash ~/.local/bin/beep-heavy <cmd>` (no `--` separator: it would be
  exec'd as the command)". The shell error text was
  `compgen: command not found`.
- **Proposal:** Make `beep-heavy` accept and drop a leading `--`. Pin its
  shebang to the system bash, or fail fast with a named error when `compgen` is
  missing. Until then, document the `/usr/bin/bash` invocation wherever agents
  are told to wrap heavy commands.
