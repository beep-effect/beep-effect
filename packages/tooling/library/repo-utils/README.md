# `@beep/repo-utils`

Effect-based monorepo utilities for repository analysis and workspace management.

Workspace discovery and the workspace dependency graph live in `@beep/repo-workspaces`
(`WorkspaceDiscovery`, `DependencyGraph`).

## Quick Start

```typescript
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import {
  FsUtilsLive, findRepoRoot, topologicalSort,
  TSMorphService, TSMorphServiceLive, TsMorphProjectScopeRequest, TsMorphScopeEntrypoint
} from "@beep/repo-utils"

const program = Effect.gen(function* () {
  const root = yield* findRepoRoot()
  const buildOrder = yield* topologicalSort(HashMap.make(["app", HashSet.make("lib")], ["lib", HashSet.empty<string>()]))
  const tsmorph = yield* TSMorphService
  const scope = yield* tsmorph.resolveProjectScope(
    TsMorphProjectScopeRequest.make({
      entrypoint: TsMorphScopeEntrypoint.make(`${root}/tsconfig.json`),
      repoRootPath: Option.none(),
      mode: "semantic",
      referencePolicy: "followReferences"
    })
  )
  return { root, buildOrder, scope }
}).pipe(
  Effect.provide(TSMorphServiceLive),
  Effect.provide(FsUtilsLive),
  Effect.provide([NodeFileSystem.layer, NodePath.layer])
)
```

## Modules

| Module | Key Exports | Purpose |
|--------|-------------|---------|
| **FsUtils** | `FsUtils`, `FsUtilsLive` | glob, readJson, writeJson, modifyFile, existsOrThrow |
| **Root** | `findRepoRoot` | Walk upward for `.git`/`bun.lock` markers |
| **Graph** | `topologicalSort`, `detectCycles`, `computeTransitiveClosure` | Dependency graph analysis |
| **TsConfig** | `collectTsConfigPaths` | Find all tsconfig files for the root and the workspace directories the caller names |
| **PackageJson** | `PackageJson`, `decodePackageJson` | Strict repo package.json model extending `@beep/package-json` `PackageManifest` |
| **TSMorphService** | `TSMorphService`, `TSMorphServiceLive` | Scoped ts-morph graph extraction, deterministic JSDoc derivation, symbol query/search, and JSDoc validate/plan/apply/drift flows |

## Installation

Private workspace package:

```json
{
  "dependencies": {
    "@beep/repo-utils": "workspace:*"
  }
}
```

## Scripts

```bash
bun run check     # Type check
npx vitest run    # Run tests (NOT bun test)
bun run build     # Compile + pure annotations
bun run docgen    # Generate API docs
```

## License

MIT
