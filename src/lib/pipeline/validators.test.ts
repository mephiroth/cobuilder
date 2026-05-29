import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePRD, validateUIBrief, validateTestDoc } from './validators';
import { ValidationError } from './errors';
import { samplePRD, sampleUIBrief, sampleTestDoc } from './test-fixtures';

describe('validators', () => {
  it('accepts valid PRD', () => {
    assert.doesNotThrow(() => validatePRD(samplePRD()));
  });

  it('rejects PRD with short title', () => {
    assert.throws(() => validatePRD({ ...samplePRD(), title: '' }), ValidationError);
  });

  it('accepts valid UI brief', () => {
    assert.doesNotThrow(() => validateUIBrief(sampleUIBrief()));
  });

  it('requires enough test cases', () => {
    const prd = samplePRD();
    assert.throws(
      () => validateTestDoc({ test_cases: [], coverage_note: 'x'.repeat(10) }, 3),
      ValidationError
    );
    assert.doesNotThrow(() => validateTestDoc(sampleTestDoc(), 3));
  });
});
