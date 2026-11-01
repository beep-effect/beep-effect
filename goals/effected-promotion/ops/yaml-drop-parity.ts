/**
 * `yaml` drop parity (roadmap PR R4, reuse-ledger #24, #26, #28-#30, #32-#36, #229, #256, #285, #304).
 *
 * R4 moves every repo-cli and `@beep/repo-ai-metrics` importer of the npm `yaml` package onto Effect's
 * `effect/encoding/Yaml` (the parse-only sites) or the repo's `@beep/yaml` kit (the sites that serialize, edit or
 * need source positions), then drops `yaml` from both manifests. Every leg below runs a frozen copy of the retired
 * `yaml` call next to the site's current code over the live inputs and the test fixtures, so the run before the
 * switch proves the frozen copies are faithful (every case `identical`) and the run after it measures the switch:
 *
 * 1. **stringify** (byte parity): `renderAiMetricsLocalPhoenixCompose` over the default local install spec for the operator home; the models
 *    manifest writer (`ModelsManifestStore.init` into a temporary directory) over the operator manifest at
 *    `$HOME/.config/beep/models.yaml` and `seedModelsManifest`; Research `renderCard` over every knowledge card in
 *    the operator vault whose frontmatter decodes as `KnowledgeCardFrontmatter`, plus an edge corpus. The writers
 *    use `@beep/yaml`'s `quoteStyle: "auto"` (the `yaml` npm package's per-value quote choice), so every case must
 *    be `identical`; any difference, and any `renderCard` failure, is unclassified. A vault file is skipped only
 *    when it cannot be read or its frontmatter does not decode as a card; the report counts both (`vaultSkips`).
 * 2. **parse** (value parity): the frozen legacy reads (`YAML.parse` for Runners, `parseDocument(...).toJSON()`
 *    with the error check for ChangesetGraph, FallowQuality and the workflow tests) against `effect/encoding/Yaml`
 *    `parse`, over every tracked `.github/**` workflow and action file, every `.changeset/*.md` frontmatter, the
 *    Pulumi stack files and the docker-compose file, plus a negative corpus. Outcomes are `identical`,
 *    `both-reject` (intended: the rejection text changes) or unclassified. The ChangesetGraph site function
 *    `changesetPackageReferencesFromText` is fingerprinted per file as well.
 * 3. **edit** (VersionSync `YamlFileUpdater`): `updateYamlValue` on every `services.<name>.image` of
 *    `docker-compose.yml` and on the top-level `name` of every workflow, and `replaceNodeVersionWithFile` on every
 *    `with.node-version` path in the tracked workflow and action files, each on a temporary copy. A difference is
 *    `byte-minimal` (intended) when the current output parses to the same value as the legacy output and a minimal
 *    line diff against the input touches only the edited keys' lines (the legacy writer re-rendered the whole
 *    document: flow collections respaced, long scalars folded at 80 columns). `replaceNodeVersionWithFile` removes
 *    and inserts a key, which re-serializes the whole document under both writers; there a difference is
 *    `document-rerender` (intended) when the values match and every comment of the input survives. No live
 *    location reaches `replaceNodeVersionWithFile` today (the Node resolver skips the reviewed pins and templated
 *    values), so this corpus feeds every `with.node-version` path to it directly.
 * 4. **locator** (Models `yaml-path`): `modelsReadLocator` against a frozen copy of the retired `readYamlPath`
 *    (the `parseDocument` + `visit` simple-form check and the key-range reconciliation) over the fixture, the
 *    unsupported-form corpus from `models-locators.test.ts` and every scalar leaf path of the repository inputs.
 *    The gate is identical output for every case.
 * 5. **cli**: `beep quality changeset-graph` stdout and exit code, fingerprinted.
 *
 * Run once before the switch (`--out`), then after it with `--before <baseline.json>`: the baseline must hold no
 * non-identical case (faithful frozen copies), the repository input sets must match, the per-site case counts must
 * match (the stringify vault site may grow with the vault but never shrink), and the site fingerprints
 * (changeset references, cli) must be equal. Repository inputs are recorded by repository-relative path, so the
 * reports compare across checkouts; operator inputs (vault cards, the home manifest) are recorded only as counts
 * and hashed case ids, never content.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/yaml-drop-parity.ts [--out <report.json>] [--before <baseline.json>] [--vault <dir>]
 *
 * Exit status is non-zero when a case is unclassified or the baseline comparison fails.
 *
 * The before report (`research/yaml-drop-parity-r4-before.json`) was recorded by this script at its first commit,
 * b4ce85b425, where `renderCard` still returned a string; R4 made it an Effect (the kit stringifier has a typed
 * error channel), and this copy yields it.
 */
