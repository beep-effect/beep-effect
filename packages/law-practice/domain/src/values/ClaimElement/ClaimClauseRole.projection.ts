/**
 * Exclusive nominal projection from an admitted complete element plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  claimFiniteSourceProofSlot,
  clauseNominalHead,
  validateClaimCitationWitness,
  validateClaimFiniteSourceProofs,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "./ClaimClauseRole.behavior.ts";
import {
  ClaimFrameArgument,
  ClaimFrameLexicalView,
  ClaimPrivateFrameArgument,
  ClaimQualifiedHeaderMembership,
  ClaimSourceControlEvidence,
  ClaimSourceProofRef,
  ClaimSourceTokenOwnership,
} from "./ClaimClauseRole.model.ts";
import { sourceLowerBound, sourceSelectionFrameMember } from "./ClaimClauseRole.sourceQuery.ts";
import type { TextAnchor } from "@beep/provenance/TextAnchor";
import type {
  ClaimAttachedNominal,
  ClaimCitationWitness,
  ClaimFiniteSourceProof,
  ClaimFrameSubjectInheritance,
  ClaimListDeclaration,
  ClaimOwnedTermRegion,
  ClaimPlannedElement,
  ClaimSourceDeclaration,
  ClaimSourceElementPlan,
  ClaimSourceExclusion,
  ClaimSourceFrame,
  ClaimSourceOperatorBinding,
} from "./ClaimClauseRole.model.ts";
import type { ClaimTerm } from "./ClaimElement.model.ts";

const rawTokenSourceStart = (proof: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>): number =>
  proof.token.anchor.startChar;
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
const inheritedSubjectGeometry = (frame: ClaimSourceFrame, inherited: ClaimFrameSubjectInheritance): boolean =>
  O.contains(frame.parent, inherited.fromFrame) &&
  (frame.attachment === "relative" || frame.attachment === "complement") &&
  O.exists(frame.subject, (subject) => sameAnchor(subject, inherited.nominal));
const validateInheritedSubject = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): boolean => {
  if (O.isNone(frame.inheritedSubject)) return true;
  const inherited = frame.inheritedSubject.value;
  const parent = A.get(plan.frames, inherited.fromFrame - 1);
  if (
    !charge(
      O.getOrElse(
        O.map(parent, (p) => p.nominals.length),
        () => 0
      ) + 4
    )
  )
    return false;
  return (
    inheritedSubjectGeometry(frame, inherited) &&
    O.exists(parent, (p) => A.some(p.nominals, (n) => sameAnchor(n, inherited.nominal)))
  );
};
const validateFrame = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean => {
  if (!validateInheritedSubject(plan, frame, charge)) return false;
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
const proofAt = (plan: ClaimSourceElementPlan, ref: ClaimSourceProofRef): O.Option<ClaimFiniteSourceProof> =>
  O.filter(
    A.get(plan.roles.certificates, ref.ordinal - 1),
    (proof) => proof.ordinal === ref.ordinal && claimFiniteSourceProofSlot(proof) === ref.slot
  );
const bindingToken = (plan: ClaimSourceElementPlan, ref: ClaimSourceProofRef): O.Option<TextAnchor> =>
  O.flatMap(proofAt(plan, ref), (proof) =>
    proof.kind === "token" && ref.slot === "token" ? O.some(proof.token.anchor) : O.none()
  );
const rawTokenProof = (
  proof: ClaimFiniteSourceProof
): proof is Extract<ClaimFiniteSourceProof, { readonly kind: "token" }> => proof.kind === "token";
const rawOperatorProof = (
  proof: ClaimFiniteSourceProof
): proof is Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }> => proof.kind === "operator";
const bindingSourceSlot = (
  binding: ClaimSourceOperatorBinding,
  slot: Exclude<ClaimSourceOperatorBinding["slots"][number], { readonly kind: "gap" }>,
  token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }>
): boolean =>
  slot.token.slot === "token" &&
  slot.certificate.slot === "operator" &&
  sameAnchor(token.token.anchor, slot.extent) &&
  contains(binding.operator, proof.extent);
const bindingRawAdjunct = (plan: ClaimSourceElementPlan, token: ClaimSourceProofRef): boolean =>
  O.exists(
    proofAt(plan, token),
    (p) =>
      p.kind === "token" &&
      (p.token.pos === "ADV" || HashSet.has(HashSet.make("not", "n't"), Str.toLowerCase(p.token.anchor.quote)))
  );
const bindingMemberRole = (
  plan: ClaimSourceElementPlan,
  slot: Exclude<ClaimSourceOperatorBinding["slots"][number], { readonly kind: "gap" }>,
  op: Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }>,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(op.lexical.length + plan.roles.predicates.length + 4)) return false;
  const direct = A.some(op.lexical, (r) => r.ordinal === slot.token.ordinal);
  if (slot.kind === "lexical" && !direct) return false;
  const licensedAdjunct = A.some(plan.roles.predicates, (p) => p.kind === "adjunct" && contains(p.anchor, slot.extent));
  if (slot.kind === "adjunct" && !licensedAdjunct && !bindingRawAdjunct(plan, slot.token)) return false;
  return slot.kind !== "lexical" || !licensedAdjunct;
};
const bindingMember = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  slot: Exclude<ClaimSourceOperatorBinding["slots"][number], { readonly kind: "gap" }>,
  charge: (amount: number) => boolean
): number => {
  const token = O.filter(proofAt(plan, slot.token), rawTokenProof);
  const proof = O.filter(proofAt(plan, slot.certificate), rawOperatorProof);
  if (O.isNone(token) || O.isNone(proof) || !bindingSourceSlot(binding, slot, token.value, proof.value)) return 0;
  return bindingMemberRole(plan, slot, proof.value, charge) ? proof.value.ordinal : 0;
};
const validateBindingHead = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  members: HashSet.HashSet<number>
): boolean => {
  const memberIds = A.fromIterable(members);
  const headParts = A.filter(memberIds, (id) =>
    O.exists(A.get(plan.roles.certificates, id - 1), (p) => p.kind === "operator" && p.headRole === "predicate")
  );
  const eligible =
    HashSet.size(members) === 1 ? A.head(memberIds) : headParts.length === 1 ? A.head(headParts) : O.none();
  return O.match(binding.head, {
    onNone: () => O.isNone(eligible),
    onSome: (head) =>
      O.isSome(bindingToken(plan, head.token)) &&
      O.contains(eligible, head.certificate.ordinal) &&
      O.exists(
        proofAt(plan, head.certificate),
        (p) => p.kind === "operator" && p.head.token.ordinal === head.token.ordinal
      ) &&
      A.some(
        binding.slots,
        (slot) =>
          slot.kind === "lexical" &&
          slot.token.ordinal === head.token.ordinal &&
          slot.certificate.ordinal === head.certificate.ordinal
      ),
  });
};
const bindingSlotGeometry = (
  plan: ClaimSourceElementPlan,
  slot: ClaimSourceOperatorBinding["slots"][number],
  cursor: number,
  charge: (amount: number) => boolean
): boolean => slot.extent.startChar === cursor && sourceAnchor(plan, slot.extent, charge);
// Positive ordinals are operator members; -1 is a complete whitespace gap, and 0 is failure. Neither sentinel enters the plan.
const bindingSlotMember = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  slot: ClaimSourceOperatorBinding["slots"][number],
  charge: (amount: number) => boolean
): number =>
  slot.kind === "gap" ? (Str.trim(slot.extent.quote) === "" ? -1 : 0) : bindingMember(plan, binding, slot, charge);
const bindingMemberEnd = (
  binding: ClaimSourceOperatorBinding,
  cursor: number,
  members: HashSet.HashSet<number>,
  charge: (amount: number) => boolean
): boolean => cursor === binding.operator.endChar && charge(HashSet.size(members) + binding.slots.length + 5);
const validatedBindingMembers = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  charge: (amount: number) => boolean
): O.Option<HashSet.HashSet<number>> => {
  let cursor = binding.operator.startChar;
  let members = HashSet.empty<number>();
  for (const slot of binding.slots) {
    if (!bindingSlotGeometry(plan, slot, cursor, charge)) return O.none();
    cursor = slot.extent.endChar;
    const member = bindingSlotMember(plan, binding, slot, charge);
    if (member === 0) return O.none();
    if (member > 0) members = HashSet.add(members, member);
  }
  if (!bindingMemberEnd(binding, cursor, members, charge)) return O.none();
  return O.some(members);
};
const validateOperatorBinding = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  charge: (amount: number) => boolean
): boolean => {
  const frame = A.get(plan.frames, binding.frame - 1);
  if (
    O.isNone(frame) ||
    !charge(frame.value.predicates.length + binding.slots.length * 6 + binding.operator.quote.length * 2 + 4) ||
    !A.some(frame.value.predicates, (op) => sameAnchor(op, binding.operator))
  )
    return false;
  const members = validatedBindingMembers(plan, binding, charge);
  return O.isSome(members) && validateBindingHead(plan, binding, members.value);
};

const privateSelectionMember = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  core: TextAnchor,
  owner: O.Option<ClaimFiniteSourceProof>,
  charge: (amount: number) => boolean
): boolean => sourceSelectionFrameMember(frame, A.get(plan.elements, frame.publicOwner - 1), core, owner, charge);
const sourceFrameStep = (
  ordinal: number,
  previous: number,
  depth: number,
  charge: (amount: number) => boolean
): boolean => depth <= 128 && charge(3) && ordinal < previous;
const sourceFrameAncestor = (
  plan: ClaimSourceElementPlan,
  ancestor: number,
  descendant: ClaimSourceFrame,
  charge: (amount: number) => boolean
): boolean => {
  if (ancestor === descendant.ordinal) return true;
  let current = descendant.parent;
  let previous = descendant.ordinal;
  let depth = 0;
  while (O.isSome(current)) {
    if (!sourceFrameStep(current.value, previous, ++depth, charge)) return false;
    if (current.value === ancestor) return true;
    const frame = A.get(plan.frames, current.value - 1);
    if (O.isNone(frame)) return false;
    previous = current.value;
    current = frame.value.parent;
  }
  return false;
};
const privateSelectionIdentity = (
  argument: Extract<ClaimPrivateFrameArgument, { readonly kind: "selection" }>,
  certificate: Extract<ClaimFiniteSourceProof, { readonly kind: "selection" }>,
  selection: ClaimSourceElementPlan["roles"]["opaqueSelections"][number]
): boolean =>
  argument.group.slot === "core" &&
  argument.group.ordinal === selection.group.ordinal &&
  sameAnchor(argument.marker, selection.operator) &&
  O.getOrNull(O.map(argument.owner, (ref) => ref.ordinal)) ===
    O.getOrNull(O.map(certificate.owner, (ref) => ref.ordinal)) &&
  !(O.isSome(argument.owner) && argument.owner.value.slot !== "core");
const privateSelectionAncestors = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  core: TextAnchor,
  owner: O.Option<ClaimFiniteSourceProof>,
  charge: (amount: number) => boolean
): boolean => {
  for (const other of plan.frames)
    if (
      privateSelectionMember(plan, other, core, owner, charge) &&
      !sourceFrameAncestor(plan, other.ordinal, frame, charge)
    )
      return false;
  return true;
};
const validatePrivateSelection = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  argument: Extract<ClaimPrivateFrameArgument, { readonly kind: "selection" }>,
  certificate: Extract<ClaimFiniteSourceProof, { readonly kind: "selection" }>,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.roles.opaqueSelections.length + plan.frames.length + 6)) return false;
  const selection = A.findFirst(plan.roles.opaqueSelections, (s) => s.proof.ordinal === argument.certificate.ordinal);
  const owner = O.flatMap(certificate.owner, (ref) => proofAt(plan, ref));
  if (
    O.isNone(selection) ||
    !privateSelectionIdentity(argument, certificate, selection.value) ||
    !privateSelectionMember(plan, frame, selection.value.core, owner, charge)
  )
    return false;
  if (!privateSelectionAncestors(plan, frame, selection.value.core, owner, charge)) return false;
  return charge(0);
};
type PrivateCandidate = ClaimSourceElementPlan["roles"]["privateCandidates"][number];
type PrivateArgument = ClaimSourceFrame["privateArguments"][number];
type PrivateCertificate = Extract<ClaimFiniteSourceProof, { readonly kind: "description" | "selection" }>;
const privateCandidateHead = (candidate: PrivateCandidate, seed: O.Option<ClaimFiniteSourceProof>): boolean =>
  O.exists(
    seed,
    (proof) => proof.kind === "head" && sameAnchor(proof.core, candidate.core) && sameAnchor(proof.head, candidate.head)
  );
const privateCertificateMember = (certificate: PrivateCertificate, argument: PrivateArgument): boolean =>
  certificate.kind === "description"
    ? certificate.candidate.ordinal === argument.candidate.ordinal
    : A.some(certificate.branches, (ref) => ref.ordinal === argument.candidate.ordinal);
const privateDescriptionBinding = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  argument: Extract<PrivateArgument, { readonly kind: "predicate" }>,
  source: Extract<PrivateCertificate, { readonly kind: "description" }>,
  charge: (amount: number) => boolean
): boolean => {
  const binding = A.findFirst(
    plan.operatorBindings,
    (b) => b.frame === frame.ordinal && sameAnchor(b.operator, argument.predicate)
  );
  if (O.isNone(binding) || !charge(binding.value.slots.length + 2)) return false;
  return A.some(
    binding.value.slots,
    (slot) => slot.kind !== "gap" && slot.certificate.ordinal === source.operator.ordinal
  );
};
const privateCandidateMatches = (
  candidate: O.Option<PrivateCandidate>,
  argument: PrivateArgument
): candidate is O.Some<PrivateCandidate> =>
  O.isSome(candidate) && candidate.value.origin === argument.origin && sameAnchor(candidate.value.core, argument.core);
const isPrivateCertificate = (
  certificate: O.Option<ClaimFiniteSourceProof>
): certificate is O.Some<PrivateCertificate> =>
  O.isSome(certificate) && (certificate.value.kind === "description" || certificate.value.kind === "selection");
const privateDescriptionSource = (
  source: PrivateCertificate,
  candidate: PrivateCandidate
): source is Extract<PrivateCertificate, { readonly kind: "description" }> =>
  source.kind === "description" && candidate.origin === "description";
const privateSelectionArgument = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  argument: Extract<PrivateArgument, { readonly kind: "selection" }>,
  source: PrivateCertificate,
  charge: (amount: number) => boolean
): boolean => source.kind === "selection" && validatePrivateSelection(plan, frame, argument, source, charge);
const validatePrivateArgument = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  argument: PrivateArgument,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.roles.privateCandidates.length + plan.operatorBindings.length + frame.predicates.length + 4))
    return false;
  const candidate = A.findFirst(
    plan.roles.privateCandidates,
    (c) => c.seed.ordinal === argument.candidate.ordinal && c.certificate.ordinal === argument.certificate.ordinal
  );
  if (!privateCandidateMatches(candidate, argument)) return false;
  const seed = proofAt(plan, candidate.value.seed);
  const certificate = proofAt(plan, candidate.value.certificate);
  if (!privateCandidateHead(candidate.value, seed) || !isPrivateCertificate(certificate)) return false;
  const source = certificate.value;
  if (!privateCertificateMember(source, argument)) return false;
  if (argument.kind === "selection") return privateSelectionArgument(plan, frame, argument, source, charge);
  if (!privateDescriptionSource(source, candidate.value)) return false;
  return privateDescriptionBinding(plan, frame, argument, source, charge);
};
type OpaqueSelectionRecord = ClaimSourceElementPlan["roles"]["opaqueSelections"][number];
type OpaqueSelectionProof = Extract<ClaimFiniteSourceProof, { readonly kind: "selection" }>;
type OpaqueCoreProof = Extract<ClaimFiniteSourceProof, { readonly kind: "opaque-core" }>;
const opaqueSelectionShape = (
  selection: OpaqueSelectionRecord,
  proof: OpaqueSelectionProof,
  group: OpaqueCoreProof
): boolean =>
  group.selection.ordinal === proof.ordinal &&
  sameAnchor(group.core, selection.core) &&
  sameAnchor(group.head, selection.head) &&
  sameAnchor(selection.core, selection.head) &&
  sameAnchor(proof.content, selection.core) &&
  proof.branches.length === selection.branches.length;
const opaqueSelectionSelectors = (
  plan: ClaimSourceElementPlan,
  selection: OpaqueSelectionRecord,
  proof: OpaqueSelectionProof,
  charge: (amount: number) => boolean
): boolean => {
  const first = O.flatMap(A.head(proof.selector), (ref) => proofAt(plan, ref));
  const last = O.flatMap(A.last(proof.selector), (ref) => proofAt(plan, ref));
  return (
    O.exists(first, (p) => p.kind === "token" && p.token.anchor.startChar === selection.operator.startChar) &&
    O.exists(last, (p) => p.kind === "token" && p.token.anchor.endChar === selection.operator.endChar) &&
    sourceAnchor(plan, selection.operator, charge)
  );
};
const opaqueBranchCandidateEqual = (
  candidate: ClaimSourceElementPlan["roles"]["privateCandidates"][number],
  branch: ClaimSourceElementPlan["roles"]["privateCandidates"][number]
): boolean =>
  candidate.origin === "opaque-branch" &&
  candidate.seed.ordinal === branch.seed.ordinal &&
  candidate.certificate.ordinal === branch.certificate.ordinal &&
  sameAnchor(candidate.core, branch.core) &&
  sameAnchor(candidate.head, branch.head) &&
  sameAnchor(candidate.outer, branch.outer);
const opaqueSelectionBranchValid = (
  plan: ClaimSourceElementPlan,
  selection: OpaqueSelectionRecord,
  proof: OpaqueSelectionProof,
  index: number
): boolean => {
  const branch = O.getOrThrow(A.get(selection.branches, index));
  return (
    branch.origin === "opaque-branch" &&
    branch.certificate.ordinal === selection.proof.ordinal &&
    O.exists(A.get(proof.branches, index), (ref) => ref.ordinal === branch.seed.ordinal) &&
    A.some(plan.roles.privateCandidates, (candidate) => opaqueBranchCandidateEqual(candidate, branch))
  );
};
const opaqueSelectionBranchesValid = (
  plan: ClaimSourceElementPlan,
  selection: OpaqueSelectionRecord,
  proof: OpaqueSelectionProof
): boolean => {
  for (let i = 0; i < selection.branches.length; i++)
    if (!opaqueSelectionBranchValid(plan, selection, proof, i)) return false;
  return true;
};
const validateOpaqueSelection = (
  plan: ClaimSourceElementPlan,
  selection: OpaqueSelectionRecord,
  charge: (amount: number) => boolean
): boolean => {
  const proof = proofAt(plan, selection.proof);
  const group = proofAt(plan, selection.group);
  if (O.isNone(proof) || proof.value.kind !== "selection" || O.isNone(group) || group.value.kind !== "opaque-core")
    return false;
  if (!opaqueSelectionShape(selection, proof.value, group.value)) return false;
  if (!opaqueSelectionSelectors(plan, selection, proof.value, charge)) return false;
  return opaqueSelectionBranchesValid(plan, selection, proof.value);
};
const validateOpaqueSelections = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (!charge(plan.roles.certificates.length + plan.roles.opaqueSelections.length + 2)) return false;
  if (A.countBy(plan.roles.certificates, (p) => p.kind === "opaque-core") !== plan.roles.opaqueSelections.length)
    return false;
  let seen = HashSet.empty<number>();
  for (const selection of plan.roles.opaqueSelections) {
    if (
      !charge(
        selection.branches.length * (plan.roles.privateCandidates.length + 5) +
          selection.operator.quote.length +
          selection.core.quote.length * 2 +
          10
      ) ||
      HashSet.has(seen, selection.group.ordinal)
    )
      return false;
    seen = HashSet.add(seen, selection.group.ordinal);
    if (!validateOpaqueSelection(plan, selection, charge)) return false;
  }
  return true;
};
const validatedPrivateFrame = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  seen: HashSet.HashSet<number>,
  charge: (amount: number) => boolean
): HashSet.HashSet<number> | false => {
  if (!charge(frame.privateArguments.length * 3 + 1)) return false;
  for (const argument of frame.privateArguments) {
    if (HashSet.has(seen, argument.candidate.ordinal) || !validatePrivateArgument(plan, frame, argument, charge))
      return false;
    seen = HashSet.add(seen, argument.candidate.ordinal);
  }
  return seen;
};
const validatePrivateAndOperators = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (!charge(plan.operatorBindings.length + plan.roles.privateCandidates.length + plan.frames.length + 4))
    return false;
  if (
    !A.every(plan.operatorBindings, (b) => validateOperatorBinding(plan, b, charge)) ||
    !validateOpaqueSelections(plan, charge)
  )
    return false;
  let seen = HashSet.empty<number>();
  for (const frame of plan.frames) {
    const next = validatedPrivateFrame(plan, frame, seen, charge);
    if (next === false) return false;
    seen = next;
  }
  return (
    charge(plan.roles.privateCandidates.length + 1) &&
    A.every(plan.roles.privateCandidates, (candidate) => HashSet.has(seen, candidate.seed.ordinal))
  );
};
const qualifiedHeaderFrame = (frame: ClaimSourceFrame): boolean =>
  frame.attachment === "main" &&
  O.isNone(frame.parent) &&
  frame.predicates.length === 0 &&
  O.isNone(frame.subject) &&
  O.isNone(frame.sharedSubject) &&
  O.isNone(frame.coordination) &&
  O.isNone(frame.introducer);
const qualifiedHeaderOwner = (owner: ClaimPlannedElement, frame: ClaimSourceFrame): boolean =>
  owner.grouping === "preamble" &&
  owner.kind === "preamble-subject" &&
  O.isNone(owner.parent) &&
  sameAnchor(owner.extent, frame.extent) &&
  sameAnchor(owner.lexicalHeader, frame.lexicalHeader);
const qualifiedHeaderArguments = (
  frame: ClaimSourceFrame,
  core: ClaimAttachedNominal
): Array<readonly [ClaimFrameArgument, number]> => {
  const candidates: Array<readonly [ClaimFrameArgument, number]> = [];
  for (let index = 0; index < frame.arguments.length; index++) {
    const argument = O.getOrThrow(A.get(frame.arguments, index));
    if (
      argument.role === "unknown" &&
      O.isNone(argument.predicate) &&
      O.isNone(argument.ownerNominal) &&
      sameAnchor(argument.nominal, core.core)
    )
      candidates.push([argument, index + 1]);
  }
  return candidates;
};
const finishQualifiedHeaderMembership = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  element: ClaimPlannedElement,
  scope: ClaimFiniteSourceProof,
  core: ClaimAttachedNominal,
  charge: (amount: number) => boolean
): O.Option<ClaimQualifiedHeaderMembership> => {
  const region = A.findFirst(
    element.ownedTermRegions,
    (r) =>
      sameAnchor(r.extent, core.core) &&
      r.certificate.kind === "existing-element-nominal" &&
      r.certificate.production === "preamble" &&
      sameAnchor(r.certificate.lexicalRegion, element.lexicalHeader)
  );
  const state = A.findFirst(
    plan.roles.candidateStates,
    (state) =>
      state.kind === "proved" &&
      state.use === "public" &&
      sameAnchor(state.nominal.anchor, core.core) &&
      sameAnchor(state.nominal.head, core.head)
  );
  if (O.isNone(region) || O.isNone(state) || state.value.kind !== "proved") return O.none();
  const seed = proofAt(plan, state.value.proof);
  if (!O.exists(seed, (p) => p.kind === "head" && sameAnchor(p.core, core.core) && sameAnchor(p.head, core.head)))
    return O.none();
  const candidates = qualifiedHeaderArguments(frame, core);
  if (candidates.length !== 1 || !charge(12)) return O.none();
  const [argument, ordinal] = O.getOrThrow(A.head(candidates));
  return O.some(
    ClaimQualifiedHeaderMembership.make({
      qualifiedText: plan.qualifiedText,
      frame: frame.ordinal,
      owner: element.ordinal,
      scope: ClaimSourceProofRef.make({ ordinal: scope.ordinal, slot: "scope" }),
      proof: state.value.proof,
      core: core.core,
      head: core.head,
      header: frame.lexicalHeader,
      region: region.value.ordinal,
      construction: region.value.certificate,
      rawOrdinal: ordinal,
      argument,
    })
  );
};
const qualifiedHeaderMembership = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): O.Option<ClaimQualifiedHeaderMembership> => {
  if (!charge(1)) return O.none();
  if (!qualifiedHeaderFrame(frame)) return O.none();
  if (
    !charge(
      plan.roles.certificates.length + plan.nominals.length + frame.arguments.length * 2 + plan.elements.length + 8
    )
  )
    return O.none();
  const owner = A.get(plan.elements, frame.publicOwner - 1);
  if (O.isNone(owner) || !qualifiedHeaderOwner(owner.value, frame)) return O.none();
  const element = owner.value;
  const scope = A.findFirst(
    plan.roles.certificates,
    (p) => p.kind === "scope" && p.role === "preamble" && sameAnchor(p.extent, frame.extent)
  );
  const core = A.findFirst(plan.nominals, (n) => sameAnchor(n.core, frame.lexicalHeader));
  if (
    O.isNone(scope) ||
    O.isNone(core) ||
    !charge(element.ownedTermRegions.length + plan.roles.candidateStates.length + 8)
  )
    return O.none();
  return finishQualifiedHeaderMembership(plan, frame, element, scope.value, core.value, charge);
};

const headerMembershipEqual = S.toEquivalence(ClaimQualifiedHeaderMembership);
const storedHeaderMembership = (
  plan: ClaimSourceElementPlan,
  derived: O.Option<ClaimQualifiedHeaderMembership>,
  stored: ReadonlyArray<ClaimQualifiedHeaderMembership>,
  charge: (amount: number) => boolean
): boolean => {
  if (O.isNone(derived)) return stored.length === 0;
  return (
    stored.length === 1 &&
    charge(plan.qualifiedText.length + 12) &&
    headerMembershipEqual(derived.value, O.getOrThrow(A.head(stored)))
  );
};
const validateHeaderMemberships = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (!charge(plan.frames.length + plan.headerMemberships.length * (plan.frames.length + 2) + 2)) return false;
  let count = 0;
  for (const frame of plan.frames) {
    const derived = qualifiedHeaderMembership(plan, frame, charge);
    const stored = A.filter(plan.headerMemberships, (record) => record.frame === frame.ordinal);
    if (!storedHeaderMembership(plan, derived, stored, charge)) return false;
    count += stored.length;
  }
  return count === plan.headerMemberships.length;
};
const appendFrameLexicalSlots = (binding: ClaimSourceOperatorBinding, predicates: Array<TextAnchor>): void => {
  for (const slot of binding.slots) if (slot.kind === "lexical") predicates.push(slot.extent);
};
const frameLexicalBindingsValid = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  bindings: ReadonlyArray<ClaimSourceOperatorBinding>,
  charge: (amount: number) => boolean
): boolean =>
  bindings.length === frame.predicates.length && A.every(bindings, (b) => validateOperatorBinding(plan, b, charge));
const boundFrameHeadToken = (
  plan: ClaimSourceElementPlan,
  binding: O.Option<ClaimSourceOperatorBinding>
): O.Option<TextAnchor> => {
  const head = O.flatMap(binding, (b) => b.head);
  return O.flatMap(head, (h) => bindingToken(plan, h.token));
};
const appendFrameLexicalArgument = (
  plan: ClaimSourceElementPlan,
  bindings: ReadonlyArray<ClaimSourceOperatorBinding>,
  argument: ClaimFrameArgument,
  arguments_: Array<ClaimFrameArgument>
): boolean => {
  if (O.isNone(argument.predicate)) {
    arguments_.push(argument);
    return true;
  }
  const binding = A.findFirst(bindings, (b) =>
    O.exists(argument.predicate, (operator) => sameAnchor(operator, b.operator))
  );
  const token = boundFrameHeadToken(plan, binding);
  if (O.isNone(token)) return false;
  arguments_.push(ClaimFrameArgument.make({ ...argument, predicate: token }));
  return true;
};
const frameLexicalPredicates = (
  bindings: ReadonlyArray<ClaimSourceOperatorBinding>,
  frame: ClaimSourceFrame,
  predicates: Array<TextAnchor>,
  charge: (amount: number) => boolean
): boolean => {
  for (let i = 0; i < bindings.length; i++) {
    const binding = O.getOrThrow(A.get(bindings, i));
    if (
      !O.exists(A.get(frame.predicates, i), (op) => sameAnchor(op, binding.operator)) ||
      !charge(binding.slots.length + 1)
    )
      return false;
    appendFrameLexicalSlots(binding, predicates);
  }
  return true;
};
const frameLexicalHeaderMatches = (
  stored: O.Option<ClaimQualifiedHeaderMembership>,
  derived: O.Option<ClaimQualifiedHeaderMembership>
): boolean =>
  O.isSome(stored) === O.isSome(derived) &&
  !(O.isSome(stored) && O.isSome(derived) && !headerMembershipEqual(stored.value, derived.value));
const frameLexicalArguments = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  bindings: ReadonlyArray<ClaimSourceOperatorBinding>,
  headerMembership: O.Option<ClaimQualifiedHeaderMembership>,
  arguments_: Array<ClaimFrameArgument>,
  sourceArgumentOrdinals: Array<number>,
  charge: (amount: number) => boolean
): boolean => {
  for (let index = 0; index < frame.arguments.length; index++) {
    const argument = O.getOrThrow(A.get(frame.arguments, index));
    if (O.exists(headerMembership, (record) => record.rawOrdinal === index + 1)) continue;
    sourceArgumentOrdinals.push(index + 1);
    if (!charge(bindings.length + 2)) return false;
    if (!appendFrameLexicalArgument(plan, bindings, argument, arguments_)) return false;
  }
  return true;
};
const frameLexicalPrivateArguments = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  bindings: ReadonlyArray<ClaimSourceOperatorBinding>,
  privateArguments: Array<ClaimPrivateFrameArgument>
): boolean => {
  for (const argument of frame.privateArguments) {
    if (argument.kind === "selection") {
      privateArguments.push(argument);
      continue;
    }
    const binding = A.findFirst(bindings, (b) => sameAnchor(b.operator, argument.predicate));
    const token = boundFrameHeadToken(plan, binding);
    if (O.isNone(token)) return false;
    privateArguments.push(ClaimPrivateFrameArgument.cases.predicate.make({ ...argument, predicate: token.value }));
  }
  return true;
};
const frameLexicalView = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): O.Option<ClaimFrameLexicalView> => {
  if (!charge(plan.operatorBindings.length + frame.predicates.length + frame.arguments.length + 4)) return O.none();
  const bindings = A.filter(plan.operatorBindings, (b) => b.frame === frame.ordinal);
  if (!frameLexicalBindingsValid(plan, frame, bindings, charge)) return O.none();
  const predicates: Array<TextAnchor> = [];
  if (!frameLexicalPredicates(bindings, frame, predicates, charge)) return O.none();
  if (!charge(plan.headerMemberships.length + frame.arguments.length + 2)) return O.none();
  const headerMembership = A.findFirst(plan.headerMemberships, (record) => record.frame === frame.ordinal);
  const derivedHeader = qualifiedHeaderMembership(plan, frame, charge);
  if (!frameLexicalHeaderMatches(headerMembership, derivedHeader)) return O.none();
  const arguments_: Array<ClaimFrameArgument> = [];
  const sourceArgumentOrdinals: Array<number> = [];
  if (!frameLexicalArguments(plan, frame, bindings, headerMembership, arguments_, sourceArgumentOrdinals, charge))
    return O.none();
  if (!charge(frame.privateArguments.length * (bindings.length + 4))) return O.none();
  const privateArguments: Array<ClaimPrivateFrameArgument> = [];
  if (!frameLexicalPrivateArguments(plan, frame, bindings, privateArguments)) return O.none();
  return O.some(
    ClaimFrameLexicalView.make({
      frame: frame.ordinal,
      predicates,
      arguments: arguments_,
      privateArguments,
      sourceArgumentOrdinals,
      headerMembership,
    })
  );
};
const completeCitationWitness = (
  plan: ClaimSourceElementPlan,
  exclusion: Extract<ClaimSourceExclusion, { readonly kind: "dependency-citation" }>,
  witness: ClaimCitationWitness,
  charge: (amount: number) => boolean
): boolean =>
  validateClaimCitationWitness(
    plan.qualifiedText,
    plan.roles.certificates,
    exclusion.extent,
    exclusion.claimReferences,
    witness,
    charge
  );

const positiveCandidateExclusion = (
  plan: ClaimSourceElementPlan,
  exclusion: ClaimSourceExclusion,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(2)) return false;
  if (exclusion.kind === "quoted-protection") return false;
  if (exclusion.kind === "dependency-citation")
    return O.exists(exclusion.witness, (witness) => completeCitationWitness(plan, exclusion, witness, charge));
  if (exclusion.kind === "declaration-metadata") {
    if (!charge(plan.declarations.length + 1)) return false;
    return A.some(
      plan.declarations,
      (declaration) =>
        charge(declaration.items.length + 1) &&
        declaration.owner === exclusion.owner &&
        A.some(declaration.items, (item) => sameAnchor(item.label, exclusion.extent))
    );
  }
  if (!charge(plan.roles.certificates.length + exclusion.extent.quote.length + 2)) return false;
  const preamble = A.findFirst(plan.roles.certificates, (p) => p.kind === "scope" && p.role === "preamble");
  const body = A.findFirst(plan.roles.certificates, (p) => p.kind === "scope" && p.role === "body");
  return (
    O.exists(
      preamble,
      (p) =>
        p.kind === "scope" &&
        sameAnchor(p.extent, exclusion.preamble) &&
        exclusion.extent.startChar === p.extent.endChar
    ) &&
    O.exists(
      body,
      (p) =>
        p.kind === "scope" && sameAnchor(p.extent, exclusion.body) && exclusion.extent.endChar === p.extent.startChar
    ) &&
    sourceAnchor(plan, exclusion.extent, charge)
  );
};
type CandidateState = ClaimSourceElementPlan["roles"]["candidateStates"][number];
type ProvedCandidate = Extract<CandidateState, { readonly kind: "proved" }>;
const candidateProofMatches = (state: ProvedCandidate, proof: O.Option<ClaimFiniteSourceProof>): boolean =>
  O.exists(
    proof,
    (p) =>
      (p.kind === "head" || p.kind === "opaque-core") &&
      (state.use === "opaque" ? p.kind === "opaque-core" : p.kind === "head") &&
      sameAnchor(p.core, state.nominal.anchor) &&
      sameAnchor(p.head, state.nominal.head)
  );
class CandidateCommitValidator {
  private readonly plan: ClaimSourceElementPlan;
  private readonly charge: (amount: number) => boolean;
  private readonly publicSeen: Array<boolean>;
  private privateSeen: HashSet.HashSet<number>;
  private readonly positive: Array<O.Option<boolean>>;
  constructor(plan: ClaimSourceElementPlan, charge: (amount: number) => boolean) {
    this.plan = plan;
    this.charge = charge;
    this.publicSeen = A.replicate(false, plan.nominals.length);
    this.privateSeen = HashSet.empty<number>();
    this.positive = A.replicate(O.none<boolean>(), plan.sourceExclusions.length);
  }
  private positiveExclusion(index: number, value: ClaimSourceExclusion): boolean {
    let result = O.getOrThrow(A.get(this.positive, index));
    if (O.isNone(result)) {
      result = O.some(positiveCandidateExclusion(this.plan, value, this.charge));
      this.positive[index] = result;
    }
    return O.contains(result, true);
  }
  private excluded(state: CandidateState): boolean {
    for (let i = 0; i < this.plan.sourceExclusions.length; i++) {
      if (!this.charge(3)) return false;
      const value = O.getOrThrow(A.get(this.plan.sourceExclusions, i));
      if (!contains(value.extent, state.nominal.anchor)) continue;
      if (this.positiveExclusion(i, value)) return true;
    }
    return false;
  }
  private publicCandidate(state: ProvedCandidate, index: O.Option<number>): boolean {
    if (O.isNone(index)) return this.excluded(state);
    if (O.getOrElse(A.get(this.publicSeen, index.value), () => true)) return false;
    this.publicSeen[index.value] = true;
    return true;
  }
  private privateCandidate(state: ProvedCandidate, index: O.Option<number>): boolean {
    if (
      !this.charge(this.plan.roles.privateCandidates.length + 4) ||
      O.isSome(index) ||
      HashSet.has(this.privateSeen, state.proof.ordinal) ||
      !A.some(
        this.plan.roles.privateCandidates,
        (candidate) =>
          candidate.seed.ordinal === state.proof.ordinal &&
          candidate.origin === (state.use === "description" ? "description" : "opaque-branch") &&
          sameAnchor(candidate.core, state.nominal.anchor)
      )
    )
      return false;
    this.privateSeen = HashSet.add(this.privateSeen, state.proof.ordinal);
    return true;
  }
  private candidate(state: CandidateState): boolean {
    const index = coreIndex(this.plan, state.nominal.anchor, this.charge);
    if (state.kind === "unproved") return this.excluded(state) && O.isNone(index);
    const proof = proofAt(this.plan, state.proof);
    if (!candidateProofMatches(state, proof)) return false;
    return state.use === "public" || state.use === "opaque"
      ? this.publicCandidate(state, index)
      : this.privateCandidate(state, index);
  }
  run(): boolean {
    for (const state of this.plan.roles.candidateStates) if (!this.candidate(state)) return false;
    return (
      this.charge(this.publicSeen.length + 1) &&
      A.every(this.publicSeen, (seen) => seen) &&
      HashSet.size(this.privateSeen) === this.plan.roles.privateCandidates.length
    );
  }
}
const emptyCandidateCommit = (plan: ClaimSourceElementPlan): boolean =>
  plan.roles.stage === "candidates" &&
  O.isNone(plan.roles.qualifiedClaim) &&
  plan.roles.candidateStates.length === 0 &&
  plan.roles.privateCandidates.length === 0 &&
  plan.roles.opaqueSelections.length === 0;
const validateCandidateCommit = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (plan.roles.certificates.length === 0) return emptyCandidateCommit(plan);
  // Six added state/object slots are reserved before this source-local validator allocation.
  if (!charge(plan.roles.candidateStates.length * 2 + plan.sourceExclusions.length + plan.nominals.length * 2 + 8))
    return false;
  return new CandidateCommitValidator(plan, charge).run();
};
const frameIntroducerLicensed = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(2) || O.isNone(frame.introducer)) return false;
  if (frame.attachment !== "main") return true;
  if (!charge(plan.roles.clauses.length + plan.declarationPlans.length + 2)) return false;
  const intro = frame.introducer.value;
  return (
    (HashSet.has(HashSet.make("where", "wherein"), Str.toLowerCase(intro.quote)) &&
      A.some(
        plan.roles.clauses,
        (clause) =>
          clause.kind === "relative" &&
          O.exists(clause.introducer, (anchor) => sameAnchor(anchor, intro)) &&
          clause.anchor.startChar === frame.extent.startChar &&
          contains(clause.anchor, frame.extent)
      )) ||
    A.some(
      plan.declarationPlans,
      (declaration) =>
        declaration.frame === frame.ordinal && declaration.owner === frame.publicOwner && declaration.kind === "action"
    )
  );
};
type RawControlToken = Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>;
const tokenControlArgumentIntroTail = (
  plan: ClaimSourceElementPlan,
  token: RawControlToken,
  argument: ClaimFrameArgument,
  governed: boolean
): boolean => {
  const next = A.get(plan.roles.certificates, token.ordinal);
  return (
    O.exists(
      next,
      (p) =>
        p.kind === "token" &&
        p.tokenOrdinal === token.tokenOrdinal + 1 &&
        p.token.anchor.startChar === argument.nominal.startChar
    ) &&
    Str.trim(Str.slice(token.token.anchor.endChar, argument.nominal.startChar)(plan.qualifiedText)) === "" &&
    (governed
      ? O.match(argument.predicate, { onNone: () => true, onSome: (p) => p.endChar <= token.token.anchor.startChar })
      : O.exists(argument.ownerNominal, (n) => n.endChar <= token.token.anchor.startChar))
  );
};
const tokenControlArgumentIntro = (
  plan: ClaimSourceElementPlan,
  token: RawControlToken,
  argument: ClaimFrameArgument,
  charge: (amount: number) => boolean
): boolean => {
  const governed = argument.role === "prepositional-complement" && O.isNone(argument.ownerNominal);
  const modifier =
    argument.role === "nominal-modifier" && O.isSome(argument.ownerNominal) && O.isNone(argument.predicate);
  if (
    (!governed && !modifier) ||
    token.token.pos !== "ADP" ||
    argument.nominal.startChar < token.token.anchor.endChar ||
    !charge(argument.nominal.startChar - token.token.anchor.endChar + 3)
  )
    return false;
  return tokenControlArgumentIntroTail(plan, token, argument, governed);
};
const tokenControlFramePair = (
  token: RawControlToken,
  left: ClaimSourceFrame,
  right: ClaimSourceFrame,
  before: O.Option<ClaimFiniteSourceProof>,
  next: O.Option<ClaimFiniteSourceProof>
): boolean =>
  O.isSome(left.parent) &&
  O.contains(right.parent, left.parent.value) &&
  left.publicOwner === right.publicOwner &&
  O.exists(
    before,
    (p) =>
      p.kind === "token" && p.tokenOrdinal + 1 === token.tokenOrdinal && p.token.anchor.endChar === left.extent.endChar
  ) &&
  O.exists(
    next,
    (p) =>
      p.kind === "token" &&
      p.tokenOrdinal === token.tokenOrdinal + 1 &&
      p.token.anchor.startChar === right.extent.startChar
  );
const tokenControlInfinitive = (
  plan: ClaimSourceElementPlan,
  frame: ClaimSourceFrame,
  charge: (amount: number) => boolean
): boolean =>
  O.exists(
    frame.introducer,
    (intro) => intro.startChar === frame.extent.startChar && Str.toLowerCase(intro.quote) === "to"
  ) &&
  charge(plan.operatorBindings.length + 1) &&
  A.some(
    plan.operatorBindings,
    (b) =>
      b.frame === frame.ordinal &&
      charge(b.slots.length + 1) &&
      A.some(
        b.slots,
        (slot) =>
          slot.kind === "lexical" &&
          O.exists(proofAt(plan, slot.certificate), (p) => p.kind === "operator" && p.mode === "infinitive")
      )
  );
const tokenControlAdjunctAt = (
  plan: ClaimSourceElementPlan,
  raw: RawControlToken,
  delta: number
): O.Option<RawControlToken> =>
  O.filter(
    A.get(plan.roles.certificates, raw.ordinal - 1 + delta),
    (candidate): candidate is RawControlToken =>
      candidate.kind === "token" && candidate.tokenOrdinal === raw.tokenOrdinal + delta
  );
const tokenControlAdjunctWord = (raw: RawControlToken): boolean =>
  raw.token.pos === "ADV" || HashSet.has(HashSet.make("not", "n't"), Str.toLowerCase(raw.token.anchor.quote));
const tokenControlAdjunctEdge = (
  plan: ClaimSourceElementPlan,
  raw: RawControlToken,
  direction: number,
  charge: (amount: number) => boolean
): number => {
  let delta = direction;
  while (O.exists(tokenControlAdjunctAt(plan, raw, delta), tokenControlAdjunctWord)) {
    if (!charge(3)) return 0;
    delta += direction;
  }
  return delta;
};
const tokenControlDiscourse = (plan: ClaimSourceElementPlan, raw: RawControlToken): boolean => {
  const before = A.get(plan.roles.certificates, raw.ordinal - 2);
  const after = A.get(plan.roles.certificates, raw.ordinal);
  return (
    O.exists(
      before,
      (b) =>
        b.kind === "token" && b.tokenOrdinal + 1 === raw.tokenOrdinal && Str.toLowerCase(b.token.anchor.quote) === "in"
    ) &&
    Str.toLowerCase(raw.token.anchor.quote) === "response" &&
    O.exists(
      after,
      (a) =>
        a.kind === "token" &&
        a.tokenOrdinal === raw.tokenOrdinal + 1 &&
        HashSet.has(HashSet.make("to", ","), Str.toLowerCase(a.token.anchor.quote))
    )
  );
};
const tokenControlOrdinaryAdjunct = (
  plan: ClaimSourceElementPlan,
  raw: RawControlToken,
  evidence: Extract<ClaimSourceControlEvidence, { readonly kind: "role-adjunct" }>,
  ref: (candidate: ClaimSourceProofRef) => boolean,
  charge: (amount: number) => boolean
): boolean => {
  if (!ref(evidence.token) || !tokenControlAdjunctWord(raw)) return false;
  const left = tokenControlAdjunctEdge(plan, raw, -1, charge);
  if (left === 0) return false;
  const right = tokenControlAdjunctEdge(plan, raw, 1, charge);
  if (right === 0) return false;
  if (!charge(plan.operatorBindings.length * 2 + 6)) return false;
  return A.some(
    plan.operatorBindings,
    (binding) =>
      O.exists(tokenControlAdjunctAt(plan, raw, left), (token) => contains(binding.operator, token.token.anchor)) ||
      O.exists(tokenControlAdjunctAt(plan, raw, right), (token) => contains(binding.operator, token.token.anchor))
  );
};
const tokenControlRoleAdjunct = (
  plan: ClaimSourceElementPlan,
  token: RawControlToken,
  evidence: Extract<ClaimSourceControlEvidence, { readonly kind: "role-adjunct" }>,
  ref: (candidate: ClaimSourceProofRef) => boolean,
  charge: (amount: number) => boolean
): boolean => {
  const predicate = A.get(plan.roles.predicates, evidence.predicate - 1);
  const raw = proofAt(plan, evidence.token);
  if (!O.exists(predicate, (p) => p.kind === "adjunct") || O.isNone(raw) || raw.value.kind !== "token") return false;
  const p = raw.value;
  const role = O.getOrThrow(predicate);
  if (!sameAnchor(p.token.anchor, role.anchor)) return false;
  if (tokenControlDiscourse(plan, p))
    return token.tokenOrdinal >= p.tokenOrdinal - 1 && token.tokenOrdinal <= p.tokenOrdinal + 1;
  return tokenControlOrdinaryAdjunct(plan, p, evidence, ref, charge);
};
const coordinateControlWord = (token: RawControlToken): boolean =>
  HashSet.has(HashSet.make("and", "or"), Str.toLowerCase(token.token.anchor.quote));
const tokenControlMatches = (
  plan: ClaimSourceElementPlan,
  token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
  evidence: ClaimSourceControlEvidence,
  positiveExclusion: (ordinal: number) => boolean,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(4)) return false;
  const ref = (candidate: ClaimSourceProofRef): boolean =>
    candidate.slot === "token" && candidate.ordinal === token.ordinal;
  return ClaimSourceControlEvidence.match(evidence, {
    scope: (e) =>
      O.exists(
        proofAt(plan, e.proof),
        (p) => p.kind === "scope" && p.role === "transition" && contains(p.extent, token.token.anchor)
      ),
    "argument-link": (e) =>
      O.exists(proofAt(plan, e.proof), (p) =>
        p.kind === "ordered-arguments"
          ? ref(p.adposition)
          : p.kind === "description"
            ? ref(p.introducer)
            : p.kind === "selection" && (ref(p.linkage) || (charge(p.selector.length) && A.some(p.selector, ref)))
      ),
    opening: (e) =>
      O.exists(
        proofAt(plan, e.proof),
        (p) => p.kind === "opening" && p.mode === "preposition-object" && O.exists(A.head(p.evidence), ref)
      ),
    boundary: (e) =>
      O.exists(
        proofAt(plan, e.proof),
        (p) =>
          p.kind === "boundary" &&
          (ref(p.token) ||
            (p.mode === "reference-label" &&
              O.exists(
                O.flatMap(p.successor, (r) => proofAt(plan, r)),
                (last) =>
                  last.kind === "token" &&
                  O.exists(
                    proofAt(plan, p.token),
                    (first) =>
                      first.kind === "token" &&
                      first.tokenOrdinal <= token.tokenOrdinal &&
                      token.tokenOrdinal <= last.tokenOrdinal
                  )
              )))
      ),
    "operator-position": (e) =>
      O.exists(
        proofAt(plan, e.proof),
        (p) =>
          p.kind === "operator" &&
          p.mode === "infinitive" &&
          O.exists(p.position, ref) &&
          token.token.anchor.quote === "to" &&
          token.token.pos === "PART"
      ),
    "operator-adjunct": (e) =>
      O.exists(
        A.get(plan.operatorBindings, e.binding - 1),
        (binding) =>
          charge(binding.slots.length + 1) &&
          A.some(
            binding.slots,
            (slot) => slot.kind === "adjunct" && ref(slot.token) && slot.certificate.ordinal === e.certificate.ordinal
          )
      ),
    "argument-introducer": (e) =>
      O.exists(A.get(plan.frames, e.frame - 1), (frame) =>
        O.exists(A.get(frame.arguments, e.argument - 1), (argument) =>
          tokenControlArgumentIntro(plan, token, argument, charge)
        )
      ),
    "argument-coordinate": (e) =>
      O.exists(A.get(plan.frames, e.frame - 1), (frame) => {
        const left = A.get(frame.arguments, e.left - 1);
        const right = A.get(frame.arguments, e.right - 1);
        const next = A.get(plan.roles.certificates, token.ordinal);
        return (
          e.left < e.right &&
          coordinateControlWord(token) &&
          O.exists(
            left,
            (a) =>
              a.role === "object" &&
              a.nominal.endChar <= token.token.anchor.startChar &&
              O.exists(
                right,
                (b) =>
                  b.role === "object" &&
                  O.isSome(a.predicate) &&
                  O.exists(b.predicate, (p) => O.exists(a.predicate, (q) => sameAnchor(p, q))) &&
                  O.exists(
                    next,
                    (p) =>
                      p.kind === "token" &&
                      p.tokenOrdinal === token.tokenOrdinal + 1 &&
                      p.token.anchor.startChar === b.nominal.startChar
                  )
              )
          )
        );
      }),
    "operator-coordinate": (e) => {
      const left = A.get(plan.operatorBindings, e.left - 1);
      const right = A.get(plan.operatorBindings, e.right - 1);
      const next = A.get(plan.roles.certificates, token.ordinal);
      if (
        !coordinateControlWord(token) ||
        O.isNone(left) ||
        O.isNone(right) ||
        left.value.frame !== right.value.frame ||
        left.value.operator.endChar > token.token.anchor.startChar ||
        left.value.operator.startChar >= right.value.operator.startChar ||
        !O.exists(
          next,
          (p) =>
            p.kind === "token" &&
            p.tokenOrdinal === token.tokenOrdinal + 1 &&
            p.token.anchor.startChar === right.value.operator.startChar
        )
      )
        return false;
      const frame = A.get(plan.frames, left.value.frame - 1);
      return O.exists(
        frame,
        (f) =>
          charge(f.arguments.length + plan.operatorBindings.length + 2) &&
          O.isSome(f.subject) &&
          A.some(
            f.arguments,
            (a) =>
              a.role === "object" &&
              a.nominal.endChar <= token.token.anchor.startChar &&
              O.exists(a.predicate, (p) => sameAnchor(p, left.value.operator))
          ) &&
          !A.some(
            plan.operatorBindings,
            (b) =>
              b.frame === f.ordinal &&
              b.operator.startChar > left.value.operator.startChar &&
              b.operator.startChar < right.value.operator.startChar
          )
      );
    },
    "frame-coordinate": (e) => {
      const left = A.get(plan.frames, e.left - 1);
      const right = A.get(plan.frames, e.right - 1);
      const before = A.get(plan.roles.certificates, token.ordinal - 2);
      const next = A.get(plan.roles.certificates, token.ordinal);
      if (!coordinateControlWord(token) || O.isNone(left) || O.isNone(right)) return false;
      if (!tokenControlFramePair(token, left.value, right.value, before, next)) return false;
      return tokenControlInfinitive(plan, left.value, charge) && tokenControlInfinitive(plan, right.value, charge);
    },
    "element-coordinate": (e) => {
      if (!charge(plan.frames.length * 2 + 2)) return false;
      const left = A.get(plan.elements, e.left - 1);
      const right = A.get(plan.elements, e.right - 1);
      const next = A.get(plan.roles.certificates, token.ordinal);
      const independent = (owner: number): boolean =>
        A.some(
          plan.frames,
          (frame) =>
            frame.publicOwner === owner &&
            frame.attachment === "main" &&
            O.isSome(frame.subject) &&
            frame.predicates.length > 0
        );
      return (
        e.left < e.right &&
        coordinateControlWord(token) &&
        O.exists(
          left,
          (a) =>
            independent(a.ordinal) &&
            a.extent.endChar <= token.token.anchor.startChar &&
            O.exists(
              right,
              (b) =>
                b.grouping === "independent-coordinate" &&
                independent(b.ordinal) &&
                O.getOrNull(a.parent) === O.getOrNull(b.parent) &&
                O.exists(
                  next,
                  (p) =>
                    p.kind === "token" &&
                    p.tokenOrdinal === token.tokenOrdinal + 1 &&
                    p.token.anchor.startChar === b.extent.startChar
                )
            )
        )
      );
    },
    "role-adjunct": (e) => tokenControlRoleAdjunct(plan, token, e, ref, charge),
    "frame-introducer": (e) =>
      O.exists(
        A.get(plan.frames, e.frame - 1),
        (frame) =>
          frameIntroducerLicensed(plan, frame, charge) &&
          O.exists(frame.introducer, (intro) => contains(intro, token.token.anchor))
      ),
    exclusion: (e) =>
      O.exists(
        A.get(plan.sourceExclusions, e.exclusion - 1),
        (exclusion) =>
          contains(exclusion.extent, token.token.anchor) &&
          exclusion.kind !== "quoted-protection" &&
          positiveExclusion(e.exclusion)
      ),
    "declaration-gap": (e) =>
      O.exists(
        A.get(plan.declarationPlans, e.declaration - 1),
        (declaration) =>
          e.right === e.left + 1 &&
          O.exists(A.get(declaration.items, e.left - 1), (left) =>
            O.exists(
              A.get(declaration.items, e.right - 1),
              (right) =>
                left.extent.endChar <= token.token.anchor.startChar &&
                token.token.anchor.endChar <= right.extent.startChar
            )
          ) &&
          HashSet.has(HashSet.make("and", "or", ",", ";"), Str.toLowerCase(token.token.anchor.quote))
      ),
    punctuation: () =>
      token.token.pos === "PUNCT" &&
      HashSet.has(HashSet.make(".", ",", ";", ":", "(", ")", "[", "]"), token.token.anchor.quote),
  });
};
class SourceTokenOwnershipBuilder {
  private positions = HashMap.empty<number, number>();
  private owners = HashMap.empty<number, number>();
  private controls = HashMap.empty<number, ClaimSourceControlEvidence>();
  private predicates = HashMap.empty<number, ClaimSourceTokenOwnership>();
  private checkedExclusions = HashMap.empty<number, boolean>();
  private readonly plan: ClaimSourceElementPlan;
  private readonly charge: (amount: number) => boolean;
  private readonly raw: ReadonlyArray<Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>>;
  constructor(
    plan: ClaimSourceElementPlan,
    charge: (amount: number) => boolean,
    raw: ReadonlyArray<Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>>
  ) {
    this.plan = plan;
    this.charge = charge;
    this.raw = raw;
  }
  run(): O.Option<ReadonlyArray<ClaimSourceTokenOwnership>> {
    if (!this.charge(this.raw.length * 4 + 1)) return O.none();
    for (let i = 0; i < this.raw.length; i++)
      this.positions = HashMap.set(this.positions, O.getOrThrow(A.get(this.raw, i)).token.anchor.startChar, i);
    if (!this.leadingControls() || !this.trailingControls()) return O.none();
    return this.rows();
  }
  private leadingControls(): boolean {
    return (
      this.collectOwners() &&
      this.proofs() &&
      this.operatorSlots() &&
      this.operatorCoordinates() &&
      this.frameCoordinates()
    );
  }
  private trailingControls(): boolean {
    return (
      this.roleAdjuncts() &&
      this.elementCoordinates() &&
      this.frameArguments() &&
      this.exclusions() &&
      this.declarations()
    );
  }
  private readonly positiveExclusion = (ordinal: number): boolean => {
    if (!this.charge(3)) return false;
    const prior = HashMap.get(this.checkedExclusions, ordinal);
    if (O.isSome(prior)) return prior.value;
    const candidate = A.get(this.plan.sourceExclusions, ordinal - 1);
    const valid = O.exists(candidate, (e) => positiveCandidateExclusion(this.plan, e, this.charge));
    if (!this.charge(2)) return false;
    this.checkedExclusions = HashMap.set(this.checkedExclusions, ordinal, valid);
    return valid;
  };

  private readonly control = (ref: ClaimSourceProofRef, evidence: ClaimSourceControlEvidence): boolean => {
    if (!this.charge(6)) return false;
    const token = proofAt(this.plan, ref);
    if (O.isNone(token) || token.value.kind !== "token") return false;
    if (!HashMap.has(this.controls, token.value.ordinal))
      this.controls = HashMap.set(this.controls, token.value.ordinal, evidence);
    return true;
  };

  private lowerBound(startChar: number): number {
    return sourceLowerBound(this.raw, startChar, rawTokenSourceStart, this.charge);
  }
  private intervalFrom(start: number, extent: TextAnchor, evidence: ClaimSourceControlEvidence): boolean {
    for (let i = start; i < this.raw.length; i++) {
      if (!this.charge(3)) return false;
      const token = O.getOrThrow(A.get(this.raw, i));
      if (token.token.anchor.startChar >= extent.endChar) break;
      if (
        !contains(extent, token.token.anchor) ||
        !this.control(ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" }), evidence)
      )
        return false;
    }
    return true;
  }
  private readonly interval = (extent: TextAnchor, evidence: ClaimSourceControlEvidence): boolean => {
    if (!this.charge(3)) return false;
    const exact = HashMap.get(this.positions, extent.startChar);
    let start = O.getOrElse(exact, () => 0);
    if (O.isNone(exact)) start = this.lowerBound(extent.startChar);
    if (start < 0) return false;
    return this.intervalFrom(start, extent, evidence);
  };

  private collectOwners(): boolean {
    for (const element of this.plan.elements) {
      if (!this.charge(element.ownedTermRegions.length * 5 + 1)) return false;
      for (const region of element.ownedTermRegions)
        this.owners = HashMap.set(this.owners, region.core, element.ordinal);
    }
    return true;
  }

  private proofs(): boolean {
    for (const proof of this.plan.roles.certificates) {
      if (!this.charge(2) || !this.proofControl(proof)) return false;
    }
    return true;
  }
  private proofControl(proof: ClaimFiniteSourceProof): boolean {
    if (proof.kind === "scope") {
      return (
        proof.role !== "transition" ||
        this.interval(
          proof.extent,
          ClaimSourceControlEvidence.cases.scope.make({
            proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "scope" }),
          })
        )
      );
    }
    if (proof.kind === "opening") {
      return this.openingControl(proof);
    }
    if (proof.kind === "boundary") {
      return this.boundaryControl(proof);
    }
    if (proof.kind === "ordered-arguments") {
      return this.control(proof.adposition, this.argumentEvidence(proof));
    }
    if (proof.kind === "description") {
      return this.control(proof.introducer, this.argumentEvidence(proof));
    }
    if (proof.kind === "selection") {
      return this.selectionControl(proof);
    }
    if (proof.kind === "operator") {
      return this.operatorPositionControl(proof);
    }
    return true;
  }
  private argumentEvidence(proof: ClaimFiniteSourceProof): ClaimSourceControlEvidence {
    return ClaimSourceControlEvidence.cases["argument-link"].make({
      proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "argument" }),
    });
  }
  private openingControl(proof: Extract<ClaimFiniteSourceProof, { readonly kind: "opening" }>): boolean {
    if (proof.mode !== "preposition-object") return true;
    const openingRef = A.head(proof.evidence);
    return (
      O.isSome(openingRef) &&
      this.control(
        openingRef.value,
        ClaimSourceControlEvidence.cases.opening.make({
          proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "opening" }),
        })
      )
    );
  }
  private referenceLabelControl(
    proof: Extract<ClaimFiniteSourceProof, { readonly kind: "boundary" }>,
    evidence: ClaimSourceControlEvidence
  ): boolean {
    const first = proofAt(this.plan, proof.token);
    const last = O.flatMap(proof.successor, (r) => proofAt(this.plan, r));
    if (O.isNone(first) || first.value.kind !== "token" || O.isNone(last) || last.value.kind !== "token") return false;
    if (!this.charge(last.value.tokenOrdinal - first.value.tokenOrdinal + 1)) return false;
    for (let i = first.value.tokenOrdinal; i <= last.value.tokenOrdinal; i++) {
      const token = A.get(this.raw, i - 1);
      if (
        O.isNone(token) ||
        !this.control(ClaimSourceProofRef.make({ ordinal: token.value.ordinal, slot: "token" }), evidence)
      )
        return false;
    }
    return true;
  }
  private boundaryControl(proof: Extract<ClaimFiniteSourceProof, { readonly kind: "boundary" }>): boolean {
    const evidence = ClaimSourceControlEvidence.cases.boundary.make({
      proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "boundary" }),
    });
    if (!this.control(proof.token, evidence)) return false;
    return proof.mode !== "reference-label" || this.referenceLabelControl(proof, evidence);
  }
  private selectionControl(proof: Extract<ClaimFiniteSourceProof, { readonly kind: "selection" }>): boolean {
    const evidence = this.argumentEvidence(proof);
    if (!this.charge(proof.selector.length + 1) || !this.control(proof.linkage, evidence)) return false;
    for (const ref of proof.selector) if (!this.control(ref, evidence)) return false;
    return true;
  }
  private operatorPositionControl(proof: Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }>): boolean {
    if (proof.mode !== "infinitive" || O.isNone(proof.position)) return true;
    const token = proofAt(this.plan, proof.position.value);
    if (!O.exists(token, (p) => p.kind === "token" && p.token.anchor.quote === "to" && p.token.pos === "PART"))
      return true;
    return this.control(
      proof.position.value,
      ClaimSourceControlEvidence.cases["operator-position"].make({
        proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "operator" }),
      })
    );
  }

  private operatorSlot(
    binding: ClaimSourceOperatorBinding,
    index: number,
    slot: (typeof binding.slots)[number]
  ): boolean {
    if (slot.kind === "gap") return true;
    if (!this.charge(5)) return false;
    if (slot.kind === "adjunct")
      return this.control(
        slot.token,
        ClaimSourceControlEvidence.cases["operator-adjunct"].make({ binding: index + 1, certificate: slot.certificate })
      );
    if (HashMap.has(this.predicates, slot.token.ordinal)) return false;
    this.predicates = HashMap.set(
      this.predicates,
      slot.token.ordinal,
      ClaimSourceTokenOwnership.cases.predicate.make({
        token: slot.token,
        extent: slot.extent,
        binding: index + 1,
        frame: binding.frame,
        certificate: slot.certificate,
      })
    );
    return true;
  }
  private operatorSlots(): boolean {
    for (let i = 0; i < this.plan.operatorBindings.length; i++) {
      const binding = O.getOrThrow(A.get(this.plan.operatorBindings, i));
      if (!this.charge(binding.slots.length + 1)) return false;
      for (const slot of binding.slots) if (!this.operatorSlot(binding, i, slot)) return false;
    }
    return true;
  }

  private coordinateBefore(
    extent: TextAnchor,
    minimum: number
  ): O.Option<Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>> {
    const start = HashMap.get(this.positions, extent.startChar);
    if (O.isNone(start) || start.value < minimum) return O.none();
    const token = A.get(this.raw, start.value - 1);
    return O.filter(token, (p) => HashSet.has(HashSet.make("and", "or"), Str.toLowerCase(p.token.anchor.quote)));
  }
  private operatorCoordinate(index: number, right: ClaimSourceOperatorBinding): boolean {
    if (!this.charge(4)) return false;
    const token = this.coordinateBefore(right.operator, 1);
    if (O.isNone(token)) return true;
    if (!this.charge(this.plan.operatorBindings.length + 2)) return false;
    const left = A.findLastIndex(
      this.plan.operatorBindings,
      (b) => b.frame === right.frame && b.operator.startChar < right.operator.startChar
    );
    return (
      O.isNone(left) ||
      this.control(
        ClaimSourceProofRef.make({ ordinal: token.value.ordinal, slot: "token" }),
        ClaimSourceControlEvidence.cases["operator-coordinate"].make({ left: left.value + 1, right: index + 1 })
      )
    );
  }
  private operatorCoordinates(): boolean {
    for (let index = 0; index < this.plan.operatorBindings.length; index++) {
      if (!this.operatorCoordinate(index, O.getOrThrow(A.get(this.plan.operatorBindings, index)))) return false;
    }
    return true;
  }

  private frameCoordinate(right: ClaimSourceFrame): boolean {
    if (!this.charge(4)) return false;
    if (O.isNone(right.parent) || O.isNone(right.introducer) || Str.toLowerCase(right.introducer.value.quote) !== "to")
      return true;
    const token = this.coordinateBefore(right.extent, 2);
    if (O.isNone(token)) return true;
    const previous = O.getOrThrow(A.get(this.raw, token.value.tokenOrdinal - 2));
    if (!this.charge(this.plan.frames.length + 2)) return false;
    const left = A.filter(
      this.plan.frames,
      (frame) =>
        frame.ordinal !== right.ordinal &&
        O.getOrNull(frame.parent) === O.getOrNull(right.parent) &&
        frame.publicOwner === right.publicOwner &&
        frame.extent.endChar === previous.token.anchor.endChar
    );
    return (
      left.length !== 1 ||
      this.control(
        ClaimSourceProofRef.make({ ordinal: token.value.ordinal, slot: "token" }),
        ClaimSourceControlEvidence.cases["frame-coordinate"].make({
          left: O.getOrThrow(A.head(left)).ordinal,
          right: right.ordinal,
        })
      )
    );
  }
  private frameCoordinates(): boolean {
    for (const right of this.plan.frames) if (!this.frameCoordinate(right)) return false;
    return true;
  }

  private responseAdjunct(
    index: number,
    evidence: Extract<ClaimSourceControlEvidence, { readonly kind: "role-adjunct" }>
  ): boolean {
    const before = A.get(this.raw, index - 1);
    const after = A.get(this.raw, index + 1);
    if (
      O.exists(before, (p) => Str.toLowerCase(p.token.anchor.quote) === "in") &&
      O.exists(after, (p) => HashSet.has(HashSet.make("to", ","), Str.toLowerCase(p.token.anchor.quote)))
    ) {
      if (
        !this.control(ClaimSourceProofRef.make({ ordinal: O.getOrThrow(before).ordinal, slot: "token" }), evidence) ||
        !this.control(ClaimSourceProofRef.make({ ordinal: O.getOrThrow(after).ordinal, slot: "token" }), evidence)
      )
        return false;
    }
    return true;
  }
  private roleAdjunct(index: number): boolean {
    const predicate = O.getOrThrow(A.get(this.plan.roles.predicates, index));
    if (predicate.kind !== "adjunct") return true;
    const position = HashMap.get(this.positions, predicate.anchor.startChar);
    if (O.isNone(position)) return true;
    const token = O.getOrThrow(A.get(this.raw, position.value));
    const evidence = ClaimSourceControlEvidence.cases["role-adjunct"].make({
      predicate: index + 1,
      token: ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" }),
    });
    if (!this.control(evidence.token, evidence)) return false;
    return Str.toLowerCase(token.token.anchor.quote) !== "response" || this.responseAdjunct(position.value, evidence);
  }
  private roleAdjuncts(): boolean {
    if (!this.charge(this.plan.roles.predicates.length * 4 + this.plan.elements.length + 2)) return false;
    for (let i = 0; i < this.plan.roles.predicates.length; i++) if (!this.roleAdjunct(i)) return false;
    return true;
  }
  private elementCoordinate(right: ClaimPlannedElement): boolean {
    if (right.grouping !== "independent-coordinate") return true;
    if (!this.charge(this.plan.elements.length + 2)) return false;
    const start = HashMap.get(this.positions, right.extent.startChar);
    const left = A.findLast(
      this.plan.elements,
      (element) => element.ordinal < right.ordinal && O.getOrNull(element.parent) === O.getOrNull(right.parent)
    );
    if (O.isNone(start) || start.value === 0 || O.isNone(left)) return true;
    const token = O.getOrThrow(A.get(this.raw, start.value - 1));
    return (
      !HashSet.has(HashSet.make("and", "or"), Str.toLowerCase(token.token.anchor.quote)) ||
      this.control(
        ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" }),
        ClaimSourceControlEvidence.cases["element-coordinate"].make({ left: left.value.ordinal, right: right.ordinal })
      )
    );
  }
  private elementCoordinates(): boolean {
    for (let i = 1; i < this.plan.elements.length; i++)
      if (!this.elementCoordinate(O.getOrThrow(A.get(this.plan.elements, i)))) return false;
    return true;
  }

  private objectCoordinate(frame: ClaimSourceFrame, index: number, argument: ClaimFrameArgument): boolean {
    if (argument.role !== "object" || O.isNone(argument.predicate)) return true;
    const token = this.coordinateBefore(argument.nominal, 1);
    if (O.isNone(token)) return true;
    if (!this.charge(frame.arguments.length + 2)) return false;
    const left = A.findLastIndex(
      frame.arguments,
      (a, ordinal) =>
        ordinal < index &&
        a.role === "object" &&
        O.exists(a.predicate, (p) => O.exists(argument.predicate, (q) => sameAnchor(p, q)))
    );
    return (
      O.isNone(left) ||
      this.control(
        ClaimSourceProofRef.make({ ordinal: token.value.ordinal, slot: "token" }),
        ClaimSourceControlEvidence.cases["argument-coordinate"].make({
          frame: frame.ordinal,
          left: left.value + 1,
          right: index + 1,
        })
      )
    );
  }
  private argumentIntroducer(frame: ClaimSourceFrame, index: number, argument: ClaimFrameArgument): boolean {
    if (argument.role !== "prepositional-complement" && argument.role !== "nominal-modifier") return true;
    const start = HashMap.get(this.positions, argument.nominal.startChar);
    if (O.isNone(start) || start.value < 1) return true;
    const token = O.getOrThrow(A.get(this.raw, start.value - 1));
    return (
      token.token.pos !== "ADP" ||
      this.control(
        ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" }),
        ClaimSourceControlEvidence.cases["argument-introducer"].make({ frame: frame.ordinal, argument: index + 1 })
      )
    );
  }
  private frameArgumentControls(frame: ClaimSourceFrame): boolean {
    if (!this.charge(frame.arguments.length * 6 + 1)) return false;
    for (let index = 0; index < frame.arguments.length; index++) {
      const argument = O.getOrThrow(A.get(frame.arguments, index));
      if (!this.objectCoordinate(frame, index, argument) || !this.argumentIntroducer(frame, index, argument))
        return false;
    }
    if (O.isNone(frame.introducer)) return true;
    if (
      frameIntroducerLicensed(this.plan, frame, this.charge) &&
      !this.interval(
        frame.introducer.value,
        ClaimSourceControlEvidence.cases["frame-introducer"].make({ frame: frame.ordinal })
      )
    )
      return false;
    return this.charge(0);
  }
  private frameArguments(): boolean {
    if (!this.charge(this.plan.frames.length + this.plan.sourceExclusions.length + 1)) return false;
    for (const frame of this.plan.frames) if (!this.frameArgumentControls(frame)) return false;
    return true;
  }

  private exclusions(): boolean {
    for (let i = 0; i < this.plan.sourceExclusions.length; i++) {
      const exclusion = O.getOrThrow(A.get(this.plan.sourceExclusions, i));
      if (
        exclusion.kind !== "quoted-protection" &&
        this.positiveExclusion(i + 1) &&
        !this.interval(exclusion.extent, ClaimSourceControlEvidence.cases.exclusion.make({ exclusion: i + 1 }))
      )
        return false;
      if (!this.charge(1)) return false;
    }
    return true;
  }

  private declarationGapToken(
    token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
    end: number,
    declaration: number,
    left: number
  ): boolean {
    if (
      token.token.anchor.endChar > end ||
      !HashSet.has(HashSet.make("and", "or", ",", ";"), Str.toLowerCase(token.token.anchor.quote))
    )
      return true;
    return this.control(
      ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" }),
      ClaimSourceControlEvidence.cases["declaration-gap"].make({ declaration, left, right: left + 1 })
    );
  }
  private declarationGap(start: number, end: number, declaration: number, left: number): boolean {
    const lower = this.lowerBound(start);
    if (lower < 0) return false;
    for (let k = lower; k < this.raw.length; k++) {
      if (!this.charge(3)) return false;
      const token = O.getOrThrow(A.get(this.raw, k));
      if (token.token.anchor.startChar >= end) break;
      if (!this.declarationGapToken(token, end, declaration, left)) return false;
    }
    return true;
  }
  private declarations(): boolean {
    for (let i = 0; i < this.plan.declarationPlans.length; i++) {
      const declaration = O.getOrThrow(A.get(this.plan.declarationPlans, i));
      if (!this.charge(declaration.items.length + 1)) return false;
      for (let j = 1; j < declaration.items.length; j++) {
        const left = O.getOrThrow(A.get(declaration.items, j - 1));
        const right = O.getOrThrow(A.get(declaration.items, j));
        if (!this.declarationGap(left.extent.endChar, right.extent.startChar, i + 1, j)) return false;
      }
    }
    return true;
  }

  private publicCursor = 0;
  private privateCursor = 0;
  private advancePublic(extent: TextAnchor): boolean {
    while (
      this.publicCursor < this.plan.nominals.length &&
      O.getOrThrow(A.get(this.plan.nominals, this.publicCursor)).core.endChar <= extent.startChar
    ) {
      if (!this.charge(2)) return false;
      this.publicCursor++;
    }
    return true;
  }
  private advancePrivate(extent: TextAnchor): boolean {
    while (
      this.privateCursor < this.plan.roles.privateCandidates.length &&
      O.getOrThrow(A.get(this.plan.roles.privateCandidates, this.privateCursor)).core.endChar <= extent.startChar
    ) {
      if (!this.charge(2)) return false;
      this.privateCursor++;
    }
    return true;
  }
  private publicRow(
    token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
    ref: ClaimSourceProofRef
  ): O.Option<ClaimSourceTokenOwnership> {
    const owner = HashMap.get(this.owners, this.publicCursor + 1);
    if (O.isNone(owner) || HashMap.has(this.predicates, token.ordinal)) return O.none();
    return O.some(
      ClaimSourceTokenOwnership.cases["public-core"].make({
        token: ref,
        extent: token.token.anchor,
        core: this.publicCursor + 1,
        owner: owner.value,
      })
    );
  }
  private controlRow(
    token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
    ref: ClaimSourceProofRef
  ): O.Option<ClaimSourceTokenOwnership> {
    const predicate = HashMap.get(this.predicates, token.ordinal);
    if (O.isSome(predicate)) return predicate;
    let evidence = HashMap.get(this.controls, token.ordinal);
    if (
      O.isNone(evidence) &&
      token.token.pos === "PUNCT" &&
      HashSet.has(HashSet.make(".", ",", ";", ":", "(", ")", "[", "]"), token.token.anchor.quote)
    )
      evidence = O.some(ClaimSourceControlEvidence.cases.punctuation.make({}));
    if (
      O.isNone(evidence) ||
      !tokenControlMatches(this.plan, token, evidence.value, this.positiveExclusion, this.charge)
    )
      return O.none();
    return O.some(
      ClaimSourceTokenOwnership.cases.control.make({ token: ref, extent: token.token.anchor, evidence: evidence.value })
    );
  }
  private privateOrControlRow(
    token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
    ref: ClaimSourceProofRef
  ): O.Option<ClaimSourceTokenOwnership> {
    if (!this.advancePrivate(token.token.anchor)) return O.none();
    const candidate = A.get(this.plan.roles.privateCandidates, this.privateCursor);
    if (
      O.isSome(candidate) &&
      candidate.value.origin === "description" &&
      contains(candidate.value.core, token.token.anchor)
    ) {
      if (candidate.value.origin !== "description" || HashMap.has(this.predicates, token.ordinal)) return O.none();
      return O.some(
        ClaimSourceTokenOwnership.cases["private-value"].make({
          token: ref,
          extent: token.token.anchor,
          candidate: candidate.value.seed,
          certificate: candidate.value.certificate,
        })
      );
    }
    return this.controlRow(token, ref);
  }
  private tokenRow(
    token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>
  ): O.Option<ClaimSourceTokenOwnership> {
    // The extracted row stage adds one transient Option result per token.
    if (!this.charge(9)) return O.none();
    const ref = ClaimSourceProofRef.make({ ordinal: token.ordinal, slot: "token" });
    if (!this.advancePublic(token.token.anchor)) return O.none();
    const nominal = A.get(this.plan.nominals, this.publicCursor);
    if (O.exists(nominal, (n) => contains(n.core, token.token.anchor))) return this.publicRow(token, ref);
    return this.privateOrControlRow(token, ref);
  }
  private rows(): O.Option<ReadonlyArray<ClaimSourceTokenOwnership>> {
    const result: Array<ClaimSourceTokenOwnership> = [];
    this.publicCursor = 0;
    this.privateCursor = 0;
    for (const token of this.raw) {
      const row = this.tokenRow(token);
      if (O.isNone(row)) return O.none();
      result.push(row.value);
    }
    return O.some(result);
  }
}

const sourceTokenOwnership = (
  plan: ClaimSourceElementPlan,
  charge: (amount: number) => boolean
): O.Option<ReadonlyArray<ClaimSourceTokenOwnership>> => {
  if (!charge(plan.roles.certificates.length * 2 + plan.elements.length + plan.sourceExclusions.length + 4))
    return O.none();
  const raw = A.filter(plan.roles.certificates, (p) => p.kind === "token");
  if (raw.length === 0) return O.some([]);
  // The builder adds one bounded source-local state object; stage work and its
  // short-circuit order retain the original charged traversal sequence.
  if (!charge(1)) return O.none();
  return new SourceTokenOwnershipBuilder(plan, charge, raw).run();
};

const validatePrivateLedgerRecord = (
  plan: ClaimSourceElementPlan,
  record: Extract<ClaimSourceTokenOwnership, { readonly kind: "private-value" }>,
  charge: (amount: number) => boolean
): boolean =>
  charge(plan.roles.privateCandidates.length + 2) &&
  A.some(
    plan.roles.privateCandidates,
    (candidate) =>
      candidate.origin === "description" &&
      candidate.seed.ordinal === record.candidate.ordinal &&
      candidate.certificate.ordinal === record.certificate.ordinal &&
      contains(candidate.core, record.extent)
  );
const validatePredicateLedgerRecord = (
  plan: ClaimSourceElementPlan,
  record: Extract<ClaimSourceTokenOwnership, { readonly kind: "predicate" }>,
  charge: (amount: number) => boolean
): boolean => {
  const binding = A.get(plan.operatorBindings, record.binding - 1);
  return O.exists(
    binding,
    (b) =>
      b.frame === record.frame &&
      charge(b.slots.length + 2) &&
      A.some(
        b.slots,
        (slot) =>
          slot.kind === "lexical" &&
          slot.token.ordinal === record.token.ordinal &&
          slot.certificate.ordinal === record.certificate.ordinal
      )
  );
};
const validateNonPublicLedgerRecord = (
  plan: ClaimSourceElementPlan,
  token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
  record: ClaimSourceTokenOwnership,
  positiveExclusion: (ordinal: number) => boolean,
  charge: (amount: number) => boolean
): boolean => {
  if (record.kind === "public-core") {
    return false;
  }
  if (record.kind === "private-value") {
    return validatePrivateLedgerRecord(plan, record, charge);
  }
  if (record.kind === "predicate") {
    return validatePredicateLedgerRecord(plan, record, charge);
  }
  return tokenControlMatches(plan, token, record.evidence, positiveExclusion, charge);
};

const ledgerOperatorOwner = (
  record: ClaimSourceTokenOwnership,
  slot: Exclude<ClaimSourceOperatorBinding["slots"][number], { readonly kind: "gap" }>,
  index: number,
  frame: number
): boolean =>
  slot.kind === "adjunct"
    ? record.kind === "control"
    : record.kind === "predicate" &&
      record.binding === index + 1 &&
      record.frame === frame &&
      record.certificate.ordinal === slot.certificate.ordinal;
const validateLedgerSlot = (
  plan: ClaimSourceElementPlan,
  binding: ClaimSourceOperatorBinding,
  index: number,
  slot: ClaimSourceOperatorBinding["slots"][number]
): boolean => {
  if (slot.kind === "gap") return true;
  const raw = proofAt(plan, slot.token);
  if (O.isNone(raw) || raw.value.kind !== "token") return false;
  const owner = A.get(plan.tokenOwnership, raw.value.tokenOrdinal - 1);
  return O.exists(owner, (record) => ledgerOperatorOwner(record, slot, index, binding.frame));
};
const validateLedgerOperators = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  // Every retained lexical operator slot must occur in the exclusive ledger;
  // a public core/control cannot mask an independently asserted predicate.
  for (let index = 0; index < plan.operatorBindings.length; index++) {
    const binding = O.getOrThrow(A.get(plan.operatorBindings, index));
    if (!charge(binding.slots.length * 4 + 1)) return false;
    for (const slot of binding.slots) if (!validateLedgerSlot(plan, binding, index, slot)) return false;
  }
  return true;
};

const ledgerNominalCursor = (
  plan: ClaimSourceElementPlan,
  start: number,
  extent: TextAnchor,
  charge: (amount: number) => boolean
): number => {
  let cursor = start;
  while (cursor < plan.nominals.length && O.getOrThrow(A.get(plan.nominals, cursor)).core.endChar <= extent.startChar) {
    if (!charge(2)) return -1;
    cursor++;
  }
  return cursor;
};
const ledgerTokenIdentity = (
  token: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>,
  record: ClaimSourceTokenOwnership,
  charge: (amount: number) => boolean
): boolean =>
  record.token.slot === "token" &&
  record.token.ordinal === token.ordinal &&
  charge(record.extent.quote.length + 1) &&
  sameAnchor(record.extent, token.token.anchor);
const validateLedgerToken = (
  plan: ClaimSourceElementPlan,
  raw: ReadonlyArray<Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>>,
  owners: ReadonlyArray<number>,
  index: number,
  start: number,
  positiveExclusion: (ordinal: number) => boolean,
  charge: (amount: number) => boolean
): number => {
  let cursor = start;
  if (!charge(6)) return -1;
  const token = O.getOrThrow(A.get(raw, index));
  const record = O.getOrThrow(A.get(plan.tokenOwnership, index));

  if (!ledgerTokenIdentity(token, record, charge)) return -1;
  cursor = ledgerNominalCursor(plan, cursor, record.extent, charge);
  if (cursor < 0) return -1;
  const core = A.get(plan.nominals, cursor);
  if (O.exists(core, (n) => contains(n.core, record.extent))) {
    if (record.kind !== "public-core" || record.core !== cursor + 1 || !O.contains(A.get(owners, cursor), record.owner))
      return -1;
    return cursor;
  }
  if (!validateNonPublicLedgerRecord(plan, token, record, positiveExclusion, charge)) return -1;
  return cursor;
};
const validateSourceTokenOwnership = (
  plan: ClaimSourceElementPlan,
  owners: ReadonlyArray<number>,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.roles.certificates.length * 2 + plan.tokenOwnership.length + plan.operatorBindings.length + 4))
    return false;
  const raw = A.filter(plan.roles.certificates, (p) => p.kind === "token");
  if (raw.length !== plan.tokenOwnership.length) return false;
  let checkedExclusions = HashMap.empty<number, boolean>();
  const positiveExclusion = (ordinal: number): boolean => {
    if (!charge(3)) return false;
    const previous = HashMap.get(checkedExclusions, ordinal);
    if (O.isSome(previous)) return previous.value;
    const exclusion = A.get(plan.sourceExclusions, ordinal - 1);
    const valid = O.exists(exclusion, (e) => positiveCandidateExclusion(plan, e, charge));
    if (!charge(2)) return false;
    checkedExclusions = HashMap.set(checkedExclusions, ordinal, valid);
    return valid;
  };
  let cursor = 0;
  for (let index = 0; index < raw.length; index++) {
    cursor = validateLedgerToken(plan, raw, owners, index, cursor, positiveExclusion, charge);
    if (cursor < 0) return false;
  }
  return validateLedgerOperators(plan, charge);
};

const validateCommittedSourceFacts = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (plan.roles.certificates.length === 0) return true;
  const original = plan.roles.originalLexicalInput;
  if (O.isSome(original)) {
    if (!charge(plan.qualifiedText.length + 4)) return false;
    const claim = plan.roles.qualifiedClaim;
    return (
      O.isSome(claim) &&
      claim.value.claimText === plan.qualifiedText &&
      validateClaimFiniteSourceProofsFromOriginalInput(
        claim.value,
        original.value,
        plan.roles.certificates,
        plan.roles.proofs,
        charge
      )
    );
  }
  if (!charge(plan.roles.certificates.length * 3 + plan.qualifiedText.length + 4)) return false;
  const claim = plan.roles.qualifiedClaim;
  if (O.isNone(claim) || claim.value.claimText !== plan.qualifiedText) return false;
  const tokens = A.flatMap(plan.roles.certificates, (proof) => (proof.kind === "token" ? [proof.token] : []));
  return validateClaimFiniteSourceProofs(claim.value, tokens, plan.roles.certificates, plan.roles.proofs, charge);
};
const validateSourcePlanComponents = (
  plan: ClaimSourceElementPlan,
  owners: Array<number>,
  charge: (amount: number) => boolean
): boolean =>
  validateCommittedSourceFacts(plan, charge) &&
  validateSourceLabelDeclarations(plan, charge) &&
  validateAttached(plan, charge) &&
  validateCandidateCommit(plan, charge) &&
  validatePrivateAndOperators(plan, charge) &&
  validateHeaderMemberships(plan, charge) &&
  validateOwners(plan, owners, charge);
const validateSourcePlanCompletion = (
  plan: ClaimSourceElementPlan,
  owners: Array<number>,
  charge: (amount: number) => boolean
): boolean =>
  charge(owners.length) &&
  A.every(owners, (owner) => owner > 0) &&
  A.every(plan.frames, (frame) => validateFrame(plan, frame, owners, charge)) &&
  validateSourceTokenOwnership(plan, owners, charge);
/**
 * Existing composition vocabulary shared by declaration compilation and source validation.
 *
 * **Example** (Recognize an existing declaration operator)
 * ```ts
 * import { claimDeclarationCompositions } from "../../src/values/ClaimElement/ClaimClauseRole.projection.ts"
 * import * as HashSet from "effect/HashSet"
 * console.log(HashSet.has(claimDeclarationCompositions, "comprising")) // true
 * ```
 * @category constants
 * @since 0.0.0
 */
