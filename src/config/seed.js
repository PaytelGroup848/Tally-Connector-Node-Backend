const User = require('../models/User');

const seedSuperAdmin = async () => {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email) {
    console.warn('SUPER_ADMIN_EMAIL is not set — super admin will not be seeded');
    return;
  }
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, isVerified: true, isSuperAdmin: true });
    console.log(`Seeded super admin user: ${email}`);
    return;
  }
  if (!user.isSuperAdmin) {
    user.isSuperAdmin = true;
    user.isVerified = true;
    await user.save();
  }
};

module.exports = { seedSuperAdmin };