import * as NodeURL from "node:url";
import {
  AiMetricsInstallInput,
  makeAiMetricsInstallSpec,
  renderAiMetricsLocalPhoenixCompose,
} from "@beep/repo-ai-metrics";
import { LocatorBinding, ModelsTargetFile, seedModelsManifest } from "@beep/repo-cli/commands/Models";
import { modelsReadLocator } from "@beep/repo-cli/commands/Models/Models.locator.service";
import { ModelsManifest } from "@beep/repo-cli/commands/Models/Models.manifest.schemas";
import { ModelsManifestStore, ModelsManifestStoreLive } from "@beep/repo-cli/commands/Models/Models.manifest.service";
import { changesetPackageReferencesFromText } from "@beep/repo-cli/commands/Quality/ChangesetGraph";
import { KnowledgeCardFrontmatter } from "@beep/repo-cli/commands/Research/Research.schemas";
import {
  replaceNodeVersionWithFile,
  updateYamlValue,
} from "@beep/repo-cli/commands/VersionSync/internal/updaters/YamlFileUpdater";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as EffectYaml from "effect/encoding/Yaml";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { isMap, isScalar as isYamlScalar, parse as legacyParse, parseDocument, stringify, visit } from "yaml";
import { renderCard } from "../../../packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts";
import type { Locator } from "@beep/repo-cli/commands/Models";

const TOOL = "goals/effected-promotion/ops/yaml-drop-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const short = (text: string): string => Str.slice(0, 12)(sha256(text));
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

// --- report schema ---------------------------------------------------------------------------------------------

const Case = S.Struct({ site: S.String, id: S.String, outcome: S.String });
type Case = typeof Case.Type;
const SiteSummary = S.Struct({ site: S.String, cases: S.Finite, outcomes: S.Record(S.String, S.Finite) });
const Leg = S.Struct({ sites: S.Array(SiteSummary), nonIdentical: S.Array(Case), unclassified: S.Finite });
type Leg = typeof Leg.Type;
const CliRun = S.Struct({ command: S.String, exitCode: S.Finite, stdoutSha256: S.String, stdoutLines: S.Finite });
type CliRun = typeof CliRun.Type;
const Comparison = S.Struct({ baseline: S.String, identical: S.Boolean, differing: S.Array(S.String) });
type Comparison = typeof Comparison.Type;
// Vault files the stringify leg could not turn into a card case: an unreadable file, or one whose frontmatter does
// not decode as a knowledge card. A card that decodes always yields a case (a render failure is `unclassified`).
const VaultSkips = S.Struct({ unreadable: S.Finite, undecodable: S.Finite });
type VaultSkip = keyof typeof VaultSkips.Type;
const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  commit: S.optionalKey(S.String),
  stringify: Leg,
  vaultSkips: S.optionalKey(VaultSkips),
  parse: Leg,
  edit: Leg,
  locator: Leg,
  repoInputs: S.Struct({ count: S.Finite, sha256: S.String }),
  changesetReferences: S.Struct({ count: S.Finite, sha256: S.String }),
  cli: S.Array(CliRun),
  comparison: S.optionalKey(Comparison),
});
type Report = typeof Report.Type;
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class ParityFailed extends S.TaggedError<ParityFailed, { readonly brand: unique symbol }>()("ParityFailed", {
  reasons: S.Array(S.String),
}) {}

const legOf = (cases: ReadonlyArray<Case>): Leg => {
  const sites = A.dedupe(A.map(cases, (entry) => entry.site));
  return {
    sites: A.map(sites, (site) => {
      const own = A.filter(cases, (entry) => entry.site === site);
      const outcomes: Record<string, number> = {};
      for (const entry of own) outcomes[entry.outcome] = (outcomes[entry.outcome] ?? 0) + 1;
      return { site, cases: A.length(own), outcomes };
    }),
    nonIdentical: A.filter(cases, (entry) => entry.outcome !== "identical"),
    unclassified: A.length(A.filter(cases, (entry) => entry.outcome === "unclassified")),
  };
};

// --- shared helpers --------------------------------------------------------------------------------------------

// The legacy whole-value reads every retired parse site performed (`parseDocument`, the error check, then a
// `toJSON()` the sites wrapped in `Effect.try`, so a throwing conversion is a rejection too).
const legacyDocumentValue = (text: string): O.Option<unknown> => {
  const document = parseDocument(text);
  if (!A.isReadonlyArrayEmpty(document.errors)) return O.none();
  try {
    return O.some(document.toJSON());
  } catch {
    return O.none();
  }
};
const effectValue = (text: string): O.Option<unknown> => {
  try {
    return O.some(EffectYaml.parse(text));
  } catch {
    return O.none();
  }
};

const parseOutcome = (legacy: O.Option<unknown>, current: O.Option<unknown>): string =>
  O.isNone(legacy) && O.isNone(current)
    ? "both-reject"
    : O.isSome(legacy) && O.isSome(current) && sameJson(legacy.value, current.value)
      ? "identical"
      : "unclassified";

// Stringify is byte parity: since the writers use `@beep/yaml`'s `auto` quote style, the `yaml` npm package's own
// per-value quote choice, every rendering must match the retired writer byte for byte.
const stringifyOutcome = (legacy: string, current: string): string =>
  legacy === current ? "identical" : "unclassified";

const gitFiles = Effect.fn("gitFiles")(function* (patterns: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const output = yield* spawner.string(ChildProcess.make("git", ["ls-files", "--", ...patterns], { cwd: repoRoot }));
  return pipe(Str.split(output, "\n"), A.filter(Str.isNonEmpty), A.sort(Order.String));
});

const REPO_YAML_PATTERNS = [
  ".github/**/*.yml",
  ".github/**/*.yaml",
  "infra/ci-runners/Pulumi*.yaml",
  "docker-compose.yml",
  "packages/tooling/tool/cli/test/fixtures/models/*.yaml",
];

