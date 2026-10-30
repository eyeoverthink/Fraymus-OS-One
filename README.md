<p align="center">
  <img src="docs/showcase/banner.svg" alt="Fraymus Web Studio" width="100%">
</p>

<p align="center">
  <b>Fraymus OS One. A localhost studio for HTML, React, and MERN, plus 8-bit pictures and video, talking seals, cryptographic emoji, an OPEG gateway, and a Brain that can miss, rewrite its own operator table, and keep the rewrite only when the old goals still pass.</b>
</p>

<p align="center">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="Express 4" src="https://img.shields.io/badge/Express-4-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="FrayVM 53 opcodes" src="https://img.shields.io/badge/FrayVM-53%20opcodes-00e5ff?style=flat-square&labelColor=0b1a12">
  <img alt="Think loop" src="https://img.shields.io/badge/Think-miss%20%E2%86%92%20rewrite%20%E2%86%92%20replay-3dff9a?style=flat-square&labelColor=0b1a12">
  <img alt="Localhost only" src="https://img.shields.io/badge/binds-127.0.0.1-00e5ff?style=flat-square&labelColor=0b1a12">
</p>

<p align="center">
  <a href="#start"><b>Start</b></a> ·
  <a href="#what-to-expect"><b>What to expect</b></a> ·
  <a href="#wiring"><b>Wiring</b></a> ·
  <a href="#workspaces"><b>Workspaces</b></a> ·
  <a href="docs/tabs/README.md"><b>Tab manuals</b></a> ·
  <a href="#think"><b>Think</b></a> ·
  <a href="#8-bit"><b>8-bit</b></a> ·
  <a href="#brain"><b>Brain</b></a> ·
  <a href="#methods-added"><b>Methods added</b></a> ·
  <a href="#ship"><b>Ship</b></a> ·
  <a href="docs/APP_OUTLINE.md">Outline</a> ·
  <a href="docs/STUDIO_HANDBOOK.md">Handbook</a> ·
  <a href="https://github.com/eyeoverthink/Fraymus-OS-One">Fraymus OS One</a> ·
  <a href="https://github.com/eyeoverthink/fraymus-css">fraymus-css</a> ·
  <a href="https://github.com/eyeoverthink/fraymus-brain">fraymus-brain</a>
</p>

<p align="center">
  <img src="docs/showcase/code.png" alt="Code workspace: library, editor, and live preview" width="100%">
</p>

Write a page and watch it render. Pair it with a stylesheet. Give it a REST collection. Poke the DOM from a REPL. Turn a photo or a movie into an 8-bit character. Put a talking mouth on the drawn smile. Pack a program into one emoji, sign it, and mail it. Open **Brain** and press **Think**: the goal runs on [FrayVM](client/src/tools/frayvm.js), a separate evaluator checks the number, and a wrong operator is rewritten and replayed against every earlier goal.

