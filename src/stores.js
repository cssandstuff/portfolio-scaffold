import { writable } from 'svelte/store';
export const destroyingExpandedGallery = writable(false);
export const activeCollection = writable(0);
export const loadingSecondary = writable(false);