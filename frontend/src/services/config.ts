/// <reference types="vite/client" />

export function getWebSocketUrl(): string {
  // Use the same protocol and host as the current page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes port if non-standard
  return `${protocol}//${host}/ws`;
}
