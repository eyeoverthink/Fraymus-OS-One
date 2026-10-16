const express = require("express");

const store = {
  items: [
    { id: "1", title: "Welcome record", status: "live" },
    { id: "2", title: "Edit me from the dashboard", status: "draft" }
  ]
};

function bag(name) {
  const key = String(name || "").toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,24}$/.test(key)) {
    const error = new Error("Bad resource name");
    error.status = 400;
    throw error;
  }
  if (!store[key]) store[key] = [];
  return store[key];
}

function clean(body) {
  const row = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,24}$/.test(key) || key === "id") continue;
    if (typeof value === "boolean" || typeof value === "number") row[key] = value;
    else row[key] = String(value ?? "").slice(0, 500);
  }
  return row;
}

const router = express.Router();

router.get("/:resource", (req, res, next) => {
  try { res.json(bag(req.params.resource)); } catch (error) { next(error); }
});

router.get("/:resource/:id", (req, res, next) => {
  try {
    const row = bag(req.params.resource).find((item) => item.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (error) { next(error); }
});

router.post("/:resource", (req, res, next) => {
  try {
    const list = bag(req.params.resource);
    const row = { id: String(Date.now()), ...clean(req.body) };
    list.unshift(row);
    res.status(201).json(row);
  } catch (error) { next(error); }
});

router.put("/:resource/:id", (req, res, next) => {
  try {
    const list = bag(req.params.resource);
    const index = list.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Not found" });
    list[index] = { id: list[index].id, ...clean(req.body) };
    res.json(list[index]);
  } catch (error) { next(error); }
});

router.patch("/:resource/:id", (req, res, next) => {
  try {
    const row = bag(req.params.resource).find((item) => item.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    Object.assign(row, clean(req.body));
    res.json(row);
  } catch (error) { next(error); }
});

router.delete("/:resource/:id", (req, res, next) => {
  try {
    const list = bag(req.params.resource);
    const index = list.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Not found" });
    const [removed] = list.splice(index, 1);
    res.json({ ok: true, removed });
  } catch (error) { next(error); }
});

router.use((error, req, res, next) => {
  res.status(error.status || 500).json({ error: error.message || "CRUD failed" });
});

module.exports = router;
