import mongoose from "mongoose";

if (mongoose.models.Order) {
  delete mongoose.connection.models["Order"];
}

const orderSchema = new mongoose.Schema(
  {
    customerName:  { type: String, default: "" },
    mobile:        { type: String, default: "" },
    email:         { type: String, default: "" },

    address: {
      street:   { type: String, default: "" },
      locality: { type: String, default: "" },
      city:     { type: String, default: "" },
      state:    { type: String, default: "" },
      pincode:  { type: String, default: "" },
      type:     { type: String, default: "home" },
    },

    products: { type: mongoose.Schema.Types.Mixed, default: [] },

    totalAmount:   { type: Number, required: true },
    paymentMethod: { type: String, default: "cod" },
    status:        { type: String, default: "Pending" },

    expectedDelivery: { type: Date,   default: null },
    courier:          { type: String, default: ""   },
    trackingId:       { type: String, default: ""   },

    placedAt:         { type: Date, default: null },
    processingAt:     { type: Date, default: null },
    shippedAt:        { type: Date, default: null },
    outForDeliveryAt: { type: Date, default: null },
    deliveredAt:      { type: Date, default: null },

    cancelReason: { type: String, default: "" },
    cancelledAt:  { type: Date,   default: null },
    cancelledBy:  { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);