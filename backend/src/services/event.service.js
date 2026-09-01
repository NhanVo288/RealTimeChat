const clientStreams = new Map();
const sessionStreams = new Map();

export const addClientStream = (userId, sessionId, response) => {
  const userKey = userId.toString();
  const streams = clientStreams.get(userKey) || new Set();
  streams.add(response);
  clientStreams.set(userKey, streams);

  const sessionResponses = sessionStreams.get(sessionId) || new Set();
  sessionResponses.add(response);
  sessionStreams.set(sessionId, sessionResponses);

  response.on("close", () => {
    clearInterval(response.sseHeartbeat);
    streams.delete(response);
    if (!streams.size) clientStreams.delete(userKey);
    sessionResponses.delete(response);
    if (!sessionResponses.size) sessionStreams.delete(sessionId);
  });

  response.sseHeartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(": heartbeat\n\n");
  }, 15000);
};

export const closeSessionStreams = (sessionId, reason = "revoked") => {
  const streams = sessionStreams.get(sessionId);
  if (!streams) return;
  streams.forEach((response) => {
    if (!response.writableEnded) {
      response.write(`event: session-revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
      response.end();
    }
  });
  sessionStreams.delete(sessionId);
};

export const publishUserEvent = (userId, event, payload) => {
  const streams = clientStreams.get(userId.toString());
  if (!streams) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  streams.forEach((response) => response.write(data));
};

export const publishUsersEvent = (userIds, event, payload) => {
  userIds.forEach((userId) => publishUserEvent(userId, event, payload));
};

export const conversationEvents = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");
  addClientStream(req.user._id, req.authSession.sessionId, res);
};
