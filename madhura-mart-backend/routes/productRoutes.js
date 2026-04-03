import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Product from "../models/Product.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── POST — create product ─────────────────────────────────────────────────────
router.post("/", upload.single("image"), async (req, res) => {
  try {
    // ✅ FIX: destructure sku from req.body
    const { sku, name, price, description, category, subCategory, stock, seller, addedBy } = req.body;

    const product = new Product({
      sku: sku?.trim() || "",          // ✅ FIX: save sku
      name,
      price,
      description: description || "",
      category: category || null,
      subCategory: subCategory || null,
      stock: stock !== undefined && stock !== "" ? Number(stock) : 0,
      seller: addedBy === "seller" && seller ? seller : null,
      addedBy: addedBy === "seller" ? "seller" : "admin",
      image: req.file ? req.file.filename : "",
    });

    await product.save();

    const populated = await Product.findById(product._id)
      .populate("category")
      .populate("subCategory")
      .populate("seller", "-password");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Product POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET all products ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.subCategory) filter.subCategory = req.query.subCategory;
    if (req.query.category)    filter.category    = req.query.category;

    const products = await Product.find(filter)
      .populate("category")
      .populate("subCategory")
      .populate("seller", "-password")
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single product ────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("subCategory")
      .populate("seller", "-password");

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT — update product ──────────────────────────────────────────────────────
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    // ✅ FIX: destructure sku from req.body
    const { sku, name, price, description, category, subCategory, stock, seller, addedBy } = req.body;

    const updateData = {
      name,
      price,
      description: description || "",
      category:    category    || null,
      subCategory: subCategory || null,
    };

    // ✅ FIX: update sku if provided
    if (sku !== undefined) updateData.sku = sku.trim();

    if (stock !== undefined && stock !== "") updateData.stock = Number(stock);
    if (addedBy)  updateData.addedBy = addedBy;
    if (seller)   updateData.seller  = seller;
    if (req.file) updateData.image   = req.file.filename;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate("category")
      .populate("subCategory")
      .populate("seller", "-password");

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Product PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE product ────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;