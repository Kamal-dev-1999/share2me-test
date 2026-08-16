const Razorpay = require("razorpay");
const rzp = new Razorpay({
  key_id: "rzp_test_TQUyHaSqh7jJK8",
  key_secret: "3PuEn8MO5XhPVezN9DBKK20X"
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
