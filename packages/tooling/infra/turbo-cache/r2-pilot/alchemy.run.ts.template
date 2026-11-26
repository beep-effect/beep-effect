import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "BeepTurboR2Pilot",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const name = yield* Config.String("R2_PILOT_BUCKET_NAME").pipe(Config.withDefault("beep-turbo-r2-pilot"));
    const bucket = yield* Cloudflare.R2.Bucket("Artifacts", {
      name,
      storageClass: "Standard",
      jurisdiction: "default",
      publicAccess: false,
      forceDestroy: false,
      lifecycleRules: [
        {
          id: "expire-cache-artifacts",
          enabled: true,
          prefix: "",
          deleteObjectsTransition: { condition: { type: "Age", maxAge: 2592000 } },
        },
        {
          id: "abort-incomplete-uploads",
          enabled: true,
          prefix: "",
          abortMultipartUploadsTransition: { condition: { type: "Age", maxAge: 86400 } },
        },
      ],
    });
    return { bucketName: bucket.bucketName };
  })
);
