// Must be the first import of the main process: electron-store reads app.getPath("userData") when the
// config store is created (at import time), so the name/paths have to be set before anything else loads.
import { app } from "electron"
import path from "path"
import { BRAND } from "../types/Brand"

app.setName(BRAND.name)
// own settings folder, so Haidangshow and the original FreeShow can be installed side by side
app.setPath("userData", path.join(app.getPath("appData"), BRAND.dataFolder))
