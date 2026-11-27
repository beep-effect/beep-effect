# Sources for the social mapper catalog

Placeholders name values supplied by the caller. Literal query keys preserve the spelling used in URLs. A provider's API can assign another identifier to the same item. The catalog describes public-facing routes and selected media sections.

| Platform | Basis for parameter and route choices |
| --- | --- |
| Instagram | Meta documents the media fields `username`, `shortcode`, and `permalink`. The gallery example supplied for this catalog uses the literal query key `img_index`. `galleryIndex` and `highlightId` are catalog names. The gallery selection behavior was not independently exercised in a logged-in browser. [Meta media reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/v21.0/) |
| Facebook | VidBee's `facebook-gallery.ts` reads `id` from the profile query and `fbid` from a photo URL. `userId`, `photoId`, and `reelId` describe those values locally. |
| Fansly | Fansly identifies the profile path segment as the username. The post form comes from VidBee browser-capture fixtures. [Fansly profile names](https://help.fansly.com/en/articles/12328861-managing-my-fansly-name) |
| OnlyFans | VidBee's `onlyfans-profile.ts` and UI `profile-mapper-target.ts` supply the username and numeric post conventions. |
| Pinterest | Pinterest identifies the profile segment as the username and the numeric pin segment as the Pin ID. [Profile usernames](https://help.pinterest.com/en/article/law-enforcement-guidelines) · [Pin IDs](https://help.pinterest.com/en-gb/business/article/find-ids-in-ads-manager) |
| RedGifs | VidBee's `mapped-profile-source.ts` accepts the users and watch paths. `gifId` is the catalog name for the watch segment. |
| Snapchat | Snapchat documents the term username. The public paths come from VidBee's `snapchat.ts`. VidBee's own story-snap query key is outside the public catalog. [Snapchat usernames](https://help.snapchat.com/hc/en-us/articles/7012349845140) |
| YouTube | YouTube documents handle, channel ID, and legacy username URLs. Google's API also uses the term video ID. [Channel URLs](https://support.google.com/youtube/answer/6180214) · [Video IDs](https://developers.google.com/youtube/data/sample_requests) |
| Threads | VidBee's `threads.ts` accepts username, media, and post paths. `shortcode` is the local name for the post path segment. |
| TikTok | TikTok identifies the numeric public video path segment as the post ID. VidBee's `social-media.ts` also recognizes the photo form. [TikTok embed player](https://developers.tiktok.com/docs/en/embed-player) |
| VSCO | VSCO documents the username in its public URL. VidBee's `vsco.ts` supplies the gallery aliases and media and video detail routes. [VSCO profile sharing](https://support.vsco.co/en/articles/12698539-how-to-share-my-vsco-profile-on-my-instagram-website-or-blog) |
| X | X illustrates the username and post ID in status URLs. VidBee's `social-media.ts` supplies the profile tabs. [X Help](https://help.x.com/en/using-x/media-studio-faqs) |
| Reddit | VidBee's `social-media.ts` handles both user path prefixes and the comments permalink. Reddit's brand page publishes the logo SVG used by the catalog. [Reddit brand assets](https://redditinc.com/brand) |
| Dzen | VidBee's `dzen-profile.ts` recognizes a channel name or channel ID. The catalog includes the profile roots only. |
