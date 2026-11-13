# Cache review for the `@beep/jsonc` dependency added in #3193

Reviewed on `main` @ 3a853d673ce. Reviewer: Claude Fable 5.2
(declaration-only-builds session).

`bun run beep quality cache-policy` fails on `main` with 14 blocking
`configuration-drift` findings in three subjects:

- `@beep/epistemics`: `build`, `check`, `lint:deprecated-apis`, `test`.
- `@beep/md`: `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`,
  `test:property`.
- `@beep/party-domain`: `build`, `check`, `lint:deprecated-apis`, `test`.

## Cause

#3193 (canonical-digest-owner slice C) added `"@beep/jsonc": "workspace:^"` to
the `dependencies` of those three manifests and did not re-record this
baseline. A workspace dependency is an edge in each package's task graph: the
drifting tasks depend on `^build`, so their upstream set now includes
`@beep/jsonc#build`.

## Judgement

The change is a dependency edge only. No task command, cache flag, input glob,
output glob or environment variable changed in the three packages, and
`@beep/jsonc` itself is unchanged. Recording the new configuration grants no
qualification; it restores agreement between the reviewed policy and the
manifests already on `main`.

After the record, `bun run beep quality cache-policy` reports 0 blocking
findings.
