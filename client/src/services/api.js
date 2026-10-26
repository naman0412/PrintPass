const BASE_URL = '/api';

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
};

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async register(userData) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`);
    return handleResponse(res);
  },

  async logout() {
    const res = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
    return handleResponse(res);
  },

  // Shops
  async getShops() {
    const res = await fetch(`${BASE_URL}/shops`);
    return handleResponse(res);
  },

  async getShop(shopId) {
    const res = await fetch(`${BASE_URL}/shops/${shopId}`);
    return handleResponse(res);
  },

  async getShopDashboard(shopId) {
    const res = await fetch(`${BASE_URL}/shops/${shopId}/dashboard`);
    return handleResponse(res);
  },

  async updateShopSettings(shopId, data) {
    const res = await fetch(`${BASE_URL}/shops/${shopId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getAgentKey(shopId) {
    const res = await fetch(`${BASE_URL}/shops/${shopId}/agent-key`);
    return handleResponse(res);
  },

  // Files
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData
    });
    return handleResponse(res);
  },

  // Jobs
  async getQuote(shopId, pageCount, options) {
    const res = await fetch(`${BASE_URL}/jobs/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, pageCount, options })
    });
    return handleResponse(res);
  },

  async getSlots(shopId, date, requiredPages = 1) {
    const res = await fetch(
      `${BASE_URL}/jobs/slots?shopId=${shopId}&date=${date || ''}&requiredPages=${requiredPages}`
    );
    return handleResponse(res);
  },

  async holdSlot(shopId, slotStart, slotEnd, pages) {
    const res = await fetch(`${BASE_URL}/jobs/hold-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, slotStart, slotEnd, pages })
    });
    return handleResponse(res);
  },

  async createJob(jobData) {
    const res = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });
    return handleResponse(res);
  },

  async getMyJobs() {
    const res = await fetch(`${BASE_URL}/jobs/my`);
    return handleResponse(res);
  },

  async getJob(id) {
    const res = await fetch(`${BASE_URL}/jobs/${id}`);
    return handleResponse(res);
  },

  async cancelJob(id) {
    const res = await fetch(`${BASE_URL}/jobs/${id}/cancel`, {
      method: 'POST'
    });
    return handleResponse(res);
  },

  // Shop Queue
  async getShopQueue(status) {
    const res = await fetch(`${BASE_URL}/jobs/shop/queue${status ? `?status=${status}` : ''}`);
    return handleResponse(res);
  },

  async updateJobStatus(jobId, status, reason = '') {
    const res = await fetch(`${BASE_URL}/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    return handleResponse(res);
  },

  async verifyPickup(code) {
    const res = await fetch(`${BASE_URL}/jobs/verify-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    return handleResponse(res);
  },

  // Payments
  async createPaymentOrder(jobId, idempotencyKey) {
    const res = await fetch(`${BASE_URL}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, idempotencyKey })
    });
    return handleResponse(res);
  },

  async verifyPayment(orderId, paymentId, signature) {
    const res = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, paymentId, signature })
    });
    return handleResponse(res);
  }
};
