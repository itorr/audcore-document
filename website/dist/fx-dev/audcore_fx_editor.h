#pragma once
#include <stddef.h>
#include <stdint.h>

// UI thread only. All pointers passed to callbacks are borrowed for the call.
// Destroy the editor before releasing the module or the callback context.
typedef void (*AudcoreFxEdit)(void*, int32_t, int32_t, double);
typedef const char* (*AudcoreFxTranslate)(void*, const char*);
typedef struct AudcoreFxEditor {
    uint32_t size, version;
    int32_t width, height;
    void* (*create)(void* parent, const double*, size_t, int32_t, int32_t, float, AudcoreFxEdit, void*);
    void (*destroy)(void*);
    void (*resize)(void*, int32_t, int32_t, float);
    void (*parameter)(void*, size_t, double);
    void (*visual)(void*, const float*, size_t);
    void (*translate)(void*, AudcoreFxTranslate, void*);
} AudcoreFxEditor;

// Export: const AudcoreFxEditor* audcore_fx_get_editor(uint32_t version);
