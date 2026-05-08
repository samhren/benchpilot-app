import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgresql://benchpilot:benchpilot_dev@localhost:5432/benchpilot";

const globalForDb = globalThis as unknown as { _bpClient?: ReturnType<typeof postgres> };
const client = globalForDb._bpClient ?? postgres(url, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb._bpClient = client;

export const db = drizzle(client, { schema });
export { schema };
