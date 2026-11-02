#!/usr/bin/env bun
/**
 * One-time OIP Pulumi DIY backend bucket migration.
 *
 * This script moves the OIP Pulumi state backend from the legacy
 * `opip-law-pulumi-state` bucket to `oip-law-pulumi-state`. S3 buckets cannot
 * be renamed, so the migration creates and hardens the target bucket, copies
 * current Pulumi state, archives all source object versions, and optionally
 * deletes the source bucket in a second explicit run.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type AwsRunOptions = {
  readonly allowFailure?: boolean | undefined;
};

type AwsRunResult = {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
};

type CliOptions = {
  readonly account: string;
  readonly deleteSource: boolean;
  readonly dryRun: boolean;
  readonly region: string;
  readonly source: string;
  readonly target: string;
  readonly yes: boolean;
};

type Identity = {
  readonly Account: string;
  readonly Arn: string;
  readonly UserId: string;
};

type ObjectVersion = {
  readonly ETag?: string | undefined;
  readonly IsLatest?: boolean | undefined;
  readonly Key: string;
  readonly LastModified?: string | undefined;
  readonly Size?: number | undefined;
  readonly VersionId: string;
};

type DeleteMarker = {
  readonly IsLatest?: boolean | undefined;
  readonly Key: string;
  readonly LastModified?: string | undefined;
  readonly VersionId: string;
};

type ObjectVersionsResponse = {
  readonly DeleteMarkers?: ReadonlyArray<DeleteMarker> | undefined;
  readonly Versions?: ReadonlyArray<ObjectVersion> | undefined;
};

type CurrentObject = {
  readonly ETag?: string | undefined;
  readonly Key: string;
  readonly Size: number;
};

type CurrentObjectsResponse = {
  readonly Contents?: ReadonlyArray<CurrentObject> | undefined;
};

type ArchiveRecord = {
  readonly archiveKey: string;
  readonly etag?: string | undefined;
  readonly isLatest?: boolean | undefined;
  readonly key: string;
  readonly lastModified?: string | undefined;
  readonly size?: number | undefined;
  readonly versionId: string;
};

type MigrationManifest = {
  readonly source?: string | undefined;
  readonly target?: string | undefined;
};

const defaults = {
  account: "832907639880",
  archiveRoot: ".pulumi-migration-archive",
  currentStatePrefix: ".pulumi/",
  latestManifestKey: ".pulumi-migration-archive/latest-oip-state-bucket-migration.json",
  region: "us-east-1",
  requiredProjectPrefix: ".pulumi/stacks/opip-web/",
  source: "opip-law-pulumi-state",
  target: "oip-law-pulumi-state",
} as const;

const usage = `Usage:
  bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --dry-run
  bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --yes
  bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --delete-source --yes

Options:
  --source <bucket>       Source bucket. Default: ${defaults.source}
  --target <bucket>       Target bucket. Default: ${defaults.target}
  --region <region>       AWS region. Default: ${defaults.region}
  --account <account-id>  Expected AWS account. Default: ${defaults.account}
  --dry-run               Run read-only preflight.
  --delete-source         Delete the versioned source bucket after migration proof.
  --yes                   Required for mutating phases.
  --help                  Print this help.
`;

const textDecoder = new TextDecoder();

const parseArgs = (argv: ReadonlyArray<string>): CliOptions => {
  let account: string = defaults.account;
  let deleteSource = false;
  let dryRun = false;
  let region: string = defaults.region;
  let source: string = defaults.source;
  let target: string = defaults.target;
  let yes = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--account") {
      account = argv[index + 1] ?? fail("--account requires a value");
      index += 1;
    } else if (arg === "--delete-source") {
      deleteSource = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    } else if (arg === "--region") {
      region = argv[index + 1] ?? fail("--region requires a value");
      index += 1;
    } else if (arg === "--source") {
      source = argv[index + 1] ?? fail("--source requires a value");
      index += 1;
    } else if (arg === "--target") {
      target = argv[index + 1] ?? fail("--target requires a value");
      index += 1;
    } else if (arg === "--yes") {
      yes = true;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  return { account, deleteSource, dryRun, region, source, target, yes };
};

const validateOptions = (options: CliOptions): void => {
  if (options.source === options.target) {
    fail(`Source and target buckets must be different: ${options.source}.`);
  }
};

const fail = (message: string): never => {
  process.stderr.write(`${message}\n\n${usage}`);
  process.exit(1);
};

const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

const aws = async (args: ReadonlyArray<string>, options: AwsRunOptions = {}): Promise<AwsRunResult> => {
  const proc = Bun.spawn(["aws", ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdoutBytes, stderrBytes, exitCode] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer(),
    proc.exited,
  ]);
  const result = {
    exitCode,
    stderr: textDecoder.decode(stderrBytes),
    stdout: textDecoder.decode(stdoutBytes),
  };

  if (exitCode !== 0 && options.allowFailure !== true) {
    throw new Error(`aws ${args.join(" ")} failed with exit ${exitCode}\n${result.stderr}`);
  }

  return result;
};

const parseJson = <T>(raw: string, context: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snippet = raw.trim().slice(0, 500);
    throw new Error(`Failed to parse JSON for ${context}: ${message}\nRaw output: ${snippet}`);
  }
};

const requireYesForMutation = (options: CliOptions): void => {
  if (!options.yes) {
    fail("Mutating phases require --yes.");
  }
};

const assertExpectedIdentity = async (expectedAccount: string): Promise<Identity> => {
  const result = await aws(["sts", "get-caller-identity", "--output", "json"]);
  const identity = parseJson<Identity>(result.stdout, "sts get-caller-identity");

  if (identity.Account !== expectedAccount) {
    fail(`Refusing to run in AWS account ${identity.Account}; expected ${expectedAccount}.`);
  }

  log(`AWS identity OK: ${identity.Arn}`);
  return identity;
};

const bucketExists = async (bucket: string): Promise<boolean> => {
  const result = await aws(["s3api", "head-bucket", "--bucket", bucket], { allowFailure: true });
  return result.exitCode === 0;
};

const listCurrentObjects = async (bucket: string, prefix: string): Promise<ReadonlyArray<CurrentObject>> => {
  const result = await aws(["s3api", "list-objects-v2", "--bucket", bucket, "--prefix", prefix, "--output", "json"]);
  const response = parseJson<CurrentObjectsResponse>(result.stdout, `s3api list-objects-v2 ${bucket}/${prefix}`);
  return response.Contents ?? [];
};

const listObjectVersions = async (bucket: string): Promise<ObjectVersionsResponse> => {
  const result = await aws(["s3api", "list-object-versions", "--bucket", bucket, "--output", "json"]);
  return parseJson<ObjectVersionsResponse>(result.stdout, `s3api list-object-versions ${bucket}`);
};

const assertNoCurrentLocks = async (bucket: string): Promise<void> => {
  const locks = await listCurrentObjects(bucket, ".pulumi/locks/");
  if (locks.length > 0) {
    fail(`Refusing to migrate while ${locks.length} current Pulumi lock object(s) exist in ${bucket}.`);
  }
  log("No current Pulumi lock objects found.");
};

const writeJsonTemp = async (dir: string, fileName: string, value: unknown): Promise<string> => {
  const path = join(dir, fileName);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
};

const putJsonObject = async (
  bucket: string,
  key: string,
  value: unknown,
  tmp: string,
  fileName: string
): Promise<void> => {
  const path = await writeJsonTemp(tmp, fileName, value);
  await aws([
    "s3api",
    "put-object",
    "--bucket",
    bucket,
    "--key",
    key,
    "--body",
    path,
    "--content-type",
    "application/json",
  ]);
};

const makeHttpsOnlyPolicy = (bucket: string) => ({
  Statement: [
    {
      Action: "s3:*",
      Condition: {
        Bool: {
          "aws:SecureTransport": "false",
        },
      },
      Effect: "Deny",
      Principal: "*",
      Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
      Sid: "DenyInsecureTransport",
    },
  ],
  Version: "2012-10-17",
});

const hardenTargetBucket = async (bucket: string, tmp: string): Promise<void> => {
  const publicAccessPath = await writeJsonTemp(tmp, "public-access-block.json", {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  });
  await aws([
    "s3api",
    "put-public-access-block",
    "--bucket",
    bucket,
    "--public-access-block-configuration",
    `file://${publicAccessPath}`,
  ]);

  await aws(["s3api", "put-bucket-versioning", "--bucket", bucket, "--versioning-configuration", "Status=Enabled"]);

  const encryptionPath = await writeJsonTemp(tmp, "encryption.json", {
    Rules: [
      {
        ApplyServerSideEncryptionByDefault: {
          SSEAlgorithm: "AES256",
        },
      },
    ],
  });
  await aws([
    "s3api",
    "put-bucket-encryption",
    "--bucket",
    bucket,
    "--server-side-encryption-configuration",
    `file://${encryptionPath}`,
  ]);

  const policyPath = await writeJsonTemp(tmp, "policy.json", makeHttpsOnlyPolicy(bucket));
  await aws(["s3api", "put-bucket-policy", "--bucket", bucket, "--policy", `file://${policyPath}`]);

  const lifecyclePath = await writeJsonTemp(tmp, "lifecycle.json", {
    Rules: [
      {
        AbortIncompleteMultipartUpload: {
          DaysAfterInitiation: 7,
        },
        Filter: {
          Prefix: "",
        },
        ID: "expire-noncurrent-state-versions",
        NoncurrentVersionExpiration: {
          NoncurrentDays: 90,
        },
        Status: "Enabled",
      },
    ],
  });
  await aws([
    "s3api",
    "put-bucket-lifecycle-configuration",
    "--bucket",
    bucket,
    "--lifecycle-configuration",
    `file://${lifecyclePath}`,
  ]);

  const taggingPath = await writeJsonTemp(tmp, "tagging.json", {
    TagSet: [
      { Key: "Project", Value: "oip" },
      { Key: "Repository", Value: "beep-effect" },
      { Key: "Purpose", Value: "pulumi-state" },
      { Key: "ManagedBy", Value: "codex" },
    ],
  });
  await aws(["s3api", "put-bucket-tagging", "--bucket", bucket, "--tagging", `file://${taggingPath}`]);
};

const createTargetBucket = async (bucket: string, region: string, tmp: string): Promise<void> => {
  if (await bucketExists(bucket)) {
    log(`Target bucket exists: ${bucket}`);
    await hardenTargetBucket(bucket, tmp);
    return;
  }

  log(`Creating target bucket: ${bucket}`);
  if (region === "us-east-1") {
    await aws(["s3api", "create-bucket", "--bucket", bucket, "--region", region]);
  } else {
    await aws([
      "s3api",
      "create-bucket",
      "--bucket",
      bucket,
      "--region",
      region,
      "--create-bucket-configuration",
      `LocationConstraint=${region}`,
    ]);
  }
  await aws(["s3api", "wait", "bucket-exists", "--bucket", bucket]);
  await hardenTargetBucket(bucket, tmp);
};

const copyCurrentState = async (source: string, target: string): Promise<void> => {
  log(`Copying current Pulumi state from s3://${source}/.pulumi to s3://${target}/.pulumi`);
  await aws([
    "s3",
    "sync",
    `s3://${source}/.pulumi`,
    `s3://${target}/.pulumi`,
    "--exact-timestamps",
    "--only-show-errors",
  ]);
};

const archiveVersions = async (
  source: string,
  target: string,
  archivePrefix: string,
  tmp: string
): Promise<ReadonlyArray<ArchiveRecord>> => {
  const versionsResponse = await listObjectVersions(source);
  const versions = versionsResponse.Versions ?? [];
  const deleteMarkers = versionsResponse.DeleteMarkers ?? [];
  const records: Array<ArchiveRecord> = [];
  const objectPath = join(tmp, "object-version-body");

  log(`Archiving ${versions.length} source object version(s) to s3://${target}/${archivePrefix}/objects/`);
  for (const version of versions) {
    const encoded = Buffer.from(`${version.Key}\0${version.VersionId}`).toString("base64url");
    const archiveKey = `${archivePrefix}/objects/${encoded}`;
    await rm(objectPath, { force: true });
    await aws([
      "s3api",
      "get-object",
      "--bucket",
      source,
      "--key",
      version.Key,
      "--version-id",
      version.VersionId,
      objectPath,
    ]);
    await aws(["s3api", "put-object", "--bucket", target, "--key", archiveKey, "--body", objectPath]);
    records.push({
      archiveKey,
      etag: version.ETag,
      isLatest: version.IsLatest,
      key: version.Key,
      lastModified: version.LastModified,
      size: version.Size,
      versionId: version.VersionId,
    });
  }

  const manifest = {
    archivedAt: new Date().toISOString(),
    archivePrefix,
    deleteMarkers,
    source,
    target,
    versions: records,
  };
  await putJsonObject(target, `${archivePrefix}/manifest.json`, manifest, tmp, "archive-manifest.json");
  await putJsonObject(target, defaults.latestManifestKey, manifest, tmp, "latest-manifest.json");
  log(`Archived version manifest with ${deleteMarkers.length} delete marker(s).`);

  return records;
};

const assertRequiredStateObjects = async (target: string): Promise<void> => {
  const requiredObjects = [
    `${defaults.requiredProjectPrefix}staging.json`,
    `${defaults.requiredProjectPrefix}production.json`,
  ];
  for (const key of requiredObjects) {
    const result = await aws(["s3api", "head-object", "--bucket", target, "--key", key], { allowFailure: true });
    if (result.exitCode !== 0) {
      fail(`Target bucket is missing required object: ${key}`);
    }
  }
};

const verifyCurrentStateCopy = async (source: string, target: string): Promise<void> => {
  const sourceObjects = await listCurrentObjects(source, defaults.currentStatePrefix);
  const targetObjects = await listCurrentObjects(target, defaults.currentStatePrefix);
  const targetByKey = new Map(targetObjects.map((object) => [object.Key, object]));
  const unverified = sourceObjects.filter((object) => {
    const targetObject = targetByKey.get(object.Key);
    return targetObject === undefined || targetObject.Size !== object.Size || targetObject.ETag !== object.ETag;
  });

  if (unverified.length > 0) {
    fail(`Target state copy failed size/ETag verification for ${unverified.length} current object(s).`);
  }

  await assertRequiredStateObjects(target);
  log(`Verified ${sourceObjects.length} current Pulumi state object(s) in ${target} by size and ETag.`);
};

const assertMigrationMarker = async (source: string, target: string): Promise<void> => {
  const result = await aws(["s3", "cp", `s3://${target}/${defaults.latestManifestKey}`, "-"], {
    allowFailure: true,
  });
  if (result.exitCode !== 0) {
    fail(`Refusing to delete source before migration marker exists in ${target}.`);
  }
  const manifest = parseJson<MigrationManifest>(result.stdout, `s3://${target}/${defaults.latestManifestKey}`);
  if (manifest.source !== source || manifest.target !== target) {
    fail(
      `Refusing to delete ${source}; migration marker records source=${manifest.source ?? "<missing>"} target=${
        manifest.target ?? "<missing>"
      }.`
    );
  }
};

const deleteSourceBucket = async (source: string, target: string, tmp: string): Promise<void> => {
  await assertMigrationMarker(source, target);
  await assertRequiredStateObjects(target);

  const versionsResponse = await listObjectVersions(source);
  const versions = versionsResponse.Versions ?? [];
  const deleteMarkers = versionsResponse.DeleteMarkers ?? [];
  const objects = [
    ...versions.map((version) => ({ Key: version.Key, VersionId: version.VersionId })),
    ...deleteMarkers.map((marker) => ({ Key: marker.Key, VersionId: marker.VersionId })),
  ];

  log(`Deleting ${objects.length} source object version/delete marker record(s) from ${source}.`);
  for (let index = 0; index < objects.length; index += 1000) {
    const batch = objects.slice(index, index + 1000);
    const deletePath = await writeJsonTemp(tmp, `delete-${index}.json`, {
      Objects: batch,
      Quiet: true,
    });
    await aws(["s3api", "delete-objects", "--bucket", source, "--delete", `file://${deletePath}`]);
  }

  await aws(["s3api", "delete-bucket", "--bucket", source]);
  log(`Deleted source bucket: ${source}`);
};

const dryRun = async (options: CliOptions): Promise<void> => {
  await assertExpectedIdentity(options.account);
  const sourceExists = await bucketExists(options.source);
  const targetExists = await bucketExists(options.target);
  log(`Source bucket ${options.source}: ${sourceExists ? "exists" : "missing"}`);
  log(`Target bucket ${options.target}: ${targetExists ? "exists" : "missing"}`);

  if (sourceExists) {
    await assertNoCurrentLocks(options.source);
    const currentObjects = await listCurrentObjects(options.source, defaults.currentStatePrefix);
    const versions = await listObjectVersions(options.source);
    log(`Current .pulumi object count: ${currentObjects.length}`);
    log(`Source object versions: ${(versions.Versions ?? []).length}`);
    log(`Source delete markers: ${(versions.DeleteMarkers ?? []).length}`);
  }
};

const migrate = async (options: CliOptions, tmp: string): Promise<void> => {
  requireYesForMutation(options);
  await assertExpectedIdentity(options.account);

  if (!(await bucketExists(options.source))) {
    fail(`Source bucket does not exist: ${options.source}`);
  }

  await assertNoCurrentLocks(options.source);
  await createTargetBucket(options.target, options.region, tmp);
  await copyCurrentState(options.source, options.target);
  await archiveVersions(
    options.source,
    options.target,
    `${defaults.archiveRoot}/${new Date().toISOString().replaceAll(":", "-")}`,
    tmp
  );
  await verifyCurrentStateCopy(options.source, options.target);
  log(`Migration ready. Run: pulumi login s3://${options.target}`);
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);
  const tmp = await mkdtemp(join(tmpdir(), "oip-state-bucket-migration-"));
  await mkdir(tmp, { recursive: true });
  try {
    if (options.dryRun) {
      await dryRun(options);
    } else if (options.deleteSource) {
      requireYesForMutation(options);
      await assertExpectedIdentity(options.account);
      await deleteSourceBucket(options.source, options.target, tmp);
    } else {
      await migrate(options, tmp);
    }
  } finally {
    await rm(tmp, { force: true, recursive: true });
  }
};

await main();
