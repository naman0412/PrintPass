const User = require('./models/User');
const Shop = require('./models/Shop');
const { connectDB } = require('./config/db');
require('dotenv').config();

const seed = async (options = { exitOnComplete: true }) => {
  try {
    console.log('[Seed] Checking/Connecting to MongoDB...');
    await connectDB();
    console.log('[Seed] Database connected.');

    // Clear existing demo seed data if needed
    console.log('[Seed] Cleaning existing demo data...');
    await Shop.deleteMany({ code: 'campus-central' });
    await User.deleteMany({
      email: { $in: ['owner@printpass.local', 'operator@printpass.local', 'student@printpass.local'] }
    });

    console.log('[Seed] Creating demo shop: Campus Central Print & Xerox...');
    const demoShop = await Shop.create({
      name: 'Campus Central Print & Xerox',
      code: 'campus-central',
      address: 'Ground Floor, Student Activity Center, Main Campus',
      phone: '+91 98765 43210',
      pricing: {
        bwPerPage: 2,
        colorPerPage: 10,
        duplexDiscount: 0.5,
        spiral: 30,
        staple: 5,
        punch: 2,
        a3Multiplier: 2.0
      },
      settings: {
        slotMinutes: 15,
        slotCapacityPages: 200,
        slotCapacityJobs: 10,
        pagesPerMinute: 25,
        bufferMinutes: 5,
        openTime: '08:00',
        closeTime: '20:00',
        isPaused: false
      },
      agentKey: 'pp_agent_demo_campus_central_2026',
      agentLastSeen: new Date()
    });

    console.log('[Seed] Creating demo users...');
    await User.create({
      name: 'Ramesh Sharma (Owner)',
      email: 'owner@printpass.local',
      password: 'password123',
      role: 'owner',
      shopId: demoShop._id,
      phone: '+91 98765 00001'
    });

    await User.create({
      name: 'Suresh Kumar (Operator)',
      email: 'operator@printpass.local',
      password: 'password123',
      role: 'operator',
      shopId: demoShop._id,
      phone: '+91 98765 00002'
    });

    await User.create({
      name: 'Aarav Patel (Student)',
      email: 'student@printpass.local',
      password: 'password123',
      role: 'student',
      shopId: null,
      phone: '+91 98765 00003'
    });

    console.log('\n=========================================');
    console.log('  PrintPass Database Seeded Successfully!  ');
    console.log('=========================================');
    console.log(`Demo Shop: ${demoShop.name} (Code: ${demoShop.code}, ID: ${demoShop._id})`);
    console.log(`Agent Key: ${demoShop.agentKey}\n`);
    console.log('Demo Accounts:');
    console.log('1. Owner:    owner@printpass.local    / password123');
    console.log('2. Operator: operator@printpass.local / password123');
    console.log('3. Student:  student@printpass.local  / password123');
    console.log('=========================================\n');

    if (options.exitOnComplete) {
      process.exit(0);
    }
    return demoShop;
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
    if (options.exitOnComplete) {
      process.exit(1);
    }
    throw err;
  }
};

if (require.main === module) {
  seed();
}

module.exports = seed;
