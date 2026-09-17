// Verification test for TransactionsPage cursor pagination
import fs from 'fs';
import path from 'path';

console.log('--- Checking TransactionsPage Cursor Pagination Implementation ---');

const txPagePath = path.resolve('frontend/src/pages/TransactionsPage.jsx');
const usePaymentsPath = path.resolve('frontend/src/hooks/usePayments.js');

const txCode = fs.readFileSync(txPagePath, 'utf8');
const hookCode = fs.readFileSync(usePaymentsPath, 'utf8');

const checks = [
  {
    name: '1. Maintains cursor history stack and page index',
    passed: txCode.includes('cursorHistory') && txCode.includes('currentPageIndex'),
  },
  {
    name: '2. Passes cursor in apiFilters to useTransactions',
    passed: txCode.includes('apiFilters') && txCode.includes('cursor: currentCursor'),
  },
  {
    name: '3. Next button disabled when !nextCursor or isFetching',
    passed: txCode.includes('disabled={!nextCursor || isFetching}'),
  },
  {
    name: '4. Previous button disabled on page 1 (currentPageIndex === 0) or isFetching',
    passed: txCode.includes('disabled={currentPageIndex === 0 || isFetching}'),
  },
  {
    name: '5. Filter change and reset handlers reset pagination stack to page 1',
    passed:
      txCode.includes('setCursorHistory([null])') && txCode.includes('setCurrentPageIndex(0)'),
  },
  {
    name: '6. Renders Next and Previous buttons in Ledger style footer',
    passed:
      txCode.includes('<ChevronLeft') &&
      txCode.includes('<ChevronRight') &&
      txCode.includes('Previous') &&
      txCode.includes('Next'),
  },
  {
    name: '7. useTransactions hook exposes nextCursor, previousCursor, and pagination object',
    passed:
      hookCode.includes('nextCursor') &&
      hookCode.includes('previousCursor') &&
      hookCode.includes('pagination'),
  },
];

let allPassed = true;
checks.forEach((c) => {
  if (!c.passed) allPassed = false;
  console.log(`[${c.passed ? 'PASS' : 'FAIL'}] ${c.name}`);
});

console.log(
  `\nResult: ${allPassed ? 'ALL TRANSACTION PAGINATION CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`
);
if (!allPassed) process.exit(1);
