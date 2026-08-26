import { BoundedShaclValidationServiceLive } from "@beep/epistemic-server/ShaclValidation";
import { IdentityEntry } from "@beep/identity";
import { $EpistemicServerId } from "@beep/identity/packages";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad, NamedNode } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import {
  DefaultIdentityRdfBinding,
  entriesToDataset,
  IdentityRdfBinding,
  IdentityShapePolicy,
  projectShapes,
} from "@beep/semantic-web";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { assert, describe, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const entryComposer = $EpistemicServerId.create("identity/shacl-projection-e2e-entry");
const requiredFiberPath = makeNamedNode($EpistemicServerId.create("identity/fibers/display-name").iri);
const binding = IdentityRdfBinding.make({
  identifierPath: DefaultIdentityRdfBinding.identifierPath,
  curiePath: DefaultIdentityRdfBinding.curiePath,
  fiberPaths: { displayName: requiredFiberPath },
});
const policy = IdentityShapePolicy.make({ requiredFibers: ["displayName"] });
const entry = IdentityEntry.fromComposer(entryComposer, { displayName: "Identity projection e2e" });
const sameNamedNode = S.toEquivalence(NamedNode);

describe("identity SHACL projection end to end", () => {
  it.layer(BoundedShaclValidationServiceLive)("over the bounded SHACL validator", (it) => {
    it.effect(
      "conforms with the required fiber and reports its path when removed",
      Effect.fnUntraced(function* () {
        const dataset = yield* entriesToDataset(binding)([entry]);
        const shapes = yield* projectShapes(binding, policy)([entry]);
        const service = yield* ShaclValidationService;
        const conforming = yield* service.validate(ShaclValidationRequest.make({ dataset, shapes }));

        assert.isTrue(conforming.conforms);
        assert.lengthOf(conforming.violations, 0);

        const withExtraIdentifier = makeDataset(
          pipe(
            dataset.quads,
            A.append(
              makeQuad(
                makeNamedNode(entry.iri),
                binding.identifierPath,
                makeLiteral("@beep/epistemic-server/UnexpectedIdentity", XSD_STRING.value)
              )
            )
          )
        );
        const extraIdentifierFailing = yield* service.validate(
          ShaclValidationRequest.make({ dataset: withExtraIdentifier, shapes })
        );
        const identifierViolation = pipe(
          extraIdentifierFailing.violations,
          A.findFirst((violation) => sameNamedNode(violation.path, binding.identifierPath))
        );

        assert.isFalse(extraIdentifierFailing.conforms);
        O.match(identifierViolation, {
          onNone: () => assert.fail("Expected a violation on the identifier path for an extra literal."),
          onSome: (violation) => {
            assert.strictEqual(violation.severity, "violation");
            assert.strictEqual(violation.path.value, binding.identifierPath.value);
          },
        });

        const withoutRequiredFiber = makeDataset(
          pipe(
            dataset.quads,
            A.filter((quad) => !sameNamedNode(quad.predicate, requiredFiberPath))
          )
        );
        const failing = yield* service.validate(ShaclValidationRequest.make({ dataset: withoutRequiredFiber, shapes }));
        const requiredFiberViolation = pipe(
          failing.violations,
          A.findFirst((violation) => sameNamedNode(violation.path, requiredFiberPath))
        );

        assert.isFalse(failing.conforms);
        O.match(requiredFiberViolation, {
          onNone: () => assert.fail("Expected a violation on the removed identity fiber path."),
          onSome: (violation) => {
            assert.strictEqual(violation.severity, "violation");
            assert.strictEqual(violation.path.value, requiredFiberPath.value);
          },
        });
      })
    );
  });
});
