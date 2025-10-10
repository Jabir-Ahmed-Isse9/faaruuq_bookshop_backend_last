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


// const axios = require("axios");

// async function sendEmail(to, subject, text) {
//   try {
//     await axios.post(
//       "https://api.resend.com/emails",
//       {
//         from: "Faaruuq Bookshop <no-reply@faaruuqbookshop.com>", // ✅ use your verified domain
//         to,
//         subject,
//         text,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     console.log("✅ Email sent via Resend to:", to);
//   } catch (error) {
//     console.error("❌ Email send failed:", error.response?.data || error.message);
//     throw new Error("Failed to send email");
//   }
// }

// module.exports = sendEmail;


const axios = require("axios");

/**
 * Send an email using Resend API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} otp - OTP code or message
 */
async function sendEmail(to, subject, otp) {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <h2 style="color: #333;">Faaruuq Bookshop</h2>
        <p style="font-size: 16px; color: #555;">
          Your OTP code is:
        </p>
        <h1 style="color: #1E90FF;">${otp}</h1>
        <p style="font-size: 14px; color: #999;">
          This code expires in 5 minutes. Do not share it with anyone.
        </p>
      </div>
    `;

    await axios.post(
      "https://api.resend.com/emails",
      {
        from: "Faaruuq Bookshop <no-reply@faaruuqbookshop.com>", // verified domain
        to,
        subject,
        text: `Your OTP code is: ${otp}. It expires in 5 minutes.`,
        html: htmlContent
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Email sent via Resend to: ${to}`);
  } catch (error) {
    console.error("❌ Failed to send email:", error.response?.data || error.message);
    throw new Error("Failed to send email");
  }
}

module.exports = sendEmail;
