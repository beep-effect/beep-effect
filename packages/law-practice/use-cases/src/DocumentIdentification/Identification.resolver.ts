/**
 * Conservative document attribution from typed private evidence.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { extractPracticeKgReferences } from "../PracticeKg.matter-lookup.ts";
import {
  ClientNumber,
  DocketId,
  EvidenceLine,
  LearningText,
  OrganisationDecision,
  Resolution,
  TokenFilter,
  TokenOwnership,
} from "./Identification.schemas.ts";
import type {
  ClientKey,
  Contact,
  EvidenceKind,
  IdentificationDocument,
  OrganisationRules,
  ResolverContext,
  TrainingDocument,
} from "./Identification.schemas.ts";

const normal = (s: string) => Str.toLowerCase(Str.trim(Str.replace(/\s+/gu, " ")(s)));
const digits = (s: string) => Str.replace(/\D/gu, "")(s);
const corporateWords = HashSet.fromIterable(["llc", "inc", "ltd", "corp", "corporation", "company"]);
const wordsExcluding = (stopWords: HashSet.HashSet<string>) => (name: string) =>
  HashSet.fromIterable(
    A.filter(
      Str.split(Str.replace(/[^a-z0-9]+/gu, " ")(normal(name)), " "),
      (word) => word.length > 1 && !HashSet.has(stopWords, word)
    )
  );
const nameWords = wordsExcluding(corporateWords);
const nameMatches = (a: string, b: string) => {
  const left = nameWords(a);
  const right = nameWords(b);
  return (
    HashSet.size(left) > 0 &&
    HashSet.size(right) > 0 &&
    (HashSet.isSubset(left, right) || HashSet.isSubset(right, left)) &&
    A.some(A.fromIterable(HashSet.intersection(left, right)), (word) => word.length >= 4)
  );
};

// Callers normalise each text once; the pattern is compiled once per phrase.
const phraseMatcher = (phrase: string) => {
  const p = normal(phrase);
  const escaped = Str.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")(p);
  const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "u");
  return (normalText: string) => p.length > 0 && pattern.test(normalText);
};
const phraseIn = (normalText: string, phrase: string) => phraseMatcher(phrase)(normalText);
const partyStopWords = HashSet.fromIterable([
  "inc",
  "llc",
  "corp",
  "corporation",
  "company",
  "co",
  "ltd",
  "the",
  "of",
  "and",
]);
const partyWords = wordsExcluding(partyStopWords);
// A client name matches a party when its words all appear in the party name, or the party's two or more words all
// appear in the client name; a shared word of four or more characters is required either way.
const partyNamesClient = (clientName: string, partyName: string) => {
  const client = partyWords(clientName);
  const party = partyWords(partyName);
  return (
    HashSet.size(client) > 0 &&
    (HashSet.isSubset(client, party) || (HashSet.isSubset(party, client) && HashSet.size(party) >= 2)) &&
    A.some(A.fromIterable(HashSet.intersection(client, party)), (word) => word.length >= 4)
  );
};
// Weight of a critic-confirmed party by its role in the document; zero-weight roles never vote.
const roleWeight = (role: string) =>
  A.contains(["applicant", "assignee", "client"], role)
    ? 3
    : A.contains(["addressee", "recipient", "inventor", "assignor"], role)
      ? 2
      : A.contains(["signatory", "author"], role)
        ? 1
        : 0;
// Text weight of a contact link: links from filed email outweigh the rest.
const linkWeight = (source: string) => (A.contains(["attorney-filed-email", "email-subject-ref"], source) ? 3 : 1);
const strongLinkSources = ["attorney-answer", "attorney-pc-folder", "attorney-docket-sheet", "attorney-filed-email"];
const token = (kind: string, value: string) => `${kind}:${normal(value)}`;
const names = (context: ResolverContext) => [
  ...A.flatMap(context.clients, (c) => A.map(c.names, (n) => ({ key: c.clientNumber, name: n.name }))),
  ...A.flatMap(context.pseudoClients, (c) => A.map(c.names, (name) => ({ key: c.key, name }))),
];
const contactTokens = (document: IdentificationDocument, context: ResolverContext) => {
  const text = normal(document.text);
  const excluded = HashSet.fromIterable(A.map(context.excludedDomains, normal));
  const documentEmails = A.map(A.fromIterable(text.matchAll(/[^@\s<>]+@([a-z0-9.-]+\.[a-z]{2,})/gu)), (e) =>
    normal(e[1] ?? "")
  );
  const documentPhones = A.map(
    A.fromIterable(document.text.matchAll(/(?:\+?1[ .-]?)?\(?[2-9][0-9]{2}\)?[ .-]?[2-9][0-9]{2}[ .-]?[0-9]{4}/gu)),
    (p) => Str.slice(-10)(digits(p[0]))
  );
  return A.flatMap(context.contacts, (c) => {
    const result: Array<{
      token: string;
      kind: EvidenceKind;
      contactId: string;
      clients: ReadonlyArray<ClientNumber>;
      links: Contact["links"];
    }> = [];
    const clients = A.dedupe(A.map(c.links, (l) => l.clientNumber));
    const add = (kind: EvidenceKind, value: string, matched: boolean) => {
      if (matched && clients.length > 0)
        result.push({ token: token(kind, value), kind, contactId: c.contactId, clients, links: c.links });
    };
    A.forEach(c.emails, (e) => add("contact-address", e.address, phraseIn(text, e.address)));
    A.forEach(c.domains, (d) =>
      add("contact-domain", d, !HashSet.has(excluded, normal(d)) && A.contains(documentEmails, normal(d)))
    );
    A.forEach(c.phones, (p) =>
      add("contact-phone", p.e164, A.contains(documentPhones, Str.slice(-10)(digits(p.e164))))
    );
    if (
      A.filter(Str.split(normal(c.displayName), " "), Str.isNonEmpty).length >= 2 &&
      (c.emails.length === 0 || A.some(c.emails, (e) => !e.role))
    )
      add("contact-name", c.displayName, phraseIn(text, c.displayName));
    return result;
  });
};
const documentTokens = (document: IdentificationDocument, context: ResolverContext): ReadonlyArray<string> =>
  A.dedupe([
    ...A.map(contactTokens(document, context), (t) => t.token),
    ...A.map(
      A.filter(names(context), (n) => n.name.length >= 6 && phraseIn(normal(document.text), n.name)),
      (n) => token("client-name", n.name)
    ),
  ]);

// Alias chains are followed to their end; a cycle returns the original key.
const resolveAlias =
  (aliases: ResolverContext["aliases"]) =>
  (key: ClientKey): ClientKey => {
    let current = key;
    let visited = HashSet.empty<ClientKey>();
    while (!HashSet.has(visited, current)) {
      visited = HashSet.add(visited, current);
      const next = A.findFirst(aliases, (a) => a.from === current);
      if (O.isNone(next)) return current;
      current = next.value.to;
    }
    return key;
  };
type Decision = { readonly client: O.Option<ClientKey>; readonly tier: Resolution["tier"] };
const undecided: Decision = { client: O.none(), tier: "unknown" };
// Content tier: score at least five, two independent sources, three times the runner-up (runner floor one).
// Candidate: score at least three and twice the runner-up. Otherwise ambiguous when anyone else scored.
const scoredDecision = (key: ClientKey, score: number, runner: number, independentSources: number): Decision => {
  const floor = Math.max(runner, 1);
  if (score >= 5 && independentSources >= 2 && score >= 3 * floor)
    return { client: O.some(key), tier: "identified-content" };
  if (score >= 3 && score >= 2 * floor) return { client: O.some(key), tier: "candidate" };
  return { client: O.none(), tier: runner > 0 ? "ambiguous" : "unknown" };
};
const decide = (
  strong: HashSet.HashSet<ClientKey>,
  top: O.Option<readonly [ClientKey, number]>,
  runner: number,
  independent: (key: ClientKey) => number
): Decision => {
  if (HashSet.size(strong) > 1) return { client: O.none(), tier: "ambiguous" };
  if (HashSet.size(strong) === 1) return { client: strong.pipe(A.fromIterable, A.head), tier: "identified" };
  return O.match(top, {
    onNone: () => undecided,
    onSome: ([key, score]) => scoredDecision(key, score, runner, independent(key)),
  });
};

/**
 * Fits ownership exclusively on supplied training documents; multi-client tokens carry no signal.
 * The caller must pass the training partition returned by holdOutSplit.
 * **Example** (Fit an empty training set)
 *
 * ```ts
 * import { fitTokenFilter, ResolverContext } from "@beep/law-practice-use-cases/DocumentIdentification"
 * const context = ResolverContext.make({ clients: [], pairs: [], contacts: [], aliases: [], pseudoClients: [], excludedDomains: [] })
 * console.log(fitTokenFilter([], context).ownership.length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const fitTokenFilter: {
  (context: ResolverContext): (training: ReadonlyArray<TrainingDocument>) => TokenFilter;
  (training: ReadonlyArray<TrainingDocument>, context: ResolverContext): TokenFilter;
} = dual(2, (training: ReadonlyArray<TrainingDocument>, context: ResolverContext): TokenFilter => {
  const ownership = M.empty<string, HashSet.HashSet<ClientNumber>>();
  A.forEach(training, (row) =>
    A.forEach(documentTokens(row.document, context), (key) =>
      M.set(
        ownership,
        key,
        HashSet.add(
          O.getOrElse(M.get(ownership, key), () => HashSet.empty()),
          row.clientNumber
        )
      )
    )
  );
  return TokenFilter.make({
    training: A.map(training, (row) =>
      LearningText.make({
        clientNumber: row.clientNumber,
        contentHash: row.document.contentHash,
        text: normal(row.document.text),
      })
    ),
    ownership: A.map(
      A.sort(
        A.fromIterable(ownership),
        Order.mapInput(Order.String, ([key]: readonly [string, HashSet.HashSet<ClientNumber>]) => key)
      ),
      ([key, clients]) => TokenOwnership.make({ token: key, clients: A.sort(A.fromIterable(clients), Order.String) })
    ),
  });
});

/**
 * Resolves one document, retaining conflicting strong signals and respecting critic-confirmed quotes.
 * Content identification needs two independent provenance sources and a threefold margin;
 * weaker evidence needs a twofold margin. Evidence descriptions contain ids and counts only.
 * **Example** (Resolve an empty document)
 *
 * ```ts
 * import { resolve, IdentificationDocument, ContentHash, ResolverContext, fitTokenFilter } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as O from "effect/Option"
 * const context = ResolverContext.make({ clients: [], pairs: [], contacts: [], aliases: [], pseudoClients: [], excludedDomains: [] })
 * const document = IdentificationDocument.make({ documentId: "doc-1", contentHash: ContentHash.make("a".repeat(64)), text: "", sourcePath: "", extraction: O.none(), uspto: [], copies: [] })
 * console.log(resolve(document, context, fitTokenFilter([], context)).tier) // "unknown"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const resolve: {
  (context: ResolverContext, filter: TokenFilter): (document: IdentificationDocument) => Resolution;
  (document: IdentificationDocument, context: ResolverContext, filter: TokenFilter): Resolution;
} = dual(3, (document: IdentificationDocument, context: ResolverContext, filter: TokenFilter): Resolution => {
  const normalText = normal(document.text);
  const alias = resolveAlias(context.aliases);
  let strong = HashSet.empty<ClientKey>();
  const dockets = M.empty<ClientKey, HashSet.HashSet<DocketId>>();
  const votes = M.empty<ClientKey, number>();
  const sources = M.empty<ClientKey, HashSet.HashSet<string>>();
  const contentScores = M.empty<ClientKey, number>();
  const contentSources = M.empty<ClientKey, HashSet.HashSet<string>>();
  const evidence: Array<EvidenceLine> = [];
  const addEvidence = (kind: EvidenceKind, detail: string) => evidence.push(EvidenceLine.make({ kind, detail }));
  const docketFor = (client: ClientKey, docket: DocketId) =>
    M.set(
      dockets,
      alias(client),
      HashSet.add(
        O.getOrElse(M.get(dockets, alias(client)), () => HashSet.empty()),
        docket
      )
    );
  // Text signals: each distinct source adds its weight once; the total is capped when combined with content.
  const vote = (client: ClientKey, source: string, kind: EvidenceKind, weight: number) => {
    const key = alias(client);
    const priorSources = O.getOrElse(M.get(sources, key), () => HashSet.empty<string>());
    if (!HashSet.has(priorSources, source)) M.set(votes, key, O.getOrElse(M.get(votes, key), () => 0) + weight);
    M.set(sources, key, HashSet.add(priorSources, source));
    addEvidence(kind, `client ${key}`);
  };
  // Content signals: a critic-confirmed party adds its role weight once per client and path.
  const contentVote = (client: ClientKey, source: string, kind: EvidenceKind, weight: number) => {
    const key = alias(client);
    M.set(contentScores, key, O.getOrElse(M.get(contentScores, key), () => 0) + weight);
    M.set(
      contentSources,
      key,
      HashSet.add(
        O.getOrElse(M.get(contentSources, key), () => HashSet.empty()),
        source
      )
    );
    addEvidence(kind, `client ${key}`);
  };
  // A token owned by exactly one client in the training split votes for that client with weight three; a token seen
  // under several clients is dropped; an unseen token falls back to the given weighted votes.
  const tokenVotes = (key: string, fallback: ReadonlyArray<readonly [ClientKey, number, string]>, kind: EvidenceKind) =>
    O.match(
      A.findFirst(filter.ownership, (o) => o.token === key),
      {
        onNone: () => A.forEach(fallback, ([client, weight, source]) => vote(client, source, kind, weight)),
        onSome: (o) => {
          if (o.clients.length === 1) A.forEach(o.clients, (client) => vote(client, key, kind, 3));
        },
      }
    );
  const fullReferences = (text: string, kind: EvidenceKind) =>
    A.forEach(extractPracticeKgReferences(text), (ref) => {
      const [client, docket] = Str.split(ref, ".");
      if (S.is(ClientNumber)(client) && S.is(DocketId)(docket)) {
        strong = HashSet.add(strong, alias(client));
        docketFor(client, docket);
        addEvidence(kind, `pair ${alias(client)}|${docket}`);
      }
    });
  A.forEach(document.copies, (copy) => {
    if (copy.contentHash === document.contentHash) {
      strong = HashSet.add(strong, alias(copy.clientNumber));
      O.map(copy.docket, (d) => docketFor(copy.clientNumber, d));
      addEvidence("identical-copy", `client ${alias(copy.clientNumber)}`);
    }
  });
  fullReferences(document.text, "full-reference");
  // A public result may contribute only when this document actually cites its numeric key.
  const cited = (number: string) =>
    new RegExp(`(?<![0-9])${number}(?![0-9])`, "u").test(Str.replace(/[/, .-]/gu, "")(document.text)) ||
    O.exists(document.extraction, (e) =>
      A.some([...e.extraction.applicationNumbers, ...e.extraction.patentNumbers], (n) => digits(n) === number)
    );
  A.forEach(document.uspto, (record) => {
    if (!cited(record.query.number)) return;
    O.map(record.facts.docketNumber, (d) => fullReferences(d, "uspto-docket"));
    O.map(record.facts.firstApplicant, (applicant) =>
      A.forEach(
        A.filter(names(context), (n) => nameMatches(n.name, applicant)),
        (n) => vote(n.key, "uspto-applicant", "uspto-applicant", 4)
      )
    );
  });
  A.forEach(contactTokens(document, context), (t) =>
    tokenVotes(
      t.token,
      A.map(t.links, (l, i) => [l.clientNumber, linkWeight(l.source), `${t.token}|${t.contactId}|${i}`] as const),
      t.kind
    )
  );
  A.forEach(
    A.filter(names(context), (n) => n.name.length >= 6 && phraseIn(normalText, n.name)),
    (n) => tokenVotes(token("client-name", n.name), [[n.key, 3, token("client-name", n.name)]], "client-name")
  );
  O.map(document.extraction, ({ extraction, verdict }) => {
    A.forEach(A.dedupe(verdict.keepDockets), (index) =>
      O.map(A.get(extraction.dockets, index), (d) => {
        if (Str.includes(normal(d.quote))(normalText) && Str.includes(normal(d.text))(normal(d.quote)))
          fullReferences(d.text, "full-reference");
      })
    );
    A.forEach(A.dedupe(verdict.keepParties), (index) =>
      O.map(A.get(extraction.parties, index), (party) => {
        const weight = roleWeight(party.role);
        if (
          weight === 0 ||
          !Str.includes(normal(party.quote))(normalText) ||
          !Str.includes(normal(party.name))(normal(party.quote))
        )
          return;
        const name = normal(party.name);
        A.forEach(
          A.dedupe(
            A.map(
              A.filter(names(context), (n) => partyNamesClient(n.name, party.name)),
              (n) => n.key
            )
          ),
          (client) => contentVote(client, `${party.role}:client-name`, "client-name", weight)
        );
        if (name.length >= 6)
          A.forEach(
            A.dedupe(
              A.flatMap(
                A.filter(
                  context.contacts,
                  (c: Contact) =>
                    normal(c.displayName) === name || O.exists(c.organization, (org) => normal(org) === name)
                ),
                (c: Contact) =>
                  A.map(
                    A.filter(c.links, (l) => A.contains(strongLinkSources, l.source)),
                    (l) => l.clientNumber
                  )
              )
            ),
            (client) => contentVote(client, `${party.role}:contact`, "contact-name", weight)
          );
        if (name.length < 6) return;
        const mentions = phraseMatcher(party.name);
        const learned = A.filter(filter.training, (t) => mentions(t.text));
        const owners = A.dedupe(A.map(learned, (t) => t.clientNumber));
        const hashes = A.dedupe(A.map(learned, (t) => t.contentHash));
        if (owners.length === 1 && hashes.length >= 2)
          A.forEach(owners, (client) => contentVote(client, `${party.role}:learned`, "learned-name", weight));
      })
    );
  });
  const bare = A.filter(extractPracticeKgReferences(document.text), S.is(DocketId));
  A.forEach(bare, (docket) => {
    const owners = A.filter(context.pairs, (p) => p.docket === docket);
    A.forEach(owners, (pair) => {
      vote(pair.clientNumber, `known-pair:${docket}`, "known-pair", 1);
      if (owners.length === 1 && HashSet.size(strong) === 0)
        vote(pair.clientNumber, `single-owner:${docket}`, "known-pair", 1);
      docketFor(pair.clientNumber, docket);
    });
  });
  // Combined score: content weight plus text votes capped at three; text counts as one independent source.
  const scores = M.empty<ClientKey, number>();
  A.forEach(A.fromIterable(contentScores), ([key, score]) => M.set(scores, key, score));
  A.forEach(A.fromIterable(votes), ([key, count]) =>
    M.set(scores, key, O.getOrElse(M.get(scores, key), () => 0) + Math.min(count, 3))
  );
  const independent = (key: ClientKey) =>
    HashSet.size(O.getOrElse(M.get(contentSources, key), () => HashSet.empty<string>())) +
    (O.isSome(M.get(votes, key)) ? 1 : 0);
  const ranked = A.sort(
    A.fromIterable(scores),
    (a: readonly [ClientKey, number], b: readonly [ClientKey, number]) =>
      Order.Number(b[1], a[1]) || Order.String(a[0], b[0])
  );
  const top = A.head(ranked);
  const runner = O.getOrElse(
    O.map(A.get(ranked, 1), ([, score]) => score),
    () => 0
  );
  const { client, tier } = decide(strong, top, runner, independent);
  const candidates = O.flatMap(client, (key) => M.get(dockets, key));
  const docket = O.flatMap(candidates, (ds) => (HashSet.size(ds) === 1 ? ds.pipe(A.fromIterable, A.head) : O.none()));
  return Resolution.make({
    clientNumber: client,
    docket,
    tier,
    evidence: A.dedupeWith(evidence, S.toEquivalence(EvidenceLine)),
  });
});

/**
 * Separately classifies unresolved blank forms or operator-designated firm folders.
 * No administrative organisation decision attributes a document to a client.
 * **Example** (Leave an unclassified document alone)
 *
 * ```ts
 * import { OrganisationRules, organiseDocument } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(organiseDocument("", "", "other", false, OrganisationRules.make({ firmFolders: [], formFolders: [] })).kind) // "unresolved"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const organiseDocument: {
  (
    text: string,
    docType: string,
    hasPrincipalParty: boolean,
    rules: OrganisationRules
  ): (path: string) => OrganisationDecision;
  (
    path: string,
    text: string,
    docType: string,
    hasPrincipalParty: boolean,
    rules: OrganisationRules
  ): OrganisationDecision;
} = dual(
  5,
  (
    path: string,
    text: string,
    docType: string,
    hasPrincipalParty: boolean,
    rules: OrganisationRules
  ): OrganisationDecision => {
    const within = (folder: string) => path === folder || Str.startsWith(`${folder}/`)(Str.replace(/\\/gu, "/")(path));
    if (A.some(rules.firmFolders, within)) return OrganisationDecision.make({ kind: "firm" });
    const placeholder = /_{3,}|\[(?:NAME|DATE|COMPANY)\]|<[^>]+>|\bXX+\b/u.test(text);
    return OrganisationDecision.make({
      kind:
        !hasPrincipalParty &&
        placeholder &&
        A.contains(["agreement", "assignment", "form"], docType) &&
        A.some(rules.formFolders, within)
          ? "form"
          : "unresolved",
    });
  }
);
