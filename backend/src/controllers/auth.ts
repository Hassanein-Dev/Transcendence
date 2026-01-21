import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";

// Dynamic requires for packages
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// --- SMTP Configuration Check ---
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  identifier: string;
  password: string;
  code?: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // 1. Configure Email Transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587"),
    secure: parseInt(SMTP_PORT || "587") === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Simple in-memory rate limiter for login attempts
  const loginAttempts: Record<string, { attempts: number; lastAttempt: number; blockedUntil?: number }> = {};
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; 
  const BLOCK_MS = 10 * 60 * 1000;
  // Create a unique "ID card" for the current visitor.
  function rateKey(request: FastifyRequest, identifier?: string) {
    const ip = (request.ip || (request.headers['x-forwarded-for'] as string) || 'unknown').toString();
    return `${identifier || 'anon'}::${ip}`;
  }

  function checkRateLimit(key: string) {
    const now = Date.now();
    const record = loginAttempts[key];
    if (!record) return { ok: true };
    if (record.blockedUntil && record.blockedUntil > now) {
      return { ok: false, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    if (now - record.lastAttempt > WINDOW_MS) {
      delete loginAttempts[key];
      return { ok: true };
    }
    return { ok: true };
  }

  function recordFailedAttempt(key: string) {
    const now = Date.now();
    const rec = loginAttempts[key] || { attempts: 0, lastAttempt: now };
    rec.attempts = (rec.attempts || 0) + 1;
    rec.lastAttempt = now;
    if (rec.attempts >= MAX_ATTEMPTS) {
      rec.blockedUntil = now + BLOCK_MS;
    }
    loginAttempts[key] = rec;
  }

  function resetAttempts(key: string) {
    delete loginAttempts[key];
  }

  // Register user
  fastify.post<{ Body: RegisterBody }>(
    "/register",
    async (request, reply) => {
      const { username, email, password } = request.body;

      if (!username || !email || !password || typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
        return reply.status(400).send({ error: "Username email and password required" });
      }

      if (username.trim().length < 3 || password.length < 6) {
        return reply.status(400).send({
          error: "Username must be at least 3 characters and password at least 6 characters"
        });
      }

      try {
        const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim());
        if (existingUser) {
          return reply.status(400).send({ error: "Username already exists" });
        }
        const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim());
        if (existingEmail) {
          return reply.status(400).send({ error: "Email already exists" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = db.prepare(`
          INSERT INTO users (username, email, password_hash, created_at, stats_reset_at) 
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).run(username.trim(), email.trim(), passwordHash);

        const userId = result.lastInsertRowid;

        const token = jwt.sign(
          { userId, username: username.trim() },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return reply.send({
          token,
          user: {
            id: userId,
            username: username.trim(),
            created_at: new Date().toISOString()
          }
        });

      } catch (error) {
        return reply.status(500).send({ error: "Internal server error during registration" });
      }
    }
  );

  // Login user
  fastify.post<{ Body: LoginBody }>(
    "/login",
    async (request, reply) => {
      const { identifier, password, code } = request.body;

      if (!identifier || !password || typeof identifier !== "string" || typeof password !== "string") {
        return reply.status(400).send({ error: "Identifier and password required" });
      }

      const key = rateKey(request, identifier.trim());
      const rateCheck = checkRateLimit(key);
      if (!rateCheck.ok) {
        return reply.status(429).send({ error: "Too many attempts, try later" });
      }

      try {
        const user = db.prepare(`
        SELECT * FROM users 
        WHERE (username = ? OR email = ?) AND deleted = 0
      `).get(identifier.trim(), identifier.trim());

        if (!user) {
          return reply.status(400).send({ error: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          recordFailedAttempt(key);
          return reply.status(400).send({ error: "Invalid credentials" });
        }

        if (user.two_factor_enabled) {
          if (!code) {
            return reply.send({
              requires2FA: true,
              userId: user.id
            });
          }

          const { twoFactorService } = require("../services/twoFactorService");
          const verified = await twoFactorService.verifyToken(user.id, code);

          if (!verified) {
            recordFailedAttempt(key);
            return reply.status(401).send({ error: "Invalid 2FA code" });
          }
        }

        const token = jwt.sign(
          { userId: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        resetAttempts(key);

        return reply.send({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            twoFactorEnabled: !!user.two_factor_enabled
          }
        });

      } catch (error) {
        return reply.status(500).send({ error: "Internal server error during login" });
      }
    }
  );

  // Get current user
  fastify.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      const user = db.prepare(`
      SELECT 
        id, username, email, picture, fullname, bio, birthday, status, 
        lives_in, from_place, gender, education, phone, created_at, two_factor_enabled
      FROM users 
      WHERE id = ? AND deleted = 0
    `).get(decoded.userId);

      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }

      return reply.send({
        ...user,
        twoFactorEnabled: !!user.two_factor_enabled
      });

    } catch (error) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
  });

  // Request password reset (generate token and SEND EMAIL)
  fastify.post('/password-reset/request', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Force load env vars to be safe
      require('dotenv').config(); 
      
      const email = (request.body as any)?.email;
      
      if (!email || typeof email !== 'string') return reply.status(400).send({ error: 'Email required' });

      // Check if user exists
      const user = db.prepare('SELECT id, email, username FROM users WHERE email = ? AND deleted = 0').get(email.trim());
      
      // If user is null, we stop here
      if (!user) {
        return reply.send({ ok: true, message: "If that email exists, a reset code has been sent." });
      }

      // Generate a 6-digit numeric token (OTP style)
      const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      const tokenHash = await bcrypt.hash(token, 10);
      const expiresAt = new Date(Date.now() + (60 * 60 * 1000)).toISOString();

      // Store in DB
      db.prepare(`INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))`).run(user.id, tokenHash, expiresAt);

      // Send Email
      try {
        const mailOptions = {
          from: process.env.SMTP_FROM || process.env.SMTP_USER, // Fallback to user if FROM is missing
          to: user.email,
          subject: 'Password Reset Request',
          html: `Your reset code is: <b>${token}</b>`
        };

        // Re-initialize transporter inside the route to ensure it picks up the latest ENV vars
        const activeTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await activeTransporter.sendMail(mailOptions);
      } catch (emailError) {
      }

      return reply.send({ ok: true, message: "If that email exists, a reset code has been sent." });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Confirm password reset with token
  fastify.post('/password-reset/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token, newPassword } = request.body as any;
      if (!token || !newPassword || typeof token !== 'string' || typeof newPassword !== 'string') {
        return reply.status(400).send({ error: 'Token and newPassword required' });
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      // Find candidate reset records (not expired)
      const now = new Date().toISOString();
      const rows = db.prepare('SELECT id, user_id, token_hash, expires_at FROM password_resets WHERE expires_at >= ?').all(now);
      
      for (const row of rows) {
        // Compare the raw token sent by user with the hash in DB
        const match = await bcrypt.compare(token, row.token_hash);
        if (match) {
          // Update password
          const newHash = await bcrypt.hash(newPassword, 10);
          db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, row.user_id);
          
          // Delete ALL reset rows for this user (consumes the token)
          db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
          
          return reply.send({ ok: true });
        }
      }

      return reply.status(400).send({ error: 'Invalid or expired token' });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}