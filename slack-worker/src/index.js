export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const body = await request.text();
    const payload = JSON.parse(body);

    // Slack URL verification
    if (payload.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Verify Slack signature
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const slackSig = request.headers.get("x-slack-signature");
    const sigBasestring = `v0:${timestamp}:${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.SLACK_SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBasestring));
    const mySignature = "v0=" + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");

    if (mySignature !== slackSig) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Handle message events
    if (payload.event && payload.event.type === "message") {
      const event = payload.event;

      // Ignore bot messages, edits, subtypes
      if (event.bot_id || event.subtype) {
        return new Response("OK", { status: 200 });
      }

      const text = (event.text || "").trim();
      if (!text) return new Response("OK", { status: 200 });

      // Parse: first line = title (with optional #labels), rest = body
      const lines = text.split("\n");
      let titleLine = lines[0].trim();
      const bodyLines = lines.slice(1).join("\n").trim();

      // Extract hashtag labels from title
      const labelRegex = /#(\w[\w-]*)/g;
      const labels = [];
      let match;
      while ((match = labelRegex.exec(titleLine)) !== null) {
        labels.push(match[1]);
      }
      const title = titleLine.replace(/#\w[\w-]*/g, "").trim();

      if (!title) return new Response("OK", { status: 200 });

      // Create GitHub issue
      const issueRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "styrkekollen-slack-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body: bodyLines || `Skapad från Slack av <@${event.user}>`,
          labels: labels.length > 0 ? labels : undefined,
        }),
      });

      if (!issueRes.ok) {
        const err = await issueRes.text();
        console.error("GitHub error:", err);
        // Reply with error in Slack
        await postSlackMessage(env, event.channel, event.ts, `❌ Kunde inte skapa issue: ${issueRes.status}`);
        return new Response("OK", { status: 200 });
      }

      const issue = await issueRes.json();

      // Reply in Slack thread
      await postSlackMessage(env, event.channel, event.ts, `✅ Issue skapad: <${issue.html_url}|#${issue.number} ${issue.title}>`);
    }

    return new Response("OK", { status: 200 });
  },
};

async function postSlackMessage(env, channel, threadTs, text) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      thread_ts: threadTs,
      text,
    }),
  });
}
