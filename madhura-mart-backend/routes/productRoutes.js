import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Product from "../models/Product.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { storage } from "../config/cloudinaryConfig.js";

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Accept main image + up to 5 additional images
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "additionalImages", maxCount: 5 },
]);

// ── POST — create product ─────────────────────────────────────────────────────
router.post("/", uploadFields, async (req, res) => {
  try {
    const { sku, name, price, description, category, subCategory, stock, seller, addedBy } = req.body;

    const mainImage = req.files?.image?.[0]?.path || "";
    const additionalImages = (req.files?.additionalImages || []).map(f => f.path);

    const product = new Product({
      sku: sku?.trim() || "",
      name,
      price,
      description: description || "",
      category: category || null,
      subCategory: subCategory || null,
      stock: stock !== undefined && stock !== "" ? Number(stock) : 0,
      seller: addedBy === "seller" && seller ? seller : null,
      addedBy: addedBy === "seller" ? "seller" : "admin",
      image: mainImage,
      additionalImages,
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
router.put("/:id", uploadFields, async (req, res) => {
  try {
    const { sku, name, price, description, category, subCategory, stock, seller, addedBy, keepAdditionalImages } = req.body;

    const updateData = {
      name,
      price,
      description: description || "",
      category:    category    || null,
      subCategory: subCategory || null,
    };

    if (sku !== undefined) updateData.sku = sku.trim();
    if (stock !== undefined && stock !== "") updateData.stock = Number(stock);
    if (addedBy)  updateData.addedBy = addedBy;
    if (seller)   updateData.seller  = seller;

    // Main image
    if (req.files?.image?.[0]) updateData.image = req.files.image[0].path;

    // Additional images — append new ones to existing (if keepAdditionalImages sent) or replace
    if (req.files?.additionalImages?.length > 0) {
      const newImgs = req.files.additionalImages.map(f => f.path);
      if (keepAdditionalImages) {
        const existing = JSON.parse(keepAdditionalImages || "[]");
        updateData.additionalImages = [...existing, ...newImgs];
      } else {
        updateData.additionalImages = newImgs;
      }
    } else if (keepAdditionalImages) {
      // No new uploads, but user may have removed some
      updateData.additionalImages = JSON.parse(keepAdditionalImages || "[]");
    }

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