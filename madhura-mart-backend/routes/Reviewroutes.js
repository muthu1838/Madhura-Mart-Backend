import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Review  from "../models/Review.js";
import Product from "../models/Product.js";

import { storage } from "../config/cloudinaryConfig.js";

const router     = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ── Multer config ── */
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Increased for videos
});

/* ─────────────────────────────────────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────────────────────────────────────── */

/* Parses x-user-info header — works for user, admin, and seller */
const protect = (req, res, next) => {
  const userInfo = req.headers["x-user-info"];
  if (!userInfo) return res.status(401).json({ message: "Not authenticated" });
  try {
    req.user = JSON.parse(userInfo);
    next();
  } catch {
    res.status(401).json({ message: "Invalid auth" });
  }
};

/* Passes only if admin or seller */
const isAdminOrSeller = (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ message: "Not authenticated" });
  const isAdmin  = u.isAdmin === true || u.role === "admin";
  const isSeller = u.role === "seller";
  if (!isAdmin && !isSeller)
    return res.status(403).json({ message: "Admin or Seller access required" });
  next();
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER — resolveReplyAuthor
   Determines who is replying and enforces seller-owns-product check.
   Returns { replyAuthorName, replyAuthorType } or null (response already sent).
───────────────────────────────────────────────────────────────────────────── */
async function resolveReplyAuthor(req, res, reviewId) {
  const u       = req.user;
  const isAdmin  = u.isAdmin === true || u.role === "admin";
  const isSeller = u.role === "seller";

  if (isSeller) {
    const review = await Review.findById(reviewId).lean();
    if (!review) { res.status(404).json({ message: "Review not found" }); return null; }

    const product = await Product.findById(review.product).lean();
    if (!product) { res.status(404).json({ message: "Product not found" }); return null; }

    /* product.seller can be an ObjectId or a populated object */
    const productSellerId = product.seller?._id
      ? String(product.seller._id)
      : String(product.seller);

    if (productSellerId !== String(u._id)) {
      res.status(403).json({ message: "You can only reply to reviews on your own products" });
      return null;
    }

    return {
      replyAuthorName: u.companyName || u.brandName || u.ownerName || u.name || "Seller",
      replyAuthorType: "seller",
    };
  }

  if (isAdmin) {
    return {
      replyAuthorName: u.name || "MadhuraMart",
      replyAuthorType: "admin",
    };
  }

  res.status(403).json({ message: "Admin or Seller access required" });
  return null;
}

/* ─────────────────────────────────
   GET /api/reviews/:productId
───────────────────────────────── */
router.get("/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .sort({ createdAt: -1 })
      .lean();

    const total = reviews.length;
    const avg   = total
      ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
      : 0;
    const dist  = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
      pct:   total
        ? Math.round((reviews.filter(r => r.rating === star).length / total) * 100)
        : 0,
    }));

    res.json({ reviews, stats: { avg: Number(avg), total, dist } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────
   POST /api/reviews/:productId
───────────────────────────────── */
router.post(
  "/:productId",
  protect,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "videos", maxCount: 2 },
  ]),
  async (req, res) => {
    try {
      const { rating, title, comment } = req.body;
      const { productId }              = req.params;
      const user                       = req.user;

      if (!rating || !comment)
        return res.status(400).json({ message: "Rating and comment are required" });

      const existing = await Review.findOne({ product: productId, user: user._id });
      if (existing)
        return res.status(400).json({ message: "You have already reviewed this product" });

      const images = (req.files?.images || []).map(f => f.path);
      const videos = (req.files?.videos || []).map(f => f.path);

      const review = await Review.create({
        product:  productId,
        user:     user._id,
        userName: user.name,
        rating:   Number(rating),
        title,
        comment,
        images,
        videos,
      });

      /* Recalculate product rating */
      const all    = await Review.find({ product: productId });
      const newAvg = all.reduce((s, r) => s + r.rating, 0) / all.length;
      await Product.findByIdAndUpdate(productId, {
        rating:      newAvg.toFixed(1),
        reviewCount: all.length,
      });

      res.status(201).json(review);
    } catch (err) {
      if (err.code === 11000)
        return res.status(400).json({ message: "You have already reviewed this product" });
      res.status(500).json({ message: err.message });
    }
  }
);

