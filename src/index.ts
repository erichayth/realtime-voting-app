import { DurableObject } from "cloudflare:workers";

interface Env {
  SURVEY_MANAGER: DurableObjectNamespace;
  QR_CODES: R2Bucket;
  ASSETS: Fetcher;
  RESET_PASSWORD: string;
}

interface Vote {
  sessionId: string;
  selections: string[];
  timestamp: number;
}

interface SurveyState {
  votes: Map<string, Vote>;
  tallies: Map<string, number>;
  totalVotes: number;
  startTime: number;
}

const AI_TOOLS = [
  "Claude Code",
  "Replit",
  "Cursor",
  "Windsurf",
  "OpenAI Codex",
  "Roo Code",
  "Google Jules",
  "AWS Kiro",
  "Loveable",
  "Other",
  "None"
];

export class SurveyManager extends DurableObject<Env> {
  private connections: Set<WebSocket> = new Set();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.ctx.acceptWebSocket(server);
      this.connections.add(server);

      const state = await this.getState();
      server.send(JSON.stringify({
        type: "state",
        data: {
          tallies: Object.fromEntries(state.tallies),
          totalVotes: state.totalVotes,
          onlineUsers: this.connections.size
        }
      }));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === "/vote" && request.method === "POST") {
      const body = await request.json() as { sessionId: string; selections: string[] };
      const result = await this.submitVote(body.sessionId, body.selections);
      return Response.json(result);
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      await this.resetSurvey();
      return Response.json({ success: true });
    }

    if (url.pathname === "/state") {
      const state = await this.getState();
      return Response.json({
        tallies: Object.fromEntries(state.tallies),
        totalVotes: state.totalVotes,
        onlineUsers: this.connections.size
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string);

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      console.error("WebSocket message error:", e);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.connections.delete(ws);
    this.broadcastState();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    this.connections.delete(ws);
  }

  private async getState(): Promise<SurveyState> {
    const votes = (await this.ctx.storage.get<Map<string, Vote>>("votes")) || new Map();
    const tallies = new Map<string, number>();

    // Initialize all options with 0
    AI_TOOLS.forEach(tool => tallies.set(tool, 0));

    // Count votes
    for (const vote of votes.values()) {
      vote.selections.forEach(selection => {
        tallies.set(selection, (tallies.get(selection) || 0) + 1);
      });
    }

    return {
      votes,
      tallies,
      totalVotes: votes.size,
      startTime: (await this.ctx.storage.get<number>("startTime")) || Date.now()
    };
  }

  private async submitVote(sessionId: string, selections: string[]): Promise<any> {
    const votes = (await this.ctx.storage.get<Map<string, Vote>>("votes")) || new Map();

    if (votes.has(sessionId)) {
      return { success: false, error: "Already voted" };
    }

    // Validate selections
    const validSelections = selections.filter(s => AI_TOOLS.includes(s));
    if (validSelections.length === 0) {
      return { success: false, error: "No valid selections" };
    }

    const vote: Vote = {
      sessionId,
      selections: validSelections,
      timestamp: Date.now()
    };

    votes.set(sessionId, vote);
    await this.ctx.storage.put("votes", votes);

    // Broadcast update to all connected clients
    this.broadcastState();

    return { success: true };
  }

  private async resetSurvey(): Promise<void> {
    await this.ctx.storage.delete("votes");
    await this.ctx.storage.put("startTime", Date.now());

    // Broadcast reset to all connected clients
    this.broadcastState();
  }

  private async broadcastState(): Promise<void> {
    const state = await this.getState();
    const message = JSON.stringify({
      type: "state",
      data: {
        tallies: Object.fromEntries(state.tallies),
        totalVotes: state.totalVotes,
        onlineUsers: this.connections.size
      }
    });

    // Send to all connected WebSocket clients
    this.connections.forEach(ws => {
      try {
        ws.send(message);
      } catch (e) {
        console.error("Failed to send to WebSocket:", e);
        this.connections.delete(ws);
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle API routes first
    if (url.pathname.startsWith("/api/")) {
      return handleApiRoute(request, env, url);
    }

    // Serve static assets for everything else
    // This includes: /, /vote, /results.html, /results-old.html, /results-styles.css, etc.
    // The Workers Static Assets binding will automatically handle:
    // - index.html for root path
    // - proper MIME types
    // - 404 for missing files
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleApiRoute(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/vote" && request.method === "POST") {
    const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
    const survey = env.SURVEY_MANAGER.get(surveyId);
    return survey.fetch(new Request(request.url.replace("/api", ""), request));
  }

  if (url.pathname === "/api/ws") {
    const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
    const survey = env.SURVEY_MANAGER.get(surveyId);
    return survey.fetch(request);
  }

  if (url.pathname === "/api/state") {
    const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
    const survey = env.SURVEY_MANAGER.get(surveyId);
    return survey.fetch(new Request(request.url.replace("/api", ""), request));
  }

  if (url.pathname === "/api/reset" && request.method === "POST") {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.RESET_PASSWORD}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
    const survey = env.SURVEY_MANAGER.get(surveyId);
    return survey.fetch(new Request(request.url.replace("/api", ""), request));
  }

  if (url.pathname.match(/^\/api\/survey\/[^\/]+\/results$/)) {
    const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
    const survey = env.SURVEY_MANAGER.get(surveyId);
    const stateResponse = await survey.fetch(new Request(url.origin + "/state", request));
    const state = await stateResponse.json();

    // Get QR code URL
    const qrCodeUrl = `${url.origin}/api/qr`;

    return Response.json({
      results: state.tallies,
      totalVotes: state.totalVotes,
      onlineUsers: state.onlineUsers,
      qrCode: qrCodeUrl
    });
  }

  if (url.pathname.match(/^\/api\/survey\/[^\/]+\/reset$/)) {
    try {
      const body = await request.json() as { password: string };
      if (!body.password || body.password !== env.RESET_PASSWORD) {
        return Response.json({ error: "Invalid password" }, { status: 401 });
      }

      const surveyId = env.SURVEY_MANAGER.idFromName("main-survey");
      const survey = env.SURVEY_MANAGER.get(surveyId);
      // Create a new request with a fresh body since we already consumed it
      return survey.fetch(new Request(url.origin + "/reset", {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(body)
      }));
    } catch (error) {
      // If JSON parsing fails or password is missing, return an error
      return Response.json({
        error: "Invalid request. Please provide a valid JSON body with a 'password' field."
      }, { status: 400 });
    }
  }

  if (url.pathname === "/api/qr") {
    // First check if we have the QR code in R2
    const qrCode = await env.QR_CODES.get("survey-qr.png");

    if (qrCode) {
      return new Response(qrCode.body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, immutable" // Cache for 24 hours, immutable
        }
      });
    }

    // Generate QR code for the current domain
    const host = request.headers.get("host") || "your-worker.workers.dev";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const surveyUrl = `${protocol}://${host}/`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(surveyUrl)}`;

    const qrResponse = await fetch(qrApiUrl);
    if (!qrResponse.ok) {
      return new Response("Failed to generate QR code", { status: 500 });
    }

    const qrBuffer = await qrResponse.arrayBuffer();
    await env.QR_CODES.put("survey-qr.png", qrBuffer, {
      httpMetadata: {
        contentType: "image/png"
      }
    });

    return new Response(qrBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable" // Cache for 24 hours, immutable
      }
    });
  }

  return new Response("Not found", { status: 404 });
}