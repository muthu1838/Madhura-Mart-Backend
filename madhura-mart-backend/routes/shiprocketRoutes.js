import express from "express";

const router = express.Router();

const SHIPROCKET_TOKEN = "J9$KsnG8lTBOT@*QnnfFbJD^EjisI#t*";
const COIMBATORE_PINCODE = "641001"; // Main godown pincode in Coimbatore

// Check serviceability and get delivery date
router.post("/check-serviceability", async (req, res) => {
  const { delivery_postcode, weight = 1, cod = 1 } = req.body;

  if (!delivery_postcode) {
    return res.status(400).json({ success: false, message: "Delivery pincode is required" });
  }

  try {
    const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${COIMBATORE_PINCODE}&delivery_postcode=${delivery_postcode}&weight=${weight}&cod=${cod}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SHIPROCKET_TOKEN}`
      }
    });

    const data = await response.json();

    if (data.status === 200 && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length > 0) {
      // Get the fastest courier or just the first one
      const courier = data.data.available_courier_companies[0];
      const estimatedDeliveryDate = courier.etd; // Estimated time of delivery (YYYY-MM-DD HH:MM:SS)

      return res.status(200).json({
        success: true,
        deliveryDate: estimatedDeliveryDate,
        courierName: courier.courier_name,
        serviceable: true
      });
    } else {
      return res.status(200).json({
        success: true,
        serviceable: false,
        message: "Not serviceable for this pincode."
      });
    }
  } catch (error) {
    console.error("Shiprocket API Error:", error);
    return res.status(500).json({ success: false, message: "Error checking serviceability", error: error.message });
  }
});

export default router;
