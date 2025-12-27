import { useState, useEffect, useMemo, useCallback } from 'react'

const API_URL = '/api.php'
const CACHE_KEY = 'manrina_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '💰', '🎯', '📊', '🔒', '🏪', '🚚', '🍳', '🛵', '🎪']

// === HELPERS ===
const formatMoney = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n) + ' €'
const formatDateTime = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}h${date.getMinutes().toString().padStart(2,'0')}`
}
const formatDateFull = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()}`
}

// === CACHE ===
const getCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_DURATION) return null
    return data
  } catch { return null }
}
const setCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {}
}
const clearCache = () => localStorage.removeItem(CACHE_KEY)

function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [setupKey, setSetupKey] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  
  // App
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  // Data
  const [caisses, setCaisses] = useState([])
  const [categories, setCategories] = useState({ entree: [], sortie: [] })
  const [transactions, setTransactions] = useState([])
  const [team, setTeam] = useState([])
  const [currentCaisse, setCurrentCaisse] = useState(null)
  
  // UI
  const [modal, setModal] = useState({ type: null, data: null })
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPrevues, setShowPrevues] = useState(true)
  
  // Forms
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [setupForm, setSetupForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  
  // Filters
  const [filters, setFilters] = useState({ period: 'tout', search: '' })

  // === INIT ===
  useEffect(() => {
    (async () => {
      setAuthLoading(true)
      try {
        const res = await fetch(`${API_URL}?action=check_setup`)
        const result = await res.json()
        setSetupComplete(result.setupComplete)
        
        if (!result.setupComplete) {
          const key = new URLSearchParams(window.location.search).get('key')
          if (key) { setSetupKey(key); setShowSetup(true) }
        }
        
        const saved = localStorage.getItem('manrina_user')
        if (saved) {
          setCurrentUser(JSON.parse(saved))
          setIsLoggedIn(true)
        }
      } catch (e) { console.error('Auth error:', e) }
      setAuthLoading(false)
    })()
  }, [])

  useEffect(() => { if (isLoggedIn) loadData() }, [isLoggedIn])

  const loadData = async (forceRefresh = false) => {
    // Essayer le cache d'abord
    if (!forceRefresh) {
      const cached = getCache()
      if (cached) {
        setCaisses(cached.caisses)
        setCategories(cached.categories)
        setTransactions(cached.transactions)
        setTeam(cached.team)
        if (!currentCaisse && cached.caisses.length > 0) setCurrentCaisse(cached.caisses[0].id)
        setLoading(false)
        // Refresh en background
        loadFromAPI(true)
        return
      }
    }
    
    setLoading(true)
    await loadFromAPI(false)
    setLoading(false)
  }

  const loadFromAPI = async (silent = false) => {
    try {
      const [teamRes, catRes, transRes, caissesRes] = await Promise.all([
        fetch(`${API_URL}?table=Equipe`),
        fetch(`${API_URL}?table=Categories`),
        fetch(`${API_URL}?table=Transactions&sort_field=Date&sort_direction=desc`),
        fetch(`${API_URL}?table=Caisses`)
      ])
      
      const [teamData, catData, transData, caissesData] = await Promise.all([
        teamRes.json(), catRes.json(), transRes.json(), caissesRes.json()
      ])
      
      const parsedTeam = teamData.records?.map(r => ({
        id: r.id, name: r.fields.Nom || '', email: r.fields.Email || '', role: r.fields.Role || 'membre'
      })) || []
      
      const parsedCaisses = caissesData.records?.map(r => ({
        id: r.id, nom: r.fields.Nom || '', description: r.fields.Description || '', icon: r.fields.Icon || '💰'
      })) || []
      
      const parsedCats = { entree: [], sortie: [] }
      catData.records?.forEach(r => {
        const type = r.fields.Type || 'sortie'
        parsedCats[type].push({ id: r.id, label: r.fields.Label || '', icon: r.fields.Icon || '📦' })
      })
      
      const parsedTrans = transData.records?.map(r => ({
        id: r.id, type: r.fields.Type || 'sortie', category: r.fields.Categorie?.[0] || '',
        amount: r.fields.Montant || 0, reason: r.fields.Motif || '', user: r.fields.Utilisateur?.[0] || '',
        date: r.fields.Date || '', note: r.fields.Note || '', caisse: r.fields.Caisse?.[0] || '',
        statut: r.fields.Statut || 'effectuee'
      })) || []
      
      setTeam(parsedTeam)
      setCaisses(parsedCaisses)
      setCategories(parsedCats)
      setTransactions(parsedTrans)
      
      // Cache
      setCache({ team: parsedTeam, caisses: parsedCaisses, categories: parsedCats, transactions: parsedTrans })
      
      if (!currentCaisse && parsedCaisses.length > 0) setCurrentCaisse(parsedCaisses[0].id)
    } catch (e) { console.error('Load error:', e) }
  }

  const refreshData = async () => {
    clearCache()
    await loadData(true)
  }

  // === COMPUTED ===
  const currentCaisseData = useMemo(() => caisses.find(c => c.id === currentCaisse), [caisses, currentCaisse])
  
  const caisseTransactions = useMemo(() => 
    currentCaisse ? transactions.filter(t => t.caisse === currentCaisse) : transactions
  , [transactions, currentCaisse])

  const filteredTransactions = useMemo(() => {
    let filtered = [...caisseTransactions]
    const now = new Date()
    
    if (filters.period === 'jour') {
      const today = now.toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] === today)
    } else if (filters.period === 'semaine') {
      const d = new Date(now - 7*24*60*60*1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= d)
    } else if (filters.period === 'mois') {
      const d = new Date(now - 30*24*60*60*1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= d)
    }
    
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(t => t.reason.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q))
    }
    
    if (!showPrevues) {
      filtered = filtered.filter(t => t.statut !== 'prevue')
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [caisseTransactions, filters, showPrevues])

  const transEffectuees = useMemo(() => caisseTransactions.filter(t => t.statut !== 'prevue'), [caisseTransactions])
  const transPrevues = useMemo(() => caisseTransactions.filter(t => t.statut === 'prevue'), [caisseTransactions])

  const soldeEffectif = useMemo(() => {
    const e = transEffectuees.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0)
    const s = transEffectuees.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0)
    return e - s
  }, [transEffectuees])

  const soldePrevisionnel = useMemo(() => {
    const eP = transPrevues.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0)
    const sP = transPrevues.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0)
    return soldeEffectif + eP - sP
  }, [soldeEffectif, transPrevues])

  const totaux = useMemo(() => ({
    entrees: filteredTransactions.filter(t => t.type === 'entree' && t.statut !== 'prevue').reduce((s, t) => s + t.amount, 0),
    sorties: filteredTransactions.filter(t => t.type === 'sortie' && t.statut !== 'prevue').reduce((s, t) => s + t.amount, 0)
  }), [filteredTransactions])

  const orphanTransactions = useMemo(() => {
    const ids = caisses.map(c => c.id)
    return transactions.filter(t => !t.caisse || !ids.includes(t.caisse))
  }, [transactions, caisses])

  // === HELPERS ===
  const getUserName = (id) => team.find(u => u.id === id)?.name || '?'
  const getCatInfo = (id, type) => categories[type]?.find(c => c.id === id) || { label: '?', icon: '❓' }
  const getTransCount = (caisseId) => transactions.filter(t => t.caisse === caisseId).length
  
  const getCurrentUserId = useCallback(() => {
    if (!currentUser) return team[0]?.id
    const byId = team.find(t => t.id === currentUser.id)
    if (byId) return byId.id
    const byEmail = team.find(t => t.email === currentUser.email)
    if (byEmail) return byEmail.id
    return team[0]?.id
  }, [currentUser, team])

  // === AUTH ===
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const result = await res.json()
      
      if (result.success) {
        localStorage.setItem('manrina_user', JSON.stringify(result.user))
        setCurrentUser(result.user)
        setIsLoggedIn(true)
      } else {
        setError(result.error || 'Identifiants incorrects')
      }
    } catch (e) { setError('Erreur connexion') }
    setSaving(false)
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    setError('')
    if (setupForm.password !== setupForm.confirmPassword) { setError('Mots de passe différents'); return }
    if (setupForm.password.length < 8) { setError('8 caractères minimum'); return }
    
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}?action=setup&key=${setupKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: setupForm.nom, email: setupForm.email, password: setupForm.password })
      })
      const result = await res.json()
      
      if (result.success) {
        setSetupComplete(true)
        setShowSetup(false)
        window.history.replaceState({}, document.title, window.location.pathname)
        alert('✅ Compte créé !')
      } else { setError(result.error) }
    } catch (e) { setError('Erreur setup') }
    setSaving(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('manrina_user')
    clearCache()
    setCurrentUser(null)
    setIsLoggedIn(false)
  }

  // === ACTIONS ===
  const saveTransaction = async (data) => {
    setSaving(true)
    const [y, m, d] = data.date.split('-')
    const [h, min] = (data.time || '12:00').split(':')
    const dateISO = new Date(y, m-1, d, h, min).toISOString()
    
    const fields = {
      Motif: data.reason,
      Montant: parseFloat(data.amount),
      Type: data.type,
      Categorie: [data.category],
      Utilisateur: [data.user],
      Date: dateISO,
      Note: data.note || '',
      Caisse: [currentCaisse],
      Statut: data.statut || 'effectuee'
    }
    
    try {
      const url = data.id ? `${API_URL}?table=Transactions&id=${data.id}` : `${API_URL}?table=Transactions`
      await fetch(url, {
        method: data.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
      await refreshData()
      setModal({ type: null, data: null })
    } catch (e) {
      alert('❌ Erreur sauvegarde')
    }
    setSaving(false)
  }

  const deleteTransaction = async (id) => {
    if (!confirm('Supprimer ?')) return
    await fetch(`${API_URL}?table=Transactions&id=${id}`, { method: 'DELETE' })
    await refreshData()
  }

  const markAsEffectuee = async (t) => {
    setSaving(true)
    await fetch(`${API_URL}?table=Transactions&id=${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Statut: 'effectuee' } })
    })
    await refreshData()
    setSaving(false)
  }

  const saveMember = async (data) => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}?action=create_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
      if (result.success) { await refreshData(); setModal({ type: null, data: null }) }
      else alert(result.error || 'Erreur')
    } catch (e) { alert('Erreur') }
    setSaving(false)
  }

  const deleteMember = async (user) => {
    if (user.role === 'admin' && team.filter(u => u.role === 'admin').length <= 1) {
      alert('⚠️ Dernier admin !'); return
    }
    if (transactions.some(t => t.user === user.id)) {
      alert('⚠️ A des opérations'); return
    }
    if (!confirm(`Supprimer ${user.name} ?`)) return
    await fetch(`${API_URL}?table=Equipe&id=${user.id}`, { method: 'DELETE' })
    await refreshData()
  }

  const saveCaisse = async (data) => {
    setSaving(true)
    const fields = { Nom: data.nom, Description: data.description || '', Icon: data.icon }
    const url = data.id ? `${API_URL}?table=Caisses&id=${data.id}` : `${API_URL}?table=Caisses`
    await fetch(url, { method: data.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
    await refreshData()
    setModal({ type: null, data: null })
    setSaving(false)
  }

  const deleteCaisse = async (caisse, deleteOps) => {
    setSaving(true)
    if (deleteOps) {
      for (const t of transactions.filter(t => t.caisse === caisse.id)) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
    }
    await fetch(`${API_URL}?table=Caisses&id=${caisse.id}`, { method: 'DELETE' })
    if (currentCaisse === caisse.id) setCurrentCaisse(caisses.find(c => c.id !== caisse.id)?.id || null)
    await refreshData()
    setModal({ type: null, data: null })
    setSaving(false)
  }

  const saveCategory = async (data) => {
    setSaving(true)
    const fields = { Label: data.label, Icon: data.icon, Type: data.type }
    const url = data.id ? `${API_URL}?table=Categories&id=${data.id}` : `${API_URL}?table=Categories`
    await fetch(url, { method: data.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
    await refreshData()
    setModal({ type: null, data: null })
    setSaving(false)
  }

  const deleteCategory = async (cat, type) => {
    if (transactions.some(t => t.type === type && t.category === cat.id)) {
      alert('⚠️ Catégorie utilisée'); return
    }
    if (!confirm(`Supprimer "${cat.label}" ?`)) return
    await fetch(`${API_URL}?table=Categories&id=${cat.id}`, { method: 'DELETE' })
    await refreshData()
  }

  const handleReset = async (mode, startAmount = 0) => {
    setSaving(true)
    try {
      let toDelete = []
      if (mode === 'caisse') toDelete = transactions.filter(t => t.caisse === currentCaisse)
      else if (mode === 'all') toDelete = [...transactions]
      else if (mode === 'orphans') toDelete = orphanTransactions
      
      for (const t of toDelete) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
      
      if (mode === 'caisse' && startAmount > 0 && currentCaisse && categories.entree.length > 0) {
        const catId = categories.entree.find(c => c.label.toLowerCase().includes('fond'))?.id || categories.entree[0].id
        const userId = getCurrentUserId()
        
        if (userId) {
          await fetch(`${API_URL}?table=Transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: {
              Motif: 'Fond de caisse initial', Montant: startAmount, Type: 'entree',
              Categorie: [catId], Utilisateur: [userId], Date: new Date().toISOString(),
              Note: 'Réinitialisation', Caisse: [currentCaisse], Statut: 'effectuee'
            }})
          })
        }
      }
      
      await refreshData()
      setModal({ type: null, data: null })
    } catch (e) {
      alert('❌ Erreur')
    }
    setSaving(false)
  }

  // === SCREENS ===
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4 animate-bounce">🥭</div>
          <p className="text-xl font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!setupComplete && showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🥭</div>
            <h1 className="text-xl font-bold">Bienvenue</h1>
          </div>
          <form onSubmit={handleSetup} className="space-y-3">
            <input type="text" placeholder="Nom" value={setupForm.nom} onChange={(e) => setSetupForm({...setupForm, nom: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="email" placeholder="Email" value={setupForm.email} onChange={(e) => setSetupForm({...setupForm, email: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="password" placeholder="Mot de passe" value={setupForm.password} onChange={(e) => setSetupForm({...setupForm, password: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="password" placeholder="Confirmer" value={setupForm.confirmPassword} onChange={(e) => setSetupForm({...setupForm, confirmPassword: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg">
              {saving ? '...' : 'Créer'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🥭</div>
            <h1 className="text-xl font-bold">Caisse Manrina</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="password" placeholder="Mot de passe" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg">
              {saving ? '...' : 'Connexion'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4 animate-bounce">🥭</div>
          <p className="text-xl font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // === MAIN APP ===
  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Top */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl">🥭</span>
              <div>
                <h1 className="font-bold text-lg leading-tight">Caisse</h1>
                <p className="text-xs opacity-70">{currentUser?.nom || currentUser?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg">
              Déconnexion
            </button>
          </div>
          
          {/* Caisse selector */}
          <select value={currentCaisse || ''} onChange={(e) => setCurrentCaisse(e.target.value)}
            className="w-full bg-white/20 backdrop-blur rounded-xl px-4 py-2.5 font-semibold outline-none mb-3">
            <option value="" className="text-gray-800">Sélectionner une caisse...</option>
            {caisses.map(c => <option key={c.id} value={c.id} className="text-gray-800">{c.icon} {c.nom}</option>)}
          </select>
          
          {/* Soldes */}
          {currentCaisse && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-xs opacity-80 mb-1">Solde actuel</p>
                <p className={`text-xl font-bold ${soldeEffectif < 0 ? 'text-red-200' : ''}`}>{formatMoney(soldeEffectif)}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center border border-white/20">
                <p className="text-xs opacity-80 mb-1">Prévisionnel</p>
                <p className={`text-xl font-bold ${soldePrevisionnel < 0 ? 'text-red-200' : 'opacity-80'}`}>{formatMoney(soldePrevisionnel)}</p>
              </div>
            </div>
          )}
          
          {/* Alertes */}
          {orphanTransactions.length > 0 && (
            <div className="mt-3 text-xs bg-orange-500/40 rounded-lg px-3 py-2 flex justify-between items-center">
              <span>⚠️ {orphanTransactions.length} orpheline(s)</span>
              <button onClick={() => { setMenuOpen(false); setModal({ type: 'reset', data: { mode: 'orphans' } }) }} className="underline">Nettoyer</button>
            </div>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-28">
        {caisses.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3">💰</div>
            <p className="text-gray-500 mb-4">Créez votre première caisse</p>
            <button onClick={() => setModal({ type: 'caisse', data: null })} 
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg">
              + Créer une caisse
            </button>
          </div>
        ) : currentCaisse && (
          <div className="space-y-3">
            {/* Filtres */}
            <div className="flex gap-2">
              <input type="text" placeholder="🔍 Rechercher..." value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="flex-1 px-3 py-2.5 bg-white rounded-xl text-sm outline-none shadow-sm" />
              <select value={filters.period} onChange={(e) => setFilters({...filters, period: e.target.value})}
                className="px-3 py-2.5 bg-white rounded-xl text-sm outline-none shadow-sm font-medium">
                <option value="tout">Tout</option>
                <option value="jour">Aujourd'hui</option>
                <option value="semaine">7 jours</option>
                <option value="mois">30 jours</option>
              </select>
            </div>

            {/* Toggle prévues */}
            <button onClick={() => setShowPrevues(!showPrevues)} 
              className={`w-full py-2 rounded-xl text-sm font-medium transition-all ${
                showPrevues ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              }`}>
              {showPrevues ? '📅 Opérations prévues affichées' : '📅 Opérations prévues masquées'}
              {transPrevues.length > 0 && ` (${transPrevues.length})`}
            </button>

            {/* Résumé */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Entrées</p>
                <p className="text-lg font-bold text-emerald-700">{formatMoney(totaux.entrees)}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-700 font-medium">Sorties</p>
                <p className="text-lg font-bold text-red-700">{formatMoney(totaux.sorties)}</p>
              </div>
            </div>

            {/* Liste */}
            {filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm">
                <div className="text-4xl mb-2 opacity-30">📋</div>
                <p className="text-gray-400">Aucune opération</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map(t => {
                  const cat = getCatInfo(t.category, t.type)
                  const isPrevue = t.statut === 'prevue'
                  return (
                    <div key={t.id} className={`bg-white rounded-xl p-3 shadow-sm flex gap-3 ${isPrevue ? 'opacity-60 border-2 border-dashed border-amber-300' : ''}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                        t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setModal({ type: 'transaction', data: t })}>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{t.reason}</p>
                          {isPrevue && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Prévue</span>}
                        </div>
                        <p className="text-xs text-gray-400">{cat.label} • {getUserName(t.user)}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(t.date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold ${t.type === 'entree' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'entree' ? '+' : '-'}{formatMoney(t.amount)}
                        </p>
                        <div className="flex gap-1 mt-1 justify-end">
                          {isPrevue && (
                            <button onClick={() => markAsEffectuee(t)} className="text-xs text-amber-600 hover:text-amber-800" title="Marquer effectuée">✓</button>
                          )}
                          <button onClick={() => setModal({ type: 'transaction', data: t })} className="text-xs text-gray-400">✏️</button>
                          <button onClick={() => deleteTransaction(t.id)} className="text-xs text-gray-400">🗑️</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MENU CENTRAL */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        {/* Overlay */}
        {menuOpen && (
          <div className="fixed inset-0 bg-black/30 -z-10" onClick={() => setMenuOpen(false)} />
        )}
        
        {/* Menu items */}
        <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all ${
          menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <MenuButton icon="➕" label="Opération" color="from-teal-500 to-emerald-500" 
            onClick={() => { setMenuOpen(false); setModal({ type: 'transaction', data: null }) }} />
          <MenuButton icon="📊" label="Stats" color="from-blue-500 to-indigo-500" 
            onClick={() => { setMenuOpen(false); setModal({ type: 'stats', data: null }) }} />
          <MenuButton icon="👥" label="Équipe" color="from-purple-500 to-pink-500" 
            onClick={() => { setMenuOpen(false); setModal({ type: 'team', data: null }) }} />
          <MenuButton icon="⚙️" label="Config" color="from-gray-600 to-gray-700" 
            onClick={() => { setMenuOpen(false); setModal({ type: 'config', data: null }) }} />
        </div>
        
        {/* FAB */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className={`w-14 h-14 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-2xl shadow-xl flex items-center justify-center transition-transform ${
            menuOpen ? 'rotate-45 scale-110' : ''
          }`}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* MODALS */}
      {modal.type === 'transaction' && (
        <TransactionModal data={modal.data} categories={categories} team={team} currentUserId={getCurrentUserId()}
          saving={saving} onSave={saveTransaction} onClose={() => setModal({ type: null, data: null })} />
      )}
      
      {modal.type === 'stats' && (
        <StatsModal transactions={filteredTransactions} categories={categories} totaux={totaux} team={team}
          currentCaisse={currentCaisse} caisseTransactions={caisseTransactions}
          onReset={() => { setModal({ type: 'reset', data: { mode: 'caisse' } }) }}
          onClose={() => setModal({ type: null, data: null })} />
      )}
      
      {modal.type === 'team' && (
        <TeamModal team={team} currentUser={currentUser} saving={saving}
          onAdd={() => setModal({ type: 'member', data: null })}
          onDelete={deleteMember}
          onClose={() => setModal({ type: null, data: null })} />
      )}
      
      {modal.type === 'config' && (
        <ConfigModal caisses={caisses} categories={categories} currentCaisse={currentCaisse}
          orphanCount={orphanTransactions.length} getTransCount={getTransCount}
          onAddCaisse={() => setModal({ type: 'caisse', data: null })}
          onEditCaisse={(c) => setModal({ type: 'caisse', data: c })}
          onDeleteCaisse={(c) => setModal({ type: 'deleteCaisse', data: c })}
          onAddCategory={(type) => setModal({ type: 'category', data: { type } })}
          onEditCategory={(c, type) => setModal({ type: 'category', data: { ...c, type } })}
          onDeleteCategory={deleteCategory}
          onCleanOrphans={() => setModal({ type: 'reset', data: { mode: 'orphans' } })}
          onResetAll={() => setModal({ type: 'reset', data: { mode: 'all' } })}
          onClose={() => setModal({ type: null, data: null })} />
      )}
      
      {modal.type === 'member' && <MemberModal saving={saving} onSave={saveMember} onClose={() => setModal({ type: null, data: null })} />}
      {modal.type === 'caisse' && <CaisseModal data={modal.data} saving={saving} onSave={saveCaisse} onClose={() => setModal({ type: null, data: null })} />}
      {modal.type === 'deleteCaisse' && <DeleteCaisseModal caisse={modal.data} count={getTransCount(modal.data.id)} saving={saving} onDelete={deleteCaisse} onClose={() => setModal({ type: null, data: null })} />}
      {modal.type === 'category' && <CategoryModal data={modal.data} saving={saving} onSave={saveCategory} onClose={() => setModal({ type: null, data: null })} />}
      {modal.type === 'reset' && (
        <ResetModal mode={modal.data?.mode} caisseName={currentCaisseData ? `${currentCaisseData.icon} ${currentCaisseData.nom}` : ''}
          count={modal.data?.mode === 'caisse' ? caisseTransactions.length : modal.data?.mode === 'all' ? transactions.length : orphanTransactions.length}
          hasEntryCategory={categories.entree.length > 0} saving={saving} onReset={handleReset} onClose={() => setModal({ type: null, data: null })} />
      )}
    </div>
  )
}

// === COMPONENTS ===

function MenuButton({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${color} text-white rounded-full shadow-lg font-medium text-sm whitespace-nowrap`}>
      <span>{icon}</span> {label}
    </button>
  )
}

function TransactionModal({ data, categories, team, currentUserId, saving, onSave, onClose }) {
  const [type, setType] = useState(data?.type || 'sortie')
  const now = new Date()
  const [form, setForm] = useState(() => {
    if (data?.id) {
      const d = new Date(data.date)
      return { id: data.id, amount: data.amount.toString(), reason: data.reason, user: data.user, category: data.category, note: data.note || '',
        date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0,5), statut: data.statut || 'effectuee' }
    }
    return { amount: '', reason: '', user: currentUserId || '', category: '', note: '',
      date: now.toISOString().split('T')[0], time: now.toTimeString().slice(0,5), statut: 'effectuee' }
  })
  
  const submit = (e) => {
    e.preventDefault()
    if (!form.amount || !form.reason || !form.user || !form.category) return
    onSave({ ...form, type, id: data?.id })
  }
  
  return (
    <FullModal title={data?.id ? 'Modifier' : 'Nouvelle opération'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Type */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => { setType('sortie'); setForm(f => ({...f, category: ''})) }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'sortie' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>
            📤 Sortie
          </button>
          <button type="button" onClick={() => { setType('entree'); setForm(f => ({...f, category: ''})) }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'entree' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>
            📥 Entrée
          </button>
        </div>

        {/* Statut */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => setForm(f => ({...f, statut: 'effectuee'}))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.statut === 'effectuee' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>
            ✓ Effectuée
          </button>
          <button type="button" onClick={() => setForm(f => ({...f, statut: 'prevue'}))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.statut === 'prevue' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-gray-400'}`}>
            📅 Prévue
          </button>
        </div>

        {/* Catégorie */}
        {categories[type].length === 0 ? (
          <p className="text-red-500 text-sm p-3 bg-red-50 rounded-xl">⚠️ Créez une catégorie dans Config</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {categories[type].map(c => (
              <button key={c.id} type="button" onClick={() => setForm(f => ({...f, category: c.id}))}
                className={`p-2.5 rounded-xl text-left text-sm font-medium border-2 transition-all ${
                  form.category === c.id ? type === 'entree' ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50' : 'border-gray-200'
                }`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Montant */}
        <input type="number" step="0.01" placeholder="0.00 €" value={form.amount}
          onChange={(e) => setForm(f => ({...f, amount: e.target.value}))}
          className="w-full p-4 bg-gray-100 rounded-xl text-2xl font-bold text-center outline-none" required />

        {/* Date & Heure */}
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm(f => ({...f, date: e.target.value}))}
            className="p-3 bg-gray-100 rounded-xl text-sm outline-none" required />
          <input type="time" value={form.time} onChange={(e) => setForm(f => ({...f, time: e.target.value}))}
            className="p-3 bg-gray-100 rounded-xl text-sm outline-none" required />
        </div>

        {/* Utilisateur */}
        <select value={form.user} onChange={(e) => setForm(f => ({...f, user: e.target.value}))}
          className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" required>
          <option value="">Qui ?</option>
          {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {/* Motif */}
        <input type="text" placeholder="Motif..." value={form.reason}
          onChange={(e) => setForm(f => ({...f, reason: e.target.value}))}
          className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" required />

        {/* Note */}
        <input type="text" placeholder="Note (optionnel)" value={form.note}
          onChange={(e) => setForm(f => ({...f, note: e.target.value}))}
          className="w-full p-3 bg-gray-100 rounded-xl text-sm outline-none" />

        <button type="submit" disabled={!form.category || saving}
          className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
            !form.category || saving ? 'bg-gray-300' : type === 'entree' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-orange-500'
          }`}>
          {saving ? '...' : data?.id ? 'Modifier' : 'Valider'}
        </button>
      </form>
    </FullModal>
  )
}

function StatsModal({ transactions, categories, totaux, team, currentCaisse, caisseTransactions, onReset, onClose }) {
  const statsByCat = (type) => categories[type].map(c => ({
    ...c, total: transactions.filter(t => t.type === type && t.category === c.id && t.statut !== 'prevue').reduce((s, t) => s + t.amount, 0)
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total)
  
  const statsByUser = team.map(u => ({
    ...u,
    entrees: transactions.filter(t => t.user === u.id && t.type === 'entree' && t.statut !== 'prevue').reduce((s, t) => s + t.amount, 0),
    sorties: transactions.filter(t => t.user === u.id && t.type === 'sortie' && t.statut !== 'prevue').reduce((s, t) => s + t.amount, 0),
    count: transactions.filter(t => t.user === u.id).length
  })).filter(u => u.count > 0).sort((a,b) => b.count - a.count)
  
  return (
    <FullModal title="📊 Statistiques" onClose={onClose}>
      <div className="space-y-4">
        <StatSection title="📈 Entrées" items={statsByCat('entree')} total={totaux.entrees} color="emerald" />
        <StatSection title="📉 Sorties" items={statsByCat('sortie')} total={totaux.sorties} color="red" />
        
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-bold mb-3">👥 Par utilisateur</h3>
          {statsByUser.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {statsByUser.map(u => (
                <div key={u.id} className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{u.name}</span>
                  <span className="text-emerald-600">+{formatMoney(u.entrees)}</span>
                  <span className="text-red-600">-{formatMoney(u.sorties)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {currentCaisse && (
          <button onClick={onReset} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium">
            ⚠️ Réinitialiser cette caisse
          </button>
        )}
      </div>
    </FullModal>
  )
}

function StatSection({ title, items, total, color }) {
  if (items.length === 0) return null
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="font-bold mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id}>
            <div className="flex justify-between text-sm mb-1">
              <span>{c.icon} {c.label}</span>
              <span className={`font-medium text-${color}-600`}>{formatMoney(c.total)}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${total > 0 ? (c.total/total)*100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamModal({ team, currentUser, saving, onAdd, onDelete, onClose }) {
  return (
    <FullModal title="👥 Équipe" onClose={onClose}>
      <div className="space-y-2 mb-4">
        {team.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
              {u.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200'}`}>
              {u.role}
            </span>
            {currentUser?.role === 'admin' && u.id !== currentUser?.id && (
              <button onClick={() => onDelete(u)} className="text-gray-400 text-sm">🗑️</button>
            )}
          </div>
        ))}
      </div>
      {currentUser?.role === 'admin' && (
        <button onClick={onAdd} className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold">
          + Ajouter un membre
        </button>
      )}
    </FullModal>
  )
}

function ConfigModal({ caisses, categories, currentCaisse, orphanCount, getTransCount, onAddCaisse, onEditCaisse, onDeleteCaisse, onAddCategory, onEditCategory, onDeleteCategory, onCleanOrphans, onResetAll, onClose }) {
  return (
    <FullModal title="⚙️ Configuration" onClose={onClose}>
      <div className="space-y-4">
        {/* Caisses */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">💰 Caisses</h3>
            <button onClick={onAddCaisse} className="text-sm text-teal-600 font-medium">+ Ajouter</button>
          </div>
          <div className="space-y-2">
            {caisses.map(c => (
              <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg ${currentCaisse === c.id ? 'bg-teal-100' : 'bg-white'}`}>
                <span className="text-xl">{c.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{c.nom}</p>
                  <p className="text-xs text-gray-400">{getTransCount(c.id)} op.</p>
                </div>
                <button onClick={() => onEditCaisse(c)} className="text-xs text-gray-400">✏️</button>
                <button onClick={() => onDeleteCaisse(c)} className="text-xs text-gray-400">🗑️</button>
              </div>
            ))}
          </div>
        </div>

        {/* Catégories */}
        {['entree', 'sortie'].map(type => (
          <div key={type} className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">{type === 'entree' ? '📈 Catégories Entrées' : '📉 Catégories Sorties'}</h3>
              <button onClick={() => onAddCategory(type)} className={`text-sm font-medium ${type === 'entree' ? 'text-emerald-600' : 'text-red-600'}`}>+ Ajouter</button>
            </div>
            {categories[type].length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-2">Aucune</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories[type].map(c => (
                  <div key={c.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm ${type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {c.icon} {c.label}
                    <button onClick={() => onEditCategory(c, type)} className="text-xs opacity-50">✏️</button>
                    <button onClick={() => onDeleteCategory(c, type)} className="text-xs opacity-50">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Maintenance */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-bold mb-3">🔧 Maintenance</h3>
          {orphanCount > 0 && (
            <button onClick={onCleanOrphans} className="w-full py-2 mb-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
              Nettoyer {orphanCount} orpheline(s)
            </button>
          )}
          <button onClick={onResetAll} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
            🗑️ Tout réinitialiser
          </button>
        </div>
      </div>
    </FullModal>
  )
}

function MemberModal({ saving, onSave, onClose }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', role: 'membre' })
  return (
    <FullModal title="Nouveau membre" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (form.nom && form.email && form.password) onSave(form) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm({...form, nom: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
        <input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
        <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none">
          <option value="membre">Membre</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold">
          {saving ? '...' : 'Ajouter'}
        </button>
      </form>
    </FullModal>
  )
}

function CaisseModal({ data, saving, onSave, onClose }) {
  const [form, setForm] = useState({ nom: data?.nom || '', description: data?.description || '', icon: data?.icon || '💰' })
  return (
    <FullModal title={data?.id ? 'Modifier caisse' : 'Nouvelle caisse'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (form.nom) onSave({ ...form, id: data?.id }) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm({...form, nom: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
        <input type="text" placeholder="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" />
        <div className="flex flex-wrap gap-1 p-2 bg-gray-100 rounded-xl max-h-24 overflow-y-auto">
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => setForm({...form, icon: e})}
              className={`w-8 h-8 rounded ${form.icon === e ? 'bg-teal-500 scale-110' : 'bg-white'}`}>{e}</button>
          ))}
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-2">
          <span className="text-2xl">{form.icon}</span>
          <span className="font-medium">{form.nom || 'Aperçu'}</span>
        </div>
        <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold">
          {saving ? '...' : data?.id ? 'Modifier' : 'Créer'}
        </button>
      </form>
    </FullModal>
  )
}

function DeleteCaisseModal({ caisse, count, saving, onDelete, onClose }) {
  return (
    <FullModal title="Supprimer caisse" onClose={onClose}>
      <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3 mb-4">
        <span className="text-2xl">{caisse.icon}</span>
        <div>
          <p className="font-medium">{caisse.nom}</p>
          <p className="text-xs text-gray-500">{count} opération(s)</p>
        </div>
      </div>
      {count > 0 && <p className="text-sm text-orange-700 bg-orange-50 p-3 rounded-xl mb-4">⚠️ Les {count} opérations seront supprimées</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
        <button onClick={() => onDelete(caisse, count > 0)} disabled={saving} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium">
          {saving ? '...' : 'Supprimer'}
        </button>
      </div>
    </FullModal>
  )
}

function CategoryModal({ data, saving, onSave, onClose }) {
  const type = data?.type || 'sortie'
  const [form, setForm] = useState({ label: data?.label || '', icon: data?.icon || '📦' })
  return (
    <FullModal title={data?.id ? 'Modifier catégorie' : 'Nouvelle catégorie'} onClose={onClose}>
      <div className={`text-center py-2 rounded-xl mb-4 text-sm font-medium ${type === 'entree' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {type === 'entree' ? '📈 Entrée' : '📉 Sortie'}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (form.label) onSave({ ...form, type, id: data?.id }) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.label} onChange={(e) => setForm({...form, label: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
        <div className="flex flex-wrap gap-1 p-2 bg-gray-100 rounded-xl max-h-24 overflow-y-auto">
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => setForm({...form, icon: e})}
              className={`w-8 h-8 rounded ${form.icon === e ? 'bg-teal-500 scale-110' : 'bg-white'}`}>{e}</button>
          ))}
        </div>
        <button type="submit" disabled={saving} className={`w-full py-3 text-white rounded-xl font-bold ${type === 'entree' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}>
          {saving ? '...' : data?.id ? 'Modifier' : 'Créer'}
        </button>
      </form>
    </FullModal>
  )
}

function ResetModal({ mode, caisseName, count, hasEntryCategory, saving, onReset, onClose }) {
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState('')
  
  return (
    <FullModal title={`⚠️ ${mode === 'caisse' ? 'Réinitialiser' : mode === 'all' ? 'Tout réinitialiser' : 'Nettoyer'}`} onClose={onClose}>
      <p className="text-gray-600 text-sm mb-4">
        {mode === 'caisse' ? `${count} op. de ${caisseName}` : mode === 'all' ? `${count} opérations` : `${count} orpheline(s)`}
      </p>
      
      {mode === 'caisse' && (
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Montant de départ</label>
          <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 bg-gray-100 rounded-xl text-lg font-bold text-center outline-none" />
          {parseFloat(amount) > 0 && !hasEntryCategory && (
            <p className="text-orange-600 text-xs mt-1">⚠️ Créez une catégorie d'entrée</p>
          )}
        </div>
      )}
      
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-1 block">Tapez REINITIALISER</label>
        <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full p-3 bg-gray-100 rounded-xl font-mono text-center outline-none" />
      </div>
      
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
        <button onClick={() => onReset(mode, parseFloat(amount) || 0)} disabled={confirm !== 'REINITIALISER' || saving}
          className={`flex-1 py-3 rounded-xl font-medium ${confirm === 'REINITIALISER' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
          {saving ? '...' : 'Confirmer'}
        </button>
      </div>
    </FullModal>
  )
}

function FullModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export default App
