# @beep/semantica

Construction-side canary lab for the D13 document-to-knowledge-graph chain. The
lab is headless-first. Its generated web shell stays minimal while tests and the
CLI provide the proof surface.

`src-tauri` is frozen through C2 under S4. W1 remains out of the repository and
is selected only through its committed manifest under B3. D14's local-only
corpus is excluded from committed inputs and documentation.

The P1 command shape is:

```bash
bun run canary c0 [--manifest <path>] [--paper <id>] [--offline]
bun run canary c1 [--manifest <path>] [--paper <id>] [--offline]
bun run canary c2 [--manifest <path>] [--paper <id>] [--offline]
```

P1 exposes these commands but fails each stage with `StageNotImplemented` until
the corresponding canary implementation lands.

## Development

```bash
bun run dev
bun run canary c0 --offline
bun run check
bun run test
bun run lint
```

The contract behind the ids above (D13, S4, B3, D14) is `goals/semantica-canary/SPEC.md`;
the law table is `explorations/semantica-lab/DECISIONS.md`.

This workspace exports nothing reusable. Keep app internals behind `@/*` and
promote earned code to a durable owner before another workspace imports it.

## License

MIT
