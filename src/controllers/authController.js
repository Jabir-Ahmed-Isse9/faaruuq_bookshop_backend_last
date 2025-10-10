const bcrypt = require('bcrypt');
const { signUser } = require('../utils/jwt');
const User = require('../models/User');
const OTP = require('../models/OTP');
const sendEmail = require('../utils/sendEmail');

/**
 * Send OTP to register a new user
 */
exports.sendOTP = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const hashedPassword = await bcrypt.hash(password, 10);

    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        code: otpCode.toString(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        name,
        password: hashedPassword,
        role: role || 'user',
        forPasswordReset: false
      },
      { upsert: true, new: true }
    );

    // ✅ Send OTP using HTML email
    try {
      await sendEmail(email, 'Your OTP Code', otpCode);
      console.log(`OTP sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError.message);
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
    }

    return res.status(200).json({ message: 'OTP sent to your email' });

  } catch (err) {
    console.error('sendOTP error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


/**
 * Verify OTP and create user
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const record = await OTP.findOne({ email, code: otp.toString(), forPasswordReset: false });
    if (!record) return res.status(400).json({ error: 'Invalid OTP' });

    if (record.expiresAt < Date.now()) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'OTP expired' });
    }

    const user = new User({
      name: record.name,
      email: record.email,
      password: record.password,
      role: record.role
    });

    await user.save();
    await OTP.deleteOne({ _id: record._id });

    const token = signUser(user);
    return res.status(201).json({
      message: 'User registered and logged in',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });

  } catch (err) {
    console.error('verifyOTP error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email }).select('+password');
    if (!existingUser) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, existingUser.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    existingUser.lastLoginAt = Date.now();
    await existingUser.save();

    const token = signUser(existingUser);
    return res.status(200).json({
      message: 'Login successful',
      user: { id: existingUser._id, name: existingUser.name, email: existingUser.email, role: existingUser.role },
      token
    });

  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Request password reset OTP
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'No account found with this email' });

    const otpCode = Math.floor(100000 + Math.random() * 900000);

    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        code: otpCode.toString(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        forPasswordReset: true
      },
      { upsert: true, new: true }
    );

    try {
      await sendEmail(email, 'Password Reset OTP', `Your password reset OTP is ${otpCode}. It expires in 5 minutes.`);
      console.log(`Password reset OTP sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError.message);
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
    }

    return res.status(200).json({ message: 'OTP sent for password reset' });

  } catch (err) {
    console.error('requestPasswordReset error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reset password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const record = await OTP.findOne({ email, code: otp.toString(), forPasswordReset: true });
    if (!record || record.expiresAt < Date.now()) {
      if (record) await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });
    await OTP.deleteOne({ _id: record._id });

    return res.status(200).json({ message: 'Password updated successfully. You can now log in.' });

  } catch (err) {
    console.error('resetPassword error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
};
