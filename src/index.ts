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
  
  async webSocketClose(ws: WebSocket): Promise<void> {
    this.connections.delete(ws);
    this.broadcastUserCount();
  }
  
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    this.connections.delete(ws);
  }
  
  private async getState(): Promise<SurveyState> {
    const votes = (await this.ctx.storage.get<Map<string, Vote>>("votes")) || new Map();
    const tallies = (await this.ctx.storage.get<Map<string, number>>("tallies")) || new Map(AI_TOOLS.map(tool => [tool, 0]));
    const totalVotes = (await this.ctx.storage.get<number>("totalVotes")) || 0;
    const startTime = (await this.ctx.storage.get<number>("startTime")) || Date.now();
    
    return { votes, tallies, totalVotes, startTime };
  }
  
  private async submitVote(sessionId: string, selections: string[]): Promise<{ success: boolean; message: string }> {
    const state = await this.getState();
    
    if (state.votes.has(sessionId)) {
      return { success: false, message: "You have already voted" };
    }
    
    const validSelections = selections.filter(s => AI_TOOLS.includes(s));
    if (validSelections.length === 0) {
      return { success: false, message: "Please select at least one option" };
    }
    
    const vote: Vote = {
      sessionId,
      selections: validSelections,
      timestamp: Date.now()
    };
    
    state.votes.set(sessionId, vote);
    
    for (const selection of validSelections) {
      state.tallies.set(selection, (state.tallies.get(selection) || 0) + 1);
    }
    
    state.totalVotes++;
    
    await this.ctx.storage.put("votes", state.votes);
    await this.ctx.storage.put("tallies", state.tallies);
    await this.ctx.storage.put("totalVotes", state.totalVotes);
    
    this.broadcast({
      type: "update",
      data: {
        tallies: Object.fromEntries(state.tallies),
        totalVotes: state.totalVotes,
        onlineUsers: this.connections.size
      }
    });
    
    return { success: true, message: "Vote recorded successfully" };
  }
  
  private async resetSurvey(): Promise<void> {
    await this.ctx.storage.deleteAll();
    
    const freshTallies = new Map(AI_TOOLS.map(tool => [tool, 0]));
    await this.ctx.storage.put("tallies", freshTallies);
    await this.ctx.storage.put("votes", new Map());
    await this.ctx.storage.put("totalVotes", 0);
    await this.ctx.storage.put("startTime", Date.now());
    
    this.broadcast({
      type: "reset",
      data: {
        tallies: Object.fromEntries(freshTallies),
        totalVotes: 0,
        onlineUsers: this.connections.size
      }
    });
  }
  
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(messageStr);
      } catch (e) {
        console.error("Broadcast error:", e);
      }
    }
  }
  
  private broadcastUserCount(): void {
    this.broadcast({
      type: "userCount",
      data: {
        onlineUsers: this.connections.size
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === "/" || url.pathname === "/vote") {
      return env.ASSETS.fetch(request);
    }
    
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
      
      // Generate QR code for the custom domain
      const surveyUrl = "https://vote.aicloudrun.com/";
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
} satisfies ExportedHandler<Env>;