// Preserve complete parsed source documents; never execute workflow expressions or steps.
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { decodeYamlTextAs } from "@beep/schema/Yaml";
import { NodeCrypto } from "@effect/platform-node";
import { Console, Effect, Order } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

// Boundary schemas retain every YAML field. The version-pinning resolver's
// smaller internal model intentionally omits commands and cannot serve here.
const Document = S.Record(S.String, S.Unknown);
const Report = S.Struct({
  schemaVersion: S.Literal("cache-workflow-source-snapshot/v1"),
  authority: S.String,
  files: S.NonEmptyArray(S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex, document: Document })),
});
const paths = A.sort(
  A.flatMap([".github/workflows/*.{yml,yaml}", ".github/actions/**/action.{yml,yaml}"], (pattern) =>
    A.fromIterable(new Bun.Glob(pattern).scanSync({ dot: true }))
  ),
  Order.String
);
const files = await Effect.runPromise(
  Effect.forEach(paths, (path) =>
    Effect.gen(function* () {
      const bytes = new Uint8Array(yield* Effect.tryPromise(() => Bun.file(path).arrayBuffer()));
      const text = yield* Effect.try(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return {
        path,
        sha256: yield* S.decodeEffect(Sha256HexFromBytes)(bytes),
        document: yield* decodeYamlTextAs(Document)(text),
      };
    })
  ).pipe(Effect.provide(NodeCrypto.layer))
);
const encoded = await Effect.runPromise(
  S.encodeUnknownEffect(S.fromJsonString(Report))({
    schemaVersion: "cache-workflow-source-snapshot/v1",
    authority:
      "Complete parsed local workflow/action source. Expressions, shell bodies, remote references and permission declarations are unevaluated data. No execution, deployed posture or qualification is established.",
    files,
  })
);
const output = await Effect.runPromise(
  S.decodeUnknownEffect(CacheEvidenceReference.fields.path)(Bun.argv[2] ?? "workflow-sources.json")
);
await Bun.write(`goals/turborepo-task-qualification/research/${output}`, `${encoded}\n`);
await Effect.runPromise(
  Console.log(`Captured ${files.length} complete local workflow/action documents without executing them.`)
);