// Every path to a scalar leaf through mappings and sequences.
const leafPaths = (value: unknown, prefix: ReadonlyArray<string | number> = []): Array<Array<string | number>> =>
  A.isArray(value)
    ? A.flatMap(value as ReadonlyArray<unknown>, (item, index) => leafPaths(item, [...prefix, index]))
    : P.isObject(value)
      ? A.flatMap(R.toEntries(value as Record<string, unknown>), ([key, item]) => leafPaths(item, [...prefix, key]))
      : [[...prefix]];

// --- leg 1: stringify -------------------------------------------------------------------------------------------

// The retired compose writer: the same document literal through `yaml` `stringify` with `lineWidth: 0`.
const legacyCompose = (serviceName: string, image: string): string =>
  stringify(
    {
      name: "beep-ai-metrics-local",
      services: {
        [serviceName]: {
          container_name: "beep-ai-metrics-phoenix",
          environment: { PHOENIX_WORKING_DIR: "/data" },
          image,
          ports: ["127.0.0.1:6006:6006"],
          restart: "unless-stopped",
          volumes: ["phoenix_data:/data"],
        },
      },
      volumes: { phoenix_data: {} },
    },
    { lineWidth: 0 }
  );

// The retired `renderCard`: the ordered frontmatter record through `yaml` `stringify` with `lineWidth: 0`.
const FRONTMATTER_KEYS = [
  ["id", "id"],
  ["title", "title"],
  ["url", "url"],
  ["sourceType", "source-type"],
  ["capturedAt", "captured-at"],
  ["via", "via"],
  ["status", "status"],
  ["tags", "tags"],
  ["related", "related"],
  ["cognifiedAt", "cognified-at"],
  ["contentHash", "content-hash"],
] as const;
const legacyRenderCard = (frontmatter: KnowledgeCardFrontmatter, body: string): string => {
  const source = A.flatMap(FRONTMATTER_KEYS, ([prop, key]) => {
    const value = frontmatter[prop];
    return P.isUndefined(value) ? [] : [[key, value] as const];
  });
  return `---\n${stringify(R.fromEntries(source), { lineWidth: 0 })}---\n\n${Str.trimEnd(body)}\n`;
};
const decodeCard = S.decodeUnknownOption(KnowledgeCardFrontmatter);
const cardFrom = (raw: Readonly<Record<string, unknown>>): O.Option<KnowledgeCardFrontmatter> =>
  decodeCard(
    R.fromEntries(A.flatMap(FRONTMATTER_KEYS, ([prop, key]) => (R.has(raw, key) ? [[prop, raw[key]] as const] : [])))
  );
const EDGE_CARDS: ReadonlyArray<Readonly<Record<string, unknown>>> = A.map(
  [
    'Effect: "v4" release',
    "it's here",
    "both ' and \"",
    "yes",
    "2026-10-31",
    "@scope/pkg",
    "- dash",
    "#hash",
    "*star",
    "&anchor",
    "!tag",
    "%percent",
    "`tick`",
    "123",
    "1.5e3",
    "null",
    "~",
    " leading",
    "trailing ",
    "a: b",
    "tab\there",
    "über ünïcödé — dash",
    "x".repeat(140),
    "line one\nline two",
  ],
  (title, index) => ({
    id: `edge-${index}`,
    title,
    url: "https://example.com/a?b=1#c",
    "source-type": "article",
    "captured-at": "2026-10-31T00:00:00.000Z",
    via: "manual",
    status: "inbox",
    tags: [title, "plain"],
    related: [],
  })
);

// The vault `beep research` writes by default (`--vault <dir>` overrides it).
const vaultRoot = (home: string): string => {
  const index = process.argv.indexOf("--vault");
  const fromFlag = index === -1 ? undefined : process.argv[index + 1];
  return P.isString(fromFlag) && Str.isNonEmpty(fromFlag) ? fromFlag : `${home}/YeeBois/knowledge`;
};
const FRONTMATTER_BLOCK = /^---\n(?<yaml>[\s\S]*?\n)---\n\n(?<body>[\s\S]*)$/u;

// One card's byte-parity case: the retired renderer against `renderCard`, whose typed failure is `unclassified`.
const cardCase = (id: string, card: KnowledgeCardFrontmatter, body: string): Effect.Effect<Case> =>
  renderCard(card, body).pipe(
    Effect.map((current) => stringifyOutcome(legacyRenderCard(card, body), current)),
    Effect.orElseSucceed(() => "unclassified"),
    Effect.map((outcome) => ({ site: "repo-cli Research/internal/Vault.ts", id, outcome }))
  );

