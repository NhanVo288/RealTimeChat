const clientStreams = new Map();

export const addClientStream = (userId, response) => {
  const key = userId.toString();
  const streams = clientStreams.get(key) || new Set();
  streams.add(response);
  clientStreams.set(key, streams);

  response.on("close", () => {
    clearInterval(response.sseHeartbeat);
    streams.delete(response);
    if (!streams.size) clientStreams.delete(key);
  });

  response.sseHeartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(": heartbeat\n\n");
  }, 15000);
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
  addClientStream(req.user._id, res);
};