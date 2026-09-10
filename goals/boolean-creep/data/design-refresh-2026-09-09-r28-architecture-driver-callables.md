# R28 architecture and driver callable withdrawals

Frozen source: `93217d998f851e2e93d9864e2b5315552eaa58a7`; corpus main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

The completed independent architecture/ecosystem and drivers-s-z reports contain
no new rows, but their completion receipts identify the ineligible seeded
functions below. Parent source inspection through graft and exact matcher/guard
spans confirms those declarations. The wrappers themselves are callable values;
their Boolean results are not stored together in the alleged owners. These
records fail the eligibility net before D1/D2 cardinality. The real configuration,
token projections, Spec timestamp and stream-state owners remain in the census.

| Stable ID | Declaration proof |
| --- | --- |
| `r3-arch-ecosystem-internal-work-item-status-predicates` | `packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts`: WorkItem.model.ts:154-187 constructs matcher functions; acceptsAssignment/Completion/Reopen are passed as callbacks at 247/292/336 and isCompleted is invoked at 289. |
| `r3-arch-ecosystem-internal-pg-extras-node-probes` | `packages/ecosystem/effect-drizzle/src/pg/extras.ts`: pg/extras.ts:440-451 declares four functions accepting unknown, including hasColumns with a numeric parameter; no stored Boolean node-probes bag. |
| `r3-arch-ecosystem-internal-sqlite-extras-node-probes` | `packages/ecosystem/effect-drizzle/src/sqlite/extras.ts`: sqlite/extras.ts:294-302 declares three callable structural probes, not a co-carried bit vector. |
| `r3-drivers-arch-pg-column-numeric-filters` | `packages/ecosystem/effect-drizzle/src/pg/Column.ts`: pg/Column.ts:437-439 declares two functions over unknown numeric inputs. |
| `r3-drivers-arch-pg-column-identity-integer` | `packages/ecosystem/effect-drizzle/src/pg/Column.ts`: pg/Column.ts:1182-1183 and 1191-1192 declares callable guards on distinct inputs. |
| `r3-drivers-arch-pg-combinators-string-type` | `packages/ecosystem/effect-drizzle/src/pg/combinators.ts`: pg/combinators.ts:87-101 defines AST and schema predicate functions; the latter calls the former. |
| `r3-drivers-arch-sqlite-column-spec-guards` | `packages/ecosystem/effect-drizzle/src/sqlite/Column.ts`: sqlite/Column.ts:363 and 372-418 defines isIntegerIdent and isSpec functions. |
| `r3-drivers-arch-sqlite-derive-json-nullable` | `packages/ecosystem/effect-drizzle/src/sqlite/derive.ts`: sqlite/derive.ts:86-92 and 180-181 defines schema predicate functions. |
| `r3-drivers-arch-pg-array-rectangular-elements` | `packages/ecosystem/effect-drizzle/src/pg/combinators.ts`: pg/combinators.ts:1052-1062 defines recursive predicate functions with unknown/depth/accepts parameters. |
| `r3-drivers-arch-entity-id-like-guards` | `packages/ecosystem/effect-drizzle/src/core/entity-id.ts`: core/entity-id.ts:17 and 52 derives callable schema guards using is(schema). |
| `r3-drivers-arch-meta-fk-references-guards` | `packages/ecosystem/effect-drizzle/src/core/Meta.ts`: core/Meta.ts:89-94 and 117-128 declares function type guards; no Boolean data carrier. |
| `r25-architecture-ecosystem-internal-pg-spec-guards` | `packages/ecosystem/effect-drizzle/src/pg/Column.ts`: pg/Column.ts:1058-1085 assigns Constructors.$is(tag) predicate functions to guards, not Boolean values. |
| `r25-architecture-ecosystem-internal-sqlite-spec-guards` | `packages/ecosystem/effect-drizzle/src/sqlite/Column.ts`: sqlite/Column.ts:473-484 assigns Constructors.$is(tag) predicate functions to guards. |
| `wink-token-punctuation-word-like` | `packages/drivers/wink/src/WinkTools.service.ts`: WinkTools.service.ts:51-57 defines separate functions accepting Token; isWordLikeToken calls isPunctuationToken. |
| `venice-response-content-type-classifiers` | `packages/drivers/venice-ai/src/VeniceAI.service.ts`: VeniceAI.service.ts:1524-1527 declares Content-Type predicate functions. |
| `xai-response-content-type-classifiers` | `packages/drivers/xai/src/XAi.service.ts`: XAi.service.ts:236-239 declares Content-Type predicate functions. |
| `r3-drivers-arch-wink-utils-ngram-shape` | `packages/drivers/wink/src/WinkUtils.service.ts`: WinkUtils.service.ts:63-65 declares unknown-input type-guard functions. |
| `r3-drivers-arch-xai-http-ws-base-url` | `packages/drivers/xai/src/XAi.config.ts`: XAi.config.ts:25-26 derives protocol predicates and passes them into S.makeFilter at 45/79. |
| `r3-drivers-arch-venice-content-type-probes` | `packages/drivers/venice-ai/src/VeniceAI.service.ts`: VeniceAI.service.ts:1529-1530 and 1717 declares functions on operation descriptors and response content types. |
| `r3-drivers-arch-uspto-download-host-probes` | `packages/drivers/uspto/src/Uspto.service.ts`: Uspto.service.ts:152-153 and 231-238 declares guards on unknown option input versus URL and configured host. |

