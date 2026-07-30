# Frozen upstream Domain baseline

## Capture

- Source checkout: `/home/elpresidank/YeeBois/dev/effect-ontology`
- Source revision: `c148102d5789a5aee3fa4332bae9d45b99478e0f`
- Captured: 2026-07-25
- Scope: `packages/@core-v2/src/Domain/**/*.ts`
- Worktree delta included: `packages/@core-v2/src/Domain/Identity.ts`
- Unrelated untracked research documents: excluded
- License: MIT; exact notice retained in `LICENSE.effect-ontology`

The manifest was produced with:

```sh
find packages/@core-v2/src/Domain -type f -name '*.ts' -print0 \
  | sort -z \
  | xargs -0 sha256sum
```

The aggregate hashes the sorted manifest text itself:

```text
9792d51eb06e002f39e7a19ce5010381e3cef40d29fcd5fe8410c5a832c000d4
```

## Per-file manifest

```text
e4722cb33fe768ef1d38cabcdfbcf9f81bab0b7389c7e5c0d10e43455c3f8b91  packages/@core-v2/src/Domain/Error/Activity.ts
9ee471dc0ff35c45e6773cfa7401c95864422be852072e90c7c0eb1aa6bfcf27  packages/@core-v2/src/Domain/Error/Auth.ts
61d939af5c8442231f0e60fe1cec18ad9c0a5b005aaa035e69433b142cc28825  packages/@core-v2/src/Domain/Error/Base.ts
31ef4905ffc6fa93b463a97fd447fe0dbd9940a324cf489475c1f214cdb76a1b  packages/@core-v2/src/Domain/Error/Circuit.ts
2df90c8351f6bb62ed9f694bb806a03dbe41fe7d94a90131f57703eee3952ebc  packages/@core-v2/src/Domain/Error/Embedding.ts
9552e810d26ab51ad7a9612596548044b4fa586e0567247e70ca9c56a6bf7f03  packages/@core-v2/src/Domain/Error/EventBus.ts
28a82de8a3e89c9e46cdc4ee1cc4ea0064564d7c5f9e0f33523a3ca48c39f55b  packages/@core-v2/src/Domain/Error/Extraction.ts
f7cfadb7ca1120b7886c2e7588609090dc39f1ed7ccfa2b312bd1414d294f805  packages/@core-v2/src/Domain/Error/Image.ts
f69757d57e446259f9164505796fcf558424894843a8db5880aca92f7be34970  packages/@core-v2/src/Domain/Error/Jina.ts
1674ebae3cbf9c3d37167ef4805a4374ee3b186fbb99bc6ac79ec34cd025e004  packages/@core-v2/src/Domain/Error/Llm.ts
0743a837e1f6bcc2943879e4690a3d3dcee547636ac20afee4e2dde9329b94f2  packages/@core-v2/src/Domain/Error/Ontology.ts
6b8b42b8e3d40e1ed542f5270db70ad1d1c9bdeb66d77f82816db323c3bc4aa8  packages/@core-v2/src/Domain/Error/Rdf.ts
ec446af9fcb16f5544b77a23e73becf86a49481027949e8dbb2101bfc7d1b440  packages/@core-v2/src/Domain/Error/Shacl.ts
c47ab2c98e914624525c23268b1ffc2a5834998962377d3055142ccda9f5f6b1  packages/@core-v2/src/Domain/Error/Sparql.ts
752faac947ab5c9f3ac379b2fddb1ffce8b6c8d0183ac5e5e117ac878335fb93  packages/@core-v2/src/Domain/Error/Workflow.ts
4280536278442b9b93d2d88667569f6df3f78a44cf72ad7c746f2c3f20951137  packages/@core-v2/src/Domain/Error/index.ts
4bd6638ac420398a06da44c404b4d124e373be4356f95916f9b7fed31a5f68bf  packages/@core-v2/src/Domain/Identity.ts
b0e409673266b66ad69dacb016ab716cf6522df71862255142cd184cd69bf504  packages/@core-v2/src/Domain/Model/Agent.ts
45cc17ee3dbb1242c3bdfd35eda841f7298faaff92c2d23d3b5b8911c8606d35  packages/@core-v2/src/Domain/Model/BatchWorkflow.ts
5b72b4cc7c5e54784cb8e0a77545039fd14d92ea4ee19eeb6d6e563dd66a9ca4  packages/@core-v2/src/Domain/Model/CoreOntology.ts
37cc215a5ca6d87adc3c4eb7ee5a11fc07e3aefc921b01eb2b6a8928d5d83ce8  packages/@core-v2/src/Domain/Model/EnrichedContent.ts
4347969280a39d04a5e35feaff47f1ad1bf1ad724b278f75719ef2e69bfe69e6  packages/@core-v2/src/Domain/Model/Entity.ts
64d2204cf7db42ba44256e2e1c3f6d735f7f73fbdcf93281a77e63b32aa23b31  packages/@core-v2/src/Domain/Model/EntityResolution.ts
2a2ac68f0fe95681eca80fd644a38413f32ceb7359742ae3f9ce99ac8e680daf  packages/@core-v2/src/Domain/Model/EntityResolutionGraph.ts
b80541f09a7a920e722b81d2462ed9affb588519d4ab122c3c0742ade4aeabe8  packages/@core-v2/src/Domain/Model/ExtractionRun.ts
7f09f5bfa7e3931143a8e710ce1d5a3d1a09547250502a398e856307471e1bc8  packages/@core-v2/src/Domain/Model/Image.ts
3b342e3d0e52bed59c06134b7e67153e34f31fbed2e9705a2d7967dab79bdc6c  packages/@core-v2/src/Domain/Model/Ontology.ts
9c1c1c750c207ed1d5d221fde8e735262c9212fa2955ea04494a2162500e0e46  packages/@core-v2/src/Domain/Model/OntologyAgent.ts
cbba1a8cd7a012c05670fa89917e13511b5e5a10ec444ff423621a0c2da81cd0  packages/@core-v2/src/Domain/Model/OntologyEmbeddings.ts
ca84afa82909dd2c2188b0c721467fe0b1690410fb78940e29908d4a8fc500da  packages/@core-v2/src/Domain/Model/OutputType.ts
d5d453317da05dac78187315d96cdca2d4c069babbf456aca9a90cb150021079  packages/@core-v2/src/Domain/Model/index.ts
4dcd563831932d6201cb4554dac5bea5d949d07bd722d8505e0797f2c159b19f  packages/@core-v2/src/Domain/Model/shared.ts
7990f2acc9c7ff46cfe548ce301f1f097b7390ca1a771e0a563e077aa1f98f04  packages/@core-v2/src/Domain/PathLayout.ts
2b489ef60196c3e5f4533a84d012dac5d06ae4344d136b065b5ca79b7b310191  packages/@core-v2/src/Domain/Rdf/Constants.ts
d3457b583ab1913f17aeb52ed37c97c49a55ea573885ede4dffd92492cd0c9f3  packages/@core-v2/src/Domain/Rdf/Types.ts
f2d7b0c47409721c91ba157e7c2b6763d6e3032e0d48f6da903ed75c34863f3d  packages/@core-v2/src/Domain/Rdf/index.ts
658e1589b1b508ee5318109f75aaeaa86481536f6e8b9942ac9b65ed2e998baf  packages/@core-v2/src/Domain/Schema/Api.ts
2a713b215a11b525a001548254d2ce71d692170f8176f89a555954ec35049bde  packages/@core-v2/src/Domain/Schema/Auth.ts
f1470ef47a718db93634bf17c2e4bc7cead73f5fe5031ccb172a2385a87ea289  packages/@core-v2/src/Domain/Schema/Batch.ts
553a8d6bf0145dcb6bad6427a5405283b7f4cfbb2682650771b37e296445dc30  packages/@core-v2/src/Domain/Schema/BatchRequest.ts
12172af820aab8999f6bfcf6712d85c8e1b423d37f2ac341c9b2325c83d1eb37  packages/@core-v2/src/Domain/Schema/BatchStatusResponse.ts
af0d4eb7510fe78eb3d1a823d3931b7dc40756d0cba2a2060551c0bfafe65d5b  packages/@core-v2/src/Domain/Schema/CurationAction.ts
7c162b9f1ff452d2074ca2bdbedcfc39cc41f4f49cefd8a5a52de37818011a6e  packages/@core-v2/src/Domain/Schema/DocumentMetadata.ts
8c13c58a2f167606fe7c95bd6f5c3ab84b6ee357342663d70aa46940d6753021  packages/@core-v2/src/Domain/Schema/EventSchema.ts
4748c5bc47052b62b0c947edfab87548cd42ecf997ee5721ffa65f5943493772  packages/@core-v2/src/Domain/Schema/Inference.ts
f724c62ee80996a42b4156dc68d894383360bad30c9e35d398c6305b609f7341  packages/@core-v2/src/Domain/Schema/JobSchema.ts
de89f33627d5548a2b8d31d647c1a26e54e655db10e55bb64d26ac132cccf2ec  packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts
62a83bfde70cd290c52e16cf9313d1a452c9d280bf475fdc19187a109d35428a  packages/@core-v2/src/Domain/Schema/LinkIngestion.ts
aac2d1afd0a97a1d2263d542b06368fa42733858d1759f6b210c009dcf3bbfdd  packages/@core-v2/src/Domain/Schema/OntologyBrowser.ts
6a9ae722018ee2a26eb2e792a56bb241a6e41990095f3440270cfc97973f9f7e  packages/@core-v2/src/Domain/Schema/OntologyRegistry.ts
fb99f0f0bc47fa4902965cae2b37923ddbee9df13c13b1699b5d08600e59f4d9  packages/@core-v2/src/Domain/Schema/Search.ts
e08a6786680eb40484a6b6583d7053e01bbe6e6b46f59830dc6df844cccdf660  packages/@core-v2/src/Domain/Schema/Shacl.ts
65024cc2f2f7f8ece617cb0107914ef6e228fd902aed746e59f7bd09c324ffe1  packages/@core-v2/src/Domain/Schema/Timeline.ts
19233913d4aab2679641d68c811b5bdce28c299c4013a137ef8a19fb4539293e  packages/@core-v2/src/Domain/Schema/index.ts
0b0034135ee9b2ae4e6856022eafb31c9682be4f69d37b05d614702b1ef462ee  packages/@core-v2/src/Domain/index.ts
```
