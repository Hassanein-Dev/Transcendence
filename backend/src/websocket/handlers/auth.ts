import jwt from 'jsonwebtoken';
import { activeConnections, userConnections } from '../router';
import { notifyFriendsOfStatusChange } from './status';
import { updateUserOnlineStatus } from './status';


const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me_in_production";

export function handleAuthentication(clientId: string, token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const connection = activeConnections.get(clientId);
    
    if (connection) {
      const userIdStr = decoded.userId.toString();

      connection.user = {
        id: decoded.userId,
        username: decoded.username
      };
      connection.userId = decoded.userId;
      
      // Track user connections
      if (!userConnections.has(userIdStr)) {
        userConnections.set(userIdStr, new Set());
      }
      userConnections.get(userIdStr)!.add(clientId);
      updateUserOnlineStatus(decoded.userId, true);
      
      // Notify client of successful auth
      connection.ws.send(JSON.stringify({
        type: 'AUTHENTICATED',
        userId: connection.userId,
        user: connection.user
      }));
      
      // Broadcast online status
      notifyFriendsOfStatusChange(connection.userId, 'online');
    }
  } catch (error) {
    const connection = activeConnections.get(clientId);
    if (connection) {
      connection.ws.send(JSON.stringify({
        type: 'AUTH_ERROR',
        message: 'Invalid token'
      }));
    }
  }
}