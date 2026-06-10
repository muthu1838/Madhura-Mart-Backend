import mongoose from "mongoose";

const DEFAULT_HOME_CONFIG = {
  bannerSlides: [
    {
      image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1400&q=80",
      tag: "MEGA SALE",
      title: "Smart Living, Smart Saving",
      sub: "Explore premium electronics with up to 70% Off",
      cta: "Shop Gadgets",
      pill: "MEGA SALE"
    },
    {
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80",
      tag: "NEW ARRIVAL",
      title: "Minimalist Style, Timeless Quality",
      sub: "Latest fashion trends delivered to your doorstep",
      cta: "Explore Fashion",
      pill: "FASHION"
    },
    {
      image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1400&q=80",
      tag: "COSMETICS & JEWELRY",
      title: "Exquisite Beauty, Timeless Grace",
      sub: "Elevate your look with our curated luxury collection",
      cta: "Shop Collection",
      pill: "GLAMOUR"
    }
  ],
  sections: {
    deals:    { visible: true, title: "Best Deals Today",   subtitle: "Limited time · Lowest prices guaranteed" },
    categories: { visible: true, count: 5 },
    trending: { visible: true, title: "Trending Now",       subtitle: "Most popular picks this week" },
    featured: { visible: true, title: "Featured Products",  subtitle: "Hand-picked by our team", productIds: [] },
    promobanners: { visible: true }
  },
  sectionOrder: ["deals", "categories", "trending", "featured", "promobanners"],
  promobanners: [],
  heroLayout: "slideshow",
  showCountdownTimer: false,
  countdownEndDate: "",
  countdownLabel: "Sale Ends In"
};

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    settings: {
      siteName:     { type: String, default: "MadhuraMart" },
      contactEmail: { type: String, default: "admin@madhuramart.com" },
      contactPhone: { type: String, default: "+91 00000 00000" },
      address:      { type: String, default: "Chennai, India" },
      taxRate:      { type: Number, default: 18 },
      currency:     { type: String, default: "INR" }
    },
    homeConfig: {
      type:    mongoose.Schema.Types.Mixed,
      default: DEFAULT_HOME_CONFIG
    }
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
