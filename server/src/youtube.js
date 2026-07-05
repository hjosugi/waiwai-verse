// Poll YouTube live chat and push each comment into the room.
// Uses the Live Streaming API with a simple API key (works for public live streams).
//
// Flow:
//   1. videos.list -> liveStreamingDetails.activeLiveChatId
//   2. liveChat/messages (list) with pageToken loop
//   3. respect pollingIntervalMillis so we do not burn quota
//
// For lower latency you can later switch to liveChatMessages.streamList,
// which pushes messages over a streaming connection instead of polling.

const API = "https://www.googleapis.com/youtube/v3";

export function startYouTube({ apiKey, videoId }, onComment) {
  let liveChatId = null;
  let pageToken = null;
  let stopped = false;

  async function resolveChatId() {
    const url = `${API}/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) {
      console.error("[youtube] videos.list:", j.error.message);
      return null;
    }
    liveChatId = j.items?.[0]?.liveStreamingDetails?.activeLiveChatId || null;
    return liveChatId;
  }

  async function poll() {
    if (stopped) return;
    try {
      if (!liveChatId) {
        await resolveChatId();
        if (!liveChatId) {
          // stream may not be live yet; try again later
          return schedule(10000);
        }
        console.log("[youtube] live chat connected:", liveChatId);
      }

      const params = new URLSearchParams({
        part: "snippet,authorDetails",
        liveChatId,
        key: apiKey,
      });
      if (pageToken) params.set("pageToken", pageToken);

      const r = await fetch(`${API}/liveChat/messages?${params}`);
      const j = await r.json();
      if (j.error) {
        console.error("[youtube] messages:", j.error.message);
        // chat ended or quota issue; back off and re-resolve
        liveChatId = null;
        return schedule(15000);
      }

      pageToken = j.nextPageToken;
      for (const it of j.items || []) {
        const text = it.snippet?.displayMessage;
        const author = it.authorDetails?.displayName;
        if (text) onComment({ author, text });
      }

      schedule(Math.max(2000, j.pollingIntervalMillis || 5000));
    } catch (e) {
      console.error("[youtube] poll error:", e.message);
      schedule(10000);
    }
  }

  function schedule(ms) {
    if (!stopped) setTimeout(poll, ms);
  }

  poll();
  return { stop() { stopped = true; } };
}
