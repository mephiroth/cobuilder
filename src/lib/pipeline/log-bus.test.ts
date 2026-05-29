import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { logBus } from './log-bus';

describe('log-bus', () => {
  it('buffers publishes before subscribe', () => {
    const id = 'idea-log-test';
    logBus.clear(id);
    logBus.publish(id, 'line1\n');
    logBus.publish(id, 'line2\n');
    const buffered = logBus.getBuffered(id);
    assert.deepEqual(buffered, ['line1\n', 'line2\n']);

    const chunks: string[] = [];
    const unsub = logBus.subscribe(id, (c) => chunks.push(c));
    logBus.publish(id, 'line3\n');
    assert.ok(chunks.includes('line3\n'));
    unsub();
    logBus.clear(id);
  });
});
