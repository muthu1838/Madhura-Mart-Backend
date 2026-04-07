import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import SubCategory from "../models/SubCategory.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { storage } from "../config/cloudinaryConfig.js";

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });


router.get("/", async (req, res) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    const subcategories = await SubCategory.find(filter)
      .populate("category")
      .sort({ createdAt: -1 });
    res.json(subcategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const sub = await SubCategory.findById(req.params.id).populate("category");
    if (!sub) return res.status(404).json({ error: "SubCategory not found" });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !category) return res.status(400).json({ error: "name and category are required" });
    const sub = new SubCategory({
      name,
      category,
      image: req.file ? req.file.path : "",
    });
    await sub.save();
    const populated = await SubCategory.findById(sub._id).populate("category");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const updateData = { name: req.body.name, category: req.body.category };
    if (req.file) updateData.image = req.file.path;
    const sub = await SubCategory.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate("category");
    if (!sub) return res.status(404).json({ error: "SubCategory not found" });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const sub = await SubCategory.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ error: "SubCategory not found" });
    // Cloudinary files are not deleted here for now
    res.json({ message: "SubCategory deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;