export const claimDeclarationCompositions = HashSet.make("includes", "including", "comprises", "comprising", "having");

/**
 * Read the rank of a complete lowercase dotted source label, without supplying term evidence.
 *
 * **Example** (Reject a sentence initial)
 * ```ts
 * import { sourceDottedLabelRank } from "../../src/values/ClaimElement/ClaimClauseRole.projection.ts"
 * console.log(sourceDottedLabelRank("A.")) // -1
 * ```
 * @category validation
 * @since 0.0.0
 */
export const sourceDottedLabelRank = (quote: string): number => {
  if (quote.length !== 2 || Str.slice(1, 2)(quote) !== ".") return -1;
  const code = O.getOrElse(Str.charCodeAt(0)(quote), () => -1);
  return code >= 97 && code <= 122 ? code - 97 : -1;
};

type SourceLabelDeclaration = Extract<ClaimSourceDeclaration, { readonly kind: "labelled" }>;
type SourceLabelToken = Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>;
const dottedLabelTokenAligned = (
  tokens: ReadonlyArray<SourceLabelToken>,
  label: TextAnchor,
  charge: (amount: number) => boolean
): boolean => {
  const index = sourceLowerBound(tokens, label.startChar, rawTokenSourceStart, charge);
  if (index < 0 || !charge(8)) return false;
  const first = A.get(tokens, index);
  if (O.isNone(first) || first.value.token.anchor.startChar !== label.startChar) return false;
  if (sameAnchor(first.value.token.anchor, label)) return true;
  const dot = A.get(tokens, index + 1);
  return (
    first.value.token.anchor.quote === Str.slice(0, 1)(label.quote) &&
    O.exists(
      dot,
      (p) =>
        p.token.anchor.quote === "." &&
        p.token.anchor.startChar === first.value.token.anchor.endChar &&
        p.token.anchor.endChar === label.endChar
    )
  );
};
const dottedSourceGap = (
  plan: ClaimSourceElementPlan,
  start: number,
  end: number,
  first: boolean,
  charge: (amount: number) => boolean
): boolean => {
  if (end < start || !charge((end - start) * 2 + 4)) return false;
  const gap = Str.slice(start, end)(plan.qualifiedText);
  return first ? Str.trim(gap) === "" : O.isSome(Str.match(/^\s*;\s*(?:(?:and|or)\s+)?$/u)(gap));
};
const dottedCompositionPredicate = (frame: ClaimSourceFrame, charge: (amount: number) => boolean): boolean => {
  for (const predicate of frame.predicates) {
    if (!charge(predicate.quote.length * 2 + 1)) return false;
    if (HashSet.has(claimDeclarationCompositions, Str.toLowerCase(predicate.quote))) return true;
  }
  return false;
};
const dottedDeclarationFrame = (
  plan: ClaimSourceElementPlan,
  declaration: SourceLabelDeclaration,
  charge: (amount: number) => boolean
): O.Option<ClaimSourceFrame> => {
  if (!charge(declaration.anchor.quote.length + 4)) return O.none();
  const frame = A.get(plan.frames, declaration.frame - 1);
  if (O.isSome(frame) && !charge(frame.value.predicates.length + 1)) return O.none();
  return O.filter(
    frame,
    (f) =>
      f.publicOwner === declaration.owner &&
      O.exists(f.introducer, (a) => sameAnchor(a, declaration.anchor)) &&
      Str.endsWith(":")(declaration.anchor.quote) &&
      dottedCompositionPredicate(f, charge)
  );
};
type SourceLabelItem = SourceLabelDeclaration["items"][number];
const dottedChildMatches = (plan: ClaimSourceElementPlan, owner: number, item: SourceLabelItem): boolean =>
  O.exists(
    A.get(plan.elements, item.child - 1),
    (child) => O.contains(child.parent, owner) && sameAnchor(child.extent, item.extent)
  );
