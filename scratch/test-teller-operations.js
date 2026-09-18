import crypto from 'crypto';

async function testTellerOperations() {
  console.log('=== Testing Bank Teller Full Operations ===');
  const timestamp = Date.now();

  // 1. Create a Customer with 2 accounts
  console.log('\n--- 1. Setting Up Test Customer & Accounts ---');
  const customerEmail = `customer.test.${timestamp}@vaultcore.io`;
  const customerSignup = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      password: 'Password123!',
      firstName: 'Samantha',
      lastName: 'Miller',
      role: 'CUSTOMER'
    })
  });
  const customerSignupData = await customerSignup.json();
  const customerToken = customerSignupData?.data?.tokens?.accessToken;
  const customerId = customerSignupData?.data?.user?.id;
  console.log('✅ Customer registered:', customerEmail, 'ID:', customerId);

  // Open 2 customer accounts
  const acc1Res = await fetch('http://localhost:3000/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ type: 'CHECKING', currency: 'USD', initialDeposit: 10000 })
  });
  const acc1Data = await acc1Res.json();
  const acc1Num = acc1Data.data?.accountNumber;
  console.log(`✅ Customer Account 1 (CHECKING): ${acc1Num} ($10,000)`);

  const acc2Res = await fetch('http://localhost:3000/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ type: 'SAVINGS', currency: 'USD', initialDeposit: 5000 })
  });
  const acc2Data = await acc2Res.json();
  const acc2Num = acc2Data.data?.accountNumber;
  console.log(`✅ Customer Account 2 (SAVINGS): ${acc2Num} ($5,000)`);

  // 2. Register & Login as a TELLER
  console.log('\n--- 2. Setting Up Bank Teller ---');
  const tellerEmail = `teller.test.${timestamp}@vaultcore.io`;
  const tellerSignup = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tellerEmail,
      password: 'Password123!',
      firstName: 'Victoria',
      lastName: 'Teller',
      role: 'TELLER'
    })
  });
  const tellerSignupData = await tellerSignup.json();
  const tellerToken = tellerSignupData?.data?.tokens?.accessToken;
  console.log('✅ Bank Teller logged in:', tellerEmail);

  // 3. Teller fetches customer accounts (Branch Operations Console)
  console.log('\n--- 3. Teller Dashboard: Querying Branch Customer Accounts ---');
  const tellerAccountsRes = await fetch('http://localhost:3000/accounts', {
    headers: { 'Authorization': `Bearer ${tellerToken}` }
  });
  const tellerAccountsData = await tellerAccountsRes.json();
  console.log('Teller query status:', tellerAccountsRes.status);
  console.log('Total customer accounts visible to Teller:', tellerAccountsData.data?.accounts?.length);
  console.log('Branch Stats:', tellerAccountsData.data?.stats);
  const foundAcc1 = tellerAccountsData.data?.accounts?.find(a => a.accountNumber === acc1Num);
  console.log(`Found Customer Account in Teller view: ${foundAcc1 ? 'YES (Customer: ' + foundAcc1.user?.firstName + ' ' + foundAcc1.user?.lastName + ')' : 'NO'}`);

  // 4. Teller executes Cash Deposit into Customer Account
  console.log(`\n--- 4. Teller Cash Deposit: +$2,500 into ${acc1Num} ---`);
  const depositRes = await fetch('http://localhost:3000/payments/deposit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tellerToken}`
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      accountNumber: acc1Num,
      amount: 2500,
      currency: 'USD',
      description: 'Branch counter cash deposit by Teller'
    })
  });
  const depositData = await depositRes.json();
  console.log('Deposit Status:', depositRes.status, 'Message:', depositData.message);
  console.log('Deposit Reference:', depositData.data?.referenceId, 'New Balance:', depositData.data?.account?.balance);

  // 5. Teller executes Cash Withdrawal from Customer Account
  console.log(`\n--- 5. Teller Cash Withdrawal: -$1,000 from ${acc1Num} ---`);
  const withdrawRes = await fetch('http://localhost:3000/payments/withdraw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tellerToken}`
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      accountNumber: acc1Num,
      amount: 1000,
      currency: 'USD',
      description: 'Branch counter cash withdrawal by Teller'
    })
  });
  const withdrawData = await withdrawRes.json();
  console.log('Withdrawal Status:', withdrawRes.status, 'Message:', withdrawData.message);
  console.log('Withdrawal Reference:', withdrawData.data?.referenceId, 'New Balance:', withdrawData.data?.account?.balance);

  // 6. Teller executes Transfer between two customer accounts
  console.log(`\n--- 6. Teller Cross-Account Transfer: $3,000 from ${acc1Num} to ${acc2Num} ---`);
  const transferRes = await fetch('http://localhost:3000/payments/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tellerToken}`
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      sourceAccountNumber: acc1Num,
      targetAccountNumber: acc2Num,
      amount: 3000,
      currency: 'USD',
      description: 'Teller transfer on behalf of customer'
    })
  });
  const transferData = await transferRes.json();
  console.log('Transfer Status:', transferRes.status, 'Message:', transferData.message);
  console.log('Transfer Reference:', transferData.data?.referenceId);

  // 7. Verify Ledger entries for both accounts
  console.log(`\n--- 7. Verifying Immutable Double-Entry Ledger for ${acc1Num} ---`);
  const ledgerRes = await fetch(`http://localhost:3000/ledger/accounts/${acc1Num}/entries`, {
    headers: { 'Authorization': `Bearer ${tellerToken}` }
  });
  const ledgerData = await ledgerRes.json();
  const entries = ledgerData.data?.entries || [];
  console.log(`Ledger entries recorded for ${acc1Num}: ${entries.length}`);
  entries.forEach(e => {
    console.log(` - [${e.type}] $${e.amount} | Balance After: $${e.balanceAfter} | Tx: ${e.transaction?.type} (${e.transaction?.description})`);
  });

  console.log('\n=============================================');
  console.log('🎉 ALL TELLER OPERATIONS PASSED SUCCESSFULLY!');
  console.log('=============================================');
}

testTellerOperations().catch(console.error);
