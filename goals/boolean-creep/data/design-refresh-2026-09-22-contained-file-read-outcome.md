# Contained read P2 audit — 2026-09-22

Exact source HEAD `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Inputs snapshotted before discovery. No canonical/source edits. Source remains qualified4/3 at721/726/734, all four current schema tuples decode; false/Some is an incoherent modeled possibility, not a producer outcome.

Substantive repair: old design omitted new ProofJobLauncher rawRead, three guard-only calls, and Yeet jobLogs. Refreshed migration inventory preserves each caller's own missing/unreadable/error handling; guard-only calls retain no-follow effects. Old source anchors are refreshed. Encoded compatibility retained rather than inferred dispensable from absent local serializers: Effect Option values remain required, all three legal pairs roundtrip; incoherent false/Some rejection is explicit and still subject to independent review. Class constructor/decoded property migration is atomic.

Baseline command `bun run - < <private>/probe.ts` exited0 with empty stderr. Seven read cases cover missing parent, missing entry, directory, nonempty/empty text, target symlink, and injected readFileString failure. Direct assertions check directory/read-failure existence and preservation of empty text; other results were inspected. Four schema projections are decoded and encoded, confirming all four currently accepted and encoded contents remain runtime Option values. Probe does not assert complete containment, filesystem races, all consumers, or future implementation behavior. Fixtures only under this private audit directory.

No P3, census, implementation, full package test, or campaign completion credit. Parent owns canonical integration. Graft grep saved35,057 tokens; callers could not resolve Effect.fn name and supplies no completeness proof. Exhaustive symbol grep plus test/barrel search establishes the discovered local consumer scope.

## Bound input and source hashes

- `input-inventory.jsonl`: `41bd12478546af93581a4ef6d1dc3493aae50930d49c3fcb254d43845f903171`
- `input-design.md`: `499d3483f65e923db83b09487e31be8aef5a957960047da041a4a2e8595937a1`
- `input-row.json`: `bbdcd98844e10a006158a458d5421a05e569621fb2b9b2cbcbe01e4ed03badb5`
- `probe.ts`: `fe5af80d7ef7301fd2eccf6e778a89f7534ddfa5942935c2a69db6d4eee0a0c6`
- `probe.stdout.json`: `57c003dfae938e9bc2d2c19bbc4cf6ccb4ade2b59b95a9df07bf0695afd38596`
- `probe.stderr.txt`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/tooling/tool/cli/src/internal/cli/FsGuards.ts`: `535387a2fda8ae6fe252144fc8f7930605416ea4a5ff4a4331f4480807034c39`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Ack.ts`: `be9e5bca4a76e0ee271079d1aaf33ba2b4ec7241c035b4adee6b2dae63e6319a`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts`: `9760bdca9c2c3fbbe29583164a8981c8ec1d0097a0c234683273c66e6b8e051b`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts`: `6b348ebbb28132c36ea9b9be41489017505e1e588938112e81950b37e7a7d494`
- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`: `bdbc42b979d3475f0620389cf463b1b3721fc9e74b78c5be66bbb5775497c17e`
- `packages/tooling/tool/cli/src/test/Cli.test-kit.ts`: `38fe313dafc47147e802365d7c9041691994dfe68203e54be832ff65a8747694`
- `packages/tooling/tool/cli/src/index.ts`: `19c10f83b6e17ae87269aa30da8f95fb06108e01ef1330f693281b237cd7c6b8`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `packages/tooling/tool/cli/test/cli-kits.test.ts`: `666fc66fc13fe5e306abd0ede63cc8653dadb83029663d2ad3e9c27c53573ce9`
- `packages/tooling/tool/cli/test/yeet-ack.test.ts`: `bd40c642bb39191aed5f1d285b556235c4e6b3e9c843bf7b9a8f54d412c3d440`
- `packages/tooling/tool/cli/test/proof-ledger.test.ts`: `ca30412403489735447880cbfc008be903fbf11bf1da1de5972522cc08cb5b51`
- `packages/tooling/tool/cli/test/proof-job.test.ts`: `3a90707c3bf8bbafef227c3cc34e06c6e2e96eb389c26bebc5e34c7a711618c8`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `.repos/effect/packages/effect/SCHEMA.md`: `4ad8e16a92cbefc9c7cc9759f982645a6a4802fdb18eb2b5f7755f2d30f652a9`
- `bun.lock`: `acba0f05d1f3c47cb1a67598f992b80a8b4b96dada74c267d810c2fb1e1e4794`

## Proposal hashes

- `proposed-design.md`: `0e8c18e8d328cf813405c81ad8b2cac494193adbb34102ecb8bdde3bcb82949d`
- `proposed-row.json`: `bca390290d4bda2d2a5febc2d833435ed92708856de9ad9bf51413e4567611d3`