const stringifyLeg = Effect.fn("stringifyLeg")(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cases: Array<Case> = [];

  // compose
  const spec = yield* makeAiMetricsInstallSpec(AiMetricsInstallInput.make({ homeDir: O.some(home) }));
  const phoenix = A.findFirst(spec.services, (service) => service.tool === "phoenix");
  if (O.isSome(phoenix)) {
    const current = yield* renderAiMetricsLocalPhoenixCompose(spec);
    cases.push({
      site: "ai-metrics compose.ts",
      id: "default-spec",
      outcome: stringifyOutcome(legacyCompose(phoenix.value.composeServiceName, phoenix.value.image), current),
    });
  }

  // models manifest writer
  const store = yield* ModelsManifestStore;
  const encode = S.encodeUnknownEffect(ModelsManifest);
  const scratch = yield* fs.makeTempDirectoryScoped();
  const homeManifest = path.join(home, ".config/beep/models.yaml");
  const live = (yield* fs.exists(homeManifest))
    ? yield* store.load(homeManifest).pipe(Effect.option)
    : O.none<ModelsManifest>();
  const manifests = A.getSomes([
    O.map(live, (manifest) => ["home-manifest", manifest] as const),
    O.some(["seed", seedModelsManifest] as const),
  ]);
  for (const [id, manifest] of manifests) {
    const target = path.join(scratch, `${id}.yaml`);
    yield* store.init(target, manifest);
    const current = yield* fs.readFileString(target);
    const legacy = stringify(yield* encode(manifest), { lineWidth: 0 });
    cases.push({ site: "repo-cli Models.manifest.service.ts", id, outcome: stringifyOutcome(legacy, current) });
  }

  // research vault cards
  const root = vaultRoot(home);
  const cardFiles = (yield* fs.exists(root))
    ? A.filter(yield* fs.readDirectory(root, { recursive: true }), Str.endsWith(".md"))
    : [];
  // Only an unreadable file or frontmatter that does not decode as a card is a skip, counted in the report; a
  // decoded card whose rendering fails is an `unclassified` case, so it fails the gate instead of vanishing.
  const vaultEntries = yield* Effect.forEach(A.sort(cardFiles, Order.String), (relative) =>
    fs.readFileString(path.join(root, relative)).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.succeed(Result.fail<VaultSkip>("unreadable")),
        onSuccess: (text): Effect.Effect<Result.Result<Case, VaultSkip>> => {
          const match = FRONTMATTER_BLOCK.exec(text);
          if (match?.groups === undefined) return Effect.succeed(Result.fail("undecodable"));
          const raw = legacyDocumentValue(match.groups.yaml ?? "");
          const card = O.flatMap(O.filter(raw, P.isObject), (value) => cardFrom(value as Record<string, unknown>));
          if (O.isNone(card)) return Effect.succeed(Result.fail("undecodable"));
          return Effect.map(cardCase(`vault:${short(relative)}`, card.value, match.groups.body ?? ""), Result.succeed);
        },
      })
    )
  );
  const [vaultCases, skipped] = A.partition(vaultEntries, identity);
  cases.push(...vaultCases);
  for (const [index, raw] of EDGE_CARDS.entries()) {
    const card = cardFrom(raw);
    cases.push(
      O.isNone(card)
        ? { site: "repo-cli Research/internal/Vault.ts", id: `edge-${index}`, outcome: "unclassified" }
        : yield* cardCase(`edge-${index}`, card.value, "Body.")
    );
  }
  const vaultSkips = {
    unreadable: A.length(A.filter(skipped, (skip) => skip === "unreadable")),
    undecodable: A.length(A.filter(skipped, (skip) => skip === "undecodable")),
  };
  return { cases, vaultSkips };
});

// --- leg 2: parse -----------------------------------------------------------------------------------------------

const CHANGESET_FRONTMATTER = /^---\n(?<yaml>[\s\S]*?)\n?---/u;
// Changeset frontmatter shapes the ChangesetGraph tests and real changesets use (the repo holds none at rest).
const CHANGESET_CORPUS: ReadonlyArray<string> = [
  '"@beep/schema": patch\n',
  "'@beep/schema': minor\n'@beep/utils': patch\n",
  '"@beep/a": major\n# a comment\n"@beep/b": patch # trailing\n',
  "",
  "\n",
  '"@beep/schema": "patch"\n',
  '"@beep/schema": patch\n"@beep/schema": minor\n',
  '"@beep/schema": huge\n',
  "- not a map\n",
];
const NEGATIVE_PARSE: ReadonlyArray<string> = [
  "a: [",
  "a: 1\na: 2\n",
  "key: 'unterminated\n",
  'key: "bad \\q escape"\n',
  "\tkey: tab\n",
  "*missing\n",
];

