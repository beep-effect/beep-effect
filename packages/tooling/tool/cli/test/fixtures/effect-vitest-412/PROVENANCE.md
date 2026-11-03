# Effect Vitest 4.1.2 fixture

Source: Effect tag `@effect/vitest@4.1.2`, commit
`506eef143bcc1750ce58920aac1e45da7265d103`.

Compared all nine files named in `standards/effect-vitest.primitives.jsonc`
against tag `@effect/vitest@4.1.1`
(`bc492f0965dc0f6a83cefd141071c5ead10f7efa`) in the local Effect reference
checkout. All nine files are byte-identical between the tags. Their source
anchors, excerpts, full-file hashes, and public API examples therefore remain
valid at 4.1.2. The fixtures retain the source license.

The package release changes only `packages/vitest/CHANGELOG.md` and
`packages/vitest/package.json`: version and Effect dependency metadata.
The primitive graph tests independently check the 110 source anchors and compile
the examples against the installed package.
