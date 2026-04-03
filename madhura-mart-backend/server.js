import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes          from "./routes/authRoutes.js";
import productRoutes       from "./routes/productRoutes.js";
import categoryRoutes      from "./routes/categoryRoutes.js";
import orderRoutes         from "./routes/order.js";
import sellerRoutes        from "./routes/sellerRoutes.js";
import subCategoriesRouter from "./routes/subCategories.js";
import reviewRoutes        from "./routes/Reviewroutes.js";
import adminRoutes         from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ✅ Updated CORS
app.use(cors({
  origin: [
    "https://madhura-mart-frontend-4kuk.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174"
  ],
  credentials: true
}));

app.use(express.json());

app.use("/api/auth",          authRoutes);
app.use("/api/products",      productRoutes);
app.use("/api/categories",    categoryRoutes);
app.use("/api/orders",        orderRoutes);
app.use("/api/sellers",       sellerRoutes);
app.use("/api/subcategories", subCategoriesRouter);
app.use("/api/reviews",       reviewRoutes);
app.use("/api/admin",         adminRoutes);

app.use("/uploads",         express.static(path.join(__dirname, "uploads")));
app.use("/uploads/reviews", express.static(path.join(__dirname, "uploads/reviews")));

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));

app.get("/", (req, res) => {
  res.send("Madhura Mart Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});