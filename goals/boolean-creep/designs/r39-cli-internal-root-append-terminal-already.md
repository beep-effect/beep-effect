# r39-cli-internal-root-append-terminal-already

Design at ea3ac40867e4f292b7f0708b156231f0462ddcd9. Proposed Tier1 decoded-only local migration; no implementation or P3 approval.

## Current shape

AttemptTerminationJournal.ts639–688 owns the append operation. Inside appendLocked, journalExists is an independent filesystem observation. appendedTerminal674 classifies decoded finished/terminated events. terminalAlreadyExists677 is appendedTerminal AND membership of the event attemptId in terminalAttemptIds(currentEvents). The latter controls append suppression679 and retention input682. Existing event schema discrimination narrows attemptId safely; keep it.

## Cardinality gap

The selected two Boolean locals admit4 bit pairs but construct3: false/false, true/false, true/true. The attached truth table enumerates terminal classification and prior ID presence. false/true is impossible. journalExists is not folded into this state: a present journal may contain no terminal ID. Separate journal-compacted classification is not a third stored Boolean in this owner.

## Target schema

Add a private annotated LiteralKit named TerminalAppendDisposition in the existing owning module, with nonterminal, fresh-terminal, duplicate-terminal cases and schema-derived type. Search current source/barrels again at implementation for an existing equivalent before adding it. Use the existing module identity annotations and LiteralKit conventions.

Construct one disposition after decoding and reading currentEvents. Use the existing event-union case helpers: finished/terminated cases check membership and choose fresh-terminal or duplicate-terminal; other event cases choose nonterminal. Do not store appendedTerminal or terminalAlreadyExists alongside the disposition. Do not decode a fabricated Boolean bag or introduce a general-purpose classifier service.

Use the kit matcher to decide append: duplicate-terminal yields Effect.void, other cases append the original line. After reconciliation, match disposition for appendedAttemptIds: duplicate-terminal gives empty; fresh-terminal supplies the event attemptId; nonterminal preserves the existing journal-compacted distinction, empty for that case and the original attemptId for all others. Event payload narrowing must come from the event schema guard/matcher, not a cast or assumed relationship between separate variables. Sharing the nonterminal/fresh append branch is safe; retaining separate retention branches makes tag narrowing explicit.

## Migration inventory

1. AttemptTerminationJournal.ts674–678: replace the two local flags with the private disposition construction inside the existing lock.
2. Line679: switch append-versus-skip on disposition.
3. Lines681–684: switch retention input on disposition and retain journal-compacted handling. Keep reconcileJournalLocked680 before compactJournal685.
4. Public appendEncodedAttemptJournalEvent signature639 and return Effect<void> stay unchanged. Existing callers Yeet/internal/AttemptJournal.ts246 and appendSchedulerAttemptTerminated734 need no API migration.
5. The test export remains unchanged. Update focused behavior tests only; the private kit needs no public barrel export or test-only widening.

## Guard-deletion accounting

Delete appendedTerminal and terminalAlreadyExists storage and their implication-encoding conjunction at677–678. Replace both downstream Boolean reads at679 and682 with case dispatch. The event-terminal classifier and terminal ID membership remain necessary evidence acquisition; this design does not claim those operations can be deleted. Preserve the journal-compacted tag guard, journalExists filesystem branch, lock acquisition/refusal, error mapping, torn-journal repair and finalizer. No existing decoder cross-field guard is claimed removed.

## Encoded-side impact

None: the state is local control flow. Persist precisely the original NDJSON line and preserve journal schemas, tags, attempt IDs, retention receipts, legacy decoding, ordering and compaction. Do not encode the new literal or normalize any input. eventTag remains diagnostic input; derive state from decoded appendedEvent exactly as today rather than trusting eventTag.

## Test impact

Existing yeet.test.ts2648–2668 checks exhausted lock refusal;2671–2688 checks journal-compacted receipt without retention slot;3794–3847 checks ordinary-finish preservation and repeated abnormal terminal idempotence. Read and retain the full test bodies during implementation.

Extend behavioral coverage for all3 disposition cases: nonterminal append, first terminal append, duplicate terminal skip. Test both terminal tags, both duplicate same-tag and cross-tag order, absent journal and existing journal without matching ID, a different attempt ID, nonterminal records following a terminal record, and compaction receipt behavior. Assert resulting ordered journal rows and retention behavior, not merely enum construction. Preserve decode failures, torn-row repair and lock release on failure through existing suite coverage; add a regression only where missing. The finite table is design evidence, not passing implementation tests.

After ratification run focused Yeet/attempt-journal tests, CLI check and package-verify @beep/repo-cli, followed by required Yeet proof/publish/monitor. Benjamin merges.

## Risk

The main risks are moving membership before torn-journal repair, trusting diagnostic eventTag instead of decoded tag, losing journal-compacted behavior, or retaining duplicate terminal IDs during compaction. Keeping effect order and existing boundary signatures plus journal-level tests addresses these. No implementation begins before campaign review and ratification.
