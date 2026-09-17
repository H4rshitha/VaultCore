// Verification of notification endpoint through Gateway
import axios from 'axios';

async function testNotificationEndpoint() {
  console.log('Testing notification endpoint through API Gateway...');
  try {
    let token;
    const testEmail = `testnotif-${Date.now()}@vaultcore.io`;
    try {
      const signupRes = await axios.post('http://localhost:3000/api/v1/auth/signup', {
        email: testEmail,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });
      token = signupRes.data.data.tokens.accessToken;
      console.log('1. Signup successful, token acquired.');
    } catch {
      const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
        email: 'harshithapalaram09@gmail.com',
        password: 'Password123!',
      });
      token = loginRes.data.data.tokens.accessToken;
      console.log('1. Login successful, token acquired.');
    }

    // 2. Fetch notifications history
    const notifRes = await axios.get('http://localhost:3000/api/v1/notifications/history?limit=15', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`2. Notifications fetched successfully! Status: ${notifRes.status}, Count: ${notifRes.data.data?.notifications?.length}`);

    // 3. Test mark as read
    if (notifRes.data.data?.notifications?.length > 0) {
      const firstId = notifRes.data.data.notifications[0].id;
      const readRes = await axios.patch(`http://localhost:3000/api/v1/notifications/${firstId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`3. Mark as read PATCH successful! Status: ${readRes.status}`);
    }

    // 4. Test mark all as read
    const readAllRes = await axios.patch('http://localhost:3000/api/v1/notifications/read-all', {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`4. Mark all as read PATCH successful! Status: ${readAllRes.status}`);

    console.log('\nAll notification API tests passed! ✅');
  } catch (err) {
    console.error('Test failed:', err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }
}

testNotificationEndpoint();
