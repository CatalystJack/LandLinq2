import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db";
import { rateLimit } from "./security";

after(async () => {
  await pool.end();
});

function runLimiter(
  limiter: ReturnType<typeof rateLimit>,
  request: Record<string, any>,
) {
  const response: Record<string, any> = {
    statusCode: 200,
    headers: {},
    set(headers: Record<string, string>) {
      Object.assign(this.headers, headers);
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  limiter(
    request as Request,
    response as Response,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  return { response, nextCalled };
}

function request(path: string, options: Record<string, any> = {}) {
  return {
    path,
    ip: "198.51.100.23",
    socket: { remoteAddress: "198.51.100.23" },
    ...options,
  };
}

const oneRequestPerWindow = {
  windowMs: 60_000,
  maxRequests: 1,
  message: "Too many requests",
};

test("authenticated users sharing one IP have independent general budgets", () => {
  const limiter = rateLimit(oneRequestPerWindow);
  const path = "/api/rate-limit-test-shared-ip";

  assert.equal(runLimiter(limiter, request(path, { user: { id: "user-a" } })).nextCalled, true);
  assert.equal(runLimiter(limiter, request(path, { user: { id: "user-b" } })).nextCalled, true);

  const abusiveRequest = runLimiter(limiter, request(path, { user: { id: "user-a" } }));
  assert.equal(abusiveRequest.response.statusCode, 429);
  assert.equal(abusiveRequest.nextCalled, false);
});

test("unauthenticated requests continue to share the IP-based general budget", () => {
  const limiter = rateLimit(oneRequestPerWindow);
  const path = "/api/rate-limit-test-unauthenticated";

  assert.equal(runLimiter(limiter, request(path)).nextCalled, true);

  const blockedRequest = runLimiter(limiter, request(path));
  assert.equal(blockedRequest.response.statusCode, 429);
  assert.equal(blockedRequest.nextCalled, false);
});

test("IP-only limits still stop requests across multiple authenticated accounts", () => {
  const limiter = rateLimit({ ...oneRequestPerWindow, keyStrategy: "ip" });
  const path = "/api/rate-limit-test-costly";

  assert.equal(runLimiter(limiter, request(path, { user: { id: "user-a" } })).nextCalled, true);

  const blockedRequest = runLimiter(limiter, request(path, { user: { id: "user-b" } }));
  assert.equal(blockedRequest.response.statusCode, 429);
  assert.equal(blockedRequest.nextCalled, false);
});

test("broker portal accounts sharing one IP have independent general budgets", () => {
  const limiter = rateLimit(oneRequestPerWindow);
  const path = "/api/rate-limit-test-broker-portal";

  assert.equal(
    runLimiter(limiter, request(path, { session: { brokerPortalId: "broker-a" } })).nextCalled,
    true,
  );
  assert.equal(
    runLimiter(limiter, request(path, { session: { brokerPortalId: "broker-b" } })).nextCalled,
    true,
  );
});