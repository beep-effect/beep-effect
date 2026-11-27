# Social post / profile payload research: X, Reddit, YouTube, TikTok

Date: 2026-11-26. Read-only research. No real private individuals' data is included.

Source keys:
- **GDL**: gallery-dl 1.32.17, local copy (`~/.local/share/pipx/venvs/gallery-dl/.../extractor/{twitter,reddit,tiktok}.py`)
- **YTD**: yt-dlp 2026.08.19, local copy (`~/.cache/vidbee-social-python/.../yt_dlp/extractor/{twitter,reddit,tiktok}.py`, `youtube/_tab.py`, `youtube/_video.py`)
- **TOA**: fa0311/twitter-openapi `src/openapi/schemas/{tweet,user,media}.yaml` (main, fetched 2026-11-26)
- **VB**: VidBee `packages/downloader-core/src/{social-media,tiktok-photo}.ts`. VidBee hands parsing to gallery-dl and yt-dlp, so it contains URL grammar but no raw payload field names.
- **MIN**: medialab/minet `minet/tiktok/types.py`. **4C**: 4cat `datasources/tiktok/search_tiktok.py`. **INV**: Invidious commit #3599 and YouTube.js `PostMultiImage`. **XU**: a third-party userscript that reads `features.all.tags`.
- **DOC**: official docs (X v2 data dictionary; TikTok Display and Research API pages; YouTube Data API v3 incl. the `posts` resource), fetched this session. **MEM**: recalled from docs or payloads but not re-verified this session. Treat as medium confidence.

---

## 1. X (Twitter)

The two dialects have different shapes. The **web GraphQL** shape (`Tweet{rest_id, core, legacy, note_tweet, views, ...}`) is what extractors see. The **v2 public API** (`data`, `includes.media`, `includes.users`) is the paid route. Offsets differ between them: legacy entities use `indices: [start, end]`, v2 uses `start`/`end` (inclusive/exclusive).