const dottedDeclarationItem = (
  plan: ClaimSourceElementPlan,
  declaration: SourceLabelDeclaration,
  item: SourceLabelItem,
  index: number,
  previousEnd: number,
  raw: ReadonlyArray<SourceLabelToken>,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(6)) return false;
  if (
    sourceDottedLabelRank(item.label.quote) !== index ||
    !sourceAnchor(plan, item.label, charge) ||
    !dottedLabelTokenAligned(raw, item.label, charge) ||
    !dottedSourceGap(plan, previousEnd, item.label.startChar, index === 0, charge)
  )
    return false;
  if (!dottedChildMatches(plan, declaration.owner, item)) return false;
  return (
    item.extent.startChar > item.label.endChar &&
    dottedSourceGap(plan, item.label.endChar, item.extent.startChar, true, charge)
  );
};
const dottedDeclarationItems = (
  plan: ClaimSourceElementPlan,
  declaration: SourceLabelDeclaration,
  raw: ReadonlyArray<SourceLabelToken>,
  charge: (amount: number) => boolean
): boolean => {
  if (declaration.items.length < 2) return false;
  const frame = dottedDeclarationFrame(plan, declaration, charge);
  if (O.isNone(frame)) return false;
  let previousEnd = declaration.anchor.endChar;
  for (let i = 0; i < declaration.items.length; i++) {
    if (!charge(1)) return false;
    const item = O.getOrThrow(A.get(declaration.items, i));
    if (!dottedDeclarationItem(plan, declaration, item, i, previousEnd, raw, charge)) return false;
    previousEnd = item.extent.endChar;
  }
  return previousEnd === frame.value.extent.endChar;
};
const sourceLabelListHeaderMatches = (declaration: SourceLabelDeclaration, list: ClaimListDeclaration): boolean =>
  list.owner === declaration.owner &&
  sameAnchor(list.anchor, declaration.anchor) &&
  list.items.length === declaration.items.length;
