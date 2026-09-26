/**
 * API client for interacting with the SANKET FastAPI backend.
 * Binds active user identity (X-User-ID) to prevent impersonation.
 */

export const getBaseUrl = () => {
  const custom = localStorage.getItem('sanket_api_url');
  if (custom) return custom.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
};

export const setBaseUrl = (url) => {
  localStorage.setItem('sanket_api_url', url.replace(/\/+$/, ''));
};

export const getApiKey = () => {
  return localStorage.getItem('sanket_api_key') || 'sanket-admin-key-2026';
};

export const setApiKey = (key) => {
  localStorage.setItem('sanket_api_key', key);
};

export const getActiveUser = () => {
  return localStorage.getItem('sanket_active_user') || 'alice';
};

export const setActiveUser = (userId) => {
  localStorage.setItem('sanket_active_user', userId);
};

const getHeaders = (isFormData = false) => {
  const headers = {
    'X-API-KEY': getApiKey(),
    'X-User-ID': getActiveUser(),
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const api = {
  // ── 1. User Identity & Authentication (PART 1) ────────────────────────────
  async getUsers() {
    const res = await fetch(`${getBaseUrl()}/auth/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch users (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async login(userId) {
    const res = await fetch(`${getBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Login failed (${res.status})`);
    }
    const data = await res.json();
    setActiveUser(userId);
    return data.data || data;
  },

  async getCurrentUser() {
    const res = await fetch(`${getBaseUrl()}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch current user (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // ── 2. Document Distribution System (PART 2 & 3) ──────────────────────────
  async sendDocument(file, recipients, sender = null, filePath = null) {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (filePath) {
      formData.append('file_path', filePath);
    }
    formData.append('recipients', Array.isArray(recipients) ? recipients.join(',') : recipients);
    if (sender) {
      formData.append('sender', sender);
    }

    const res = await fetch(`${getBaseUrl()}/send?sync=true`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
        'X-User-ID': sender || getActiveUser(),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Send failed (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async getInbox(user = null) {
    const activeUid = user || getActiveUser();
    const res = await fetch(`${getBaseUrl()}/inbox?user=${encodeURIComponent(activeUid)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch inbox (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async getDocuments() {
    const res = await fetch(`${getBaseUrl()}/documents`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch documents (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async getDocument(docId) {
    const res = await fetch(`${getBaseUrl()}/documents/${encodeURIComponent(docId)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch document (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // ── 3. Core Decryption with Authorization & Watermarking ──────────────────
  async decrypt(packagePathOrDocId, user = null, sync = true) {
    const activeUid = user || getActiveUser();
    const res = await fetch(`${getBaseUrl()}/decrypt?sync=${sync}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
        'X-User-ID': activeUid,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_path: packagePathOrDocId,
        user: activeUid,
      }),
    });
    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Decryption failed (${res.status})`);
    }
    const data = await res.json();
    return { statusCode: res.status, ...data };
  },

  // ── 4. Leak Verification & Attribution ────────────────────────────────────
  async verify(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${getBaseUrl()}/verify`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
        'X-User-ID': getActiveUser(),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Verification failed (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // ── 5. Forensic Report ───────────────────────────────────────────────────
  async generateReport(file, sync = true) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${getBaseUrl()}/report?sync=${sync}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
        'X-User-ID': getActiveUser(),
      },
      body: formData,
    });
    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Report generation failed (${res.status})`);
    }
    const data = await res.json();
    return { statusCode: res.status, ...data };
  },

  // ── 6. Ledger & Multi-Signature Audit ─────────────────────────────────────
  async getLedger() {
    const res = await fetch(`${getBaseUrl()}/ledger`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch ledger (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async getLedgerBlocks() {
    const res = await fetch(`${getBaseUrl()}/ledger/blocks`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch ledger blocks (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // ── 7. System Status ──────────────────────────────────────────────────────
  async getStatus() {
    const res = await fetch(`${getBaseUrl()}/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch status (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  async getAuditEvents(limit = 50) {
    const res = await fetch(`${getBaseUrl()}/audit/events?limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch audit events (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // Helper for download URLs
  getDownloadUrl(type, identifier) {
    const base = getBaseUrl();
    const key = getApiKey();
    if (type === 'decrypted') {
      return `${base}/download/decrypted/${identifier}?api_key=${encodeURIComponent(key)}`;
    }
    if (type === 'report') {
      return `${base}/download/report/${identifier}?api_key=${encodeURIComponent(key)}`;
    }
    if (type === 'encrypted') {
      return `${base}/download/encrypted/${identifier}?api_key=${encodeURIComponent(key)}`;
    }
    return '#';
  },
};
