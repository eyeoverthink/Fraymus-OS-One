<p align="center">
  <img src="docs/showcase/banner.svg" alt="Fraymus Web Studio" width="100%">
</p>

<p align="center">
  <b>A browser studio for HTML, React, and MERN — and a mailbox that can launch a signed program.</b>
</p>

<p align="center">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="Express 4" src="https://img.shields.io/badge/Express-4-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="MongoDB optional" src="https://img.shields.io/badge/MongoDB-optional-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="FLUX.2 Klein" src="https://img.shields.io/badge/8--bit-FLUX.2%20Klein-00e5ff?style=flat-square&labelColor=0b1a12">
  <img alt="Localhost only" src="https://img.shields.io/badge/binds-127.0.0.1-00e5ff?style=flat-square&labelColor=0b1a12">
</p>

<p align="center">
  <a href="docs/APP_OUTLINE.md">Outline</a> ·
  <a href="docs/SOVEREIGN_BRAIN_README.md"><b>Sovereign Brain &amp; Seal</b></a> ·
  <a href="#email-that-runs">Email</a> ·
  <a href="#8-bit-studio">8-bit studio</a> ·
  <a href="docs/AVATAR_STUDIO.md">Production</a> ·
  <a href="#html-react-and-pair">HTML &amp; Pair</a> ·
  <a href="#mern">MERN</a> ·
  <a href="#crud">CRUD</a> ·
  <a href="#repl">REPL</a> ·
  <a href="#canvas">Canvas</a> ·
  <a href="#live-node-vm-publish-export">Ship it</a> ·
  <a href="#start">Start</a>
</p>

<p align="center">
  Chapters:
  <a href="docs/SOVEREIGN_BRAIN_README.md"><b>Sovereign Brain, Living Seal &amp; Co-Pilot</b></a> ·
  <a href="docs/APP_OUTLINE.md">Full outline</a> ·
  <a href="docs/8BIT_STATUS.md">8-bit status</a> ·
  <a href="docs/8BIT_MOTION.md">8-bit motion</a> ·
  <a href="docs/AVATAR_STUDIO.md">Avatar studio</a>
</p>

<p align="center">
  <img src="docs/showcase/code.png" alt="The Code workspace: library, MERN file tree, editor, and live preview" width="100%">
</p>

Write a page, see it render as you type, pair it with its stylesheet, give it a REST API, poke the DOM from a REPL, lay it out on a cube grid, turn a selfie into an 8-bit game character, and ship the result as a zip, a Docker bundle, or a single HTML file. A message whose subject starts with `FRAYMUS-DEPLOY-` can carry a whole program as emoji. The watcher reads it, checks it, and posts it to a hub on this machine. Everything runs at `127.0.0.1`.

