const USER_KEY = 'vaultcore_user_profile';

// In-memory access token storage (never stored in localStorage/sessionStorage)
let inMemoryAccessToken = null;

export const setMemoryAccessToken = (token) => {
  inMemoryAccessToken = token || null;
};

export const getMemoryAccessToken = () => {
  return inMemoryAccessToken;
};

export const clearMemoryAccessToken = () => {
  inMemoryAccessToken = null;
};

const NOTIFICATIONS_READ_KEY = 'vaultcore_read_notifications';
const NOTIFICATIONS_READ_ALL_TIMESTAMP_KEY = 'vaultcore_read_all_timestamp';

export const notificationStorage = {
  getReadIds: () => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  },

  isRead: (notificationId, timestamp = null) => {
    if (!notificationId) return false;
    try {
      // 1. Check if individual ID was marked as read
      const readIds = notificationStorage.getReadIds();
      if (readIds.has(String(notificationId))) return true;

      // 2. Check if a global "mark all as read" happened after the notification was created
      const readAllTimestamp = localStorage.getItem(NOTIFICATIONS_READ_ALL_TIMESTAMP_KEY);
      if (readAllTimestamp) {
        if (!timestamp) return true;
        const notifTime = new Date(timestamp).getTime();
        const markAllTime = new Date(readAllTimestamp).getTime();
        if (!isNaN(notifTime) && !isNaN(markAllTime) && notifTime <= markAllTime + 1000) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  markAsRead: (notificationId) => {
    if (!notificationId) return;
    try {
      const readIds = notificationStorage.getReadIds();
      readIds.add(String(notificationId));
      localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(Array.from(readIds)));
    } catch (e) {
      console.error('Failed to mark notification as read in storage:', e);
    }
  },

  markAllAsRead: (notificationIds = []) => {
    try {
      const readIds = notificationStorage.getReadIds();
      notificationIds.forEach((id) => {
        if (id) readIds.add(String(id));
      });
      localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(Array.from(readIds)));
      localStorage.setItem(NOTIFICATIONS_READ_ALL_TIMESTAMP_KEY, new Date().toISOString());
    } catch (e) {
      console.error('Failed to mark all notifications as read in storage:', e);
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(NOTIFICATIONS_READ_KEY);
      localStorage.removeItem(NOTIFICATIONS_READ_ALL_TIMESTAMP_KEY);
    } catch {}
  },
};

export const storage = {
  // Persist only minimal user profile info: { id, email, firstName, lastName, role }
  getUser: () => {
    try {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setUser: (user) => {
    try {
      if (user) {
        const minimalProfile = {
          id: user.id || user.userId || user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(minimalProfile));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.error('Failed to persist user profile:', e);
    }
  },

  clearUser: () => {
    try {
      localStorage.removeItem(USER_KEY);
      notificationStorage.clear();
    } catch (e) {
      console.error('Failed to clear user profile:', e);
    }
  },

  clearAll: () => {
    try {
      localStorage.removeItem(USER_KEY);
      notificationStorage.clear();
      clearMemoryAccessToken();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
  },
};
