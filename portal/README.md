# Fraymus Portal

An MCP server that turns the Fraymus OS One studio API into agent tools. Any MCP client can drive the studio through it: Grok Bot, Claude Desktop, Cursor, or the Fraymus-Workspaces crew. Every call writes a SHA-256-chained receipt.

The portal holds no studio logic of its own. Each tool calls a real route in [`server/index.js`](../server/index.js). The one exception is `brain_think`, which imports the studio's own [`brainMind.js`](../client/src/tools/brainMind.js). If the studio, Ollama or a Mac-only converter isn't there, the tool returns the real error rather than a made-up result.

```
agent ──MCP (stdio or HTTP)──▶ portal ──HTTP──▶ studio 127.0.0.1:4177 ──▶ data/ on disk
                                 │
                                 └─▶ receipts.jsonl (hash chain)
```

## Run it

```bash
# 1. the studio (repo root)
npm install && npm start            # http://127.0.0.1:4177, login on (token in data/studio-token)

# 2. the portal
cd portal && npm install
node src/server.js                   # MCP over stdio (what desktop clients launch)
node src/server.js --http            # MCP at http://127.0.0.1:4191/mcp + JSON at /tools
node src/server.js --http --stdio    # both
node test/smoke.mjs                  # call every tool against the running studio
node scripts/verify-receipts.mjs     # check the receipt chain
```

Node 20 or newer runs the portal. The studio was tested on Node 24.

| Variable | Default | Meaning |
| --- | --- | --- |
| `FRAYMUS_STUDIO_URL` | `http://127.0.0.1:4177` | Where the studio listens |
| `PORTAL_PORT` | `4191` | HTTP mode port, always bound to `127.0.0.1`. The old default 4190 is on the WHATWG fetch blocked-port list, so `fetch()` and browsers refuse it. |
| `FRAYMUS_STUDIO_TOKEN` / `STUDIO_TOKEN` | unset | The studio login token the portal sends as `Authorization: Bearer`. When unset the portal reads the file the studio writes, `STUDIO_TOKEN_FILE` (default `<repo>/data/studio-token`). |
| `PORTAL_TOKEN` | unset | When set, HTTP calls need `Authorization: Bearer <token>` or `x-portal-token`. stdio does not use it, because the client spawns the process itself. |
| `PORTAL_RECEIPTS` | `portal/receipts.jsonl` | Receipt file |
| `PORTAL_OUT_DIR` | `portal/out/` | Where zips, PNGs and MP4s land |
| `PORTAL_ALLOWED_HOSTS` | unset | Extra `Host` values to accept, comma-separated (only for a tunnel you set up on purpose) |
| `PORTAL_FILE_ROOT` | unset | When set, tools that read a local file (`pixel_*`) refuse paths outside it |

`HF_TOKEN` belongs to the studio process, not the portal. The studio reads it from its environment or from `hf-token.txt` in its working directory.

## Tools

| Tool | Route | Needs | Smoke result (Linux box, Oct 29 2026) |
| --- | --- | --- | --- |
| `studio_health` | `GET /api/health`, `/api/system` | studio | worked |
| `brain_status` | `GET /api/brain/status` | studio | worked (reported Ollama offline) |
| `brain_memory_get` | `GET /api/brain/memory` | studio | worked |
| `brain_think` | `brainMind.think()` plus `GET/POST /api/brain/memory` | studio | worked: `8 / 2` and `14 - 9` missed, rewrote the table, and passed. `persist:true` saved the mind. Over HTTP, `6 * 7` returned 42. Dry runs stage what they learn in `out/staged-mind.json` (see Limits). |
| `brain_cortex_chat` | `POST /api/brain/think` | Ollama on 127.0.0.1:11434 | failed cleanly with 503 (no Ollama on the box) |
| `opeg_protocol` | `GET /api/opeg/protocol` | studio | worked, `enforced=true` |
| `opeg_execute` | `POST /api/opeg/execute` | studio | worked, `SUCCESS` with an `R_san` receipt |
| `project_list` / `project_get` | `GET /api/projects` | studio | worked |
| `project_create` | `POST /api/projects` | studio | worked (static stack only) |
| `site_publish` | `POST /api/publish` | studio | worked, served at `/published/<slug>/` on localhost |
| `export_zip` | `POST /api/export/zip` | studio | worked, zip saved in `portal/out/` |
| `pixel_render` | `POST /api/pixel/render` | internet, Hugging Face Space, `HF_TOKEN` on the studio | worked: a real 8-bit render in about 3 s, PNG saved (768×1024) |
| `pixel_convert` | `POST /api/pixel/convert` | macOS (`sips`, `qlmanage`) | 415 on Linux, as expected |
| `pixel_video` | `POST /api/pixel/video` | macOS (`avconvert`) | 415 on Linux, as expected |
| `mail_list` | `GET /api/mail/status`, `/api/mail/messages` | studio | worked (local mailbox, read-only) |

The smoke test also checked HTTP mode. A call without a token got 401, and a foreign `Host` header got 403. `/tools` listed all 16 tools. MCP over streamable HTTP listed and called tools. The receipt chain verified, and no raw argument text appeared in the receipt file.

### Not exposed on purpose

