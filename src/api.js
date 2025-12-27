// === MANRINA API CENTRALISÉE ===
// Préparation migration Airtable → PostgreSQL

const API_URL = '/api.php'

// === CACHE CONFIG ===
const CACHE_KEY = 'manrina_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const getCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return data
  } catch { return null }
}

export const setCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {}
}

export const clearCache = () => {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

// === HELPERS ===
const handleResponse = async (res) => {
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// === AUTH ===
export const checkSetup = () => 
  fetch(`${API_URL}?action=check_setup`).then(handleResponse)

export const login = (email, password) =>
  fetch(`${API_URL}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  }).then(handleResponse)

export const setup = (key, data) =>
  fetch(`${API_URL}?action=setup&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse)

export const createMember = (data) =>
  fetch(`${API_URL}?action=create_member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse)

export const changePassword = (userId, currentPassword, newPassword) =>
  fetch(`${API_URL}?action=change_password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, currentPassword, newPassword })
  }).then(handleResponse)

export const updateRole = (userId, role) =>
  fetch(`${API_URL}?action=update_role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role })
  }).then(handleResponse)

// === GENERIC CRUD ===
export const getAll = (table, options = {}) => {
  let url = `${API_URL}?table=${table}`
  if (options.sortField) url += `&sort_field=${options.sortField}`
  if (options.sortDirection) url += `&sort_direction=${options.sortDirection}`
  if (options.filterByFormula) url += `&filterByFormula=${encodeURIComponent(options.filterByFormula)}`
  return fetch(url).then(handleResponse)
}

export const getOne = (table, id) =>
  fetch(`${API_URL}?table=${table}&id=${id}`).then(handleResponse)

export const create = (table, fields) =>
  fetch(`${API_URL}?table=${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  }).then(handleResponse)

export const update = (table, id, fields) =>
  fetch(`${API_URL}?table=${table}&id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  }).then(handleResponse)

export const remove = (table, id) =>
  fetch(`${API_URL}?table=${table}&id=${id}`, { method: 'DELETE' }).then(handleResponse)

// === HELPERS FORMAT DATE ===
export const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const jour = date.getDate().toString().padStart(2, '0')
  const mois = (date.getMonth() + 1).toString().padStart(2, '0')
  const annee = date.getFullYear()
  return `${jour}/${mois}/${annee}`
}

export const formatTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const heures = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${heures}h${minutes}`
}

export const formatDateTime = (dateString) => {
  if (!dateString) return ''
  return `${formatDate(dateString)} à ${formatTime(dateString)}`
}

export const toAirtableDateTime = (dateStr, timeStr) => {
  if (!dateStr) return new Date().toISOString()
  const [year, month, day] = dateStr.split('-')
  const [hours, minutes] = timeStr ? timeStr.split(':') : ['12', '00']
  const date = new Date(year, month - 1, day, hours, minutes)
  return date.toISOString()
}

// === EMOJIS DISPONIBLES ===
export const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '➕', '➖', '🏪', '🚚', '🍳', '💰']
