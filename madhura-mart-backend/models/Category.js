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
}, {
  timestamps: true
});

export default mongoose.model("Category", categorySchema);