import { AgentEffectivenessEvalScorerError } from "@beep/repo-cli/commands/AgentEffectiveness/AgentEffectiveness.errors";
import { AiMetricsCommandError, AiMetricsStatusExit } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors";
import { CiCommandError } from "@beep/repo-cli/commands/Ci/Ci.errors";
import { CodexCommandError } from "@beep/repo-cli/commands/Codex/Codex.errors";
import {
  CodexFindingsIngestError,
  CodexFindingsRedactionError,
  CodexPacketWriteError,
} from "@beep/repo-cli/commands/Codex/Findings.errors";
import {
  CorpusArchiveMoveDestinationConflictError,
  CorpusArchiveMoveDigestMismatchError,
  CorpusArchiveMoveUncoveredFileError,
  CorpusCommandError,
} from "@beep/repo-cli/commands/Corpus/Corpus.errors";
import { FilesCommandError } from "@beep/repo-cli/commands/Files/Files.errors";
import {
  GoalManifestInvalidError,
  GoalPacketNotFoundError,
  GoalPlanInputError,
  GoalPlanOperationalError,
  GoalReadmeStatusLineError,
  GoalStatusInputError,
  GoalsGitError,
} from "@beep/repo-cli/commands/Goals/Goals.errors";
import { ImageCommandError } from "@beep/repo-cli/commands/Image/Image.errors";
import {
  KnowledgeCloneAttributesError,
  KnowledgeHostPathDebtError,
  KnowledgeIntroducedFindingsError,
  KnowledgeOperationalError,
  KnowledgeProbeBootError,
} from "@beep/repo-cli/commands/Knowledge/Knowledge.errors";
import {
  EffectImportRulesConfigurationError,
  EffectImportRulesPersistenceError,
  NoNativeRuntimeRulesExecutionError,
  TerseEffectRulesPersistenceError,
} from "@beep/repo-cli/commands/Laws/Laws.errors";
import { EcosystemPolarityError } from "@beep/repo-cli/commands/Lint/EcosystemPolarity";
import {
  LintCircularAnalysisError,
  LintFileDiscoveryError,
  SchemaFirstInventoryReadError,
  TestTypecheckBaselineError,
} from "@beep/repo-cli/commands/Lint/Lint.errors";
import { QaCommandError } from "@beep/repo-cli/commands/Qa/Qa.errors";
import {
  ChangesetGraphError,
  ChangesetStatusError,
  QualityScriptCommandError,
  QualityTaskConfigurationError,
  QualityTaskFailed,
  QualityTaskGroupFailed,
  UnexpectedQualityTaskFailure,
} from "@beep/repo-cli/commands/Quality/Quality.errors";
import { ResearchCommandError } from "@beep/repo-cli/commands/Research/Research.errors";
import { RunnersCommandError } from "@beep/repo-cli/commands/Runners/Runners.errors";
import { AwsResourcePending } from "@beep/repo-cli/commands/Runners/Runners.service";
import { SkillsCommandError, SkillsDriftError } from "@beep/repo-cli/commands/Skills/Skills.errors";
import { SyncDataToTsDriftError, SyncDataToTsError } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.errors";
import {
  TsconfigSyncCycleError,
  TsconfigSyncDriftError,
  TsconfigSyncFilterError,
} from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.errors";
import {
  NetworkUnavailableError,
  VersionSyncDriftError,
  VersionSyncError,
} from "@beep/repo-cli/commands/VersionSync/VersionSync.errors";
import {
  WorktreeCommandError,
  WorktreeDirtyError,
  WorktreeExistsError,
} from "@beep/repo-cli/commands/Worktree/Worktree.errors";
import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import { CliJsonError, CliReportedExit, FsGuardError, StdinDocumentError } from "@beep/repo-cli/test/Cli";
import { RegistrationGeometryError } from "@beep/repo-cli/test/DeletePackage";
import { PacketCasConflictError, PacketStreamError } from "@beep/repo-cli/test/Goals";
import { CaptureCommandTimedOutError, CapturePipeWedgedError } from "@beep/repo-cli/test/Process";
import { QualityArtifactGeneratorError, TurboConfigProofError } from "@beep/repo-cli/test/Quality";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(schema: S.Schema<A>, first: A, second: A, different: A): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("repo-cli tagged-error declared equivalence", () => {
  it("compares AiMetricsCommandError by declared fields", () => {
    const first = AiMetricsCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = AiMetricsCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = AiMetricsCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(AiMetricsCommandError, first, second, different);
  });
  it("compares AiMetricsStatusExit by declared fields", () => {
    const first = AiMetricsStatusExit.make({
      message: "same",
    });
    const second = AiMetricsStatusExit.make({
      message: "same",
    });
    const different = AiMetricsStatusExit.make({
      message: "different",
    });

    expectDeclaredEquivalence(AiMetricsStatusExit, first, second, different);
  });
  it("compares AgentEffectivenessEvalScorerError by declared fields", () => {
    const first = AgentEffectivenessEvalScorerError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = AgentEffectivenessEvalScorerError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = AgentEffectivenessEvalScorerError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(AgentEffectivenessEvalScorerError, first, second, different);
  });
  it("compares CiCommandError by declared fields", () => {
    const first = CiCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = CiCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = CiCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CiCommandError, first, second, different);
  });
  it("compares CodexCommandError by declared fields", () => {
    const first = CodexCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = CodexCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = CodexCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CodexCommandError, first, second, different);
  });
  it("compares CodexFindingsIngestError by declared fields", () => {
    const first = CodexFindingsIngestError.make({
      reason: "payload-invalid",
      message: "same",
      cause: "cause-a",
    });
    const second = CodexFindingsIngestError.make({
      reason: "payload-invalid",
      message: "same",
      cause: "cause-b",
    });
    const different = CodexFindingsIngestError.make({
      reason: "payload-invalid",
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CodexFindingsIngestError, first, second, different);
  });
  it("compares CodexFindingsRedactionError by declared fields", () => {
    const first = CodexFindingsRedactionError.make({
      message: "same",
      surfaces: ["surface"],
    });
    const second = CodexFindingsRedactionError.make({
      message: "same",
      surfaces: ["surface"],
    });
    const different = CodexFindingsRedactionError.make({
      message: "different",
      surfaces: ["surface"],
    });

    expectDeclaredEquivalence(CodexFindingsRedactionError, first, second, different);
  });
  it("compares CodexPacketWriteError by declared fields", () => {
    const first = CodexPacketWriteError.make({
      reason: "packet-exists",
      message: "same",
      cause: "cause-a",
    });
    const second = CodexPacketWriteError.make({
      reason: "packet-exists",
      message: "same",
      cause: "cause-b",
    });
    const different = CodexPacketWriteError.make({
      reason: "packet-exists",
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CodexPacketWriteError, first, second, different);
  });
  it("compares CorpusCommandError by declared fields", () => {
    const first = CorpusCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = CorpusCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = CorpusCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CorpusCommandError, first, second, different);
  });
  it("compares CorpusArchiveMoveUncoveredFileError by declared fields", () => {
    const first = CorpusArchiveMoveUncoveredFileError.make({
      message: "same",
      originPath: "same",
      sourcePath: "same",
    });
    const second = CorpusArchiveMoveUncoveredFileError.make({
      message: "same",
      originPath: "same",
      sourcePath: "same",
    });
    const different = CorpusArchiveMoveUncoveredFileError.make({
      message: "different",
      originPath: "same",
      sourcePath: "same",
    });

    expectDeclaredEquivalence(CorpusArchiveMoveUncoveredFileError, first, second, different);
  });
  it("compares CorpusArchiveMoveDigestMismatchError by declared fields", () => {
    const first = CorpusArchiveMoveDigestMismatchError.make({
      actualSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      expectedSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      message: "same",
      originPath: "same",
      rawPath: "same",
    });
    const second = CorpusArchiveMoveDigestMismatchError.make({
      actualSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      expectedSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      message: "same",
      originPath: "same",
      rawPath: "same",
    });
    const different = CorpusArchiveMoveDigestMismatchError.make({
      actualSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      expectedSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
      message: "different",
      originPath: "same",
      rawPath: "same",
    });

    expectDeclaredEquivalence(CorpusArchiveMoveDigestMismatchError, first, second, different);
  });
  it("compares CorpusArchiveMoveDestinationConflictError by declared fields", () => {
    const first = CorpusArchiveMoveDestinationConflictError.make({
      archivePath: "same",
      message: "same",
      sourcePath: "same",
    });
    const second = CorpusArchiveMoveDestinationConflictError.make({
      archivePath: "same",
      message: "same",
      sourcePath: "same",
    });
    const different = CorpusArchiveMoveDestinationConflictError.make({
      archivePath: "same",
      message: "different",
      sourcePath: "same",
    });

    expectDeclaredEquivalence(CorpusArchiveMoveDestinationConflictError, first, second, different);
  });
  it("compares FilesCommandError by declared fields", () => {
    const first = FilesCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = FilesCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = FilesCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(FilesCommandError, first, second, different);
  });
  it("compares GoalPacketNotFoundError by declared fields", () => {
    const first = GoalPacketNotFoundError.make({
      slug: "same",
      message: "same",
    });
    const second = GoalPacketNotFoundError.make({
      slug: "same",
      message: "same",
    });
    const different = GoalPacketNotFoundError.make({
      slug: "same",
      message: "different",
    });

    expectDeclaredEquivalence(GoalPacketNotFoundError, first, second, different);
  });
  it("compares GoalManifestInvalidError by declared fields", () => {
    const first = GoalManifestInvalidError.make({
      slug: "same",
      message: "same",
    });
    const second = GoalManifestInvalidError.make({
      slug: "same",
      message: "same",
    });
    const different = GoalManifestInvalidError.make({
      slug: "same",
      message: "different",
    });

    expectDeclaredEquivalence(GoalManifestInvalidError, first, second, different);
  });
  it("compares GoalReadmeStatusLineError by declared fields", () => {
    const first = GoalReadmeStatusLineError.make({
      slug: "same",
      message: "same",
    });
    const second = GoalReadmeStatusLineError.make({
      slug: "same",
      message: "same",
    });
    const different = GoalReadmeStatusLineError.make({
      slug: "same",
      message: "different",
    });

    expectDeclaredEquivalence(GoalReadmeStatusLineError, first, second, different);
  });
  it("compares GoalsGitError by declared fields", () => {
    const first = GoalsGitError.make({
      message: "same",
    });
    const second = GoalsGitError.make({
      message: "same",
    });
    const different = GoalsGitError.make({
      message: "different",
    });

    expectDeclaredEquivalence(GoalsGitError, first, second, different);
  });
  it("compares GoalStatusInputError by declared fields", () => {
    const first = GoalStatusInputError.make({
      message: "same",
    });
    const second = GoalStatusInputError.make({
      message: "same",
    });
    const different = GoalStatusInputError.make({
      message: "different",
    });

    expectDeclaredEquivalence(GoalStatusInputError, first, second, different);
  });
  it("compares GoalPlanInputError by declared fields", () => {
    const first = GoalPlanInputError.make({
      message: "same",
    });
    const second = GoalPlanInputError.make({
      message: "same",
    });
    const different = GoalPlanInputError.make({
      message: "different",
    });

    expectDeclaredEquivalence(GoalPlanInputError, first, second, different);
  });
  it("compares GoalPlanOperationalError by declared fields", () => {
    const first = GoalPlanOperationalError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = GoalPlanOperationalError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = GoalPlanOperationalError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(GoalPlanOperationalError, first, second, different);
  });
  it("compares PacketStreamError by declared fields", () => {
    const first = PacketStreamError.make({
      packet: "same",
      message: "same",
    });
    const second = PacketStreamError.make({
      packet: "same",
      message: "same",
    });
    const different = PacketStreamError.make({
      packet: "same",
      message: "different",
    });

    expectDeclaredEquivalence(PacketStreamError, first, second, different);
  });
  it("compares PacketCasConflictError by declared fields", () => {
    const first = PacketCasConflictError.make({
      packet: "same",
      expectedRevision: 1,
      actualRevision: 1,
      message: "same",
    });
    const second = PacketCasConflictError.make({
      packet: "same",
      expectedRevision: 1,
      actualRevision: 1,
      message: "same",
    });
    const different = PacketCasConflictError.make({
      packet: "same",
      expectedRevision: 1,
      actualRevision: 1,
      message: "different",
    });

    expectDeclaredEquivalence(PacketCasConflictError, first, second, different);
  });
  it("compares ImageCommandError by declared fields", () => {
    const first = ImageCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = ImageCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = ImageCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(ImageCommandError, first, second, different);
  });
  it("compares KnowledgeOperationalError by declared fields", () => {
    const first = KnowledgeOperationalError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = KnowledgeOperationalError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = KnowledgeOperationalError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(KnowledgeOperationalError, first, second, different);
  });
  it("compares KnowledgeProbeBootError by declared fields", () => {
    const first = KnowledgeProbeBootError.make({
      message: "same",
    });
    const second = KnowledgeProbeBootError.make({
      message: "same",
    });
    const different = KnowledgeProbeBootError.make({
      message: "different",
    });

    expectDeclaredEquivalence(KnowledgeProbeBootError, first, second, different);
  });
  it("compares KnowledgeIntroducedFindingsError by declared fields", () => {
    const first = KnowledgeIntroducedFindingsError.make({
      message: "same",
      introducedCount: NonNegativeInt.make(1),
    });
    const second = KnowledgeIntroducedFindingsError.make({
      message: "same",
      introducedCount: NonNegativeInt.make(1),
    });
    const different = KnowledgeIntroducedFindingsError.make({
      message: "different",
      introducedCount: NonNegativeInt.make(1),
    });

    expectDeclaredEquivalence(KnowledgeIntroducedFindingsError, first, second, different);
  });
  it("compares KnowledgeHostPathDebtError by declared fields", () => {
    const first = KnowledgeHostPathDebtError.make({
      message: "same",
      liveDebtCount: NonNegativeInt.make(1),
    });
    const second = KnowledgeHostPathDebtError.make({
      message: "same",
      liveDebtCount: NonNegativeInt.make(1),
    });
    const different = KnowledgeHostPathDebtError.make({
      message: "different",
      liveDebtCount: NonNegativeInt.make(1),
    });

    expectDeclaredEquivalence(KnowledgeHostPathDebtError, first, second, different);
  });
  it("compares KnowledgeCloneAttributesError by declared fields", () => {
    const first = KnowledgeCloneAttributesError.make({
      message: "same",
      attributesPath: "same",
    });
    const second = KnowledgeCloneAttributesError.make({
      message: "same",
      attributesPath: "same",
    });
    const different = KnowledgeCloneAttributesError.make({
      message: "different",
      attributesPath: "same",
    });

    expectDeclaredEquivalence(KnowledgeCloneAttributesError, first, second, different);
  });
  it("compares EffectImportRulesPersistenceError by declared fields", () => {
    const first = EffectImportRulesPersistenceError.make({
      message: "same",
    });
    const second = EffectImportRulesPersistenceError.make({
      message: "same",
    });
    const different = EffectImportRulesPersistenceError.make({
      message: "different",
    });

    expectDeclaredEquivalence(EffectImportRulesPersistenceError, first, second, different);
  });
  it("compares EffectImportRulesConfigurationError by declared fields", () => {
    const first = EffectImportRulesConfigurationError.make({
      message: "same",
    });
    const second = EffectImportRulesConfigurationError.make({
      message: "same",
    });
    const different = EffectImportRulesConfigurationError.make({
      message: "different",
    });

    expectDeclaredEquivalence(EffectImportRulesConfigurationError, first, second, different);
  });
  it("compares NoNativeRuntimeRulesExecutionError by declared fields", () => {
    const first = NoNativeRuntimeRulesExecutionError.make({
      message: "same",
    });
    const second = NoNativeRuntimeRulesExecutionError.make({
      message: "same",
    });
    const different = NoNativeRuntimeRulesExecutionError.make({
      message: "different",
    });

    expectDeclaredEquivalence(NoNativeRuntimeRulesExecutionError, first, second, different);
  });
  it("compares TerseEffectRulesPersistenceError by declared fields", () => {
    const first = TerseEffectRulesPersistenceError.make({
      message: "same",
    });
    const second = TerseEffectRulesPersistenceError.make({
      message: "same",
    });
    const different = TerseEffectRulesPersistenceError.make({
      message: "different",
    });

    expectDeclaredEquivalence(TerseEffectRulesPersistenceError, first, second, different);
  });
  it("compares EcosystemPolarityError by declared fields", () => {
    const first = EcosystemPolarityError.make({
      message: "same",
    });
    const second = EcosystemPolarityError.make({
      message: "same",
    });
    const different = EcosystemPolarityError.make({
      message: "different",
    });

    expectDeclaredEquivalence(EcosystemPolarityError, first, second, different);
  });
  it("compares LintCircularAnalysisError by declared fields", () => {
    const first = LintCircularAnalysisError.make({
      message: "same",
    });
    const second = LintCircularAnalysisError.make({
      message: "same",
    });
    const different = LintCircularAnalysisError.make({
      message: "different",
    });

    expectDeclaredEquivalence(LintCircularAnalysisError, first, second, different);
  });
  it("compares LintFileDiscoveryError by declared fields", () => {
    const first = LintFileDiscoveryError.make({
      message: "same",
      root: "same",
      path: "same",
    });
    const second = LintFileDiscoveryError.make({
      message: "same",
      root: "same",
      path: "same",
    });
    const different = LintFileDiscoveryError.make({
      message: "different",
      root: "same",
      path: "same",
    });

    expectDeclaredEquivalence(LintFileDiscoveryError, first, second, different);
  });
  it("compares TestTypecheckBaselineError by declared fields", () => {
    const first = TestTypecheckBaselineError.make({
      message: "same",
    });
    const second = TestTypecheckBaselineError.make({
      message: "same",
    });
    const different = TestTypecheckBaselineError.make({
      message: "different",
    });

    expectDeclaredEquivalence(TestTypecheckBaselineError, first, second, different);
  });
  it("compares SchemaFirstInventoryReadError by declared fields", () => {
    const first = SchemaFirstInventoryReadError.make({
      message: "same",
    });
    const second = SchemaFirstInventoryReadError.make({
      message: "same",
    });
    const different = SchemaFirstInventoryReadError.make({
      message: "different",
    });

    expectDeclaredEquivalence(SchemaFirstInventoryReadError, first, second, different);
  });
  it("compares QaCommandError by declared fields", () => {
    const first = QaCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = QaCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = QaCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(QaCommandError, first, second, different);
  });
  it("compares ChangesetGraphError by declared fields", () => {
    const first = ChangesetGraphError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = ChangesetGraphError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = ChangesetGraphError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(ChangesetGraphError, first, second, different);
  });
  it("compares ChangesetStatusError by declared fields", () => {
    const first = ChangesetStatusError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = ChangesetStatusError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = ChangesetStatusError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(ChangesetStatusError, first, second, different);
  });
  it("compares QualityScriptCommandError by declared fields", () => {
    const first = QualityScriptCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = QualityScriptCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = QualityScriptCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(QualityScriptCommandError, first, second, different);
  });
  it("compares QualityTaskFailed by declared fields", () => {
    const first = QualityTaskFailed.make({
      label: "same",
      command: "same",
      exitCode: 1,
    });
    const second = QualityTaskFailed.make({
      label: "same",
      command: "same",
      exitCode: 1,
    });
    const different = QualityTaskFailed.make({
      label: "different",
      command: "same",
      exitCode: 1,
    });

    expectDeclaredEquivalence(QualityTaskFailed, first, second, different);
  });
  it("compares QualityTaskGroupFailed by declared fields", () => {
    const first = QualityTaskGroupFailed.make({
      label: "same",
      exitCode: 1,
      failures: [QualityTaskFailed.make({ label: "lint", command: "bun lint", exitCode: 1 })],
    });
    const second = QualityTaskGroupFailed.make({
      label: "same",
      exitCode: 1,
      failures: [QualityTaskFailed.make({ label: "lint", command: "bun lint", exitCode: 1 })],
    });
    const different = QualityTaskGroupFailed.make({
      label: "different",
      exitCode: 1,
      failures: [QualityTaskFailed.make({ label: "lint", command: "bun lint", exitCode: 1 })],
    });

    expectDeclaredEquivalence(QualityTaskGroupFailed, first, second, different);
  });
  it("compares QualityTaskConfigurationError by declared fields", () => {
    const first = QualityTaskConfigurationError.make({
      message: "same",
    });
    const second = QualityTaskConfigurationError.make({
      message: "same",
    });
    const different = QualityTaskConfigurationError.make({
      message: "different",
    });

    expectDeclaredEquivalence(QualityTaskConfigurationError, first, second, different);
  });
  it("compares UnexpectedQualityTaskFailure by declared fields", () => {
    const first = UnexpectedQualityTaskFailure.make({
      message: "same",
    });
    const second = UnexpectedQualityTaskFailure.make({
      message: "same",
    });
    const different = UnexpectedQualityTaskFailure.make({
      message: "different",
    });

    expectDeclaredEquivalence(UnexpectedQualityTaskFailure, first, second, different);
  });
  it("compares QualityArtifactGeneratorError by declared fields", () => {
    const first = QualityArtifactGeneratorError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = QualityArtifactGeneratorError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = QualityArtifactGeneratorError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(QualityArtifactGeneratorError, first, second, different);
  });
  it("compares TurboConfigProofError by declared fields", () => {
    const first = TurboConfigProofError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = TurboConfigProofError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = TurboConfigProofError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(TurboConfigProofError, first, second, different);
  });
  it("compares ResearchCommandError by declared fields", () => {
    const first = ResearchCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = ResearchCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = ResearchCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(ResearchCommandError, first, second, different);
  });
  it("compares RunnersCommandError by declared fields", () => {
    const first = RunnersCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = RunnersCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = RunnersCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(RunnersCommandError, first, second, different);
  });
  it("compares AwsResourcePending by declared fields", () => {
    const first = AwsResourcePending.make({
      actual: "same",
      expected: "same",
      resource: "same",
    });
    const second = AwsResourcePending.make({
      actual: "same",
      expected: "same",
      resource: "same",
    });
    const different = AwsResourcePending.make({
      actual: "different",
      expected: "same",
      resource: "same",
    });

    expectDeclaredEquivalence(AwsResourcePending, first, second, different);
  });
  it("compares SkillsCommandError by declared fields", () => {
    const first = SkillsCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = SkillsCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = SkillsCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(SkillsCommandError, first, second, different);
  });
  it("compares SkillsDriftError by declared fields", () => {
    const first = SkillsDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const second = SkillsDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const different = SkillsDriftError.make({
      message: "different",
      driftCount: 1,
    });

    expectDeclaredEquivalence(SkillsDriftError, first, second, different);
  });
  it("compares SyncDataToTsError by declared fields", () => {
    const first = SyncDataToTsError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = SyncDataToTsError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = SyncDataToTsError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(SyncDataToTsError, first, second, different);
  });
  it("compares SyncDataToTsDriftError by declared fields", () => {
    const first = SyncDataToTsDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const second = SyncDataToTsDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const different = SyncDataToTsDriftError.make({
      message: "different",
      driftCount: 1,
    });

    expectDeclaredEquivalence(SyncDataToTsDriftError, first, second, different);
  });
  it("compares TsconfigSyncDriftError by declared fields", () => {
    const first = TsconfigSyncDriftError.make({
      fileCount: 1,
      summary: "same",
    });
    const second = TsconfigSyncDriftError.make({
      fileCount: 1,
      summary: "same",
    });
    const different = TsconfigSyncDriftError.make({
      fileCount: 2,
      summary: "same",
    });

    expectDeclaredEquivalence(TsconfigSyncDriftError, first, second, different);
  });
  it("compares TsconfigSyncCycleError by declared fields", () => {
    const first = TsconfigSyncCycleError.make({
      cycles: [["cycle"]],
      message: "same",
    });
    const second = TsconfigSyncCycleError.make({
      cycles: [["cycle"]],
      message: "same",
    });
    const different = TsconfigSyncCycleError.make({
      cycles: [["cycle"]],
      message: "different",
    });

    expectDeclaredEquivalence(TsconfigSyncCycleError, first, second, different);
  });
  it("compares TsconfigSyncFilterError by declared fields", () => {
    const first = TsconfigSyncFilterError.make({
      filter: "same",
      message: "same",
    });
    const second = TsconfigSyncFilterError.make({
      filter: "same",
      message: "same",
    });
    const different = TsconfigSyncFilterError.make({
      filter: "same",
      message: "different",
    });

    expectDeclaredEquivalence(TsconfigSyncFilterError, first, second, different);
  });
  it("compares VersionSyncError by declared fields", () => {
    const first = VersionSyncError.make({
      message: "same",
      file: "same",
      cause: "cause-a",
    });
    const second = VersionSyncError.make({
      message: "same",
      file: "same",
      cause: "cause-b",
    });
    const different = VersionSyncError.make({
      message: "different",
      file: "same",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(VersionSyncError, first, second, different);
  });
  it("compares NetworkUnavailableError by declared fields", () => {
    const first = NetworkUnavailableError.make({
      message: "same",
    });
    const second = NetworkUnavailableError.make({
      message: "same",
    });
    const different = NetworkUnavailableError.make({
      message: "different",
    });

    expectDeclaredEquivalence(NetworkUnavailableError, first, second, different);
  });
  it("compares VersionSyncDriftError by declared fields", () => {
    const first = VersionSyncDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const second = VersionSyncDriftError.make({
      message: "same",
      driftCount: 1,
    });
    const different = VersionSyncDriftError.make({
      message: "different",
      driftCount: 1,
    });

    expectDeclaredEquivalence(VersionSyncDriftError, first, second, different);
  });
  it("compares WorktreeCommandError by declared fields", () => {
    const first = WorktreeCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = WorktreeCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = WorktreeCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(WorktreeCommandError, first, second, different);
  });
  it("compares WorktreeDirtyError by declared fields", () => {
    const first = WorktreeDirtyError.make({
      message: "same",
      path: "same",
      changeCount: 1,
    });
    const second = WorktreeDirtyError.make({
      message: "same",
      path: "same",
      changeCount: 1,
    });
    const different = WorktreeDirtyError.make({
      message: "different",
      path: "same",
      changeCount: 1,
    });

    expectDeclaredEquivalence(WorktreeDirtyError, first, second, different);
  });
  it("compares WorktreeExistsError by declared fields", () => {
    const first = WorktreeExistsError.make({
      message: "same",
      path: "same",
    });
    const second = WorktreeExistsError.make({
      message: "same",
      path: "same",
    });
    const different = WorktreeExistsError.make({
      message: "different",
      path: "same",
    });

    expectDeclaredEquivalence(WorktreeExistsError, first, second, different);
  });
  it("compares YeetCommandError by declared fields", () => {
    const first = YeetCommandError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = YeetCommandError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = YeetCommandError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(YeetCommandError, first, second, different);
  });
  it("compares CliReportedExit by declared fields", () => {
    const first = CliReportedExit.make({
      message: "same",
      exitCode: 1,
    });
    const second = CliReportedExit.make({
      message: "same",
      exitCode: 1,
    });
    const different = CliReportedExit.make({
      message: "different",
      exitCode: 1,
    });

    expectDeclaredEquivalence(CliReportedExit, first, second, different);
  });
  it("compares FsGuardError by declared fields", () => {
    const first = FsGuardError.make({
      cause: O.some("cause-a"),
      message: "same",
      path: "same",
      reason: "symlink",
      root: "same",
      target: "same",
    });
    const second = FsGuardError.make({
      cause: O.some("cause-b"),
      message: "same",
      path: "same",
      reason: "symlink",
      root: "same",
      target: "same",
    });
    const different = FsGuardError.make({
      cause: O.some("cause-a"),
      message: "different",
      path: "same",
      reason: "symlink",
      root: "same",
      target: "same",
    });

    expectDeclaredEquivalence(FsGuardError, first, second, different);
  });
  it("compares CliJsonError by declared fields", () => {
    const first = CliJsonError.make({
      message: "same",
      cause: "cause-a",
    });
    const second = CliJsonError.make({
      message: "same",
      cause: "cause-b",
    });
    const different = CliJsonError.make({
      message: "different",
      cause: "cause-a",
    });

    expectDeclaredEquivalence(CliJsonError, first, second, different);
  });
  it("compares RegistrationGeometryError by declared fields", () => {
    const first = RegistrationGeometryError.make({
      message: "same",
      cause: O.some("cause-a"),
    });
    const second = RegistrationGeometryError.make({
      message: "same",
      cause: O.some("cause-b"),
    });
    const different = RegistrationGeometryError.make({
      message: "different",
      cause: O.some("cause-a"),
    });

    expectDeclaredEquivalence(RegistrationGeometryError, first, second, different);
  });
  it("compares StdinDocumentError by declared fields", () => {
    const first = StdinDocumentError.make({
      message: "same",
    });
    const second = StdinDocumentError.make({
      message: "same",
    });
    const different = StdinDocumentError.make({
      message: "different",
    });

    expectDeclaredEquivalence(StdinDocumentError, first, second, different);
  });
  it("compares CapturePipeWedgedError by declared fields", () => {
    const first = CapturePipeWedgedError.make({
      commandLine: "same",
      message: "same",
    });
    const second = CapturePipeWedgedError.make({
      commandLine: "same",
      message: "same",
    });
    const different = CapturePipeWedgedError.make({
      commandLine: "same",
      message: "different",
    });

    expectDeclaredEquivalence(CapturePipeWedgedError, first, second, different);
  });
  it("compares CaptureCommandTimedOutError by declared fields", () => {
    const first = CaptureCommandTimedOutError.make({
      commandLine: "same",
      message: "same",
    });
    const second = CaptureCommandTimedOutError.make({
      commandLine: "same",
      message: "same",
    });
    const different = CaptureCommandTimedOutError.make({
      commandLine: "same",
      message: "different",
    });

    expectDeclaredEquivalence(CaptureCommandTimedOutError, first, second, different);
  });
});