- **Gmail send and connect** (`/api/mail/gmail/*`). Sending mail as the owner is an outside action and should stay a human click.
- **Running code**: `/api/runtime/*`, `/api/node/*`, `/api/cast/hyperframes`. These start processes, install npm packages or run Docker. Adding them would hand an agent a shell, so they need their own approval design first.
- **Writes to the brain logs** (`afk`, `daemon`, `swarm-mesh` and others). They are easy to add later.
- **Voice** (`/api/voice/*`) needs VoiceStudio on 127.0.0.1:3900.

## Receipts

Each call appends one line to `receipts.jsonl`:

```json
{"ts":"2026-10-30T05:47:06.300Z","tool":"studio_health","ok":true,
 "args_hash":"<sha256 of canonical args>","result_hash":"<sha256 of canonical result>",
 "prev_hash":"<hash of the previous line, 64 zeros for the first>","hash":"<sha256 of this line without hash>"}
```

Only hashes are stored, so tokens, photos and page text never land in the file. Keys are sorted before hashing, so the same args always give the same hash. `verify-receipts` walks the chain and names the first line that was edited or removed. `GET /receipts/verify` does the same over HTTP. This is a tamper-evident log, not a signature: anyone who can write the file can rebuild the whole chain. To pin the head somewhere, commit `hash` from the last line to a repo or ledger, such as `continuity/witness_ledger.jsonl` in the RSI sandbox.

## Connect a client

Replace `/path/to/Fraymus-OS-One` with your checkout. On Windows use `C:\\...\\portal\\src\\server.js`.

**Claude Desktop** (`claude_desktop_config.json`), **Cursor** (`~/.cursor/mcp.json`) and most stdio clients:

```json
{
  "mcpServers": {
    "fraymus-portal": {
      "command": "node",
      "args": ["/path/to/Fraymus-OS-One/portal/src/server.js"],
      "env": { "FRAYMUS_STUDIO_URL": "http://127.0.0.1:4177" }
    }
  }
}
```

**HTTP clients** (Grok Bot-style or any client that takes a streamable-HTTP MCP URL) on the same machine:

```bash
PORTAL_TOKEN=$(openssl rand -hex 24) node src/server.js --http
```

```json
{
  "mcpServers": {
    "fraymus-portal": {
      "url": "http://127.0.0.1:4191/mcp",
      "headers": { "Authorization": "Bearer <PORTAL_TOKEN>" }
    }
  }
}
```

The portal only listens on loopback. A cloud agent can't reach it unless you put a tunnel in front, such as Cloudflare Tunnel or ngrok. If you do, set `PORTAL_TOKEN` first and remember that the tunnel URL becomes public. The `Host` check refuses tunnel hostnames unless you list them in `PORTAL_ALLOWED_HOSTS`, so exposing it remotely is a deliberate change.

**Fraymus-Workspaces crew.** The Workspaces server is itself an MCP server, not a client. Its agents can call the portal in two ways:

1. JSON, through the existing `http_get` style tools or a small `fraymus_studio` tool:
   ```bash
   curl -s http://127.0.0.1:4191/tools -H "Authorization: Bearer $PORTAL_TOKEN"
   curl -s -X POST http://127.0.0.1:4191/tools/brain_think \
     -H "Authorization: Bearer $PORTAL_TOKEN" -H "content-type: application/json" \
     -d '{"goal":"100 - 37"}'
   ```
   The reply is `{ ok, result, receipt }`. A workflow node can pass `receipt.hash` downstream as proof of the step.
2. MCP, by adding an MCP client to the Workspaces server that points at `/mcp`. That isn't built yet.

## Limits

- Not offline end to end. `pixel_render` calls a Hugging Face Space over the internet. Only the tools that don't call a model run without a network.
- Mac-only converters. `pixel_convert` and `pixel_video` work only when the studio runs on macOS.
- `brain_think` is the symbolic Think loop. It handles integer arithmetic, `remember`, `recall` and `bind` with a checker. It is not a language model and does not plan. `brain_cortex_chat` is the LLM path, and it needs Ollama.
- `site_publish` and `export_zip` with `project_id` rebuild files with a simpler exporter than the studio UI. The studio's exporter in `client/src/model.js` uses Vite `?raw` imports and can't load in Node. Static projects become `index.html` + `styles.css` + `app.js`, React mode and WASM aren't wired, and `.env` is always left out. Pass `files` yourself for exact output.
- `project_create` makes static projects only.
- Studio login. The studio API needs its token (see the root README). The portal reads it from `FRAYMUS_STUDIO_TOKEN`/`STUDIO_TOKEN` or `data/studio-token` and sends it on every call, so a 401 from a tool means the portal and studio disagree on the token. `GET /health` reports `studioToken: true` when the portal found one.
- `brain_think` dry runs. A dry run never writes to the studio, but a miss still teaches the mind (the operator table gets rewritten). That lesson is staged in `portal/out/staged-mind.json`, tied to the hash of the studio's saved mind, and the next dry run starts from it (`startedFromStaged: true`, `learned` says whether this run changed anything). `persist: true` saves the staged lessons plus the current run to the studio and clears the stage. `discard_staged: true` throws the stage away. If the saved mind changes underneath (the UI's Think tab or another persist), the stage is dropped as stale.
- HTTP mode is stateless: each POST to `/mcp` gets a fresh server, and there are no server-sent notifications.
