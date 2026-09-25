# @beep/agents-client Agent Notes

- This package is the `client` role package for the `agents` slice.
- Hosts the desktop chat surface atoms (`src/Chat.atoms.ts`) backed by the
  `ChatRpcs` wire contract declared in `@beep/agents-use-cases/public`.
- Atoms are browser-targeted (`@effect/atom-react`, `effect/reactivity`)
  and require a live rpc server to run; type-check and lint are the gates.
- Keep package-level wiring here and add concept-qualified modules through
  `beep architecture add concept` or `beep architecture add role`.
