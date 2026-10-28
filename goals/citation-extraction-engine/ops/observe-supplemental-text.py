"""Focused oracle text-operation observation, called only by the pinned exporter."""
import importlib


def observe(rows):
    import eyecite
    module = importlib.import_module("eyecite.annotate")
    original_update = module.SpanUpdater.update
    output = []
    active = []

    def span(text, bounds):
        start, end = bounds
        if not 0 <= start <= end <= len(text):
            raise RuntimeError("probe coordinate outside its owner")
        return {"python": [start, end], "utf16": [len(text[:offset].encode("utf-16-le")) // 2 for offset in bounds], "text": text[start:end]}

    def update(self, offset, bisect):
        result = original_update(self, offset, bisect)
        active.append({"offset": offset, "side": bisect.__name__, "result": result})
        return result

    module.SpanUpdater.update = update
    try:
        for row in rows:
            active.clear()
            try:
                result = getattr(eyecite, row["operation"])(**row["input"])
                outcome = {"kind": "success", "value": result}
            except Exception as error:
                outcome = {"kind": "failure", "type": f"{type(error).__module__}.{type(error).__qualname__}", "message": str(error)}
            input_spans, mapped_spans = [], []
            if row["operation"] == "annotate_citations":
                input_spans = [span(row["input"]["plain_text"], annotation[0]) for annotation in row["input"]["annotations"]]
                mapped_spans = [span(row["input"]["source_text"], [active[index]["result"], active[index + 1]["result"]])
                                for index in range(0, len(active), 2)]
            output.append({"id": row["id"], "operation": row["operation"],
                           "input": row["input"], "mappingUpdates": list(active),
                           "inputSpans": input_spans, "mappedSpans": mapped_spans, "outcome": outcome})
    finally:
        module.SpanUpdater.update = original_update
    return output
