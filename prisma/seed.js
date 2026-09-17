import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for VaultCore...');

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.outboxEvent.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Users
  const alice = await prisma.user.create({
    data: {
      email: 'alice.johnson@vaultcore.io',
      passwordHash: '$2a$10$vN4.m5ZgB...mockHashForAlicePassword123',
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'CUSTOMER',
      isActive: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob.smith@vaultcore.io',
      passwordHash: '$2a$10$vN4.m5ZgB...mockHashForBobPassword123',
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Created Users: ${alice.firstName} (${alice.email}), ${bob.firstName} (${bob.email})`);

  // 2. Create Accounts
  const aliceChecking = await prisma.account.create({
    data: {
      accountNumber: '100010001001',
      userId: alice.id,
      type: 'CHECKING',
      status: 'ACTIVE',
      balance: 5000.00,
      currency: 'USD',
      version: 0,
    },
  });

  const aliceSavings = await prisma.account.create({
    data: {
      accountNumber: '100010001002',
      userId: alice.id,
      type: 'SAVINGS',
      status: 'ACTIVE',
      balance: 12500.00,
      currency: 'USD',
      version: 0,
    },
  });

  const bobChecking = await prisma.account.create({
    data: {
      accountNumber: '200020002001',
      userId: bob.id,
      type: 'CHECKING',
      status: 'ACTIVE',
      balance: 8200.00,
      currency: 'USD',
      version: 0,
    },
  });

  const bobInvestment = await prisma.account.create({
    data: {
      accountNumber: '200020002002',
      userId: bob.id,
      type: 'INVESTMENT',
      status: 'ACTIVE',
      balance: 25000.00,
      currency: 'USD',
      version: 0,
    },
  });

  console.log(`✅ Created 4 Accounts:`);
  console.log(`   - Alice Checking: ${aliceChecking.accountNumber} ($${aliceChecking.balance})`);
  console.log(`   - Alice Savings:  ${aliceSavings.accountNumber} ($${aliceSavings.balance})`);
  console.log(`   - Bob Checking:   ${bobChecking.accountNumber} ($${bobChecking.balance})`);
  console.log(`   - Bob Investment: ${bobInvestment.accountNumber} ($${bobInvestment.balance})`);

  // 3. Create Sample Audit Log
  await prisma.auditLog.create({
    data: {
      userId: alice.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: alice.id,
      metadata: { ip: '127.0.0.1', userAgent: 'VaultCore-Seed' },
    },
  });

  console.log('🚀 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
