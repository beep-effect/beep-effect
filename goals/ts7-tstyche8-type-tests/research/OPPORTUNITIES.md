# Friction receipts

## 2026-10-14 — tstyche 8 beta supports the 7.1 API, not 7.0.2

- Doing: researching the requested beta and three-target type-test matrix.
- Evidence: exact published 8.0.0-beta.0 CLI, with actual package config and
  `--target '5.9.3 || 6.0.3 || 7.0.2'`, exits 1: `Error: The TypeScript
  version '7.0.2' is not supported.` Published ManifestService excludes 7.0;
  Store rejects installed 7.0 and loads 7.1's sync/ast exports instead.
- Prevented by: check the target API/version support before admitting the
  migration; release wording "TypeScript 7 support" does not imply 7.0.
- Resolution (2026-10-14): orchestrator withdrew 7.0.2. Exact 7.1 dev was
  refused; authorized next passes unchanged assertions. The 2026-08-11
  receipt now has a dated follow-up for 7.1 coverage; 7.0 remains excluded.

## 2026-10-14 — default npm cache is outside the lane's writable roots

- Doing: querying exact beta package metadata with npm view.
- Evidence: npm view exits 1, `EROFS` opening `~/.npm/_cacache/tmp/...`.
- Prevented by: use a lane-local npm cache or read registry metadata with curl.
- Resolution: fetched metadata and tarball into a disposable worktree-local
  directory, verified integrity, recorded evidence, then removed only that
  directory. The default tstyche store was also redirected inside the lane.

## 2026-10-14 — heavy admission needs the user-systemd bus

- Doing: dependency build through beep-heavy before package typechecking.
- Evidence: exit 1 before admission: `$DBUS_SESSION_BUS_ADDRESS and
  $XDG_RUNTIME_DIR not defined`.
- Prevented by: export the standard workstation user-bus variables in the
  lane harness.
- Resolution attempt: retry the same wrapper with XDG_RUNTIME_DIR=/run/user/1000
  and DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus.
- Result: retry exit 0 (8 successful dependency tasks). Subsequent type-tests
  and full package-verify also used the admitted wrapper.

## 2026-10-14 — exact 7.1-dev target is not accepted by beta store manifest

- Doing: package beep:type-test on 5.9.3 / 6.0.3 / exact gate-matching 7.1 dev.
- Evidence: exit 1 before assertions: `The TypeScript version
  '7.1.0-dev.20261008.1' is not supported.` ManifestService excludes hyphenated
  versions from versions; only current beta/latest/next/rc tags are added.
- Prevented by: upstream support for explicit prerelease targets.
- Resolution attempt: use orchestrator-authorized `next`, resolving to
  7.1.0-dev.20261014.1 on 2026-10-14. This is a moving target, six days newer
  than the tsc-rs gate pin; pin an exact 7.1 version when beta/stable is listed.
- Result: next matrix exit 0, all 234 assertions passed without edits.

## 2026-10-14 — captured code frames include trailing whitespace

- Doing: validating the untracked packet evidence before handoff.
- Evidence: per-file whitespace check found trailing spaces in
  history/type-test-exact.log, originating in the CLI code frame.
- Prevented by: strip trailing whitespace while capturing public text logs.
- Resolution: trimmed public logs; raw output remains in ignored tmp/; no
  error text or assertion result changed. Re-ran the packet checks.
