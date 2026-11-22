# Effect Vitest 4.1.5 fixture

Source: Effect tag `@effect/vitest@4.1.5`, commit
`e3aca1f1484e623cee09b7f3fa18d6ff5d66c0e8`.

Compared all nine files named in `standards/effect-vitest.primitives.jsonc`
against tag `@effect/vitest@4.1.4`
(`289a53f7b1fc40049219c6e69022db2fb859c356`) in the local Effect reference
checkout. Seven are byte-identical between the tags, so their source anchors,
excerpts, full-file hashes, and public API examples remain valid at 4.1.5.

`packages/effect/src/Arbitrary.ts` changed: upstream added generation
diagnostics to `SampleError` and `Exhausted` and widened `Arbitrary.all` to
symbol keys. `packages/effect/src/Effect.ts` changed: upstream widened
`Effect.all` to symbol keys and documented the interruption and cleanup
guarantees of races and timeouts (Effect #10683, #10731). Every anchored
declaration in both files is byte-identical and only moved lines, so the
graph's descriptions and gotchas still hold. The charter's full-file hashes and
the fourteen anchors in these two files were updated.

The package release changes only `packages/vitest/CHANGELOG.md` and
`packages/vitest/package.json`: version and Effect dependency metadata.
The primitive graph tests independently check the 110 source anchors and compile
the examples against the installed package. The fixtures retain the source
license.
