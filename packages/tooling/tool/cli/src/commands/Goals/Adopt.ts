/**
 * Read-only packet snapshot, pure adoption compiler, and `beep goals adopt --plan`.
 *
 * **Details**
 *
 * Adoption is split in two by a value boundary: an effectful
 * `readPacketSnapshot` whose entire `FileSystem` surface is read members, and
 * a pure `compileAdoptionPlan` over the resulting `PacketSnapshot` value with
 * requirements `never`. The first adoption target is the hand-rolled
 * knowledge-surface-automation packet itself — the self-hosting pilot whose
 * expected plan contains zero authored-file creations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import {
  GoalSlug,
  MODELED_GOAL_MANIFEST_KEYS,
  PacketSnapshot,
  PacketSnapshotFile,
  PhaseArchetype,
  PlanMode,
} from "./Bootstrap.schemas.ts";
import { archetypePhases, reportMaterializationPlan, sealMaterializationPlan } from "./Bootstrap.ts";
import { GoalPlanInputError, GoalPlanOperationalError } from "./Goals.errors.ts";
import { isGoalStatus } from "./Goals.schemas.ts";
import {
  GOALS_DIR,
  isJsonRecord,
  parseGoalManifestText,
  readmeLifecycleToken,
  readmeMissionLine,
  readmeTitle,
  TEMPLATE_SLUG,
} from "./Inventory.ts";
import { canonicalJsonText, sha256Hex, sha256HexBytes } from "./PacketCore/PacketDigest.ts";
import type { MaterializationPlan, ValidationRequirement } from "./Bootstrap.schemas.ts";
import type { ConflictRow, PlanRow, PreservationRow } from "./Bootstrap.ts";
import type { GoalStatus } from "./Goals.schemas.ts";

const MANIFEST_RELATIVE_PATH = "ops/manifest.json";
const README_RELATIVE_PATH = "README.md";
const REFLECTION_TEMPLATE_BASENAME = "_TEMPLATE.md";

const isGitkeepPath = (relativePath: string): boolean => Str.endsWith(".gitkeep")(relativePath);

const walkDirectory = Effect.fn("Goals.walkPacketDirectory")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let files = A.empty<PacketSnapshotFile>();
  let pending: ReadonlyArray<string> = [""];
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const relative = A.headNonEmpty(pending);
    pending = A.tailNonEmpty(pending);
    const absolute = relative === "" ? root : path.join(root, relative);
    const entries = yield* fs
      .readDirectory(absolute)
      .pipe(Effect.mapError(GoalPlanOperationalError.new(`Failed to read directory "${absolute}".`)));
    for (const entry of A.sort(entries, Order.String)) {
      const entryRelative = relative === "" ? entry : `${relative}/${entry}`;
      const entryAbsolute = path.join(root, entryRelative);
      const info = yield* fs
        .stat(entryAbsolute)
        .pipe(Effect.mapError(GoalPlanOperationalError.new(`Failed to stat "${entryAbsolute}".`)));
      if (info.type === "Directory") {
        pending = A.append(pending, entryRelative);
      } else if (info.type === "File") {
        // Digest the raw bytes: decoding first is lossy for non-UTF-8 content
        // (binary evidence under history/), which would break hash-pinning.
        const bytes = yield* fs
          .readFile(entryAbsolute)
          .pipe(Effect.mapError(GoalPlanOperationalError.new(`Failed to read "${entryAbsolute}".`)));
        files = A.append(
          files,
          PacketSnapshotFile.make({
            path: entryRelative,
            text: new TextDecoder().decode(bytes),
            digest: sha256HexBytes(bytes),
          })
        );
      }
    }
  }
  return A.sort(
    files,
    Order.mapInput(Order.String, (file: PacketSnapshotFile) => file.path)
  );
});

const directoryExists = Effect.fn("Goals.packetDirectoryExists")(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(target).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none));
  return O.exists(info, (value) => value.type === "Directory");
});

/**
 * Captures one packet and the `goals/_template` standard as a decoded value.
 *
 * **Details**
 *
 * The entire `FileSystem` surface used here is `readDirectory`, `stat`, and
 * `readFileString` — there is no writer to disable. A missing packet is not an
 * error: the snapshot records `exists: false` and the pure compiler emits a
 * `packet-not-found` conflict, keeping environment facts inside the plan. A
 * missing or unreadable template tree is an operational failure: adoption
 * cannot measure against a standard it cannot read.
 *
 * **Example** (Build the snapshot effect)
 *
 * ```ts
 * import { readPacketSnapshot } from "@beep/repo-cli/commands/Goals/Adopt"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readPacketSnapshot("knowledge-surface-automation"))) // true
 * ```
 *
 * @param slug - The packet slug under `goals/` to capture.
 * @param repoRoot - Repository root the `goals/` tree is resolved against.
 * @returns The decoded snapshot the pure adoption compiler consumes.
 * @category use-cases
 * @since 0.0.0
 */
