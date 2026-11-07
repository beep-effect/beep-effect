/**
 * Render the orchestrator's `HANDOFF.md` from the files the role lives in:
 * the session ledger (who holds the role), the register (what is
 * coordinated), the rulings store (what is in force), a gate table snapshot,
 * and the `STATE.md` journal.
 *
 * **Details**
 *
 * The document keeps the section order of the orchestrate skill's
 * `HANDOFF.template.md`. Sections backed by data are regenerated at every
 * write: the holder line, "Rulings in force" (when the rulings store has any
 * ruling in force), "Gate snapshot" (when a snapshot is given), "Register"
 * and "Journal pointer" (when `STATE.md` has a line). Every other section is
 * prose the orchestrator writes at the moment of the event (promises, pending
 * decisions, next actions, recipes, routes, the broadcast text) and is carried
 * over verbatim from the existing file, so a re-render never loses what only a
 * person typed. A section the existing file lacks is written as the template's
 * placeholder; a section the template does not know is kept, after the
 * broadcast.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PrRepository } from "../Yeet/internal/Provenance.ts";
import { RegisterRow, renderRegisterMarkdown } from "./Register.schemas.ts";
import { RulingRow, renderRulingsMarkdown, rulingsInForce } from "./Rulings.schemas.ts";
import { SessionLedgerRow } from "./Session.schemas.ts";

const $I = $RepoCliId.create("commands/Session/Handoff");

/**
 * The sections of `HANDOFF.md`, in document order.
 *
 * **Example** (List the sections)
 *
 * ```ts
 * import { HandoffSectionKey } from "@beep/repo-cli/test/Session"
 *
 * console.log(HandoffSectionKey.literals[0]) // "rulings"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HandoffSectionKey = LiteralKit([
  "rulings",
  "gate-snapshot",
  "promises",
  "decisions",
  "operator-hands",
  "next-actions",
  "recipes",
  "register",
  "routes",
  "broadcast",
  "journal",
]).pipe($I.annoteSchema("HandoffSectionKey", { description: "One section of the orchestrator HANDOFF.md." }));

/**
 * One section of the orchestrator `HANDOFF.md`.
 *
 * @category models
 * @since 0.0.0
 */
export type HandoffSectionKey = typeof HandoffSectionKey.Type;

interface SectionSpec {
  readonly key: HandoffSectionKey;
  readonly placeholder: string;
  readonly title: string;
}

// Titles and placeholders follow `.claude/skills/orchestrate/HANDOFF.template.md`.
// A heading matches a section when it starts with the title, case ignored, so
// "Pending operator decisions (money only)" is still the decisions section.
const SECTIONS: ReadonlyArray<SectionSpec> = [
  {
    key: "rulings",
    title: "Rulings in force",
    placeholder: "Dated, verbatim operator wording, newest first. Record each with `bun run beep session ruling add`.",
  },
  {
    key: "gate-snapshot",
    title: "Gate snapshot",
    placeholder: "Pass `--gate-snapshot <file>` with `bun run beep yeet gate-table` output to render it here.",
  },
  {
    key: "promises",
    title: 'Outstanding "final" promises',
    placeholder:
      'A row per PR whose owner said "final <sha>". Cleared when merged or withdrawn.\n\n| PR | final sha | ready at | gate job / waiter | order constraint | owner thread link |\n| --- | --- | --- | --- | --- | --- |',
  },
  {
    key: "decisions",
    title: "Pending operator decisions",
    placeholder:
      "Money only. Everything else was decided and is in the owning packet's decisions.\n\n| Asked | Question | Asked by | Fleet desk doc | Status |\n| --- | --- | --- | --- | --- |",
  },
  {
    key: "operator-hands",
    title: "Operator-hands items",
    placeholder: "Non-money steps only the operator can perform.\n\n| Item | Where | Unblocks |\n| --- | --- | --- |",
  },
  {
    key: "next-actions",
    title: "Next actions (ordered)",
    placeholder: "1. <the single most important thing; usually a merge or a routed hold>",
  },
  {
    key: "recipes",
    title: "Recipes",
    placeholder:
      "Exact commands a successor needs to re-arm what dies with this session: merge-gate arming, monitors, T3 scheduled tasks, worker launches. Paths and ids here are private; never commit.",
  },
  {
    key: "register",
    title: "Register",
    placeholder: "",
  },
  {
    key: "routes",
    title: "Communication routes",
    placeholder:
      "T3 Code is the only cross-session route.\n\n| Unit thread link | environmentId | Provider / model / effort | Last clientRequestId → runId | Unread reply / ambiguity hold | Orphan plan |\n| --- | --- | --- | --- | --- | --- |",
  },
  {
    key: "broadcast",
    title: "Broadcast",
    placeholder:
      '> orchestrator: the role moved to <successor title> (<successor thread link>) at <instant>. Report blockers, "final <sha>", and review-thread fixes there.',
  },
  {
    key: "journal",
    title: "Journal pointer",
    placeholder: "`STATE.md` last line at write time: none read.",
  },
];

