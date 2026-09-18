import crypto from 'crypto';

async function testTransfer() {
  const timestamp = Date.now();
  const email = `transfer.user.${timestamp}@vaultcore.io`;
  const password = 'Password123!';

  console.log('1. Signing up user...');
  const signupRes = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName: 'Transfer',
      lastName: 'Tester',
      role: 'CUSTOMER'
    })
  });
  const signupData = await signupRes.json();
  console.log('Signup status:', signupRes.status);

  console.log('2. Logging in...');
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const token =
    loginData?.data?.tokens?.accessToken ||
    loginData?.data?.accessToken ||
    signupData?.data?.tokens?.accessToken;
  console.log('Login token extracted:', !!token);

  console.log('3. Creating Account 1 (CHECKING with $10,000)...');
  const acc1Res = await fetch('http://localhost:3000/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'CHECKING',
      currency: 'USD',
      initialDeposit: 10000
    })
  });
  const acc1Data = await acc1Res.json();
  const acc1Num = acc1Data.data?.accountNumber;
  console.log('Account 1:', acc1Num);

  console.log('4. Creating Account 2 (SAVINGS with $5,000)...');
  const acc2Res = await fetch('http://localhost:3000/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'SAVINGS',
      currency: 'USD',
      initialDeposit: 5000
    })
  });
  const acc2Data = await acc2Res.json();
  const acc2Num = acc2Data.data?.accountNumber;
  console.log('Account 2:', acc2Num);

  console.log(`\n5. Executing Money Transfer: $1,500 from ${acc1Num} to ${acc2Num}...`);
  const transferRes = await fetch('http://localhost:3000/payments/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      sourceAccountNumber: acc1Num,
      targetAccountNumber: acc2Num,
      amount: 1500,
      currency: 'USD',
      description: 'Transfer test for rent'
    })
  });
  const transferData = await transferRes.json();
  console.log('Transfer HTTP Status:', transferRes.status);
  console.log('Transfer Response:', JSON.stringify(transferData, null, 2));

  console.log('\n6. Checking Ledger Entries for source account...');
  const ledgerRes = await fetch(`http://localhost:3000/ledger/accounts/${acc1Num}/entries`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const ledgerData = await ledgerRes.json();
  console.log('Ledger HTTP Status:', ledgerRes.status);
  const entries = ledgerData.data?.entries || ledgerData.data;
  console.log(`Ledger entries for ${acc1Num}:`, entries?.length);

  console.log('\n7. Checking Updated Balances...');
  const listRes = await fetch('http://localhost:3000/accounts', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  const accounts = listData.data?.accounts || listData.data;
  console.log('Updated Accounts:');
  accounts.forEach(a => console.log(` - ${a.type} (${a.accountNumber}): $${a.balance}`));
}

testTransfer().catch(console.error);
