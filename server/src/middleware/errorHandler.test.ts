import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from './errorHandler.js';

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

test('returns structured response for a known HTTP error', () => {
  const res = makeResponse();

  errorHandler(
    Object.assign(new Error('Dataset not found'), {
      statusCode: 404,
      code: 'NOT_FOUND'
    }),
    {} as never,
    res as never,
    (() => {}) as never
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    status: 'error',
    message: 'Dataset not found',
    code: 'NOT_FOUND'
  });
});

test('returns safe structured response for unexpected errors', () => {
  const res = makeResponse();

  errorHandler(
    new Error('database connection details'),
    {} as never,
    res as never,
    (() => {}) as never
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    status: 'error',
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
});
