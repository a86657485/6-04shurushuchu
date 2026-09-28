/** Read a classroom sound event using server and local elapsed time, not matching device clocks. */
export function readSharedLight(live, now = Date.now()) {
  const eventAt = Date.parse(live?.at);
  const serverNow = Number.isFinite(live?.serverNow) ? live.serverNow : now;
  const receivedAt = Number.isFinite(live?.clientReceivedAt) ? live.clientReceivedAt : now;
  const eventAge = serverNow - eventAt;
  const receiveAge = now - receivedAt;
  const fresh = Boolean(live?.active && Number.isFinite(eventAt) &&
    eventAge >= -1000 && eventAge <= 5000 && receiveAge >= 0 && receiveAge <= 5000);
  return {fresh, lamp: fresh && live.lamp === true,
    level: fresh ? Math.max(0, Math.min(1, Number(live.level) || 0)) : 0};
}
