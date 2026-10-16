const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
  }
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.end();
  next();
});

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  try {
    await mongoose.connect(uri);
    console.log("mongo connected");
  } catch (error) {
    console.warn("mongo unavailable, API will use memory:", error.message);
  }
}

app.use("/api", require("./routes/api"));
app.use("/api/r", require("./routes/resources"));
app.use("/.vendor", express.static(path.join(root, ".vendor")));
app.get("*", (req, res) => {
  const preview = path.join(root, "preview.html");
  res.setHeader("Cache-Control", "no-store");
  if (fs.existsSync(preview)) return res.sendFile(preview);
  res.status(404).type("text").send("preview.html is not written yet. Sync from Fraymus, then reload.");
});

const port = Number(process.env.PORT) || 4180;
connectMongo().then(() => {
  app.listen(port, "127.0.0.1", () => {
    console.log("fraymus node app on http://127.0.0.1:" + port);
  });
});