export const readPacketSnapshot = Effect.fn("Goals.readPacketSnapshot")(function* (slug: string, repoRoot = ".") {
  const path = yield* Path.Path;
  const packetPath = path.join(repoRoot, GOALS_DIR, slug);
  const templatePath = path.join(repoRoot, GOALS_DIR, TEMPLATE_SLUG);
  const templateFiles = yield* walkDirectory(templatePath);
  const templateSnapshotHash = sha256Hex(
    canonicalJsonText(A.map(templateFiles, (file) => ({ path: file.path, digest: file.digest })))
  );
  const exists = yield* directoryExists(packetPath);
  const files = exists ? yield* walkDirectory(packetPath) : A.empty<PacketSnapshotFile>();
  return PacketSnapshot.make({
    slug,
    packetPath: `${GOALS_DIR}/${slug}`,
    exists,
    files,
    templateFiles,
    templateSnapshotHash,
  });
});

const seededManifestPayload = (input: {
  readonly slug: string;
  readonly title: string;
  readonly status: GoalStatus;
  readonly mission: O.Option<string>;
  readonly archetype: PhaseArchetype;
}): string => {
  const packetPath = `goals/${input.slug}`;
  const document = {
    schemaVersion: "initiative-manifest/v2",
    initiative: {
      id: input.slug,
      title: input.title,
      status: input.status,
      packetAnchorDocument: "SPEC.md",
    },
    packetPath,
    lifecycle: input.status,
    ...optionalProp("mission", input.mission),
    completionGate: {
      operator: "yeet",
      requiresPullRequest: true,
      requiresMergeable: true,
      statement:
        "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (bun run beep yeet: repair -> verify -> publish --pr -> monitor).",
      grandfathered: false,
    },
    phases: A.map(archetypePhases(input.archetype), (phase) => ({
      id: phase.id,
      name: phase.name,
      status: "pending",
    })),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
};

const inferArchetype = (files: ReadonlyArray<PacketSnapshotFile>): PhaseArchetype => {
  const manifest = A.findFirst(files, (file) => file.path === MANIFEST_RELATIVE_PATH);
  const phaseNames = pipe(
    manifest,
    O.flatMap((file) => parseGoalManifestText(file.text)),
    O.filter(isJsonRecord),
    O.flatMap((record) => R.get(record, "phases")),
    O.map((phases) => {
      const entries = A.isArray(phases) ? phases : isJsonRecord(phases) ? R.values(phases) : A.empty<unknown>();
      return A.getSomes(
        A.map(entries, (entry) =>
          isJsonRecord(entry) ? pipe(R.get(entry, "name"), O.filter(P.isString)) : O.none<string>()
        )
      );
    }),
    O.getOrElse(A.empty<string>)
  );
  return A.some(phaseNames, (name) => Str.includes("report")(Str.toLowerCase(name)))
    ? PhaseArchetype.Enum["report-first"]
    : PhaseArchetype.Enum["standard-delivery"];
};

const ADOPT_BASE_VALIDATIONS: ReadonlyArray<ValidationRequirement> = [
  "manifest-decodes",
  "doctor-clean",
  "index-regenerates",
  "readme-lifecycle-line",
  "goal-md-within-budget",
];

const isReflectionArtifact = (relativePath: string): boolean =>
  Str.startsWith("history/reflections/")(relativePath) &&
  Str.endsWith(".md")(relativePath) &&
  !Str.endsWith(REFLECTION_TEMPLATE_BASENAME)(relativePath);

/**
 * Compiles an adoption plan from a decoded packet snapshot.
 *
 * **Details**
 *
 * A pure function of the snapshot value: requirements `never`, no clock, no
 * filesystem. Every present packet file is retained (`preserved` for the
 * manifest, whose unmodeled top-level keys are enumerated with a pre-image
 * digest); a standard artifact the packet lacks becomes a `report` entry a
 * human resolves; only machine-derivable artifacts (directory markers, and a
 * seeded manifest for a manifest-less packet) are planned as `create`.
 * Diagnosis never mutates, and it never invents prose.
 *
 * **Example** (Compile against an empty snapshot)
 *
 * ```ts
 * import { compileAdoptionPlan } from "@beep/repo-cli/commands/Goals/Adopt"
 * import { PacketSnapshot } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import * as O from "effect/Option"
 *
 * const plan = compileAdoptionPlan(
 *   PacketSnapshot.make({
 *     slug: "missing-goal",
 *     packetPath: "goals/missing-goal",
 *     exists: false,
 *     files: [],
 *     templateFiles: [],
 *     templateSnapshotHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   }),
 *   O.none()
 * )
 * console.log(plan.conflicts[0]?.reason) // "packet-not-found"
 * ```
 *
 * @param snapshot - The read-only packet and template capture.
 * @param toward - Optional explicit archetype; defaults to inference from the packet's phase shape.
 * @returns The sealed adoption plan.
 * @category use-cases
 * @since 0.0.0
 */
export const compileAdoptionPlan: {
  (snapshot: PacketSnapshot, toward: O.Option<PhaseArchetype>): MaterializationPlan;
  (toward: O.Option<PhaseArchetype>): (snapshot: PacketSnapshot) => MaterializationPlan;
} = dual(2, (snapshot: PacketSnapshot, toward: O.Option<PhaseArchetype>): MaterializationPlan => {
  const archetype = O.getOrElse(toward, () => inferArchetype(snapshot.files));
  const base = {
    mode: PlanMode.Enum.adopt,
    slug: snapshot.slug,
    packetPath: snapshot.packetPath,
    towardArchetype: archetype,
    templateSnapshotHash: snapshot.templateSnapshotHash,
  };

  if (!snapshot.exists) {
    return sealMaterializationPlan({
      ...base,
      entries: [],
      preservations: [],
      validations: [],
      conflicts: [
        {
          reason: "packet-not-found",
          message: `No goal packet directory "${snapshot.packetPath}".`,
        },
      ],
    });
  }

  const manifestFile = A.findFirst(snapshot.files, (file) => file.path === MANIFEST_RELATIVE_PATH);
  const parsedManifest = O.flatMap(manifestFile, (file) => parseGoalManifestText(file.text));
  if (O.isSome(manifestFile) && O.isNone(parsedManifest)) {
    return sealMaterializationPlan({
      ...base,
      entries: [],
      preservations: [],
      validations: [],
      conflicts: [
        {
          reason: "manifest-unparseable",
          message: `"${snapshot.packetPath}/${MANIFEST_RELATIVE_PATH}" does not parse as JSON; adoption cannot classify it.`,
        },
      ],
    });
  }

  let entries = A.empty<PlanRow>();
  let preservations = A.empty<PreservationRow>();
  const conflicts = A.empty<ConflictRow>();

  for (const file of snapshot.files) {
    const fullPath = `${snapshot.packetPath}/${file.path}`;
    if (file.path === MANIFEST_RELATIVE_PATH) {
      const unmodeledKeys = pipe(
        parsedManifest,
        O.filter(isJsonRecord),
        O.map((record) => A.sort(A.difference(R.keys(record), MODELED_GOAL_MANIFEST_KEYS), Str.Order)),
        O.getOrElse(A.empty<string>)
      );
      entries = A.append(entries, {
        path: fullPath,
        action: "preserve",
        ownership: "preserved",
        reason: "Manifest bytes survive only through byte-preserving JSONC edits; re-encoding strips unmodeled keys.",
        existingDigest: file.digest,
      });
      preservations = A.append(preservations, {
        path: fullPath,
        unmodeledKeys,
        preImageDigest: file.digest,
        reason: "The canonical decoder strips these top-level keys from decoded output.",
      });
    } else if (isGitkeepPath(file.path)) {
      entries = A.append(entries, {
        path: fullPath,
        action: "retain",
        ownership: "generated",
        reason: "Machine-derivable directory marker already present.",
        existingDigest: file.digest,
      });
    } else {
      entries = A.append(entries, {
        path: fullPath,
        action: "retain",
        ownership: "authored",
        reason: "Tracked packet file conforms to the standard and stays human-owned.",
        existingDigest: file.digest,
      });
    }
  }

  const packetPaths = A.map(snapshot.files, (file) => file.path);
  for (const templateFile of snapshot.templateFiles) {
    if (A.contains(packetPaths, templateFile.path)) {
      continue;
    }
    const fullPath = `${snapshot.packetPath}/${templateFile.path}`;
    if (templateFile.path === MANIFEST_RELATIVE_PATH) {
      const readme = A.findFirst(snapshot.files, (file) => file.path === README_RELATIVE_PATH);
      const readmeText = O.map(readme, (file) => file.text);
      const status = pipe(
        readmeText,
        O.flatMap(readmeLifecycleToken),
        O.filter(isGoalStatus),
        O.getOrElse((): GoalStatus => "active")
      );
      const payload = seededManifestPayload({
        slug: snapshot.slug,
        title: pipe(
          readmeText,
          O.flatMap(readmeTitle),
          O.getOrElse(() => snapshot.slug)
        ),
        status,
        mission: O.flatMap(readmeText, readmeMissionLine),
        archetype,
      });
      entries = A.append(entries, {
        path: fullPath,
        action: "create",
        ownership: "generated",
        reason: "Manifest-less packet: seed a manifest from README-extractable fields.",
        payload,
        payloadDigest: sha256Hex(payload),
      });
    } else if (isGitkeepPath(templateFile.path)) {
      entries = A.append(entries, {
        path: fullPath,
        action: "create",
        ownership: "generated",
        reason: "Machine-derivable directory marker the standard ships.",
        payload: templateFile.text,
        payloadDigest: templateFile.digest,
      });
    } else {
      entries = A.append(entries, {
        path: fullPath,
        action: "report",
        ownership: "authored",
        reason: "Standard artifact absent; a human authors it — diagnosis never invents prose.",
      });
    }
  }

  const validations: ReadonlyArray<ValidationRequirement> = A.some(snapshot.files, (file) =>
    isReflectionArtifact(file.path)
  )
    ? A.append(ADOPT_BASE_VALIDATIONS, "reflection-frontmatter-valid")
    : ADOPT_BASE_VALIDATIONS;

  return sealMaterializationPlan({
    ...base,
    entries,
    preservations,
    validations,
    conflicts,
  });
});

const slugArgument = Argument.string("slug").pipe(Argument.withDescription("Goal packet slug under goals/"));
const towardFlag = Flag.choice("toward", PhaseArchetype.Options).pipe(
  Flag.optional,
  Flag.withDescription("Archetype to measure against; defaults to inference from the packet's phase shape")
);
const planFlag = Flag.boolean("plan").pipe(
  Flag.withDescription("Compile and print the adoption plan (the only mode this slice ships)")
);
const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Print the plan as canonical JSON"));

const runAdoptPlan = Effect.fn("Goals.runAdoptPlan")(function* (options: {
  readonly slug: string;
  readonly toward: O.Option<PhaseArchetype>;
  readonly plan: boolean;
  readonly json: boolean;
}) {
  if (!options.plan) {
    return yield* GoalPlanInputError.new(
      "Phase 0 ships plan-only commands; pass --plan (no writer exists to omit it for)."
    );
  }
  const slug = yield* S.decodeEffect(GoalSlug)(options.slug).pipe(
    Effect.mapError((issue) => GoalPlanInputError.new(`slug "${options.slug}" is invalid: ${issue.message}`))
  );
  const snapshot = yield* readPacketSnapshot(slug);
  const plan = compileAdoptionPlan(snapshot, options.toward);
  yield* reportMaterializationPlan(plan, options.json);
});

/**
 * `bun run beep goals adopt` — compile and print a packet adoption plan.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsAdoptCommand } from "@beep/repo-cli/commands/Goals/Adopt"
 *
 * console.log(goalsAdoptCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsAdoptCommand = Command.make(
  "adopt",
  { slug: slugArgument, toward: towardFlag, plan: planFlag, json: jsonFlag },
  Effect.fn(function* (options) {
    return yield* runAdoptPlan(options).pipe(
      Effect.catchTags({
        GoalPlanInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:adopt] ${error.message}`);
          return yield* failWithReportedExit(`goals adopt: ${error.message}`);
        }),
        GoalPlanOperationalError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:adopt] ${error.message}`);
          return yield* failWithReportedExit(`goals adopt: ${error.message}`);
        }),
      })
    );
  })
).pipe(Command.withDescription("Compile the read-only packet adoption plan (--plan --json); no writer exists"));