Repository: [eyeoverthink/fraymus-css](https://github.com/eyeoverthink/fraymus-css)

The full map of every workspace, including the 8-bit camera, Style video, Cartoon video, Talk, and Production, is the [outline](docs/APP_OUTLINE.md). This page stays the tour.

## At a glance

| Workspace | What you do there |
| --- | --- |
| **[Dispatch](#email-that-runs)** | Sign a program, hide it in emoji, verify it, run it |
| **[Mail](#email-that-runs)** | Read and send from Gmail or the mailbox on this machine |
| **[Code](#html-react-and-pair)** | Snippet library, editor, Pair view, live preview, console |
| **[CRUD](#crud)** | Name a resource, then `POST`, `GET`, `PUT`, `PATCH`, `DELETE` it, then compile it into the project |
| **[REPL](#repl)** | JavaScript and DOM commands on a live stage, with draggable methods |
| **[Canvas](#canvas)** | Drop blocks on a 2×2, 3×3, or 4×4 cube and compile it to a page |
| **[8-bit](#8-bit-studio)** | Photo, camera, or video. Style video is the filter. Cartoon video is the AI sprite. See the [chapters](docs/8BIT_STATUS.md). |
| **[Production](docs/AVATAR_STUDIO.md)** | A cast of faces. Make each one into a talking sprite, then add the next face. |
| **[Seal](docs/SOVEREIGN_BRAIN_README.md#2-living-seal-sealpagejsx--fsel-v1-talking-emoji-capsule)** | Pack an 8-bit talking sprite, WAV voice, lip-sync timeline, 4-leaf Merkle tree, and Ed25519 signature into one emoji (`FSEL` v1) |
| **[Brain](docs/SOVEREIGN_BRAIN_README.md)** | Ouroboros 5-Stage Quantum RSI, Centripetal Memory, Constructed Emotion, 4-Proof Consciousness Audit, Local Ollama Cortex, and Autonomous Studio Co-Pilot |
| **[HTML · JS](docs/APP_OUTLINE.md#html-and-javascript)** | HTML and JavaScript side by side, with a live preview |
| **Emoji** | Text, DNA, and zero-width, hidden behind a glyph |
| **Emoji Coder** | Emoji markup to HTML, CSS, JavaScript, and Java |
| **WASM** | FrayVM bytecode, a real WebAssembly module, one emoji |

## Email that runs

A deploy message is a program hidden in emoji. The recipient inside it is a FRAYMUS number, `fx-` plus four groups of four hex digits. The mailbox for this studio is `fx-4041-f10e-7ee2-2bdc`. An email address, including `fx-4041@fraymus.world` and `agent@fraymus.cloud`, is not that number. Dispatch will not sign one, and the hub on `127.0.0.1:8787` will not accept one.

<p align="center">
  <img src="docs/showcase/dispatch.png" alt="Dispatch workspace with the heartbeat ready" width="100%">
</p>

**Compose** in the Dispatch tab builds the envelope: from, to, subject, and a program (CSS, JS, HTML, or WASM). **Sign (Ed25519) & encode** writes a real signature over the canon and turns the bytes into the 64-emoji alphabet. `💤` is the padding character. **Run heartbeat** then does the six ticks on that text: decode, verify the signature, Merkle and the time window, unpack the files, run the program in a sandbox, and hand it to mail.

<p align="center">
  <img src="docs/showcase/mail.png" alt="Mail workspace on the local mailbox, with a deploy message in the inbox" width="100%">
</p>

**Mail** is the mailbox in the studio. Gmail uses IMAP and SMTP once an app password is saved on this machine. Local mail is `data/mailbox/box.json`. Folders, compose, reply, reply all, forward, flag, move, trash, and import or export as `.eml` or `.mbox` are all there.

The live run did not depend on the Mail tab being open. `scripts/email-watcher/watcher.mjs` polls Gmail for unread and already-read subjects that start with `FRAYMUS-DEPLOY-`. Mail you send to yourself arrives already marked read, so an unread-only search would miss it. The watcher remembers which messages it has already handled.

This is the pass that reached the hub:

```text
→ FRAYMUS-DEPLOY-agent
  checks decode:✓ sig:✓ merkle:✕ ts:✓ · to=agent@fraymus.cloud
  ✓ dispatched → {"ok":true,"to":"agent@fraymus.cloud","accepted":true}
```

The hub printed:

```text
/api/dispatch from=eyeoverthink@gmail.com to=agent@fraymus.cloud subject=FRAYMUS-DEPLOY-test
```

Five deploy messages were already in that inbox. Each one took a different branch:

| Subject | Target | What happened |
| --- | --- | --- |
| `FRAYMUS-DEPLOY-test` | `fx-4041@fraymus.world` | Decoded. Signature failed, so it was not sent. |
| `FRAYMUS-DEPLOY-test` | `FRAYNIX` | Accepted. The hub replied `felt FRAYNIX`. |
| `FRAYMUS-DEPLOY-test` | none | The emoji line was damaged. Decode failed. |
| `FRAYMUS-DEPLOY-agent` | `agent@fraymus.cloud` | The old hub accepted it. That address is not a FRAYMUS number, so this hub now rejects it. |
| `FRAYMUS-DEPLOY-test` | `agent@fraymus.cloud` | Same wrong address. Rejected by the number check. |

`decode` and `sig` have to pass. `merkle` and the timestamp are warnings, which is why a row can show `merkle:✕` and still be dispatched. The signature check in the watcher confirms the key and signature are present and the right length. The Dispatch tab is where Ed25519 is actually signed and verified. The hub in this repo is the local stand-in: it binds `127.0.0.1:8787`, logs from, to, and subject, and answers. It does not re-check the signature.

Where a verified payload goes:

| Condition | POST |
| --- | --- |
| Canon contains `COMMAND:EMAIL` | `/api/mail/forward` |
| `dispatchTo` is `FRAYNIX` | `/api/fraynix/feel` |
| A FRAYMUS number `fx-xxxx-xxxx-xxxx-xxxx`, or `BROADCAST` | `/api/dispatch` |

The watcher reads a Gmail inbox that already exists. The number inside the emoji is the hub mailbox. `fx-4041-f10e-7ee2-2bdc` is that mailbox. Fraymus Academy is a separate app; this studio only uses the same number rule.

```bash
# credentials live in ~/.fraymus-v13/email-watcher.env
# IMAP_USER, IMAP_PASS (a Gmail app password), HUB_URL=http://127.0.0.1:8787
node scripts/email-watcher/hub.mjs
node scripts/email-watcher/watcher.mjs
```

The app password stays in that file. It is not in the repo.

## 8-bit studio

Turn any photo into a chunky 8-bit portrait: hard black outlines, flat cel shading, a black background, and glowing cyan rim pixels. The face stays recognizable.

<table>
  <tr>
    <td align="center"><img src="docs/showcase/8bit-photo.jpg" alt="Original photo" width="240"></td>
    <td align="center"><img src="docs/showcase/8bit-render.png" alt="AI Render, Real outfit" width="240"></td>
    <td align="center"><img src="docs/showcase/8bit-avatar.png" alt="AI Render, Avatar" width="240"></td>
  </tr>
  <tr>
    <td align="center"><b>Photo</b><br><sub>any image or document</sub></td>
    <td align="center"><b>AI Render · Real outfit</b><br><sub>keeps the clothes, hair, and beard</sub></td>
    <td align="center"><b>AI Render · Avatar</b><br><sub>fedora, shades, navy jacket with cyan trim</sub></td>
  </tr>
</table>

Every view is built from the AI render, so you can restyle it without rendering again:

<table>
  <tr>
    <td align="center"><img src="docs/showcase/8bit-character.png" alt="Character view" width="240"></td>
    <td align="center"><img src="docs/showcase/8bit-trace.png" alt="Trace view" width="240"></td>
    <td align="center"><img src="docs/showcase/8bit-abstract.png" alt="Abstract view" width="240"></td>
  </tr>
  <tr>
    <td align="center"><b>Character</b><br><sub>offline filter: palette, outlines, cyan</sub></td>
    <td align="center"><b>Trace</b><br><sub>cyan line art of every edge</sub></td>
    <td align="center"><b>Abstract</b><br><sub>flat pixel blocks of the render</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/showcase/8bit-studio.png" alt="The 8-bit studio with an AI render" width="100%">
</p>

<sub>The demo person above is AI-generated. They are not a real person.</sub>

**How it works**

1. **New picture** or **Take picture** with the webcam. JPG, PNG, GIF, and WebP open directly. HEIC, TIFF, RAW, PSD, PDF, Word, Pages, and Keynote are converted on the studio server with macOS `sips` and Quick Look. PDFs and documents use the first page.

**Live camera and video**

The camera uses the offline Character filter, because one AI still takes about 7 seconds. An uploaded video has two paths. **Style video** is that filter at 10 frames a second. **Cartoon video** is the AI sprite at 2 frames a second, with one locked seed. Trace and Abstract follow the view buttons on the filter path. The write-up is in three chapters: [status](docs/8BIT_STATUS.md), [steps](docs/8BIT_MOTION.md), and the [frame-buffer outline](docs/AVATAR_STUDIO.md).

1. **Take picture** starts the webcam. The small window is the raw camera. The stage is the 8-bit filter, updated as fast as the filter can run (the source is scaled to 240px on the long edge so the page stays responsive). Move **Block**, **Colors**, **Reach**, **Saturation**, **Outline**, and **Cyan** and the live view follows.
2. **Shutter** stores the full camera frame as the picture. Edit, AI Render, PNG, Save, and Place in project then work the same way they do for an uploaded photo. **Stop** turns the camera off.
3. **New video**, or drop an MP4, WebM, or MOV on the stage. **Style video** reads the clip at 10 frames a second, scales each frame to 480px on the long edge, squares it on the face, and uses 2-pixel blocks. The stage shows each frame as it finishes. **Stop** keeps the frames already made.
4. **Play** loops the styled frames. **WebM** records them to `fraymus-8bit.webm` at the same rate and writes the length into the file, so a player does not open it as 0:00. **Edit this frame** loads that instant of the original video into the still editor.
5. **Cartoon video** is the AI sprite, the same drawing as AI Render: flat colors, hard edges, black background. It samples 2 frames a second and locks the seed so the character does not change clothes between frames. Real outfit keeps the clothes in the video. Avatar uses the studio costume. A style reference, if one is set, is sent with every frame.
6. **Talk** is the mouth buffer. AI Render the sprite, then **Build mouth buffer** draws four frames of that same picture. Each **Line** is words plus a voice. **Up** and **Down** set the order. **Hold** can pin a line to one frame. Play and the talk WebM do not call the model again. The steps are in [8-bit motion](docs/8BIT_MOTION.md).
7. **Production** is the cast. Add a face, **Make avatar**, then give that face a voice. Add another face and the same steps run again. **Keep cast** stores the faces in the open project, so a refresh brings them back. The cast is not stored in the browser. The chapter is [Avatar studio](docs/AVATAR_STUDIO.md).

<p align="center">
  <img src="docs/showcase/8bit-motion.png" alt="8-bit frame from a real smiling video: eyes, nose, mustache, and beard, black background, cyan outline" width="360">
</p>

<sub>Test frame from <a href="https://commons.wikimedia.org/wiki/File:20140529_-_Smiling.webm">20140529 - Smiling.webm</a> by Clément Bucco-Lechat, <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</sub>

The capture controls, as they stand. Style video is the fast filter. Cartoon video is the sprite. Play and WebM read frames that are already stored.

<p align="center">
  <img src="docs/showcase/8bit-capture.png" alt="Capture: New picture, New video, Take picture" width="280">
  <img src="docs/showcase/8bit-video-actions.png" alt="Style video, Cartoon video, Play, WebM, and AI Render" width="280">
</p>

<p align="center">
  <img src="docs/showcase/8bit-talk.png" alt="Talk buffer cell of the AI demo sprite" width="280">
</p>

<sub>Talk cell of the AI demo sprite. Not a real person.</sub>
2. **AI Render** sends the photo to [FLUX.2 Klein](https://huggingface.co/spaces/prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast) on Hugging Face. A render takes about 7 seconds. Pick **Real outfit** or **Avatar** first.
3. **Skin** is matched to the photo automatically. The prompt keeps the person's own skin tone and ethnicity. The studio then compares skin brightness in the photo and the render and corrects the render. The **Skin** slider moves it darker or lighter without another render.
4. **Style reference** adds a second image to copy the look from. **Pixel lock** snaps the render onto a coarser pixel grid.
5. **Edit** works on the render: brush Remove, Keep, and Trace, then Undo, Redo, Expand, Contract, Ceiling, and Sides.
6. **Save** keeps it on the roll. **PNG** downloads it. **Place in project** adds it to the open project as a sprite page.

Without a token the free Hugging Face queue is used, and it can run out of GPU time. For a steady queue, put your token in `hf-token.txt` at the repo root, or set `HF_TOKEN`. `hf-token.txt` is gitignored.

```bash
echo "hf_your_token_here" > hf-token.txt
```

## HTML, React, and Pair

<p align="center">
  <img src="docs/showcase/html.png" alt="A static HTML project with a live preview" width="100%">
</p>

- **Static and React** projects use HTML, CSS, JS, and WASM panes. React runs the JS pane through Babel in the preview.
- **Library** has more than 110 snippets: components, CSS, Tailwind, Shadcn, graphics, 3D, full templates, assets, and MERN starters. Click one to drop it into the active file.
- **Preview** is a sandboxed iframe, the [live server](#live-node-vm-publish-export), or a Node port. Switch between desktop, tablet, and mobile widths in the preview bar.
- **Console** runs code in the preview. Type `fray` to print the seed line. Server logs are on the next tab.
- **⌘K** (Ctrl+K) opens the command palette. **⌘S** exports. **Esc** closes a panel.

**Pair** puts a second file beside the active one. HTML pairs with CSS, CSS with JS, and a MERN page with `server/routes/api.js`.

<p align="center">
  <img src="docs/showcase/pair.png" alt="Pair view: HTML and CSS side by side" width="100%">
</p>

## MERN

A MERN project is a file tree: pages in `client/src/pages/`, `client/src/App.jsx`, styles, and an Express server with routes and an Item model. The screenshot at the top of this page is a MERN app.

| Stack | Preview | Files |
| --- | --- | --- |
| static | HTML, CSS, JS, optional Tailwind CDN, optional WASM | `html`, `css`, `js`, `wasm` |
| react | Same panes, JSX compiled in the preview | same, with React 18 and Babel |
| mern | Pages concatenated, imports stripped, Babel classic runtime, then `createRoot` | `client/src/pages/*`, `server/index.js`, routes, the Item model |

MERN pages ship as Home, Dashboard, Login, and Settings. Login asks for an email only and stores a local demo token. It never asks for a password. Dashboard is behind that token.

Mongo is optional. Set `MONGODB_URI` and the Item model uses Mongoose. Without a URI, records stay in memory.

## CRUD

<p align="center">
  <img src="docs/showcase/crud.png" alt="CRUD workspace after a POST" width="100%">
</p>

The steps are Schema, Create, Read, Update, Delete, and Compile.

| Step | Method | Path |
| --- | --- | --- |
| Read | `GET` collection | `/live/<id>/api/r/<resource>` |
| Read | `GET` one | `/live/<id>/api/r/<resource>/<itemId>` |
| Create | `POST` | `/live/<id>/api/r/<resource>` |
| Update | `PUT` | replaces the record |
| Update | `PATCH` | merges the fields you send |
| Delete | `DELETE` | removes by id |

Resource names match `^[a-z][a-z0-9-]{0,24}$`. Field names match `^[A-Za-z][A-Za-z0-9_]{0,24}$` and cannot be `id`. Values are strings up to 500 characters, numbers, or booleans. A resource holds at most 200 records.

**Package into project** writes the page and the router:

- MERN: `client/src/pages/Records.jsx`, `server/routes/resources.js`, and `app.use("/api/r", ...)` in `server/index.js` if it is missing. The page is mounted at `#/records`.
- Static: the card markup and the API base are appended to the HTML and JS panes.

Restart a running Node process after a compile so it loads the new server files. The in-app live server already serves these routes.

## REPL

<p align="center">
  <img src="docs/showcase/repl.png" alt="REPL with bin methods run on the DOM stage" width="100%">
</p>

The studio layout, with a DOM stage in the middle. Commands, each listed in the help menu (search filters them):

`help` · `clear` · `query` · `queryAll` · `text` · `html` · `style` · `class` · `attr` · `create` · `append` · `remove` · `click` · `focus` · `box` · `tree` · `keys` · `json` · `range` · `sum` · `now` · `typeof`

Examples: `text('#copy', 'Updated')`, `style('#title', 'color', '#3dff9a')`, `keys({a:1,b:2})`.

The bin holds premade methods: fade, accent, insert card, grid, and rename. Drag one onto the strip and press **Run strip**, or click it to run it now. **Design method** saves a method you name. Custom methods stay in this browser under the `localStorage` key `fraymus-repl-methods`. Enter runs the input line. The arrow keys walk the history. Semicolons split one line into several commands.

## Canvas

<p align="center">
  <img src="docs/showcase/canvas.png" alt="Canvas with blocks on a 3x3 cube face" width="100%">
</p>

No code on the canvas. The bin holds text, image, link, note, and stack blocks. Drop them on a cube grid — 2×2, 3×3, or 4×4 — and switch faces (Front, Right, Back, and more layers as the grid grows). Stack mode shows the same face top to bottom.

Each block is an entity. Its components are content, media, link, style (color, align, size), and layout. Select a block to edit them in the inspector.

**Compile** packages the cube:

- MERN: `client/src/pages/Board.jsx` at `#/board`, plus the cube CSS appended to `client/src/styles.css`.
- Static: the markup and CSS are appended to the HTML and CSS panes.

The canvas uses an Obsidian palette: near-black ground, muted purple `#7c6af7` / `#a99bf7`. The rest of the studio stays emerald.

## Live, Node, VM, publish, export

<p align="center">
  <img src="docs/showcase/export.png" alt="Export menu" width="100%">
</p>

| Action | Result |
| --- | --- |
| Live | Serves the preview at `/live/<id>/` from the studio process, with the demo API |
| Node | Starts the project with `NODE_PATH` pointed at the studio `node_modules`, `PORT`, and a memory cap |
| VM | Chooses browser sandbox, live, Node, or Docker. Docker is used only when `docker` is installed |
| Publish | Writes `data/published/<slug>/` and opens `/published/<slug>/` |
| Export | Single-file HTML, project JSON, static zip, full project zip, or a deploy bundle |

The deploy bundle includes `vercel.json`, `netlify.toml`, a Dockerfile, Compose, `nginx.conf`, and `DEPLOY.txt`. Static exports load React and Babel from [unpkg](https://unpkg.com/), so a single HTML file runs away from the studio. MERN still needs Node for the API.

Vendor scripts for the in-app preview are served at `/vendor/` from the studio's React 18 and Babel standalone builds. Preview iframes use absolute URLs so `srcdoc` can load them.

## Start

```bash
npm install
npm run dev
```

- Studio UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Studio API: [http://127.0.0.1:4177](http://127.0.0.1:4177)
- Health: [http://127.0.0.1:4177/api/health](http://127.0.0.1:4177/api/health)
- Dispatch hub: [http://127.0.0.1:8787](http://127.0.0.1:8787) when `scripts/email-watcher/hub.mjs` is running

Both processes bind to `127.0.0.1`. Vite proxies `/api`, `/live`, `/published`, and `/vendor` to the API.

The first screen offers [Blank canvas](#stacks), Portfolio, and [MERN app](#mern). Projects save to disk while the API is running.

If `npm run dev` says `EADDRINUSE` on port 4177, another studio server is already running. Stop it, then run `npm run dev` again.

## Brand

| Mark | Meaning |
| --- | --- |
| ◈ | Studio mark, in the header and on generated MERN pages |
| φ^75 = 4721424167835376.00 | Seed constant. Type `fray` in the preview console to print it |
| One Seed = Reborn | Brand line paired with the seed |
| FRAY `0x46524159` | The four ASCII bytes of FRAY: `0x46 0x52 0x41 0x59` |
| Emerald `#3dff9a` | Studio accent on a near-black ground |
| Cyan `#00e5ff` | 8-bit rim light and trace color |

The header mark opens the brand panel. The footer repeats the copyright, the seed, the line, and the hex, each linked to that panel. Generated MERN apps carry the same footer, linked back to `#/`:

```html
<footer class="ft">
  <a href="#/">◈ Fraymus</a>
  <span>© 2026 Fraymus Web Studio</span>
  <a href="#/">φ^75 = 4721424167835376.00</a>
  <span>One Seed = Reborn</span>
  <span>FRAY 0x46524159</span>
</footer>
```

## Copyright

© 2026 Fraymus Web Studio. All rights reserved.

The mark ◈, the name Fraymus, the seed line φ^75 = 4721424167835376.00 — One Seed = Reborn, and FRAY 0x46524159 are the branding of this studio. Keep them on the studio footer and on pages this studio generates.

## Reference

### Stacks

See the [MERN](#mern) table for how each stack previews.

### Library

Tabs: Components, CSS, Tailwind, Shadcn, Graphics, 3D, Templates, Assets, MERN.

The library is `client/src/library.json`: 110 snippets carried over from the original studio, plus MERN starters for home, dashboard, login, settings, API, model, and server. Search scores the name and the description. Click an item to insert it into the active file, or into the MERN file it belongs to.

### Studio API

Bound to `127.0.0.1:4177` unless `FRAYMUS_PORT` is set.

| Method | Path | Role |
| --- | --- | --- |
| GET | [`/api/health`](http://127.0.0.1:4177/api/health) | Process up, Mongo state |
| GET | [`/api/system`](http://127.0.0.1:4177/api/system) | Node, npm, docker, vendor files |
| GET | `/api/projects` | Saved projects |
| POST | `/api/projects` | Create |
| PUT | `/api/projects/:id` | Save. The editor debounces this |
| DELETE | `/api/projects/:id` | Remove |
| POST | `/api/runtime/sync` | Write the preview and project tree |
| POST | `/api/runtime/start` | Start live, Node, or Docker |
| POST | `/api/runtime/stop` | Stop a runtime |
| GET | `/api/runtime/:id` | Status |
| GET | `/api/runtime/:id/logs` | Log lines |
| POST | `/api/node/install` | `npm install` in the project runtime |
| POST | `/api/node/script` | `npm run <script>` |
| POST | `/api/publish` | Write the published site |
| POST | `/api/export/zip` | Download a zip |
| POST | `/api/pixel/render` | AI 8-bit render. Body: `image`, optional `style`, `mode` (`real` or `avatar`), optional `seed` |
| POST | `/api/pixel/convert` | Any image or document in, PNG out (macOS). File name in `X-File-Name` |
| GET | `/vendor/<file>` | React, ReactDOM, Babel |
| GET | `/published/<slug>/` | A published site |

### Live project API

These routes belong to a running preview, not to the studio's own project store.

| Method | Path |
| --- | --- |
| GET | `/live/:id/` |
| GET | `/live/:id/api/health` |
| GET, POST | `/live/:id/api/items` |
| PUT, DELETE | `/live/:id/api/items/:itemId` |
| POST | `/live/:id/api/auth/login` |
| GET, POST | `/live/:id/api/r/:resource` |
| GET, PUT, PATCH, DELETE | `/live/:id/api/r/:resource/:itemId` |

Sync and start keep the session's records, so a CRUD collection survives a preview refresh.

### Settings

| Variable | Default | Role |
| --- | --- | --- |
| `FRAYMUS_PORT` | `4177` | Studio API port |
| `MONGODB_URI` | unset | Turns on Mongoose for the Item model |
| `HF_TOKEN` | unset | Hugging Face token for AI Render. `hf-token.txt` works too |
| `FRAYMUS_PIXEL_SPACE` | `prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast` | Hugging Face Space used for AI Render |
| `HUB_URL` | `http://127.0.0.1:8787` | Where the email watcher posts a verified payload |
| `HUB_PORT` | `8787` | Port the local hub binds |
| `IMAP_USER` | unset | Gmail account the watcher reads. Set in `~/.fraymus-v13/email-watcher.env` |
| `IMAP_PASS` | unset | Gmail app password for that account. Same file. Never commit it |

### Layout

```
client/                 Vite root, port 5173
  index.html            Title, copyright meta, seed description
  src/App.jsx           Studio shell, footer, brand panel
  src/model.js          Projects, preview, MERN source, brand constants
  src/library.json      Snippet library
  src/scaffold/         Express, pages, and site CSS stamped into new MERN apps
  src/tools/            CrudPage, ReplPage, CanvasPage, PixelPage, Dispatch, Mail, Emoji, WASM
server/index.js         Studio API, live sessions, publish, export, 8-bit render, mail
server/mailbox.js       Local mailbox: folders, eml, mbox
server/gmailBox.js      Gmail over IMAP and SMTP
server/runtime.js       Node and Docker process manager
scripts/email-watcher/  Decoder, Gmail watcher, local hub on port 8787
docs/showcase/          README images
data/projects/          Saved projects (gitignored)
data/runtime/           Running project trees (gitignored)
data/published/         Publish output (gitignored)
```

### Ports and data

| Piece | Where |
| --- | --- |
| UI | `127.0.0.1:5173` |
| API | `127.0.0.1:4177` (`FRAYMUS_PORT`) |
| Dispatch hub | `127.0.0.1:8787` (`HUB_PORT`) |
| Node project | port chosen at start, often `4180`+ |
| Mongo | off until `MONGODB_URI` is set |
| Docker | used when the `docker` binary exists. Compose ports stay on `127.0.0.1` |

`npm run dev` does not use `node --watch`. The API is a plain `node server/index.js` process, and the client is Vite. Restart the API after you edit `server/`.

### WASM demo

The demo module is the bytes whose magic is `00 61 73 6d` and whose `main()` returns 15. Load it from the WASM pane. The preview instantiates it, and the console can call its exports.

### Scripts

| Script | Command |
| --- | --- |
| `dev` | API and Vite together |
| `dev:server` | `node server/index.js` |
| `dev:client` | Vite |
| `start` | API only |
| `build` | Vite build to `client/dist` |

---

<p align="center">
  <a href="#copyright">© 2026 Fraymus Web Studio</a> · <a href="#brand">◈</a> · <a href="#brand">φ^75 = 4721424167835376.00</a> — <a href="#brand">One Seed = Reborn</a> · <a href="#brand">FRAY 0x46524159</a> · <a href="https://github.com/eyeoverthink/fraymus-css">eyeoverthink/fraymus-css</a>
</p>
