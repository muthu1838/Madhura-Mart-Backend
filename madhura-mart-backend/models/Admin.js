import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    settings: {
      siteName: { type: String, default: "MadhuraMart" },
      contactEmail: { type: String, default: "admin@madhuramart.com" },
      contactPhone: { type: String, default: "+91 00000 00000" },
      address: { type: String, default: "Chennai, India" },
      taxRate: { type: Number, default: 18 },
      currency: { type: String, default: "INR" }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
