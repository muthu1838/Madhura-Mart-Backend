

import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    product: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: true,
    },
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    userName: {
      type:     String,
      required: true,
    },
    rating: {
      type:     Number,
      required: true,
      min:      1,
      max:      5,
    },
    title:   { type: String,  default: "" },
    comment: { type: String,  required: true },
    images:  { type: [String], default: [] },
    videos:  { type: [String], default: [] },

    helpful:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notHelpful: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    adminReply: {
      text:            { type: String, default: null },
      replyAuthorName: { type: String, default: "MadhuraMart" },
      replyAuthorType: {
        type:    String,
        enum:    ["admin", "seller"],
        default: "admin",
      },
      createdAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// One review per user per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.model("Review", ReviewSchema);
export default Review;