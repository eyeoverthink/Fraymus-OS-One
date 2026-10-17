# Fraymus Studio Handbook

How this studio is built, how it should look, the rules it follows, and how to add more apps to it. Read this before you build anything new for Fraymus.

## 1. What Fraymus Web Studio is

A MERN app that runs on your machine:

- **Client:** Vite and React 18 at `127.0.0.1:5173` (`client/`).
- **API:** Express at `127.0.0.1:4177` (`server/index.js`). Vite proxies `/api`, `/live`, `/published`, and `/vendor` to it.
- **Start:** `npm run dev` runs both. Restart it after any edit to `server/`. It does not use `node --watch` (that hit EMFILE).

The studio has one shell (`client/src/App.jsx`) and five workspaces switched from the second bar:

| Tab | id | File | What it does |
| --- | --- | --- | --- |
| Code | `studio` | `App.jsx` | Library, editor, Pair, preview, console |
| CRUD | `crud` | `tools/CrudPage.jsx` | Schema, then POST/GET/PUT/PATCH/DELETE, then compile into the project |
| REPL | `repl` | `tools/ReplPage.jsx` | DOM and JS commands, draggable methods |
| Canvas | `canvas` | `tools/CanvasPage.jsx` | Blocks on a cube grid, compiled to a page |
| 8-bit | `pixel` | `tools/PixelPage.jsx`, `tools/pixelEngine.js`, `tools/pixelMotion.js` | Photo, camera, or video. Status and steps: `docs/8BIT_STATUS.md`, `docs/8BIT_MOTION.md` |
| Production | `production` | `tools/StudioPage.jsx` | A cast of faces. Each face is made into an avatar and given a voice. Keep stores the cast in the project. The next face uses the same steps. |

## 2. Design system

All styles are in `client/src/styles.css`. Use the variables; don't hard-code colors.

| Token | Dark | Use |
| --- | --- | --- |
| `--bg` | `#070807` | Page ground |
| `--panel` / `--panel2` / `--panel3` | `#101210` / `#161916` / `#1c211c` | Bars, sidebars, buttons |
| `--line` / `--line2` | `#262b26` / `#343b34` | Borders |
| `--acc` | `#3dff9a` | Emerald accent: active tabs, primary buttons, the ◈ glow |
| `--acc-dim` | `rgba(61,255,154,.12)` | Background of an "on" button |
| `--pink` | `#ff4d8d` | Danger hover |
| `--blue` | `#7ec8ff` | Secondary info |
| `--text` / `--dim` / `--dim2` | `#e7eee8` / `#8b978e` / `#5d675f` | Text levels |
| `--mono` | JetBrains Mono, SF Mono, Menlo | All UI text, 13px |
| `--serif` | Iowan Old Style, Palatino | Modal headings only |

A light theme overrides the same variables under `:root[data-theme="light"]`.

Accents for specific workspaces:

- **Canvas** uses an Obsidian palette (`.obs`): `#1b1b1b` ground, purple `#7c6af7` / `#a99bf7`.
- **8-bit** uses cyan `#00e5ff` for rim light and traces, on black `#0a0a0b`.

The background is `.phi`, a soft emerald radial glow plus a golden-angle (137.5°) conic pattern.

### Building blocks

| Class | Element |
| --- | --- |
| `.top` | Horizontal bar with an 8px gap |
| `.seg` with buttons, `.on` = active | Segmented switch: workspace tabs, view tabs, mode toggles |
| `.btn`, `.btn.on`, `.btn.danger` | Buttons. `.on` marks the primary action |
| `.icon` | 28px square icon button |
| `.card` (`.card.on`) | Clickable card in a sidebar list: `<b>` title plus `.muted` line |
| `.muted` | 11px dim helper text |
| `.fh` | Small section heading in a sidebar |
| `.field` | `<label>` with an input inside |
| `.codebar` | Title bar on top of the main area: `<b>Name</b> <span class="muted">subtitle</span>`, then actions on the right |
| `.note` | Status line |
| `.modal-back` and `.modal` | Dialogs |
| `.tool`, `.tool-side`, `.tool-main`, `.tool-body` | Workspace layout (next section) |

### Workspace layout

Every workspace has three columns:

