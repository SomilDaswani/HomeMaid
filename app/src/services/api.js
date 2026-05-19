// API service layer — all network calls live here.
// Components never call fetch/axios directly.

import axios from 'axios';
import { getSession } from './session';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach session_id to every request automatically
client.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session) config.headers['x-session-id'] = session;
  return config;
});

// ─── Maids ────────────────────────────────────────────────────────────────────

export const getNearbyMaids = (lat, lng, radiusMeters = 5000) =>
  client.get('/api/maids/nearby', { params: { lat, lng, radius: radiusMeters } })
    .then(r => r.data);

export const getMaid = (maidId) =>
  client.get(`/api/maids/${maidId}`).then(r => r.data);

export const getMaidReviews = (maidId) =>
  client.get(`/api/maids/${maidId}/reviews`).then(r => r.data);

export const getMaidAvailability = (maidId, date) =>
  client.get(`/api/maids/${maidId}/availability`, { params: { date } })
    .then(r => r.data);

// ─── Quick Service ─────────────────────────────────────────────────────────────

export const createQuickServiceRequest = (payload) =>
  client.post('/api/quick-service/request', payload).then(r => r.data);

export const getQuickServiceBids = (requestId) =>
  client.get(`/api/quick-service/${requestId}/bids`).then(r => r.data);

export const triggerMockBid = (requestId) =>
  client.post(`/api/quick-service/${requestId}/mock-bid`).then(r => r.data);

export const selectBid = (requestId, bidId) =>
  client.post(`/api/quick-service/${requestId}/select-bid`, { bid_id: bidId })
    .then(r => r.data);

export const updateQuickServiceStatus = (requestId, status) =>
  client.patch(`/api/quick-service/${requestId}/status`, { status })
    .then(r => r.data);

export const cancelQuickService = (requestId) =>
  client.post(`/api/quick-service/${requestId}/cancel`).then(r => r.data);

export const timeoutQuickService = (requestId) =>
  client.post(`/api/quick-service/${requestId}/timeout`).then(r => r.data);

// ─── Pricing ──────────────────────────────────────────────────────────────────

export const calculatePrice = (payload) =>
  client.post('/api/pricing/calculate', payload).then(r => r.data);

// ─── Matching ─────────────────────────────────────────────────────────────────

export const rankMaids = (payload) =>
  client.post('/api/matching/rank', payload).then(r => r.data);

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const createBooking = (payload) =>
  client.post('/api/bookings', payload).then(r => r.data);

export const getBooking = (bookingId) =>
  client.get(`/api/bookings/${bookingId}`).then(r => r.data);

export const updateBookingStatus = (bookingId, status) =>
  client.patch(`/api/bookings/${bookingId}/status`, { status })
    .then(r => r.data);

export const cancelBooking = (bookingId) =>
  client.post(`/api/bookings/${bookingId}/cancel`).then(r => r.data);

export const getHomeownerBookings = (sessionId) =>
  client.get(`/api/bookings/homeowner/${sessionId}`).then(r => r.data);

// ─── Voice ────────────────────────────────────────────────────────────────────

export const transcribeAudio = (audioBase64) =>
  client.post('/api/voice/transcribe', { audio: audioBase64 }).then(r => r.data);

export const transcribeAndParse = (audioBase64, mimeType = 'audio/m4a', sessionId = null, gpsArea = null) =>
  client.post('/api/voice/transcribe-and-parse', { audio: audioBase64, mimeType, sessionId, gps_area: gpsArea }).then(r => r.data);

export const extractIntent = (transcript, gpsArea = null) =>
  client.post('/api/voice/extract-intent', { transcript, gps_area: gpsArea }).then(r => r.data);

export const getClarifyingQuestion = (transcript, missingFields) =>
  client.post('/api/voice/clarify', { transcript, missing_fields: missingFields })
    .then(r => r.data);

// Re-runs intent extraction with a plain text string (for clarification follow-ups)
export const parseTextIntent = (text, sessionId, gpsArea = null) =>
  client.post('/api/voice/parse-text', { text, session_id: sessionId, gps_area: gpsArea })
    .then(r => r.data);

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const submitReview = (payload) =>
  client.post('/api/reviews', payload).then(r => r.data);

// ─── Disputes ─────────────────────────────────────────────────────────────────

export const fileDispute = (payload) =>
  client.post('/api/disputes', payload).then(r => r.data);

// ─── Notifications ────────────────────────────────────────────────────────────

export const getPendingNotifications = (sessionId) =>
  client.get('/api/notifications/pending', { params: { session_id: sessionId } })
    .then(r => r.data);

export const markNotificationRead = (notificationId) =>
  client.patch(`/api/notifications/${notificationId}/read`).then(r => r.data);

// ─── Agent Traces ─────────────────────────────────────────────────────────────

export const getSessionTraces = (sessionId) =>
  client.get(`/api/traces/session/${sessionId}`).then(r => r.data);

export const exportTraces = () =>
  client.get('/api/traces/export').then(r => r.data);
