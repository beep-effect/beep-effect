/**
 * Beep's Completion API provides access to Harvey’s models via our orchestration engine, allowing users to ask complex,
 * freeform questions and receive detailed legal-grade responses programmatically. It can also be used in conjunction
 * with files attached to the request, Vaults, and Regional Knowledge Sources.
 *
 * @remarks
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {SchemaUtils} from "@beep/schema";

const $I = $ScratchpadId.create("brainstorming/ai/Completions.models");

export class CompletionsPayload extends S.Class<CompletionsPayload>($I`CompletionsPayload`)({
	query: S.Struct({
		includeCitations: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true), $I.annoteKey("CompletionsPayload.includeCitations", {
			description: "Whether to include citations in the response output. When set to false, citations are skipped and" +
				" the response is returned more quickly. Defaults to true.",
			default: true,
		})),
	}),
	prompt: S.String.pipe(
		S.check(S.isMaxLength(20000)),
		$I.annoteKey("CompletionsPayload.prompt", {
			description: "A string question that you want to ask Harvey.\n" + "The prompt may be up to 20,000 characters.",
			examples: [
				"In 3 sentences, can you explain how indemnity and limitation of liability clauses typically work in commercial contracts?"
			]
		})
	),
	stream: S.Boolean.pipe(
		SchemaUtils.withKeyDefaults(false),
		$I.annoteKey("CompletionsPayload.stream", {
			description: "A boolean value that lets you either stream or receive the entire output at once.",
			default: false,
		})
	),
	files: S.File.pipe(S.Array,
		SchemaUtils.withEmptyArrayDefaults,
		$I.annoteKey("CompletionsPayload.files", {
		description: 'Files you want to upload to provide additional context for the prompt. Cannot be used together' +
			' with `knowledgeSources`.'
	})),
	mode: S.Literals([
		"draft",
		"assist"
	]).pipe(
		SchemaUtils.withKeyDefaults("draft"),
		$I.annoteKey("CompletionsPayload.mode", {
			description: "The mode to use for the completion. `draft` mode is for drafting and editing, while `assist` mode" +
				" is for assisting with writing tasks.",
			default: "draft"
		})
	),
	clientMatterId: S.String.pipe(
		S.check(S.isUUID(5)),
		$I.annoteKey("CompletionsPayload.clientMatterId", {
			description: "The UUID of the client matter associated with the completion.",
			examples: [
				"12345678-1234-5678-1234-567812345678"
			]
		})
	),
	knowledgeSources: S.Struct({
		type: S.Literals(["vault", "web"]),
		folderId: S.String.pipe(
			S.check(S.isUUID(5)),
		),
		fileIds: S.String.pipe(
			S.check(S.isUUID(5)),
			S.Array,
			SchemaUtils.withEmptyArrayDefaults
		)
	}).pipe(
		S.Array,
		S.fromJsonString,
		$I.annoteKey("CompletionsPayload.knowledgeSources", {
			description: "JSON-encoded array of knowledge sources such as Vaults or Regional Knowledge Sources.\n" + "\n" + "Cannot be used together with `files`.\n" + "\n" + "All objects must include a `type` field. Additional fields depend on the `type`.\n" + "\n" + "Vault example with file_ids:\n" + "[{\"type\":\"vault\",\"folder_id\":\"12345678-1234-5678-1234-567812345678\",\"file_ids\":[\"87654321-8765-4321-8765-432187654321\"]}]\n" + "\n" + "Vault example without file_ids (queries entire folder):\n" + "[{\"type\":\"vault\",\"folder_id\":\"12345678-1234-5678-1234-567812345678\"}]\n" + "\n" + "Web example:\n" + "[{\"type\":\"web\"}]\n Example `\"[{\"type\":\"web\"}]\"`",
			examples: [
				'[{"type": "vault", "folderId": "12345678-1234-5678-1234-567812345678"}, {"type": "web"}]'
			]
		})
	),
	model: S.Literals(
		[
			"gpt-5",
			"gpt-5-1",
			"gpt-5-2",
			"gpt-5-4",
			"gpt-5-4-mini",
			"gpt-5-5",
			"gpt-4-1",
			"claude-opus-4-5",
			"claude-sonnet-4-5",
			"claude-opus-4-6",
			"claude-opus-4-7",
		]
	).pipe(
		$I.annoteKey("CompletionsPayload.model", {
			description: "The model to use for completion.",
			examples: ["gpt-5"]
		})
	),
}, $I.annote("CompletionsPayload", {
	description: "Payload for the Completion API",
})) {}

export class CompletionsSuccess extends S.Class<CompletionsSuccess>($I`CompletionsSuccess`)(
	{
		response: S.String.pipe(
			$I.annoteKey("CompletionsSuccess.response", {
				description: "Indemnity clauses in commercial contracts require one party to compensate the other for certain losses or damages arising from specified events, such as breaches or third-party claims. Limitation of liability clauses cap the amount or types of damages one party can recover from the other, often excluding indirect or consequential losses. Together, these clauses allocate and manage risk between the parties, providing predictability and protecting against potentially catastrophic financial exposure.",
				examples: ["The quick brown fox jumped over the lazy dog."]
			})
		),
		responseWithCitations: S.String.pipe(S.OptionFromNullOr, $I.annoteKey("CompletionsSuccess.responseWithCitations", {
			description: "The completion with inline citations, e.g. `[1][2]`, which correspond to the sources below. Only returned when `include_citations=true`",
			examples: ["Indemnity clauses in commercial contracts require one party to compensate the other for certain losses or damages arising from specified events, such as breaches or third-party claims.[1] Limitation of liability clauses cap the amount or types of damages one party can recover from the other, often excluding indirect or consequential losses.[2]"]
		})),
		sources: S.Struct({
			citationNum: S.Int,
			documentName: S.String,
			page: S.Int.pipe(
				S.OptionFromNullOr,
			),
			text: S.String.pipe(
				$I.annoteKey("CompletionsSuccess.sources.text", {
					description: "The page number of the source document",
					examples: ["<mark>Quoted snippet...</mark>"]
				})
			)
		})
	},
	$I.annote("CompletionsSuccess", {
		description: "The response object includes the response field which is the completion of the input prompt sent to the model.",
	})
) {}