```
┌ tool-side (270px) ┐┌──────── tool-main ────────┐┌ tool-side ┐
│ steps / bin /     ││ codebar: title · subtitle ││ inspector │
│ controls          ││ tool-body: the work       ││ / output  │
└───────────────────┘└───────────────────────────┘└───────────┘
```

- **Left side:** the process or the bin (steps as `.card` buttons, or draggable items), then the controls.
- **Main:** the `.codebar` with the title and the actions, then the work surface.
- **Right side:** results, the inspector, or help.
- Below 900px, `.tool` stacks into one column.

### Brand, which must always be present

- Mark ◈. Name "FRAYMUS **WEB STUDIO**" (with "WEB STUDIO" in emerald).
- The footer always shows: `© 2026 Fraymus Web Studio` · `φ^75 = 4721424167835376.00` · `One Seed = Reborn` · `FRAY 0x46524159`. Each one links to the brand panel.
- Generated MERN pages carry the same footer.
- The copyright is "© 2026 Fraymus Web Studio". Never add a person's legal name.

### Writing style for UI copy

Short, plain sentences. Name the action ("Remove background", "Place in project"), not the technology. The helper line under a tab says what it does in a few words ("Photo to 8-bit character").

## 3. How a workspace plugs in

### The contract

```jsx
export default function MyPage({ project, say, onApply }) { ... }
```

- `project` is the open project. Its `stack` is `static`, `react`, or `mern`.
- `say(kind, text)` shows a notice. Kind is `"ok"` or `"err"`.
- `onApply(nextProject)` replaces the project; the studio saves it. Always build `nextProject` with a pure `applyX(project, ...)` function. The function handles both stacks:
  - **static or react:** append to `project.html`, `project.css`, and `project.js`.
  - **mern:** call `ensureMern(project)`, add the page to `pages` (`{ name, path, file, auth }`), write `files["client/src/pages/X.jsx"]`, append to `files["client/src/styles.css"]`, and rebuild `files["client/src/App.jsx"]` with `buildAppSource(pages)`.

  See `applySprite` in `PixelPage.jsx`, `applyCrud` in `CrudPage.jsx`, and `applyCanvas` in `CanvasPage.jsx`.

### Registering a workspace (an addition)

In `client/src/App.jsx`:

1. Import it: `import MyPage from "./tools/MyPage.jsx";`
2. Add `["myid", "Label"]` to the workspace list in the second bar.
3. Add its helper text to the `muted` line next to that list.
4. Render it: `{workspace === "myid" && <MyPage project={project} say={say} onApply={(next) => patch(() => next)} />}`

### A separate page (its own app)

Use the same shell, footer, tokens, and `.tool` layout. Two options:

- **Inside the studio:** a workspace with no project dependency, like `ReplPage`, that renders without `project`.
- **Standalone:** a new Vite entry or route that imports `styles.css` and reuses the header and footer markup from `App.jsx`. Keep the brand footer.

### Server routes

- Put them in `server/index.js` under `/api/<area>/<verb>`, for example `/api/pixel/render`.
- Validate input size and shape. Return `{ error }` with the right status (400, 413, 415, 429, or 502).
- Bind only to `127.0.0.1`.
- Read secrets from env vars or a gitignored file at the repo root (like `hf-token.txt`). Never send them to the client.
- Use `express.raw` for binary uploads and pass the file name in a header (`X-File-Name`).
- Write temp work to `fs.mkdtemp(os.tmpdir())` and always delete it in `finally`.

## 4. The 8-bit pipeline

What the user approved, after filter-only versions were rejected as "horrible":

1. **Input:** `readAnyFile(file)` loads it in the browser first. If the browser can't decode it, it POSTs the file to `/api/pixel/convert`, which uses macOS `sips` (images, PDF) or Quick Look `qlmanage` (Word, Pages, Keynote) to make a PNG. The file picker has no `accept` filter.
2. **AI Render:** `POST /api/pixel/render` sends the photo to the Hugging Face Space `prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast`, endpoint `/edit_image`, through `@gradio/client`. Settings: 1024×1024, 4 steps, guidance 1.0, about 7 seconds. Image 1 is the subject; image 2 is an optional style reference.
   - Modes: `real` keeps the person's clothes, hair, and beard. `avatar` adds a fedora, sunglasses, and a navy jacket with cyan trim.
   - The style prompt asks for an 8-bit bust: chunky pixels, hard black outlines, flat cel shading, a black background, cyan glints.
   - The skin prompt keeps the exact natural skin tone and ethnicity, with no lightening or darkening. An earlier "warm light beige" prompt whitewashed Black subjects; never put a skin color in the prompt.
