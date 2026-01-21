import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me_in_production";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || "https://10.11.5.4:8443/api/oauth/github/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://10.11.5.4:8443";

export default async function oauthRoutes(fastify: FastifyInstance) {
  // Store OAuth states in memory
  const oauthStates = new Map();

  // Get OAuth configuration
  fastify.get("/oauth/config", async (request: FastifyRequest, reply: FastifyReply) => {
    const githubEnabled = !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
    
    return reply.send({
      github: {
        enabled: githubEnabled,
        clientId: githubEnabled ? GITHUB_CLIENT_ID : null,
        redirectUri: GITHUB_REDIRECT_URI
      }
    });
  });

  // Initiate GitHub OAuth flow
  fastify.get("/oauth/github", async (request: FastifyRequest<{Querystring:{state?:string}}>, reply: FastifyReply) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return reply.status(501).send({ 
        error: "GitHub OAuth not configured",
        message: "Please configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables"
      });
    }

    // Use provided state from frontend or generate new one
    let state = request.query.state;
    if (!state) {
      state = generateRandomString(32);
    }
    
    // Store state with timestamp (valid for 10 minutes)
    oauthStates.set(state, { 
      timestamp: Date.now(),
      ip: request.ip 
    });
    
    const scope = "user:email";
    
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("allow_signup", "true");

    return reply.redirect(authUrl.toString());
  });

  // GitHub OAuth callback
  fastify.get("/oauth/github/callback", async (request: FastifyRequest<{ 
    Querystring: { code?: string, state?: string, error?: string, error_description?: string } 
  }>, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query;

    if (error) {
      const frontendUrl = `${FRONTEND_URL}/oauth-success#error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || '')}`;
      return reply.redirect(frontendUrl);
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      const frontendUrl = `${FRONTEND_URL}/oauth-success#error=server_not_configured`;
      return reply.redirect(frontendUrl);
    }

    if (!code || !state) {
      const frontendUrl = `${FRONTEND_URL}/oauth-success#error=missing_parameters&code=${!!code}&state=${!!state}`;
      return reply.redirect(frontendUrl);
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      const frontendUrl = `${FRONTEND_URL}/oauth-success#error=invalid_state`;
      return reply.redirect(frontendUrl);
    }

    // Clean up used state
    oauthStates.delete(state);

    try {
      
      // Exchange code for access token
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      const accessToken = tokenData.access_token;

      // Get user info from GitHub
      const [userResponse, emailResponse] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/vnd.github.v3+json",
          },
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/vnd.github.v3+json",
          },
        })
      ]);

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        throw new Error(`GitHub API error: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      const emails = await emailResponse.json();
      
      // Find primary email
      const primaryEmail = emails.find((email: any) => email.primary && email.verified) || emails[0];

      // Find or create user
      let user = db.prepare("SELECT * FROM users WHERE github_id = ? OR email = ?").get(userData.id, primaryEmail?.email);
      
      if (!user) {
        const username = await generateUniqueUsername(userData.login);
        const email = primaryEmail?.email || `${userData.id}@github.user`;
        
        const result = db.prepare(`
          INSERT INTO users (username, email, github_id, picture, created_at, stats_reset_at) 
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(username, email, userData.id, userData.avatar_url);

        user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      } else if (!user.github_id) {
        db.prepare("UPDATE users SET github_id = ? WHERE id = ?").run(userData.id, user.id);
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Redirect to frontend with success
      const frontendUrl = `${FRONTEND_URL}/oauth-success#token=${token}&username=${encodeURIComponent(user.username)}`;
      return reply.redirect(frontendUrl);

    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      const frontendUrl = `${FRONTEND_URL}/oauth-success#error=authentication_failed&message=${encodeURIComponent(errorMessage)}`;
      return reply.redirect(frontendUrl);
    }
  });

  // Clean up expired states periodically
  setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStates.entries()) {
      if (now - data.timestamp > 10 * 60 * 1000) {
        oauthStates.delete(state);
      }
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
}

// Helper functions
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateUniqueUsername(baseUsername: string): Promise<string> {
  let username = baseUsername.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
  let counter = 1;
  const originalUsername = username;
  
  while (true) {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (!existing) {
      return username;
    }
    username = `${originalUsername}${counter}`;
    counter++;
    
    if (counter > 100) {
      username = `${originalUsername}_${Date.now()}`;
      break;
    }
  }
  return username;
}