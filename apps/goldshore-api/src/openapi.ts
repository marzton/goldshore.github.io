import app from "./app.ts";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const document = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: {
    title: "GoldShore API",
    version: "0.1.0",
  },
  servers: [{ url: "https://api.goldshore.org" }],
});

const out = resolve(__dirname, "../openapi.json");
writeFileSync(out, JSON.stringify(document, null, 2));
console.log("✅ Generated OpenAPI spec at", out);
