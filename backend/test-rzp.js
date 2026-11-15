const Razorpay = require("razorpay");
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || ""
});

async function run() {
  try {
    const qrCode = await rzp.qrCode.create({
      type: "upi_qr",
      name: "Test Vendor",
      usage: "multiple_use",
      fixed_amount: false,
      description: "Share2Me Print Shop - test",
    });
    console.log("Success:", JSON.stringify(qrCode, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