## Preservation and evidence boundary

All twenty rows are archived byte-for-byte before withdrawal. No qualified
record, design, callable implementation, package source or test is changed.
The two original JSONL reports and execution receipts remain immutable.
These withdrawals provide no implementation, P3 or dry-round credit. Other
current R28 reports and native audits have separate integrations.

Source SHA-256 values:

- `packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts`: `205aa68436cf1c1bc8adcaba912309c0390539a379dbcc0cf831acae430636cd`
- `packages/drivers/uspto/src/Uspto.service.ts`: `3af8c2101a47f3e4bd60f00590f3e34be73ddf249340a40cf8971e570f38afc2`
- `packages/drivers/venice-ai/src/VeniceAI.service.ts`: `4e9faff72bfecf5c10a2ad7761402653639475abb26574addf72ad0c6d1c0964`
- `packages/drivers/wink/src/WinkTools.service.ts`: `9aa49cc0f166a8d34b2807acf1c3972f4a44a43042ffca2283c8608a3000dd79`
- `packages/drivers/wink/src/WinkUtils.service.ts`: `b5fa6233e91fcb02d05d3d65d73f93ba7a63e982fece1e332160bd37eb16dbca`
- `packages/drivers/xai/src/XAi.config.ts`: `ed87605952037fef2283d8101d1cc36965a9148c2a3a6d906a04bd74fda16c50`
- `packages/drivers/xai/src/XAi.service.ts`: `79576b76274219d65ac32ae1bf7e41f1942bc7941f28db576e4d607fc783f277`
- `packages/ecosystem/effect-drizzle/src/core/Meta.ts`: `95085cfd5e3b69300e5d6857b16cf1da81aea7ee7582106aacdf7ac05b7daeac`
- `packages/ecosystem/effect-drizzle/src/core/entity-id.ts`: `8cae47471f2f3695036107fd0b509334661e74a36254a89a8646e29e066660fb`
- `packages/ecosystem/effect-drizzle/src/pg/Column.ts`: `f9596bb0b1bfe2adc0c78c955533ef602f79fb3ca71116fb03873e98dfaf9bc6`
- `packages/ecosystem/effect-drizzle/src/pg/combinators.ts`: `acdf86b2b7d76015e1fd46c92a58d7f9d3536e85c191839d9af4df66fb641184`
- `packages/ecosystem/effect-drizzle/src/pg/extras.ts`: `5d2b8a6675a225b2015cba9b0a0b98493cce67a3aa24fd9d37d9c899a6bef112`
- `packages/ecosystem/effect-drizzle/src/sqlite/Column.ts`: `f092a834702390399a3dd21bfae8312d2f03aa11e49ca0c3b6466cb5ea58272a`
- `packages/ecosystem/effect-drizzle/src/sqlite/derive.ts`: `98405739445e7ab945cef435e73cf14f0eee02025fb482f03a570eb39b8a4791`
- `packages/ecosystem/effect-drizzle/src/sqlite/extras.ts`: `0eece70659253e77e2c8be9a4689fde31635aa5f2548d22ea60b53782483ab67`
