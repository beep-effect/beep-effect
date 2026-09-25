/**
 * OMI Python-model port: every model module plus the shared field kit.
 *
 * **Details**
 *
 * `Kit.ts` is re-exported flat because models compose its factories directly.
 * Each ported module is re-exported as a namespace named after its file
 * (`MemoryApply`, `Workstream`, ...) because the Python modules define the
 * same class names more than once (`MemoryTier`, `EvidenceRef`, `TaskStatus`),
 * and a flat star barrel would make those exports ambiguous.
 *
 * **Example** (Reach a model through its module namespace)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Goal } from "@beep/scratchpad/beep"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(Goal.GoalStatus)("paused"))) // "paused"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export * from "./Kit.ts";
export * as AccountCutover from "./AccountCutover.ts";
export * as ActionItem from "./ActionItem.ts";
export * as Advice from "./Advice.ts";
export * as Announcement from "./Announcement.ts";
export * as App from "./App.ts";
export * as AudioFile from "./AudioFile.ts";
export * as AutoModel from "./AutoModel.ts";
export * as CalendarContext from "./CalendarContext.ts";
export * as CalendarMutation from "./CalendarMutation.ts";
export * as Candidate from "./Candidate.ts";
export * as ChatFirstE2e from "./ChatFirstE2e.ts";
export * as ChatFirst from "./ChatFirst.ts";
export * as ChatSession from "./ChatSession.ts";
export * as Chat from "./Chat.ts";
export * as ClientProcessing from "./ClientProcessing.ts";
export * as ConversationEnums from "./ConversationEnums.ts";
export * as ConversationMetadata from "./ConversationMetadata.ts";
export * as ConversationPhoto from "./ConversationPhoto.ts";
export * as Conversation from "./Conversation.ts";
export * as DailySummaryPayload from "./DailySummaryPayload.ts";
export * as DailySummary from "./DailySummary.ts";
export * as DailySweepDispatch from "./DailySweepDispatch.ts";
export * as DevApiKey from "./DevApiKey.ts";
export * as FairUse from "./FairUse.ts";
export * as Feedback from "./Feedback.ts";
export * as FocusSession from "./FocusSession.ts";
export * as Folder from "./Folder.ts";
export * as FrameRequest from "./FrameRequest.ts";
export * as Geolocation from "./Geolocation.ts";
export * as Goal from "./Goal.ts";
export * as ImportJob from "./ImportJob.ts";
export * as Integrations from "./Integrations.ts";
export * as JitProactivity from "./JitProactivity.ts";
export * as JitTriggerFeedback from "./JitTriggerFeedback.ts";
export * as KnowledgeLedgerPolicy from "./KnowledgeLedgerPolicy.ts";
export * as KnowledgeLedgerSearch from "./KnowledgeLedgerSearch.ts";
export * as McpApiKey from "./McpApiKey.ts";
export * as Memories from "./Memories.ts";
export * as MemoryAdmin from "./MemoryAdmin.ts";
export * as MemoryAdmission from "./MemoryAdmission.ts";
export * as MemoryApply from "./MemoryApply.ts";
export * as MemoryContracts from "./MemoryContracts.ts";
export * as MemoryDomain from "./MemoryDomain.ts";
export * as MemoryEvidence from "./MemoryEvidence.ts";
export * as MemoryImports from "./MemoryImports.ts";
export * as MemoryOperations from "./MemoryOperations.ts";
export * as MemoryProduct from "./MemoryProduct.ts";
export * as MemoryPromotion from "./MemoryPromotion.ts";
export * as MemoryRecurrence from "./MemoryRecurrence.ts";
export * as MemoryReview from "./MemoryReview.ts";
export * as MemorySearchGateway from "./MemorySearchGateway.ts";
export * as MemorySourceReplacement from "./MemorySourceReplacement.ts";
export * as MemoryStateHead from "./MemoryStateHead.ts";
export * as MessageEvent from "./MessageEvent.ts";
export * as NotificationMessage from "./NotificationMessage.ts";
export * as Other from "./Other.ts";
export * as Port from "./Port.ts";
export * as ProactiveBudget from "./ProactiveBudget.ts";
export * as ProductMemory from "./ProductMemory.ts";
export * as PythonFloat from "./PythonFloat.ts";
export * as Score from "./Score.ts";
export * as ScreenActivity from "./ScreenActivity.ts";
export * as ScreenFrame from "./ScreenFrame.ts";
export * as Shared from "./Shared.ts";
export * as StagedTask from "./StagedTask.ts";
export * as StructuredExtraction from "./StructuredExtraction.ts";
export * as Structured from "./Structured.ts";
export * as SyncAudio from "./SyncAudio.ts";
export * as SyncContract from "./SyncContract.ts";
export * as TaskIntelligence from "./TaskIntelligence.ts";
export * as TaskRecommendation from "./TaskRecommendation.ts";
export * as Task from "./Task.ts";
export * as TranscriptSegment from "./TranscriptSegment.ts";
export * as Trend from "./Trend.ts";
export * as Tts from "./Tts.ts";
export * as Users from "./Users.ts";
export * as UserUsage from "./UserUsage.ts";
export * as WorkstreamAssociation from "./WorkstreamAssociation.ts";
export * as Workstream from "./Workstream.ts";
