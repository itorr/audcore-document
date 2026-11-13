#ifndef AUDCORE_FX_H
#define AUDCORE_FX_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define AUDCORE_FX_ABI_VERSION 1u
#define AUDCORE_FX_RACK_ABI_VERSION 2u

#if defined(_WIN32) && defined(AUDCORE_FX_EXPORTS)
#define AUDCORE_FX_EXPORT __declspec(dllexport)
#else
#define AUDCORE_FX_EXPORT
#endif

typedef struct AudcoreFxProcessor {
    uint32_t size;
    uint32_t version;
    /* Preparation may allocate and start worker threads. On success it writes
       a fixed latency in host-rate frames. Return null on failure. */
    void *(*create)(uint32_t sample_rate, uint32_t max_frames, uint32_t *latency_frames);
    /* Called off the audio thread after the last process call. */
    void (*destroy)(void *instance);
    /* Serial calls per instance. Read and overwrite exactly 2 * frames
       interleaved float samples. Do not allocate, wait or notify the UI. */
    void (*process)(void *instance, float *stereo, uint32_t frames);
} AudcoreFxProcessor;

#if !defined(AUDCORE_FX_RACK_ONLY)
AUDCORE_FX_EXPORT const AudcoreFxProcessor *audcore_fx_get_processor(uint32_t version);
#endif

/* Rack ABI. The host owns the editor and calls process on the audio thread.
   Prepare and restore run with processing suspended. Save, parameters and
   visual snapshots may run concurrently with process. Only the host control
   thread saves state, and only one telemetry reader consumes visual snapshots. */
typedef struct AudcoreFxRack {
    uint32_t size;
    uint32_t version;
    const char *code;
    const char *fuid;
    const char *product_version;
    void *(*create)(void);
    void (*destroy)(void *);
    int (*prepare)(void *, uint32_t rate, uint32_t frames, uint32_t channels, uint32_t *latency);
    void (*process)(void *, float *stereo, const float *sidechain, uint32_t frames, double tempo);
    float (*get)(void *, uint32_t index);
    int (*set)(void *, uint32_t index, float normalized);
    uint32_t (*save)(void *, uint8_t *, uint32_t capacity);
    int (*restore)(void *, const uint8_t *, uint32_t size);
    void (*visual_active)(void *, int enabled);
    uint32_t (*visual)(void *, float *, uint32_t capacity);
} AudcoreFxRack;

#if defined(AUDCORE_FX_RACK_ONLY)
AUDCORE_FX_EXPORT
#endif
const AudcoreFxRack *audcore_fx_get_rack(uint32_t version);

/* Definition ABI v1 returns immutable UTF-8 JSON owned by the module. */
#if defined(AUDCORE_FX_RACK_ONLY)
AUDCORE_FX_EXPORT const char *audcore_fx_get_definition(uint32_t version, uint32_t *size);
#endif

#ifdef __cplusplus
}
#endif

#endif
