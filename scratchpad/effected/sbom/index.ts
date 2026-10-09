/**
 * Software-supply-chain artifacts as Effect schemas: a CycloneDX 1.6 SBOM, the
 * NTIA minimum-elements report, in-toto statements and SLSA provenance, and
 * Sigstore DSSE signing.
 *
 * The SBOM half is pure and reaches no external dependency; only
 * `SigstoreSigner` imports `@sigstore/*`, so a consumer that emits an SBOM
 * never pulls Fulcio's transport into its bundle.
 *
 * @packageDocumentation
 */

export { Package, Person, Repository } from "../package-json/index.ts";
export { IdentityToken, IdentityTokenError, type IdentityTokenShape } from "./IdentityToken.ts";
export {
	CYCLONEDX_BOM_PREDICATE,
	IN_TOTO_STATEMENT_V1,
	InTotoStatement,
	type InTotoStatementInput,
	InTotoSubject,
	type InTotoSubjectInput,
	InvalidSha256DigestError,
	type PredicateType,
	Sha256Digest,
} from "./InTotoStatement.ts";
export { NtiaElement, NtiaElementId, NtiaReport } from "./NtiaReport.ts";
export { Sbom, type SbomInput, type SbomJsonOptions, SbomWriteError } from "./Sbom.ts";
export {
	Component,
	ComponentType,
	Contact,
	ExternalReference,
	ExternalReferenceType,
	SbomDocument,
	SbomMetadata,
	Supplier,
} from "./SbomDocument.ts";
export {
	type ComponentInput,
	type CopyrightYears,
	type SbomMetadataOptions,
	SbomMetadataSource,
} from "./SbomMetadataSource.ts";
export { IN_TOTO_PAYLOAD_TYPE, SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigstoreBundle } from "./SigstoreBundle.ts";
export {
	SIGSTORE_OIDC_AUDIENCE,
	SigningError,
	SigningErrorKind,
	SigstoreSigner,
	type SigstoreSignerOptions,
	type SigstoreSignerShape,
} from "./SigstoreSigner.ts";
export {
	GITHUB_BUILD_TYPE,
	type GitHubWorkflowProvenance,
	SLSA_PROVENANCE_V1,
	SlsaBuildDefinition,
	SlsaProvenance,
	SlsaRunDetails,
} from "./SlsaProvenance.ts";
