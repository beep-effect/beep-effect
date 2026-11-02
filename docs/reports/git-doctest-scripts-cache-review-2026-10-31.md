# Git doctest scripts cache input review

PR #2413 adds pure runtime documentation examples to the Git driver. Final-check
found that the generated package scripts did not yet expose its doctest lane.
`beep lint package-scripts --write` added exactly these two scripts and reordered
the scripts block canonically:

- `doctest`: `bun run beep:doctest`
- `beep:doctest`: `BEEP_VITEST_DOCTEST=1 bunx vitest run`

Every pre-existing script value and every manifest field outside `scripts` is
unchanged. The root manifest and Turbo configuration are unchanged in this wave.
The prior Git manifest SHA-256 is
`bd821cb57cc1952ce030af3134e7b83b91de9e6f2ff2215c2ab39228e634e1bf`;
the generated manifest SHA-256 is
`2a20ab60cec0505e2766810cd5be2c8de8bbf871f32b9a038e8c409bdd64c103`.

The complete audit names exactly these nine computations. Their one baseline
subject is `@beep/git`:

| Drifted computation | Input change being reviewed |
| --- | --- |
| `@beep/git#build` | Git package manifest bytes changed as described above; existing command unchanged. |
| `@beep/git#check` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#docgen` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#doctest` | Newly generated task runs the existing runtime documentation examples. Record only its unassessed legacy posture. |
| `@beep/git#lint` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:deprecated-apis` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:jsdoc` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:laws` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#test` | Same manifest-byte change; existing command unchanged. |

Full Git package verification passes audit (27.3s) and docgen (3.1s). The newly
enabled doctest command passes 50 examples across five source files. The policy
fingerprint remains current, and the audit has no other blocking subject.

This review authorizes re-recording only `@beep/git`, including the named new
unassessed doctest computation. It grants no cache qualification, adds no
exception and changes no task inputs, outputs or cache flags. Preserve existing
scope, profile and epoch exactly. Bind the request to the exact current baseline
text and this basis by SHA-256. Every other subject and qualification remains
unchanged.
