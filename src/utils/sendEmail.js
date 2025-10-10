// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_EMAIL,
//     pass: process.env.SMTP_PASSWORD,
//   },
// });

// async function sendEmail(to, subject, text) {
//   return transporter.sendMail({
//     from: `"Faaruuq Bookshop" <${process.env.SMTP_EMAIL}>`,
//     to,
//     subject,
//     text,
//   });
// }

// module.exports = sendEmail;


const axios = require("axios");

async function sendEmail(to, subject, text) {
  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: "Faaruuq Bookshop <onboarding@resend.dev>",
        to,
        subject,
        text,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Email sent via Resend to:", to);
  } catch (error) {
    console.error("❌ Email send failed:", error.response?.data || error.message);
    throw new Error("Failed to send email");
  }
}

module.exports = sendEmail;
