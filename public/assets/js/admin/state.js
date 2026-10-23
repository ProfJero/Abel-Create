// Shared dashboard state (kept apart from app.js to avoid import cycles).
export const state = { user: null, unread: 0, leaveGuard: null };

export function setUnread(n) {
  state.unread = n;
  dispatchEvent(new Event('admin:unread'));
}
