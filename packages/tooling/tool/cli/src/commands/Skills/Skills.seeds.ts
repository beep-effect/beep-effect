/**
 * Ratified provenance resolutions for the vendored-skill warehouse's first wave.
 *
 * **Details**
 *
 * One-time seed table transcribed from
 * `goals/knowledge-surface-automation/research/p1-skill-upstream-resolution.md`
 * (ratified as B1/B2 in `research/p2-grill-decisions.md`). Each seed is the
 * upstream identity, pinned license digest, and epistemic provenance claim
 * for one installed skill. Lock migration copies these blocks into
 * `skills-lock/v2`; after that the lock is the record and this table only
 * seeds skills not yet migrated.
 *
 * `oracle` is deliberately `inferred`/`medium`: no upstream commit matches
 * its installed text byte for byte, so its pin is the newest upstream path
 * revision before the local import (B1).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SkillProvenanceResolution } from "./Skills.schemas.ts";
import type * as O from "effect/Option";

const MATT_POCOCK_SKILLS_HEAD = "2ab958093e83e0ec752e6c1c5932da465bf23e0c";
const MATT_POCOCK_LICENSE = {
  spdxId: "MIT",
  path: "LICENSE",
  sha256: "0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5",
};

const seedInputs: ReadonlyArray<unknown> = [
  {
    name: "grill-me",
    sourceType: "github",
    upstream: {
      repository: "mattpocock/skills",
      repositoryUrl: "https://github.com/mattpocock/skills",
      treePath: "skills/productivity/grill-me",
      entryPath: "skills/productivity/grill-me/SKILL.md",
      trackingRef: "main",
      sourceRevision: MATT_POCOCK_SKILLS_HEAD,
      observedHeadRevision: MATT_POCOCK_SKILLS_HEAD,
      observedPathRevision: "cbf6db4233c7e4202abaf79643f7ab395c75a2df",
    },
    license: MATT_POCOCK_LICENSE,
    provenanceStatus: "exact",
    provenanceConfidence: "high",
    provenanceEvidence: ["exact-tree", "path-history"],
  },
  {
    name: "oracle",
    sourceType: "github",
    upstream: {
      repository: "steipete/oracle",
      repositoryUrl: "https://github.com/steipete/oracle",
      treePath: "skills/oracle",
      entryPath: "skills/oracle/SKILL.md",
      trackingRef: "main",
      sourceRevision: "d6e773a562dc85c2a81b7c571f40ca2d81896679",
      observedHeadRevision: "68b8c51b0ee04f03a4d2cfea932a40df71393591",
      observedPathRevision: "a61381734c61e63315c8070707ce0834f39cd168",
    },
    license: {
      spdxId: "MIT",
      path: "LICENSE",
      sha256: "14293556b79940745123d0160c71d27ed0e9fe9b8a848093f3ed78f4853caafe",
    },
    provenanceStatus: "inferred",
    provenanceConfidence: "medium",
    provenanceEvidence: ["package-owner", "path-history"],
  },
  {
    name: "portless",
    sourceType: "github",
    upstream: {
      repository: "vercel-labs/portless",
      repositoryUrl: "https://github.com/vercel-labs/portless",
      treePath: "skills/portless",
      entryPath: "skills/portless/SKILL.md",
      trackingRef: "main",
      sourceRevision: "84c5012b2fa5066c7585034fa1176a633bdde5ee",
      observedHeadRevision: "d42c741ac67d20a0b6e1f8f5b4192136de34fa03",
      observedPathRevision: "15ef06434c81523b1b24db2d52a17caf31edecf1",
    },
    license: {
      spdxId: "Apache-2.0",
      path: "LICENSE",
      sha256: "014bb31e83d5c2e76aea1cc6e82217346ab41362f32cb355ad0f5c10aa0aeaff",
    },
    provenanceStatus: "exact",
    provenanceConfidence: "high",
    provenanceEvidence: ["historical-import", "path-history"],
  },
  {
    name: "shadcn",
    sourceType: "github",
    upstream: {
      repository: "shadcn-ui/ui",
      repositoryUrl: "https://github.com/shadcn-ui/ui",
      treePath: "skills/shadcn",
      entryPath: "skills/shadcn/SKILL.md",
      trackingRef: "main",
      sourceRevision: "91f21dfe1328585670275781b4525fff2507f917",
      observedHeadRevision: "cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4",
      observedPathRevision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
    },
    license: {
      spdxId: "MIT",
      path: "LICENSE.md",
      sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
    },
    provenanceStatus: "exact",
    provenanceConfidence: "high",
    provenanceEvidence: ["exact-tree", "path-history"],
  },
  {
    name: "teach",
    sourceType: "github",
    upstream: {
      repository: "mattpocock/skills",
      repositoryUrl: "https://github.com/mattpocock/skills",
      treePath: "skills/productivity/teach",
      entryPath: "skills/productivity/teach/SKILL.md",
      trackingRef: "main",
      sourceRevision: MATT_POCOCK_SKILLS_HEAD,
      observedHeadRevision: MATT_POCOCK_SKILLS_HEAD,
      observedPathRevision: "aa024cb1954fedbc8221967c080fa40b9867f994",
    },
    license: MATT_POCOCK_LICENSE,
    provenanceStatus: "exact",
    provenanceConfidence: "high",
    provenanceEvidence: ["exact-tree", "path-history"],
  },
  {
    name: "turborepo",
    sourceType: "github",
    upstream: {
      repository: "vercel/turborepo",
      repositoryUrl: "https://github.com/vercel/turborepo",
      treePath: "skills/turborepo",
      entryPath: "skills/turborepo/SKILL.md",
      trackingRef: "main",
      sourceRevision: "6ef1582ec49b6b1cf8d3de3ff0a1c7b53eb71d61",
      observedHeadRevision: "c6fbc97bb8841f9c87d106af2d89ce11e97ea56c",
      observedPathRevision: "adbfec74ea17f718b44d24cdf0094eb8141ce9b4",
    },
    license: {
      spdxId: "MIT",
      path: "LICENSE",
      sha256: "f7ac4712aa30551de5b97b30215010515d783638107f207bcce32a85bfffc05e",
    },
    provenanceStatus: "exact",
    provenanceConfidence: "high",
    provenanceEvidence: ["historical-import", "path-history"],
  },
];

/**
 * Decodes the ratified first-wave resolution table.
 *
 * **Details**
 *
 * The table is static source; a decode failure is a transcription error and
 * surfaces as a `SchemaError` from every caller and every test run.
 *
 * **Example** (Build the seed decode effect)
 *
 * ```ts
 * import { skillResolutionSeeds } from "@beep/repo-cli/commands/Skills/Skills.seeds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(skillResolutionSeeds)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const skillResolutionSeeds: Effect.Effect<
  ReadonlyArray<SkillProvenanceResolution>,
  S.SchemaError
> = S.decodeUnknownEffect(S.Array(SkillProvenanceResolution))(seedInputs);

/**
 * Looks up the ratified resolution seed for one installed skill.
 *
 * **Example** (Look up the shadcn pilot seed)
 *
 * ```ts
 * import { findSkillResolutionSeed } from "@beep/repo-cli/commands/Skills/Skills.seeds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(findSkillResolutionSeed("shadcn"))) // true
 * ```
 *
 * @param skill - Installed skill name.
 * @returns The ratified resolution, or none when the skill was never resolved.
 * @category queries
 * @since 0.0.0
 */
export const findSkillResolutionSeed = (
  skill: string
): Effect.Effect<O.Option<SkillProvenanceResolution>, S.SchemaError> =>
  Effect.map(
    skillResolutionSeeds,
    A.findFirst((seed) => seed.name === skill)
  );
