# Owned native source and cumulative text-gap planning

The text planner now prepares one owned native source for an assembly operation.
Gap calls use absolute Python source-point bounds and read canonical source
words directly. They do not project a gap to a JavaScript string or copy a
full source buffer per gap. This preserves distinct literal-surrogate words
and astral scalars even when a gap begins or ends between source words whose
JavaScript projection would combine into a surrogate pair.

The existing full-text plan method uses the same prepared-source path. The
owner hides its mutable native byte buffer; snapshot returns independent bytes
through Effect Bytes. Caller input mutation and snapshot mutation cannot alter
later gap planning. Native preparation remains the existing Unicode adapter;
the source UTF-16 ceiling is checked after validated preparation.

Every gap preflights its complete output count before building the span list.
The prepared owner shares one text-token ceiling across all calls and uses an
Effect Semaphore to serialize budget updates. Captured timing surrounds permit
acquisition and range execution. Forward bounds are validated against the full
Python source length; invalid or exhausted calls return no partial span list.
The surrounding operation still owns total produced-text reservations and the
mixed text/special-token result budget. This is not a general operation-budget
replacement or a claim that all engine allocation accounting is closed.

## Source observations and integration

The pinned producer retains all 1,561 actual source append_text cases. It now
also calls actual append_text on 116 native source subranges and derives exact
absolute spans from the returned source parts. Short sources exhaust all
forward ranges, including empty ranges and cuts inside words; directed long
ranges cross scan/yield boundaries. Inputs cover literal surrogate pairs,
astral scalars, tabs, line breaks, nonbreaking spaces, repeated spaces and
leading/trailing spaces. Every target whole-text and range result matches.

All 407 mixed-token assembly cases now prepare the full source once and route
text calls through the native range owner. The earlier gap-by-gap JavaScript
projection/encoding path has been removed. Their exact output items, token
indices and 1,247 source host decisions remain required. Those assembly
witnesses are ASCII; the independent native-range controls prove the broader
coordinate and word behavior without pretending the mixed witnesses are a
complete native document corpus.

Eleven focused object/assembly/edition/text tests pass, including all prior
constructor, merge and edition controls. Source/snapshot ownership, invalid
range, cumulative token equality/exhaustion and captured deadline controls
pass. Quick server lint/type checks, scoped Oxlint and zero-finding new-only Fallow
pass. Repeat generation
is byte-identical after formatting. Latest-head hosted proof remains required.

Producer SHA-256:
6df06cf497f876d61b7ce942713396e3c9a70740086a338ee83c530fdc0bf41a.
Expanded fixture SHA-256:
f50330d18ec0566fb7ebd04add831da401ade8f054a5aef0ffc88c321721508a.

Regex-result selection and constructor-extra normalization, general custom
protocols, complete operation reservation/ownership, source family/scaling,
full canonical replay and public tokenizer/engine integration remain open.
No full tokenizer completion or semantic waiver is asserted.
