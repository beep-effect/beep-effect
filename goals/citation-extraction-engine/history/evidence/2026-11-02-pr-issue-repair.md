# PR 2511 hosted issue repair

Hosted Check run 41438781994 at 299c3b2ce4 failed the use-cases declaration
build with TS2527 in CitationOracleAssertions and CitationOracleOperations.
Both inferred schemas contain CitationOracleArtifact, whose two branded
alternatives were private classes. Exporting those named classes from their
internal defining module makes their unique-symbol types accessible to emitted
cross-module declarations. Payload schemas, tags and codec behavior are unchanged.
The canonical catalog writer records their export visibility.

Twelve focused oracle assertion/operation tests pass in 3.57 seconds. A local
package declaration check no longer reports either TS2527; it still reports
three unrelated dependency/type-resolution errors in CandorPolicy/MailTagging.
That partial local check is not a successful package build. The full build,
unit, type-check, integration, docgen and coverage gates remain hosted duties.

The sole dead-code finding in the hosted Fallow report was an unused re-export
of CitationCallbackResult from CallbackSession. Its defining CallbackResource
module and consumers already use the direct shared contract. Only the unused
re-export is removed; the session's own import and behavior remain intact.

Main was merged at dc6d500937, preserving both citation package cache reviews
while taking upstream changes. The two review discussions were inspected and
resolved: the unused test alias is absent, and the PR was restored to the draft
state required by the goal. This does not approve merge or engine completion.

Remaining hosted findings include 65 complexity findings, 18 duplication groups,
Effect Vitest inventory findings, lint timeout/acceptance and fresh exact-head
proof. The two Vercel contexts report a provider build-rate limit. They are not
source failures and have not been marked successful. No finding is waived or
baselined by this repair, and queued checks are not treated as passed.
