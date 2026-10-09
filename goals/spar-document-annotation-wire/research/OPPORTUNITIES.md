# Friction receipts

## 2026-10-09 — Heavy wrapper requires the user-session bus

During dependency build preflight, `beep-heavy zsh -ic 'bunx turbo run build …'`
exited 1 before starting a gate: `Failed to connect to user scope bus` because
`DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were undefined.
Recovery: supply the existing user runtime directory and session bus address to
the wrapper, retaining admission and memory limits. A launcher preflight that
exports the existing session bus would prevent this failure.

## 2026-10-09 — Unary dual and template-number checks need installed API validation

While authoring the source-id/fold API, inspection of installed
`effect/dist/Function.js` showed `dual(1, …)` throws `Invalid arity 1`.
The unary fold is already usable as a direct data-last function, so it uses
that form. Installed `Schema.js` documents that `TemplateLiteralParser`
applies checks on number parts; a plain `TemplateLiteral` matches the number
syntax. The source-id schema therefore adds a named canonical-index pattern
check. Neither issue was deferred to a failing package run. A skill note on
unary utilities and checked numeric template parts would prevent the detour.

## 2026-10-09 — Hosted-parity knowledge check inherited a host-path red

`CI=true bun run beep knowledge refs --check` exited 1 with one live gated
observation: `external-mirror-reference` in the repository-simplification-
confidence SPEC, line 374 (`home-absolute`). The affected file is byte-identical
to `origin/main` and was not edited in this lane. Attribution: inherited,
owned by the shared-main repair; this lane preserves the packet boundary.
A preflight that identifies changed-path versus base findings would prevent
feature lanes from rediscovering the same inherited red.
