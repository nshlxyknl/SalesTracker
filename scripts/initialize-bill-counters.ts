/**
 * Initialize bill counters for existing users
 * This script sets each user's billCounter to the number of unique bills they currently have
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting bill counter initialization...');
  
  const users = await prisma.user.findMany({
    include: {
      sales: {
        select: {
          billNumber: true
        }
      }
    }
  });

  for (const user of users) {
    // Count unique bill numbers for this user (excluding empty ones)
    const uniqueBills = new Set(
      user.sales
        .map(s => s.billNumber)
        .filter(bn => bn && bn !== '')
    );
    
    const billCount = uniqueBills.size;
    
    await prisma.user.update({
      where: { id: user.id },
      data: { billCounter: billCount }
    });
    
    console.log(`✓ User ${user.username}: Initialized billCounter to ${billCount}`);
  }
  
  console.log('\n✅ Bill counter initialization complete!');
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
