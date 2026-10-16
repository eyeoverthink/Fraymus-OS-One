const express = require("express");
const mongoose = require("mongoose");

const memory = [
  { id: "1", title: "Welcome record", status: "live" },
  { id: "2", title: "Edit me from the dashboard", status: "draft" }
];

function mongoOn() {
  return mongoose.connection.readyState === 1;
}

function model() {
  return require("../models/Item");
}

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    runtime: "node",
    mongo: mongoOn() ? "connected" : "memory",
    port: Number(process.env.PORT) || 4180
  });
});

router.get("/items", async (req, res, next) => {
  try {
    if (!mongoOn()) return res.json(memory);
    const rows = await model().find().sort({ createdAt: -1 }).lean();
    res.json(rows.map((row) => ({
      id: String(row._id),
      title: row.title,
      status: row.status || "draft"
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const title = String(req.body?.title || "").trim();
    const status = String(req.body?.status || "draft").trim() || "draft";
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (mongoOn()) {
      const saved = await model().create({ title, status });
      return res.status(201).json({ id: String(saved._id), title: saved.title, status: saved.status });
    }
    const row = { id: String(Date.now()), title, status };
    memory.unshift(row);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

router.put("/items/:id", async (req, res, next) => {
  try {
    const title = req.body?.title != null ? String(req.body.title).trim() : undefined;
    const status = req.body?.status != null ? String(req.body.status).trim() : undefined;
    if (mongoOn()) {
      const saved = await model().findByIdAndUpdate(
        req.params.id,
        { ...(title ? { title } : {}), ...(status ? { status } : {}) },
        { new: true }
      );
      if (!saved) return res.status(404).json({ error: "Not found" });
      return res.json({ id: String(saved._id), title: saved.title, status: saved.status });
    }
    const row = memory.find((item) => item.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (title) row.title = title;
    if (status) row.status = status;
    res.json(row);
  } catch (error) {
    next(error);
  }
});

router.delete("/items/:id", async (req, res, next) => {
  try {
    if (mongoOn()) {
      const saved = await model().findByIdAndDelete(req.params.id);
      if (!saved) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true });
    }
    const index = memory.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Not found" });
    memory.splice(index, 1);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter an email address. This demo does not use a password." });
  }
  res.json({
    ok: true,
    token: "local-demo",
    email,
    note: "Local demo session only. It is stored in this browser and is not an account."
  });
});

router.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Server error" });
});

module.exports = router;
