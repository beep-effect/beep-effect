# `@beep/repo-utils`

Effect-based monorepo utilities for repository analysis and workspace management.

## Quick Start

```typescript
import { Effect, Option } from "effect"
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import {
  FsUtils, FsUtilsLive, findRepoRoot, resolveWorkspaceDirs,
  buildRepoDependencyIndex, topologicalSort,
  TSMorphService, TSMorphServiceLive, TsMorphProjectScopeRequest
} from "@beep/repo-utils"

const program = Effect.gen(function* () {
  const root = yield* findRepoRoot()
  const workspaces = yield* resolveWorkspaceDirs(root)
  const depIndex = yield* buildRepoDependencyIndex(root)
  const buildOrder = yield* topologicalSort(/* adjacency list */)
  const tsmorph = yield* TSMorphService
  const scope = yield* tsmorph.resolveProjectScope(
    new TsMorphProjectScopeRequest({
      rootTsConfigPath: `${root}/tsconfig.json`,
      changedFiles: Option.none(),
      idMode: Option.none()
    })
  )
  return { root, workspaces, depIndex, buildOrder, scope }
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
| **Workspaces** | `resolveWorkspaceDirs` | Expand workspace globs to `HashMap<name, dir>` |
| **Dependencies** | `extractWorkspaceDependencies` | Classify deps as workspace vs NPM |
| **DependencyIndex** | `buildRepoDependencyIndex` | Full `HashMap<pkg, TypedDeps>` for monorepo |
| **UniqueDeps** | `collectUniqueNpmDependencies` | Union all NPM deps across packages |
| **Graph** | `topologicalSort`, `detectCycles`, `computeTransitiveClosure` | Dependency graph analysis |
| **TsConfig** | `collectTsConfigPaths` | Find all tsconfig files per workspace |
| **PackageJson** | `PackageJson`, `decodePackageJson` | Type-safe package.json schema |
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
