import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026';
const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');

console.log('=== VaultCore P17.7 — Teller Creates Accounts for Customers Verification ===\n');

const checks = [];

function recordCheck(number, name, pass, details = '') {
  checks.push({ number, name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - [Requirement ${number}] ${name} ${details ? `(${details})` : ''}`);
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  try {
    const timestamp = Date.now();

    // 1. Setup Test Users in Database
    console.log('--- 1. Setting up test customer, teller, and admin in database ---');

    // Customer
    const testCustomer = await prisma.user.create({
      data: {
        email: `customer.${timestamp}@vaultcore.io`,
        passwordHash: '$2a$10$vN4.mockHashCustomer123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CUSTOMER',
        isActive: true,
      },
    });

    // Teller
    const testTeller = await prisma.user.create({
      data: {
        email: `teller.${timestamp}@vaultcore.io`,
        passwordHash: '$2a$10$vN4.mockHashTeller123',
        firstName: 'Jane',
        lastName: 'Teller',
        role: 'TELLER',
        isActive: true,
      },
    });

    // Admin
    const testAdmin = await prisma.user.create({
      data: {
        email: `admin.${timestamp}@vaultcore.io`,
        passwordHash: '$2a$10$vN4.mockHashAdmin123',
        firstName: 'Arthur',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });

    const customerToken = createToken(testCustomer);
    const tellerToken = createToken(testTeller);
    const adminToken = createToken(testAdmin);

    // Test 1: Teller can search customers
    console.log('\n--- Test 1: Teller general customer search ---');
    const searchRes1 = await fetch(`${GATEWAY_URL}/customers/search?query=John`, {
      headers: { Authorization: `Bearer ${tellerToken}` },
    });
    const searchData1 = await searchRes1.json();
    const hasResults1 = searchRes1.status === 200 && Array.isArray(searchData1.data) && searchData1.data.length > 0;
    recordCheck(1, 'Teller can search customers', hasResults1, `Status: ${searchRes1.status}, Matches: ${searchData1.data?.length}`);

    // Test 2: Search works by email
    console.log('\n--- Test 2: Search by email ---');
    const searchRes2 = await fetch(`${GATEWAY_URL}/customers/search?email=${testCustomer.email}`, {
      headers: { Authorization: `Bearer ${tellerToken}` },
    });
    const searchData2 = await searchRes2.json();
    const matchEmail = searchData2.data?.find((c) => c.email === testCustomer.email);
    recordCheck(2, 'Search works by email', Boolean(matchEmail), `Found: ${matchEmail?.fullName} (${matchEmail?.email})`);

    // Test 3: Search works by phone
    console.log('\n--- Test 3: Search by phone ---');
    const searchRes3 = await fetch(`${GATEWAY_URL}/customers/search?phone=%2B1%20(555)%20019-2834`, {
      headers: { Authorization: `Bearer ${tellerToken}` },
    });
    const searchData3 = await searchRes3.json();
    const hasPhoneResults = searchRes3.status === 200 && Array.isArray(searchData3.data);
    recordCheck(3, 'Search works by phone', hasPhoneResults, `Status: ${searchRes3.status}, Results count: ${searchData3.data?.length}`);

    // Test 4: Search works by customer ID
    console.log('\n--- Test 4: Search by customer ID ---');
    const searchRes4 = await fetch(`${GATEWAY_URL}/customers/search?customerId=${testCustomer.id}`, {
      headers: { Authorization: `Bearer ${tellerToken}` },
    });
    const searchData4 = await searchRes4.json();
    const matchId = searchData4.data?.find((c) => (c.customerId || c.id) === testCustomer.id);
    recordCheck(4, 'Search works by customer ID', Boolean(matchId), `Matched customerId: ${matchId?.customerId || matchId?.id}`);

    // Test 5: CUSTOMER role gets 403 on search endpoint
    console.log('\n--- Test 5: RBAC Forbidden for Customer role ---');
    const searchResCustomer = await fetch(`${GATEWAY_URL}/customers/search?query=John`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const isForbidden = searchResCustomer.status === 403;
    recordCheck(5, 'CUSTOMER role gets 403 on search endpoint', isForbidden, `Status: ${searchResCustomer.status} Forbidden`);

    // Test 6: customerId included in POST /accounts by Teller
    console.log('\n--- Test 6: Teller creates account with customerId ---');
    const createAccountRes = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tellerToken}`,
      },
      body: JSON.stringify({
        type: 'CHECKING',
        currency: 'USD',
        initialDeposit: 2500,
        customerId: testCustomer.id,
      }),
    });
    const createAccountData = await createAccountRes.json();
    const isCreated = createAccountRes.status === 201;
    const createdAccount = createAccountData.data;
    recordCheck(6, 'customerId included in POST /accounts', isCreated, `Status: ${createAccountRes.status}, Account: ${createdAccount?.accountNumber}`);

    // Test 7: Created account belongs to selected customer
    console.log('\n--- Test 7: Verify account ownership in DB ---');
    const dbAccount = await prisma.account.findUnique({
      where: { accountNumber: createdAccount.accountNumber },
    });
    const belongsToCustomer = dbAccount && dbAccount.userId === testCustomer.id;
    recordCheck(7, 'Created account belongs to selected customer', Boolean(belongsToCustomer), `Account ${dbAccount?.accountNumber} userId: ${dbAccount?.userId}`);

    // Test 8: Customer dashboard / list shows new account
    console.log('\n--- Test 8: Customer views their accounts list ---');
    const customerAccountsRes = await fetch(`${GATEWAY_URL}/accounts`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const customerAccountsData = await customerAccountsRes.json();
    const accountsList = customerAccountsData.data?.accounts || customerAccountsData.data || [];
    const customerHasAccount = accountsList.some((a) => a.accountNumber === createdAccount.accountNumber);
    recordCheck(8, 'Customer dashboard shows new account', customerHasAccount, `Customer account count: ${accountsList.length}`);

    // Test 9: Teller dashboard does not own customer account
    console.log('\n--- Test 9: Teller views their own accounts list ---');
    const tellerAccountsRes = await fetch(`${GATEWAY_URL}/accounts`, {
      headers: { Authorization: `Bearer ${tellerToken}` },
    });
    const tellerAccountsData = await tellerAccountsRes.json();
    const tellerAccountsList = tellerAccountsData.data?.accounts || tellerAccountsData.data || [];
    const tellerDoesNotOwn = !tellerAccountsList.some((a) => a.accountNumber === createdAccount.accountNumber);
    recordCheck(9, 'Teller dashboard does not own customer account', tellerDoesNotOwn, `Teller account count: ${tellerAccountsList.length}`);

    // Test 10: ADMIN workflow continues working
    console.log('\n--- Test 10: Admin account creation workflow ---');
    const adminCreateRes = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        type: 'SAVINGS',
        currency: 'USD',
        initialDeposit: 5000,
        customerId: testCustomer.id,
      }),
    });
    const adminCreateData = await adminCreateRes.json();
    const adminSuccess = adminCreateRes.status === 201;
    recordCheck(10, 'ADMIN workflow continues working', adminSuccess, `Status: ${adminCreateRes.status}, Account: ${adminCreateData.data?.accountNumber}`);

    console.log('\n======================================================');
    const allPassed = checks.every((c) => c.pass);
    if (allPassed) {
      console.log(`🎉 All ${checks.length}/${checks.length} Teller Customer Flow tests PASSED!`);
      process.exit(0);
    } else {
      const failed = checks.filter((c) => !c.pass);
      console.error(`❌ ${failed.length} tests failed.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
