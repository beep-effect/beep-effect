import {
  buildRepoDependencyIndex,
  computeTransitiveClosure,
  decodePackageJsonEffect,
  resolveWorkspaceDirs,
} from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, HashMap, HashSet, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Node, Project, SyntaxKind } from "ts-morph";
import { RegistrationGeometryError } from "./RegistrationGeometry.errors.ts";
import { surfacesForTarget } from "./RegistrationGeometry.plan.ts";
import {
  DependentHit,
  DependentsReport,
  RegistrationObservation,
  RegistrationSurface,
} from "./RegistrationGeometry.schemas.ts";
import type {
  DependentHitKind,
  RegistrationObservationStatus,
  RegistrationTarget,
} from "./RegistrationGeometry.schemas.ts";

const SCAN_ROOTS = [
  "packages",
  "apps",
  "infra",
  "scratchpad",
  "standards",
  "goals",
  "research",
  ".changeset",
  ".github",
];
const EXCLUDED_DIRECTORIES = HashSet.fromIterable([".git", "node_modules", "dist", "coverage", ".turbo"]);
const SOURCE_SUFFIXES = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const TEXT_SUFFIXES = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
];

const isSuffixIn =
  (suffixes: ReadonlyArray<string>) =>
  (file: string): boolean =>
    A.some(suffixes, (suffix) => Str.endsWith(suffix)(file));

const collectFiles = Effect.fn("RegistrationGeometry.collectFiles")(function* (
  root: string,
  suffixes: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walk = Effect.fn("RegistrationGeometry.collectFiles.walk")(function* (
    current: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs.stat(current).pipe(Effect.option);
    if (O.isNone(stat)) return A.empty<string>();
    if (stat.value.type === "File") return isSuffixIn(suffixes)(current) ? A.of(current) : A.empty<string>();
    if (stat.value.type !== "Directory") return A.empty<string>();

    const entries = yield* fs.readDirectory(current).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();
    for (const entry of entries) {
      if (HashSet.has(EXCLUDED_DIRECTORIES, entry)) continue;
      files = A.appendAll(files, yield* walk(path.join(current, entry)));
    }
    return files;
  });

  return A.sort(yield* walk(root), Order.String);
});

const existingEvidence = Effect.fn("RegistrationGeometry.existingEvidence")(function* (
  repoRoot: string,
  relativeFiles: ReadonlyArray<string>,
  needles: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let evidence = A.empty<string>();

  for (const relativeFile of relativeFiles) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const exists = yield* fs.exists(absoluteFile).pipe(Effect.orElseSucceed(thunkFalse));
    if (!exists) continue;
    const content = yield* fs.readFileString(absoluteFile).pipe(Effect.orElseSucceed(() => Str.empty));
    if (A.some(needles, (needle) => Str.includes(needle)(content))) evidence = A.append(evidence, relativeFile);
  }
  return evidence;
});

const observation = (
  surfaceId: string,
  status: RegistrationObservationStatus,
  evidence: ReadonlyArray<string>
): RegistrationObservation => RegistrationObservation.make({ surfaceId, status, evidence });