const sourceLabelListMatches = (
  declaration: SourceLabelDeclaration,
  list: ClaimListDeclaration,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(declaration.anchor.quote.length + list.anchor.quote.length + 4)) return false;
  if (!sourceLabelListHeaderMatches(declaration, list)) return false;
  for (let i = 0; i < list.items.length; i++) {
    if (!charge(4)) return false;
    const item = O.getOrThrow(A.get(list.items, i));
    const original = O.getOrThrow(A.get(declaration.items, i));
    if (!charge(item.label.quote.length + original.label.quote.length + 2)) return false;
    if (item.child !== original.child || !sameAnchor(item.label, original.label)) return false;
  }
  return true;
};
// Operational source-local validation cache; never persisted as evidence.
type SourceLabelValidation = { labelled: number; raw: O.Option<ReadonlyArray<SourceLabelToken>> };
const sourceLabelRawTokens = (
  plan: ClaimSourceElementPlan,
  state: SourceLabelValidation,
  charge: (amount: number) => boolean
): boolean => {
  if (O.isSome(state.raw)) return true;
  if (!charge(plan.roles.certificates.length * 2 + 1)) return false;
  state.raw = O.some(A.filter(plan.roles.certificates, (p): p is SourceLabelToken => p.kind === "token"));
  return true;
};
const validateSourceLabelDeclaration = (
  plan: ClaimSourceElementPlan,
  declaration: SourceLabelDeclaration,
  state: SourceLabelValidation,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(declaration.items.length * 3 + 2)) return false;
  const list = A.get(plan.declarations, state.labelled++);
  if (O.isNone(list) || !sourceLabelListMatches(declaration, list.value, charge)) return false;
  const dotted = A.some(declaration.items, (item) => sourceDottedLabelRank(item.label.quote) >= 0);
  if (!dotted) return true;
  return (
    sourceLabelRawTokens(plan, state, charge) &&
    dottedDeclarationItems(plan, declaration, O.getOrThrow(state.raw), charge)
  );
};
const validateSourceLabelDeclarations = (
  plan: ClaimSourceElementPlan,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(plan.declarationPlans.length + plan.declarations.length + 1) || !charge(3)) return false;
  const state: SourceLabelValidation = { labelled: 0, raw: O.none() };
  for (const declaration of plan.declarationPlans) {
    if (declaration.kind !== "labelled") continue;
    if (!validateSourceLabelDeclaration(plan, declaration, state, charge)) return false;
  }
  return state.labelled === plan.declarations.length;
};

