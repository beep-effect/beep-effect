/**
 * External extraction and independent review contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * External extractor instructions matching ExtractionRecord in the use-case slice.
 * **Example** (Inspect the output contract)
 *
 * ```ts
 * import { documentExtractorPrompt } from "@beep/law-practice-server/DocumentIdentification"
 * console.log(documentExtractorPrompt.includes("extract.jsonl")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const documentExtractorPrompt = `Work locally from input.jsonl only. Never use the network.
Each input is {id, fileName, text}. Write one extract.jsonl record per input id:
{"id":"same id","extraction":{"docType":"other","title":null,"parties":[],"dockets":[],"applicationNumbers":[],"patentNumbers":[],"emails":[],"dates":[]}}.
The shape is ExtractionRecord from @beep/law-practice-use-cases/DocumentIdentification.
Document types: agreement, assignment, declaration-or-power, correspondence-letter, email,
office-action, response-or-amendment, application-or-specification, claims, drawings,
invoice-or-billing, search-or-opinion, filing-receipt-or-notice, form, note-or-memo, other.
Parties: {name, kind: person|organization, role, quote}.
Roles: applicant, inventor, assignee, assignor, client, counterparty, addressee,
signatory, author, recipient, other.
Dockets: {text, quote}, with the reference exactly as written.
Every party and docket requires a verbatim quote from the document demonstrating its name,
reference and role. Leave uncertain facts out. Never infer a client or invent a reference.
Exclude the firm's attorney, firm identity, letterhead and its contact information.
Title is the written subject or title, or null. Numbers, emails and dates are as written.
Empty arrays are correct. Output JSON Lines only and stop.`;
/**
 * Independent critic instructions matching CriticRecord and validated accepted indexes.
 * **Example** (Inspect critic output contract)
 *
 * ```ts
 * import { documentCriticPrompt } from "@beep/law-practice-server/DocumentIdentification"
 * console.log(documentCriticPrompt.includes("keepDockets")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const documentCriticPrompt = `Independently review input.jsonl and extract.jsonl locally.
Never use the network. Write one critic.jsonl record per input id:
{"id":"same id","verdict":{"keepParties":[],"keepDockets":[],"docType":"other","problems":[]}}.
The shape is CriticRecord from @beep/law-practice-use-cases/DocumentIdentification.
Indexes are zero-based indexes in that id's extraction arrays. Retain a party only when its
quote occurs verbatim, its name is inside the quote, and its stated role is justified.
Drop the firm and attorney even if the extractor included them. Retain a docket only when its
quote contains the reference verbatim and the document uses it as a docket or file reference,
not a date, telephone, application number or page number. Correct docType using the extractor
contract's document type vocabulary. Give brief problems for rejected claims. When uncertain,
drop the claim. Output JSON Lines only and stop.`;
