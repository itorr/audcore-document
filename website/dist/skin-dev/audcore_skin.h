/* Draft only: trusted in-process native skin contract; not a stable ABI. */
#ifndef AUDCORE_SKIN_DRAFT_H
#define AUDCORE_SKIN_DRAFT_H
#include <stdint.h>
#if defined(_WIN32)
#define AUDCORE_SKIN_CALL __cdecl
#else
#define AUDCORE_SKIN_CALL
#endif
#ifdef __cplusplus
extern "C" {
#endif
#if defined(_WIN32)
#pragma pack(push, 8)
#endif

/* Byte spans are borrowed for the duration of the call. Copy to retain them. */
typedef struct { const uint8_t *data; uint32_t len; } audcore_skin_bytes;
typedef struct { uint32_t size, major, minor; } audcore_skin_header;

/* Version 0 is an experimental contract and must not be treated as stable. */
#define AUDCORE_SKIN_ABI_MAJOR 0u
#define AUDCORE_SKIN_ABI_MINOR 2u
#define AUDCORE_SKIN_THEME_DARK 1u
#define AUDCORE_SKIN_THEME_LIGHT 2u
#define AUDCORE_SKIN_EVENT_SNAPSHOT 1u
#define AUDCORE_SKIN_EVENT_DELTA 2u
#define AUDCORE_SKIN_EVENT_TRANSIENT 3u
#define AUDCORE_SKIN_EVENT_RESPONSE 4u
#define AUDCORE_SKIN_EVENT_ERROR 5u

/* JSON payload is UTF-8, borrowed only until the callback returns. Snapshot and
   delta revisions share one monotonic sequence; transient/response events do
   not advance it. request_id identifies a command response, status 0 succeeds.
   ERROR terminates the subscription after the callback; status is nonzero and
   payload contains a UTF-8 error message. No later callbacks use that token. */
typedef struct {
    uint32_t size;
    uint32_t kind;
    uint64_t revision;
    uint64_t request_id;
    int32_t status;
    audcore_skin_bytes payload;
} audcore_skin_event;
typedef void (AUDCORE_SKIN_CALL *audcore_skin_event_fn)(void *user, const audcore_skin_event *event);

/* Dimensions are logical client pixels. Desktop coordinates are physical pixels. */
typedef struct {
    uint32_t size;
    float default_width, default_height, min_width, min_height;
    float max_width, max_height; /* both zero means unlimited */
    uint32_t resizable, maximizable;
} audcore_skin_window_spec;

/* All functions below run off the audio callback. Window calls use the host UI
   thread. The host owns ctx and its callbacks until destroy has returned.
   The registered HWND can supply a custom icon by embedding the named
   AUDCORE_SKIN_WINDOW_ICON ICON resource in its window instance module. */
typedef struct {
    audcore_skin_header header;
    void *ctx;
    int32_t (AUDCORE_SKIN_CALL *register_window)(void *ctx, void *hwnd, const audcore_skin_window_spec *spec);
    void (AUDCORE_SKIN_CALL *unregister_window)(void *ctx, void *hwnd);
    /* Success means accepted for asynchronous processing, not completed. */
    int32_t (AUDCORE_SKIN_CALL *command)(void *ctx, uint64_t request_id, audcore_skin_bytes request);
    /* Callbacks are queued on the UI thread, starting after subscribe returns. */
    int32_t (AUDCORE_SKIN_CALL *subscribe)(void *ctx, audcore_skin_event_fn callback, void *user, uint64_t *subscription);
    void (AUDCORE_SKIN_CALL *unsubscribe)(void *ctx, uint64_t subscription);
    int32_t (AUDCORE_SKIN_CALL *request_snapshot)(void *ctx, uint64_t subscription);
} audcore_skin_host;

/* The skin copies host fields it retains. It owns its window and instance. */
typedef struct {
    audcore_skin_header header;
    audcore_skin_bytes id, name, version;
    void *(AUDCORE_SKIN_CALL *create)(const audcore_skin_host *host);
    int32_t (AUDCORE_SKIN_CALL *show)(void *instance);
    void (AUDCORE_SKIN_CALL *hide)(void *instance);
    void (AUDCORE_SKIN_CALL *destroy)(void *instance);
    /* ABI 0.2: append-only capabilities. At least one theme must be set;
       scale values are logical UI zoom, independent of operating-system DPI.
       ABI 0.1 modules omit these fields and receive the host defaults. */
    uint32_t themes;
    float scale_min, scale_max, scale_default;
} audcore_skin_descriptor;

/* Export name: audcore_skin_get_descriptor. Returned storage remains valid until
   the module unloads; NULL means the requested ABI major is unsupported. */
typedef const audcore_skin_descriptor *(AUDCORE_SKIN_CALL *audcore_skin_get_descriptor_fn)(uint32_t requested_major);
#if defined(_WIN32)
#pragma pack(pop)
#endif

#ifdef __cplusplus
}
#endif
#endif
