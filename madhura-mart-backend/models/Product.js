import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      default: "",
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    additionalImages: {
      type: [String],
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      default: null,
    },
    addedBy: {
      type: String,
      enum: ["admin", "seller"],
      default: "admin",
    },
    stock: {
      type: Number,
      default: 0,
    },
    highlights: {
      type: [String],
      default: [],
    },
    specifications: [
      {
        key: { type: String, default: "" },
        value: { type: String, default: "" },
      },
    ],
    offers: [
      {
        label: { type: String, default: "" },
        text:  { type: String, default: "" },
      },
    ],
    metric: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);
export default Product;