### POST
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `rest_id`, `legacy.id_str`; v2 `id` | numeric string (snowflake, exceeds 2^53) | always | GDL TOA DOC |
| URL id | `x.com/{screen_name}/status/{id}`, also `/i/web/status/{id}` | handle segment is cosmetic | — | GDL VB |
| time | `legacy.created_at` | `"Sat Dec 31 23:59:59 +0000 2023"`; v2 uses ISO 8601. Also derivable: `(id>>22)+1288834974657` ms | always | GDL TOA DOC |
| text | `legacy.full_text` + `display_text_range` | HTML-escaped (`&amp;`), t.co links inline | always | GDL TOA |
| long text | `note_tweet.note_tweet_results.result.{text, entity_set, richtext.richtext_tags, media.inline_media}` | replaces full_text; own entity set | post > 280 chars | GDL TOA |
| author | `core.user_results.result` (User) | union `User`/`UserUnavailable` | always | GDL TOA |
| media list | `legacy.extended_entities.media[]` (`entities.media` holds only the first item) | max 4 | native media | GDL TOA |
| media item | `id_str, media_key ("3_..."), type photo/video/animated_gif, media_url_https, url (t.co), display_url, expanded_url, indices` | — | per item | TOA |
| dimensions | `original_info.{width,height,focus_rects[{x,y,w,h}]}`, `sizes.{thumb,small,medium,large}.{w,h,resize crop/fit}` | int px | per item | GDL TOA |
| alt text | `ext_alt_text` (v2 `alt_text`, max 1000 chars) | string or null | if set | GDL TOA DOC |
| video | `video_info.{aspect_ratio, duration_millis, variants[{bitrate?, content_type, url}]}` | the HLS variant has no bitrate | video/gif | GDL TOA YTD |
| image size variants | `media_url_https` → `?format=jpg&name=orig/4096x4096/large/medium/small` | unsigned pbs.twimg.com | photo | GDL |
| media warning | `sensitive_media_warning.{adult_content, graphic_violence, other}` | bool flags, per media | if flagged | GDL TOA |
| media availability | `ext_media_availability.{status Available/Unavailable, reason}` | e.g. DMCA | — | GDL TOA |
| re-used media | `source_status_id_str, source_user_id_str, additional_media_info.source_user` | — | media copied from another post | GDL TOA |
| media views | `mediaStats.viewCount` | int | video | TOA |
| **people tags** | `extended_entities.media[].features.all.tags[] {user_id, name, screen_name, type:"user"}` | per media item, no position (`features.*.faces` are face rects, not tags) | if tagged | XU (TOA leaves `features` untyped) |
| mentions | `entities.user_mentions[] {id_str, screen_name, name, indices}` | code-point ranges | if any | GDL TOA |
| hashtags / cashtags | `entities.hashtags[] {text, indices}`, `entities.symbols[] {text, indices}` | structured, `#`/`$` dropped | if any | GDL TOA |
| links | `entities.urls[] {url (t.co), expanded_url, display_url, indices}` | — | if any | GDL TOA |
| card | `card.legacy.{name, url, binding_values[{key, value{type,string_value,image_value...}}]}`, `unified_card` | link preview, poll, etc. | link card | YTD TOA |
| retweet | `legacy.retweeted_status_result.result` (full nested Tweet) + `retweeted_status_id_str` | — | repost | GDL TOA |
| quote | `quoted_status_result.result`, `legacy.quoted_status_id_str`, `legacy.quoted_status_permalink{url,expanded,display}`, `is_quote_status` | target may be `TweetTombstone` | quote | GDL TOA |
| reply | `legacy.in_reply_to_{status_id_str,user_id_str,screen_name}`, `conversation_id_str`, `self_thread` | — | reply | GDL TOA |
| v2 refs | `referenced_tweets[{type: retweeted/quoted/replied_to, id}]` | — | — | DOC |
| wrapper | `TweetWithVisibilityResults{tweet, ...}` / `TweetUnavailable` | union keyed on `__typename` | limited visibility | GDL TOA |
| edits | `edit_control.{edit_tweet_ids, editable_until_msecs, ...}`; v2 `edit_history_tweet_ids` | — | — | TOA DOC |
| community | `author_community_relationship.community_results.result{rest_id, name, description, created_at (ms epoch), is_nsfw, member_count, rules[], role}` | URL `/i/communities/{id}` | community post | GDL TOA |
| location | `legacy.place`; `coordinates` = **[lon, lat]**, `geo` = **[lat, lon]** | rare | geotagged | TOA |
| counts | `legacy.{favorite_count, retweet_count, reply_count, quote_count, bookmark_count}`, `views.count` (**string**, on Tweet, not legacy) | v2 `public_metrics.{like,retweet,reply,quote,bookmark,impression}_count` | always | GDL TOA DOC |
| sensitive | `legacy.possibly_sensitive` | bool | — | GDL TOA |
| misc | `legacy.lang`, `source` (HTML anchor), `birdwatch_pivot` (Community Note), `article` (long-form), `pinned` | — | — | GDL TOA |

