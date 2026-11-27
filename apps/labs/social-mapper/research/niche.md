# Post and profile payloads: OnlyFans, Fansly, RedGifs, Snapchat, Pinterest, VSCO, Dzen

Researched 2026-11-26. Read-only. Field names come from source code and from live shape probes.
Every probe recorded keys and JSON types only and discarded the values. No real person's data is
reproduced here.

Source tags:
- **[VB]**: VidBee fork `~/YeeBois/workstation-apps/VidBee` (`packages/browser-capture/src/*-profile.ts`,
  `packages/downloader-core/src/*`, `apps/desktop/resources/gallery-dl-extractors/snapchat_web.py`).
- **[VB-ytdlp]**: VidBee's vendored yt-dlp (`vendor/yt-dlp/yt_dlp/extractor/onlyfans.py`, `yandexvideo.py`).
- **[GDL]**: gallery-dl 1.32.17 extractors (pipx venv), plus `test/results/*.py` from 1.33.0-dev.
- **[USA]**: UltimaScraperAPI `apis/{onlyfans,fansly}/classes/*_model.py`.
- **[OFS]**: OF-Scraper `ofscraper/classes/of/*.py` and `sites/fansly/normalize.py`.
- **[FSPEC]**: reverse-engineered Fansly spec at `goslingmanagment/hub` `reference/fansly_api_spec.md`.
  This is a community document, not official.
- **[PIN5]**: official Pinterest API v5 OpenAPI (`pinterest/api-description` `v5/openapi.json`).
- **[LIVE]**: keys-only probe of a public payload made today. Brand or test accounts only.
- **UNVERIFIED**: recalled from memory and not confirmed by any source above.
- **UNKNOWN**: could not be established.

---

## 1. OnlyFans (private web API `onlyfans.com/api2/v2`, signed requests, login required)

### POST (`GET /api2/v2/posts/{postId}`, `/users/{userId}/posts?order=publish_date_desc&beforePublishTime=`)
| concept | payload path / field | type, encoding | present when | source |
|---|---|---|---|---|
| id | `id` | int | always | VB-ytdlp, USA |
| URL | `onlyfans.com/{postId}/{username}`; one item is `.../{postId}/{username}/media/{mediaId}` | — | — | VB |
| author | `author{id,_view}`, `fromUser{id}` (messages) | obj | omitted when `skip_users=all` | OFS, UNVERIFIED for `author` |
| text | `text` (HTML), `rawText` (plain with markup) | string | always; `lockedText` bool when paywalled | USA, VB-ytdlp |
| title | none. yt-dlp derives a title from `clean_html(text)` | — | — | VB-ytdlp |
| items | `media[]` (ordered); `mediaCount`; `isMediaReady` | array | posts with media | VB-ytdlp, USA |
| item id/kind | `media[].id` (int); `media[].type` ∈ `photo`,`video`,`gif`,`audio` | — | always | USA, VB |
| item lock | `media[].canView` bool; post-level `canViewMedia`; `post.preview` = list of media ids shown free | — | always | VB, OFS |
| item URL variants | `media[].files.{full,thumb,preview,squarePreview,miniPreview}.{url,width,height}` (`full.size` too) | signed CloudFront URL on `cdn*.onlyfans.com/files/...` | `full` only if `canView` | VB-ytdlp, USA |
| video renditions | `media[].videoSources{"720":url,"240":url}` | map height→url | some videos | VB-ytdlp |
| DRM | `media[].files.drm.manifest.{hls,dash}` + `files.drm.signature.{hls,dash}.{CloudFront-Policy,CloudFront-Signature,CloudFront-Key-Pair-Id}` | obj | DRM video; no `full` URL | OFS, USA |
| legacy media | `media[].src`, `media[].source{source,width,height,size,duration}` | — | older payloads | USA, VB |
| item meta | `duration` (s), `createdAt` (ISO), `hasCustomPreview`, `convertedToVideo`, `isReady` | — | — | USA |
| mentions | `mentionedUsers[]` (objects), `linkedUsers[]` (user objects) | structured, post-level, no position | when present | USA |
| linked posts | `linkedPosts[]` (full post objects) | structured | quote/promo | USA |
| hashtags | only inline in `text` | raw text | — | UNVERIFIED that no structured field exists |
| price | `price` (number, USD), `canPurchase`, `isOpened` (bought or free) | — | PPV posts | USA, OFS |
| expiry | `expiredAt` (ISO) | string or null | expiring posts | USA, OFS |
| pinned/archived | `isPinned`, `isArchived` | bool | — | USA |
| poll/fundraise/stream | `voting`, `hasVoting`, `fundRaising`, `streamId`, `streamDuration` | — | special posts | USA |
| counts | `favoritesCount` (likes), `commentsCount`; tips UNKNOWN | int | — | USA |
| timestamps | `postedAt` ISO-8601; `postedAtPrecise` = unix seconds with fraction, as a string (pagination cursor) | — | always | VB-ytdlp, USA |
| kind | `responseType` (`post`,`message`,`stories`…) | string | always | USA, OFS |

