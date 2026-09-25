# P2 source audit: resolved test-lane selection

Source HEAD: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.
Private proposals only. Canonical inventory/design and all product files untouched.

## Input and source hashes

- Private `input-inventory.jsonl`: `b276f0b0ffccccc39779394df44c219945a091dd5fdea8513daa66049ffc6ed5`
- Private `input-design.md`: `98cead274247f4a33b762490d7994792c69bbc65fbcabfd40cc9b3308f182e3d`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: `c64ec0e4b0113fe376cdc8a55cff5b0db6f45da6026c8eab6271197a77d92124`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`: `9ab84576de8a94dec07f35d0b483f4e92dcafafec3f17437e8db96eb10fdc515`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.runtime.ts`: `baadcd12bce60347fad5847886185ba9419bc75707382bf6c0287b52c6226ecc`
- `packages/tooling/tool/cli/src/test/Quality.test-kit.ts`: `5f1b6dad7ae20d94f7002db5834bee869019d933fe8bb48cc747299e2cf2dc81`
- `packages/tooling/tool/cli/src/commands/Quality/index.ts`: `3902f6a6eb22127dc2b1d12cd23fb83f9b49c8f6413b7cb3d86216ea767455a1`
- `packages/tooling/tool/cli/package.json`: `917dc5e460d2a61b7a9acdc969bb851e475fd4f74015b43a81ad40a111ee60f1`
- `goals/turborepo-task-qualification/research/refresh-root-quality-plans.ts`: `6d7702b39adb605bc7e3b4b4f5622b2fc268f726e7635ad14cc619ebaec8a3cc`
- `goals/turborepo-task-qualification/research/root-quality-downstream-review.md`: `35e2cc03facba80b5e392be575539b06173b56ed9da3f441aeb84dd0daca03b2`
- `goals/turborepo-task-qualification/research/runtime-enforcement-boundary.json`: `599c016102532f47866e5202d533b161205f309b66156ad2a38d8049274f53b1`

## Adjudication

Retain designed, E4/E1, derived/internal Tier1 4/3. Exactly three normalized
outputs; raw false/false remains valid and outside this owner. Source anchors
refreshed directly, replacing old chained line maps.

The source diff from prior design HEAD7536a751 includes cache runtime routing
and caller identity rejection. Preserve this execution path, not historical
bunx spawn assertions. Pure planning and actual spawned argv differ.

Repository-wide Graft found one omitted goal diagnostic writer. Its serialized
pair is a real encoded surface. Preserve it via one-way projection at the
existing writer, while parser/runtime use only mode. Existing historical review
hashes remain historical, not silently updated. This does not turn the owner
into a production persisted domain: exposure remains internal, with explicitly
accounted diagnostic encoding.

Failure accounting corrected: collected process failures continue through
later lanes, but discovery/acquisition and other Effect errors may abort.
SQL acquisition stays after serial argument discovery in the same scope.

## Checks performed

Current exported parser executed over all 1555 sequences of length0–4 over
six tokens; resolved pairs exactly01/10/11 and exact ordered arguments matched
an independent raw-token expectation. Probe exited0; the saved parser-probe.ts repeats the same experiment. No runtime
subprocesses, SQL services, package verification or P3 review ran.

All eight required headings exist. Proposed row retains schema contract.
Full-source Graft search examined5442 indexed files; scoped searches covered
parser consumers and runtime helpers. RootTestLaneMode has no current package
source occurrence, so proposed private symbol does not duplicate that name.

## Limitations

Bounded parser probe is not all CLI strings or runtime orchestration proof.
Implementation remains gated; no actual schema or package files were authored.
Whole-corpus census, P3 and package quality are parent-owned later work.

## Outputs

- `proposed-design.md`: `537a2209bdf45651cc8b6d9e8c4510a0061061dab7fee05c3a921ce5c058de3e`
- `proposed-row.json`: `772c0d9dc5d426ecdc8bb4cb4c3d88d4796ca98f48b2b37f9e5d0023152d1486`
- `parser-probe.json`: `0742d6ae749d823a313d3b33b7a8f94739e0763d3e0b2ee80050093bff03e58b`

Graft reported savings:370034 tokens across5 calls with savings lines; two no-hit calls added0.

- `parser-probe.ts`: `27b69f9673ca7d04948a96c475bc2686d909504b6aa5c5ca6811037a95cce1e7`
