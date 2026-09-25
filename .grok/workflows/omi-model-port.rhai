let meta = #{
    name: "omi-model-port",
    description: "Port OMI pydantic models into scratchpad/beep Effect schemas",
    phases: [
        #{ title: "Kits", detail: "shared field factories" },
        #{ title: "Port", detail: "disjoint model batches" },
        #{ title: "Index", detail: "barrel and package export" },
        #{ title: "Fix", detail: "scratchpad/beep proof only" },
    ],
};

let rules = "You are porting OMI pydantic models into the beep-effect repo.\n";
rules += "Read these files before writing code, and follow them:\n";
rules += "- /tmp/omi-port-explore/decisions.md (wins on conflict)\n";
rules += "- /tmp/omi-port-explore/effect-patterns.md\n";
rules += "- .patterns/jsdoc-documentation.md (repo-relative)\n";
rules += "Python source root: $HOME/YeeBois/workstation-apps/omi/backend/models\n";
rules += "Effect API checkout: $HOME/YeeBois/dev/effect (version 4.0.0-rc.117). Do not use v3 APIs.\n";
rules += "Write only under scratchpad/beep/ and scratchpad/test/beep/. Do not edit any other path.\n";
rules += "Do not git commit, push, or run yeet. Another agent owns files outside scratchpad.\n";
rules += "Do not use ProductEntity or productEntityFactory. Use Model from @beep/effect-drizzle.\n";
rules += "File name: snake_case.py becomes PascalCase.ts. chat_first_e2e.py becomes ChatFirstE2e.ts. Skip __init__.py.\n";
rules += "Fields: snake_case to camelCase. SQL column names stay snake_case via pg.columnName.\n";
rules += "Import namespace subpaths only: effect/Schema, effect/Option, effect/Effect, effect/Tuple, effect/Arbitrary.\n";
rules += "Never import from the effect package root. Never use Set, Map, as, any, or as const on a LiteralKit array.\n";
rules += "Identity: import { $ScratchpadId } from @beep/identity, then $ScratchpadId.create with beep/FileName.\n";
rules += "Class form: class Name extends Model<Name>(Name)(fields, $I.annote, extras). Declare namespace Encoded from S.Codec.Encoded.\n";
rules += "Optional Python fields that can be missing or null: S.OptionFromOptionalNullOr(inner, { onNoneEncoding: null }) then SchemaUtils.withNoneDefault then the pg combinator.\n";
rules += "Required fields with a non-null default: withConstructorDefault, not Option.\n";
rules += "Checks: use Schema checks that set arbitraryConstraint (isBetween, isMinLength, isMaxLength, isPattern, isInt). No lookahead in patterns.\n";
rules += "Also emit Table.check with a lowercase SQL name when the Python Field has ge, le, gt, lt, min_length, max_length, or pattern.\n";
rules += "Uniform string unions are LiteralKit fields. Shape-splitting unions use LiteralKit.mapMembers(Tuple.evolve([thunks in literal order])).pipe(S.toTaggedUnion(field)).\n";
rules += "Port every method in the same file. Field checks live on the schema. Pure helpers are functions. Effectful logic uses Effect.fn and takes data as arguments. No Context.Service and no driver clients.\n";
rules += "JSDoc: titled Example, Details, and Gotchas sections. No @example and no @remarks. Include @since 0.0.0. Carry the Python docstring into Details.\n";
rules += "Reuse factories from scratchpad/beep/Kit.ts. Do not edit Kit.ts. Inline a field only when no factory fits.\n";
rules += "Tests go in scratchpad/test/beep/<Pascal>.test.ts and import the model by relative path. Cover present values, null and missing Option fields, each tagged-union member, and each method branch.\n";
rules += "Call Arbitrary.schema on each exported model inside the test and assert it returns. That is the toArbitrary bar. Do not call S.toArbitrary.\n";
rules += "Read each assigned Python file completely before writing its TypeScript.\n";
rules += "Also read any matching inventory in /tmp/omi-port-explore/py-*.md. Overlapping discriminants stay LiteralKit fields unless one field actually partitions the other fields.\n";
rules += "If the serialized key differs from the camelCase field, decoded name stays camelCase and the encoded key is set with Schema.encodeKeys. Read that helper in the Effect checkout before using it.\n";

