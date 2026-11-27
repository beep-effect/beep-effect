# Meta platforms: post and profile payload shapes (Instagram, Threads, Facebook)

Research date 2026-11-26. Read-only. Purpose: derive a platform-neutral post/profile schema from real payloads.

## Sources and confidence legend

| Key | Source | Kind |
| --- | --- | --- |
| GDL | gallery-dl 1.32.12-dev `extractor/instagram.py`, `facebook.py` (VidBee's bundled copy, `~/.cache/vidbee-social-python/.../gallery_dl/extractor/`) | extractor source (X) |
| VB-IG / VB-TH | VidBee `apps/desktop/resources/gallery-dl-extractors/instagram_web.py`, `threads_web.py` (Relay ops captured 2026-09/10) | extractor source (X) |
| IL | instaloader `structures.py` (master, fetched today) | X |
| IGR | instagrapi `extractors.py`, `types.py` (master, fetched today) | X |
| TA | junhoyeo/threads-api `threads-types.ts` (ARCHIVED 2023-09, dated) | X, stale |
| YT | yt-dlp (VidBee vendor) `instagram.py`, `facebook.py` | X |
| D | developers.facebook.com: IG Media, IG User, IG media-container, Threads Media/Profiles/Posts/Replies, Graph Post, StoryAttachment, Page | docs (D) |
| R | recalled from earlier payload experience, NOT confirmed by any source here: treat as UNKNOWN until verified | R |

**Live verification: NONE.** I opened instagram.com/instagram in a new Chrome tab. `read_network_requests` lists URLs only
(`POST /api/graphql`, no bodies or friendly names), and a read-only in-page `fetch` of `web_profile_info` was refused by the
auto-mode permission classifier. I did not work around that, did not visit Threads or Facebook, and closed the tab. Every row
below is X, D or R. Getting L-grade rows needs the operator to allow in-page reads, or a HAR export of the three public pages.

VidBee itself does not parse these payloads in TypeScript. `packages/downloader-core` shells out to gallery-dl/yt-dlp and only
reads `id`, `shortcode`, `taken_at`, `extension`, `full_name`, `profile_pic_url[_hd]`. The real parsing is in the Python
extractors listed above.

---

## 1. Instagram

There are three payload families, and a model should accept all of them:
(a) **private REST / XDT** objects (`/api/v1/media/{id}/info/`, Relay `xdt_api__v1__*` connections; GDL `_parse_post_rest`).
This is the current web default.
(b) **legacy GraphQL** `Graph*` nodes (`shortcode_media`, `edge_*`; GDL `_parse_post_graphql`, IL). Still emitted by some
logged-out paths.
(c) **Graph API** (business/creator accounts only, D).

Current web Relay ops: `PolarisProfilePostsTabContentQuery_connection` → `xdt_api__v1__feed__user_timeline_graphql_connection`;
reels tab → `fetch__XDTUserDict`; tagged tab → `xdt_api__v1__usertags__user_id__feed_connection`; stories/highlights →
`PolarisStoriesV3ReelPageGalleryQuery` → `xdt_api__v1__feed__reels_media__connection`; logged-out post →
`PolarisLoggedOutDesktopWWWPostRootContentQuery` → `data.xig_polaris_media.if_not_gated_logged_out` (YT). Pagination: Relay
`edges[].node` + `page_info{has_next_page,end_cursor}`; REST `items[]` + `more_available` + `next_max_id` (GDL).

### POST

| Concept | Payload path / field | Type, encoding | Present when | Src |
| --- | --- | --- | --- | --- |
| numeric id | REST `pk`; GraphQL `id` | int or numeric string (64-bit: keep as string) | always | GDL, IGR |
| composite id | REST `id` = `"{pk}_{owner_pk}"` | string | REST | IGR (`id` separate from `pk`) + R for format |
| shortcode (URL id) | REST `code`; GraphQL `shortcode` | base64url of pk, alphabet `A-Za-z0-9-_` | always; private-share codes are ~28 chars longer and cannot be decoded | GDL, IL, YT |
| URL | `/p/{code}/`; `/reel/{code}/` for single-video clips; `/stories/{user}/{pk}`; `/stories/highlights/{id}/` | derived | | GDL |
| kind | `media_type` 1 image, 2 video, 8 carousel; `product_type` `feed`/`clips`/`igtv`/`carousel_container`; GraphQL `__typename` `GraphImage/GraphVideo/GraphSidecar` | int enum / string | always | GDL, IGR, IL |
| caption | REST `caption.text` (`caption` may be `null`); GraphQL `edge_media_to_caption.edges[0].node.text` | string | one per post | GDL, IL |
| per-item caption | Relay var `include_multi_captions: true` + provider `PolarisMultiCaptionCarouselEnabled`; field name UNKNOWN | ? | new, 2026 | VB-IG |
| carousel container | REST `carousel_media[]` (+ `carousel_media_count`); GraphQL `edge_sidecar_to_children.edges[].node` | array | `media_type == 8` | GDL |
| carousel item | `pk`, `code`?, `media_type`, `image_versions2`, `video_versions`, `original_width/height`, `usertags`, `accessibility_caption` | object | per child | GDL, IL |
| max items | 20 (publish limit) | | | D |
| alt text | REST/GraphQL `accessibility_caption` (per item; auto-generated or user-written, not distinguished); Graph `alt_text` (≤1000 chars, images only) | string | optional | IL, D |
| dimensions | REST `original_width/height` (item); candidate `width/height`; GraphQL `dimensions{width,height}` | int px | always | GDL |
| people tags | REST `usertags.in[]` = `{user{pk,username,full_name,...}, position:[x,y]}`; GraphQL `edge_media_to_tagged_user.edges[].node.user{id,username,full_name}` (+`x`,`y` R) | x,y float in [0,1] from left/top | **per carousel item** (tags are read from each child) | GDL, IGR, D |
| caption @mentions | raw text only; every extractor regexes `caption.text`. No entity ranges | — | | IL, GDL |
| hashtags | raw text only (regex) | — | | IL, GDL |
| co-authors (collab) | REST `coauthor_producers[]{pk,username,full_name}`; GraphQL `{id,username}`; Graph `collaborators` edge (publish ≤3) | array | collab posts | GDL, IGR, D |
| paid partnership | REST `is_paid_partnership`, `sponsor_tags[].sponsor{user}`; GraphQL `edge_media_to_sponsor_user.edges[].node.sponsor` | bool + users | branded content | IGR, IL |
| location | REST `location{pk,name,short_name,lat,lng,address,city,...}`; GraphQL `location{id,slug,name}` | object | optional; IL says login needed | GDL, IGR, IL |
| audio | reels: `clips_metadata` (`music_info.music_asset_info` or `original_sound_info`); photo music: `music_metadata.music_info`; fields `title`, `display_artist`, `ig_artist`, `duration_in_ms`, `progressive_download_url`, `dash_manifest`, `audio_asset_id` | object | optional | GDL, IGR |
| product tags | private shape UNKNOWN; Graph publish `product_tags[{product_id,x,y}]` (≤5, x,y in [0,1]) | | | D |
| outbound link | none in feed posts (captions are not linkified); links only exist on stories (stickers) and in the bio | | | IGR (R: no feed link field) |
| like count | REST `like_count`; GraphQL `edge_media_preview_like.count`; Graph `like_count` (omitted when hidden) | int | hidden → `like_and_view_counts_disabled: true`, the value is then unreliable | GDL, IGR, D |
| comment count | REST `comment_count`; GraphQL `edge_media_to_comment.count` / `edge_media_preview_comment.count`; `comments_disabled` | int | | YT, IGR |
| views/plays | REST `play_count`, `ig_play_count` (R), `view_count`; GraphQL `video_view_count`, `video_play_count` (null logged out) | int | video only | IL, IGR |
| reshares | Graph `shares_count`, `reposts_count` (owner/FB-login only); private field UNKNOWN | int | | D |
| timestamp | REST `taken_at`; GraphQL `taken_at_timestamp`; Graph `timestamp` | unix **seconds** / ISO 8601 UTC | always | GDL, D |
| image variants | REST `image_versions2.candidates[]{url,width,height,scans_profile}`; GraphQL `display_url`, `display_resources[]{src,config_width,config_height}`, `thumbnail_src` | array, largest is not guaranteed first | always (also on videos, as poster) | GDL, IL, IGR |
| video variants | REST `video_versions[]{type,width,height,url,id}`; GraphQL `video_url`; `video_duration`, `has_audio` | array | video | GDL, YT, TA |
| DASH | REST `video_dash_manifest` (MPD XML string) | string | video, usually | GDL, YT |
| pinned | `timeline_pinned_user_ids` / `clips_tab_pinned_user_ids`; GraphQL `pinned_for_users[]` | user ids | pinned | GDL |

**Stories and highlights.** A reel = `{id, items[], user, expiring_at?, title?, latest_reel_media, media_count}`. Story reel id =
user pk; highlight reel id = `"highlight:{n}"`. An item is a normal media object plus `expiring_at` (unix s, taken_at + 24 h).
Highlight items have no `expiring_at` and the reel has a `title`. Story extras, all with sticker geometry
`x,y,width,height,rotation` in [0,1]:
- `reel_mentions[]{user,...}`
- `story_bloks_stickers[].bloks_sticker{bloks_sticker_type:"mention", sticker_data.ig_mention{account_id,username,full_name}}`
- `story_link_stickers[].story_link{url}` (the only outbound links on Instagram)
- `story_hashtags[]`, `story_locations[]`
- `story_feed_media[]{media_id|media_code}` (a reshared post, i.e. a reference to another post)
- `story_music_stickers[]`, `reshared_story_media_author`, `audience` (close friends)

Private accounts that the viewer does not follow return an empty reel, the same shape as "no story" (VB-IG). Sources: GDL,
IGR, VB-IG.

### PROFILE

| Concept | Payload path / field | Type, encoding | Present when | Src |
| --- | --- | --- | --- | --- |
| id | `pk` (REST) / `id` (GraphQL, web_profile_info), plus `pk_id` string; Graph `id` is app-scoped and differs | numeric string | always | GDL, IL, D |
| username | `username` (renameable, so id is the stable key) | string | always | all |
| display name | `full_name`; Graph `name` | string | | all |
| biography | `biography` | string | | IL |
| bio entities | `biography_with_entities{raw_text, entities[]}`; entity shape R: `{user{username}}` / `{hashtag{name}}`, no offsets | object | | TA (shape), R |
| bio links | `bio_links[]{link_id,url,lynx_url,title,link_type,is_pinned}` (list, up to 5 per app UI: R) plus legacy single `external_url`; Graph `website` | list + string | IL: `external_url` needs login | IGR, IL, D |
| avatar, small | `profile_pic_url` (~150 px, R) | signed CDN URL | always | GDL, IL |
| avatar, HD | `profile_pic_url_hd` (web_profile_info; sometimes the same as small); `hd_profile_pic_url_info{url,width,height}`; `hd_profile_pic_versions[]{url,width,height}` (320/640, R) | URL / object / array | info/versions: logged-in `/api/v1/users/{id}/info/` | GDL, IL, IGR |
| avatar id | `profile_pic_id` = `"{picpk}_{userpk}"`; `has_anonymous_profile_picture`; Graph `has_profile_pic` | | | GDL, TA, D |
| URL expiry | CDN URLs carry signed `oe` (expiry, hex unix) / `oh` params (R); VidBee keeps "expiring CDN URLs" out of storage; IL strips `se=` | expire | | VB-IG, IL, R |
| followers | REST `follower_count`; GraphQL `edge_followed_by.count`; Graph `followers_count` | int | logged-out: from page data | IL, IGR, D |
| following | REST `following_count`; GraphQL `edge_follow.count`; Graph `follows_count` | int | | IL, IGR, D |
| post count | `media_count`; GraphQL `edge_owner_to_timeline_media.count`; logged-out page `all_media_count` | int | | IL |
| follower list | `GET /api/v1/friendships/{id}/followers/?count=12&max_id=` → `{users[], next_max_id}`; `.../following/` same. Entry = short user (`pk, username, full_name, is_private, is_verified, profile_pic_url, ...`) | max_id cursor | **login required; private accounts only if followed**; Graph API: counts only, no list | GDL, IL, D |
| verified | `is_verified` | bool | | IL |
| private | `is_private`; viewer relation `friendship_status{following,followed_by,blocking,incoming_request,outgoing_request}` or legacy `followed_by_viewer` | bool | | IL, VB-IG |
| business/creator | `is_business` / `is_business_account`, `account_type` (int; 1/2/3 meaning R), `category`, `category_name`, `business_category_name`, `is_professional_account` (R) | | IL: login needed | IL, IGR |
| pronouns | `pronouns[]` | string array | optional | TA |
| logged-out | IL: web_profile_info and the GraphQL profile query are refused logged out; the profile HTML still embeds the user, but without `external_url` or business fields | | | IL |

### Structural facts (Instagram)
- Post identity = `pk` (64-bit; store as string); `code` is a reversible base64url encoding of pk and is what the URL shows. Carousel children have their own `pk` but no permalink.
- Caption is one per post today (`caption` can be `null`). A per-item caption feature flag is live in the 2026 web client: model an optional per-item caption.
- **User tags are per carousel item**, with a normalized position `[x,y]` in [0,1] and a full user stub (pk + username). Videos may carry tags without a position.
- Mentions and hashtags in captions are plain text. No entity offsets: derive them by parsing. Bio has a separate `biography_with_entities`, but without offsets either.
- Only stories carry outbound links (link stickers) and geometry-bearing stickers. Feed posts reference other posts only through collab (`coauthor_producers`), sponsor tags and pins. Stories reference posts via `story_feed_media`.
- Counts can be hidden (`like_and_view_counts_disabled`); `play_count` and `view_count` are different metrics; logged-out views can return null.
- Media URLs are lists of signed, expiring candidates (pick the largest by w×h). Video adds `video_versions` and an optional inline DASH MPD string.

---

## 2. Threads

Two families: (a) **private web Relay** on `threads.com/graphql/query`, which needs login cookies (VB-TH). Ops:
`BarcelonaProfileMediaTabDirectQuery` (`data.mediaData.edges[].node.thread_items[].post`, `page_info`),
`BarcelonaPostPageStrongIdTargetQuery` (`data.media`), `BarcelonaUsernameHovercardImplDirectQuery` (`data.user{pk,username}`).
Post objects are Instagram-shaped. (b) **Threads Graph API** (D), for the app user's own posts plus `profile_lookup`.

### POST

| Concept | Payload path / field | Type, encoding | Present when | Src |
| --- | --- | --- | --- | --- |
| id | private `pk` (digits); API `id` (whether API id == pk is UNKNOWN) | numeric string | always | VB-TH, D |
| shortcode / URL | private `code`; API `shortcode`, `permalink`; URL `threads.com/@{user}/post/{code}`; code = base64url(pk), same alphabet as Instagram | string | permalink omitted on copyright flag | VB-TH, D |
| thread container | `node.thread_items[]`: item 0 is the root post, later items are self-replies; `thread_type`, `line_type` | array | profile feed | VB-TH, TA |
| kind | private `media_type` 1/2/8, **19 = text-only** (no candidates); API `media_type` `TEXT_POST/IMAGE/VIDEO/CAROUSEL_ALBUM/AUDIO/REPOST_FACADE` (GIF and poll posts are `TEXT_POST`) | int / enum | | VB-TH, D |
| text | private `caption.text` (`caption` may be null; also `created_at`); API `text` (≤500 chars) | string | one per post | TA, D |
| text entities | private `text_post_app_info.text_fragments` (R); API `text_entities` (its documented meaning is contradictory), `text_attachment`, `is_spoiler_media` | UNKNOWN | | D, R |
| carousel | private `carousel_media[]` (`carousel_media_count`, `carousel_media_ids`); API `children` | array, max **20**, min 2 | `media_type 8` | VB-TH, D |
| item media | `image_versions2.candidates[]{url,width,height}`, `video_versions[]{type,width,height,url,id}`, `original_width/height`; API `media_url`, `thumbnail_url` (video) | | | VB-TH, TA, D |
| alt text | API `alt_text`; private: likely `accessibility_caption` (R) | string | | D |
| people tags | none (Threads has no photo tagging): R | | | R |
| mentions / hashtags | raw `@` in text; topic tag = one per post: API `topic_tag` (1–50 chars, no `.`/`&`); in-text `#` becomes the topic | string | | D |
| links | private `text_post_app_info.link_preview_attachment{url,display_url,title,image_url}`; API `link_attachment_url`; ≤5 links per post | | | TA, D |
| repost | private `text_post_app_info.reposted_post` (VB-TH reads it here) / `share_info.reposted_post` (TA, 2023); API `reposted_post` (id), `media_type REPOST_FACADE` | Post / id | reposts | VB-TH, TA, D |
| quote | private `share_info.quoted_post` (full Post); API `is_quote_post`, `quoted_post` (id) | | quotes | TA, D |
| reply | private `text_post_app_info.reply_to_author`, `is_reply`, `direct_reply_count`, `reply_control`; API `is_reply`, `replied_to`, `root_post`, `has_replies`, `hide_status` (`NOT_HUSHED`...) | | | VB-TH, TA, D |
| other attachments | API `gif_url`, `poll_attachment` (shape undocumented), `ghost_post_status` `ACTIVE/ARCHIVED` + `ghost_post_expiration_timestamp` (ISO) | | | D |
| counts | private `like_count`, `text_post_app_info.direct_reply_count`, `like_and_view_counts_disabled`; repost/quote/view counts UNKNOWN privately; API: insights only | int | | TA |
| timestamp | private `taken_at`; API `timestamp` (`2023-10-17T05:42:03+0000`) | unix s / ISO 8601 | | VB-TH, D |
| author | private `user{pk,username,full_name,is_verified,profile_pic_url}`; API `username`, `owner{id}` (own posts only), `is_verified`, `profile_picture_url` | | | VB-TH, D |
| location / audio | UNKNOWN (API `AUDIO` type exists; field shape undocumented) | | | — |

### PROFILE

| Concept | Payload path / field | Type | Present when | Src |
| --- | --- | --- | --- | --- |
| id | private `pk` (digits; VB-TH checks it), `pk_id`, `fbid_v2`; API `id` | string | | VB-TH, TA, D |
| username / name | `username`, `full_name`; API `username`, `name` | string | | TA, D |
| biography | private `biography`, `biography_with_entities{raw_text,entities}`; API `threads_biography` (self) / `biography` (lookup) | string | | TA, D |
| bio links | private `bio_links[]{url,...}`, `external_url` | list | | TA |
| avatar | private `profile_pic_url`, `hd_profile_pic_url_info{url,width,height}`, `hd_profile_pic_versions[]`; API `threads_profile_picture_url` (self) / `profile_picture_url` (lookup) | signed URLs | | TA, D |
| followers | private `follower_count`, `following_count`; API `profile_lookup` → `follower_count` only (+ 7-day `likes_count`, `quotes_count`, `reposts_count`, `views_count`, `replies_count`) | int | lookup = public profiles | TA, D |
| follower list | API: none. Private web: UNKNOWN | | | D |
| verified / private | `is_verified`, `is_private` | bool | | TA, D |
| pronouns, category | `pronouns[]`, `account_category`, `is_business`, `category` | | | TA |
| post count | private `media_count` (2023; may count IG media) | int | | TA |

### Structural facts (Threads)
- A Threads "post" on the web is a **thread** (`thread_items[]`): item 0 is the root, the rest are self-replies, each a full Post. Reposts and replies show up in the profile feed and must be told apart via `text_post_app_info` / `share_info`.
- Quote and repost are **embedded full posts** in the private payload and **id references** in the API. Model them as a post reference with an optional inline snapshot.
- Text-only posts are first-class (`media_type 19` / `TEXT_POST`): a post with zero media items must be valid.
- Carousel max 20 items; text ≤500 chars; ≤5 links; one topic tag, no people tags.
- Links have a structured preview (`link_preview_attachment`) separate from the text.
- Everything private requires a logged-in session (VB-TH aborts without `sessionid`). Logged-out access is not modeled by any extractor.

---

## 3. Facebook

Two families: (a) **web Comet/Relay** payloads embedded in HTML or `/api/graphql/` (GDL scrapes them with string anchors, YT
traverses them). (b) **Graph API** Post/Page (D). Page-scoped tokens only; personal profiles are not readable via the API.

### POST

| Concept | Payload path / field | Type, encoding | Present when | Src |
| --- | --- | --- | --- | --- |
| id | Graph `id` = `"{page_id}_{post_id}"`; web numeric `post_id`/`story_fbid`, photo `fbid`, video id; obfuscated `pfbid…` tokens in URLs and owner ids | strings (keep raw) | always | D, GDL |
| URL | Graph `permalink_url`; web `/photo/?fbid=`, `/media/set/?set=a.{album}` / `pcb.{post}`, `/{user}/posts/pfbid…`, `/reel/{id}`, `/watch?v=` | | | D, GDL, VidBee `facebook-gallery.ts` |
| text | web `comet_sections.content.story.message.text` (video: `creation_story.comet_sections.message.story.message.text`); Graph `message`, plus `story` (auto text) | string | | YT, D |
| text entities | web `message{delight_ranges, ranges, text}` (`ranges[]{entity,offset,length}`: R); Graph `message_tags` (list; per-entry `id,name,type,offset,length` R, not on the reference page); `story_tags`; attachment `description_tags` (EntityAtTextRange) | ranges | | GDL, D |
| per-photo caption | each photo node has its own caption (`message` on photo page), separate from the post text | string | **post text AND per item** | GDL |
| multi-item | web `attachments[].styles.attachment.all_subattachments.nodes[]` (`media{__typename Photo/Video}`); album `mediaset`; Graph `attachments{type,media_type,media,target{id,url},url,unshimmed_url,title,description,subattachments}` | | albums/multi-photo | YT, D |
| item media | photo `image{uri,width,height}`; video `playable_url` (SD), `playable_url_quality_hd`, `browser_native_sd_url/hd_url`, `dash_manifest` (XML) / `playable_url_dash`; Graph `full_picture` (≤720 px), `media.image{src,width,height}` (R) | | | GDL, YT, D |
| max items | UNKNOWN | | | — |
| alt text | UNKNOWN (photo `accessibility_caption` R) | | | R |
| people tags | Graph `to` edge, `with_tags` (R), `message_tags`; photo tags with x,y (Graph Photo `tags` x/y in percent 0–100, R) | | | D, R |
| shared post | web `comet_sections.content.story.attached_story`; Graph `parent_id`, `via`, `sharedposts` edge, `child_attachments` | ref | shares | YT, D |
| links | Graph `link`, `attachments[].url` / `unshimmed_url` (l.facebook.com shim removed), `name`, `caption`, `description` | URI | link shares | D |
| location | Graph `place` (Place), `coordinates` | | | D |
| counts | web `feedback{reaction_count / i18n_reaction_count, likers.count, total_comment_count, share_count_reduced ("1.4K")}`, video `viewCount`/`video_view_count`; Graph `shares.count`, `reactions`/`comments` edges with `summary.total_count` (R) | int or **abbreviated string** | | YT, D |
| timestamp | web `creation_time` / `publish_time` / `created_time` | unix s | | GDL, YT |
| timestamp (API) | Graph `created_time`, `updated_time`, `backdated_time` | ISO 8601 `+0000` (R; the reference page says "datetime") | | D |
| author | web `owner{__typename,id,name}`, `actors[]`; Graph `from`, `admin_creator`, `target` | | | GDL, YT, D |
| paid partnership | Graph `sponsor_tags` edge (Page) | | branded | D |

### PROFILE

| Concept | Payload path / field | Type | Present when | Src |
| --- | --- | --- | --- | --- |
| id | web `user.id` (may be `pfbid…`, then numeric `userID` elsewhere on the page); Graph Page `id` | string | | GDL, D |
| username | web `userVanity` / `vanity`; Graph `username`; profiles without a vanity use `profile.php?id=` | string | optional | GDL, D |
| display name | `name` | string | | GDL, D |
| bio | web `best_description.text` (intro); Graph `about` (≤100), `description`, `bio` (webhook-only) | string | | GDL, D |
| bio entities / links | UNKNOWN (web); Graph `website`, `link`, `emails` | | | D |
| avatar | web `profilePicLarge/Medium/Small{uri}`, `profilePhoto{url}` (photo page), `user_avatar{id}`; Graph `picture` edge (ProfilePictureSource `url,width,height,is_silhouette` R), `cover` | signed URLs | | GDL, D |
| followers | Graph `followers_count`, `fan_count` (likes; equals followers on New Pages); web count string UNKNOWN | int | Pages | D |
| following | UNKNOWN | | | — |
| lists | not enumerable via the Graph API (`likes` edge = Pages this Page liked) | | | D |
| verified | Graph `verification_status` `blue_verified/gray_verified/not_verified` (`is_verified` deprecated) | enum | Pages | D |
| category | Graph `category`, `category_list[]` | | Pages | D |
| profile tabs | web `profile_tabs.profile_user.timeline_nav_app_sections.edges[].node` | | | GDL |
| private | web: "This content isn't available right now" error root; no flag | | | GDL |

### Structural facts (Facebook)
- Ids are heterogeneous: numeric ids, `{page}_{post}` composites, opaque `pfbid` tokens and set tokens (`a.`, `pcb.`, `oa.`, `pb.`). Keep the raw id plus a typed kind; do not assume numeric.
- Text has **real entity ranges** (`ranges`/`message_tags` with offset+length), unlike Instagram and Threads.
- A post with photos has post-level text **and** per-photo captions.
- Shared and attached posts nest a full story (`attached_story`); link shares carry title/description/unshimmed URL.
- Counts often arrive as localized abbreviated strings ("1.4K"), so the model needs `exact | approximate(display string)`.
- Web vs API timestamps differ in encoding (unix s vs ISO 8601).

---

## Cross-platform constraints for the generic model
1. Ids: `{ platformId: string (pk/fbid), urlCode?: string (shortcode/pfbid), compositeId?: string }`. Never use number for 64-bit ids.
2. Media items: ordered list of 0..20; each item has its own id, kind (image/video/audio), dimensions, candidate list
   `{url,width,height}[]`, optional video variants and DASH, alt text, and **item-level people tags with optional normalized point**.
3. Text: `{ raw: string, entities?: {kind: mention|hashtag|link, offset, length, target}[] }`. Entities absent on IG/Threads (derive by parse, mark `derived`), present on FB.
4. References: `{ kind: repost|quote|reply|share|collab|sponsor|story-feed-media, target: PostRef, snapshot?: Post }`.
5. Counts: each optional, plus `hidden` and `approximate` flags; distinguish views vs plays.
6. Timestamps: normalize to an instant; record source encoding.
7. URLs: signed and expiring. Store `fetchedAt`, treat as cache, never as identity.
