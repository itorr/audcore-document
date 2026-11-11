/* Audcore IO extension ABI: provisional, Windows x64, C calling convention. */
#ifndef AUDCORE_IO_H
#define AUDCORE_IO_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define AUDCORE_IO_ABI_MAJOR 1u
#define AUDCORE_IO_ABI_MINOR 5u
#define AUDCORE_IO_INPUT 1u
#define AUDCORE_IO_OUTPUT 2u
/* Borrowed byte slice, not necessarily NUL-terminated. Encoding and lifetime
   depend on the field: descriptor id/name/version are UTF-8 and remain valid
   until the library unloads; stream configuration and endpoint bytes are valid
   only during start; control requests, responses, notifications and reports are
   valid only for their respective call. Copy data that must outlive that call.
   Opaque configuration bytes are not guaranteed to be UTF-8. */
typedef struct { const uint8_t *data; uint32_t len; } audcore_io_bytes;
typedef struct { uint32_t size, major, minor; } audcore_io_header;
typedef void (*audcore_io_app_notify)(void *context, audcore_io_bytes event);
#define AUDCORE_IO_CLOCK_HOST 1u
#define AUDCORE_IO_CLOCK_INDEPENDENT 2u
#define AUDCORE_IO_BUFFER_DEFAULT 0u
#define AUDCORE_IO_BUFFER_LOW_LATENCY 1u
#define AUDCORE_IO_BUFFER_STABLE 2u
/* ABI 1.4 requires the full stream host and config structures. Check size
   before reading them; optional callback pointers may still be NULL.
   Host callbacks run only from non-audio threads. Buffers are interleaved f32.
   Callback context stays valid until stop returns; no callback afterwards.
   For each input stream, serialize write, input_format and reset_input on one
   producer; report the actual input format before writing independent audio. */
typedef struct audcore_io_stream_host {
    uint32_t size;
    void *context;
    uint32_t (*buffered_frames)(void *context);
    uint64_t (*requested_epoch)(void *context);
    void (*begin_epoch)(void *context, uint64_t epoch);
    uint32_t (*write)(void *context, const float *data, uint32_t frames, uint32_t channels);
    uint32_t (*read)(void *context, float *data, uint32_t frames, uint32_t channels);
    void (*report)(void *context, int32_t code, audcore_io_bytes message);
    uint64_t (*position)(void *context);
    uint32_t (*read_packet)(void *context, uint64_t *cursor, float *data, uint32_t frames, uint32_t channels, uint32_t *flags);
    void (*set_demand)(void *context, uint32_t active);
    void (*input_format)(void *context, uint32_t sample_rate, uint32_t period_frames);
    void (*reset_input)(void *context);
    uint32_t (*is_enabled)(void *context, uint32_t direction);
    /* Optional capability. Device-clock read includes silence and
       applies host rate conversion/drift correction off the audio thread. */
    uint32_t (*read_at_rate)(void *context, float *data, uint32_t frames, uint32_t channels, uint32_t sample_rate, uint32_t buffer_policy, uint32_t buffer_ms);
    /* Optional capabilities.
       Open/reset/close and app subscriptions run on non-audio control workers;
       each lane has one capture writer and a generation token. lane_write must
       be nonblocking and must not wake a consumer. unsubscribe_apps returns
       only after every callback using its user context has stopped. */
    int32_t (*lane_open)(void *context, uint32_t lane, uint64_t generation, uint32_t sample_rate, uint32_t period_frames);
    uint32_t (*lane_write)(void *context, uint32_t lane, uint64_t generation, const float *pcm, uint32_t frames, uint32_t channels);
    void (*lane_reset)(void *context, uint32_t lane, uint64_t generation);
    void (*lane_close)(void *context, uint32_t lane, uint64_t generation);
    uint64_t (*subscribe_apps)(void *context, audcore_io_app_notify notify, void *user);
    void (*request_apps)(void *context, uint64_t subscription);
    void (*unsubscribe_apps)(void *context, uint64_t subscription);
    /* Prepare without publishing audio; activate after priming. */
    int32_t (*lane_prepare)(void *context, uint32_t lane, uint64_t generation, uint32_t sample_rate, uint32_t period_frames, uint32_t buffer_ms);
    int32_t (*lane_activate)(void *context, uint32_t lane, uint64_t generation);
    /* UTF-8 state directory, borrowed until stop. */
    audcore_io_bytes (*data_directory)(void *context);
} audcore_io_stream_host;
typedef struct audcore_io_stream_config {
    uint32_t size, direction, clock, sample_rate, channels;
    audcore_io_bytes endpoint, configuration;
    /* Version of opaque configuration; zero means unspecified. */
    uint32_t state_version;
    /* Empty / zero inherit endpoint / channels. */
    audcore_io_bytes output_endpoint;
    uint32_t output_channels;
} audcore_io_stream_config;
typedef struct audcore_io_stream_api {
    audcore_io_header header;
    void *(*start)(void *instance, const audcore_io_stream_config *config, const audcore_io_stream_host *host);
    void (*stop)(void *stream);
    uint32_t (*running)(void *stream);
} audcore_io_stream_api;
/* Control handlers run off the audio thread. They call respond exactly once
   before returning, with borrowed UTF-8 JSON (or error text for nonzero code).
   A menu selection returns candidate state only; the host may reject it, so
   selection must not commit persistent side effects. Menu checked states derive
   from the host-provided context after the host commits the route. */
typedef void (*audcore_io_respond)(void *context, int32_t code, audcore_io_bytes response);
typedef void (*audcore_io_notify)(void *context, audcore_io_bytes json_event);
typedef struct audcore_io_control_api {
    audcore_io_header header;
    int32_t (*invoke)(void *instance, audcore_io_bytes request, audcore_io_respond respond, void *context);
    /* Optional tail, available only if header.size covers it. Notifications run
       off the audio thread. unsubscribe joins callbacks before returning. A
       failed subscribe returns NULL and must not retain the context. */
    void *(*subscribe)(void *instance, audcore_io_notify notify, void *context);
    void (*unsubscribe)(void *instance, void *subscription);
} audcore_io_control_api;
typedef struct audcore_io_descriptor {
    audcore_io_header header;
    uint32_t directions;
    audcore_io_bytes id, name, version;
    void *(*create)(void);
    void (*destroy)(void *instance);
    const audcore_io_stream_api *stream;
    const audcore_io_control_api *control;
} audcore_io_descriptor;
/* Lifecycle calls are serialized but may run on different non-audio control
   threads. A plugin with UI thread affinity must marshal its own UI work. */
/* Export as audcore_io_entry. Return NULL for an incompatible host. */
const audcore_io_descriptor *audcore_io_entry(uint32_t host_major, uint32_t host_minor);
#ifdef __cplusplus
}
#endif
#endif
