import path from "node:path";
import { fileURLToPath } from "node:url";

// Dois níveis acima funciona tanto para src/config (tsx) quanto para dist/config (build).
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const CLUBS_DIR = path.join(PROJECT_ROOT, "clubs");