const inspectSurface = Effect.fn("RegistrationGeometry.inspectSurface")(function* (
  repoRoot: string,
  target: RegistrationTarget,
  surface: RegistrationSurface
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return yield* RegistrationSurface.match(surface, {
    "owned-tree": Effect.fn(function* (owned) {
      const exists = yield* fs.exists(path.join(repoRoot, owned.root)).pipe(Effect.orElseSucceed(thunkFalse));
      return observation(owned.id, exists ? "residue" : "clean", exists ? [owned.root] : []);
    }),
    "workspace-literal": Effect.fn(function* (workspace) {
      const evidence = yield* existingEvidence(repoRoot, [workspace.file], [`"${workspace.workspacePath}"`]);
      return observation(workspace.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "identity-segment": Effect.fn(function* (identity) {
      const evidence = yield* existingEvidence(
        repoRoot,
        [identity.registryFile],
        [`"${identity.slug}"`, identity.accessor]
      );
      return observation(identity.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "derived-rebuild": Effect.fn(function* (derived) {
      const evidence = yield* existingEvidence(repoRoot, derived.outputs, [target.packageName, target.packagePath]);
      return observation(derived.id, A.isReadonlyArrayNonEmpty(evidence) ? "drift" : "clean", evidence);
    }),
    "generated-inventory": Effect.fn(function* (inventory) {
      const evidence = yield* existingEvidence(repoRoot, inventory.outputs, [inventory.membershipKey]);
      return observation(inventory.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "authored-reference": Effect.fn(function* (authored) {
      const files = yield* collectFiles(repoRoot, TEXT_SUFFIXES);
      let evidence = A.empty<string>();
      for (const file of files) {
        const relative = normalizePath(path.relative(repoRoot, file));
        if (
          Str.startsWith("research/")(relative) ||
          Str.startsWith("goals/")(relative) ||
          Str.startsWith(".changeset/")(relative)
        )
          continue;
        const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
        if (A.some(authored.needles, (needle) => Str.includes(needle)(content)))
          evidence = A.append(evidence, relative);
      }
      return observation(
        authored.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "pending-changeset": Effect.fn(function* (pending) {
      const changesetRoot = path.join(repoRoot, ".changeset");
      const files = yield* collectFiles(changesetRoot, [".md"]);
      // The dedicated `{}` deletion note is the intentional record the delete
      // itself emits; only OTHER pending changesets naming the package are
      // residue.
      const deletionNoteFile = `delete-${Str.replace("@beep/", Str.empty)(pending.packageName)}.md`;
      let evidence = A.empty<string>();
      for (const file of files) {
        if (Str.equivalence(path.basename(file), deletionNoteFile)) continue;
        const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
        if (Str.includes(pending.packageName)(content))
          evidence = A.append(evidence, normalizePath(path.relative(repoRoot, file)));
      }
      return observation(
        pending.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "runtime-artifact": Effect.fn(function* (runtime) {
      const targetExists = yield* fs
        .exists(path.join(repoRoot, target.packagePath))
        .pipe(Effect.orElseSucceed(thunkFalse));
      const ciFiles = yield* collectFiles(path.join(repoRoot, ".beep", "ci"), TEXT_SUFFIXES);
      let evidence = targetExists ? A.of(target.packagePath) : A.empty<string>();
      for (const file of ciFiles) {
        const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
        if (Str.includes(target.packageName)(content))
          evidence = A.append(evidence, normalizePath(path.relative(repoRoot, file)));
      }
      return observation(
        runtime.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "data-resource": (data) =>
      Effect.succeed(observation(data.id, "consent-required", [`manual cleanup: ${data.resourceName}`])),
    "historical-record": Effect.fn(function* (historical) {
      const files = yield* collectFiles(repoRoot, [".md", ".json", ".jsonc", ".tsv"]);
      let evidence = A.empty<string>();
      for (const file of files) {
        const relative = normalizePath(path.relative(repoRoot, file));
        if (!(Str.startsWith("research/")(relative) || Str.startsWith("goals/")(relative))) continue;
        const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
        if (A.some(historical.needles, (needle) => Str.includes(needle)(content)))
          evidence = A.append(evidence, relative);
      }
      return observation(
        historical.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "historical" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
  });
});

export const inspectTargetAtRoot = Effect.fn("RegistrationGeometry.inspectTargetAtRoot")(function* (
  repoRoot: string,
  target: RegistrationTarget
) {
  return yield* Effect.forEach(surfacesForTarget(target), (surface) => inspectSurface(repoRoot, target, surface), {
    concurrency: 8,
  });
});

const addReverseEdge = (
  reverse: HashMap.HashMap<string, HashSet.HashSet<string>>,
  dependency: string,
  owner: string
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  const owners = pipe(HashMap.get(reverse, dependency), O.getOrElse(HashSet.empty<string>));
  return HashMap.set(reverse, dependency, HashSet.add(owners, owner));
};

const manifestKindFor = (bucket: string): DependentHitKind =>
  bucket === "dependencies"
    ? "manifest-prod"
    : bucket === "devDependencies"
      ? "manifest-dev"
      : bucket === "peerDependencies"
        ? "manifest-peer"
        : "manifest-optional";

const hitKey = (hit: DependentHit): string =>
  `${hit.kind}\u0000${hit.owner}\u0000${hit.file}\u0000${O.getOrElse(hit.line, () => 0)}`;

const ownerForFile = (file: string, workspaces: ReadonlyArray<readonly [name: string, dir: string]>): string =>
  pipe(
    A.findFirst(workspaces, ([, dir]) => Str.startsWith(`${normalizePath(dir)}/`)(normalizePath(file))),
    O.map(([name]) => name),
    O.getOrElse(() => "@beep/root")
  );

const isTargetSpecifier = (specifier: string, packageName: string): boolean =>
  Str.equivalence(specifier, packageName) || Str.startsWith(`${packageName}/`)(specifier);

const dynamicImportSpecifier = (node: Node): O.Option<string> => {
  if (!Node.isCallExpression(node)) return O.none();
  const expression = node.getExpression();
  const isLoader =
    (Node.isIdentifier(expression) && Str.equivalence(expression.getText(), "require")) ||
    expression.getKind() === SyntaxKind.ImportKeyword;
  if (!isLoader) return O.none();
  return pipe(
    A.head(node.getArguments()),
    O.flatMap((argument) => (Node.isStringLiteral(argument) ? O.some(argument.getLiteralText()) : O.none()))
  );
};

const importHitsInFile = (
  project: Project,
  absoluteFile: string,
  relativeFile: string,
  owner: string,
  content: string,
  target: RegistrationTarget
): ReadonlyArray<DependentHit> => {
  const source = project.createSourceFile(absoluteFile, content, { overwrite: true });
  let hits = A.empty<DependentHit>();
  const kind = importKindForFile(relativeFile);

  const append = (line: number): void => {
    hits = A.append(
      hits,
      DependentHit.make({ kind, owner, file: PosixPath.make(relativeFile), line: O.some(line), direct: true })
    );
  };

  for (const declaration of source.getImportDeclarations()) {
    if (isTargetSpecifier(declaration.getModuleSpecifierValue(), target.packageName))
      append(declaration.getStartLineNumber());
  }
  for (const declaration of source.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier !== undefined && isTargetSpecifier(specifier, target.packageName))
      append(declaration.getStartLineNumber());
  }
  source.forEachDescendant((node) => {
    const specifier = dynamicImportSpecifier(node);
    if (O.isSome(specifier) && isTargetSpecifier(specifier.value, target.packageName))
      append(node.getStartLineNumber());
  });
  return hits;
};

const IDENTITY_PACKAGE_PREFIX = "packages/foundation/modeling/identity/";

const importKindForFile = (relativeFile: string): DependentHitKind =>
  Str.includes("/test/")(relativeFile) || Str.includes(".test.")(relativeFile) ? "import-test" : "import-prod";

const needleLineHits = (
  content: string,
  matchesLine: (line: string) => boolean,
  hitForLine: (line: number) => DependentHit
): ReadonlyArray<DependentHit> => {
  const lines = Str.split("\n")(content);
  let hits = A.empty<DependentHit>();
  for (let index = 0; index < A.length(lines); index += 1) {
    const line = pipe(
      A.get(lines, index),
      O.getOrElse(() => Str.empty)
    );
    if (matchesLine(line)) hits = A.append(hits, hitForLine(index + 1));
  }
  return hits;
};

const accessorHitsInFile = (
  accessor: string,
  relativeFile: string,
  owner: string,
  content: string
): ReadonlyArray<DependentHit> => {
  if (Str.startsWith(IDENTITY_PACKAGE_PREFIX)(relativeFile)) return A.empty<DependentHit>();
  return needleLineHits(content, Str.includes(accessor), (line) =>
    DependentHit.make({
      kind: importKindForFile(relativeFile),
      owner,
      file: PosixPath.make(relativeFile),
      line: O.some(line),
      direct: true,
    })
  );
};

const BASELINE_REFERENCE_FILES = [
  "bun.lock",
  "tsconfig.json",
  "tsconfig.packages.json",
  "syncpack.config.ts",
  "packages/foundation/modeling/identity/src/packages.ts",
];

const isBaselineReferenceFile = (file: string): boolean =>
  Str.startsWith("standards/")(file) ||
  Str.startsWith(".changeset/")(file) ||
  A.some(BASELINE_REFERENCE_FILES, Str.equivalence(file));

const AUTHORED_KIND_RULES: ReadonlyArray<readonly [matches: (file: string) => boolean, kind: DependentHitKind]> = [
  [isBaselineReferenceFile, "baseline"],
  [Str.startsWith("goals/"), "packet"],
  [Str.startsWith("research/"), "historical-doc"],
  [Str.equivalence("package.json"), "script"],
];

const authoredKindFor = (file: string): DependentHitKind =>
  pipe(
    A.findFirst(AUTHORED_KIND_RULES, ([matches]) => matches(file)),
    O.map(([, kind]) => kind),
    O.getOrElse((): DependentHitKind => "file-path")
  );

type WorkspaceEdge = { readonly owner: string; readonly bucket: string; readonly dependency: string };

const collectWorkspaceEdges = Effect.fn("RegistrationGeometry.collectWorkspaceEdges")(function* (
  repoRoot: string,
  targetName: string
) {
  const dependencyIndex = yield* buildRepoDependencyIndex(repoRoot).pipe(
    Effect.mapError(RegistrationGeometryError.newCause(`Failed to build dependency index for ${targetName}.`))
  );
  let edges = A.empty<WorkspaceEdge>();
  for (const [owner, deps] of HashMap.entries(dependencyIndex)) {
    for (const [bucket, entries] of R.toEntries(deps.workspace)) {
      for (const dependency of R.keys(entries)) {
        edges = A.append(edges, { owner, bucket, dependency });
      }
    }
  }
  return edges;
});

const rootScriptHits = (scripts: Record<string, string>, target: RegistrationTarget): ReadonlyArray<DependentHit> =>
  pipe(
    R.toEntries(scripts),
    A.filter(([, command]) => Str.includes(target.packageName)(command) || Str.includes(target.packagePath)(command)),
    A.map(() =>
      DependentHit.make({
        kind: "script",
        owner: "@beep/root",
        file: PosixPath.make("package.json"),
        line: O.none(),
        direct: true,
      })
    )
  );

const rootPolicyFileHits = Effect.fn("RegistrationGeometry.rootPolicyFileHits")(function* (
  repoRoot: string,
  target: RegistrationTarget
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let hits = A.empty<DependentHit>();
  for (const rootPolicyFile of ["turbo.json", "lefthook.yml", "biome.jsonc"]) {
    const absoluteFile = path.join(repoRoot, rootPolicyFile);
    const exists = yield* fs.exists(absoluteFile).pipe(Effect.orElseSucceed(thunkFalse));
    if (!exists) continue;
    const content = yield* fs.readFileString(absoluteFile);
    if (Str.includes(target.packageName)(content) || Str.includes(target.packagePath)(content)) {
      hits = A.append(
        hits,
        DependentHit.make({
          kind: "file-path",
          owner: "@beep/root",
          file: PosixPath.make(rootPolicyFile),
          line: O.none(),
          direct: true,
        })
      );
    }
  }
  return hits;
});

const decodedRootManifest = Effect.fn("RegistrationGeometry.decodedRootManifest")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs.readFileString(path.join(repoRoot, "package.json"));
  const unknown = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(content).pipe(
    Effect.mapError(RegistrationGeometryError.newCause("Failed to parse root package.json during E15 scanning."))
  );
  return yield* decodePackageJsonEffect(unknown).pipe(
    Effect.mapError(RegistrationGeometryError.newCause("Failed to decode root package.json during E15 scanning."))
  );
});

const dedupedSortedHits = (hits: ReadonlyArray<DependentHit>): ReadonlyArray<DependentHit> => {
  let seen = HashSet.empty<string>();
  const deduped = A.filter(hits, (hit) => {
    const key = hitKey(hit);
    if (HashSet.has(seen, key)) return false;
    seen = HashSet.add(seen, key);
    return true;
  });
  return A.sort(deduped, Order.mapInput(Order.String, hitKey));
};

export const dependentsOfAtRoot = Effect.fn("RegistrationGeometry.dependentsOfAtRoot")(function* (
  repoRoot: string,
  target: RegistrationTarget
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspaces = A.fromIterable(yield* resolveWorkspaceDirs(repoRoot));
  const edges = yield* collectWorkspaceEdges(repoRoot, target.packageName);
  const reverse = A.reduce(edges, HashMap.empty<string, HashSet.HashSet<string>>(), (map, edge) =>
    addReverseEdge(map, edge.dependency, edge.owner)
  );

  const manifestHitFor = (edge: WorkspaceEdge): DependentHit => {
    const relativeManifest = pipe(
      A.findFirst(workspaces, ([name]) => Str.equivalence(name, edge.owner)),
      O.map(([, dir]) => normalizePath(path.relative(repoRoot, path.join(dir, "package.json")))),
      O.getOrElse(() => "package.json")
    );
    return DependentHit.make({
      kind: manifestKindFor(edge.bucket),
      owner: edge.owner,
      file: PosixPath.make(relativeManifest),
      line: O.none(),
      direct: true,
    });
  };
  let hits = pipe(
    edges,
    A.filter((edge) => Str.equivalence(edge.dependency, target.packageName)),
    A.map(manifestHitFor)
  );

  const direct = pipe(HashMap.get(reverse, target.packageName), O.getOrElse(HashSet.empty<string>));
  const transitive = yield* computeTransitiveClosure(reverse, target.packageName);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const identityAccessor = pipe(
    A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["identity-segment"]),
    O.map((surface) => surface.accessor)
  );

  const sourceHits = (
    absoluteFile: string,
    relativeFile: string,
    owner: string,
    content: string
  ): ReadonlyArray<DependentHit> => {
    if (!isSuffixIn(SOURCE_SUFFIXES)(absoluteFile)) return A.empty<DependentHit>();
    const importHits = importHitsInFile(project, absoluteFile, relativeFile, owner, content, target);
    const accessorHits = pipe(
      identityAccessor,
      O.map((accessor) => accessorHitsInFile(accessor, relativeFile, owner, content)),
      O.getOrElse(A.empty<DependentHit>)
    );
    return A.appendAll(importHits, accessorHits);
  };
  const textHits = (relativeFile: string, owner: string, content: string): ReadonlyArray<DependentHit> =>
    needleLineHits(
      content,
      (line) => Str.includes(target.packageName)(line) || Str.includes(target.packagePath)(line),
      (line) =>
        DependentHit.make({
          kind: authoredKindFor(relativeFile),
          owner,
          file: PosixPath.make(relativeFile),
          line: O.some(line),
          direct: true,
        })
    );
  const scanFile = Effect.fn("RegistrationGeometry.dependentsOfAtRoot.scanFile")(function* (absoluteFile: string) {
    const relativeFile = normalizePath(path.relative(repoRoot, absoluteFile));
    if (Str.startsWith(`${target.packagePath}/`)(relativeFile)) return A.empty<DependentHit>();
    const content = yield* fs.readFileString(absoluteFile).pipe(Effect.orElseSucceed(() => Str.empty));
    const mentionsAccessor = O.match(identityAccessor, {
      onNone: thunkFalse,
      onSome: (accessor) => Str.includes(accessor)(content),
    });
    if (!Str.includes(target.packageName)(content) && !Str.includes(target.packagePath)(content) && !mentionsAccessor)
      return A.empty<DependentHit>();
    const owner = ownerForFile(absoluteFile, workspaces);
    return A.appendAll(sourceHits(absoluteFile, relativeFile, owner, content), textHits(relativeFile, owner, content));
  });

  for (const root of SCAN_ROOTS) {
    const files = yield* collectFiles(path.join(repoRoot, root), TEXT_SUFFIXES);
    for (const absoluteFile of files) {
      hits = A.appendAll(hits, yield* scanFile(absoluteFile));
    }
  }

  const rootManifest = yield* decodedRootManifest(repoRoot);
  if (O.isSome(rootManifest.scripts)) hits = A.appendAll(hits, rootScriptHits(rootManifest.scripts.value, target));
  hits = A.appendAll(hits, yield* rootPolicyFileHits(repoRoot, target));

  return DependentsReport.make({
    target,
    directWorkspaceDependents: A.sort(A.fromIterable(direct), Order.String),
    transitiveWorkspaceDependents: A.sort(A.fromIterable(transitive), Order.String),
    hits: dedupedSortedHits(hits),
  });
});
