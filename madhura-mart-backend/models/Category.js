import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: null,
  },
  deal: {
    type: String,
    default: "",
  },
}, {
  timestamps: true
});

export default mongoose.model("Category", categorySchema);