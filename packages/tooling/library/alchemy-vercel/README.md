# @beep/alchemy-vercel

Alchemy resources for Vercel over `@distilled.cloud/vercel`: `Vercel.Project`,
`Vercel.EnvVar` and `Vercel.Domain`, wired by `Vercel.providers`. Alchemy ships
no Vercel provider, so this package fills that gap
(`goals/infra-alchemy-rebuild`, D3, D14) and follows Alchemy's own provider
conventions so it can go upstream.

## Usage

```ts
import * as Vercel from "@beep/alchemy-vercel"
import { adopt } from "alchemy/AdoptPolicy"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

export const program = Effect.gen(function* () {
  const project = yield* Vercel.Project("Web", {
    name: "web",
    teamId: "team_123",
    framework: "nextjs",
    rootDirectory: "apps/web",
    installCommand: "cd ../.. && bun install",
    gitRepository: { type: "github", repo: "acme/web" },
    deploymentProtection: "none",
    nodeVersion: "22.x",
  })
  yield* Vercel.EnvVar("ApiKey", {
    project: project.projectId,
    teamId: "team_123",
    key: "API_KEY",
    value: yield* Config.Redacted("API_KEY"),
    targets: ["production"],
    type: "sensitive",
  })
  // Take an existing domain over from the project that holds it today.
  yield* Vercel.Domain("Apex", {
    project: project.projectId,
    teamId: "team_123",
    name: "example.com",
    moveFrom: "web-legacy",
  }).pipe(adopt(true))
})
```

The stack provides `Vercel.providers`, which reads `VERCEL_TOKEN` (and
optionally `VERCEL_API_URL`) from the environment. There is no Alchemy
profile; pass the token through `op run`.

## Behaviour

- Vercel objects carry no tags, so an object this stack did not create reads
  as foreign (`OwnedBySomeoneElse`) until the resource is wrapped in
  `adopt(true)` or the deploy passes `--adopt`.
- `Project`: `teamId` and `gitRepository` changes replace the project; a
  replacement that keeps the name deletes first, because names are unique per
  team.
- `EnvVar`: the value is `Redacted` and is never an attribute; every update
  writes the declared value. `project`, `teamId` and `type` changes replace.
- `Domain`: a `project` change moves the domain (`moveProjectDomain`);
  `moveFrom` plus adoption moves it from the project that holds it. Unverified
  domains report their DNS challenges in `verification`.

## Tests

`bun run test` runs the provider lifecycles on the `@alchemy.run/test`
harness against an in-memory Vercel API (`test/harness/FakeVercel.ts`); no
token is needed and nothing reaches Vercel.

## License

MIT
