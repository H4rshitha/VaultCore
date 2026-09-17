// Test to verify Notification Mark as Read & Read Storage persistence
import { notificationStorage } from '../frontend/src/utils/storage.js';

console.log('--- Testing Notification Read State Persistence ---');

// Mock localStorage if in node environment
if (typeof global.localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// 1. Initial State
console.log('1. Initial unread check:');
const testId1 = 'notif-101';
const testId2 = 'notif-102';
console.log(`  isRead(${testId1}): ${notificationStorage.isRead(testId1)} (Expected: false)`);

// 2. Mark Single Notification as Read
console.log('\n2. Mark single notification as read:');
notificationStorage.markAsRead(testId1);
console.log(`  isRead(${testId1}): ${notificationStorage.isRead(testId1)} (Expected: true)`);
console.log(`  isRead(${testId2}): ${notificationStorage.isRead(testId2)} (Expected: false)`);

// 3. Mark All as Read
console.log('\n3. Mark All as Read:');
const now = new Date().toISOString();
notificationStorage.markAllAsRead([testId1, testId2]);
console.log(`  isRead(${testId1}): ${notificationStorage.isRead(testId1, now)} (Expected: true)`);
console.log(`  isRead(${testId2}): ${notificationStorage.isRead(testId2, now)} (Expected: true)`);

// 4. New notification created after markAll
const futureTime = new Date(Date.now() + 100000).toISOString();
const newId = 'notif-103';
console.log(`  New notification created after markAll (${newId}): ${notificationStorage.isRead(newId, futureTime)} (Expected: false)`);

const pass =
  notificationStorage.isRead(testId1) === true &&
  notificationStorage.isRead(testId2) === true &&
  notificationStorage.isRead(newId, futureTime) === false;

console.log(`\nResult: ${pass ? 'ALL READ PERSISTENCE TESTS PASSED ✅' : 'FAIL ❌'}`);
if (!pass) process.exit(1);