/**
 * One `## ` section of a Markdown document: its heading text and its body.
 *
 * **Example** (Make a section)
 *
 * ```ts
 * import { HandoffSection } from "@beep/repo-cli/test/Session"
 *
 * console.log(HandoffSection.make({ title: "Recipes", body: "```bash\ntrue\n```" }).title) // "Recipes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HandoffSection extends S.Opaque<HandoffSection, { readonly brand: unique symbol }>()(
  S.Struct({ title: S.String, body: S.String }).pipe(
    $I.annoteSchema("HandoffSection", { description: "One level-two section of HANDOFF.md." })
  )
) {}

/**
 * A `HANDOFF.md` split at its level-two headings.
 *
 * **Example** (An empty document)
 *
 * ```ts
 * import { HandoffDocument } from "@beep/repo-cli/test/Session"
 *
 * console.log(HandoffDocument.make({ preamble: [], sections: [] }).sections.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HandoffDocument extends S.Opaque<HandoffDocument, { readonly brand: unique symbol }>()(
  S.Struct({ preamble: S.Array(S.String), sections: S.Array(HandoffSection) }).pipe(
    $I.annoteSchema("HandoffDocument", {
      description: "HANDOFF.md as its preamble lines and its level-two sections in order.",
    })
  )
) {}

interface ParseState {
  readonly inFence: boolean;
  readonly preamble: ReadonlyArray<string>;
  readonly sections: ReadonlyArray<{ readonly title: string; readonly lines: ReadonlyArray<string> }>;
}

const isFence = (line: string): boolean => Str.startsWith("```")(Str.trimStart(line));

const trimBlankLines = (lines: ReadonlyArray<string>): string =>
  A.join(
    A.dropWhile(A.reverse(A.dropWhile(A.reverse(lines), (line) => Str.isEmpty(Str.trim(line)))), (line) =>
      Str.isEmpty(Str.trim(line))
    ),
    "\n"
  );

const appendLine = (state: ParseState, line: string): ParseState =>
  O.match(A.last(state.sections), {
    onNone: () => ({ ...state, preamble: A.append(state.preamble, line) }),
    onSome: (last) => ({
      ...state,
      sections: A.append(A.dropRight(state.sections, 1), { title: last.title, lines: A.append(last.lines, line) }),
    }),
  });

/**
 * Split a Markdown document at its `## ` headings, ignoring headings inside
 * fenced code blocks.
 *
 * **Example** (Split a document)
 *
 * ```ts
 * import { parseHandoffDocument } from "@beep/repo-cli/test/Session"
 *
 * const doc = parseHandoffDocument("# Title\n\n## Recipes\n\n```bash\n## not a heading\n```\n")
 * console.log(doc.sections.length) // 1
 * console.log(doc.sections[0]?.title) // "Recipes"
 * ```
 *
 * @param text - The whole `HANDOFF.md` (or any Markdown) to split.
 * @returns The preamble lines and the sections in order.
 * @category parsing
 * @since 0.0.0
 */
export const parseHandoffDocument = (text: string): HandoffDocument => {
  const state = A.reduce(
    Str.split(text, "\n"),
    { preamble: A.empty<string>(), sections: [], inFence: false } as ParseState,
    (current, line) =>
      !current.inFence && Str.startsWith("## ")(line)
        ? { ...current, sections: A.append(current.sections, { title: Str.trim(Str.slice(3)(line)), lines: [] }) }
        : { ...appendLine(current, line), inFence: isFence(line) ? !current.inFence : current.inFence }
  );
  return HandoffDocument.make({
    preamble: state.preamble,
    sections: A.map(state.sections, (section) =>
      HandoffSection.make({ title: section.title, body: trimBlankLines(section.lines) })
    ),
  });
};

const sectionKeyOf = (title: string): O.Option<HandoffSectionKey> =>
  O.map(
    A.findFirst(SECTIONS, (spec) => Str.startsWith(Str.toLowerCase(spec.title))(Str.toLowerCase(title))),
    (spec) => spec.key
  );

