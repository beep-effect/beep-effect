/* cspell:words gboolean gchar Referer REFERER */
#include <webkit2/webkit-web-extension.h>
#include <string.h>

#define BEEP_YOUTUBE_EMBED_PREFIX "https://www.youtube-nocookie.com/embed/"
#define BEEP_YOUTUBE_APP_REFERER "https://cloud.beep.professional-desktop/"
#define BEEP_YOUTUBE_VIDEO_ID_LENGTH 11

static gboolean is_exact_youtube_embed_request(const gchar *uri) {
    if (uri == NULL || !g_str_has_prefix(uri, BEEP_YOUTUBE_EMBED_PREFIX)) {
        return FALSE;
    }

    const gchar *video_id = uri + sizeof(BEEP_YOUTUBE_EMBED_PREFIX) - 1;
    if (strlen(video_id) != BEEP_YOUTUBE_VIDEO_ID_LENGTH) {
        return FALSE;
    }

    for (gsize index = 0; index < BEEP_YOUTUBE_VIDEO_ID_LENGTH; index++) {
        const gchar character = video_id[index];
        if (!g_ascii_isalnum(character) && character != '_' && character != '-') {
            return FALSE;
        }
    }
    return TRUE;
}

static gboolean send_request(
    WebKitWebPage *web_page,
    WebKitURIRequest *request,
    WebKitURIResponse *redirected_response,
    gpointer user_data
) {
    (void)web_page;
    (void)redirected_response;
    (void)user_data;

    if (is_exact_youtube_embed_request(webkit_uri_request_get_uri(request))) {
        SoupMessageHeaders *headers = webkit_uri_request_get_http_headers(request);
        if (headers != NULL) {
            soup_message_headers_replace(headers, "Referer", BEEP_YOUTUBE_APP_REFERER);
            g_message("event=beep_youtube_referrer_applied");
        }
    }
    return FALSE;
}

static void page_created(
    WebKitWebExtension *extension,
    WebKitWebPage *web_page,
    gpointer user_data
) {
    (void)extension;
    (void)user_data;
    g_signal_connect(web_page, "send-request", G_CALLBACK(send_request), NULL);
}

G_MODULE_EXPORT void webkit_web_extension_initialize(WebKitWebExtension *extension) {
    g_signal_connect(extension, "page-created", G_CALLBACK(page_created), NULL);
}
