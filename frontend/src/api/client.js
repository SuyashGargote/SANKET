/**
 * API client for interacting with the SANKET FastAPI backend.
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

const getHeaders = (isFormData = false) => {
  const headers = {
    'X-API-KEY': getApiKey(),
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export const api = {
  // 1. System Status
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

  // 2. Encrypt File
  async encrypt(file, recipients, sync = true) {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    formData.append('recipients', recipients);

    const res = await fetch(`${getBaseUrl()}/encrypt?sync=${sync}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
      },
      body: formData,
    });
    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Encryption failed (${res.status})`);
    }
    const data = await res.json();
    return { statusCode: res.status, ...data };
  },

  // 3. Decrypt File
  async decrypt(packagePath, user, sync = true) {
    const res = await fetch(`${getBaseUrl()}/decrypt?sync=${sync}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        package_path: packagePath,
        user: user,
      }),
    });
    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Decryption failed (${res.status})`);
    }
    const data = await res.json();
    return { statusCode: res.status, ...data };
  },

  // 4. Verify Leaked File
  async verify(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${getBaseUrl()}/verify`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
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

  // 5. Generate Forensic Report
  async generateReport(file, sync = true) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${getBaseUrl()}/report?sync=${sync}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': getApiKey(),
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

  // 6. Job Polling
  async getJob(jobId) {
    const res = await fetch(`${getBaseUrl()}/job/${jobId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch job (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 7. Ledger Verification
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

  // 8. SIH 1-Click Demo
  async runDemo() {
    const res = await fetch(`${getBaseUrl()}/demo-run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Demo execution failed (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 9. Ledger Explorer Blocks
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

  // 10. Shared Workflow - List Packages
  async getSharedPackages() {
    const res = await fetch(`${getBaseUrl()}/shared/packages`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch shared packages (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 11. Shared Workflow - List Decrypted Images
  async getSharedDecrypted() {
    const res = await fetch(`${getBaseUrl()}/shared/decrypted`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch shared decrypted files (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 12. Tamper Simulation - Modify Block 0
  async tamperModify() {
    const res = await fetch(`${getBaseUrl()}/ledger/tamper/modify`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to execute tamper modify (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 13. Tamper Simulation - Delete Block 1
  async tamperDelete() {
    const res = await fetch(`${getBaseUrl()}/ledger/tamper/delete`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to execute tamper delete (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 14. Tamper Simulation - Recompute Chain Hashes
  async tamperRecompute() {
    const res = await fetch(`${getBaseUrl()}/ledger/tamper/recompute`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to execute tamper recompute (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // 15. Tamper Simulation - Restore Pristine Ledger
  async tamperRestore() {
    const res = await fetch(`${getBaseUrl()}/ledger/tamper/restore`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to restore ledger (${res.status})`);
    }
    const data = await res.json();
    return data.data || data;
  },

  // Helper for download URLs with auth key
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
