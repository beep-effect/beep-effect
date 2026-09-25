# sync-data-target-selection

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Tier1 internal owner; independent P3 and implementation remain pending.
Source anchors name packages/tooling/tool/cli/src/commands/SyncDataToTs/
SyncDataToTs.command.ts unless another path is supplied.

## Current shape

Private SyncDataTargetSelection61-65 stores all:Boolean, targetId:Option<String>
and independent includeAuthenticated:Boolean. The target Option schema is
S.Option(S.String), not OptionFromOptionalKey and not a nullish string. No class
constructor defaults exist. The sole writer144 supplies all three from raw flags:
target29-33 is optional with alias t, all35 and includeAuthenticated36-39 default
false. Selection flags do not normalize/trim target strings.

resolveTargetSelection124-137 rejects both all and target, otherwise selects
all or delegates to resolveSelectedTarget114-117. The latter requires presence,
and resolveTargetById105-112 finds the first exact registered ID. Arbitrary
strings remain payload: an unknown string receives the separate typed unknown-ID
error. includeAuthenticated affects the all filter119-122 only; a named
authenticated target is allowed without it, as test918 demonstrates.

## Cardinality gap

| all | target presence | Legal selection |
| --- | --- | --- |
| false | None | no: required-selection error |
| false | Some | yes: one exact target ID |
| true | None | yes: registry targets filtered by access |
| true | Some | no: conflict error |

The correlated cluster is4/2. The complete carrier projection includes the
independent includeAuthenticated Boolean, giving8/4. Both values are allowed
beside either valid mode; direct-target true is not invalid merely because it
has no effect there. Target-ID value validation against the registry remains
separate from this presence projection. Do not claim all strings exist in the
registry, restrict IDs to a new literal list, or treat an empty Some string as
None. Dynamic registry order and first-match behavior are retained.

## Target schema

Use a private LiteralKit-driven two-case tagged union SyncDataTargetMode:
All with no target payload; Target with required targetId:String. Use named,
annotated case schemas and schema-derived guards/match. Preserve the kit base
until mapping members; annotate the resulting union before toTaggedUnion to
retain helpers. Place mode plus independent includeAuthenticated in the private
selection carrier (or pass that scalar separately); neither of the old all/
targetId fields remains alongside mode. No Boolean compatibility getters.

In resolveTargets139-145, validate the raw pair once with the current typed
conflict/required errors and then construct the matching canonical case.
Do not first allocate the old invalid bag or allocate a new raw schema clone.
resolveTargetSelection becomes exhaustive case dispatch: All filters current
registry using the unchanged independent access rule; Target calls existing
resolveTargetById with its exact string. No target-specific LiteralKit and no
codec for private transient selection are needed. Reuse existing schema helpers
and the module's canonical identity conventions when annotating the new schemas.

## Migration inventory

- Keep target/all/include-authenticated definitions29-39 and all other flag
  definitions40-56, including optional report-dir, verbose alias v and defaults.
- Replace class61-65 with mode plus independent access policy. The raw handler
  parameter bag is not a second migration owner.
- Keep exact errors85-103: “Pass either --all or --target, but not both.”;
  “Select at least one target with --target <id> or pass --all.”; unknown-ID
  message includes original targetId and available IDs in registry order.
- Keep registry search105-112 first-match and singleton array; migrate
  resolveSelectedTarget114-117 away only when the new Target case eliminates
  Option fallback. Keep its required-error behavior at the raw boundary.
- Replace selection match124-137 and writer139-145. targetIsEnabledForAll119-122
  remains public-access-or-include policy. Neither sort nor deduplicate targets.
- Handler558-560 retains findRepoRoot, then run-mode resolution, then target
  selection. Thus root errors and check/dry-run conflict still precede selection
  errors; both selection flags reject before unknown-target lookup.
- Preserve serial Effect.forEach execution561-563, result reporting565-567,
  writeReports568, summary569 and drift failure570. Typed catch/report/exit
  behavior571 onward remains unchanged. Never fetch a target or write a report
  just to choose a case.
- targets/index.ts remains the same eight ordered entries: iso4217, iso3166,
  iana media types, iana timezones, CLDR territories, reporters, courts, vocab.
  Read the live registry at resolution; do not snapshot it into enum metadata.
- Command barrel exports command/errors/schemas, not this private class.
  Exhaustive symbol search found the one constructor and private readers only.
  Downstream target implementations receive resolved SyncDataTarget values;
  they are outside this migration and retain every payload/function field.

The run-mode owner remains separately handled by internal/cli/RunMode.ts.
This design removes no check/dry-run flag or behavior.

## Guard-deletion accounting

Delete stored all and targetId from application selection state. Remove the
resolver's all-and-Some guard, subsequent all branch, and Option fallback from
the canonical consumer; schema cases make both/neither unrepresentable there.
Retain equivalent checks once at the raw argv boundary for exact diagnostics.
This is consolidation of coherence checks into construction, not disappearance
of user validation. Keep unknown-ID resolution and independent authentication
filter; neither is a Boolean-creep coherence check. No claimed guard deletion
in target fetching, reports, run modes or filesystem checks.

## Encoded-side impact

No serialized selection object or public schema constructor exists. Although
S.Option has an encoding, no actual selection codec caller was found. No
compatibility codec is warranted. Preserve flags/aliases/defaults, all original
ID bytes in lookup/errors and no normalization. Generated TypeScript, canonical
data, JSON/Markdown reports, logs, result order and exit behavior stay unchanged.
Direct authenticated selection stays accepted with either include flag, and
private source URLs/headers must never enter output. Changing selection structure
is not permission to alter access filtering or authenticate otherwise skipped
registry entries.

## Test impact

Add the full four raw-pair table through existing command fixtures. Both fails
with conflict even if the supplied ID is unknown; neither fails required.
Cross two valid modes with includeAuthenticated false/true: All false excludes
authenticated entries, All true includes them, and direct targets ignore it.
Use fixture targets/clients and temporary fixture roots; no live data fetch or
real authentication is required. Assert first-match singleton selection and
registry order; preserve unknown-ID text/order and payload including empty/
whitespace/nonmatching strings. Add competing run-mode/selection-invalid inputs
to protect error precedence and absence of target/report side effects.

Existing sync-data-to-ts.test.ts829-949 covers direct writes, dry run, drift,
no-op, CSV and authenticated ISO3166 privacy. It does not currently provide the
complete all/include-authenticated/both/neither table; do not claim it already
proves that matrix. Retain its generated output and logging checks. Exercise
report output under fixture clients when implementation touches the command.
Run focused SyncDataToTs tests and
`bun run beep quality package-verify @beep/repo-cli` after product edits, then
campaign/Yeet gates. This P2 audit is source inspection and finite arithmetic
only, with no live command, runtime implementation, P3 or package proof claim.

## Risk

Risks are narrowing independent includeAuthenticated to the All constructor,
trimming IDs, freezing/reordering registry entries, moving selection before
root/run-mode validation, or changing exact typed errors and reported exits.
The mode owns selection only. Keep full registered target objects, raw boundary
errors and independent policy while removing the invalid stored pair.
