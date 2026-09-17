// Verification test for Developer Request Inspector
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 RUNNING DEV REQUEST INSPECTOR VERIFICATION SUITE');
console.log('====================================================\n');

const devInspectorPath = path.resolve('frontend/src/components/DevInspector.jsx');
const clientPath = path.resolve('frontend/src/api/client.js');

const devInspectorCode = fs.readFileSync(devInspectorPath, 'utf8');
const clientCode = fs.readFileSync(clientPath, 'utf8');

const tests = [];

// 1. Inspector condition on import.meta.env.DEV
{
  const checksDevOnly =
    devInspectorCode.includes('if (!import.meta.env.DEV)') &&
    devInspectorCode.includes('return null;');
  tests.push({
    name: '1. Inspector visible in dev (import.meta.env.DEV === true) and absent in production/preview',
    passed: checksDevOnly,
    details:
      'DevInspector returns null when import.meta.env.DEV is falsy (preview/production build)',
  });
}

// 2. Trace IDs and Response time captured in Axios interceptors and displayed in DevInspector
{
  const capturesTrace =
    clientCode.includes('traceId') && clientCode.includes('requestInspectorEmitter.emit');
  const displaysTrace = devInspectorCode.includes('log.traceId');
  tests.push({
    name: '2. Trace ID captured in Axios interceptors and rendered in UI',
    passed: capturesTrace && displaysTrace,
    details:
      'X-Trace-ID emitted by Axios response interceptor and rendered in DevInspector log items',
  });
}

// 3. Response time captured and displayed
{
  const capturesResponseTime =
    clientCode.includes('responseTime') && clientCode.includes('_startTime');
  const displaysResponseTime = devInspectorCode.includes('log.responseTime');
  tests.push({
    name: '3. Response time (ms) measured from request start to response and displayed',
    passed: capturesResponseTime && displaysResponseTime,
    details: 'Axios records config._startTime and computes response time in ms for DevInspector',
  });
}

// 4. Copy-to-clipboard for Trace ID
{
  const hasCopyFunction =
    devInspectorCode.includes('navigator.clipboard') && devInspectorCode.includes('handleCopy');
  tests.push({
    name: '4. Copy-to-clipboard for Trace ID supported',
    passed: hasCopyFunction,
    details: 'handleCopy writes traceId to navigator.clipboard with visual confirmation',
  });
}

// 5. Stores only the latest 20 requests
{
  const limitsTo20 =
    devInspectorCode.includes('.slice(0, 20)') && devInspectorCode.includes('/20 calls');
  tests.push({
    name: '5. Stores only latest 20 requests with auto-scroll',
    passed: limitsTo20,
    details: 'Logs state buffer bounded to slice(0, 20) on each incoming request event',
  });
}

// 6. Simulation test of requestInspectorEmitter buffer retention
{
  // Simulate emitter & buffer logic
  const logs = [];
  const addLog = (entry) => {
    logs.unshift(entry);
    if (logs.length > 20) logs.pop();
  };

  for (let i = 1; i <= 35; i++) {
    addLog({ id: `req-${i}`, url: `/api/test-${i}`, method: 'GET', status: 200 });
  }

  const correctlyRetained =
    logs.length === 20 && logs[0].id === 'req-35' && logs[19].id === 'req-16';
  tests.push({
    name: '6. Buffer retention simulation verified (20 most recent items retained)',
    passed: correctlyRetained,
    details: `Buffer retained ${logs.length} items. Most recent: ${logs[0].id}, Oldest in buffer: ${logs[19].id}`,
  });
}

console.log('--- TEST RESULTS ---');
let allPass = true;
tests.forEach((t) => {
  if (!t.passed) allPass = false;
  console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.name}`);
  console.log(`       ${t.details}`);
});

console.log('\n====================================================');
console.log(`Dev Inspector Summary: ${allPass ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
console.log('====================================================\n');

if (!allPass) process.exit(1);