const parseLeg = Effect.fn("parseLeg")(function* (repoFiles: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cases: Array<Case> = [];
  const references: Array<string> = [];
  for (const file of repoFiles) {
    const text = yield* fs.readFileString(path.join(repoRoot, file));
    const site = Str.startsWith("infra/")(file)
      ? "repo-cli Runners.service.ts"
      : Str.startsWith(".github/")(file)
        ? "repo-cli FallowQuality + workflow tests"
        : "repo-cli VersionSync compose read";
    if (Str.endsWith(".yaml")(file) && Str.includes("fixtures/models/")(file)) continue;
    const legacy =
      site === "repo-cli Runners.service.ts" ? O.some(legacyParse(text) as unknown) : legacyDocumentValue(text);
    cases.push({ site, id: file, outcome: parseOutcome(legacy, effectValue(text)) });
  }
  for (const file of yield* gitFiles([".changeset/*.md"])) {
    const text = yield* fs.readFileString(path.join(repoRoot, file));
    const match = CHANGESET_FRONTMATTER.exec(text);
    if (match?.groups !== undefined) {
      const yaml = match.groups.yaml ?? "";
      cases.push({
        site: "repo-cli ChangesetGraph.ts",
        id: file,
        outcome: parseOutcome(legacyDocumentValue(yaml), effectValue(yaml)),
      });
    }
    const refs = yield* changesetPackageReferencesFromText(file, text).pipe(
      Effect.map((found) =>
        A.join(
          A.map(found, (ref) => ref.packageName),
          ","
        )
      ),
      Effect.orElseSucceed(() => "<error>")
    );
    references.push(`${file}\t${refs}`);
  }
  for (const [index, yaml] of CHANGESET_CORPUS.entries()) {
    cases.push({
      site: "repo-cli ChangesetGraph.ts",
      id: `corpus-${index}`,
      outcome: parseOutcome(legacyDocumentValue(yaml), effectValue(yaml)),
    });
    const refs = yield* changesetPackageReferencesFromText(`corpus-${index}.md`, `---\n${yaml}---\n\nBody.\n`).pipe(
      Effect.map((found) =>
        A.join(
          A.map(found, (ref) => ref.packageName),
          ","
        )
      ),
      Effect.orElseSucceed(() => "<error>")
    );
    references.push(`corpus-${index}\t${refs}`);
  }
  for (const [index, text] of NEGATIVE_PARSE.entries()) {
    cases.push({
      site: "negative corpus",
      id: `negative-${index}`,
      outcome: parseOutcome(legacyDocumentValue(text), effectValue(text)),
    });
    const refs = yield* changesetPackageReferencesFromText(`negative-${index}.md`, `---\n${text}---\n\nBody.\n`).pipe(
      Effect.map((found) =>
        A.join(
          A.map(found, (ref) => ref.packageName),
          ","
        )
      ),
      Effect.orElseSucceed(() => "<error>")
    );
    references.push(`negative-${index}\t${refs}`);
  }
  return { cases, references };
});

// --- leg 3: edit ------------------------------------------------------------------------------------------------

const legacyUpdateValue = (original: string, yamlPath: ReadonlyArray<string | number>, value: string): string => {
  const doc = parseDocument(original);
  if (`${doc.getIn(yamlPath)}` === value) return original;
  doc.setIn(yamlPath, value);
  return doc.toString();
};
const legacyReplaceNodeVersion = (original: string, paths: ReadonlyArray<ReadonlyArray<string | number>>): string => {
  const doc = parseDocument(original);
  let changed = false;
  for (const yamlPath of paths) {
    const current = doc.getIn(yamlPath);
    if (current !== undefined && current !== null) {
      doc.deleteIn(yamlPath);
      const withPath = A.dropRight(yamlPath, 1);
      const withNode = doc.getIn(withPath);
      if (withNode !== undefined && withNode !== null && P.isObject(withNode) && !A.isArray(withNode)) {
        doc.setIn(A.append(withPath, "node-version-file"), ".nvmrc");
        changed = true;
      }
    }
  }
  return changed ? doc.toString() : original;
};