### PROFILE
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `rest_id` (also `legacy.id_str`) | numeric string, stable | always | GDL TOA |
| handle | `core.screen_name` (older payloads: `legacy.screen_name`) | `[A-Za-z0-9_]{1,15}`, can change | always | GDL TOA VB |
| display name | `core.name` (≤50) | — | always | GDL TOA DOC |
| created | `core.created_at` | Twitter time format | always | GDL TOA |
| bio | `legacy.description` / `profile_bio.description` | t.co links inline | — | GDL TOA |
| bio entities | `legacy.entities.description.urls[]` (v2 also has hashtags, mentions, cashtags) | ranges | — | GDL TOA DOC |
| bio link | `legacy.entities.url.urls[0].expanded_url`, `website.url` | — | if set | GDL TOA |
| avatar | `avatar.image_url` (new) / `legacy.profile_image_url_https` | `..._normal.jpg`. Swap the suffix for `_mini` (24), `_normal` (48), `_bigger` (73), `_200x200`, `_400x400`; no suffix = original. Unsigned. | always | GDL TOA; sizes MEM |
| avatar shape | `profile_image_shape` Circle/Square/Hexagon | enum | — | TOA |
| banner | `legacy.profile_banner_url` (+ `/1500x500`, `/600x200`, `/web` ...), `banner.image_url` | unsigned | if set | GDL TOA; sizes MEM |
| counts | `legacy.{followers_count, friends_count (=following), statuses_count, media_count, favourites_count, listed_count}`; new: `relationship_counts.{followers,following}`, `tweet_counts.{tweets,media_tweets}` | int | — | GDL TOA |
| verified | `is_blue_verified`, `verification.{verified, verified_type Business/Government}`, `verification_info.is_identity_verified`, `affiliates_highlighted_label.label` (org badge), `parody_commentary_fan_label` | v2 `verified_type` blue/business/government/none | — | TOA DOC |
| protected | `privacy.protected` (new) / `legacy.protected` | bool | — | GDL TOA |
| location | `location.location` / `legacy.location` | free text | — | GDL TOA |
| pinned | `legacy.pinned_tweet_ids_str[]`, `pinned_items.tweet_ids_str`; v2 `pinned_tweet_id` | — | — | TOA DOC |
| hidden likes | `has_hidden_likes_on_profile` | bool | — | TOA |
| follower / following lists | GraphQL `Followers` and `Following`: `count: 100`, the cursor comes from `cursor-bottom-*` entries, each entry is `content.itemContent.user_results.result` (full User). v2: `GET /2/users/:id/followers` and `/following` with `pagination_token` | login required. Protected accounts show lists to followers only (MEM) | — | GDL VB DOC |

**Structural facts (X)**
- A post holds at most 4 media items of kind photo, video or animated_gif. Alt text, sensitivity flags, dimensions and **people tags are per media item**. Tags carry no position. The tag cap is 10 per photo (X Help, MEM).
- Mentions, hashtags, cashtags, URLs and timestamps are entities with ranges. A long post carries a *separate* text plus entity set in `note_tweet` that supersedes `legacy`.
- A repost is a wrapper whose payload is a full nested post. A quote is a post with its own text plus an embedded post. Model both as post-to-post references: kinds repost / quote / reply, plus a conversation root.
- The GraphQL User moved fields out of `legacy` (core, avatar, privacy, verification, location). Parse both locations.
- Counts are ints except `views.count`, which is a string. Ids are strings.
- Every VidBee X source is marked `requiresAuth`. Treat logged-out access as unavailable.

---

## 2. Reddit

A Listing `{kind:"Listing", data:{children:[{kind:"t3", data:{...}}], after, before}}` contains Things. Without `raw_json=1`, URLs and text come back HTML-escaped (GDL sets it).