/**
 * Everything one `HANDOFF.md` is rendered from.
 *
 * **Example** (Describe a first render)
 *
 * ```ts
 * import { HandoffRenderInput, PrRepository } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = HandoffRenderInput.make({
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   writtenAt: DateTime.makeUnsafe(0),
 *   holder: O.none(),
 *   rulings: [],
 *   register: [],
 *   gateSnapshot: O.none(),
 *   journalLine: O.none(),
 *   existing: O.none(),
 * })
 * console.log(O.isNone(input.existing)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HandoffRenderInput extends S.Opaque<HandoffRenderInput, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: PrRepository,
    writtenAt: S.DateTimeUtcFromString,
    holder: S.Option(SessionLedgerRow),
    rulings: S.Array(RulingRow),
    register: S.Array(RegisterRow),
    gateSnapshot: S.Option(S.String),
    journalLine: S.Option(S.String),
    existing: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("HandoffRenderInput", {
      description: "The ledger holder, rulings, register, gate snapshot, journal line and prior HANDOFF.md.",
    })
  )
) {}

const keptAsWritten = (): O.Option<string> => O.none();

const RENDERED_MARK = "Rendered from `";

const CARRY_HEADING =
  "**Carried over** from the hand-written section; record each item in its store, then delete it here:";

// What a generated section must not drop: a hand-written body that never came
// from a store (the first render over a hand-kept file), or the carried block
// an earlier render kept. A template placeholder is not worth carrying.
const carriedOver = (prior: O.Option<HandoffSection>, placeholder: string): O.Option<string> =>
  O.flatMap(prior, ({ body }) =>
    Str.startsWith(RENDERED_MARK)(body)
      ? O.flatMap(Str.indexOf(CARRY_HEADING)(body), (at) =>
          O.liftPredicate(Str.trim(Str.slice(at + Str.length(CARRY_HEADING))(body)), Str.isNonEmpty)
        )
      : O.liftPredicate(body, (text) => Str.isNonEmpty(Str.trim(text)) && text !== placeholder)
  );

const withCarry = (body: string, carry: O.Option<string>): string =>
  O.match(carry, { onNone: () => body, onSome: (text) => `${body}\n\n${CARRY_HEADING}\n\n${text}` });

const generatedBody = (
  input: HandoffRenderInput,
  spec: SectionSpec,
  prior: O.Option<HandoffSection>
): O.Option<string> =>
  HandoffSectionKey.match(spec.key, {
    rulings: () =>
      A.isReadonlyArrayNonEmpty(rulingsInForce(input.rulings))
        ? O.some(
            withCarry(
              `Rendered from \`session ruling list\`: dated, verbatim operator wording, newest first. Paraphrases are not rulings.\n\n${renderRulingsMarkdown(input.rulings)}`,
              carriedOver(prior, spec.placeholder)
            )
          )
        : O.none(),
    "gate-snapshot": () =>
      O.map(
        input.gateSnapshot,
        (snapshot) =>
          `Rendered from \`yeet gate-table\` at write time. A PR whose row changed since this snapshot is where the predecessor stopped.\n\n\`\`\`text\n${Str.trimEnd(snapshot)}\n\`\`\``
      ),
    register: () =>
      O.some(
        withCarry(
          `Rendered from \`session register list --markdown\` at write time.\n\n${renderRegisterMarkdown(input.register)}`,
          carriedOver(prior, spec.placeholder)
        )
      ),
    journal: () => O.map(input.journalLine, (line) => `\`STATE.md\` last line at write time:\n\n> ${line}`),
    promises: keptAsWritten,
    decisions: keptAsWritten,
    "operator-hands": keptAsWritten,
    "next-actions": keptAsWritten,
    recipes: keptAsWritten,
    routes: keptAsWritten,
    broadcast: keptAsWritten,
  });

const holderLine = (holder: SessionLedgerRow): string =>
  `Holder: ${holder.lane} (${holder.branch}) session ${O.getOrElse(holder.sessionId, () => "unknown")} since ${DateTime.formatIso(holder.recordedAt)}, per the session ledger.`;

const HOLDER_THREAD_PLACEHOLDER =
  "Holder thread: unrecorded. The holder writes its T3 thread link here, so a successor can ask it for an explicit release.";

const RULE_LINE =
  "Rule: this file is rewritten at every stopping point, never only at hand-off. A successor reads this file, `tail -40 STATE.md`, and `bun run beep session register list`; nothing else is assumed.";

const RENDERED_LINE_PREFIX = "Rendered by `session handoff`";

const priorWrittenAt = (preamble: ReadonlyArray<string>): string =>
  O.getOrElse(
    A.findFirst(preamble, (line) =>
      O.flatMap(
        O.liftPredicate(line, Str.startsWith("# ")),
        flow(Str.match(/ written ([0-9][0-9T:.Z-]*[0-9Z])/u), O.flatMap(A.get(1)))
      )
    ),
    () => "unknown"
  );

const renderPreamble = (input: HandoffRenderInput, existing: O.Option<HandoffDocument>): string => {
  const preamble = O.match(existing, { onNone: A.empty<string>, onSome: (doc) => doc.preamble });
  const kept = O.isNone(existing)
    ? ["", RULE_LINE]
    : A.filter(preamble, (line) => !Str.startsWith("# ")(line) && !Str.startsWith(RENDERED_LINE_PREFIX)(line));
  const priorHolder = A.findFirst(kept, Str.startsWith("Holder:"));
  const holder = O.match(input.holder, {
    onNone: () => O.getOrElse(priorHolder, () => "Holder: none recorded in the session ledger."),
    onSome: holderLine,
  });
  const holderThread = A.some(kept, Str.startsWith("Holder thread:")) ? [] : [HOLDER_THREAD_PLACEHOLDER];
  const rendered = `${RENDERED_LINE_PREFIX} at ${DateTime.formatIso(input.writtenAt)}: the holder line, rulings, gate snapshot, register and journal pointer come from their files; every other section is carried over unchanged from the file written ${O.isNone(existing) ? "never (first render)" : priorWrittenAt(preamble)}.`;
  return A.join(
    [
      `# Orchestrator hand-off — ${input.repository.owner}/${input.repository.name} — written ${DateTime.formatIso(input.writtenAt)}`,
      trimBlankLines([holder, ...holderThread, ...A.filter(kept, (line) => !Str.startsWith("Holder:")(line))]),
      rendered,
    ],
    "\n\n"
  );
};

/**
 * Render `HANDOFF.md`: regenerate the data-backed sections, carry every prose
 * section over from the existing file, and keep the template's order.
 *
 * **Details**
 *
 * The H1 names the repository and the write instant. The holder line comes
 * from the newest open orchestrator row in the session ledger; with none, the
 * existing holder line is kept. "Rulings in force" is regenerated only when
 * the rulings store has a ruling in force, "Gate snapshot" only when a
 * snapshot is given, and "Journal pointer" only when `STATE.md` has a line;
 * otherwise the existing section is kept as written. "Register" is always
 * regenerated: it is the one section whose truth is the register file. A
 * regenerated rulings or register section never drops hand-written content:
 * a prior body that did not come from its store (or the carried block an
 * earlier render kept) is appended under a "Carried over" heading until the
 * holder records each item and deletes it. The preamble keeps a
 * `Holder thread:` line (a placeholder until the holder writes its T3 link)
 * and one "Rendered by `session handoff`" line naming when the carried-over
 * prose was last written.
 *
 * **Example** (A first render has every section)
 *
 * ```ts
 * import { HandoffRenderInput, PrRepository, renderHandoff } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const text = renderHandoff(
 *   HandoffRenderInput.make({
 *     repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *     writtenAt: DateTime.makeUnsafe(0),
 *     holder: O.none(),
 *     rulings: [],
 *     register: [],
 *     gateSnapshot: O.none(),
 *     journalLine: O.none(),
 *     existing: O.none(),
 *   })
 * )
 * console.log(text.includes("## Register")) // true
 * console.log(text.includes("## Journal pointer")) // true
 * ```
 *
 * @param input - The ledger holder, rulings, register, snapshot, journal line and prior file.
 * @returns The whole `HANDOFF.md`, ending in a newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderHandoff = (input: HandoffRenderInput): string => {
  const existing = O.map(input.existing, parseHandoffDocument);
  const prior = O.match(existing, { onNone: A.empty<HandoffSection>, onSome: (doc) => doc.sections });
  const priorSection = (key: HandoffSectionKey): O.Option<HandoffSection> =>
    A.findFirst(prior, (section) => O.contains(sectionKeyOf(section.title), key));
  const known = A.map(
    SECTIONS,
    (spec): HandoffSection =>
      O.match(generatedBody(input, spec, priorSection(spec.key)), {
        onSome: (body) => HandoffSection.make({ title: spec.title, body }),
        onNone: () =>
          O.getOrElse(priorSection(spec.key), () => HandoffSection.make({ title: spec.title, body: spec.placeholder })),
      })
  );
  const extras = A.filter(prior, (section) => O.isNone(sectionKeyOf(section.title)));
  const [beforeJournal, journal] = A.splitAt(known, A.length(known) - 1);
  const sections = A.appendAll(A.appendAll(beforeJournal, extras), journal);
  return `${A.join(
    [
      renderPreamble(input, existing),
      ...A.map(sections, (section) =>
        Str.isEmpty(section.body) ? `## ${section.title}` : `## ${section.title}\n\n${section.body}`
      ),
    ],
    "\n\n"
  )}\n`;
};
