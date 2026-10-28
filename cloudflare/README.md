# New JSON loot file creation: Cloudflare Worker integration

Build It!++ now prepares both **existing-file updates** and **first-time creation** of
`builditlootdrop.json` in the Chernarus mission `custom` directory.

## What is deployed / not deployed

- The website uses `/api/files/create` for an absent file and the existing
  `/api/files/write` endpoint for an existing file.
- The server-side implementation is `nitrado-create-handler.mjs`. **Committing it
  to this GitHub Pages repository does not modify the deployed Cloudflare Worker.**
- Until the handler is bundled into that Worker and deployed, first-time creation
  will fail with an explicit message. Existing-file updates continue as before.
- ChatGPT GitHub access alone does not grant Cloudflare or Nitrado credentials.

## Hooking into the existing Cloudflare Worker

In the Worker source (not the public website), import the function:

```js
import { createDayzLootFile } from './nitrado-create-handler.mjs';
```

Add a route after the **same read access check and separate MAP_WRITE_KEY check**
used by `/api/files/write`. The following is an illustration; names like
`selectedServer` must be adapted to the actual Worker implementation.

```js
if (url.pathname === '/api/files/create' && request.method === 'POST') {
  // All existing server-selection, MAP_ACCESS_KEY, MAP_WRITE_KEY and CORS
  // checks MUST have completed successfully before calling this function.
  return createDayzLootFile(request, {
    authorized: true,
    serviceId: selectedServer.serviceId,
    fileRoot: selectedServer.fileRoot, // /games/<identifier>/ftproot or /noftp
    nitradoToken: env.NITRADO_TOKEN
  });
}
```

IMPORTANT: never serve the handler with `authorized:true` from an unprotected
public route. It intentionally delegates authentication to the parent Worker.
Use the original Worker CORS response wrapper or attach identical CORS headers
to these responses.

The handler:
1. Accepts only `POST` with `confirm:true` and `expectedAbsent:true`.
2. Allows exactly one filename in known Chernarus mission roots.
3. Validates the JSON structure, per-object persistence, size and path.
4. Checks that the target does not exist, using the Nitrado list endpoint.
5. Requests a Nitrado file-server upload token, uploads the UTF-8 bytes, then
   downloads and verifies the stored bytes before returning `verified:true`.
6. Returns HTTP 409 if the file already exists, rather than overwriting it.

Nitrado does not expose an atomic create-if-absent file-server operation.
Avoid concurrent writes to the same path. If an upload fails or times out,
inspect the Nitrado directory before retrying.

## Rollout

Deploy and test the Worker route before using **Review live loot JSON upload**.
Keep the DayZ server stopped for file changes. Ensure `cfgGameplay.json`
(`cfggameplay.json` on disk) is enabled by the Nitrado DayZ server configuration.
The Event Manager will register the loot filename in
`WorldsData.objectSpawnersArr`. Its normal upload flow retains the existing
gameplay file and creates a verified backup before replacing it.

Do not paste Nitrado access tokens or MAP_WRITE_KEY into GitHub source files.
Store secrets only in Cloudflare Worker secrets/environment variables.

## Large existing mission files (types.xml)

Vanilla `db/types.xml` can exceed the older 512 KB Worker editing limit. For the full existing-file Server Tools workflow, edit your *deployed* Cloudflare Worker source:

```js
const MAX_FILE_BYTES = 4 * 1024 * 1024;
```

Change the corresponding error text from `512 KB` to `4 MB` if present. The website `server-tools-bridge.js` and `format-validator.js` already support up to 4 MB. The separate File Manager may still retain its smaller editor limit; that is intentional. Preserve `MAP_SYNC_KEY` / `MAP_WRITE_KEY`, path validation, checksum verification, Nitrado backup and read-after-write checks. A GitHub commit alone DOES NOT deploy Cloudflare Worker code. Verify with a non-destructive read before allowing writes.