// The lines a minimal line diff removes from `original` or adds in `current` (longest common subsequence).
const changedLines = (original: string, current: string): ReadonlyArray<string> => {
  const before = Str.split(original, "\n");
  const after = Str.split(current, "\n");
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        before[i] === after[j]
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
    }
  }
  const changed: Array<string> = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      i++;
      j++;
    } else if (
      j < after.length &&
      (i === before.length || (table[i * cols + j + 1] ?? 0) >= (table[(i + 1) * cols + j] ?? 0))
    ) {
      changed.push(after[j] ?? "");
      j++;
    } else {
      changed.push(before[i] ?? "");
      i++;
    }
  }
  return changed;
};
// Every comment of `original` (a `#` that opens the line or follows a space) survives somewhere in `current`.
const COMMENT = /(?:^|\s)(#.*)$/u;
const commentsSurvive = (original: string, current: string): boolean =>
  A.every(Str.split(original, "\n"), (line) => {
    const comment = COMMENT.exec(line)?.[1];
    return P.isUndefined(comment) || Str.includes(comment)(current);
  });
const editOutcome = (
  original: string,
  legacy: string,
  current: string,
  keys: ReadonlyArray<string>,
  restructures: boolean
): string => {
  if (legacy === current) return "identical";
  const sameValue = O.isSome(legacyDocumentValue(current)) && sameJson(legacyParse(legacy), legacyParse(current));
  if (!sameValue) return "unclassified";
  const confined = A.every(changedLines(original, current), (line) =>
    A.some(keys, (key) => Str.startsWith(`${key}:`)(Str.trimStart(Str.replace(/^- /u, "")(Str.trimStart(line)))))
  );
  if (confined) return "byte-minimal";
  // A removal or an insertion re-serializes the whole document under both writers; the legacy one folded long
  // scalars at 80 columns, the kit never folds. Same value and every comment kept is the intended outcome.
  return restructures && commentsSurvive(original, current) ? "document-rerender" : "unclassified";
};

const editLeg = Effect.fn("editLeg")(function* (repoFiles: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = yield* fs.makeTempDirectoryScoped();
  const cases: Array<Case> = [];
  const run = Effect.fn("runEdit")(function* (
    site: string,
    id: string,
    original: string,
    keys: ReadonlyArray<string>,
    legacy: string,
    apply: (file: string) => Effect.Effect<boolean, unknown, FileSystem.FileSystem>
  ) {
    const target = path.join(scratch, `${short(id)}.yml`);
    yield* fs.writeFileString(target, original);
    const outcome = yield* apply(target).pipe(
      Effect.flatMap(() => fs.readFileString(target)),
      Effect.map((current) =>
        editOutcome(original, legacy, current, keys, Str.endsWith("replaceNodeVersionWithFile")(site))
      ),
      Effect.orElseSucceed(() => "unclassified")
    );
    cases.push({ site, id, outcome });
  });
  for (const file of repoFiles) {
    if (!Str.startsWith(".github/")(file) && file !== "docker-compose.yml") continue;
    const original = yield* fs.readFileString(path.join(repoRoot, file));
    const value = legacyDocumentValue(original);
    if (O.isNone(value) || !P.isObject(value.value)) continue;
    const root = value.value as Record<string, unknown>;
    if (file === "docker-compose.yml") {
      for (const [service, spec] of R.toEntries((root.services ?? {}) as Record<string, unknown>)) {
        if (!P.isObject(spec) || !P.isString((spec as Record<string, unknown>).image)) continue;
        const yamlPath = ["services", service, "image"];
        const next = `${(spec as Record<string, unknown>).image}-r4`;
        yield* run(
          "repo-cli YamlFileUpdater.updateYamlValue",
          `${file}#${service}`,
          original,
          ["image"],
          legacyUpdateValue(original, yamlPath, next),
          (target) => updateYamlValue(target, yamlPath, { value: next })
        );
      }
      continue;
    }
    if (P.isString(root.name)) {
      yield* run(
        "repo-cli YamlFileUpdater.updateYamlValue",
        `${file}#name`,
        original,
        ["name"],
        legacyUpdateValue(original, ["name"], `${root.name} R4`),
        (target) => updateYamlValue(target, ["name"], { value: `${root.name} R4` })
      );
    }
    const nodePaths = A.filter(
      leafPaths(root),
      (leaf) => leaf[leaf.length - 1] === "node-version" && leaf[leaf.length - 2] === "with"
    );
    if (A.isReadonlyArrayNonEmpty(nodePaths)) {
      yield* run(
        "repo-cli YamlFileUpdater.replaceNodeVersionWithFile",
        `${file}#node-version`,
        original,
        ["node-version", "node-version-file"],
        legacyReplaceNodeVersion(original, nodePaths),
        (target) =>
          replaceNodeVersionWithFile(
            target,
            A.map(nodePaths, (yamlPath) => ({ yamlPath }))
          )
      );
    }
  }
  return cases;
});

// --- leg 4: locator ---------------------------------------------------------------------------------------------

// The retired `Models.locator.service.ts` `readYamlPath` and its helpers, frozen.
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const legacyUnsupportedOccurrence = (
  content: string,
  names: ReadonlyArray<string>,
  ranges: ReadonlyArray<readonly [number, number]>
): O.Option<string> => {
  const unmatched = A.findFirst(
    A.flatMap(A.dedupe(names), (name) => A.fromIterable(content.matchAll(new RegExp(escapeRegExp(name), "g")))),
    (match) =>
      !A.some(ranges, ([start, end]) => start <= (match.index ?? 0) && (match.index ?? 0) + match[0].length <= end)
  );
  return O.map(
    unmatched,
    (match) => `Unsupported YAML form: line ${A.length(Str.split(content.slice(0, match.index), "\n"))}`
  );
};
const legacyReadYamlPath = (content: string, yamlPath: ReadonlyArray<string | number>): O.Option<string> => {
  const names = A.map(yamlPath, (segment) => `${segment}`);
  const doc = parseDocument(content);
  let supported = A.isReadonlyArrayEmpty(doc.errors) && A.isReadonlyArrayEmpty(doc.warnings);
  visit(doc, {
    Node: (_, node) => {
      const simple = isMap(node)
        ? node.flow !== true && A.every(node.items, (pair) => isYamlScalar(pair.key) && pair.key.type === "PLAIN")
        : isYamlScalar(node) && node.type !== "BLOCK_LITERAL" && node.type !== "BLOCK_FOLDED";
      supported = supported && node.anchor === undefined && node.tag === undefined && simple;
    },
  });
  const ranges = A.getSomes(
    A.map([...yamlPath.entries()], ([depth, segment]) => {
      const parent = doc.getIn(A.take(yamlPath, depth), true);
      if (!isMap(parent)) return O.none<readonly [number, number]>();
      const pair = A.findFirst(parent.items, (item) => isYamlScalar(item.key) && item.key.value === segment);
      return O.flatMap(pair, ({ key }) =>
        isYamlScalar(key) && key.range != null ? O.some([key.range[0], key.range[1]] as const) : O.none()
      );
    })
  );
  const unsupported = legacyUnsupportedOccurrence(content, names, supported ? ranges : []);
  if (O.isSome(unsupported)) return unsupported;
  const value = doc.getIn([...yamlPath]);
  return P.isString(value) || P.isNumber(value) || P.isBoolean(value) ? O.some(`${value}`) : O.none();
};
const LOCATOR_CORPUS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["# model: old\n", ["model"]],
  ["model: old # model\n", ["model"]],
  ["model: &shared old\nnative: *shared\n", ["model"]],
  ["model: *shared\n", ["model"]],
  ["'model': old\n", ["model"]],
  ["{model: old}\n", ["model"]],
  ["model: old\n---\nmodel: old\n", ["model"]],
  ["model: !tag old\n", ["model"]],
  ["model: |\n  old\n", ["model"]],
  ["model: old\nnative: keep\n", ["model"]],
  ["routing:\n  strategy: fill-first\n  default: grok-4.6\n", ["routing", "default"]],
  ["routing:\n  strategy: fill-first\n  default: grok-4.6\n", ["routing", "missing"]],
  ["routing:\n  default:\n    nested: x\n", ["routing", "default"]],
  ['model: "quoted"\n', ["model"]],
  ["model: 'single'\n", ["model"]],
  ["model: 42\neffort: true\n", ["model"]],
  ["model: 42\neffort: true\n", ["effort"]],
  ["model:\n", ["model"]],
  ["models:\n  - a\n  - b\n", ["models"]],
  ["model: [a, b]\n", ["model"]],
  ["model: a\n  b\n", ["model"]],
  ["a:\n  model: x\nmodel: y\n", ["model"]],
  ["model: a: b\n", ["model"]],
  ["", ["model"]],
];

