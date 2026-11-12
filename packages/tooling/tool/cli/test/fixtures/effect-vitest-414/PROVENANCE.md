# Effect Vitest 4.1.4 fixture

Source: Effect tag `@effect/vitest@4.1.4`, commit
`289a53f7b1fc40049219c6e69022db2fb859c356`.

Compared all nine files named in `standards/effect-vitest.primitives.jsonc`
against tag `@effect/vitest@4.1.2`
(`506eef143bcc1750ce58920aac1e45da7265d103`) in the local Effect reference
checkout. Eight are byte-identical between the tags, so their source anchors,
excerpts, full-file hashes, and public API examples remain valid at 4.1.4.

`packages/effect/src/testing/TestClock.ts` changed: upstream rewrote the clock
as a class for cheaper construction (Effect #10326) and stopped warning setup
from interrupting masked finalizers (Effect #10520). The two anchored
declarations, `TestClock.adjust` and `TestClock.withLive`, are byte-identical;
only their lines moved (632-633 to 647-648 and 707-708 to 722-723).
`testClockWith` still reads the current Clock and casts it to `TestClock`, so
the graph's descriptions and gotchas for both entries still hold. The
charter's full-file hash and both anchors were updated.

The package release changes only `packages/vitest/CHANGELOG.md` and
`packages/vitest/package.json`: version and Effect dependency metadata.
The primitive graph tests independently check the 110 source anchors and compile
the examples against the installed package. The fixtures retain the source
license.
