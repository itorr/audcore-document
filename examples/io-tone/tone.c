#include "audcore_io.h"
#include <windows.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define ABI(Type) { sizeof(Type), AUDCORE_IO_ABI_MAJOR, AUDCORE_IO_ABI_MINOR }
#define BYTES(Text) { (const uint8_t *)(Text), sizeof(Text) - 1 }
#define ID "example.audcore.tone"
#define NAME "Test Tone"
#define VERSION "1.0.0"

enum { BLOCK = 128 };
typedef struct {
    audcore_io_stream_host host;
    HANDLE stop_event, thread;
    uint32_t rate;
} Tone;

static DWORD WINAPI produce(void *arg) {
    Tone *tone = arg;
    audcore_io_stream_host *host = &tone->host;
    uint64_t epoch = UINT64_MAX;
    uint32_t phase = 0;
    float pcm[BLOCK];

    do {
        uint64_t requested = host->requested_epoch(host->context);
        if (requested != epoch) {
            epoch = requested;
            phase = 0;
            host->begin_epoch(host->context, epoch);
        }
        uint32_t target = tone->rate / 50 + BLOCK;
        while (WaitForSingleObject(tone->stop_event, 0) == WAIT_TIMEOUT && host->buffered_frames(host->context) < target) {
            for (uint32_t i = 0; i < BLOCK; ++i) {
                uint32_t sample_phase = (phase + i * 440) % tone->rate;
                pcm[i] = 0.02f * sinf(6.2831853f * sample_phase / tone->rate);
            }
            uint32_t written = host->write(host->context, pcm, BLOCK, 1);
            phase = (phase + written * 440) % tone->rate;
            if (written < BLOCK) break;
        }
    } while (WaitForSingleObject(tone->stop_event, 2) == WAIT_TIMEOUT);
    return 0;
}

static void *create(void) { return malloc(1); }
static void destroy(void *instance) { free(instance); }

static void *start(void *instance, const audcore_io_stream_config *config,
                   const audcore_io_stream_host *host) {
    if (!instance || config->size < sizeof(*config) || host->size < sizeof(*host) ||
        config->direction != AUDCORE_IO_INPUT || config->clock != AUDCORE_IO_CLOCK_HOST ||
        config->channels != 1 || !config->sample_rate || !host->write ||
        !host->buffered_frames || !host->requested_epoch || !host->begin_epoch) return NULL;

    Tone *tone = malloc(sizeof(*tone));
    if (!tone) return NULL;
    tone->host = *host;
    tone->rate = config->sample_rate;
    tone->stop_event = CreateEventW(NULL, TRUE, FALSE, NULL);
    if (tone->stop_event) {
        tone->thread = CreateThread(NULL, 0, produce, tone, 0, NULL);
        if (tone->thread) return tone;
        CloseHandle(tone->stop_event);
    }
    free(tone);
    return NULL;
}

static void stop(void *stream) {
    Tone *tone = stream;
    SetEvent(tone->stop_event);
    WaitForSingleObject(tone->thread, INFINITE);
    CloseHandle(tone->thread);
    CloseHandle(tone->stop_event);
    free(tone);
}

static uint32_t running(void *stream) {
    return WaitForSingleObject(((Tone *)stream)->thread, 0) == WAIT_TIMEOUT;
}

/* Matches the host's compact JSON for this fixed menu. Use a parser for variable input. */
static int contains(audcore_io_bytes bytes, const char *key) {
    size_t length = strlen(key);
    for (size_t i = 0; i + length <= bytes.len; ++i) {
        if (memcmp(bytes.data + i, key, length) == 0) return 1;
    }
    return 0;
}

static int32_t invoke(void *instance, audcore_io_bytes request,
                      audcore_io_respond respond, void *context) {
#define MENU(Revision, Checked) BYTES( \
    "{\"revision\":" Revision ",\"root\":{\"id\":\"root\",\"label\":\"\",\"mode\":\"single\"," \
    "\"children\":[{\"kind\":\"choice\",\"id\":\"tone\",\"label\":\"" NAME "\"," \
    "\"selected\":" Checked ",\"enabled\":true,\"needs_options\":false}]}}")
    static const audcore_io_bytes menu = MENU("1", "false");
    static const audcore_io_bytes checked_menu = MENU("2", "true");
#undef MENU
    static const audcore_io_bytes selected = BYTES(
        "{\"revision\":2,\"selected\":true,\"binding\":{\"endpoint_id\":\"tone\","
        "\"display_name\":\"" NAME "\",\"direction\":1,\"channels\":1,\"channel_mode\":1,"
        "\"clock\":\"host\",\"state_version\":0,\"state\":[]}}");
    static const audcore_io_bytes unsupported = BYTES("Unsupported menu request");
    if (instance && contains(request, "\"action\":\"menu\"") &&
        contains(request, "\"direction\":1")) {
        respond(context, 0, contains(request, "\"endpoint_id\":\"tone\"") ? checked_menu : menu);
    } else if (instance && contains(request, "\"action\":\"select\"") &&
               contains(request, "\"item_id\":\"tone\"") &&
               contains(request, "\"revision\":1") && contains(request, "\"selected\":true")) {
        respond(context, 0, selected);
    } else {
        respond(context, -1, unsupported);
    }
    return 0;
}

static const audcore_io_stream_api stream = {
    ABI(audcore_io_stream_api), start, stop, running
};
static const audcore_io_control_api control = {
    ABI(audcore_io_control_api), invoke, NULL, NULL
};
static const audcore_io_descriptor descriptor = {
    ABI(audcore_io_descriptor), AUDCORE_IO_INPUT, BYTES(ID), BYTES(NAME), BYTES(VERSION),
    create, destroy, &stream, &control
};

const audcore_io_descriptor *audcore_io_entry(uint32_t major, uint32_t minor) {
    return major == AUDCORE_IO_ABI_MAJOR && minor >= AUDCORE_IO_ABI_MINOR ? &descriptor : NULL;
}