const locatorLeg = Effect.fn("locatorLeg")(function* (repoFiles: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cases: Array<Case> = [];
  const check = Effect.fn("checkLocator")(function* (id: string, content: string, yamlPath: ReadonlyArray<string>) {
    const locator = {
      _tag: "yaml-path",
      binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
      render: { _tag: "verbatim" },
      path: yamlPath,
    } as Locator;
    const file = ModelsTargetFile.make({ root: "repo", absolutePath: `/repo/${id}`, content });
    const current = yield* modelsReadLocator(file, locator).pipe(
      Effect.map((found) => O.getOrElse(found, () => "<none>")),
      Effect.orElseSucceed(() => "<error>")
    );
    const legacy = O.getOrElse(legacyReadYamlPath(content, yamlPath), () => "<none>");
    cases.push({
      site: "repo-cli Models.locator.service.ts",
      id,
      outcome: legacy === current ? "identical" : "unclassified",
    });
  });
  for (const [index, [content, yamlPath]] of LOCATOR_CORPUS.entries())
    yield* check(`corpus-${index}`, content, yamlPath);
  for (const file of repoFiles) {
    const content = yield* fs.readFileString(path.join(repoRoot, file));
    const value = legacyDocumentValue(content);
    if (O.isNone(value)) continue;
    const paths = A.filter(
      leafPaths(value.value),
      (leaf) => A.every(leaf, P.isString) && A.isReadonlyArrayNonEmpty(leaf)
    );
    for (const leaf of A.take(paths, 60))
      yield* check(`${file}#${A.join(leaf as ReadonlyArray<string>, ".")}`, content, leaf as ReadonlyArray<string>);
  }
  return cases;
});

// --- leg 5: cli -------------------------------------------------------------------------------------------------

const runCli = Effect.fn("runCli")(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make("bun", ["run", "packages/tooling/tool/cli/src/bin.ts", "--", ...args], {
    cwd: repoRoot,
    stderr: "ignore",
  });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const stdout = yield* handle.stdout.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc: string, chunk) => `${acc}${chunk}`
        )
      );
      const exitCode = yield* handle.exitCode;
      const portable = Str.replaceAll(Str.slice(0, -1)(repoRoot), "<repo>")(stdout);
      return {
        command: `beep ${A.join(args, " ")}`,
        exitCode: Number(exitCode),
        stdoutSha256: sha256(portable),
        stdoutLines: A.length(A.filter(Str.split(portable, "\n"), Str.isNonEmpty)),
      };
    })
  );
});

// --- entry point ------------------------------------------------------------------------------------------------

const flag = (name: string): O.Option<string> => {
  const index = process.argv.indexOf(name);
  return index === -1 ? O.none() : O.fromNullishOr(process.argv[index + 1]);
};

const repoCaseIds = (report: Report): ReadonlyArray<string> =>
  A.sort(
    A.flatMap([report.parse, report.edit, report.locator], (leg) =>
      A.flatMap(leg.sites, (site) => [`${site.site}:${site.cases}`])
    ),
    Order.String
  );

// Stringify sites fed by operator inputs that grow between runs: the knowledge vault gains cards, so its site may
// count more cases than the baseline but never fewer. Every other stringify site must count exactly as many cases,
// so a card or writer case that stops producing a result fails the comparison instead of leaving it.
const GROWING_STRINGIFY_SITES: ReadonlyArray<string> = ["repo-cli Research/internal/Vault.ts"];