This tree is [Fraymus OS One](https://github.com/eyeoverthink/Fraymus-OS-One): the studio, the OPEG gateway, a screenshot of each working tab, and a manual per tab in [docs/tabs](docs/tabs/README.md). The earlier studio remote stays [eyeoverthink/fraymus-css](https://github.com/eyeoverthink/fraymus-css). The φ-scaled weight kernel is [eyeoverthink/fraymus-brain](https://github.com/eyeoverthink/fraymus-brain), a separate repository.

Everything binds to `127.0.0.1`. Projects, mail, and Brain continuity stay on this machine.

## What this release adds

| Area | What changed | Where |
| --- | --- | --- |
| **Think** | One loop: compile, run, miss, rewrite, replay, commit. The operator table and the FlyGNN slice rule are the code that changes. A missing fact stays a fail. A sentence with no check stays unverified. | [`client/src/tools/brainMind.js`](client/src/tools/brainMind.js), the **Think** card on [`BrainPage.jsx`](client/src/tools/BrainPage.jsx) |
| **Continuity** | The learned table is saved with the orbits through `POST /api/brain/memory` and restored on the next visit. | [`server/index.js`](server/index.js), `data/brain/continuity.json` (gitignored) |
| **Epoch score** | A continuum epoch scores its max only when its own `verified` flag is true. | [`runSovereignAgiContinuum`](client/src/tools/flyGnnConnectome.js) |
| **8-bit video** | Choosing an MP4, WebM, or MOV paints the first readable frame and starts **Style video**. A file the browser cannot decode is converted with `avconvert` to H.264 MP4. | [`PixelPage.jsx`](client/src/tools/PixelPage.jsx), `POST /api/pixel/video` |
| **Talking mouth** | The painted mouth locks onto the warm-white teeth, then the centered lip slit. It no longer sits on the nostrils or the jacket. | [`pixelMouth.js`](client/src/tools/pixelMouth.js) |

<p align="center">
  <img src="docs/showcase/brain-think-loop.png" alt="Think on 8 / 2: the table returned 10, the miss was kept, division was rewritten to DIV, five earlier goals were replayed, and the program was stored" width="100%">
</p>

`8 / 2` is the picture above. The stored table still treated division as addition, so FrayVM returned 10. The independent value is 4. One opcode changed to `DIV`. Five earlier goals were replayed. The next goal uses that table.

## What to expect

Press **Think** with a goal the loop can check.

| You type | What happens |
| --- | --- |
| `14 - 9`, `6 * 7`, `8 / 2`, `(14 - 9) * 2` | Compiled to FrayVM with the current operator table. Compared with a separate integer evaluator. A mismatch rewrites only the operators in that expression. Probes with new numbers must agree. Every stored goal is replayed. The meta-compiler may shorten the program if the value still matches. |
| `remember studio = fraymus` then `recall studio` | The fact is written and read back. |
| `recall nowhere` | **FAIL.** A missing fact is not a pass. |
| `bind fire 7` then `bind steam 4` | Written into a live `FlyGNNv10` slice. If the second name overwrites the first, the placement rule changes from `overwrite-zero` to `next-free` and both names must still read back. |
| A normal sentence | **UNVERIFIED.** Nothing is scored as a pass. |
| **New video** on 8-bit | The stage shows a frame, then the pixel loop starts. The status line sits on the stage while it opens, converts, or styles. **Style video** is also on the top bar. |
| **Play** on Production | The talking mouth opens on the drawn smile of a saved portrait. Idle still shows the closed original. |

The other Brain buttons still run their own lobes: quantum kernels, feeling, the 4-proof audit, local Ollama, ternary cortex, the twelve offline skills, FlyGNN, the frequency pulse, and the continuum. Those are fixed suites with live pieces inside them. **Think** is the path that can fail and then change the table it will use next time.

Ollama is optional. **Think** does not call it. **Think & Persist** in the cortex card does, at `127.0.0.1:11434`. If Ollama is down, that button reports the error and the rest of the page still runs.

AI Render needs a Hugging Face token in `hf-token.txt` or `HF_TOKEN`. That file is gitignored. Never commit it.

## Start

```bash
npm install
npm run dev
```

| Surface | Address |
| --- | --- |
| Studio UI (Vite, hot reload) | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| Studio API and built UI | [http://127.0.0.1:4177](http://127.0.0.1:4177) |
| Health | [http://127.0.0.1:4177/api/health](http://127.0.0.1:4177/api/health) |
| Dispatch hub | [http://127.0.0.1:8787](http://127.0.0.1:8787) when [`scripts/email-watcher/hub.mjs`](scripts/email-watcher/hub.mjs) is running |

Vite proxies `/api`, `/live`, `/published`, `/vendor`, `/login`, and `/logout` to the API. Both processes bind to `127.0.0.1`. `npm run dev` does not use `node --watch`. After you edit `server/`, restart the API. If port 4177 is already taken, stop the old server and run `npm run dev` again.

**Login.** The API needs a token. On first start the server writes a random one to `data/studio-token` (mode 600, gitignored) and prints that path, never the token. Open the UI, and the first API call sends you to `/login`; paste the token and the server sets an HttpOnly, SameSite=Strict session cookie for 30 days. Scripts and agents send `Authorization: Bearer <token>` or `X-Studio-Token`. The server also refuses any `Host` header that isn't 127.0.0.1/localhost on 4177 or 5173, and any browser `Origin` other than those, so other local pages and DNS-rebinding sites can't use it. `/api/health`, `/published/`, `/vendor/` and built UI assets stay open. The Fraymus Portal (`portal/`) reads the same token file.

`http://127.0.0.1:4177` serves `client/dist`. Source edits show up there after `npm run build`. The Vite port shows them immediately.

| Script | Command |
| --- | --- |
| `dev` | API and Vite together |
| `dev:server` | `node server/index.js` |
| `dev:client` | Vite |
| `start` | API only. Serves the last build from `client/dist` |
| `build` | Vite build into `client/dist` |

Open **Brain**, press **Think** on `14 - 9`, then on `100 - 37`. The first run may miss and rewrite subtraction. The second should replay the stored goal and pass without another rewrite. Open **8-bit**, press **New video**, and pick an MP4, WebM, or MOV.

### Settings

| Variable | Default | Role |
| --- | --- | --- |
| `FRAYMUS_PORT` | `4177` | Studio API port |
| `STUDIO_TOKEN` | unset | Use this login token instead of the generated one |
| `STUDIO_TOKEN_FILE` | `data/studio-token` | Where the generated token is kept |
| `STUDIO_AUTH` | `on` | `off` turns the login off (not recommended) |
| `STUDIO_ALLOWED_ORIGINS`, `STUDIO_ALLOWED_HOSTS` | unset | Extra browser origins / Host headers to accept, comma-separated |
| `MONGODB_URI` | unset | Turns on Mongoose for the Item model |
| `HF_TOKEN` | unset | Hugging Face token for AI Render. `hf-token.txt` works too and must stay untracked |
| `FRAYMUS_PIXEL_SPACE` | `prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast` | Space used for AI Render |
| `HUB_URL` | `http://127.0.0.1:8787` | Where the email watcher posts a verified payload |
| `HUB_PORT` | `8787` | Local hub port |
| `IMAP_USER`, `IMAP_PASS` | unset | Gmail watcher credentials in `~/.fraymus-v13/email-watcher.env`. Never commit them |

## Wiring

```mermaid
flowchart LR
  subgraph browser ["Browser · Vite 5173 or dist on 4177"]
    Shell["App.jsx shell"]
    Pixel["8-bit PixelPage"]
    Mouth["pixelMouth"]
    Mind["brainMind Think"]
    VM["FrayVM"]
    Fly["FlyGNNv10"]
    Page["BrainPage lobes"]
  end
  subgraph api ["API · 127.0.0.1:4177"]
    Routes["/api/brain/*  /api/pixel/*"]
    Disk["data/brain  data/projects"]
  end
  Ollama["Ollama · 127.0.0.1:11434"]
  Av["avconvert · macOS"]

  Shell --> Pixel
  Shell --> Page
  Page --> Mind
  Mind --> VM
  Mind --> Fly
  Pixel --> Mouth
  Pixel -->|"movie bytes"| Routes
  Mind -->|"opcodes, facts, binds"| Routes
  Page -->|"optional chat"| Ollama
  Routes --> Disk
  Routes --> Av
```

A workspace is `client/src/tools/<Name>Page.jsx` with `{ project, say, onApply }`, registered in [`client/src/App.jsx`](client/src/App.jsx). A change enters the project through a pure `applyX(project, ...)`. Server routes live under `/api/<area>/<verb>` in [`server/index.js`](server/index.js).

**Think** does not edit `BrainPage.jsx`. It edits the mind it will load next time:

1. Parse the goal.
2. Emit FrayVM from the operator table (`+ − * /` → `ADD SUB MUL DIV`).
3. Run it with [`runProgram`](client/src/tools/frayvm.js).
4. Compare with an evaluator that does not use that table.
5. On a miss, search opcode assignments. Keep one only if the goal, fresh numeric probes, and every stored case agree.
6. Fossil the old table. Optionally shorten the program with [`metaCompileFrayVmSource`](client/src/tools/flyGnnConnectome.js) if the value still matches.
7. For `bind`, train a real [`FlyGNNv10`](client/src/tools/flyGnnConnectome.js) slice and read it back. A collision retires `overwrite-zero`.

The seed table maps `-`, `*`, and `/` to `ADD`, so the first real difference, product, or quotient is a miss. That is the point of the first run.

## Workspaces

Sixteen tabs. Each one has a manual with the screenshot from this run. Each one receives the open project.

| Tab | Module | What you get |
| --- | --- | --- |
| [Code](docs/tabs/code.md) | [`App.jsx`](client/src/App.jsx), [`model.js`](client/src/model.js) | Library, Pair editor, live preview, `⌘K` |
| [CRUD](docs/tabs/crud.md) | [`CrudPage.jsx`](client/src/tools/CrudPage.jsx) | Schema through compile, live REST |
| [REPL](docs/tabs/repl.md) | [`ReplPage.jsx`](client/src/tools/ReplPage.jsx) | DOM commands on the preview |
| [Canvas](docs/tabs/canvas.md) | [`CanvasPage.jsx`](client/src/tools/CanvasPage.jsx) | Cube of blocks, purple accent |
| [8-bit](docs/tabs/pixel.md) | [`PixelPage.jsx`](client/src/tools/PixelPage.jsx) | Photo, camera, video, talk |
| [Production](docs/tabs/production.md) | [`StudioPage.jsx`](client/src/tools/StudioPage.jsx) | Cast, voices, mouth on the smile |
| [Seal](docs/tabs/seal.md) | [`SealPage.jsx`](client/src/tools/SealPage.jsx) | One talking emoji |
| [Brain](docs/tabs/brain.md) | [`BrainPage.jsx`](client/src/tools/BrainPage.jsx) | Think, plus the lobes below |
| [OPEG](docs/tabs/opeg.md) | [`OpegPage.jsx`](client/src/tools/OpegPage.jsx) | PT-symmetric goal → `R_san` |
| [HTML·JS](docs/tabs/htmljs.md) | [`WebJsPage.jsx`](client/src/tools/WebJsPage.jsx) | HTML and JS side by side |
| [Emoji](docs/tabs/emoji.md) | [`EmojiPage.jsx`](client/src/tools/EmojiPage.jsx) | Text hidden in one glyph |
| [Emoji Coder](docs/tabs/emoji-coder.md) | [`EmojiCoderPage.jsx`](client/src/tools/EmojiCoderPage.jsx) | Emoji markup to nine targets |
| [Dispatch](docs/tabs/dispatch.md) | [`DispatchPage.jsx`](client/src/tools/DispatchPage.jsx) | Signed, deflated, emoji wire |
| [WASM](docs/tabs/wasm.md) | [`WasmPage.jsx`](client/src/tools/WasmPage.jsx) | 53-opcode machine to `.wasm` |
| [Mail](docs/tabs/mail.md) | [`MailPage.jsx`](client/src/tools/MailPage.jsx) | Local mailbox and Gmail |
| [Screw](docs/tabs/screw.md) | [`LooseScrewPage.jsx`](client/src/tools/LooseScrewPage.jsx) | Broadcast desk |

<p align="center">
  <img src="docs/showcase/8bit-studio.png" alt="8-bit studio" width="32%">
  <img src="docs/showcase/brain-quantum-rsi.png" alt="Brain quantum kernels and orbital memory" width="32%">
  <img src="docs/showcase/dispatch.png" alt="Dispatch" width="32%">
</p>

### Code

<p align="center">
  <img src="docs/showcase/pair.png" alt="Pair editor" width="100%">
</p>

Static, React, or MERN. The library covers components, CSS, graphics, 3D, and MERN starters. Pair edits the document and the stylesheet together. Preview sizes are desktop, tablet, and phone. Type `fray` in the preview console to print the seed.

### CRUD

<p align="center">
  <img src="docs/showcase/crud.png" alt="CRUD builder" width="100%">
</p>

Six steps: Schema, Create, Read, Update, Delete, Compile. The live routes are `/live/:id/api/r/:resource`. Compile writes `client/src/pages/Records.jsx` and `server/routes/resources.js` into a MERN project.

### REPL

<p align="center">
  <img src="docs/showcase/repl.png" alt="REPL" width="100%">
</p>

`query`, `text`, `html`, `style`, `create`, `append`, `click`, `tree`, `json`, and the rest of the built-in strip. Custom methods persist in `localStorage` under `fraymus-repl-methods`.

### Canvas

<p align="center">
  <img src="docs/showcase/canvas.png" alt="Canvas cube" width="100%">
</p>

Blocks on a 2×2, 3×3, or 4×4 cube. Front, Right, Back, Stack. The accent is `#7c6af7`. Compile writes `client/src/pages/Board.jsx`.

### 8-bit

<p align="center">
  <img src="docs/showcase/8bit-character.png" alt="8-bit character" width="32%">
  <img src="docs/showcase/8bit-talk.png" alt="8-bit talk cells" width="32%">
  <img src="docs/showcase/8bit-motion.png" alt="8-bit motion" width="32%">
</p>

Drop a picture, take one, or choose a movie. Character, Trace, and Abstract are the still views. **Style video** is the fast pixel filter at 10 frames a second with 2-pixel blocks. **Cartoon video** asks the render model for 2 frames a second with one locked seed. Talk builds four cells from the sprite. Play and WebM do not call the model.

**New video** paints a frame as soon as the browser can seek one, then starts Style video. The stage line says `Opening…`, `Converting…`, or `Styling frame n of m`. If the browser cannot decode the file, `POST /api/pixel/video` runs `avconvert --preset Preset1280x720` and the page opens the MP4. HEIC and other stills still go through `POST /api/pixel/convert`.

The mouth finder in [`pixelMouth.js`](client/src/tools/pixelMouth.js) looks for the largest flat warm-white tooth component below the eyes, then a wide centered dark lip slit, then a proportion from the eye line to the chin. Sunglasses and jacket cyan are not the eye line. The ellipse hangs from the teeth into the lower lip. Production recomposes the cells from the saved closed sprite, so a refresh uses the new finder without Make avatar. Idle shows the closed smile. Press Play to see the opening.

More: [8-bit status](docs/8BIT_STATUS.md), [8-bit motion](docs/8BIT_MOTION.md), [avatar studio](docs/AVATAR_STUDIO.md).

<p align="center">
  <img src="docs/showcase/8bit-capture.png" alt="Capture" width="24%">
  <img src="docs/showcase/8bit-render.png" alt="AI render" width="24%">
  <img src="docs/showcase/8bit-trace.png" alt="Trace" width="24%">
  <img src="docs/showcase/8bit-abstract.png" alt="Abstract" width="24%">
</p>

### Production

Add a face, render an 8-bit sprite, give it lines and a voice. The cast is stored with the project. `applyCast` writes it. Do not put a face photo in git. `data/projects/` is gitignored for that reason.

### Seal

<p align="center">
  <img src="docs/showcase/seal-agi-v18-living.png" alt="Living seal" width="100%">
</p>

One emoji carries the sprite, four mouth cells, a WAV, the lip timeline, a 4-leaf Merkle tree, and an Ed25519 signature. Wire type `FSEL`. [Seal notes](docs/SOVEREIGN_BRAIN_README.md) sit with the Brain manual.

### Brain

<p align="center">
  <img src="docs/showcase/brain-think-loop.png" alt="Think loop" width="100%">
</p>

The page is one long tool. Left: orbital memory. Center, from the top: **Think**, feeling, the consciousness audit, the Ollama cortex, the co-pilot, the ternary grid, the twelve skills, OMEGA-3, FlyGNN, the frequency bus, and the continuum. Right: the `FBRN` brain spore.

| Lobe | Button | What actually runs |
| --- | --- | --- |
| Think | **Think** | [`think()`](client/src/tools/brainMind.js). See [Think](#think). |
| Memory | Store / Pull, Rule 30 Drift Tick | Golden-angle orbits. Radius 21 is the horizon. Rule 30 drifts unused nodes outward. |
| Evolution | Evolve Next Generation | Four kernels already in the file. `new Function` runs them. Five physics checks at `1e-12` must pass. Fossil rollback restores the previous genome. |
| Feeling | Witness, Appraise, Ground OPEG | Interoception against set-points. Named moods move dials. OPEG is a small WASM bridge. |
| Audit | Run 4-proof audit | A 16-state toy. Theater, feedforward, and split substrates are denied. Feeling is outside what this audit can show. |
| Cortex | Think & Persist | Needle reflex always. Ollama when a model is selected and reachable. A failed token check can replace the reply with the oracle sentence. |
| Co-pilot | Mint seal, Mutate project, Compile WASM | Writes a seal, a page, or a WASM module into the open project when the risk dial allows it. |
| Ternary / NCM | Pulse | 16×16 weights in `{-1, 0, +1}` and a fixed prototype list. |
| Nexus | Recursive Dialectical Turn | Offline skills in [`sovereignEcosystem.js`](client/src/tools/sovereignEcosystem.js): REA audit, vocal recipe, ArtCraft, HyperFrames, Hypit, Hindsight, Needle ladder, telecom id, JED bead, package forge. |
| FlyGNN | Measure → Train | 1,000 neuron objects, thirteen slices of seventy. Train writes a weight and a concept id. Read-back checks that id. |
| Continuum | Run Sovereign AGI Continuum | The seven suite functions, then an epoch score that follows `verified`. |

Deep manuals, each with their own figures:

- [Sovereign Brain, Living Seal, and co-pilot](docs/SOVEREIGN_BRAIN_README.md)
- [Ternary cortex, REA, JED, and the content suite](docs/SOVEREIGN_AGENT_ECOSYSTEM_OUTLINE.md)
- [FlyGNN, AFK ponder, and the frequency bus](docs/FLYGNN_NODULAR_SUPERPOWERS_OUTLINE.md)
- [AGI continuum plan](docs/SOVEREIGN_AGI_CONTINUUM_PLAN.md)
- [V17 manual](docs/SOVEREIGN_AGI_V17_README.md)
- [Adversarial provocation outline](docs/ADVERSARIAL_PROVOCATION_OUTLINE.md)
- [ISA specification](docs/ISA_SPECIFICATION.md)
- [V16 academy reading](docs/V16-INTEGRATION-SPEC.md)

<p align="center">
  <img src="docs/showcase/brain-constructed-feeling.png" alt="Constructed feeling" width="32%">
  <img src="docs/showcase/brain-consciousness-audit.png" alt="Consciousness audit" width="32%">
  <img src="docs/showcase/brain-flygnn-v10-connectome.png" alt="FlyGNN connectome" width="32%">
</p>
<p align="center">
  <img src="docs/showcase/brain-ternary-nexus-agent.png" alt="Ternary nexus" width="32%">
  <img src="docs/showcase/brain-sovereign-agi-continuum.png" alt="AGI continuum" width="32%">
  <img src="docs/showcase/brain-agi-v21-pcc-socratic.png" alt="Proof-carrying WASM and Socratic duel" width="32%">
</p>

### OPEG

A goal that names PT-symmetric, EP3, or Puiseux is posted to `POST /api/opeg/execute`. The gateway loads [`config/system_protocol.yaml`](config/system_protocol.yaml) and [`modelfiles/fraynix_core.yaml`](modelfiles/fraynix_core.yaml), runs the 3×3 Hamiltonian in [`opeg.js`](client/src/tools/opeg.js), and returns `R_san` with the sanitizer `Σ`. The raw pipe keeps metadata. The receipt does not.

Demo task `g = 1`, `γ = 0.5`, `ε = 0.001`: EP3 false, `γ_EP3 = 1.4142135623730951`, roots `0, ±1.3228756555322954`, discriminant `21.4375`, Puiseux branches `0.1000 | −0.0500 ± i0.0866`. A goal outside that family returns HALT and no derivation. Full write-up: [OPEG manual](docs/tabs/opeg.md).

<p align="center">
  <img src="docs/os/opeg.png" alt="OPEG command for the demo Hamiltonian" width="100%">
</p>

### HTML · JS, Emoji, Dispatch, WASM, Mail

<p align="center">
  <img src="docs/showcase/htmljs.png" alt="HTML and JS" width="32%">
  <img src="docs/showcase/emoji.png" alt="Emoji codec" width="32%">
  <img src="docs/showcase/emoji-coder.png" alt="Emoji coder" width="32%">
</p>
<p align="center">
  <img src="docs/showcase/wasm.png" alt="WASM" width="32%">
  <img src="docs/showcase/mail.png" alt="Mail" width="32%">
  <img src="docs/showcase/html.png" alt="HTML preview" width="32%">
</p>

Emoji hides up to 64 KB in variation selectors, DNA letters, or zero-width characters. Emoji Coder compiles shorthand to HTML, JS, React, Java, Pug, Markdown, JSON, WASM, and a one-emoji capsule. Dispatch packs CSS, JS, HTML, and WASM into a deflated `FRAY` wire, signs it, and can hand it to Mail. A subject that starts with `FRAYMUS-DEPLOY-` is the watcher’s cue. WASM assembles the 53-opcode machine, compiles a direct stack or a CFG with loops, and can attach a `fray.pcc.v21` certificate that rejects a bad signature or an infinite loop before `WebAssembly.Instance`. Mail is a local box in `data/mailbox/` plus optional Gmail IMAP/SMTP.

## Ship

<p align="center">
  <img src="docs/showcase/export.png" alt="Export" width="100%">
</p>

| Action | Result |
| --- | --- |
| Live | Preview at `/live/<id>/` with the demo API |
| Node | A local Node process for the project |
| VM | Browser sandbox, live server, Node, or Docker when `docker` exists |
| Publish | `data/published/<slug>/` and `/published/<slug>/` |
| Export | One HTML file, project JSON, a static zip, a full zip, or a deploy bundle |

The deploy bundle includes `vercel.json`, `netlify.toml`, a Dockerfile, Compose, `nginx.conf`, and `DEPLOY.txt`. A single HTML file loads React and Babel from [unpkg](https://unpkg.com/). A MERN API still needs Node.

### Routes this release touches

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/health` | Studio is up |
| GET, POST | `/api/brain/memory` | Orbits, shards, somatic markers, and the Think mind |
| POST | `/api/brain/think` | Optional Ollama chat. Think the card does not use this |
| GET, POST | `/api/brain/afk` | AFK ponder log |
| POST | `/api/brain/nodular-bus` | Frequency-pulse log |
| GET, POST | `/api/brain/daemon` | Instrumentation log |
| GET, POST | `/api/brain/agi-continuum` | Continuum run log |
| GET, POST | `/api/brain/connectome-disk` | `FCON` bytes |
| GET, POST | `/api/brain/swarm-mesh` | Swarm log |
| POST | `/api/pixel/video` | Movie to H.264 MP4 through `avconvert` |
| POST | `/api/pixel/convert` | HEIC and other stills |
| POST | `/api/pixel/render` | AI Render and cartoon frames |
| GET | `/api/opeg/protocol` | Protocol YAML and the Fraynix modelfile |
| POST | `/api/opeg/execute` | PT-symmetric goal in, `R_san` out |

The rest of the studio routes are listed in the [outline](docs/APP_OUTLINE.md).

## Methods added

| Function | File | Contract |
| --- | --- | --- |
| `createMind` | [`brainMind.js`](client/src/tools/brainMind.js) | Seed table: `+` is `ADD`. `-`, `*`, and `/` start as `ADD`. Placement starts as `overwrite-zero`. |
| `normalizeMind` | same | Restores a saved mind. Unknown opcodes are dropped. |
| `think(mind, goal)` | same | Returns `{ mind, verdict, steps, got, expected, source }`. Verdict is `PASS`, `FAIL`, or `UNVERIFIED`. |
| `runSovereignAgiContinuum` | [`flyGnnConnectome.js`](client/src/tools/flyGnnConnectome.js) | Epoch `agiScore` is `maxScore` when `verified` is true, and `0` when it is not. |
| `paintVideoFrame`, `revealVideo`, `onVideoFile` | [`PixelPage.jsx`](client/src/tools/PixelPage.jsx) | Paint a frame, fall through to conversion on a timeout or a decode error, then call `styleClip`. |
| `findMouth` and the tooth / slit helpers | [`pixelMouth.js`](client/src/tools/pixelMouth.js) | Place the opening on the teeth. `inspectTalk` still has to accept the cells. |
| `POST /api/pixel/video` | [`server/index.js`](server/index.js) | Darwin only. 180 second `avconvert` budget. Returns `video/mp4`. |
| `POST /api/brain/memory` | same | Persists `mind` beside the orbits. A save that omits `mind` keeps the one already on disk. |
| `runOpeg` | [`opeg.js`](client/src/tools/opeg.js) | PT-symmetric 3×3 only. Returns `R_san` or HALT. Sanitizer drops metadata and the session id. |
| `POST /api/opeg/execute` | [`server/index.js`](server/index.js) | Refuses to run when the protocol file is missing the inference ban. |

Older exports stay where the [Brain manual](docs/SOVEREIGN_BRAIN_README.md) and the [ISA spec](docs/ISA_SPECIFICATION.md) list them: `evaluateInArena`, `FlyGNNv10`, `assemble`, `runProgram`, `compileToWasm`, `compileWithPccCertificate`, `composeTalkCells`, `styleImage`.

## Layout

```
client/                 Vite root
  src/App.jsx           Shell, tabs, footer
  src/model.js          Projects, preview, MERN source
  src/tools/brainMind.js    Think loop
  src/tools/BrainPage.jsx   Brain workspace
  src/tools/PixelPage.jsx   8-bit, including video
  src/tools/pixelMouth.js   Mouth placement
  src/tools/frayvm.js       53-opcode machine
  src/tools/flyGnnConnectome.js
  src/tools/opeg.js         OPEG Hamiltonian and sanitizer
  src/tools/OpegPage.jsx    OPEG workspace
config/system_protocol.yaml
modelfiles/fraynix_core.yaml
server/index.js         API, live sessions, pixel convert, brain routes, OPEG
server/opeg.test.mjs
docs/showcase/          Earlier pictures in this README
docs/os/                Screenshots from the OS One run
docs/tabs/              One manual per tab
docs/                   Manuals linked above
data/brain/             Continuity. Gitignored
data/projects/          Projects. Gitignored. Do not commit face photos
```

| Piece | Where |
| --- | --- |
| UI with hot reload | `127.0.0.1:5173` |
| API and built UI | `127.0.0.1:4177` |
| Dispatch hub | `127.0.0.1:8787` |
| Node project | port chosen at start, often `4180` and up |
| Mongo | off until `MONGODB_URI` is set |

## Brand

| Mark | Meaning |
| --- | --- |
| ◈ | Studio mark |
| φ^75 = 4721424167835376.00 | Seed. Type `fray` in the preview console |
| One Seed = Reborn | Line paired with the seed |
| FRAY `0x46524159` | The four ASCII bytes of FRAY |
| Emerald `#3dff9a` | Studio accent |
| Cyan `#00e5ff` | 8-bit rim |

© 2026 Fraymus Web Studio. The mark, the name, the seed line, and FRAY 0x46524159 stay on the studio footer and on pages this studio generates.

<p align="center">
  <a href="#brand">© 2026 Fraymus Web Studio</a> ·
  <a href="#brand">φ^75 = 4721424167835376.00</a> ·
  <a href="#brand">One Seed = Reborn</a> ·
  <a href="#brand">FRAY 0x46524159</a> ·
  <a href="https://github.com/eyeoverthink/Fraymus-OS-One">eyeoverthink/Fraymus-OS-One</a> ·
  <a href="https://github.com/eyeoverthink/fraymus-css">eyeoverthink/fraymus-css</a>
</p>
