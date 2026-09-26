import { EvidenceSpan } from "@beep/epistemic-domain";
import { ClaimEvidenceBasis } from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { ClaimEvidenceReviewPanel } from "@beep/epistemic-ui";
import {
  ApproveClaimEvidence,
  approveClaimEvidence,
  ExplainClaimEvidence,
  explainClaimEvidence,
} from "@beep/epistemic-use-cases/ClaimEvidenceReview";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import { UserId } from "@beep/shared-domain/identity/Shared";
import { Button } from "@beep/ui/components/button";
import { RegistryProvider, useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as BrowserCrypto from "@effect/platform-browser/BrowserCrypto";
import { Effect } from "effect";
import * as O from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import type { Meta, StoryObj } from "@storybook/react-vite";

const exampleText = (year: number) =>
  `North Observatory field note\n\nThe observatory opened to the public in ${year}.\nThe site includes one telescope and a public archive.\n`;
const exampleBasis = (year: number, digest: SourceTextDigest) =>
  ClaimEvidenceBasis.make({
    claimRef: "claim:observatory-opening",
    assertion: `North Observatory opened to the public in ${year}.`,
    subject: "North Observatory",
    evidence: EvidenceSpan.make({
      startChar: NonNegativeInt.make(46),
      endChar: NonNegativeInt.make(74),
      quote: `opened to the public in ${year}`,
      confidence: UnitInterval.make(0.82),
    }),
    source: SourceTextIdentity.make({
      scopeRef: "project:observatory",
      sourceRef: "document:field-note",
      locator: PosixPath.make("documents/observatory.txt"),
      sourceDigest: digest,
      textDigest: digest,
      extractor: SourceTextExtractor.make({ name: "plain-text", version: "1" }),
      normalizationVersion: "1",
    }),
  });
const originalBasis = exampleBasis(
  2024,
  SourceTextDigest.make("sha256:02788cfc8542722b1611c7dd35b1b25bc22316d85d7d84baa693ee35a335bf73")
);
const revisedBasis = exampleBasis(
  2025,
  SourceTextDigest.make("sha256:f75c0e0ecb422c2bc553af0785681e1f2a8214522fb3eea0ada5a38599458dc7")
);
const reviewer = UserPrincipal.make({ kind: "User", userId: UserId.make(1) });
const initialInput = ExplainClaimEvidence.make({
  basis: originalBasis,
  currentSource: originalBasis.source,
  sourceText: exampleText(2024),
  review: O.none(),
});
const inputAtom = Atom.make(initialInput);
const runtime = Atom.runtime(BrowserCrypto.layer);
const explanationAtom = runtime.atom((get) => explainClaimEvidence(get(inputAtom)));
const approvalAtom = runtime.fn<void>()(
  Effect.fn("EvidenceReviewStory.approve")(function* (_, get) {
    const input = get(inputAtom);
    const review = yield* approveClaimEvidence(
      ApproveClaimEvidence.make({
        basis: input.basis,
        currentSource: input.currentSource,
        sourceText: input.sourceText,
        reviewedBy: reviewer,
      })
    );
    // Retain the approved basis as history even if another input arrived while hashing.
    get.set(inputAtom, ExplainClaimEvidence.make({ ...get(inputAtom), review: O.some(review) }));
    return review;
  }),
  { concurrent: false }
);

function ReviewJourney() {
  const [input, setInput] = useAtom(inputAtom);
  const explanation = useAtomValue(explanationAtom);
  const approval = useAtomValue(approvalAtom);
  const approve = useAtomSet(approvalAtom);
  const pending = explanation.waiting || approval.waiting;

  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-4 md:p-8">
      <header className="grid gap-2">
        <p className="text-sm font-medium text-muted-foreground">Evidence review example</p>
        <h1 className="text-3xl font-semibold tracking-tight">From a document to a reviewed claim</h1>
        <p className="max-w-2xl text-muted-foreground">
          Inspect the source, approve its interpretation, then change the document or extractor to see exactly why the
          previous approval becomes stale.
        </p>
        <p className="text-xs text-muted-foreground">
          This example uses prepared extractions and a sample reviewer. Reviews stay in this browser session.
        </p>
      </header>
      <nav aria-label="Evidence example scenarios" className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            setInput(
              ExplainClaimEvidence.make({ ...input, currentSource: revisedBasis.source, sourceText: exampleText(2025) })
            )
          }
        >
          Load revised document
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            setInput(
              ExplainClaimEvidence.make({
                ...input,
                basis: ClaimEvidenceBasis.make({
                  ...(input.currentSource.textDigest === revisedBasis.source.textDigest ? revisedBasis : originalBasis),
                  source: input.currentSource,
                }),
              })
            )
          }
        >
          Use updated extraction
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            setInput(
              ExplainClaimEvidence.make({
                ...input,
                currentSource: SourceTextIdentity.make({
                  ...input.currentSource,
                  extractor: SourceTextExtractor.make({ name: "plain-text", version: "2" }),
                }),
              })
            )
          }
        >
          Change extractor version
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setInput(initialInput)}>
          Reset example
        </Button>
      </nav>
      {AsyncResult.match(explanation, {
        onInitial: () => <p role="status">Verifying the source…</p>,
        onFailure: () => <p role="alert">The evidence could not be decoded. Reset the example and try again.</p>,
        onSuccess: ({ value }) => (
          <ClaimEvidenceReviewPanel
            explanation={value}
            onApprove={() => approve()}
            pending={pending}
            error={
              AsyncResult.isFailure(approval)
                ? "Approval failed. Recheck the current source before trying again."
                : undefined
            }
          />
        ),
      })}
    </main>
  );
}

const meta = {
  title: "Epistemic/Claim evidence review",
  component: ClaimEvidenceReviewPanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ClaimEvidenceReviewPanel>;
export default meta;

/** One document, its extracted claim, and an approval that becomes stale after drift. */
export const DocumentToApproval: StoryObj = {
  render: () => (
    <RegistryProvider>
      <ReviewJourney />
    </RegistryProvider>
  ),
};
