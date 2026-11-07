/* is_balanced_html from eyecite 2.7.6 utils.py (Free Law Project, BSD-2-Clause).
 * Uses unchanged libxml2 2.12.3 from the existing authenticated relink bundle.
 * The four-field diagnostic prefix below follows libxml2 xmlError's public ABI.
 * See ../citation-html/licenses/libxml2-Copyright and THIRD_PARTY_NOTICES.md.
 */
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

typedef struct { int domain; int code; char *message; int level; } XmlErrorPrefix;
extern void *xmlReadMemory(const char *, int, const char *, const char *, int);
extern void xmlFreeDoc(void *);
extern void xmlSetGenericErrorFunc(void *, void (*)(void *, const char *, ...));
extern void xmlSetStructuredErrorFunc(void *, void (*)(void *, const XmlErrorPrefix *));
extern const char *xmlParserVersion;
static int failed;
static void ignore_error(void *ctx, const char *message, ...) { (void)ctx; (void)message; }
static void record_error(void *ctx, const XmlErrorPrefix *error) {
    (void)ctx;
    if (error && error->level >= 2) failed = 1;
}
/* The original converter is linked unchanged; no locale/environment lookup. */
const char *locale_charset(void) { return "UTF-8"; }
int xml_version(void) { return atoi(xmlParserVersion); }
/* 0=false, 1=true, 2=invalid ABI input, 3=wrapper allocation failure.
 * Explicit native points preserve isolated and adjacent surrogate distinctions.
 * The no-angle fast path precedes XML encoding/validation, as in the source.
 */
int xml_balance(const uint32_t *input, int length, int width) {
    if (!input || length < 0 || length > 1000000 || (width != 1 && width != 2 && width != 4)) return 2;
    int angle = 0, surrogate = 0;
    for (int i = 0; i < length; i++) {
        uint32_t point = input[i];
        if (point > 0x10ffff) return 2;
        if (point == '<' || point == '>') angle = 1;
        if (point >= 0xd800 && point <= 0xdfff) {
            if (width == 2 && point <= 0xdbff && i + 1 < length && input[i + 1] >= 0xdc00 && input[i + 1] <= 0xdfff) i++;
            else surrogate = 1;
        }
    }
    if (!angle) return 1;
    /* lxml passes kind-2 source through UTF-16, joining a valid surrogate pair;
     * kind-4 source uses UTF-32 and rejects those same literal points. */
    if (surrogate) return 0;
    char *wrapped = malloc((size_t)length * 4 + 12);
    if (!wrapped) return 3;
    memcpy(wrapped, "<div>", 5);
    int cursor = 5;
    for (int i = 0; i < length; i++) {
        uint32_t p = input[i];
        if (width == 2 && p >= 0xd800 && p <= 0xdbff) {
            p = 0x10000 + ((p - 0xd800) << 10) + (input[++i] - 0xdc00);
        }
        if (p < 0x80) wrapped[cursor++] = (char)p;
        else if (p < 0x800) {
            wrapped[cursor++] = (char)(0xc0 | (p >> 6)); wrapped[cursor++] = (char)(0x80 | (p & 63));
        } else if (p < 0x10000) {
            wrapped[cursor++] = (char)(0xe0 | (p >> 12)); wrapped[cursor++] = (char)(0x80 | ((p >> 6) & 63)); wrapped[cursor++] = (char)(0x80 | (p & 63));
        } else {
            wrapped[cursor++] = (char)(0xf0 | (p >> 18)); wrapped[cursor++] = (char)(0x80 | ((p >> 12) & 63)); wrapped[cursor++] = (char)(0x80 | ((p >> 6) & 63)); wrapped[cursor++] = (char)(0x80 | (p & 63));
        }
    }
    memcpy(wrapped + cursor, "</div>", 7);
    failed = 0;
    xmlSetGenericErrorFunc(NULL, ignore_error);
    xmlSetStructuredErrorFunc(NULL, record_error);
    /* lxml XMLParser defaults relevant to this wrapped string. The outer div
     * excludes a source-controlled external document type; NONET remains set. */
    void *doc = xmlReadMemory(wrapped, cursor + 6, NULL, "UTF-8", 2 | 2048 | 16384 | 65536 | 4194304);
    int balanced = doc != NULL && !failed;
    if (doc) xmlFreeDoc(doc);
    free(wrapped);
    return balanced;
}