const validateOwnership = (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean => {
  if (!charge(plan.nominals.length + plan.elements.length + plan.frames.length + plan.roles.clauses.length + 1))
    return false;
  const owners = A.replicate(0, plan.nominals.length);
  if (
    !charge(plan.sourceExclusions.length) ||
    !A.every(plan.sourceExclusions, (exclusion) => sourceAnchor(plan, exclusion.extent, charge))
  )
    return false;
  return validateSourcePlanComponents(plan, owners, charge) && validateSourcePlanCompletion(plan, owners, charge);
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
 * **Example** (Propagate an absent planned element)
 *
 * ```ts
 * import { projectClaimRoleTerms } from "@beep/law-practice-domain/test"
 * import type { ClaimPlannedElement } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as O from "effect/Option"
 *
 * const project = projectClaimRoleTerms(() => false)
 * const terms = O.flatMap(O.none<ClaimPlannedElement>(), project)
 * console.log(O.isNone(terms)) // true: no element or terms are fabricated
 * ```
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
 *
 * **Example** (Propagate an absent planned element)
 *
 * ```ts
 * import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test"
 * import type { ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as O from "effect/Option"
 *
 * const validate = validateClaimSourceOwnership(() => false)
 * console.log(O.isNone(O.map(O.none<ClaimSourceElementPlan>(), validate))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateClaimSourceOwnership: {
  (charge: (amount: number) => boolean): (plan: ClaimSourceElementPlan) => boolean;
  (plan: ClaimSourceElementPlan, charge: (amount: number) => boolean): boolean;
} = dual(2, validateOwnership);

/**
 * Derive a lossless lexical presentation from actual committed same-frame operator proofs.
 *
 * **Example** (Leave the view absent when no source frame exists)
 *
 * ```ts
 * import { projectClaimFrameLexicalView } from "@beep/law-practice-domain/test"
 * import type { ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const plan = O.none<ClaimSourceElementPlan>()
 * const view = O.flatMap(plan, source => O.flatMap(A.head(source.frames), frame => projectClaimFrameLexicalView(frame, () => false)(source)))
 * console.log(O.isNone(view)) // true: a missing plan cannot donate a header or lexical view
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const projectClaimFrameLexicalView: {
  (
    frame: ClaimSourceFrame,
    charge: (amount: number) => boolean
  ): (plan: ClaimSourceElementPlan) => O.Option<ClaimFrameLexicalView>;
  (
    plan: ClaimSourceElementPlan,
    frame: ClaimSourceFrame,
    charge: (amount: number) => boolean
  ): O.Option<ClaimFrameLexicalView>;
} = dual(3, frameLexicalView);

/**
 * Certify the exact qualified header placeholder without deleting its raw uncertainty.
 *
 * **Example** (Leave the view absent when no source frame exists)
 *
 * ```ts
 * import { deriveClaimQualifiedHeaderMembership } from "../../src/values/ClaimElement/ClaimClauseRole.projection.ts"
 * import type { ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const plan = O.none<ClaimSourceElementPlan>()
 * const view = O.flatMap(plan, source => O.flatMap(A.head(source.frames), frame => deriveClaimQualifiedHeaderMembership(frame, () => false)(source)))
 * console.log(O.isNone(view)) // true: a missing plan cannot donate a header or lexical view
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const deriveClaimQualifiedHeaderMembership: {
  (
    frame: ClaimSourceFrame,
    charge: (amount: number) => boolean
  ): (plan: ClaimSourceElementPlan) => O.Option<ClaimQualifiedHeaderMembership>;
  (
    plan: ClaimSourceElementPlan,
    frame: ClaimSourceFrame,
    charge: (amount: number) => boolean
  ): O.Option<ClaimQualifiedHeaderMembership>;
} = dual(3, qualifiedHeaderMembership);

/**
 * Construct an exclusive token ledger from existing source/frame certificates.
 *
 * **Example** (Propagate an absent planned element)
 *
 * ```ts
 * import { deriveClaimSourceTokenOwnership } from "../../src/values/ClaimElement/ClaimClauseRole.projection.ts"
 * import type { ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as O from "effect/Option"
 *
 * const derive = deriveClaimSourceTokenOwnership(() => false)
 * console.log(O.isNone(O.flatMap(O.none<ClaimSourceElementPlan>(), derive))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const deriveClaimSourceTokenOwnership: {
  (
    charge: (amount: number) => boolean
  ): (plan: ClaimSourceElementPlan) => O.Option<ReadonlyArray<ClaimSourceTokenOwnership>>;
  (
    plan: ClaimSourceElementPlan,
    charge: (amount: number) => boolean
  ): O.Option<ReadonlyArray<ClaimSourceTokenOwnership>>;
} = dual(2, sourceTokenOwnership);