/* ─────────────────────────────────
   PUT /api/reviews/:reviewId/helpful
───────────────────────────────── */
router.put("/:reviewId/helpful", protect, async (req, res) => {
  try {
    const { type } = req.body;
    const review   = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const uid      = req.user._id;
    const addField = type === "helpful" ? "helpful" : "notHelpful";
    const remField = type === "helpful" ? "notHelpful" : "helpful";

    const alreadyIn = review[addField].map(String).includes(String(uid));
    if (alreadyIn) {
      review[addField] = review[addField].filter(id => String(id) !== String(uid));
    } else {
      review[addField].push(uid);
      review[remField] = review[remField].filter(id => String(id) !== String(uid));
    }
    await review.save();
    res.json({ helpful: review.helpful.length, notHelpful: review.notHelpful.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────
   DELETE /api/reviews/:reviewId
───────────────────────────────── */
router.delete("/:reviewId", protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (String(review.user) !== String(req.user._id) && !req.user.isAdmin)
      return res.status(403).json({ message: "Not authorised" });

    // Cloudinary files are not deleted here for now

    await review.deleteOne();

    const all    = await Review.find({ product: review.product });
    const newAvg = all.length
      ? (all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1)
      : 0;
    await Product.findByIdAndUpdate(review.product, {
      rating:      newAvg,
      reviewCount: all.length,
    });

    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════════
   REPLY ROUTES
   — Admin  : can reply to any review, edit/delete any reply
   — Seller : can reply only to reviews on their own products,
              can only edit/delete their own reply (not an admin's)
═══════════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────
   POST /api/reviews/:reviewId/reply
───────────────────────────────── */
router.post("/:reviewId/reply", protect, isAdminOrSeller, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.trim())
      return res.status(400).json({ message: "Reply text is required" });

    const author = await resolveReplyAuthor(req, res, req.params.reviewId);
    if (!author) return;

    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.adminReply && review.adminReply.text)
      return res.status(400).json({ message: "A reply already exists. Use PUT to edit it." });

    review.adminReply = {
      text:            reply.trim(),
      replyAuthorName: author.replyAuthorName,
      replyAuthorType: author.replyAuthorType,
      createdAt:       new Date(),
      updatedAt:       new Date(),
    };
    await review.save();

    res.status(201).json({ message: "Reply posted", adminReply: review.adminReply });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────
   PUT /api/reviews/:reviewId/reply
───────────────────────────────── */
router.put("/:reviewId/reply", protect, isAdminOrSeller, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.trim())
      return res.status(400).json({ message: "Reply text is required" });

    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!review.adminReply || !review.adminReply.text)
      return res.status(404).json({ message: "No reply found to edit" });

    const u        = req.user;
    const isSeller = u.role === "seller";

    if (isSeller) {
      /* Sellers cannot edit an admin's reply */
      if (review.adminReply.replyAuthorType === "admin")
        return res.status(403).json({ message: "You cannot edit an admin reply" });
      /* Re-verify product ownership */
      const author = await resolveReplyAuthor(req, res, req.params.reviewId);
      if (!author) return;
    }

    review.adminReply.text      = reply.trim();
    review.adminReply.updatedAt = new Date();
    await review.save();

    res.json({ message: "Reply updated", adminReply: review.adminReply });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────
   DELETE /api/reviews/:reviewId/reply
───────────────────────────────── */
router.delete("/:reviewId/reply", protect, isAdminOrSeller, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!review.adminReply || !review.adminReply.text)
      return res.status(404).json({ message: "No reply found to delete" });

    const u        = req.user;
    const isSeller = u.role === "seller";

    if (isSeller) {
      /* Sellers cannot delete an admin's reply */
      if (review.adminReply.replyAuthorType === "admin")
        return res.status(403).json({ message: "You cannot delete an admin reply" });
      const author = await resolveReplyAuthor(req, res, req.params.reviewId);
      if (!author) return;
    }

    review.adminReply = undefined;
    await review.save();

    res.json({ message: "Reply deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;