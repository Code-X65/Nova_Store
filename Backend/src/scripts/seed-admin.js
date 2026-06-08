const AdminModel = require('../models/admin.model');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  try {
    console.log('Seeding admin account...');

    const admin = await AdminModel.findByEmail('admin@novastore.com');

    if (admin) {
      console.log(`Admin already exists: ${admin.email}`);
      return;
    }

    const password = 'Admin.';
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await AdminModel.create({
      email: 'admin@novastore.com',
      password_hash: passwordHash,
    });

    console.log(`Admin seeded successfully with ID: ${created.id}`);
    console.log(`Email: ${created.email}`);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();
