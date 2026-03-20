import assert from "node:assert/strict";
import { test } from "node:test";

import { createRoundRobinSelector } from "../src/cluster/index.ts";

void test("round-robin selector cycles through worker ports", () => {
  const selectWorkerPort = createRoundRobinSelector([4001, 4002, 4003]);

  assert.equal(selectWorkerPort(), 4001);
  assert.equal(selectWorkerPort(), 4002);
  assert.equal(selectWorkerPort(), 4003);
  assert.equal(selectWorkerPort(), 4001);
});