const stringifyCountDrift = (before: Report, after: Report): ReadonlyArray<string> => {
  const countsOf = (report: Report) => R.fromEntries(A.map(report.stringify.sites, (site) => [site.site, site.cases]));
  const was = countsOf(before);
  const now = countsOf(after);
  const sites = A.sort(A.dedupe([...R.keys(was), ...R.keys(now)]), Order.String);
  return A.flatMap(sites, (site) => {
    const baseline = was[site] ?? 0;
    const current = now[site] ?? 0;
    const holds = A.contains(GROWING_STRINGIFY_SITES, site) ? current >= baseline : current === baseline;
    return holds ? [] : [`stringify case count ${site} ${baseline} -> ${current}`];
  });
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const home = process.env.HOME ?? "";
  const repoFiles = yield* gitFiles(REPO_YAML_PATTERNS);

  const stringified = yield* stringifyLeg(home);
  const parsed = yield* parseLeg(repoFiles);
  const editCases = yield* editLeg(repoFiles);
  const locatorCases = yield* locatorLeg(repoFiles);
  const cli = yield* Effect.forEach([["quality", "changeset-graph"]], runCli);

  const commit = yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).pipe(
    Effect.map(Str.trim),
    Effect.map(O.liftPredicate(Str.isNonEmpty)),
    Effect.orElseSucceed(() => O.none<string>())
  );

  const draft: Report = {
    schemaVersion: 1,
    tool: TOOL,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    stringify: legOf(stringified.cases),
    vaultSkips: stringified.vaultSkips,
    parse: legOf(parsed.cases),
    edit: legOf(editCases),
    locator: legOf(locatorCases),
    repoInputs: { count: A.length(repoFiles), sha256: sha256(A.join(repoFiles, "\n")) },
    changesetReferences: { count: A.length(parsed.references), sha256: sha256(A.join(parsed.references, "\n")) },
    cli,
  };

  const comparison = yield* O.match(flag("--before"), {
    onNone: () => Effect.succeed(O.none<Comparison>()),
    onSome: (baseline) =>
      Effect.gen(function* () {
        const before = yield* decodeReport(yield* fs.readFileString(baseline));
        const baselineNonIdentical = A.length(
          A.flatMap([before.stringify, before.parse, before.edit, before.locator], (leg) =>
            A.filter(leg.nonIdentical, (entry) => entry.outcome !== "both-reject")
          )
        );
        const differing = A.getSomes([
          baselineNonIdentical === 0 ? O.none() : O.some(`baseline holds ${baselineNonIdentical} non-identical cases`),
          sameJson(before.repoInputs, draft.repoInputs) ? O.none() : O.some("repoInputs"),
          sameJson(repoCaseIds(before), repoCaseIds(draft)) ? O.none() : O.some("repo case counts"),
          ...A.map(stringifyCountDrift(before, draft), O.some),
          sameJson(before.changesetReferences, draft.changesetReferences) ? O.none() : O.some("changesetReferences"),
          sameJson(before.cli, draft.cli) ? O.none() : O.some("cli"),
        ]);
        return O.some({ baseline, identical: A.isReadonlyArrayEmpty(differing), differing });
      }),
  });
  const report: Report = {
    ...draft,
    ...O.match(comparison, { onNone: () => ({}), onSome: (value) => ({ comparison: value }) }),
  };

  const json = yield* encodeReport(report);
  yield* O.match(flag("--out"), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });
  for (const [name, leg] of [
    ["stringify", report.stringify],
    ["parse", report.parse],
    ["edit", report.edit],
    ["locator", report.locator],
  ] as const) {
    yield* Console.log(
      `${name}: ${A.join(
        A.map(leg.sites, (site) => `${site.site} ${site.cases} ${JSON.stringify(site.outcomes)}`),
        "; "
      )}; unclassified=${leg.unclassified}`
    );
  }
  yield* Console.log(
    `vault skips: unreadable=${stringified.vaultSkips.unreadable} undecodable=${stringified.vaultSkips.undecodable}`
  );
  yield* Console.log(
    A.join(
      A.map(
        report.cli,
        (run) => `${run.command}: exit ${run.exitCode}, ${run.stdoutLines} lines, ${Str.slice(0, 12)(run.stdoutSha256)}`
      ),
      "; "
    )
  );
  yield* O.match(comparison, {
    onNone: () => Effect.void,
    onSome: (value) =>
      Console.log(
        `baseline ${value.baseline}: identical=${value.identical}${value.identical ? "" : ` differing=${A.join(value.differing, ",")}`}`
      ),
  });

  const unclassified = A.flatMap([report.stringify, report.parse, report.edit, report.locator], (leg) =>
    A.filter(leg.nonIdentical, (entry) => entry.outcome === "unclassified")
  );
  const reasons = A.getSomes([
    A.isReadonlyArrayEmpty(unclassified)
      ? O.none()
      : O.some(
          `unclassified: ${A.join(
            A.map(A.take(unclassified, 20), (entry) => `${entry.site} ${entry.id}`),
            ", "
          )}`
        ),
    ...A.map(
      A.filter(report.cli, (run) => run.exitCode !== 0),
      (run) => O.some(`${run.command} exited ${run.exitCode}`)
    ),
    O.flatMap(comparison, (value) =>
      value.identical ? O.none() : O.some(`baseline ${value.baseline} differs: ${A.join(value.differing, ", ")}`)
    ),
  ]);
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* ParityFailed.make({ reasons });
});

// @effect-diagnostics-next-line strictEffectProvide:off -- this is the script's entry point; the layers are provided once here. Owner: goals/effected-promotion. Exit: the script is deleted with the packet's closeout.
NodeRuntime.runMain(
  program.pipe(Effect.scoped, Effect.provide(Layer.provideMerge(ModelsManifestStoreLive, NodeServices.layer)))
);
