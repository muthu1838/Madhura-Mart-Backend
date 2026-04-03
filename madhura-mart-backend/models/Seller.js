import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    // ── Account ───────────────────────────────────────────────────────────────
    ownerName: { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true },
    phone:     { type: String, required: true, trim: true },

    // ── Business ──────────────────────────────────────────────────────────────
    companyName:  { type: String, required: true, trim: true },
    companyType:  {
      type: String,
      // ✅ All values the frontend can send
      enum: ["individual", "partnership", "pvt_ltd", "public_ltd", "llp", "huf", "trust", "other"],
      default: "individual",
    },
    description:     { type: String, default: "" },
    website:         { type: String, default: "" },
    socialLink:      { type: String, default: "" },
    yearEstablished: { type: String, default: "" },
    employeeCount:   { type: String, default: "" },

    // ── Tax & Legal ───────────────────────────────────────────────────────────
    panNumber: { type: String, default: "", uppercase: true, trim: true },
    gstNumber: { type: String, default: "", uppercase: true, trim: true },

    // ── Warehouse Address (stored as address/city/state/pincode in DB) ────────
    address: { type: String, default: "" },
    city:    { type: String, default: "" },
    state:   { type: String, default: "" },
    pincode: { type: String, default: "" },

    // ── Categories ────────────────────────────────────────────────────────────
    businessCategories: { type: [String], default: [] },
    primaryCategory:    { type: String, default: "" },

    // ── Bank Details ──────────────────────────────────────────────────────────
    accountHolder: { type: String, default: "" },
    bankName:      { type: String, default: "" },
    bankAccount:   { type: String, default: "" },
    accountType:   { type: String, enum: ["savings", "current"], default: "savings" },
    ifsc:          { type: String, default: "", uppercase: true },
    upiId:         { type: String, default: "" },

    // ── Uploaded Files ────────────────────────────────────────────────────────
    logo:         { type: String, default: "" },
    certDocument: { type: String, default: "" },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

const Seller = mongoose.model("Seller", sellerSchema);
export default Seller;