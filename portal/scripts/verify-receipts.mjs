// node scripts/verify-receipts.mjs [file]  -> checks the SHA-256 chain.
import path from "node:path";
import { verifyLedger } from "../src/receipts.js";
const file = path.resolve(process.argv[2] || process.env.PORTAL_RECEIPTS || new URL("../receipts.jsonl", import.meta.url).pathname);
const out = verifyLedger(file);
console.log(JSON.stringify({ file, ...out }, null, 2));
process.exit(out.ok ? 0 : 1);
