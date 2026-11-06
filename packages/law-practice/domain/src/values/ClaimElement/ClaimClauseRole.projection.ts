/**
 * Exclusive nominal projection from an admitted complete element plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { clauseNominalHead } from "./ClaimClauseRole.behavior.ts";
import type { TextAnchor } from "@beep/provenance/TextAnchor";
import type {
  ClaimOwnedTermRegion,
  ClaimPlannedElement,
  ClaimSourceElementPlan,
  ClaimSourceFrame,
} from "./ClaimClauseRole.model.ts";
import type { ClaimTerm } from "./ClaimElement.model.ts";

const sameAnchor = (a: TextAnchor, b: TextAnchor): boolean =>
  a.startChar === b.startChar && a.endChar === b.endChar && a.quote === b.quote;
const contains = (outer: TextAnchor, inner: TextAnchor): boolean =>
  outer.startChar <= inner.startChar && inner.endChar <= outer.endChar;
const overlaps = (a: TextAnchor, b: TextAnchor): boolean => a.startChar < b.endChar && b.startChar < a.endChar;
const sourceAnchor = (
  plan: ClaimSourceElementPlan,
  anchor: TextAnchor,
  charge: (amount: number) => boolean
): boolean => {
  const length = anchor.endChar - anchor.startChar;
  if (
    anchor.startChar < 0 ||
    length <= 0 ||
    anchor.endChar > plan.qualifiedText.length ||
    length !== anchor.quote.length
  )
    return false;
  return charge(length * 2 + 2) && Str.slice(anchor.startChar, anchor.endChar)(plan.qualifiedText) === anchor.quote;
};

const preambleCertificate = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  region: ClaimOwnedTermRegion,
  charge: (amount: number) => boolean
): boolean => {
  const c = region.certificate;
  if (c.kind !== "preamble-clause-nominal" || element.grouping !== "preamble") return false;
  const clause = A.get(plan.roles.clauses, c.sourceClause - 1);
  return (
    sameAnchor(c.preamble, element.extent) &&
    sameAnchor(c.clauseNominal, region.extent) &&
    contains(c.preamble, region.extent) &&
    O.exists(
      clause,
      (scope) =>
        sourceAnchor(plan, scope.anchor, charge) &&
        contains(scope.anchor, region.extent) &&
        A.some(scope.nominals, (n) => sameAnchor(n, region.extent))
    )
  );
};
const regionCertificate = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  region: ClaimOwnedTermRegion,
  charge: (amount: number) => boolean
): boolean => {
  const c = region.certificate;
  if (c.element !== element.ordinal || region.ownerElement !== element.ordinal || c.roleNominal !== region.core)
    return false;
  return c.kind === "existing-element-nominal"
    ? c.production === element.grouping &&
        sameAnchor(c.lexicalRegion, element.lexicalHeader) &&
        contains(c.lexicalRegion, region.extent)
    : preambleCertificate(plan, element, region, charge);
};
const excludedRegion = (plan: ClaimSourceElementPlan, extent: TextAnchor): boolean =>
  A.some(
    plan.sourceExclusions,
    (exclusion) =>
      overlaps(exclusion.extent, extent) &&
      (exclusion.kind !== "quoted-protection" || !contains(extent, exclusion.extent))
  );
const ownerNominalMatches = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  region: ClaimOwnedTermRegion,
  index: number
): boolean =>
  O.exists(A.get(plan.nominals, region.core - 1), (attached) => {
    const nominal = O.getOrThrow(A.get(element.nominals, index));
    return (
      sameAnchor(attached.core, region.extent) &&
      sameAnchor(nominal.anchor, region.extent) &&
      sameAnchor(nominal.head, attached.head) &&
      nominal.role === attached.nominal.role &&
      nominal.determiner === attached.nominal.determiner
    );
  });
const ownedRegionWork = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  region: ClaimOwnedTermRegion
): number => {
  const links =
    region.certificate.kind === "preamble-clause-nominal"
      ? O.getOrElse(
          O.map(A.get(plan.roles.clauses, region.certificate.sourceClause - 1), (clause) => clause.nominals.length),
          () => 0
        )
      : 0;
  return plan.sourceExclusions.length + links + element.lexicalHeader.quote.length + region.extent.quote.length * 3 + 8;
};
const ownerRegionMatches = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  region: ClaimOwnedTermRegion,
  index: number,
  end: number,
  charge: (amount: number) => boolean
): boolean =>
  region.ordinal === index + 1 &&
  region.extent.startChar >= end &&
  contains(element.extent, region.extent) &&
  ownerNominalMatches(plan, element, region, index) &&
  regionCertificate(plan, element, region, charge) &&
  !excludedRegion(plan, region.extent);
const validOwnerHeader = (element: ClaimPlannedElement): boolean =>
  element.ownedTermRegions.length === element.nominals.length &&
  (element.grouping !== "preamble" ||
    O.exists(A.head(element.nominals), (nominal) => sameAnchor(nominal.anchor, element.lexicalHeader)));
const validateOwner = (
  plan: ClaimSourceElementPlan,
  element: ClaimPlannedElement,
  seen: Array<number>,
  charge: (amount: number) => boolean
): boolean => {
  if (
    !sourceAnchor(plan, element.extent, charge) ||
    !(element.lexicalHeader === element.extent || sourceAnchor(plan, element.lexicalHeader, charge)) ||
    !validOwnerHeader(element)
  )
    return false;
  let end = element.extent.startChar;
  for (let i = 0; i < element.ownedTermRegions.length; i++) {
    const region = O.getOrThrow(A.get(element.ownedTermRegions, i));
    if (!charge(ownedRegionWork(plan, element, region))) return false;
    if (
      O.getOrElse(A.get(seen, region.core - 1), () => 0) > 0 ||
      !ownerRegionMatches(plan, element, region, i, end, charge)
    )
      return false;
    seen[region.core - 1] = element.ordinal;
    end = region.extent.endChar;
  }
  return true;
};
const coreIndex = (
  plan: ClaimSourceElementPlan,
  anchor: TextAnchor,
  charge: (amount: number) => boolean
): O.Option<number> => {
  let lower = 0;
  let upper = plan.nominals.length;
  while (lower < upper) {
    if (!charge(2)) return O.none();
    const index = Math.floor((lower + upper) / 2);
    const candidate = O.getOrThrow(A.get(plan.nominals, index)).core;
    if (candidate.startChar < anchor.startChar) lower = index + 1;
    else upper = index;
  }
  if (!charge(anchor.quote.length + 1)) return O.none();
  return O.map(
    O.filter(A.get(plan.nominals, lower), (n) => sameAnchor(n.core, anchor)),
    () => lower
  );
};
const frameContains = (frame: ClaimSourceFrame, anchor: TextAnchor, predicate: boolean): boolean =>
  A.some(predicate ? frame.predicates : frame.nominals, (a) => sameAnchor(a, anchor));
const nextInheritedFrame = (
  plan: ClaimSourceElementPlan,
  ordinal: number,
  child: number,
  depth: number,
  charge: (amount: number) => boolean
): O.Option<ClaimSourceFrame> =>
  depth <= 128 && charge(2) ? O.filter(A.get(plan.frames, ordinal - 1), (f) => f.ordinal < child) : O.none();
const inheritedFrameStep = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  anchor: TextAnchor,
  predicate: boolean,
  parent: number,
  depth: number,
  charge: (amount: number) => boolean
): O.Option<readonly [ClaimSourceFrame, boolean]> => {
  const candidate = nextInheritedFrame(plan, parent, frame.ordinal, depth, charge);
  if (O.isNone(candidate)) return O.none();
  const ancestor = candidate.value;
  if (!charge((predicate ? ancestor.predicates.length : ancestor.nominals.length) + anchor.quote.length))
    return O.none();
  return O.some([ancestor, frameContains(ancestor, anchor, predicate)]);
};
const inheritedFrameReference = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  anchor: TextAnchor,
  predicate: boolean,
  charge: (amount: number) => boolean
): boolean => {
  let parent = frame.parent;
  let depth = 0;
  while (O.isSome(parent)) {
    const step = inheritedFrameStep(plan, frame, anchor, predicate, parent.value, ++depth, charge);
    if (O.isNone(step)) return false;
    const [ancestor, matches] = step.value;
    if (matches) return true;
    parent = ancestor.parent;
  }
  return false;
};
const declaredCoreReference = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  owner: number,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.declarationPlans.length)) return false;
  for (const declaration of plan.declarationPlans) {
    if (!charge(declaration.items.length + 1)) return false;
    if (
      declaration.frame === frame.ordinal &&
      declaration.owner === frame.publicOwner &&
      A.some(declaration.items, (item) => item.child === owner)
    )
      return true;
  }
  return false;
};
const frameCore = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  anchor: TextAnchor,
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean => {
  const index = coreIndex(plan, anchor, charge);
  if (O.isNone(index)) return false;
  const owner = O.getOrElse(A.get(owners, index.value), () => 0);
  if (!charge(frame.nominals.length + 1)) return false;
  if (owner === frame.publicOwner && frameContains(frame, anchor, false)) return true;
  return (
    inheritedFrameReference(plan, frame, anchor, false, charge) || declaredCoreReference(plan, frame, owner, charge)
  );
};
const validFrameParent = (plan: ClaimSourceElementPlan, frame: ClaimSourceFrame): boolean =>
  O.match(frame.parent, {
    onNone: () => true,
    onSome: (ordinal) =>
      ordinal < frame.ordinal &&
      O.exists(A.get(plan.frames, ordinal - 1), (parent) => contains(parent.extent, frame.extent)),
  });
const validFrameOwner = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.declarationPlans.length + frame.extent.quote.length + 4) || !validFrameParent(plan, frame))
    return false;
  const owner = A.get(plan.elements, frame.publicOwner - 1);
  if (O.isNone(owner)) return false;
  if (sameAnchor(owner.value.extent, frame.extent)) return true;
  if (A.some(plan.declarationPlans, (d) => d.owner === frame.publicOwner && d.frame === frame.ordinal)) return true;
  return O.exists(
    O.flatMap(frame.parent, (id) => A.get(plan.frames, id - 1)),
    (parent) =>
      parent.publicOwner === frame.publicOwner &&
      parent.ordinal < frame.ordinal &&
      contains(parent.extent, frame.extent)
  );
};
const validFrameArgument = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  argument: ClaimSourceFrame["arguments"][number],
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean => {
  if (!frameCore(plan, frame, argument.nominal, owners, charge) || !charge(frame.predicates.length + 1)) return false;
  if (
    O.exists(
      argument.predicate,
      (p) => !frameContains(frame, p, true) && !inheritedFrameReference(plan, frame, p, true, charge)
    )
  )
    return false;
  return !O.exists(argument.ownerNominal, (n) => !frameCore(plan, frame, n, owners, charge));
};
const localFrameNominal = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  nominal: TextAnchor,
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean =>
  O.exists(coreIndex(plan, nominal, charge), (index) => O.contains(A.get(owners, index), frame.publicOwner));
const validateFrame = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean => {
  if (!validFrameOwner(plan, frame, charge) || !charge(frame.nominals.length + frame.arguments.length + 2))
    return false;
  if (!A.every(frame.nominals, (n) => localFrameNominal(plan, frame, n, owners, charge))) return false;
  if (!A.every(frame.arguments, (a) => validFrameArgument(plan, frame, a, owners, charge))) return false;
  return (
    !O.exists(frame.subject, (n) => !frameCore(plan, frame, n, owners, charge)) &&
    !O.exists(frame.sharedSubject, (n) => !frameCore(plan, frame, n, owners, charge))
  );
};
const attachedGeometry = (nominal: ClaimSourceElementPlan["nominals"][number], end: number): boolean =>
  nominal.core.startChar >= end &&
  sameAnchor(nominal.core, nominal.nominal.anchor) &&
  sameAnchor(nominal.head, nominal.nominal.head) &&
  contains(nominal.core, nominal.head) &&
  contains(nominal.outer, nominal.core);
const attachedSource = (
  plan: ClaimSourceElementPlan,
  nominal: ClaimSourceElementPlan["nominals"][number],
  charge: (amount: number) => boolean
): boolean =>
  sourceAnchor(plan, nominal.core, charge) &&
  (nominal.head === nominal.core || sourceAnchor(plan, nominal.head, charge)) &&
  (nominal.outer === nominal.core || sourceAnchor(plan, nominal.outer, charge));
const validateAttached = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  let end = 0;
  for (const nominal of plan.nominals) {
    if (!charge(nominal.core.quote.length * 2 + nominal.head.quote.length + 4)) return false;
    if (!attachedSource(plan, nominal, charge) || !attachedGeometry(nominal, end)) return false;
    end = nominal.core.endChar;
  }
  return true;
};
const validateOwners = (
  plan: ClaimSourceElementPlan,
  owners: Array<number>,
  charge: (amount: number) => boolean
): boolean => A.every(plan.elements, (element) => validateOwner(plan, element, owners, charge));
const validateOwnership = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (!charge(plan.nominals.length + plan.elements.length + plan.frames.length + plan.roles.clauses.length + 1))
    return false;
  const owners = A.replicate(0, plan.nominals.length);
  if (
    !charge(plan.sourceExclusions.length) ||
    !A.every(plan.sourceExclusions, (exclusion) => sourceAnchor(plan, exclusion.extent, charge))
  )
    return false;
  return (
    validateAttached(plan, charge) &&
    validateOwners(plan, owners, charge) &&
    charge(owners.length) &&
    A.every(owners, (owner) => owner > 0) &&
    A.every(plan.frames, (frame) => validateFrame(plan, frame, owners, charge))
  );
};
const projectedNominal = (element: ClaimPlannedElement, index: number, end: number): boolean => {
  const nominal = O.getOrThrow(A.get(element.nominals, index));
  const region = O.getOrThrow(A.get(element.ownedTermRegions, index));
  return (
    nominal.anchor.startChar >= end &&
    contains(element.extent, nominal.anchor) &&
    sameAnchor(nominal.anchor, region.extent) &&
    region.ownerElement === element.ordinal &&
    contains(nominal.anchor, nominal.head)
  );
};
const projectTerms = (
  element: ClaimPlannedElement,
  charge: (amount: number) => boolean
): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>> => {
  if (
    !charge(element.nominals.length * 2 + element.extent.quote.length + 1) ||
    element.ownedTermRegions.length !== element.nominals.length
  )
    return O.none();
  let end = element.extent.startChar;
  for (let index = 0; index < element.nominals.length; index++) {
    const nominal = O.getOrThrow(A.get(element.nominals, index));
    const span = nominal.anchor;
    if (!projectedNominal(element, index, end)) return O.none();
    end = span.endChar;
  }
  return O.some(
    A.map(element.nominals, (nominal) => ({
      anchor: nominal.anchor,
      determiner: nominal.determiner,
      head: clauseNominalHead(nominal),
    }))
  );
};

/**
 * Project all owned terms atomically; no per-term legacy fallback is permitted.
 *
 * @category parsing
 * @since 0.0.0
 */
export const projectClaimRoleTerms: {
  (
    charge: (amount: number) => boolean
  ): (element: ClaimPlannedElement) => O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
  (
    element: ClaimPlannedElement,
    charge: (amount: number) => boolean
  ): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
} = dual(2, projectTerms);

/**
 * Validate the complete immutable source ownership plan.
 * @category validation
 * @since 0.0.0
 */
export const validateClaimSourceOwnership: {
  (charge: (amount: number) => boolean): (plan: ClaimSourceElementPlan) => boolean;
  (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean;
} = dual(2, validateOwnership);
