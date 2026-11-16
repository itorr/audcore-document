import {mountVst3Store} from './vst3-store.mjs';

// Pages served before the shared entry was deployed still reference this URL.
mountVst3Store('browser-source');
