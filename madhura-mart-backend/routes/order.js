import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const router = express.Router();

// ── POST /api/orders — Place a new order & reduce stock ───────────────────────
router.post("/", async (req, res) => {
  try {
    console.log("📦 Incoming order payload:", JSON.stringify(req.body, null, 2));

    const {
      customerName, mobile, email, customerEmail,
      address, products, totalAmount, paymentMethod,
    } = req.body;

    if (!customerName || !mobile || !address || !products?.length || !totalAmount) {
      return res.status(400).json({ message: "Missing required order fields." });
    }

    // ── Step 1: Validate stock for every product ──────────────────────────────
    for (const item of products) {
      const pid = item._id || item.productId;
      if (!pid) continue; // skip if no id (shouldn't happen)

      const product = await Product.findById(pid);
      if (!product) {
        return res.status(404).json({
          message: `Product "${item.name || pid}" not found.`,
        });
      }

      const requestedQty = Number(item.qty || item.quantity) || 1;

      if (product.stock !== undefined && product.stock < requestedQty) {
        return res.status(400).json({
          message:
            product.stock === 0
              ? `"${product.name}" is out of stock.`
              : `Only ${product.stock} unit${product.stock !== 1 ? "s" : ""} left for "${product.name}".`,
        });
      }
    }

    // ── Step 2: Deduct stock atomically for each product ──────────────────────
    for (const item of products) {
      const pid = item._id || item.productId;
      if (!pid) continue;

      const requestedQty = Number(item.qty || item.quantity) || 1;

      await Product.findByIdAndUpdate(
        pid,
        { $inc: { stock: -requestedQty } },
        { new: true }
      );

      console.log(`📉 Stock reduced: product ${pid} by ${requestedQty}`);
    }

    // ── Step 3: Save the order ────────────────────────────────────────────────
    const order = new Order({
      customerName:  String(customerName).trim(),
      mobile:        String(mobile).trim(),
      email:         String(email || customerEmail || "").trim(),
      address: {
        street:   String(address.street   || "").trim(),
        locality: String(address.locality || "").trim(),
        city:     String(address.city     || "").trim(),
        state:    String(address.state    || "").trim(),
        pincode:  String(address.pincode  || "").trim(),
        type:     String(address.type     || "home").trim(),
      },
      products: products.map((p) => ({
        productId: String(p._id || p.productId || ""),
        name:      String(p.name  || ""),
        price:     Number(p.price) || 0,
        qty:       Number(p.qty || p.quantity) || 1,
        image:     String(p.image || ""),
      })),
      totalAmount:   Number(totalAmount),
      paymentMethod: paymentMethod || "cod",
      status:        "Pending",
    });

    const saved = await order.save();
    console.log("✅ Order saved:", saved._id);
    res.status(201).json({ message: "Order placed successfully!", order: saved });

  } catch (err) {
    console.error("❌ POST /api/orders error message:", err.message);
    console.error("❌ POST /api/orders full error:", err);
    res.status(500).json({ message: "Server error while placing order.", error: err.message });
  }
});


// ── GET /api/orders — List orders ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { email, status, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (email)                      filter.email  = email;
    if (status && status !== "all") filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error("❌ GET /api/orders error:", err.message);
    res.status(500).json({ message: "Server error while fetching orders." });
  }
});


// ── GET /api/orders/:id — Single order ───────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (err) {
    console.error("❌ GET /api/orders/:id error:", err.message);
    res.status(500).json({ message: "Server error." });
  }
});


// ── PUT /api/orders/:id — Update status / delivery (admin) ───────────────────
router.put("/:id", async (req, res) => {
  try {
    const ALLOWED = ["status", "expectedDelivery", "courier", "trackingId"];
    const updates = {};

    for (const key of ALLOWED) {
      if (req.body[key] === undefined) continue;
      if (key === "expectedDelivery") {
        const val = req.body[key];
        updates.expectedDelivery = val === "" || val === null ? null : new Date(val);
      } else {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update." });
    }

    // ── Fetch current order to compare status ─────────────────────────────────
    const existing = await Order.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: "Order not found." });

    const prevStatus = (existing.status || "").toLowerCase();
    const newStatus  = (updates.status  || "").toLowerCase();

    // ── Stock: restore if admin cancels a non-cancelled order ─────────────────
    if (updates.status && newStatus === "cancelled" && prevStatus !== "cancelled") {
      for (const item of existing.products || []) {
        const pid = item.productId || item._id;
        if (!pid) continue;
        const qty = Number(item.qty || item.quantity) || 1;
        await Product.findByIdAndUpdate(pid, { $inc: { stock: qty } });
        console.log(`📈 Stock restored (admin cancel): product ${pid} +${qty}`);
      }
      updates.cancelledAt = updates.cancelledAt || new Date();
      updates.cancelledBy = "admin";
    }

    // ── Stock: re-deduct if admin un-cancels an order ─────────────────────────
    if (updates.status && prevStatus === "cancelled" && newStatus !== "cancelled") {
      for (const item of existing.products || []) {
        const pid = item.productId || item._id;
        if (!pid) continue;
        const qty = Number(item.qty || item.quantity) || 1;
        await Product.findByIdAndUpdate(pid, { $inc: { stock: -qty } });
        console.log(`📉 Stock re-deducted (un-cancel): product ${pid} -${qty}`);
      }
    }

    // ── Timestamps ────────────────────────────────────────────────────────────
    const TIMESTAMP_MAP = {
      "pending":          "placedAt",
      "processing":       "processingAt",
      "shipped":          "shippedAt",
      "out for delivery": "outForDeliveryAt",
      "delivered":        "deliveredAt",
    };

    if (updates.status && TIMESTAMP_MAP[newStatus]) {
      const field = TIMESTAMP_MAP[newStatus];
      if (!existing[field]) {
        updates[field] = new Date();
      }
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Order not found." });
    res.json({ message: "Order updated.", order: updated });

  } catch (err) {
    console.error("❌ PUT /api/orders/:id error:", err.message);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});


// ── PATCH /api/orders/:id/cancel — Customer cancels order ────────────────────
router.patch("/:id/cancel", async (req, res) => {
  try {
    const { cancelReason } = req.body;

    if (!cancelReason || !cancelReason.trim()) {
      return res.status(400).json({ message: "Cancel reason is required." });
    }

    const order = await Order.findById(req.params.id);
    if (!order)                       return res.status(404).json({ message: "Order not found." });
    if (order.status === "Cancelled") return res.status(400).json({ message: "Order is already cancelled." });
    if (order.status === "Delivered") return res.status(400).json({ message: "Delivered orders cannot be cancelled." });

    // ── Restore stock for each product in the order ───────────────────────────
    for (const item of order.products || []) {
      const pid = item.productId || item._id;
      if (!pid) continue;
      const qty = Number(item.qty || item.quantity) || 1;
      await Product.findByIdAndUpdate(pid, { $inc: { stock: qty } });
      console.log(`📈 Stock restored (customer cancel): product ${pid} +${qty}`);
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:       "Cancelled",
          cancelReason: cancelReason.trim(),
          cancelledAt:  new Date(),
          cancelledBy:  "customer",
        },
      },
      { new: true, runValidators: true }
    ).lean();

    res.json({ message: "Order cancelled successfully.", order: updated });

  } catch (err) {
    console.error("❌ PATCH cancel error:", err.message);
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});


// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Order not found." });
    res.json({ message: "Order deleted." });
  } catch (err) {
    console.error("❌ DELETE error:", err.message);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;