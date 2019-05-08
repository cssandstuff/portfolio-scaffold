import { writable } from 'svelte/store';
export const destroyingCollection = writable(false);
export const activeCollection = writable(0);