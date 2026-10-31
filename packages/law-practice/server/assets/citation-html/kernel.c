/*
 * Citation HTML kernel linked against the pinned libxml2 2.12.3.
 * Wrapper merging adapts lxml.html.fromstring (Ian Bicking, BSD-3-Clause).
 * Text selection adapts eyecite 2.7.6 clean.py (Free Law Project, BSD-2-Clause).
 * See THIRD_PARTY_NOTICES.md and licenses/. This adapter is authored here;
 * upstream library sources are unchanged. No HTML_PARSE_HUGE is enabled.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <libxml/HTMLparser.h>
#include <libxml/xpath.h>
#include <libxml/xmlerror.h>

enum { OK = 0, PARSE_ERROR = 1, INTERNAL_ERROR = 2, MEMORY_LIMIT = 3,
       OUTPUT_LIMIT = 4, INVALID_INPUT = 5, NATIVE_RESOURCE = 6 };
static char *result = NULL;
static int result_length = 0;
static int result_units = 0;
static int resource_exhausted = 0;

static void structured_error(void *unused, const xmlError *error) {
    (void)unused;
    if (!error) return;
    if (error->code == XML_ERR_NO_MEMORY || error->code == XML_ERR_NAME_TOO_LONG ||
        error->code == XML_XPATH_MEMORY_ERROR ||
        (error->code == XML_ERR_INTERNAL_ERROR && error->message &&
         (strstr(error->message, "Excessive depth in document:") ||
          strstr(error->message, "Huge input lookup")))) resource_exhausted = 1;
}
static void ignore_error(void *unused, const char *message, ...) {
    (void)unused; (void)message;
}
/* lxml drop_tree retains and joins a removed element's following tail. */
static void drop_tree(xmlNodePtr node) {
    if (node->prev && node->next && xmlNodeIsText(node->prev) && xmlNodeIsText(node->next))
        xmlTextMerge(node->prev, node->next);
    xmlUnlinkNode(node);
    xmlFreeNode(node);
}
static int matching_name(xmlNodePtr node, const char *name, int namespaced) {
    if (node->type != XML_ELEMENT_NODE || !xmlStrEqual(node->name, BAD_CAST name)) return 0;
    if (!namespaced) return node->ns == NULL;
    return node->ns && xmlStrEqual(node->ns->href, BAD_CAST "http://www.w3.org/1999/xhtml");
}
/* lxml uses direct unqualified children, falling back to XHTML only if absent. */
static void merge_containers(xmlDocPtr doc, const char *name, int discard_initial_text) {
    xmlNodePtr root = xmlDocGetRootElement(doc), first = NULL;
    int namespaced = 0, found = 0;
    for (xmlNodePtr node = root ? root->children : NULL; node; node = node->next)
        if (matching_name(node, name, 0)) { found = 1; break; }
    if (!found) namespaced = 1;
    for (xmlNodePtr node = root ? root->children : NULL; node;) {
        xmlNodePtr next = node->next;
        if (matching_name(node, name, namespaced)) {
            if (!first) first = node;
            else {
                xmlNodePtr child = node->children;
                if (discard_initial_text)
                    while (child && xmlNodeIsText(child)) child = child->next;
                while (child) {
                    xmlNodePtr next_child = child->next;
                    xmlUnlinkNode(child);
                    xmlAddChild(first, child);
                    child = next_child;
                }
                /* drop_tree can merge/free the following text node. */
                if (node->prev && next && xmlNodeIsText(node->prev) && xmlNodeIsText(next)) next = next->next;
                drop_tree(node);
            }
        }
        node = next;
    }
}
int html_version(void) { return LIBXML_VERSION; }
char *html_output(void) { return result; }
int html_output_length(void) { return result_length; }
int html_output_units(void) { return result_units; }
void html_release(void) {
    free(result); result = NULL; result_length = 0; result_units = 0;
}
int html_clean(const char *input, int length, int kind, int ceiling, int full_html) {
    html_release(); resource_exhausted = 0;
    if (!input || kind < 0 || kind > 3 || length < 0 || length > 4000000 ||
        ceiling < 0 || ceiling > 8000000 || (full_html != 0 && full_html != 1)) return INVALID_INPUT;
    const char *encodings[] = {"UTF-8", "ISO-8859-1", "UTF-16LE", "UTF-32LE"};
    xmlSetGenericErrorFunc(NULL, ignore_error);
    xmlSetStructuredErrorFunc(NULL, structured_error);
    htmlParserCtxtPtr parser = htmlNewParserCtxt();
    if (!parser) return MEMORY_LIMIT;
    htmlDocPtr doc = htmlCtxtReadMemory(parser, input, length, NULL, encodings[kind],
        HTML_PARSE_RECOVER | HTML_PARSE_NONET | HTML_PARSE_COMPACT);
    int status = OK;
    xmlXPathContextPtr context = NULL;
    xmlXPathObjectPtr selected = NULL;
    if (resource_exhausted) { status = NATIVE_RESOURCE; goto done; }
    if (!doc || !xmlDocGetRootElement(doc)) { status = PARSE_ERROR; goto done; }
    if (!full_html) {
        merge_containers(doc, "body", 0);
        merge_containers(doc, "head", 1);
    }
    if (resource_exhausted) { status = NATIVE_RESOURCE; goto done; }
    context = xmlXPathNewContext(doc);
    if (!context) { status = MEMORY_LIMIT; goto done; }
    context->error = structured_error;
    context->userData = NULL;
    selected = xmlXPathEvalExpression(BAD_CAST
        "//text()[normalize-space() and not(parent::style | parent::link | parent::head | parent::page-number | parent::script | parent::*[@class=\"star-pagination\"])]", context);
    if (resource_exhausted) { status = NATIVE_RESOURCE; goto done; }
    if (!selected) { status = INTERNAL_ERROR; goto done; }
    int count = selected->nodesetval ? selected->nodesetval->nodeNr : 0;
    uint64_t bytes = 0, units = 0;
    for (int i = 0; i < count; i++) {
        const unsigned char *text = selected->nodesetval->nodeTab[i]->content;
        if (i) { bytes++; units++; }
        for (size_t j = 0; text && text[j]; j++) {
            bytes++;
            if ((text[j] & 0xc0) != 0x80) units += text[j] >= 0xf0 ? 2 : 1;
            if (units > (uint64_t)ceiling) { status = OUTPUT_LIMIT; goto done; }
        }
        if (units > (uint64_t)ceiling) { status = OUTPUT_LIMIT; goto done; }
    }
    /* Every UTF-8 byte sequence above is parser-owned and bounded by ceiling. */
    result = malloc((size_t)bytes + 1);
    if (!result) { status = MEMORY_LIMIT; goto done; }
    size_t offset = 0;
    for (int i = 0; i < count; i++) {
        const char *text = (const char *)selected->nodesetval->nodeTab[i]->content;
        if (i) result[offset++] = ' ';
        if (text) { size_t size = strlen(text); memcpy(result + offset, text, size); offset += size; }
    }
    result[offset] = 0;
    result_length = (int)offset; result_units = (int)units;
done:
    if (selected) xmlXPathFreeObject(selected);
    if (context) xmlXPathFreeContext(context);
    if (doc) xmlFreeDoc(doc);
    htmlFreeParserCtxt(parser);
    if (resource_exhausted) status = NATIVE_RESOURCE;
    if (status != OK) html_release();
    return status;
}
