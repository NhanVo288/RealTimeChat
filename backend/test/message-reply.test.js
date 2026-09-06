import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Message from "../src/model/Message.js";
import { createMessage, toClientMessage, validateReplyTarget } from "../src/services/message.service.js";
import { getMessagePage } from "../src/services/message-pagination.service.js";

const conversationId = new mongoose.Types.ObjectId();
const senderId = new mongoose.Types.ObjectId();
const targetId = new mongoose.Types.ObjectId();

test("reply validation accepts no target and rejects malformed IDs without querying", async (t) => {
  const exists = t.mock.method(Message, "exists", () => { throw new Error("Unexpected query"); });
  assert.equal(await validateReplyTarget(null, conversationId), true);
  for (const value of ["", "bad-id", 123, {}, { $ne: null }]) {
    assert.equal(await validateReplyTarget(value, conversationId), false);
  }
  assert.equal(exists.mock.callCount(), 0);
});

test("reply targets must exist, belong to the conversation and not be recalled or system messages", async (t) => {
  const exists = t.mock.method(Message, "exists", async (filter) => {
    assert.deepEqual(filter, {
      _id: String(targetId), conversationId, deletedAt: null, type: { $ne: "system" },
    });
    return { _id: targetId };
  });
  assert.equal(await validateReplyTarget(String(targetId), conversationId), true);
  exists.mock.mockImplementation(async () => null);
  assert.equal(await validateReplyTarget(String(targetId), conversationId), false);
});

test("creating a reply persists the reference and populates it for realtime delivery", async (t) => {
  let stored;
  let populations;
  t.mock.method(Message, "create", async (data) => {
    stored = data;
    return { populate: async (value) => { populations = value; return data; } };
  });
  await createMessage({ conversationId, senderId, text: "Reply", replyTo: String(targetId) });
  assert.equal(stored.replyTo, String(targetId));
  assert.equal(populations[1].path, "replyTo");
  assert.equal(populations[1].populate.path, "senderId");
});

test("history includes an encrypted reply target outside the current page without recursive quotes", async (t) => {
  const encryptedPayload = { ciphertext: "encrypted-content" };
  const replyTo = {
    _id: targetId, conversationId, senderId: { _id: senderId, fullName: "Sender" },
    isEncrypted: true, encryptedPayload, replyTo: new mongoose.Types.ObjectId(),
  };
  const entry = { _id: new mongoose.Types.ObjectId(), conversationId, senderId, replyTo };
  const populations = [];
  const query = {
    populate(value) { populations.push(value); return this; },
    sort() { return this; },
    limit() { return this; },
    async lean() { return [entry]; },
  };
  t.mock.method(Message, "find", () => query);
  const page = await getMessagePage(conversationId);
  assert.ok(populations.some((value) => value.path === "replyTo"));
  assert.equal(page.messages[0].replyTo._id, String(targetId));
  assert.equal(page.messages[0].replyTo.sender.fullName, "Sender");
  assert.deepEqual(page.messages[0].replyTo.encryptedPayload, encryptedPayload);
  assert.equal(page.messages[0].replyTo.replyTo, null);
  assert.equal(toClientMessage({ ...entry, replyTo: null }).replyTo, null);
});
