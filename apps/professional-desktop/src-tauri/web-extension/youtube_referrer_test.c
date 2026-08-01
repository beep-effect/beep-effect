/* cspell:words gboolean gchar Referer REFERER */
#include <gmodule.h>

#include "youtube_referrer.c"

static void assert_request_policy(const gchar *uri, gboolean expected) {
    g_assert_cmpint(is_exact_youtube_embed_request(uri), ==, expected);
}

int main(int argument_count, char **arguments) {
    g_assert_cmpint(argument_count, ==, 2);
    GModule *module = g_module_open(arguments[1], G_MODULE_BIND_LAZY | G_MODULE_BIND_LOCAL);
    g_assert_nonnull(module);
    gpointer initialize = NULL;
    g_assert_true(g_module_symbol(module, "webkit_web_extension_initialize", &initialize));
    g_assert_nonnull(initialize);
    g_assert_true(g_module_close(module));

    assert_request_policy("https://www.youtube-nocookie.com/embed/AbCdEf012_-", TRUE);

    const gchar *rejected[] = {
        "http://www.youtube-nocookie.com/embed/AbCdEf012_-",
        "https://www.youtube.com/embed/AbCdEf012_-",
        "https://youtube-nocookie.com/embed/AbCdEf012_-",
        "https://www.youtube-nocookie.com.evil.test/embed/AbCdEf012_-",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_-?autoplay=1",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_-#fragment",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_-/more",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_-x",
        "https://www.youtube-nocookie.com/embed/AbCdEf012_.",
        "https://www.youtube-nocookie.com/embed/AbCdEf012.%2D",
        NULL,
    };
    assert_request_policy(NULL, FALSE);
    for (gsize index = 0; rejected[index] != NULL; index++) {
        assert_request_policy(rejected[index], FALSE);
    }

    WebKitURIRequest *embed_request =
        webkit_uri_request_new("https://www.youtube-nocookie.com/embed/AbCdEf012_-");
    g_assert_false(send_request(NULL, embed_request, NULL, NULL));
    g_assert_cmpstr(
        soup_message_headers_get_one(
            webkit_uri_request_get_http_headers(embed_request),
            "Referer"
        ),
        ==,
        BEEP_YOUTUBE_APP_REFERER
    );
    g_object_unref(embed_request);

    WebKitURIRequest *unrelated_request =
        webkit_uri_request_new("https://www.youtube-nocookie.com/player.js");
    g_assert_false(send_request(NULL, unrelated_request, NULL, NULL));
    g_assert_null(
        soup_message_headers_get_one(
            webkit_uri_request_get_http_headers(unrelated_request),
            "Referer"
        )
    );
    g_object_unref(unrelated_request);

    return 0;
}
