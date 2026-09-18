import http from 'http';

async function test() {
  // 1. Signup a user with 2 accounts
  const email = `test.transfer.${Date.now()}@vaultcore.io`;
  const pass = 'Password123!';

  function req(options, body) {
    return new Promise((resolve, reject) => {
      const r = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  console.log('1. Signing up user...');
  const signupRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    firstName: 'Test',
    lastName: 'User',
    email,
    password: pass,
    role: 'CUSTOMER'
  });
  console.log('Signup status:', signupRes.status);
  const token = signupRes.data.data.token;

  console.log('2. Creating second account...');
  const accRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/accounts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    type: 'SAVINGS',
    currency: 'USD',
    initialDeposit: 5000
  });
  console.log('Second account created:', accRes.data.data.accountNumber);

  // List accounts
  const listAcc = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/accounts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const accs = listAcc.data.data;
  console.log(`User has ${accs.length} accounts:`, accs.map(a => `${a.accountNumber} (${a.type}: $${a.balance})`));

  const source = accs[0].accountNumber;
  const target = accs[1].accountNumber;

  console.log(`3. Transferring $500 from ${source} to ${target}...`);
  const transferRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/payments/transfer',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    sourceAccountNumber: source,
    targetAccountNumber: target,
    amount: 500,
    currency: 'USD',
    description: 'Test transfer'
  });

  console.log('Transfer status:', transferRes.status);
  console.log('Transfer response:', transferRes.data);
}

test().catch(console.error);
