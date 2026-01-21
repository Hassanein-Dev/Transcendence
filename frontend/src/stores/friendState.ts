import { getFriends, getFriendRequests } from "../services/api";

let onlineUsers = new Set<number>();

export interface Friend {
  id: number;
  username: string;
  picture?: string;  // Changed from avatarUrl to match backend
  avatarUrl?: string; // Keep for backward compatibility
  onlineStatus: 'online' | 'offline' | 'ingame' | 'away';
  friendsSince: string;
  relationship?: 'friend' | 'pending' | 'requested' | 'none';
}

export interface FriendRequest {
  id: number;
  username: string;
  picture?: string;  // Changed from avatarUrl to match backend
  avatarUrl?: string; // Keep for backward compatibility
  requestedAt: string;
  created_at?: string; // Alternative field name
}

type Subscriber = (state: { friends: Friend[], friendRequests: FriendRequest[] }) => void;

let friends: Friend[] = [];
let friendRequests: FriendRequest[] = [];
const subscribers: Subscriber[] = [];

export async function loadFriends() {
  const res = await getFriends();

  if (res.ok && res.body) {
    // Handle both response formats: { friends: [] } or direct array
    const data = res.body.friends || res.body.data || res.body;
    if (Array.isArray(data)) {
      friends = data.map(f => ({
        id: f.id,
        username: f.username,
        picture: f.picture || f.avatarUrl,
        onlineStatus: f.onlineStatus || (f.is_online ? 'online' : 'offline'),
        friendsSince: f.friendsSince || f.created_at,
        relationship: 'friend'
      }));
    } else {
      friends = [];
    }
    notifySubscribers();
  } else if (res.status === 401) {
    // User not authenticated - this is expected during logout/login transitions
    friends = [];
    notifySubscribers();
  } else {
    // Only log unexpected errors (not 401 or network issues)
    if (res.status !== 0) {
      // Status 0 typically means network error
    }
    friends = [];
  }
  return friends;
}

export async function loadFriendRequests() {
  const res = await getFriendRequests();

  if (res.ok && res.body) {
    // Handle both response formats: { requests: [] } or direct array
    const data = res.body.requests || res.body.data || res.body;
    if (Array.isArray(data)) {
      friendRequests = data.map(r => ({
        id: r.id,
        username: r.username,
        picture: r.picture || r.avatarUrl,
        avatarUrl: r.picture || r.avatarUrl, // Set both for compatibility
        requestedAt: r.requestedAt || r.created_at,
        created_at: r.requestedAt || r.created_at
      }));
    } else {
      friendRequests = [];
    }
    notifySubscribers();
  } else if (res.status === 401) {
    // User not authenticated - this is expected during logout/login transitions
    friendRequests = [];
    notifySubscribers();
  } else {
    // Silently handle other errors
    friendRequests = [];
  }
  return friendRequests;
}

export function getCurrentFriends(): Friend[] {
  return [...friends];
}

export function getCurrentFriendRequests(): FriendRequest[] {
  return [...friendRequests];
}

export function subscribe(fn: Subscriber) {
  subscribers.push(fn);
  // Call immediately with current state
  fn({ friends, friendRequests });
  return () => {
    const index = subscribers.indexOf(fn);
    if (index > -1) subscribers.splice(index, 1);
  };
}

function notifySubscribers() {
  const state = { friends, friendRequests };
  subscribers.forEach(fn => fn(state));
}

// Update friend online status (called from WebSocket)
export function updateFriendOnlineStatus(friendId: number, onlineStatus: 'online' | 'offline' | 'ingame' | 'away') {
  const friend = friends.find(f => f.id === friendId);
  if (friend) {
    friend.onlineStatus = onlineStatus;
    notifySubscribers();
  }
}

// Add new friend (when request accepted)
export function addFriend(friend: Friend) {
  if (!friends.find(f => f.id === friend.id)) {
    friends.push(friend);
    notifySubscribers();
  }
}

// Remove friend
export function removeFriend(friendId: number) {
  friends = friends.filter(f => f.id !== friendId);
  notifySubscribers();
}

// Add friend request
export function addFriendRequest(request: FriendRequest) {
  if (!friendRequests.find(r => r.id === request.id)) {
    friendRequests.push(request);
    notifySubscribers();
  }
}

// Remove friend request
export function removeFriendRequest(userId: number) {
  friendRequests = friendRequests.filter(r => r.id !== userId);
  notifySubscribers();
}

export function setUserOnline(userId: number) {
  onlineUsers.add(userId);
  updateFriendStatus(userId, 'online');
}

export function setUserOffline(userId: number) {
  onlineUsers.delete(userId);
  updateFriendStatus(userId, 'offline');
}

export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId);
}

function updateFriendStatus(friendId: number, status: 'online' | 'offline') {
  const friend = friends.find(f => f.id === friendId);
  if (friend) {
    friend.onlineStatus = status;
    notifySubscribers();
  }
}

// Initialize friend state
export async function initializeFriendState() {
  await Promise.all([
    loadFriends(),
    loadFriendRequests()
  ]);
  return { friends, friendRequests };
}