phase("Kits");
let kit_prompt = rules;
kit_prompt += "\nTHIS AGENT ONLY builds shared factories.\n";
kit_prompt += "Read packages/ecosystem/effect-drizzle/src/pg/model.ts around the Model factory, packages/ecosystem/effect-drizzle/src/pg/combinators.ts, and packages/ecosystem/effect-drizzle/src/pg/extras.ts Table.check.\n";
kit_prompt += "Scan every .py file under the Python source root for repeated fields (ids, timestamps, user ids, confidence, optional text).\n";
kit_prompt += "Write scratchpad/beep/Kit.ts exporting those field factories and re-exporting Model, pg combinators, and Table.check.\n";
kit_prompt += "Do not port individual models. Do not invent beep entity id, entityType, or publicId columns.\n";
let kit = agent(kit_prompt, #{ label: "kits", capability_mode: "all" });
if kit == () || kit.success != true {
    complete(#{ ok: false, stage: "kits" });
}

phase("Port");
let batches = [];
batches.push("account_cutover.py action_item.py advice.py announcement.py app.py audio_file.py auto_model.py calendar_context.py calendar_mutation.py candidate.py");
batches.push("chat_first_e2e.py chat_first.py chat.py chat_session.py client_processing.py conversation_enums.py conversation_metadata.py conversation_photo.py conversation.py daily_summary_payload.py");
batches.push("daily_summary.py daily_sweep_dispatch.py dev_api_key.py fair_use.py feedback.py focus_session.py folder.py frame_request.py geolocation.py goal.py");
batches.push("import_job.py integrations.py jit_proactivity.py jit_trigger_feedback.py knowledge_ledger_policy.py knowledge_ledger_search.py mcp_api_key.py memories.py memory_admin.py memory_admission.py");
batches.push("memory_apply.py memory_contracts.py memory_domain.py memory_evidence.py memory_imports.py memory_operations.py memory_product.py memory_promotion.py");
batches.push("memory_recurrence.py memory_review.py memory_search_gateway.py memory_source_replacement.py memory_state_head.py message_event.py notification_message.py other.py proactive_budget.py product_memory.py");
batches.push("score.py screen_activity.py screen_frame.py shared.py staged_task.py structured_extraction.py structured.py sync_audio.py sync_contract.py task_intelligence.py");
batches.push("task.py task_recommendation.py transcript_segment.py trend.py tts.py users.py user_usage.py workstream_association.py workstream.py");

let jobs = [];
let batch_index = 0;
for files in batches {
    batch_index += 1;
    let prompt = rules;
    prompt += "\nPort only these modules. Read Kit.ts and use it. Do not edit Kit.ts, index.ts, or package.json.\n";
    prompt += files;
    prompt += "\n";
    jobs.push(#{
        prompt: prompt,
        label: "port-" + batch_index.to_string(),
        capability_mode: "all",
    });
}
let ported = parallel(jobs);
let port_failures = 0;
for result in ported {
    if result == () || result.success != true {
        port_failures += 1;
    }
}
log("port failures: " + port_failures.to_string());

phase("Index");
let index_prompt = "Read scratchpad/beep and scratchpad/package.json.\n";
index_prompt += "Write scratchpad/beep/index.ts that exports every model file. Add the package.json export ./beep pointing at ./beep/index.ts. Change nothing else in package.json.\n";
index_prompt += "If scratchpad/docgen.json paths omit @beep/scratchpad/beep, add that path the same way sibling scratchpad exports are mapped.\n";
index_prompt += "Do not edit model files except to fix a broken export name. Do not run yeet. Do not touch files outside scratchpad/beep, scratchpad/package.json, and scratchpad/docgen.json.\n";
let indexed = agent(index_prompt, #{ label: "index", capability_mode: "all" });
if indexed == () || indexed.success != true {
    complete(#{ ok: false, stage: "index", port_failures: port_failures });
}

phase("Fix");
let fix_prompt = "Make scratchpad/beep and scratchpad/test/beep typecheck and pass tests.\n";
fix_prompt += "Repo: the current checkout (run from its root). bun and tsgo are on PATH only inside zsh -ic.\n";
fix_prompt += "Run tsgo -p scratchpad/tsconfig.json --noEmit. Fix only errors under scratchpad/beep and scratchpad/test/beep.\n";
fix_prompt += "Run vitest on scratchpad/test/beep with --config scratchpad/vitest.config.ts from the repo root. The reporter must show a non-zero test count. If the config include skips the directory, pass the test files explicitly. Do not edit scratchpad/vitest.config.ts.\n";
fix_prompt += "Run bun run beep laws native-runtime --check --include scratchpad/beep/**/*.ts and fix those findings.\n";
fix_prompt += "Do not edit anything outside scratchpad/beep, scratchpad/test/beep, scratchpad/package.json, or scratchpad/docgen.json.\n";
fix_prompt += "Do not run yeet. Do not commit. Another agent owns the rest of the branch, including dirty Yeet files.\n";
fix_prompt += "Re-run the three commands until scratchpad/beep is clean or you are blocked by an error outside that tree. Report the final commands and results.\n";
let fixed = agent(fix_prompt, #{ label: "fix", capability_mode: "all" });
if fixed == () || fixed.success != true {
    complete(#{ ok: false, stage: "fix", port_failures: port_failures });
}
complete(#{ ok: true, port_failures: port_failures });
