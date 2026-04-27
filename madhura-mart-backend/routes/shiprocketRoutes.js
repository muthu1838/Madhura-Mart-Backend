import express from "express";

const router = express.Router();

const SHIPROCKET_TOKEN = "J9$KsnG8lTBOT@*QnnfFbJD^EjisI#t*";
const COIMBATORE_PINCODE = "641001"; // Main godown pincode in Coimbatore

/**
 * Parse Shiprocket's ETD format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" or ISO string
 * Returns a proper ISO date string
 */
const parseShiprocketDate = (etd) => {
  if (!etd) return null;
  try {
    // Shiprocket returns "2026-04-29 00:00:00" — replace space with T for ISO compatibility
    const normalized = String(etd).trim().replace(" ", "T");
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (e) {}
  return null;
};

// POST /api/shiprocket/check-serviceability
router.post("/check-serviceability", async (req, res) => {
  const { delivery_postcode, weight = 0.5, cod = 1 } = req.body;

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
      },
      signal: AbortSignal.timeout(8000) // 8-second timeout
    });

    if (!response.ok) {
      console.error("Shiprocket HTTP error:", response.status);
      return res.status(200).json({ success: false, serviceable: false, message: "Shiprocket service unavailable." });
    }

    const data = await response.json();

    if (
      data.status === 200 &&
      data.data?.available_courier_companies?.length > 0
    ) {
      const couriers = data.data.available_courier_companies;

      // ── Pick the FASTEST courier (earliest ETD) ──────────────────────────────
      let bestCourier = couriers[0];
      let bestDate = parseShiprocketDate(couriers[0]?.etd);

      for (const c of couriers) {
        const d = parseShiprocketDate(c.etd);
        if (d && (!bestDate || new Date(d) < new Date(bestDate))) {
          bestDate = d;
          bestCourier = c;
        }
      }

      const deliveryDateISO = bestDate || parseShiprocketDate(bestCourier.etd);

      if (!deliveryDateISO) {
        return res.status(200).json({ success: true, serviceable: false, message: "Could not parse delivery date." });
      }

      console.log(`🚚 Shiprocket EDD for ${delivery_postcode}: ${deliveryDateISO} via ${bestCourier.courier_name}`);

      return res.status(200).json({
        success: true,
        serviceable: true,
        deliveryDate: deliveryDateISO,         // ISO string — safe for MongoDB & JS Date
        courierName: bestCourier.courier_name,
        courierId: bestCourier.courier_company_id
      });
    } else {
      return res.status(200).json({
        success: true,
        serviceable: false,
        message: "Not serviceable for this pincode."
      });
    }
  } catch (error) {
    console.error("Shiprocket API Error:", error.message);
    return res.status(200).json({
      success: false,
      serviceable: false,
      message: "Shiprocket check failed. Using fallback delivery estimate.",
      error: error.message
    });
  }
});

export default router;
