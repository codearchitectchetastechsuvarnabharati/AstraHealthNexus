import test from 'node:test';
import assert from 'node:assert/strict';
import { sendError, sendSuccess } from './apiResponse.js';

function makeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };

  return response;
}

test('sendSuccess returns the standard response envelope', () => {
  const res = makeResponse();

  sendSuccess(
    res as never,
    { id: 1, name: 'test' },
    'Loaded successfully'
  );

  const body = res.body as any;

  assert.equal(res.statusCode, 200);
  assert.equal(body.status, 'success');
  assert.equal(body.message, 'Loaded successfully');
  assert.deepEqual(body.data, { id: 1, name: 'test' });
  assert.equal(typeof body.metadata.timestamp, 'string');
  assert.equal(body.pagination, null);
});

test('sendError returns the standard error response envelope', () => {
  const res = makeResponse();

  sendError(
    res as never,
    404,
    'Dataset not found',
    'DATASET_NOT_FOUND'
  );

  const body = res.body as any;

  assert.equal(res.statusCode, 404);
  assert.equal(body.status, 'error');
  assert.equal(body.message, 'Dataset not found');
  assert.equal(body.code, 'DATASET_NOT_FOUND');
  assert.equal(body.data, null);
  assert.equal(typeof body.metadata.timestamp, 'string');
  assert.equal(body.pagination, null);
});
