# Policy and runtime portability repair

Date: 2026-10-09. Supplemental local proof after PR #1571 head `6aaa7f3`.
The original live provider receipts retain their original source/executable
digests. This repair does not claim a new live provider or native Desktop proof.

Hosted Lint Policy exposed eleven inline schema compilations, fifteen callback
forms contrary to the Effect function law, forty JSDoc warnings, and a fixture
outside ESLint's TypeScript project. All were introduced by this initiative.
The correction hoists reusable schemas/encoders, uses `Effect.fnUntraced` for
the same callback bodies, repairs the documentation, and gives the process
fixture a real adjacent TypeScript project. No suppression or baseline waiver
was added. Package lint alone had not covered the root policy checks.

Hosted Node coverage also failed sixteen suites during import because the new
command graph eagerly loaded the Bun SQLite driver. The corrected store layer
loads the current runtime's real SQLite driver only when its effect runs. Both
drivers retain scoped acquisition, Reactivity, private-path validation and the
250 ms production busy timeout. Driver-load failure is a sanitized typed error.
The internal factory is excluded from the public command facade; its private
test alias supports real database and child-process tests in both runtimes.
The Node driver uses the existing catalog pin, adding one dependency and one
workspace lock entry. Generated package scripts are unchanged.

The process fixture uses a scoped platform layer and runtime entrypoint. Under
Node coverage its child runs Node; under Bun tests its child runs Bun. No suite
was skipped and no mock replaced SQLite or the child-process boundary.

## Local verification

- Node coverage first reproduced the import failure with zero collected tests.
- The repaired Node run passed all sixteen formerly failing suites:
  **350 tests**, 145.93 seconds, including the real router/storage/process tests.
- The final Bun router run passed **48 tests**, 17.06 seconds.
- Provider policy repairs passed **19 native transport tests**, 14.41 seconds.
- Exact root-config Oxlint and package Effect laws passed for the changed code.
- Normal CLI-directory ESLint and the deprecated-API fixture/source profiles
  passed with zero warnings. Fixture and test TypeScript checks passed.
- Final CLI quick package verification passed: lint 5.0 seconds and check
  10.3 seconds. Provider quick verification passed: lint 5.1 seconds and check
  2.9 seconds.
- Fresh package Docgen metadata checks passed without proof-manifest reuse.
  CLI documentation generated with 2,356 compiled examples.
- Independent reviews of the provider refactor, command refactor and SQL
  portability boundary each found zero actionable introduced findings.

These are source-bound local checks, not proof of the subsequent integrated
commit's hosted readiness, merge, or native Desktop attachment. Any later main
integration retains its own final-head checks and review-window requirement.

## Source anchors

SHA-256 values for the portability boundary and command refactor:

| Path | SHA-256 |
| --- | --- |
| `packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.layer.ts` | `00a2ea46fa93963bd78f7f17b0db9d671ba3c8709eaa09324a5f97ec50245731` |
| `packages/tooling/tool/cli/src/commands/AgentMessage/index.ts` | `1c9f63eb9fad5cb510df029196c7685e9ddbe49e69cb79949894430d1ef76ddf` |
| `packages/tooling/tool/cli/test/fixtures/agent-message/process.ts` | `ac9d3fe83e29d1da96e9bc99382f6648900f031d6b0d13fc7b39188e0e8fb047` |
| `packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.command.ts` | `ad85a5eca338adc57b2c575793304ba69b88e92377440dc9aa5ca16db7e7ea14` |

The deferred P2 findings remain tracked in issues #1576, #1578, #1579, #1581,
#1582, #1586 and #1587; this repair does not silently mark them fixed.
