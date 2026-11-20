import { handler } from "@/lib/api";
import { listStates } from "@/lib/services/geo";

/** GET /api/geo → states. Children: /api/geo/districts, /local-bodies, /wards, /path, /search. */
export const GET = handler({ auth: "public" }, async () => listStates());