### POST (submission, `t3`)
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `id` (base36, e.g. 7 chars), `name` = `t3_{id}` | string | always | GDL |
| URL | `permalink` `/r/{sub}/comments/{id}/{slug}/`; short form `redd.it/{id}` | slug is cosmetic | always | GDL VB |
| title | `title` (≤300 chars, MEM) | plain text | always | GDL YTD |
| body | `selftext` (Markdown), `selftext_html`; `is_self` | string, "" when empty | self post | GDL YTD |
| link | `url`, `url_overridden_by_dest`, `domain`, `post_hint` | — | link post | GDL |
| gallery | `is_gallery`; `gallery_data.items[] {media_id, id, caption?, outbound_url?}` (ordered) | `gallery_data` is null when deleted | gallery | GDL; caption/outbound_url MEM + write-side API |
| gallery media | `media_metadata[media_id] {status valid/..., e Image/AnimatedImage, m mime, s:{u,x,y} or {gif,mp4,x,y}, p:[{u,x,y}] previews, o:[] obfuscated, id}` | x/y = px | gallery, or inline images in selftext | GDL |
| gallery limits | max 20 items; caption ≤180 chars | — | — | MEM |
| image previews | `preview.images[] {source{url,width,height}, resolutions[{url,width,height}], variants{gif,mp4,nsfw,obfuscated}}` | `preview.redd.it` URLs are signed (`s=`); GDL rewrites `preview.`→`i.` to get the original | link/image post | GDL YTD |
| video | `is_video`; `secure_media.reddit_video {fallback_url, dash_url, hls_url, width, height, duration, bitrate_kbps, has_audio, is_gif}`; `preview.reddit_video_preview` | DASH/HLS manifests | v.redd.it | GDL YTD; inner keys partly MEM |
| embed | `secure_media_embed.content` (iframe HTML), `media.oembed` | — | external video | GDL |
| thumbnail | `thumbnail` | URL **or sentinel** `self`/`default`/`nsfw`/`spoiler`/`image` | always | YTD; sentinels MEM |
| people tags | — | **none** | — | — |
| mentions / hashtags | raw `u/name`, `r/sub` in Markdown. No entities, no hashtags | — | — | GDL (no parsing) |
| flair | `link_flair_text`, `link_flair_richtext[{e:text/emoji, t, a, u}]`, `link_flair_template_id`, `link_flair_css_class`, `link_flair_{background,text}_color`; author: `author_flair_*` | flair stands in for tags | if set | MEM |
| crosspost | `crosspost_parent` (`t3_...`), `crosspost_parent_list[]` (full parent posts), `num_crossposts` | GDL uses `[-1]` for media | crosspost | GDL |
| container | `subreddit`, `subreddit_id` (`t5_`), `subreddit_name_prefixed` (`r/x`, or `u/x` for profile posts), `subreddit_type`, `subreddit_subscribers` | — | always | YTD; rest MEM |
| author | `author` (name, or `[deleted]`), `author_fullname` (`t2_...`) | — | — | GDL YTD |
| warnings | `over_18`, `spoiler`, `locked`, `archived`, `removed_by_category`, `quarantine` | bool / str | — | YTD; rest MEM |
| pin | `stickied` (subreddit), `pinned` (profile) | bool | — | GDL |
| counts | `score`, `ups`, `downs` (always 0), `upvote_ratio` (float 0..1), `num_comments`; `hide_score` = score hidden on new posts | — | — | YTD; hide_score MEM |
| time | `created_utc`, `edited` | float epoch seconds; `edited` = `false` or float | always | GDL YTD |
| location / audio | — | none | — | — |
| poll | `poll_data` | — | poll post | MEM |

