# Fraymus Web Studio

**◈ FRAYMUS WEB STUDIO**

[© 2026 Fraymus Web Studio](#copyright) · [φ^75 = 4721424167835376.00](#brand) · [One Seed = Reborn](#brand) · [FRAY 0x46524159](#brand)

A browser studio for static pages, React, and MERN. Edit in panes, pair two files, run a live server, start Node, publish, and export. CRUD, a DOM REPL, and an Obsidian-style canvas sit beside the editor.

## Contents

- [Brand](#brand)
- [Copyright](#copyright)
- [Start](#start)
- [Workspaces](#workspaces)
- [Code and Pair](#code-and-pair)
- [CRUD](#crud)
- [REPL](#repl)
- [Canvas](#canvas)
- [Stacks](#stacks)
- [Live, Node, VM, publish, export](#live-node-vm-publish-export)
- [Library](#library)
- [Studio API](#studio-api)
- [Live project API](#live-project-api)
- [Layout](#layout)
- [Ports and data](#ports-and-data)
- [WASM demo](#wasm-demo)
- [Scripts](#scripts)

## Brand

| Mark | Meaning |
| --- | --- |
| ◈ | Studio mark, in the header and on generated MERN pages |
| φ^75 = 4721424167835376.00 | Seed constant. Type `fray` in the preview console to print it |
| One Seed = Reborn | Brand line paired with the seed |
| FRAY `0x46524159` | The four ASCII bytes of FRAY: `0x46 0x52 0x41 0x59` |
| Emerald `#3dff9a` | Studio accent on a near-black ground |

The header mark opens the brand panel. The footer repeats the copyright, the seed, the line, and the hex, each as a link into that panel. Generated MERN apps carry the same line in their page footer, linked back to `#/`.

## Copyright

© 2026 Fraymus Web Studio. All rights reserved.

The mark ◈, the name Fraymus, the seed line φ^75 = 4721424167835376.00 — One Seed = Reborn, and FRAY 0x46524159 are the branding of this studio. Keep them on the studio footer and on pages this studio generates.

## Start

```bash
npm install
npm run dev
```

- Studio UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Studio API: [http://127.0.0.1:4177](http://127.0.0.1:4177)
- Health: [http://127.0.0.1:4177/api/health](http://127.0.0.1:4177/api/health)

Both processes bind to `127.0.0.1`. Vite proxies `/api`, `/live`, `/published`, and `/vendor` to the API.

The first screen offers [Blank canvas](#stacks), [Portfolio](#library), and [MERN app](#stacks). Projects save to disk while the API is running.

## Workspaces

The second bar switches the surface. The footer stays put.

| Workspace | What it is |
| --- | --- |
| [Code](#code-and-pair) | Library, editor, pair, preview, console |
| [CRUD](#crud) | Schema through compile, all five HTTP methods |
| [REPL](#repl) | JavaScript and DOM, help, draggable methods |
| [Canvas](#canvas) | Blocks on a cube grid, compiled into the project |

## Code and Pair

Code is the editor.

- **Static and React** use HTML, CSS, and JS panes. React can run the JS pane through Babel in the preview.
- **MERN** uses a file tree: pages, `client/src/App.jsx`, styles, and the Express server.
- **Pair** opens a second file beside the active one. HTML pairs with CSS, CSS with JS, and a page pairs with `server/routes/api.js`.
- **Preview** is a sandbox iframe, the [live server](#live-node-vm-publish-export), or a Node port. Desktop, tablet, and mobile widths are in the preview bar.
- **Console** evals in the preview. `fray` prints the seed line. Server logs sit on the next tab.
- **⌘K** (Ctrl+K) opens the command palette. **⌘S** exports. **Esc** closes a panel.

## CRUD

The process is schema, create, read, update, delete, compile.

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

- MERN: `client/src/pages/Records.jsx`, `server/routes/resources.js`, and `app.use("/api/r", ...)` in `server/index.js` when it is missing. The page is mounted at `#/records`.
- Static: the card markup and the API base are appended to the HTML and JS panes.

Restart a running Node process after a compile so it loads the new server files. The in-app live server already serves these routes.

## REPL

Same studio chrome, with a DOM stage in the middle.

Commands, each listed in the help menu (search filters them):

`help` · `clear` · `query` · `queryAll` · `text` · `html` · `style` · `class` · `attr` · `create` · `append` · `remove` · `click` · `focus` · `box` · `tree` · `keys` · `json` · `range` · `sum` · `now` · `typeof`

Examples from the menu: `text('#copy', 'Updated')`, `style('#title', 'color', '#3dff9a')`, `keys({a:1,b:2})`.

The bin holds premade methods: fade, accent, insert card, grid, rename. Drag one onto the strip and press **Run strip**, or click it to run it now. **Design method** saves a method you name. Custom methods stay in this browser under `localStorage` key `fraymus-repl-methods`. Enter runs the input line. Arrow keys walk history. Semicolons split one line into several commands.

## Canvas

No code on the canvas itself. The bin holds text, image, link, note, and stack blocks. Drop them on a cube grid — 2×2, 3×3, or 4×4 — and switch faces (Front, Right, Back, and further layers as the grid grows). Stack mode is the same face, top to bottom.

Each block is an entity. Its components are content, media, link, style (color, align, size), and layout. Select a block to edit those in the inspector.

**Compile** packages the cube:

- MERN: `client/src/pages/Board.jsx` at `#/board`, plus the cube CSS appended to `client/src/styles.css`.
- Static: the markup and CSS are appended to the HTML and CSS panes.

The canvas uses an Obsidian palette: near-black ground, muted purple `#7c6af7` / `#a99bf7`. The rest of the studio stays emerald.

## Stacks

| Stack | Preview | Files |
| --- | --- | --- |
| static | HTML, CSS, JS, optional Tailwind CDN, optional WASM | `html`, `css`, `js`, `wasm` |
| react | Same panes, JSX compiled in the preview | same, with React 18 and Babel |
| mern | Pages concatenated, imports stripped, Babel classic runtime, then `createRoot` | `client/src/pages/*`, `server/index.js`, routes, the Item model |

MERN pages ship as Home, Dashboard, Login, and Settings. Login asks for an email only and stores a local demo token. It does not collect a password. Dashboard is behind that token.

Mongo is optional. Set `MONGODB_URI` and the Item model uses Mongoose. With no URI, records stay in memory.

New MERN apps include this footer:

```html
<footer class="ft">
  <a href="#/">◈ Fraymus</a>
  <span>© 2026 Fraymus Web Studio</span>
  <a href="#/">φ^75 = 4721424167835376.00</a>
  <span>One Seed = Reborn</span>
  <span>FRAY 0x46524159</span>
</footer>
```

## Live, Node, VM, publish, export

| Action | Result |
| --- | --- |
| Live | Serves the preview at `/live/<id>/` from the studio process, with the demo API |
| Node | Spawns the project with `NODE_PATH` pointed at the studio `node_modules`, `PORT`, and a memory cap |
| VM | Chooses browser sandbox, live, Node, or Docker. Docker is used only when `docker` is on the machine |
| Publish | Writes `data/published/<slug>/` and opens `/published/<slug>/` |
| Export | Single-file HTML, project JSON, static zip, full project zip, or a deploy bundle |

The deploy bundle includes `vercel.json`, `netlify.toml`, a Dockerfile, Compose, `nginx.conf`, and `DEPLOY.txt`. Static exports load React and Babel from [unpkg](https://unpkg.com/) so a single HTML file can run away from the studio. MERN still needs Node for the API.

Vendor scripts for the in-app preview are served at `/vendor/` from the studio's React 18 and Babel standalone builds. Preview iframes use absolute URLs so `srcdoc` can load them.

## Library

Tabs: Components, CSS, Tailwind, Shadcn, Graphics, 3D, Templates, Assets, MERN.

The library is `client/src/library.json`, carried over from the original studio (110 snippets) plus MERN starters: home, dashboard, login, settings, API, model, and server. Search scores the name and the description. Click an item to insert it into the active file, or into the MERN file it belongs to.

## Studio API

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
| GET | `/vendor/<file>` | React, ReactDOM, Babel |
| GET | `/published/<slug>/` | A published site |

## Live project API

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

## Layout

```
client/                 Vite root, port 5173
  index.html            Title, copyright meta, seed description
  src/App.jsx           Studio shell, footer, brand panel
  src/model.js          Projects, preview, MERN source, brand constants
  src/library.json      Snippet library
  src/scaffold/         Express, pages, and site CSS stamped into new MERN apps
  src/tools/            CrudPage, ReplPage, CanvasPage
server/index.js         Studio API, live sessions, publish, export
server/runtime.js       Node and Docker process manager
data/projects/          Saved projects (gitignored)
data/runtime/           Running project trees (gitignored)
data/published/         Publish output (gitignored)
```

## Ports and data

| Piece | Where |
| --- | --- |
| UI | `127.0.0.1:5173` |
| API | `127.0.0.1:4177` (`FRAYMUS_PORT`) |
| Node project | port chosen at start, often `4180`+ |
| Mongo | off until `MONGODB_URI` is set |
| Docker | used when the `docker` binary exists. Compose ports stay on `127.0.0.1` |

`npm run dev` does not use `node --watch`. The API is a plain `node server/index.js` process, and the client is Vite. Restart the API after you edit `server/`.

## WASM demo

The demo module is the bytes whose magic is `00 61 73 6d` and whose `main()` returns 15. Load it from the WASM pane. The preview instantiates it and the console can call exports.

## Scripts

| Script | Command |
| --- | --- |
| `dev` | API and Vite together |
| `dev:server` | `node server/index.js` |
| `dev:client` | Vite |
| `start` | API only |
| `build` | Vite build to `client/dist` |

---

[© 2026 Fraymus Web Studio](#copyright) · [◈](#brand) · [φ^75 = 4721424167835376.00](#brand) — [One Seed = Reborn](#brand) · [FRAY 0x46524159](#brand)
