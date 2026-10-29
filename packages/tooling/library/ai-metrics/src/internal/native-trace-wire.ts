import * as Protobuf from "protobufjs";

// Selective OTLP proto v1.9.0 wire shape. Recursive AnyValue bodies stay opaque.
const wireSchema = `syntax = "proto3";
message AnyValue { string string_value = 1; bool bool_value = 2; int64 int_value = 3; double double_value = 4;
  bytes array_value = 5; bytes kvlist_value = 6; bytes bytes_value = 7; }
message KeyValue { string key = 1; AnyValue value = 2; }
message Resource { repeated KeyValue attributes = 1; }
message Status { int32 code = 3; }
message Span { bytes trace_id = 1; bytes span_id = 2; bytes parent_span_id = 4; string name = 5;
  fixed64 start_time_unix_nano = 7; fixed64 end_time_unix_nano = 8; repeated KeyValue attributes = 9; Status status = 15; int32 kind = 6; }
message Scope { string name = 1; string version = 2; }
message ScopeSpans { Scope scope = 1; repeated Span spans = 2; }
message ResourceSpans { Resource resource = 1; repeated ScopeSpans scope_spans = 2; }
message ExportTraceServiceRequest { repeated ResourceSpans resource_spans = 1; }`;

export const nativeTraceWire = Protobuf.parse(wireSchema).root.lookupType("ExportTraceServiceRequest");
