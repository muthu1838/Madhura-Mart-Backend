import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import SubCategory from "../models/SubCategory.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "subcat-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});


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
      image: req.file ? req.file.filename : "",
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
    if (req.file) updateData.image = req.file.filename;
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
    if (sub.image) {
      const imgPath = path.join(__dirname, "../uploads", sub.image);
      fs.unlink(imgPath, (err) => { if (err) console.log("Error deleting image:", err); });
    }
    res.json({ message: "SubCategory deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;