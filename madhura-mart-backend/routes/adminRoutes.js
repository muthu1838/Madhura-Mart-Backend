import express from "express";
import Admin from "../models/Admin.js";

const router = express.Router();

// Seed initial admin if not exists
const seedAdmin = async () => {
  try {
    const count = await Admin.countDocuments();
    if (count === 0) {
      await Admin.create({ username: "admin", password: "password123" });
      console.log("Seeded default admin (admin / password123)");
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
};
seedAdmin();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    if (admin.password !== password) return res.status(401).json({ success: false, message: "Invalid credentials" });
    
    // Login successful
    res.json({ success: true, message: "Login successful", username: admin.username });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/settings", async (req, res) => {
  try {
    const admin = await Admin.findOne();
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    res.json({ success: true, settings: admin.settings || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const admin = await Admin.findOne();
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });
    
    // Merge new settings with existing
    admin.settings = { ...admin.settings, ...req.body };
    
    // Check if password change is also requested
    if (req.body.password) {
      admin.password = req.body.password;
    }
    
    await admin.save();
    res.json({ success: true, message: "Settings updated successfully", settings: admin.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
