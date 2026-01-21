import { chatService } from '../../services/socket';
import { RemotePongGame } from './remotePongGame';
import { getCurrentUser } from '../../stores/authState';

export class RemoteGameInvite {
  private pendingInvites: Map<string, any> = new Map();

  constructor() {
    this.setupInviteHandlers();
  }

  // Send game invitation to a user
  sendInvite(targetUserId: string, targetUsername: string) {
    const user = getCurrentUser();
    if (!user) return;

    const inviteId = `invite_${Date.now()}`;

    this.pendingInvites.set(inviteId, {
      fromUserId: user.id,
      fromUsername: user.username,
      targetUserId,
      timestamp: Date.now()
    });

    chatService.send({
      type: 'GAME_INVITE',
      targetUserId,
      inviteId,
      gameType: 'remote_pong'
    });

    this.showSentInviteModal(targetUsername);
  }

  // Handle incoming game invitations
  private setupInviteHandlers() {
    // NOTE: Game invites are now handled by the chat component
    // This old implementation is disabled to prevent conflicts

    /* DISABLED - Now handled by chat.ts
    chatService.onMessage((data) => {
      switch (data.type) {
        case 'GAME_INVITE_RECEIVED':
          this.handleIncomingInvite(data);
          break;
        case 'GAME_INVITE_ACCEPTED':
          this.handleInviteAccepted(data);
          break;
        case 'GAME_INVITE_DECLINED':
          this.handleInviteDeclined(data);
          break;
      }
    });
    */
  }

  private handleIncomingInvite(data: any) {
    this.showIncomingInviteModal(data);
  }

  private showIncomingInviteModal(inviteData: any) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.setAttribute('data-invite-modal', 'incoming');

    const box = document.createElement('div');
    box.className = 'bg-slate-800 rounded-lg p-6 w-96';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold mb-4';
    title.textContent = '🎮 Game Invitation';

    const p = document.createElement('p');
    p.className = 'text-slate-300 mb-4';
    const strong = document.createElement('strong');
    strong.textContent = inviteData.fromUsername;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(' invited you to play Pong!'));

    const actions = document.createElement('div');
    actions.className = 'flex gap-3';
    const acceptBtn = document.createElement('button');
    acceptBtn.id = 'acceptInvite';
    acceptBtn.className = 'flex-1 px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500';
    acceptBtn.textContent = 'Accept';
    const declineBtn = document.createElement('button');
    declineBtn.id = 'declineInvite';
    declineBtn.className = 'flex-1 px-4 py-2 bg-slate-600 rounded hover:bg-slate-500';
    declineBtn.textContent = 'Decline';

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    box.appendChild(title);
    box.appendChild(p);
    box.appendChild(actions);
    modal.appendChild(box);
    document.body.appendChild(modal);

    acceptBtn.addEventListener('click', () => {
      chatService.send({
        type: 'GAME_INVITE_RESPONSE',
        inviteId: inviteData.inviteId,
        response: 'accepted'
      });
      modal.remove();
      this.startRemoteGame(inviteData.fromUserId, false);
    });

    declineBtn.addEventListener('click', () => {
      chatService.send({
        type: 'GAME_INVITE_RESPONSE',
        inviteId: inviteData.inviteId,
        response: 'declined'
      });
      modal.remove();
    });
  }

  private showSentInviteModal(username: string) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.setAttribute('data-invite-modal', 'sent');

    const box = document.createElement('div');
    box.className = 'bg-slate-800 rounded-lg p-6 w-96';
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold mb-4';
    title.textContent = '⏳ Invitation Sent';
    const p = document.createElement('p');
    p.className = 'text-slate-300';
    p.appendChild(document.createTextNode('Waiting for '));
    const strong = document.createElement('strong');
    strong.textContent = username;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(' to accept your game invitation...'));

    box.appendChild(title);
    box.appendChild(p);
    modal.appendChild(box);
    document.body.appendChild(modal);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 10000);
  }

  private handleInviteAccepted(data: any) {
    // Remove pending invite modal(s) marked as sent
    document.querySelectorAll('[data-invite-modal="sent"]').forEach(modal => modal.remove());
    this.startRemoteGame(data.fromUserId, true);
  }

  private handleInviteDeclined(data: any) {
    // Remove pending invite modal(s) marked as sent
    document.querySelectorAll('[data-invite-modal="sent"]').forEach(modal => modal.remove());
    alert('Your game invitation was declined.');
  }

  private startRemoteGame(opponentId: string, isHost: boolean) {
    // This would navigate to the game page with remote game parameters

    // For now, just show an alert - we'll integrate with the game page next
    alert(`Remote game ${isHost ? 'hosted' : 'joined'}! Ready to play against opponent.`);
  }
}

export const remoteGameInvite = new RemoteGameInvite();