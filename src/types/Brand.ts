// Haidangshow: a fork of FreeShow (https://github.com/ChurchApps/FreeShow, GPL-3.0) with a vMix-style Mixer.
// Kept in one place so the fork can install next to the original FreeShow without sharing data.

export const BRAND = {
    name: "Haidangshow",
    appId: "app.haidangshow",
    /** folder name for settings (Application Support) and the default data folder (Documents) */
    dataFolder: "Haidangshow",
    /** this fork has no update server and no error reporting backend */
    isFork: true,
    upstream: "FreeShow by ChurchApps (GPL-3.0)"
} as const
