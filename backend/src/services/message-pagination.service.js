import Message from "../model/Message.js";
import { toClientMessage } from "./message.service.js";

const defaultPageSize = 30;
const maxPageSize = 100;

export const getMessagePage = async (conversationId, query = {}) => {
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), maxPageSize)
    : defaultPageSize;

  const filter = { conversationId };
  if (query.before) filter._id = { $lt: query.before };

  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit).reverse();

  return {
    messages: page.map(toClientMessage),
    hasMore,
    nextCursor: hasMore ? page[0]._id.toString() : null,
  };
};
