import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Seller from "../models/Seller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const router     = express.Router();

// ── Multer Storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, `seller_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/i;
    if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPG, PNG, WebP) and PDF files are allowed"));
    }
  },
});

// ✅ All 4 file fields from frontend
const uploadFields = upload.fields([
  { name: "logo",            maxCount: 1 },
  { name: "certDocument",    maxCount: 1 },
  { name: "cancelledCheque", maxCount: 1 },
  { name: "panDocument",     maxCount: 1 },
]);

// ── POST /register ────────────────────────────────────────────────────────────
router.post("/register", uploadFields, async (req, res) => {
  try {
    const {
      ownerName, email, password, phone,
      companyName, companyType, description, website, yearEstablished, employeeCount,
      panNumber, gstNumber,
      warehouseAddress, warehouseCity, warehouseState, warehousePincode,
      businessCategories,
      accountHolder, bankName, bankAccount, ifsc, upiId,
    } = req.body;

    // ── Required field check ─────────────────────────────────────────────────
    if (!ownerName || !email || !password || !phone || !companyName) {
      return res.status(400).json({ message: "Please fill all required fields" });
    }

    // ── Duplicate email check ────────────────────────────────────────────────
    const exists = await Seller.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: "An account with this email already exists" });

    // ── Hash password ────────────────────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 10);

    // ── Parse categories ─────────────────────────────────────────────────────
    let parsedCategories = [];
    try { parsedCategories = JSON.parse(businessCategories || "[]"); } catch (_) {}

    // ── Validate companyType against enum ────────────────────────────────────
    const validTypes = ["individual", "partnership", "pvt_ltd", "llp", "other"];
    const safeCompanyType = validTypes.includes(companyType) ? companyType : "other";

    // ── Create seller ────────────────────────────────────────────────────────
    const seller = await Seller.create({
      ownerName:       ownerName.trim(),
      email:           email.toLowerCase().trim(),
      password:        hashed,
      phone:           phone.trim(),

      companyName:     companyName.trim(),
      companyType:     safeCompanyType,
      description:     description     || "",
      website:         website         || "",
      yearEstablished: yearEstablished || "",
      employeeCount:   employeeCount   || "",

      panNumber:       (panNumber || "").toUpperCase().trim(),
      gstNumber:       (gstNumber || "").toUpperCase().trim(),

      address: warehouseAddress || "",
      city:    warehouseCity    || "",
      state:   warehouseState   || "",
      pincode: warehousePincode || "",

      businessCategories: parsedCategories,
      primaryCategory:    parsedCategories[0] || "",

      accountHolder: accountHolder || "",
      bankName:      bankName      || "",
      bankAccount:   bankAccount   || "",
      ifsc:          (ifsc || "").toUpperCase().trim(),
      upiId:         upiId         || "",

      logo:         req.files?.logo?.[0]?.filename         || "",
      certDocument: req.files?.certDocument?.[0]?.filename || "",

      status: "pending",
    });

    res.status(201).json({
      message: "Application submitted successfully! You will be notified once approved.",
      seller: {
        _id:       seller._id,
        ownerName: seller.ownerName,
        email:     seller.email,
        status:    seller.status,
      },
    });
  } catch (err) {
    console.error("❌ Seller register error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const seller = await Seller.findOne({ email: email.toLowerCase().trim() });
    if (!seller)
      return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, seller.password);
    if (!ok)
      return res.status(401).json({ message: "Invalid email or password" });

    if (seller.status !== "approved") {
      return res.status(403).json({
        message:
          seller.status === "pending"
            ? "Your application is under review. Please wait for admin approval."
            : `Your application was rejected. ${
                seller.rejectionReason
                  ? "Reason: " + seller.rejectionReason
                  : "Please contact support."
              }`,
        status: seller.status,
      });
    }

    const token = jwt.sign(
      { id: seller._id, role: "seller" },
      process.env.JWT_SECRET || "madhuramart_secret_2024",
      { expiresIn: "7d" }
    );

    const sellerData = seller.toObject();
    delete sellerData.password;

    res.json({ token, seller: sellerData });
  } catch (err) {
    console.error("❌ Seller login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET / (all sellers, optionally filter by status) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const sellers = await Seller.find(filter).select("-password").sort({ createdAt: -1 });
    res.json(sellers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select("-password");
    if (!seller) return res.status(404).json({ message: "Seller not found" });
    res.json(seller);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /:id (full profile update by admin — bank fields excluded) ────────────
router.put("/:id", uploadFields, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    const {
      ownerName, email, phone, alternatePhone, dob, gender,
      companyName, companyType, brandName, panNumber, gstNumber,
      description, website, socialLink, yearEstablished,
      warehouseAddress, warehouseCity, warehouseState, warehousePincode, warehouseCountry,
      sameAsWarehouse,
      pickupAddress, pickupCity, pickupState, pickupPincode,
      dispatchTime, returnPolicy, shippingPartner,
    } = req.body;

    // ── Validate companyType ─────────────────────────────────────────────────
    const validTypes = ["individual", "partnership", "pvt_ltd", "public_ltd", "llp", "huf", "trust", "other"];
    const safeCompanyType = validTypes.includes(companyType) ? companyType : seller.companyType;

    // ── Build update object (bank fields intentionally excluded) ─────────────
    const updateData = {
      ownerName:        ownerName        || seller.ownerName,
      email:            email            || seller.email,
      phone:            phone            || seller.phone,
      alternatePhone:   alternatePhone   ?? seller.alternatePhone,
      dob:              dob              || seller.dob,
      gender:           gender           ?? seller.gender,

      companyName:      companyName      || seller.companyName,
      companyType:      safeCompanyType,
      brandName:        brandName        ?? seller.brandName,
      panNumber:        (panNumber       || seller.panNumber  || "").toUpperCase().trim(),
      gstNumber:        (gstNumber       || seller.gstNumber  || "").toUpperCase().trim(),
      description:      description      ?? seller.description,
      website:          website          ?? seller.website,
      socialLink:       socialLink       ?? seller.socialLink,
      yearEstablished:  yearEstablished  ?? seller.yearEstablished,

      warehouseAddress: warehouseAddress ?? seller.warehouseAddress,
      warehouseCity:    warehouseCity    ?? seller.warehouseCity,
      warehouseState:   warehouseState   ?? seller.warehouseState,
      warehousePincode: warehousePincode ?? seller.warehousePincode,
      warehouseCountry: warehouseCountry ?? seller.warehouseCountry,
      sameAsWarehouse:  sameAsWarehouse  ?? seller.sameAsWarehouse,
      pickupAddress:    pickupAddress    ?? seller.pickupAddress,
      pickupCity:       pickupCity       ?? seller.pickupCity,
      pickupState:      pickupState      ?? seller.pickupState,
      pickupPincode:    pickupPincode    ?? seller.pickupPincode,
      dispatchTime:     dispatchTime     ?? seller.dispatchTime,
      returnPolicy:     returnPolicy     ?? seller.returnPolicy,
      shippingPartner:  shippingPartner  ?? seller.shippingPartner,

      // ✅ Also keep legacy address fields in sync for backward compatibility
      address: warehouseAddress ?? seller.address,
      city:    warehouseCity    ?? seller.city,
      state:   warehouseState   ?? seller.state,
      pincode: warehousePincode ?? seller.pincode,
    };

    // ── Handle logo upload ───────────────────────────────────────────────────
    if (req.files?.logo?.[0]?.filename) {
      if (seller.logo) {
        const oldPath = path.join(__dirname, "../uploads", seller.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.logo = req.files.logo[0].filename;
    }

    const updated = await Seller.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select("-password");

    res.json({ seller: updated });
  } catch (err) {
    console.error("❌ Seller update error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /:id/status ───────────────────────────────────────────────────────────
router.put("/:id/status", async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!["approved", "rejected", "pending"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { status, rejectionReason: rejectionReason || "" },
      { new: true }
    ).select("-password");

    if (!seller) return res.status(404).json({ message: "Seller not found" });
    res.json(seller);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    for (const field of ["logo", "certDocument"]) {
      if (seller[field]) {
        const filePath = path.join(__dirname, "../uploads", seller[field]);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    await Seller.findByIdAndDelete(req.params.id);
    res.json({ message: "Seller deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;