### PROFILE (`/user/{name}/about.json`, kind `t2`)
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `id` (base36, no prefix); fullname `t2_{id}` | string | always | GDL |
| handle | `name` | `[A-Za-z0-9_-]` (3–20, MEM); case-insensitive | always | VB |
| display name | `subreddit.title` | — | if set | MEM |
| bio | `subreddit.public_description` | plain text | — | MEM |
| avatar | `icon_img` (may be a default avatar); `snoovatar_img` (avatar-builder full-body PNG) + `snoovatar_size`; `subreddit.icon_img` | `styles.redditmedia.com` URLs carry signed query params (`s=`); HTML-escaped without raw_json | — | sk-auth `/api/v1/me` type; signing MEM |
| banner | `subreddit.banner_img` | — | if set | MEM |
| followers | `subreddit.subscribers` (followers of the profile's `u_{name}` subreddit) | int | — | MEM |
| following | — | **none public** | — | — |
| karma | `link_karma`, `comment_karma`, `total_karma`, `awardee_karma`, `awarder_karma` | int | — | sk-auth |
| flags | `verified`, `has_verified_email`, `is_gold`, `is_mod`, `is_employee`, `is_suspended` (suspended accounts return only `name` + `is_suspended`), `accept_followers`, `subreddit.over_18` | bool | — | GDL sk-auth |
| created | `created_utc` | float epoch s | — | sk-auth |
| social links | UNKNOWN (not in about.json) | — | — | — |
| lists | not enumerable for other users. The user's own `/api/v1/me/friends` is legacy | — | — | MEM |

**Structural facts (Reddit)**
- A post has a **title and an optional Markdown body**. A gallery is a separate ordered container (`gallery_data.items`) joined by `media_id` to a metadata **map** (`media_metadata`). Per-item caption and outbound_url sit on the gallery item; dimensions and mime sit on the metadata.
- `media_metadata` also appears without `gallery_data`, for images inline in a self post. That makes it a post-level media dictionary, not a gallery-only one.
- No people tags, no hashtags and no entity ranges. Flair is the only structured label. Flair is per post and per author-in-subreddit.
- A crosspost is a reference by fullname plus a denormalized copy of the parent.
- Every post lives in exactly one container: a subreddit, or a `u_` profile subreddit.
- Prefixed fullnames (`t1_` comment, `t2_` account, `t3_` link, `t5_` subreddit) are the cross-reference id. Bare base36 ids are what URLs use.
- Timestamps are float epoch seconds. `edited` is a bool/number union.

---

## 3. YouTube

There are two surfaces. The **Data API v3** (official, key or OAuth, documented) and **InnerTube web JSON** (`ytInitialPlayerResponse`, `ytInitialData` renderers; what yt-dlp reads).

### POST (video / short / live / community post)
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | video `id` / `videoDetails.videoId` | 11 chars `[A-Za-z0-9_-]` | always | YTD DOC |
| URL | `watch?v={id}`, `youtu.be/{id}`, `/shorts/{id}`, `/live/{id}` | same id space for every form | — | YTD |
| title | `snippet.title` (≤100) / `videoDetails.title` | — | always | YTD DOC |
| description | `snippet.description` (≤5000) / `videoDetails.shortDescription` | plain text; web `attributedDescription` carries link and mention runs | — | YTD DOC |
| time | `snippet.publishedAt` (ISO 8601); web `microformat.playerMicroformatRenderer.{publishDate, uploadDate}` | ISO strings | always | YTD DOC |
| duration | `contentDetails.duration` (ISO 8601 `PT#M#S`) / `videoDetails.lengthSeconds` (string) | — | — | YTD DOC |
| thumbnails | `snippet.thumbnails.{default 120x90, medium 320x180, high 480x360, standard 640x480, maxres 1280x720}{url,width,height}`; `i.ytimg.com/vi[_webp]/{id}/{default,mqdefault,hqdefault,sddefault,maxresdefault}.jpg/webp` | unsigned | always (maxres optional) | YTD DOC |
| formats | `streamingData.{formats, adaptiveFormats}[] {itag, url/signatureCipher, mimeType, bitrate, width, height, fps, contentLength}` | googlevideo URLs **signed and expiring** | — | YTD |
| hashtags | no structured field; `#tags` inside title/description; web shows up to 3 above the title | raw text | — | MEM |
| keywords | `snippet.tags[]` / `videoDetails.keywords[]` | hidden uploader keywords, not hashtags | — | YTD DOC |
| mentions | `@handle` in description: raw text in the API, runs with `navigationEndpoint` on the web | — | — | YTD (runs) |
| people tags | UNKNOWN (no field found; the collaborator/"collab" structure is not established) | — | — | — |
| other-post refs | Shorts remix/source: UNKNOWN. Community posts link videos/playlists as attachments | — | — | — |
| container | channel (`snippet.channelId`), playlists (`playlistItems`, many-to-many) | — | — | DOC |
| category / lang | `snippet.categoryId`, `defaultLanguage`, `defaultAudioLanguage` | — | — | DOC |
| warnings | `contentDetails.contentRating.ytRating=ytAgeRestricted`, `status.madeForKids`, `status.containsSyntheticMedia` | — | — | DOC; YTD `age_limit` |
| counts | `statistics.{viewCount, likeCount, commentCount, favoriteCount (always 0), dislikeCount (owner only)}` | **uint64 as strings**. `commentCount` is absent when comments are disabled | — | DOC |
| hideable | likes can be hidden by the uploader (UNKNOWN in API); `status.publicStatsViewable` | — | — | MEM |
| location | `recordingDetails.location` (deprecated), `recordingDate` | — | rare | MEM |
| music | UNKNOWN structure ("Music in this video" panel; yt-dlp emits track/artist) | — | — | — |
| community post (web) | `backstagePostThreadRenderer.post.backstagePostRenderer {postId, authorText, contentText.runs[], backstageAttachment, publishedTimeText, voteCount}` | `publishedTimeText` is **relative text** ("2 days ago") | — | YTD |
| community attachment | `backstageAttachment.{backstageImageRenderer.image.thumbnails[], postMultiImageRenderer.images[].backstageImageRenderer, videoRenderer, playlistRenderer, pollRenderer}` | exactly one kind per post | — | YTD INV |
| community post (API) | `posts` resource (pilot): `id`, `snippet.{channelId, textDisplay, publishTime}`, `statistics.{likeCount, commentCount}`, `attachments.imageAttachments[1..10].imagePreview{url,width,height}`, `status.{publishingStatus, archiveState}` | images: 1–10 in the API; Help Center says ≤5 | — | DOC |

### PROFILE (channel)
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `id` / `channelId` | `UC` + 22 chars, stable | always | YTD DOC |
| handle | `snippet.customUrl` (`@handle`); URL `/@handle` | 3–30 chars (MEM); lookup via `channels.list?forHandle=` | most channels | YTD DOC |
| legacy names | `/user/{name}` (`forUsername=`), `/c/{custom}` | — | old channels | DOC |
| display name | `snippet.title` | — | always | DOC |
| bio | `snippet.description` (≤1000), `brandingSettings.channel.keywords` | — | — | YTD DOC |
| bio links | UNKNOWN in the API; web about panel only | — | — | — |
| avatar | `snippet.thumbnails.{default 88, medium 240, high 800}`; web `avatar.thumbnails[]` | `yt3.ggpht.com/...=s88-c-k-...` resized with `=sNN`; `=s0` = uncropped original; unsigned | always | YTD DOC |
| banner | `brandingSettings.image.bannerExternalUrl`; web `banner`/`imageBannerViewModel.image.sources` | `=s0` gives the uncropped image | if set | YTD DOC |
| followers | `statistics.subscriberCount` | string, **rounded to 3 significant figures**; `hiddenSubscriberCount` bool | — | YTD DOC |
| following | — | **no following count** | — | DOC |
| post count | `statistics.videoCount`, `viewCount` (strings) | — | — | DOC |
| uploads | `contentDetails.relatedPlaylists.uploads` (`UU...`) | — | — | DOC |
| verified | no API field; web badge `BADGE_STYLE_TYPE_VERIFIED` / `..._VERIFIED_ARTIST` | — | — | YTD |
| privacy / kids | `status.{privacyStatus, madeForKids, isLinked}` | — | — | DOC |
| created | `snippet.publishedAt` | ISO 8601 | always | DOC |
| following list | `subscriptions.list?channelId=` works only when the channel made its subscriptions public (otherwise 403 `subscriptionForbidden`). `maxResults` ≤50, `pageToken`/`nextPageToken`. Entry: `snippet.{publishedAt, title, description, resourceId.channelId, thumbnails}`, `contentDetails.totalItemCount` | — | — | MEM |
| subscriber list | `subscriptions.list?mySubscribers=true`: OAuth, own channel only | — | — | MEM |

**Structural facts (YouTube)**
- A video always has a title and a description. Shorts and live streams share the same id and resource. "Short" is a presentation, not a type, in the API.
- A community post is a different object: text plus **one** attachment kind (one image, a multi-image list of 1–10, a video, a playlist or a poll). In the web feed the timestamp is a relative string, not an instant.
- Hashtags and mentions are raw text in the API. Only web runs give link ranges.
- Avatar and banner are one base URL with size parameters (`=sNN`, `=s0`). They are not discrete variants. Video stream URLs are signed and expire; thumbnails are not.
- Counts are strings, and subscriber counts are rounded. There is no following count. Subscription lists are public only when the user opts in.

---

## 4. TikTok

Web JSON is embedded in the page (`webapp.video-detail.itemInfo.itemStruct`, `webapp.user-detail.userInfo`); item lists come from `/api/creator/item_list/`. Official routes: Display API (`user.info.*`) and Research API.

### POST (video or photo-mode)
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| id | `id` | numeric string, ~19 digits | always | GDL MIN |
| URL | `/@{uniqueId}/video/{id}`, `/@{uniqueId}/photo/{id}`, `/share/photo/{id}`; short links `vm.`/`vt.tiktok.com` need a redirect resolve | — | — | VB YTD |
| kind | `imagePost` present = photo post, else `video` | — | — | GDL |
| text | `desc` (single caption, no title); photo posts also have `imagePost.title` (MEM) | plain text, hashtags inline | always | GDL MIN 4C |
| entities | `textExtra[] {awemeId, userId, userUniqueId, isCommerce, hashtagName, ...}`; `start`, `end`, `type`, `hashtagId`, `secUid` are MEM | ranges into `desc` | if any | MIN 4C |
| hashtags | `challenges[] {id, title, desc, ...}`; Research API `hashtag_names[]`, `hashtag_info_list{hashtag_id, hashtag_description}` | structured | if any | MIN 4C DOC |
| people tags | web: UNKNOWN. Research API `video_mention_list` (list of strings, "other users tagged") | — | — | DOC |
| photos | `imagePost.images[] {imageURL.urlList[], imageWidth, imageHeight}` (+ `cover`, `shareCover`, MEM) | ordered; cap ~35 (MEM); no per-image caption or tags found | photo post | GDL |
| video | `video {id, width, height, duration (s), ratio, cover, originCover, dynamicCover, reflowCover, shareCover[], playAddr, downloadAddr (watermarked), bitrate, format, videoQuality, subtitleInfos[]}` | — | video | MIN GDL 4C YTD |
| bitrate variants | `video.bitrateInfo[] {PlayAddr{UrlList[], Width, Height, ...}, Bitrate, QualityType, GearName, CodecType}` (object or list) | **PascalCase** keys | video | GDL; non-PlayAddr keys MEM |
| captions | `video.subtitleInfos[] {Url, Format, LanguageCodeName, LanguageID, Version, Source}` | webvtt | if any | GDL |
| audio | `music {id, title, playUrl, authorName, original, duration, album, coverLarge}`; Research `music_id` | `original` = the creator's own sound | always | MIN 4C GDL YTD |
| duet / stitch | `duetInfo.duetFromId` (`"0"` = none); the source author is found by matching `textExtra.awemeId`; `duetEnabled`, `stitchEnabled`; stitch source UNKNOWN | — | duet | MIN 4C |
| location | `locationCreated` (country code); POI object UNKNOWN | — | — | 4C |
| warnings | `maskType` (3 = sensitive, 4 = photosensitive), `warnInfo[].text`, `isAd`, `adAuthorization` (paid partnership) | — | — | 4C MIN |
| misc | `diversificationLabels[]`, `stickersOnItem[].stickerText[]`, `effectStickers[].name`, `shareEnabled`; pinned flag UNKNOWN | — | — | 4C MIN |
| counts | `stats.{diggCount (likes), commentCount, shareCount, playCount, collectCount (saves)}`; `statsV2` = same as **strings**; `authorStats` | — | always | MIN YTD GDL |
| time | `createTime` | epoch seconds (int or string) | always | GDL MIN 4C |
| media URLs | tiktokcdn URLs are **signed and expiring** (`x-expires` query param); need Referer/cookies | — | — | 4C YTD |
| container | none on web; Research `playlist_id` (creator playlists) | — | — | DOC |
| Research API shape | `id`, `create_time`, `username`, `region_code`, `video_description`, `like/comment/share/view_count`, `favorites_count`, `video_duration`, `effect_ids`, `voice_to_text`, `video_label`, `video_tag` | snake_case, int64 | — | DOC |

### PROFILE
| concept | path / field | type / encoding | present when | src |
|---|---|---|---|---|
| ids | `user.id` (numeric uid string); `user.secUid` (`MS4wLjABAAAA...`, opaque, stable, used in API calls and works in `/@{secUid}` URLs) | strings | always | GDL YTD MIN |
| handle | `user.uniqueId` | changeable; VB regex `[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}` | always | GDL VB |
| display name | `user.nickname` | — | always | MIN YTD |
| bio | `user.signature`; bio link `user.bioLink.link` (MEM) | plain text, no entities | — | MIN |
| avatar | `user.avatarThumb`, `avatarMedium`, `avatarLarger` (~100/720/1080 px, MEM) | **signed, expiring** CDN URLs | always | GDL 4C |
| avatar (API) | `avatar_url`, `avatar_url_100` (100x100), `avatar_large_url` | expiry not documented | — | DOC |
| banner | none | — | — | — |
| counts | `stats.{followerCount, followingCount, heart/heartCount (total likes), videoCount, diggCount, friendCount}`; `statsV2` strings; API `follower_count, following_count, likes_count, video_count` | `statsV2.videoCount` is a string | — | GDL MIN DOC |
| verified | `user.verified`; API `is_verified` | bool, no kind | — | MIN DOC |
| private | `user.privateAccount` (also `secret` on the author) | bool | — | MIN; privateAccount MEM |
| created | UNKNOWN on web (`createTime` MEM, often 0) | — | — | — |
| API ids | Display API `open_id` (per app), `union_id` (per developer) | not the uid | — | DOC |
| lists | Research API `POST /v2/research/user/followers/` and `/following/`: `{username, max_count ≤100, cursor = epoch-seconds follow time}` → `user_followers[{display_name, username}]`, `cursor`, `has_more`. Web follower/following list endpoint: UNKNOWN; login required; following-list visibility is user-controlled (MEM) | — | — | DOC |

**Structural facts (TikTok)**
- A post is either a video or an ordered photo carousel (`imagePost.images`). Photo posts still carry `music`. There is one caption (`desc`) and no title or body split.
- Hashtags and mentions are **structured with ranges** (`textExtra`). Hashtags are also listed separately as `challenges`. Tags are per post; no per-photo tagging was found.
- Duet links to another post by id (`duetFromId`). The source author is only joinable through `textExtra`.
- Three account ids exist: `id` (uid), `secUid` (opaque API key), `uniqueId` (mutable handle). Display API users are app-scoped `open_id`, which cannot be joined to the web uid.
- All media and avatar URLs are signed and expire. Store the stable id plus a fetch timestamp, not just the URL.
- Every count has a numeric and a string twin (`stats` / `statsV2`). Likes are `diggCount`, saves are `collectCount`.

---

## Confidence notes
- **Extractor-source facts** (high: read in the local gallery-dl and yt-dlp code, the twitter-openapi schemas, minet and 4cat): all X field paths, including the new User layout; Reddit post keys, `gallery_data.items[].media_id` and `media_metadata` `s/p/e/m/status`, crosspost, previews; TikTok `itemStruct` core keys, `imagePost`, `bitrateInfo.PlayAddr`, `stats`, `music`, `duetInfo`, `textExtra` subset, `challenges`, `locationCreated`, `maskType`; YouTube `videoDetails`/`microformat`, community-post renderers, `=s0` avatar trick, badge styles.
- **Docs-only** (official pages fetched this session): X v2 object fields and `verified_type` values; TikTok Display `user.info` and Research video/follower fields; YouTube `posts` resource (pilot, 1–10 images).
- **MEM** (medium; recalled, not re-verified): X avatar suffix sizes and banner sizes, X 10-tags-per-photo cap; Reddit gallery 20-item / 180-char caps, flair richtext keys, `subreddit.*` profile keys, `outbound_url` on read payloads; YouTube Data API field details for videos, channels and subscriptions (thumbnail sizes, string counts, 3-sig-fig rounding, subscription privacy); TikTok `textExtra` offsets, avatar pixel sizes, 35-photo cap, `bioLink`, `privateAccount`.
- **UNKNOWN**: YouTube people tags or collaborators, Shorts remix source, music structure, channel bio links in the API; TikTok web people tags, stitch source, POI, web follower-list endpoint, account creation date; Reddit profile social links.
- Live payload sampling failed: Reddit's JSON returned an HTML block page, and the Hugging Face Reddit dump needed auth. No raw live payloads were captured.
