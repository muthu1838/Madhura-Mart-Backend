import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "SECRETKEY123";

const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ message: "No token provided." });
  try {
    const { id } = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    req.user = await User.findById(id);
    if (!req.user) return res.status(401).json({ message: "User not found." });
    next();
  } catch {
    res.status(401).json({ message: "Token invalid or expired." });
  }
};

/* POST /api/auth/register */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ message: "All fields are required." });
    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered." });
    if (await User.findOne({ phone }))
      return res.status(400).json({ message: "Phone already registered." });

    const user = await User.create({
      name, email, phone,
      password: await bcrypt.hash(password, 10),
    });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      phone: user.phone, createdAt: user.createdAt,
      token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" }),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* POST /api/auth/login */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ message: "All fields are required." });

    const user = identifier.includes("@")
      ? await User.findOne({ email: identifier })
      : await User.findOne({ phone: identifier });

    if (!user) return res.status(400).json({ message: "Invalid credentials." });

    // Support both bcrypt and plain-text (auto-upgrades plain-text on login)
    let valid = false;
    if (user.password?.startsWith("$2")) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = password === user.password;
      if (valid) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!valid) return res.status(400).json({ message: "Invalid credentials." });

    res.json({
      _id: user._id, name: user.name, email: user.email,
      phone: user.phone, createdAt: user.createdAt,
      token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" }),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* PUT /api/auth/change-password */
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Both fields are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "Minimum 6 characters." });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    let valid = false;
    if (user.password?.startsWith("$2")) {
      valid = await bcrypt.compare(currentPassword, user.password);
    } else {
      valid = currentPassword === user.password;
    }

    if (!valid)
      return res.status(400).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully." });
  } catch (e) {
    console.error("change-password error:", e);
    res.status(500).json({ message: e.message });
  }
});

export default router;