### PROFILE (`GET /api2/v2/users/{username}`)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| ids | `id` (int), `username`; `name` = display name | — | always | USA, VB-ytdlp |
| bio | `about` (HTML), `rawAbout`; `website`, `wishlist`, `location` | string | optional | USA |
| avatar | `avatar` (url), `avatarThumbs` (keyed `c50`,`c144`) | url, plus a map of size→url | optional | USA (USA's type hint says list; key names UNVERIFIED) |
| banner | `header` (url), `headerSize{width,height}`, `headerThumbs` (keys `w480`,`w760` UNVERIFIED) | — | optional | USA |
| image signing | profile images believed unsigned (`public.onlyfans.com`); post media is signed | — | — | UNVERIFIED |
| followers | `subscribersCount` (int or null), shown only if `showSubscribersCount` | — | often hidden | USA |
| following | `subscribesCount` | int | — | USA |
| other counts | `postsCount`,`photosCount`,`videosCount`,`audiosCount`,`mediasCount`,`archivedPostsCount`,`favoritedCount` (likes received),`favoritesCount` | int | — | USA |
| verified | `isVerified`; `isPerformer`, `isRealPerformer` | bool | — | USA |
| price | `subscribePrice`, `currentSubscribePrice`, `promotions[]`, `subscribedByData` | number in USD; obj | creators | USA, OFS |
| dates | `joinDate` (ISO), `lastSeen` (ISO or null) | — | — | USA |
| lists | another creator's fans cannot be enumerated; only the session's own `subscriptions/subscribes` and `subscribers` | — | — | USA (APIRoutes names) |

**Structural facts**
- A post holds 0..n ordered media items. Each item has its own id, kind and lock state. A post can
  be visible while every item is locked (`canView=false`). An item can have preview or thumb URLs
  but no `full` URL.
- An item can be unlocked yet have no downloadable URL (DRM). VidBee's states are
  `available | locked | drm` (`packages/browser-capture/src/onlyfans-profile.ts`).
- Media URLs are signed and expiring. Store references (post id, media id, CDN path), never the
  signed URLs. VidBee does exactly this.
- Prices sit at post level (`price`), not item level. `post.preview[]` lists the media ids that
  are free previews.

---

## 2. Fansly (private API `apiv3.fansly.com/api/v1`, envelope `{success, response}`)

### POST (`GET /post?ids=`, `/timelinenew/{accountId}?wallId=&before=`, `/mediaoffers/location`)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| id | `posts[].id` | string-encoded int64 | always | GDL, FSPEC |
| URL | `fansly.com/post/{postId}` | — | — | GDL |
| author | `accountId` → `response.accounts[]` (may be empty) | string | always | GDL, FSPEC |
| text | `content` (markup: `**b**`, `[text](url)`, `[c:color]`…) | string | always | GDL, OFS |
| items | `attachments[]{contentId, contentType, pos, postId}` | array | — | GDL, RSSHub |
| contentType | 1 accountMedia · 2 accountMediaBundle · 7 tip · 8 aggregated post (quote or repost) · 7100 tip goal · 32001 story · 42001 poll | int | — | FSPEC, OFS, RSSHub |
| accountMedia | `response.accountMedia[]{id, accountId, mediaId, previewId, access, purchased, price, permissionFlags, permissions, likeCount, createdAt, media, preview}` | sidecar list joined by id | — | GDL, VB, USA, OFS |
| bundle | `accountMediaBundles[]{id, accountMediaIds[], bundleContent[{accountMediaId,pos}], access, price, permissions, previewId}` | — | — | GDL, VB |
| media | `media{id, type (1 image, 2 video, 3 audio), mimetype, width, height, duration, location, locations[], variants[], metadata (JSON string), createdAt, updatedAt, status, flags}` | — | — | GDL, FSPEC |
| variants | `variants[]{id,type,mimetype,width,height,locations[{locationId,location,metadata{Key-Pair-Id,Signature,Policy}}]}`; locationId `1` direct, `102` HLS, `103` DASH | — | — | GDL, OFS |
| lock | `accountMedia.access` bool. `access=false` means only `preview` (a media object) is viewable | — | always | VB, GDL |
| price | `permissions.permissionFlags[].metadata` JSON whose `"1"` holds `{price}` in **mills** (top-level `price` may be 0). Flag bits: 1 price, 2 follow, 4 subscribed tier, 8 tipped ≥ min, 32 media purchases, 128 list | — | locked media | OFS, FSPEC |
| mentions | `accountMentions[]` (inner shape UNKNOWN) | structured, post-level | — | USA, FSPEC |
| hashtags | parsed from `content` with `#\w+`; `fypFlags` bit 2 = hashtag | raw text | — | OFS, FSPEC |
| replies/quotes | `inReplyTo`, `inReplyToRoot`, `quotedPostId`, `replyPermissionFlags`/`postReplyPermissionFlags` | ids | — | FSPEC |
| container | `wallIds[]` (profile tabs), `pinned`, `pinWallIds` | — | — | FSPEC |
| expiry | `expiresAt` (0 or null = none) | int | — | GDL, FSPEC |
| counts | `likeCount`, `replyCount`, `mediaLikeCount`, `totalTipAmount` (cents), `attachmentTipAmount` | int | — | USA, FSPEC |
| timestamps | `post.createdAt` unix **seconds**; media `createdAt`/`updatedAt` seconds (GDL fixture); account/message times ms | — | — | GDL, FSPEC |

### PROFILE (`GET /account?usernames=` or `?ids=`)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| ids | `id` (string int64), `username`, `displayName` | — | always | VB, USA |
| bio | `about`, `location`, `profileSocials[]` | — | optional | USA |
| avatar / banner | `avatar`, `banner`: full **media objects** (`locations[]` + `variants[]`, each with width and height) | URL = first `locations[].location`; signed with `Expires` query | optional | USA, OFS |
| followers | `followCount` | int | — | USA |
| subscribers | `subscriberCount` | int | — | USA, FSPEC |
| media counts | `timelineStats{imageCount,videoCount,bundleCount,bundleImageCount,bundleVideoCount}`; `postLikes`, `accountMediaLikes` | — | creators | USA, OFS, fansly-dl-ng |
| tabs | `walls[]{id,pos,name,description}`; `pinnedPosts[]{postId,pos,createdAt}` | — | — | GDL, USA, OFS |
| price | `subscriptionTiers[]` (`plans[].price` in mills); the viewer's `subscription{price,endsAt,subscriptionTierId}` | — | — | USA, OFS |
| verified | `flags` bitfield (2 = model/creator). No separate verified flag | int | — | FSPEC |
| dates | `createdAt` (join), `lastSeenAt` | ms | — | USA, FSPEC |
| viewer state | `following`, `subscribed`, `profileAccess`, `mediaStoryState{hasActiveStories}` | bool | — | USA |
| follower list | `GET /account/{id}/followersnew?limit&offset` → `followers[]{id,followerId}` + `aggregationData.accounts[]`; creator-side | — | auth | FSPEC |

**Structural facts**
- One post attachment can be a single accountMedia, a **bundle** (ordered by `bundleContent.pos`)
  or another post (contentType 8). Attachments are id references into sidecar arrays, not
  embedded objects. Bundle members can be missing from the sidecar and need a separate
  `/account/media?ids=` fetch (gallery-dl `_extra`).
- Every accountMedia has its own `access`, price (mills, inside a JSON string) and optional
  `preview` media. A locked item still has identity, mimetype and a preview.
- Media has no named size keys. It is a list of variants, each carrying width, height, mimetype
  and its own signed locations. HLS and DASH need CloudFront cookies.
- Timestamp units differ by entity: seconds for posts, ms for accounts and messages. Fansly ids
  exceed `Number.MAX_SAFE_INTEGER`, so treat them as strings.

---

## 3. RedGifs (public API `api.redgifs.com/v2`, temporary bearer from `/v2/auth/temporary`)

### POST / gif (`GET /v2/gifs/{id}?users=yes`, `/v2/users/{u}/search`, `/v2/gifs/search?order=latest`)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| id | `id` (lowercase slug); URL `redgifs.com/watch/{id}` | string | always | GDL, LIVE |
| author | `userName` | string | always | LIVE |
| text | `description` (string or null); no title. yt-dlp uses `tags.join(' ')` as the title | — | optional | LIVE, VB-ytdlp |
| tags | `tags[]` strings (first-class, not hashtags) | — | always | LIVE |
| niches | `niches[]` of niche-id strings | — | optional | LIVE |
| rating | `sexuality[]` strings; `is_sfw` (gallery items); `contentType` (null observed) | — | — | LIVE |
| kind | `type` 1 = video, 2 = image; `hasAudio`, `duration`, `width`, `height`, `avgColor` | — | always | LIVE |
| multi-item | `gallery` (gallery id or null) → `GET /v2/gallery/{id}` = `{id, gifs[], users{<username>: user}}` | — | galleries | GDL, LIVE |
| URL variants | `urls{hd, sd, poster, thumbnail, html}`; gallery-dl also asks for `gif` | unsigned CDN `*.redgifs.com/<CamelId>[-mobile].mp4/jpg` | always | GDL, LIVE |
| counts | `likes`, `views` (no comments or saves) | int | always | LIVE |
| flags | `verified`, `published`, `hideHome`, `hideTrending`, `hls`, `canBoost`, `promoted`, `cta` | — | — | LIVE |
| timestamp | `createDate` | unix seconds | always | GDL, LIVE |
| containers | user collections `/v2/users/{u}/collections` → `{folderId, folderName}` | — | — | GDL |
| list envelope | `{gifs[], users[], niches[], tags[], page, pages, total, cursor, prefetch, boosted_gifs, promoted_gifs}` | page-number paging | — | GDL, LIVE |

### PROFILE (`users[]` inside gif responses; `GET /v1/users/{u}`)
| concept | field | type | source |
|---|---|---|---|
| ids | `username` (also the id), `name` (display), `url`, `profileUrl` | string | LIVE |
| bio, links | `description`; v2-embedded user carries `socialUrl1`…`socialUrl18`; v1 carries `links[]` (inner shape UNKNOWN) and `premium{subscription_outbound_link,outbound_link_active}` | — | LIVE |
| avatar | `profileImageUrl` (`userpic.redgifs.com/...`, one size, nullable) | url | LIVE |
| banner | none observed | — | LIVE |
| counts | `followers`, `following`, `gifs`, `publishedGifs`, `publishedCollections`, `views`, `likes` (v1) | int | LIVE |
| verified | `verified`, `ageVerified`, `kycVerified`, `studio` | bool | LIVE |
| price | `subscription` (int; meaning UNKNOWN) | — | LIVE |
| join date | `creationtime` | unix seconds | LIVE |
| follower lists | UNKNOWN (no public endpoint found) | — | — |

**Structural facts**
- A "gif" can be a video or an image (`type`). A post with `gallery` set is a multi-item container
  whose members are themselves gifs. Users are keyed by username in the gallery response.
- Tags and niches are separate first-class taxonomies with no hashtag syntax. A niche is its own
  entity `{id,name,description,cover,thumbnail,owner,subscribers,gifs,rules}`.
- There is no paywall and no expiry. Media URLs are stable and unsigned. People tags and mentions
  do not exist.

---

## 4. Snapchat (logged-out `__NEXT_DATA__.props.pageProps` on `snapchat.com/@{user}`)

### POST: story snap, highlight, spotlight
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| containers | `story` (current 24 h, often null), `curatedHighlights[]` (`storyType` 3), `spotlightHighlights[]` (`storyType` 15) | — | — | GDL, VB, LIVE |
| container ids | `storyId{value}`, `highlightId{value}` (UUID, in `/@u/highlight/{id}`), `storyTitle{value}`, `thumbnailUrl{value}`, `thumbnailTiles[{tileType,url{value}}]`, `storyShareId`, `canonicalUrlSuffix`, `emoji` | wrapped scalars `{value}` | — | GDL, LIVE |
| items | `snapList[]` ordered by `snapIndex` (int) | array | — | GDL, LIVE |
| snap id | `snapId{value}`; the spotlight URL is `/@u/spotlight/{snapId}` | string | can be empty in stories | GDL, VB |
| kind | `snapMediaType` 0 image / 1 video | int | always | GDL, LIVE |
| media URLs | `snapUrls{mediaUrl, mediaPreviewUrl{value}, overlayUrl, attachmentUrl}` | `cf-st.sc-cdn.net/d/<id>.<n>?mo=…&uc=…` (tokenized; expiry UNKNOWN) | — | GDL, LIVE |
| snap text | `snapTitle`, `snapSubtitles` (null observed); `audioTranscriptionObjectUrl` | — | rare | LIVE |
| geo | `lat`, `lng` | — | rare | LIVE |
| timestamp | `timestampInSec{value}` | unix seconds as a string | always | GDL, LIVE |
| spotlight meta | `spotlightStoryMetadata[i]` is **parallel by index** to `spotlightHighlights[i]`: `videoMetadata{name, description, thumbnailUrl, uploadDateMs, viewCount, contentUrl, durationMs, width, height, keywords[], shareCount, embeddedTextCaption, creator{$case, personCreator{username,url,name,followerCount,websiteUrl}}}` | counts and times are strings (ms) | spotlight | VB, LIVE |
| hashtags | `spotlightStoryMetadata[].hashtags[]` (empty observed; element shape UNKNOWN), `keywords[]`, `textMetadataKeywords[]` | — | spotlight | LIVE |
| counts | `engagementStats{viewCount,shareCount,commentCount,boostCount,recommendCount}` (strings) | — | spotlight | LIVE |
| links | `contextCards[]{title,subtitle,url,thumbnailUrl,id,contextType}`, `deeplink` | — | spotlight | LIVE |
| mentions / people tags | UNKNOWN (no field observed) | — | — | — |
| expiry | implicit 24 h for `story`; no expiresAt field. `showSnapExpiredToast` | — | — | VB, LIVE |
| paging | `curatedHighlightsCursor`, `spotlightHighlightsCursor` (strings). The web client does not page while logged out | — | — | VB (`snapchat_web.py` docstring), LIVE |

### PROFILE (`userProfile{$case, publicProfileInfo}`)
| concept | field | type, encoding | source |
|---|---|---|---|
| ids | `username`, `title` (display), `mutableName`, `hostUserId`, `businessProfileId` | string | LIVE |
| bio, links | `bio`, `websiteUrl`, `address`, `sameAsLinks[]` | — | LIVE |
| avatar | `profilePictureUrl` = `cf-st.sc-cdn.net/aps/bolt/<id>._RS0,90_FMjpeg`; size and format are encoded in the path suffix, no signature | url | GDL, LIVE |
| banner / hero | `squareHeroImageUrl` (`._RS0,1080_FMjpeg`); `snapcodeImageUrl` (`?bitmoji=&type=&username=`); `bitmoji3d` (null on public business profiles; shape UNKNOWN); `primaryColor` | — | LIVE |
| followers | `subscriberCount` (string-encoded int); no following count | — | LIVE |
| verified / category | `badge` (int), `publisherType`, `categoryStringId`, `subcategoryStringId` | — | LIVE |
| flags | `hasStory`, `hasCuratedHighlights`, `hasSpotlightHighlights`, `shouldHideUsername` | bool | LIVE |
| dates | `creationTimestampMs{value}`, `lastUpdateTimestampMs{value}` | ms as a string | GDL, LIVE |
| related | `relatedAccountsInfo[]{publicProfileInfo, subscribeLink}` | — | LIVE |
| lists | followers are not enumerable | — | — |

**Structural facts**
- Story and highlight are ordered containers of snaps. A snap has no caption. Text lives on the
  container (`storyTitle`) or, for spotlight, in a separate parallel-indexed metadata array.
- Scalars are often wrapped as `{value}` and numbers are often strings. A spotlight slot can be an
  empty placeholder (`snapList` empty) for removed posts, and VidBee skips it.
- `userProfile.$case` is a discriminator. Only `publicProfileInfo` was observed; personal
  (bitmoji) profiles may use another case (UNKNOWN).

---

## 5. Pinterest (internal web resources `/resource/<Name>Resource/get/`; official API v5)

### POST / pin (internal `PinResource`, `field_set_key=detailed`)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| id | `id`; URL `/pin/{id}/` (optional `slug--` prefix) | string, exceeds 2^53 | always | VB, LIVE |
| text | `title`, `grid_title`, `description`, `closeup_description`, `closeup_unified_description`, `description_html`, `seo_title`, `seo_description`, `alt_text`, `rich_summary` | strings | optional | GDL, LIVE |
| single media | `images{60x60,136x136,170x,236x,474x,564x,736x,600x315,orig}.{url,width,height}` (`i.pinimg.com/<size>/..`, unsigned) | size-keyed map | image pins | GDL, LIVE |
| video | `videos.video_list{V_HLSV4,V_HLSV3_WEB,V_HLSV3_MOBILE,V_720P,…}{url,width,height,duration,thumbnail}`; `is_video` | — | video pins | GDL |
| carousel | `carousel_data.carousel_slots[]{id, images{size:{url}}, title, description, link, domain}` | — | carousels | GDL |
| idea/story pin | `story_pin_data{id, page_count, pages[{id, blocks[{type, block_type, image{images{originals,750x,736x,474x}}, video, text, image_signature, block_style{x_coord,y_coord,width,height,rotation}}]}], mentioned_users[], metadata{pin_title, root_pin_id, root_user_id,…}}` | block types: image, video, music, paragraph, product sticker, static sticker | idea pins | GDL, LIVE |
| outbound link | `link`, `domain`, `link_domain`, `tracked_link`, `rich_metadata`, `description_links[]` | — | optional | GDL, LIVE |
| repin / origin | `is_repin`, `origin_pinner`, `via_pinner` (user), `native_creator`, `pinner`; v5 `parent_pin_id` | — | — | LIVE, PIN5 |
| container | `board{id,name,url,owner,privacy,…}`, `section` (null if none) | — | always / optional | LIVE |
| topics / tags | `hashtags[]`, `manual_interest_tags`, `pin_join{visual_annotation,…}`, `category` | — | optional | LIVE |
| mentions | `user_mention_tags`; `story_pin_data.mentioned_users[]` | — | optional | LIVE |
| products | `product_pin_data`, `price_value`, `price_currency`; v5 `GET /pins/{id}/product_tags` | — | shopping | LIVE, PIN5 |
| counts | `repin_count`, `comment_count`, `share_count`, `reaction_counts{<type>:n}`, `aggregated_pin_data.aggregated_stats{saves,done}` | int | — | LIVE |
| timestamp | `created_at` RFC-2822 (`Sat, 01 Sep 2018 12:00:00 +0000`) | string | always | LIVE |
| v5 pin | `id, title, description, alt_text, link, board_id, board_section_id, board_owner{username}, created_at (ISO), dominant_color, parent_pin_id, is_owner, is_standard, creative_type, pin_metrics, media{media_type ∈ image, video, multiple_images, …; images{150x150,400x300,600x,1200x}; video: cover_image_url, video_url, duration, width, height; items[]}` | — | API | PIN5 |

### PROFILE (internal `UserResource`, `field_set_key=profile`; v5 `GET /user_account`, own only)
| concept | field | type | source |
|---|---|---|---|
| ids | `id` (string), `username`, `full_name`, `first_name`, `last_name` | — | LIVE |
| bio, links | `about`, `website_url`, `listed_website_url`, `domain_url`, `pronouns` | — | LIVE |
| avatar | `image_small_url`, `image_medium_url`, `image_large_url`, `image_xlarge_url` (`i.pinimg.com/280x280_RS/...`; defaults on `s.pinimg.com`), `is_default_image`; v5 `profile_image` | unsigned | LIVE, PIN5 |
| banner | `profile_cover{id}` | — | LIVE |
| counts | `follower_count`, `following_count`, `explicit_user_following_count`, `interest_following_count`, `pin_count`, `board_count`, `story_pin_count`, `video_pin_count`, `profile_views`, `profile_reach`; v5 adds `monthly_views` | int | LIVE, PIN5 |
| verified | `verified_identity{verified}`, `is_verified_merchant`, `domain_verified` | — | LIVE |
| join date | `created_at` (RFC-2822) | — | LIVE |
| lists | v5 `/user_account/followers` and `/following` (own account only) → `items[{type:"user", username}]`, `bookmark` cursor. Internal follower resources: UNVERIFIED | — | PIN5 |

Board (internal): `id, name, url, description, owner, privacy, pin_count, follower_count,
section_count, sectionless_pin_count, collaborator_count, image_cover_url, cover_pin, category`.
Sections come from `BoardSectionsResource`. Source: LIVE, GDL.

**Structural facts**
- A pin has exactly one of: single image, video, carousel (n slots, each with its own link and
  title) or idea pin (pages × blocks, including text-only paragraph blocks and positioned stickers).
- A pin has three text fields: title, grid title and description (plus closeup variants). The
  outbound link is first-class (`link`, `domain`). Repins point at origin and via users.
- Image renditions are keyed by size strings, not by role. Ids must be strings.

---

## 6. VSCO (`__PRELOADED_STATE__` + `/api/3.0/medias/profile`, bearer `users.currentUser.tkn`)

### POST: image, video, space post
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| id | `_id` (API) or `id` (preload); 24-hex. URLs `/{user}/media/{id}`, `/{user}/video/{uuid}` | string | always | GDL, VB |
| envelope | `media[]{type, <type>: {...}}`, read as `m[m.type]`; cursor `next_cursor` | — | — | GDL |
| text | `description` only (no title) | string | optional | GDL |
| tags | `tags[]{text}` | structured | optional | GDL |
| media | `responsive_url` (protocol-less `im.vsco.co/aws-…/…` or `<cdn>/…`), `width`, `height`, `is_video`, `video_url` | unsigned | — | GDL |
| video entries | `playback_url` (m3u8), `poster_url`, `created_date` (ms) | — | type video | GDL |
| EXIF | `image_meta` (dict; inner keys UNKNOWN) | — | images | GDL |
| owner | `grid_name` (username), `site_id` | — | — | GDL |
| timestamp | `upload_date` (ms; space posts `{sec}`) | — | always | GDL |
| container | collection `/api/2.0/collections/{siteCollectionId}/medias` (reposts by the user); spaces `/grpc/spaces/{id}/posts`; journals = preload `articles` (fields UNKNOWN; gallery-dl does not extract them) | — | — | GDL |
| counts, mentions, links, price | none observed, UNKNOWN | — | — | — |

### PROFILE (`sites.siteByUsername[user].site`)
| concept | field | type | source |
|---|---|---|---|
| ids | `id` (site id, int), `userId` (int), `name`/`subdomain` (username), `siteTitle` | — | GDL, LIVE |
| bio, links | `description`, `externalLink`, `externalLinkDisplayText`, `shareLink`, `domain` | — | LIVE |
| avatar | `profileImage` (url), `profileImageId` (`im.vsco.co/<id>` redirects to the full URL), `responsiveUrl` | unsigned | GDL, LIVE |
| flags | `hasCollection`, `hasArticle` (journal), `isBrand`, `status`, `type`, `profileVisibility`, `password` | — | LIVE |
| counts | none in `site`; preload has a `follows` slice (UNKNOWN) | — | LIVE |
| verified, join date, price | UNKNOWN / none | — | — |

**Structural facts**
- Each post is one asset, so there are no multi-item posts. Reposts live in the separate
  "collection". Journals (`hasArticle`) are a distinct, unmapped type.
- Profile and post field naming switches between snake_case (REST) and camelCase (preload), and
  gallery-dl normalizes the two.

---

## 7. Dzen (dzen.ru; SSR `_params = ({ssrData…})`, SSO redirect `var it = {retpath}`)

### POST: long video / short (`/video/watch/{id}`; shorts reuse the publication id)
| concept | field | type, encoding | present when | source |
|---|---|---|---|---|
| feed item | `exportResponse.feedData.items[]` floors (`channel_long_video_floor`) → `items[]{id, itemId, type ("gif" = video), title, text, link, shareLink, sourceId, views, publicationDate, repostUrl, image{urlTemplate, originalSize}, socialInfo{likesCount, commentCount, commentsEnabled}, feedSpecificData{mentions[]}, video{…}, isAdult, isPremium}` | — | channel page | VB-ytdlp, LIVE |
| ids | feed `id` = `publicationObjectId`; feed `itemId` = video meta `id`; `sourceId` = channel `publisher_id`. The watch-URL id matched none of these (observed) | strings | — | LIVE |
| video page | `ssrData.videoMetaResponse{id, publicationId, publicationObjectId, publisherId, itemType, title, description, tags[], mentions[], image, mainColor, publicationDate, creationTime, source{…}, video{duration, views, width, height, isShortVideo, streams, mp4Streams[], oneVideoStreams[], firstFrames[], resolutions[], subtitles}}` | — | — | VB-ytdlp, LIVE |
| counts | `socialMetaResponse.items[].metaInfo{likeCount, commentsCount, commentsEnabled}`; `video.views` | int | video page | LIVE |
| timestamps | `publicationDate` = unix seconds as a string; `creationTime` = **localized relative text** ("N years ago"), not a timestamp | — | — | VB-ytdlp, LIVE |
| media URLs | `image.urlTemplate` = `avatars.dzeninfra.ru/get-{namespace}/…/{size}` (template); stream URLs typed by `?ct=` (6 DASH, 8 HLS, 0 MP4) | — | — | VB-ytdlp, LIVE |
| reposts | `repostUrl`; repost-of-post structure UNKNOWN | — | — | LIVE |
| articles / image posts | UNKNOWN. VidBee scope is video-only; tabs observed: `long_video`, `short_video` | — | — | VB docs |

### PROFILE (`exportResponse.channel.source`)
| concept | field | type | source |
|---|---|---|---|
| ids | `publisher_id` (24-hex, in `/id/{…}`), `id`/`strongest_id` (20-char internal), `owner_uid` (int), vanity URL `dzen.ru/{name}` | — | VB, LIVE |
| names, bio | `title`, `subtitle`, `description`, `social_links[]{link,social_network,image,name}`, `public_emails[]`, `public_phones[]` | — | LIVE |
| avatar | `logo`, `framed_logo`, `logo_sizes{framed_100x128_1x, framed_132x176_1x, framed_202x260_1x, framed_212x280_1x, smart_crop_160}` (`avatars.dzeninfra.ru/get-zen-logos/<ns>/<id>/<size>`, unsigned), `is_stub_logo` | — | LIVE |
| banner / OG | `og_image`, `viewer_image{link,width,height}`, header and title colours | — | LIVE |
| followers | `subscribers` (int), `subscribers_short`, `subscribers_formatted` | — | LIVE |
| following, lists | none / UNKNOWN | — | — |
| verified | `is_verified`, `is_business_channel` | bool | LIVE |
| paging | `feedData.more.link` (contains `next_page_id`) | — | VB-ytdlp |

**Structural facts**
- A channel page carries profile and first feed page together. The video page carries a second,
  richer object, and counts live in a third object (`socialMetaResponse`).
- There are several ids per publication. Choose the canonical one deliberately and keep the others
  as aliases.
- Do not treat `creationTime` as a date.

---

## Cross-platform modelling constraints
1. A post is an ordered container of 0..n items: OnlyFans `media[]`, Fansly attachments →
   bundles, RedGifs gallery, Snapchat `snapList`, Pinterest carousel or idea-pin pages × blocks.
   Items need stable per-item ids distinct from the post id.
2. An item can exist without a viewable original: OnlyFans `canView`/DRM, Fansly `access` +
   `preview`, Snapchat empty placeholders. Model access state and preview separately from the
   original.
3. Renditions are keyed three ways: by size string (Pinterest, Dzen logos), by role
   (OnlyFans `full/thumb/preview`, RedGifs `hd/sd/poster`) or as an unkeyed variant list with
   width and height (Fansly). Signed and expiring URLs (OnlyFans, Fansly, likely Snapchat
   `mo/uc`) must be refreshable references, not stored strings.
4. Timestamps come as ISO strings (OnlyFans), seconds (RedGifs, Fansly posts), ms (Fansly
   accounts, VSCO, Snapchat profile), seconds-as-string (Snapchat snaps, Dzen), RFC-2822
   (Pinterest) and relative text (Dzen `creationTime`). Ids above 2^53 (Pinterest, Fansly) must be
   strings.

## Confidence
- **Extractor-source facts (high):** OnlyFans media and file shape, pagination and DRM detection
  (VB-ytdlp, VB, USA, OFS). Fansly attachment, bundle, variant and lock model (GDL, VB, OFS).
  RedGifs endpoints (GDL). Snapchat container and snap shape (GDL, VB). Pinterest media variants
  (GDL). VSCO media fields (GDL). Dzen feed, paging and stream typing (VB-ytdlp).
- **Live-probe facts (high for shape, one sample each):** every RedGifs, Snapchat, Pinterest
  (internal) and Dzen key and encoding marked LIVE, plus the VSCO site object. VSCO media could not
  be probed (Cloudflare 403; the brand account had no media).
- **Community or model-class facts (medium):** OnlyFans profile fields and Fansly profile fields
  (USA, OFS). Fansly enums and price units (FSPEC, an unofficial spec).
- **Docs-only (official, own-account scope):** Pinterest v5 schemas (PIN5). RedGifs docs at
  `api.redgifs.com/docs` returned 401 and were not read.
- **UNVERIFIED or UNKNOWN:** OnlyFans `avatarThumbs` and `headerThumbs` key names, whether its
  profile images are unsigned, and its tips field. The inner shape of Fansly `accountMentions`.
  RedGifs `links[]` and follower lists. Snapchat mention fields and URL expiry. VSCO journals,
  counts and EXIF keys. Dzen articles and reposts. Pinterest internal follower-list resources.
