// Script to create an admin user
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createAdmin() {
  try {
    const username = 'admin';
    const password = 'admin123456'; // Change this to a secure password
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'admin'
      }
    });
    
    console.log('✅ Admin user created successfully:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Password: ${password} (change this after first login)`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();