#define AUDCORE_FX_EXPORTS
#define AUDCORE_FX_RACK_ONLY
#include "audcore_fx.h"

#include <stdatomic.h>
#include <stdlib.h>

#define CODE "EXAMPLE_GAIN"
#define FUID "56A6415B67BD4E97A54137FB611E5BCA"

typedef struct Gain {
    atomic_uint percent;
    uint32_t channels;
} Gain;

static void *create(void) {
    Gain *gain = malloc(sizeof *gain);
    if (!gain) return NULL;
    atomic_init(&gain->percent, 100);
    if (!atomic_is_lock_free(&gain->percent)) {
        free(gain);
        return NULL;
    }
    gain->channels = 2;
    return gain;
}

static void destroy(void *instance) { free(instance); }

static int prepare(void *instance, uint32_t rate, uint32_t frames,
                   uint32_t channels, uint32_t *latency) {
    if (!rate || !frames || (channels != 1 && channels != 2)) return 0;
    ((Gain *)instance)->channels = channels;
    *latency = 0;
    return 1;
}

static void process(void *instance, float *audio, const float *sidechain,
                    uint32_t frames, double tempo) {
    Gain *gain = instance;
    const float scale = atomic_load_explicit(&gain->percent, memory_order_relaxed) / 100.0f;
    (void)sidechain;
    (void)tempo;
    for (uint32_t i = 0; i < frames; ++i) {
        float left = audio[2 * i] * scale;
        audio[2 * i] = left;
        audio[2 * i + 1] = gain->channels == 1 ? left : audio[2 * i + 1] * scale;
    }
}

static float get(void *instance, uint32_t index) {
    Gain *gain = instance;
    return index == 0 ? atomic_load_explicit(&gain->percent, memory_order_relaxed) / 100.0f : 0.0f;
}

static int set(void *instance, uint32_t index, float normalized) {
    Gain *gain = instance;
    if (index != 0 || !(normalized >= 0.0f && normalized <= 1.0f)) return 0;
    atomic_store_explicit(&gain->percent, (unsigned)(normalized * 100.0f + 0.5f),
                          memory_order_relaxed);
    return 1;
}

static uint32_t save(void *instance, uint8_t *out, uint32_t capacity) {
    Gain *gain = instance;
    if (!out) return 2;
    if (capacity < 2) return 0;
    out[0] = 1;  /* state format version */
    out[1] = (uint8_t)atomic_load_explicit(&gain->percent, memory_order_relaxed);
    return 2;
}

static int restore(void *instance, const uint8_t *data, uint32_t size) {
    Gain *gain = instance;
    if (size != 2 || data[0] != 1 || data[1] > 100) return 0;
    atomic_store_explicit(&gain->percent, data[1], memory_order_relaxed);
    return 1;
}

static void visual_active(void *instance, int enabled) {
    (void)instance;
    (void)enabled;
}

static uint32_t visual(void *instance, float *out, uint32_t capacity) {
    (void)instance;
    (void)out;
    (void)capacity;
    return 0;
}

static const AudcoreFxRack rack = {
    sizeof(AudcoreFxRack), AUDCORE_FX_RACK_ABI_VERSION, CODE, FUID, "1.0.0",
    create, destroy, prepare, process, get, set, save, restore, visual_active, visual
};

static const char definition[] =
    "{\"code\":\"" CODE "\",\"fuid\":\"" FUID "\",\"vendor\":\"Example\","
    "\"label\":{\"zh-CN\":\"Example Gain\"},\"state\":\"example-gain-1\","
    "\"primary\":\"gain\",\"sidechain\":false,\"tail_seconds\":0,"
    "\"visual\":{},\"groups\":[],\"actions\":[],"
    "\"parameters\":[{\"id\":\"gain\",\"name\":\"Gain\","
    "\"label\":{\"zh-CN\":\"Gain\"},\"minimum\":0,\"maximum\":100,\"step\":1,"
    "\"default\":100,\"units\":\"%\",\"skew\":1,\"component\":\"slider\"}]}";

const AudcoreFxRack *audcore_fx_get_rack(uint32_t version) {
    return version == AUDCORE_FX_RACK_ABI_VERSION ? &rack : NULL;
}

const char *audcore_fx_get_definition(uint32_t version, uint32_t *size) {
    if (version != 1 || !size) return NULL;
    *size = sizeof definition - 1;
    return definition;
}
