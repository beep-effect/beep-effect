#!/usr/bin/env bun
/**
 * Writes the deploy role's inline policy (`src/DeployRolePolicy.ts`) as JSON,
 * plus the chunks `aws iam simulate-custom-policy` takes: each at most 2,000
 * characters, statements kept whole (`chunkByLength`). The policy only allows,
 * so the chunks evaluate together exactly as the whole document does.
 *
 * `--vpc-arn <arn>` writes v2 (`policy-v2.json`, `v2-<n>.json`); without it,
 * v1. Either run also writes `fleet-boundary.json`, the document of the
 * bootstrap boundary policy. The gate runs it from the operator workstation;
 * nothing here calls AWS.
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
import { chunkByLength, deployRolePolicy, fleetBoundaryDocument } from "./src/DeployRolePolicy.ts";
import type * as IAM from "@alchemy.run/aws/IAM";

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const chunkLimit = 2000;

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
    const boundary = yield* encode(fleetBoundaryDocument);
    yield* fs.writeFileString(path.join(outDir, "fleet-boundary.json"), boundary);
    const encoded = yield* Effect.forEach(policy.Statement, (statement) => encode(statement), { concurrency: 1 });
    const empty = yield* encode({ Version: policy.Version, Statement: [] });
    const groups = chunkByLength({
      lengths: A.map(encoded, (statement) => statement.length),
      limit: chunkLimit,
      overhead: empty.length,
    });
    yield* Effect.forEach(
      groups,
      Effect.fnUntraced(function* (group, index) {
        const statements: Array<IAM.PolicyStatement> = A.flatMap(group, (member) =>
          O.toArray(A.get(policy.Statement, member))
        );
        const chunk = yield* encode({ Version: policy.Version, Statement: statements });
        yield* fs.writeFileString(path.join(outDir, `${version}-${index}.json`), chunk);
      }),
      { concurrency: 1, discard: true }
    );
    yield* Console.log(`${version}: ${text.length} characters, ${groups.length} chunks in ${outDir}`);
  })
).pipe(Command.withDescription("Write the CiRunners deploy role policy and its simulation chunks."));

Command.run(write, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
