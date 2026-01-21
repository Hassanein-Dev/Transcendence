import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { twoFactorService } from "../services/twoFactorService";
import db from "../models";

interface Enable2FABody {
  userId: number;
}

interface Verify2FABody {
  userId: number;
  token: string;
}

interface Disable2FABody {
  userId: number;
  token?: string;
}

export default async function twoFactorRoutes(fastify: FastifyInstance) {
  // Start 2FA setup - generate secret and QR code
  fastify.post<{ Body: Enable2FABody }>("/2fa/enable", async (request, reply) => {
    const { userId } = request.body;

    try {
      // Get user info for QR code
      const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const secretData = await twoFactorService.generateSecret(userId, user.username);
      
      // Generate QR code as data URL
      const QRCode = await import('qrcode');
      const qrCodeDataUrl = await QRCode.toDataURL(secretData.qrCodeUrl);

      return reply.send({
        qrCodeUrl: qrCodeDataUrl,
        message: "Scan the QR code with your authenticator app"
      });
    } catch (error) {
      return reply.status(500).send({ error: "Failed to enable 2FA" });
    }
  });

  // Verify token and enable 2FA
  fastify.post<{ Body: Verify2FABody }>("/2fa/verify", async (request, reply) => {
    const { userId, token } = request.body;

    try {
      const verified = await twoFactorService.verifyAndEnable2FA(userId, token);
      
      if (verified) {
        return reply.send({ 
          success: true, 
          message: "2FA enabled successfully" 
        });
      } else {
        return reply.status(400).send({ error: "Invalid verification code" });
      }
    } catch (error) {
      return reply.status(500).send({ error: "Failed to verify 2FA" });
    }
  });

  // (Removed) prompt endpoint — frontend will show the disable code input directly.

  // Disable 2FA (requires token) - verifies token and disables if valid
  fastify.post<{ Body: Disable2FABody }>("/2fa/disable", async (request, reply) => {
    const { userId, token } = request.body;

    try {
      if (!userId) return reply.status(400).send({ error: 'Missing userId' });
      if (!token) return reply.status(400).send({ error: 'Missing 2FA token' });

      const ok = await twoFactorService.disable2FA(userId, token);
      if (!ok) {
        return reply.status(400).send({ error: 'Invalid 2FA token' });
      }

      return reply.send({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to disable 2FA' });
    }
  });

  // Check if 2FA is enabled
  fastify.get("/2fa/status/:userId", async (request: FastifyRequest<{ Params: { userId: string } }>, reply) => {
    const userId = parseInt(request.params.userId);

    try {
      const isEnabled = twoFactorService.is2FAEnabled(userId);
      return reply.send({ enabled: isEnabled });
    } catch (error) {
      return reply.status(500).send({ error: "Failed to get 2FA status" });
    }
  });

  // Verify 2FA token during login
  fastify.post<{ Body: { userId: number; token: string } }>("/2fa/verify-login", async (request, reply) => {
    const { userId, token } = request.body;

    try {
      const verified = await twoFactorService.verifyToken(userId, token);
      
      if (verified) {
        return reply.send({ success: true });
      } else {
        return reply.status(400).send({ error: "Invalid 2FA code" });
      }
    } catch (error) {
      return reply.status(500).send({ error: "Failed to verify 2FA code" });
    }
  });
}