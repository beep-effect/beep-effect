# @beep/repo-cli-kit

Repo-specific CLI helpers shared by the beep command tools: JSON and text codecs, process steps, artifacts, systemd units, package-script policy and the shared entry path.

The modules moved here from `@beep/repo-cli`'s `src/internal/` in
beep-cli-composition W3. The package is private to this repository.

## Usage

The root entry exports nothing; import the module you need by its path:

```ts
import { printCommandJson } from "@beep/repo-cli-kit/cli/Json"
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec"
```

| Directory | Holds |
| --- | --- |
| `cli/` | flags, JSON and JSONC output, stdout and stdin, filesystem guards, timing, progress, failure rendering, run modes, Turbo cache environment and the labs workspace paths |
| `schema/` | JSON and text codecs, UUID and positive-integer schemas, the opaque defect wrapper |
| `process/` | captured child-process steps with output bounds and deadlines |
| `artifacts/` | artifact reads and writes and generated-file drift checks |
| `systemd/` | installed systemd unit parsing, unit paths and the Bun path a unit runs |
| `package-scripts/` | the generated package-script policy |
| `tsmorph/` | ts-morph project factories, JSDoc readers and the owner resolver |
| `stats/`, `duckdb/` | nearest-rank percentiles and a scoped DuckDB connection |
| root modules | CODEOWNERS matching, lenient manifest reads, path containment, workspace globs and whole-token matching |

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/repo-cli-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
