const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    status: { type: String, default: "draft", trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Item || mongoose.model("Item", schema);
