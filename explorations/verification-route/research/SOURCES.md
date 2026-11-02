# Sources

Provenance ledger for `explorations/verification-route`.

## In-repo bricks

See `RESEARCH.md` (2026-10-27 inventory) for the `file:line` table; every row
there is a brick this packet composes, none is net-new until MAP says so.

## Parent packets (links, not copies)

- `explorations/beep-ci-operational-ontology` — the S7 projection, the replay
  technique (41/41 admission), the `ciops-yeet-projection` MAP gate (not fired).
- `goals/time-to-certainty` — A1 economics (lane costs), `gate-order-handoff/v1`,
  ProofFact/ProofLedger (C1–C4), the paused C4.2 flip (ruling 80).
- `goals/ciops-ontology-pipeline` — `research/kpi-verdict.md` §7 (no route claim).
- `THE_AGENTIC_YOYO.md` — the article this packet exists to finish honestly.

## External

- Addy Osmani, "How the Claude Code team does code review", X article,
  2026-10-26. Local copy: `~/YeeBois/research/code-review-research/`
  (outside the repo). Used for the review-lane analogue only.
- External landscape (RESEARCH.md, 2026-10-28). All accessed 2026-10-28.
  GitHub source files were read at the pinned tag or commit through the
  GitHub contents API (`gh api repos/<o>/<r>/contents/<path>?ref=<ref>`),
  plus a WebFetch of the blob URL where marked (WF). Ideas only, no code
  ported.
  - Turborepo docs: [configuration](https://turborepo.dev/docs/reference/configuration)
    (global hash, `global.inputs`, `affectedUsingTaskInputs`; page
    `lastUpdated` 2026-10-26), [caching](https://turborepo.dev/docs/crafting-your-repository/caching),
    [run `--affected`](https://turborepo.dev/docs/reference/run).
  - Turborepo source `v2.11.10` (MIT):
    [global_hash.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-task-hash/src/global_hash.rs) (WF),
    [task_definition.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-engine/src/task_definition.rs)
    `prepend_global_inputs` (WF),
    [global_inputs_test.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo/tests/global_inputs_test.rs).
    Cross-checked against this repo's `turbo.json` (`globalConfiguration`,
    `global.inputs` lists `package.json`) and installed `turbo` 2.11.10.
  - Nx docs: [inputs](https://nx.dev/docs/reference/inputs),
    [affected](https://nx.dev/docs/features/ci-features/affected).
  - Nx source `24.0.2` (MIT):
    [npm-packages.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/npm-packages.ts) (WF),
    [lock-file-changes.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/lock-file-changes.ts),
    [tsconfig-json-changes.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/tsconfig-json-changes.ts).
  - Bazel [query language](https://bazel.build/query/language) (`rdeps`,
    configuration caveats).
  - target-determinator (Apache-2.0): [README](https://github.com/bazel-contrib/target-determinator) (WF),
    [hash_cache.go @ d4b6125](https://github.com/bazel-contrib/target-determinator/blob/d4b6125546979713431e63b5c3e65810fa989446/pkg/hash_cache.go).
  - Memon et al., "Taming Google-Scale Continuous Testing", ICSE-SEIP 2017,
    DOI 10.1109/ICSE-SEIP.2017.16 (printed on the paper); read from a course
    copy: [PDF](https://huang.isis.vanderbilt.edu/cs8395-f23/paper/google-testing-icse-seip-17.pdf), pp. 1-3.
  - Elbaum, Rothermel, Penix, "Techniques for improving regression testing
    in continuous integration development environments", FSE 2014; read from
    a course copy: [PDF](https://cs.uwaterloo.ca/~m2nagapp/courses/CS846/1171/papers/elbaum_fse14.pdf), pp. 1-8.
  - Machalica, Samylkin, Porth, Chandra, "Predictive Test Selection":
    [arXiv PDF 1810.05286v2](https://arxiv.org/pdf/1810.05286), pp. 1-8;
    [Meta engineering post](https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/);
    ICSE 2019 SEIP track per [researchr profile](https://conf.researchr.org/profile/conf/meredithporth)
    (DOI not confirmed).
  - Pants [advanced target selection](https://www.pantsbuild.org/dev/docs/using-pants/advanced-target-selection).
  - Buck2 change detector (Apache-2.0): [btd/README.md](https://github.com/facebookincubator/buck2-change-detector/blob/main/btd/README.md).
  - Please [commands](https://please.build/commands.html) (`plz query changes`).
  - Not verified: whether a task-level `!$TURBO_ROOT$/package.json`
    negation, or dropping `package.json` from `global.inputs`, clears the
    188/189 invalidation here (needs a dry-run); Nx behavior on a bun
    `workspaces.catalog` edit (source reading only); Please's transitive
    semantics; BTD's `.bzl`/BUCK handling; any public TAP selection account
    beyond Memon 2017; published false-skip rates for Turborepo, Nx or
    target-determinator (none found).
