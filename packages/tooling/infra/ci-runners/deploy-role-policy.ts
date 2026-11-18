#!/usr/bin/env bun
/**
 * Writes the deploy role's inline policy (`src/DeployRolePolicy.ts`) as JSON,
 * plus the chunks `aws iam simulate-custom-policy` takes: each at most 2,000
 * characters, statements kept whole. The policy only allows, so the chunks
 * evaluate together exactly as the whole document does.
 *
 * `--vpc-arn <arn>` writes v2 (`policy-v2.json`, `v2-<n>.json`); without it,
 * v1. The gate runs it from the operator workstation; nothing here calls AWS.
 *
 * @internal
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { deployRolePolicy } from "./src/DeployRolePolicy.ts";
import type * as IAM from "@alchemy.run/aws/IAM";

const encode = S.encodeEffect(S.UnknownFromJsonString);
const chunkLimit = 2000;

const document = (statements: ReadonlyArray<IAM.PolicyStatement>) =>
  encode({ Version: "2012-10-17", Statement: statements });

// Greedy chunking: a statement joins the open chunk while the encoded chunk stays within the limit.
const chunk = Effect.fn("CiRunners.chunkPolicy")(function* (statements: ReadonlyArray<IAM.PolicyStatement>) {
  let chunks: ReadonlyArray<ReadonlyArray<IAM.PolicyStatement>> = [];
  for (const statement of statements) {
    const open = A.last(chunks);
    const grown = O.map(open, (current) => A.append(current, statement));
    const fits = O.isSome(grown) && (yield* document(grown.value)).length <= chunkLimit;
    chunks = fits && O.isSome(grown) ? A.append(A.dropRight(chunks, 1), grown.value) : A.append(chunks, [statement]);
  }
  return chunks;
});

const write = Command.make(
  "deploy-role-policy",
  {
    vpcArn: Flag.String("vpc-arn").pipe(Flag.withDescription("The prod fleet VPC ARN, for v2"), Flag.optional),
    outDir: Flag.String("out-dir").pipe(Flag.withDescription("Directory for the policy and its chunks")),
  },
  Effect.fn("CiRunners.deployRolePolicyCli")(function* ({ vpcArn, outDir }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const version = O.isSome(vpcArn) ? "v2" : "v1";
    const policy = deployRolePolicy(vpcArn);
    yield* fs.makeDirectory(outDir, { recursive: true });
    const text = yield* encode(policy);
    yield* fs.writeFileString(path.join(outDir, `policy-${version}.json`), text);
    const chunks = yield* chunk(policy.Statement);
    yield* Effect.forEach(
      chunks,
      Effect.fnUntraced(function* (statements, index) {
        const chunkText = yield* document(statements);
        if (chunkText.length > chunkLimit) {
          return yield* Effect.die(`statement ${String(statements[0]?.Sid)} alone exceeds ${chunkLimit} characters`);
        }
        yield* fs.writeFileString(path.join(outDir, `${version}-${index}.json`), chunkText);
      }),
      { concurrency: 1, discard: true }
    );
    yield* Console.log(`${version}: ${text.length} characters, ${chunks.length} chunks in ${outDir}`);
  })
).pipe(Command.withDescription("Write the CiRunners deploy role policy and its simulation chunks."));

Command.run(write, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