3. **Skin match** (client, `matchSkin`): compare skin brightness only (luma), in the center of the photo against the render. The gain is clamped to 0.7–1.1, then multiplied by the Skin slider. Per-channel matching turned skin gray, so stay with brightness.
4. **One source:** the AI render becomes `sourceRef`. Character, Trace, Abstract, Edit, Save, and PNG all work from it.
   - Don't re-run the background cut on an AI render; its background is already black, and the cut erased white hoodies.
   - The `boostColor` saturation boost leaves skin tones alone so they don't turn orange.
5. **Token:** read from `HF_TOKEN` or `hf-token.txt`, which is gitignored. Without one, the free queue can run out of GPU time and the route returns 429.

## 5. Rules from the user

- **Look it up and test** before claiming something is done. Compare the output to the user's reference, verify in the browser, and **ask for feedback** before assuming it's right.
- Don't waste credits on attempts likely to fail. Research first: DomoAI, CapCut, Fotor, and PixelMe all turned out to use diffusion img2img, not filters.
- Never commit or push the user's face photo, and don't leave it in `localStorage` (`fraymus.pixel.roll`) or in `client/public/`. Use an AI-generated stand-in person for demos and say so.
- Never print, read out, or commit the Hugging Face token. Scan the diff for `hf_` before every commit.
- Pushing to `main` needs the user's explicit OK each time.
- Don't edit the README unless asked.
- Localhost only. Don't leave the webcam running.
- When a server is restarted, port 4177 can stay taken and `npm run dev` fails with `EADDRINUSE`. Free the port, then tell the user to run `npm run dev` again.

## 6. How to verify UI work

1. Run the app and open `http://127.0.0.1:5173` in the Cursor browser. Lock the tab while you work.
2. Drive it with `Runtime.evaluate`: click buttons by their text, and set file inputs with `DataTransfer` from a file in `client/public/_pixel_test/`. Delete that folder afterwards.
3. For desktop-size screenshots, run `Emulation.setDeviceMetricsOverride` at 1600×960, then `Page.captureScreenshot`, and decode the base64 to a PNG. Clear the override when you're done.
4. Read every screenshot and compare it to the reference before reporting.
5. README images go in `docs/showcase/`. Save SVGs as ASCII, with XML entities such as `&#183;` and `&#966;`, because the editor saved one as Latin-1.

## 7. History of the 8-bit session

| Step | Result |
| --- | --- |
| Offline pixel filter (`renderPixel`: downscale, median cut, outline, cyan) | Rejected: it didn't look like the user's reference |
| Researched PixelMe, Fotor, DomoAI, CapCut, and FLUX Kontext | All are diffusion img2img |
| FLUX.2 Klein on Hugging Face with the reference as image 2 | Approved: "that render is the style I want" |
| Real outfit / Avatar toggle, token file, AI Render button | Shipped in commit `a0db8aa` |
| Edit brought back the original photo | Fixed: Edit works on the AI render |
| Skin too light for Black subjects | Fixed: skin prompt, brightness match, Skin slider |
| Character, Trace, and Abstract used the photo | Fixed: they use the AI render |
| Only some file types opened | Fixed: any image or document, through `/api/pixel/convert` |
| Showcase README with a banner and screenshots | Shipped in commit `a934752` |

## 8. Checklist for a new app

1. Agree on the idea and the reference with the user. Research how real apps do it.
2. Pick the shape: a workspace inside the studio, or its own page.
3. Create `client/src/tools/<Name>Page.jsx` with the three-column `.tool` layout, the `.codebar`, and the same tokens.
4. Write an `apply<Name>(project, ...)` function that handles both static and MERN projects.
5. Add server routes under `/api/<name>/...` if it needs them.
6. Register it in `App.jsx`: the tab, the helper text, and the render line.
7. Verify it in the browser with screenshots, show the user, and ask for feedback.
8. Add a README section with screenshots in `docs/showcase/`, but only if asked.
9. Commit after scanning for secrets and faces. Push only when the user says so.
