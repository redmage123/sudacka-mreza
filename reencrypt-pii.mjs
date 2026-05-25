/**
 * Re-encrypt existing plaintext PII for all managed collections.
 *
 * Safe to re-run — fields already encrypted (enc:v1:...) are skipped
 * idempotently by the beforeChange hook.
 *
 * Usage:
 *   docker cp /tmp/reencrypt-pii.mjs sudacka-mreza-cms-1:/app/reencrypt-pii.mjs
 *   docker exec -u root sudacka-mreza-cms-1 chown appuser:appgroup /app/reencrypt-pii.mjs
 *   docker exec -w /app sudacka-mreza-cms-1 node /app/reencrypt-pii.mjs
 */
import { getPayload } from "payload";
import config from "./dist/payload.config.js";

const VERSION_PREFIX = "enc:v1:";

const TARGETS = [
  { collection: "bankruptcy-administrators", fields: ["phone", "email", "address"] },
  { collection: "expert-witnesses", fields: ["phone", "email"] },
  { collection: "interpreters", fields: ["phone", "email"] },
  { collection: "users", fields: ["profile.phone"] },
];

const getPath = (obj, path) =>
  path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

async function main() {
  const payload = await getPayload({ config });
  let totalScanned = 0;
  let totalReEncrypted = 0;

  for (const { collection, fields } of TARGETS) {
    console.log(`\n[${collection}] scanning for plaintext PII in ${fields.join(", ")}...`);

    // Paginate through all documents
    let page = 1;
    let touchedInCollection = 0;
    while (true) {
      const result = await payload.find({
        collection,
        limit: 100,
        page,
        overrideAccess: true,
      });

      for (const doc of result.docs) {
        totalScanned++;
        // Check if any field needs re-encryption
        const needsUpdate = fields.some((f) => {
          const v = getPath(doc, f);
          return typeof v === "string" && v.length > 0 && !v.startsWith(VERSION_PREFIX);
        });

        if (!needsUpdate) continue;

        // Re-save the doc — our beforeChange hook will encrypt any plaintext field
        // The afterRead already decrypted anything that was encrypted, so all fields
        // are plaintext here → encryption will run on all of them again (idempotent-safe).
        try {
          await payload.update({
            collection,
            id: doc.id,
            data: {},  // Empty update — Payload re-runs hooks on existing data
            overrideAccess: true,
          });
          touchedInCollection++;
          totalReEncrypted++;
          if (touchedInCollection % 25 === 0) {
            console.log(`  re-encrypted ${touchedInCollection} rows in ${collection}...`);
          }
        } catch (err) {
          console.error(`  [error] ${collection}/${doc.id}: ${err.message}`);
        }
      }

      if (!result.hasNextPage) break;
      page++;
    }
    console.log(`[${collection}] re-encrypted ${touchedInCollection} rows`);
  }

  console.log(`\nDone. Scanned: ${totalScanned}. Re-encrypted: ${totalReEncrypted}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
