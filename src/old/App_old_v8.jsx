import { useState, useEffect, useMemo, useCallback } from 'react'

const API_URL = '/api.php'
const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '💰', '🎯', '📊', '🔒', '🏪', '🚚', '🍳', '🛵', '🎪']

// === HELPERS ===
const formatMoney = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n) + ' €'
const formatDateTime = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}h${date.getMinutes().toString().padStart(2,'0')}`
}

function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [setupKey, setSetupKey] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  
  // App
  const [activeTab, setActiveTab] = useState('operations')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  // Data
  const [caisses, setCaisses] = useState([])
  const [categories, setCategories] = useState({ entree: [], sortie: [] })
  const [transactions, setTransactions] = useState([])
  const [team, setTeam] = useState([])
  const [currentCaisse, setCurrentCaisse] = useState(null)
  
  // Modal
  const [modal, setModal] = useState({ type: null, data: null })
  
  // Forms
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [setupForm, setSetupForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  
  // Filters
  const [filters, setFilters] = useState({ period: 'tout', user: 'tous', search: '' })

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

  const loadData = async () => {
    setLoading(true)
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
        date: r.fields.Date || '', note: r.fields.Note || '', caisse: r.fields.Caisse?.[0] || ''
      })) || []
      
      setTeam(parsedTeam)
      setCaisses(parsedCaisses)
      setCategories(parsedCats)
      setTransactions(parsedTrans)
      
      if (!currentCaisse && parsedCaisses.length > 0) setCurrentCaisse(parsedCaisses[0].id)
    } catch (e) { console.error('Load error:', e) }
    setLoading(false)
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
    
    if (filters.user !== 'tous') filtered = filtered.filter(t => t.user === filters.user)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(t => t.reason.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q))
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [caisseTransactions, filters])

  const orphanTransactions = useMemo(() => {
    const ids = caisses.map(c => c.id)
    return transactions.filter(t => !t.caisse || !ids.includes(t.caisse))
  }, [transactions, caisses])

  const solde = useMemo(() => {
    const e = caisseTransactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0)
    const s = caisseTransactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0)
    return e - s
  }, [caisseTransactions])

  const totaux = useMemo(() => ({
    entrees: filteredTransactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0),
    sorties: filteredTransactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0)
  }), [filteredTransactions])

  // === HELPERS ===
  const getUserName = (id) => team.find(u => u.id === id)?.name || '?'
  const getCatInfo = (id, type) => categories[type]?.find(c => c.id === id) || { label: '?', icon: '❓' }
  const getTransCount = (caisseId) => transactions.filter(t => t.caisse === caisseId).length
  
  // IMPORTANT: Trouver l'ID Airtable de l'utilisateur connecté
  const getCurrentUserId = useCallback(() => {
    if (!currentUser) {
      console.log('⚠️ Pas de currentUser')
      return team[0]?.id
    }
    
    // currentUser.id vient du login (c'est déjà l'ID Airtable)
    // Mais vérifions qu'il existe dans team
    const byId = team.find(t => t.id === currentUser.id)
    if (byId) {
      console.log('✅ User trouvé par ID:', byId.id)
      return byId.id
    }
    
    // Sinon chercher par email
    const byEmail = team.find(t => t.email === currentUser.email)
    if (byEmail) {
      console.log('✅ User trouvé par email:', byEmail.id)
      return byEmail.id
    }
    
    console.log('⚠️ User non trouvé, utilisation premier membre')
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
        alert('✅ Compte créé ! Connectez-vous maintenant.')
      } else { setError(result.error) }
    } catch (e) { setError('Erreur setup') }
    setSaving(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('manrina_user')
    setCurrentUser(null)
    setIsLoggedIn(false)
  }

  // === ACTIONS ===
  const saveTransaction = async (data) => {
    setSaving(true)
    const now = new Date()
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
      Caisse: [currentCaisse]
    }
    
    try {
      const url = data.id ? `${API_URL}?table=Transactions&id=${data.id}` : `${API_URL}?table=Transactions`
      const res = await fetch(url, {
        method: data.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
      
      if (!res.ok) throw new Error('Erreur serveur')
      await loadData()
      setModal({ type: null, data: null })
    } catch (e) {
      console.error('Save error:', e)
      alert('❌ Erreur sauvegarde')
    }
    setSaving(false)
  }

  const deleteTransaction = async (id) => {
    if (!confirm('Supprimer ?')) return
    await fetch(`${API_URL}?table=Transactions&id=${id}`, { method: 'DELETE' })
    await loadData()
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
      if (result.success) { await loadData(); setModal({ type: null, data: null }) }
      else alert(result.error || 'Erreur')
    } catch (e) { alert('Erreur création') }
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
    await loadData()
  }

  const saveCaisse = async (data) => {
    setSaving(true)
    const fields = { Nom: data.nom, Description: data.description || '', Icon: data.icon }
    const url = data.id ? `${API_URL}?table=Caisses&id=${data.id}` : `${API_URL}?table=Caisses`
    await fetch(url, { method: data.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
    await loadData()
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
    await loadData()
    setModal({ type: null, data: null })
    setSaving(false)
  }

  const saveCategory = async (data) => {
    setSaving(true)
    const fields = { Label: data.label, Icon: data.icon, Type: data.type }
    const url = data.id ? `${API_URL}?table=Categories&id=${data.id}` : `${API_URL}?table=Categories`
    await fetch(url, { method: data.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
    await loadData()
    setModal({ type: null, data: null })
    setSaving(false)
  }

  const deleteCategory = async (cat, type) => {
    if (transactions.some(t => t.type === type && t.category === cat.id)) {
      alert('⚠️ Catégorie utilisée'); return
    }
    if (!confirm(`Supprimer "${cat.label}" ?`)) return
    await fetch(`${API_URL}?table=Categories&id=${cat.id}`, { method: 'DELETE' })
    await loadData()
  }

  // === RESET (CORRIGÉ) ===
  const handleReset = async (mode, startAmount = 0) => {
    console.log('🔄 RESET START:', { mode, startAmount, currentCaisse })
    setSaving(true)
    
    try {
      // 1. Transactions à supprimer
      let toDelete = []
      if (mode === 'caisse') toDelete = transactions.filter(t => t.caisse === currentCaisse)
      else if (mode === 'all') toDelete = [...transactions]
      else if (mode === 'orphans') toDelete = orphanTransactions
      
      console.log(`🗑️ Suppression: ${toDelete.length} transactions`)
      
      // 2. Supprimer
      for (const t of toDelete) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
      
      // 3. Créer fond de caisse si montant > 0
      if (mode === 'caisse' && startAmount > 0 && currentCaisse) {
        console.log('💰 Création fond de caisse:', startAmount)
        
        // Vérifier catégorie
        if (categories.entree.length === 0) {
          alert('⚠️ Créez d\'abord une catégorie d\'entrée !')
          await loadData()
          setModal({ type: null, data: null })
          setSaving(false)
          return
        }
        
        // Trouver catégorie "fond de caisse" ou première dispo
        const catId = categories.entree.find(c => 
          c.label.toLowerCase().includes('fond') || c.label.toLowerCase().includes('initial')
        )?.id || categories.entree[0].id
        
        // Trouver user ID
        const userId = getCurrentUserId()
        
        console.log('📋 Données:', { catId, userId, currentCaisse })
        
        if (!userId) {
          alert('⚠️ Aucun utilisateur trouvé !')
          await loadData()
          setModal({ type: null, data: null })
          setSaving(false)
          return
        }
        
        const fields = {
          Motif: 'Fond de caisse initial',
          Montant: startAmount,
          Type: 'entree',
          Categorie: [catId],
          Utilisateur: [userId],
          Date: new Date().toISOString(),
          Note: 'Réinitialisation',
          Caisse: [currentCaisse]
        }
        
        console.log('📤 Envoi Airtable:', JSON.stringify(fields, null, 2))
        
        const res = await fetch(`${API_URL}?table=Transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
        
        const result = await res.json()
        console.log('📥 Réponse Airtable:', result)
        
        if (result.error) {
          console.error('❌ Erreur Airtable:', result.error)
          alert('❌ Erreur: ' + JSON.stringify(result.error))
        } else {
          console.log('✅ Fond de caisse créé!')
        }
      }
      
      await loadData()
      setModal({ type: null, data: null })
      
    } catch (e) {
      console.error('❌ Reset error:', e)
      alert('❌ Erreur réinitialisation')
    }
    
    setSaving(false)
  }

  // === SCREENS ===
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4 animate-bounce">🥭</div>
          <p className="text-xl">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!setupComplete && showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🥭</div>
            <h1 className="text-xl font-bold">Bienvenue</h1>
            <p className="text-gray-500 text-sm">Créez votre compte admin</p>
          </div>
          <form onSubmit={handleSetup} className="space-y-3">
            <input type="text" placeholder="Nom" value={setupForm.nom} onChange={(e) => setSetupForm({...setupForm, nom: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="email" placeholder="Email" value={setupForm.email} onChange={(e) => setSetupForm({...setupForm, email: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            <input type="password" placeholder="Mot de passe (8+)" value={setupForm.password} onChange={(e) => setSetupForm({...setupForm, password: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required minLength={8} />
            <input type="password" placeholder="Confirmer" value={setupForm.confirmPassword} onChange={(e) => setSetupForm({...setupForm, confirmPassword: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl outline-none" required />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold">
              {saving ? '...' : 'Créer'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center p-4">
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
            <button type="submit" disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold">
              {saving ? '...' : 'Connexion'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // === MAIN APP ===
  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER COMPACT */}
      <header className="bg-teal-600 text-white">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥭</span>
              <span className="font-bold">Caisse</span>
            </div>
            <button onClick={handleLogout} className="text-sm opacity-80 hover:opacity-100">Déconnexion</button>
          </div>
          
          {/* Caisse + Solde */}
          <div className="mt-3 flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <select value={currentCaisse || ''} onChange={(e) => setCurrentCaisse(e.target.value)}
              className="flex-1 bg-transparent font-semibold outline-none">
              <option value="" className="text-gray-800">Sélectionner...</option>
              {caisses.map(c => <option key={c.id} value={c.id} className="text-gray-800">{c.icon} {c.nom}</option>)}
            </select>
            <div className="text-right border-l border-white/30 pl-3">
              <p className="text-xs opacity-70">Solde</p>
              <p className={`text-xl font-bold ${solde < 0 ? 'text-red-200' : ''}`}>{formatMoney(solde)}</p>
            </div>
          </div>
          
          {orphanTransactions.length > 0 && (
            <div className="mt-2 text-sm bg-orange-500/40 rounded-lg px-3 py-1 flex justify-between items-center">
              <span>⚠️ {orphanTransactions.length} orpheline(s)</span>
              <button onClick={() => setModal({ type: 'reset', data: { mode: 'orphans' } })} className="underline">Nettoyer</button>
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex border-t border-white/20">
          {[
            { id: 'operations', icon: '📋' },
            { id: 'stats', icon: '📊' },
            { id: 'equipe', icon: '👥' },
            { id: 'config', icon: '⚙️' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 text-center ${activeTab === t.id ? 'bg-white/20' : 'opacity-60'}`}>
              {t.icon}
            </button>
          ))}
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-24">
        {caisses.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-3">💰</div>
            <p className="text-gray-500 mb-4">Créez votre première caisse</p>
            <button onClick={() => setModal({ type: 'caisse', data: null })} className="px-5 py-2 bg-teal-600 text-white rounded-xl font-bold">
              + Créer
            </button>
          </div>
        )}

        {/* OPERATIONS */}
        {activeTab === 'operations' && currentCaisse && (
          <div className="space-y-3">
            {/* Filtres */}
            <div className="flex gap-2">
              <input type="text" placeholder="🔍 Rechercher..." value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="flex-1 px-3 py-2 bg-white rounded-xl text-sm outline-none shadow-sm" />
              <select value={filters.period} onChange={(e) => setFilters({...filters, period: e.target.value})}
                className="px-3 py-2 bg-white rounded-xl text-sm outline-none shadow-sm">
                <option value="tout">Tout</option>
                <option value="jour">Aujourd'hui</option>
                <option value="semaine">7j</option>
                <option value="mois">30j</option>
              </select>
            </div>

            {/* Résumé */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Entrées</p>
                <p className="text-lg font-bold text-emerald-700">{formatMoney(totaux.entrees)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-700 font-medium">Sorties</p>
                <p className="text-lg font-bold text-red-700">{formatMoney(totaux.sorties)}</p>
              </div>
            </div>

            {/* Liste */}
            {filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-400">Aucune opération</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map(t => {
                  const cat = getCatInfo(t.category, t.type)
                  return (
                    <div key={t.id} className="bg-white rounded-xl p-3 shadow-sm flex gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => setModal({ type: 'transaction', data: t })}>
                        <p className="font-medium text-sm truncate">{t.reason}</p>
                        <p className="text-xs text-gray-400">{cat.label} • {getUserName(t.user)}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(t.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${t.type === 'entree' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'entree' ? '+' : '-'}{formatMoney(t.amount)}
                        </p>
                        <div className="flex gap-1 mt-1">
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

        {/* STATS */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <StatCard title="📈 Entrées" items={categories.entree.map(c => ({
              ...c,
              total: filteredTransactions.filter(t => t.type === 'entree' && t.category === c.id).reduce((s, t) => s + t.amount, 0)
            })).filter(c => c.total > 0)} total={totaux.entrees} color="emerald" />
            
            <StatCard title="📉 Sorties" items={categories.sortie.map(c => ({
              ...c,
              total: filteredTransactions.filter(t => t.type === 'sortie' && t.category === c.id).reduce((s, t) => s + t.amount, 0)
            })).filter(c => c.total > 0)} total={totaux.sorties} color="red" />
            
            {currentCaisse && (
              <button onClick={() => setModal({ type: 'reset', data: { mode: 'caisse' } })} 
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium">
                ⚠️ Réinitialiser cette caisse
              </button>
            )}
          </div>
        )}

        {/* EQUIPE */}
        {activeTab === 'equipe' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">👥 Équipe</h3>
              {currentUser?.role === 'admin' && (
                <button onClick={() => setModal({ type: 'member', data: null })} className="text-sm text-teal-600 font-medium">+ Ajouter</button>
              )}
            </div>
            <div className="space-y-2">
              {team.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200'}`}>
                    {u.role}
                  </span>
                  {currentUser?.role === 'admin' && u.id !== currentUser?.id && (
                    <button onClick={() => deleteMember(u)} className="text-gray-400 text-xs">🗑️</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIG */}
        {activeTab === 'config' && (
          <div className="space-y-3">
            {/* Caisses */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">💰 Caisses</h3>
                <button onClick={() => setModal({ type: 'caisse', data: null })} className="text-sm text-teal-600 font-medium">+ Ajouter</button>
              </div>
              <div className="space-y-2">
                {caisses.map(c => (
                  <div key={c.id} className={`flex items-center gap-3 p-2 rounded-lg ${currentCaisse === c.id ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'}`}>
                    <span className="text-xl">{c.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.nom}</p>
                      <p className="text-xs text-gray-400">{getTransCount(c.id)} op.</p>
                    </div>
                    <button onClick={() => setModal({ type: 'caisse', data: c })} className="text-xs text-gray-400">✏️</button>
                    <button onClick={() => setModal({ type: 'deleteCaisse', data: c })} className="text-xs text-gray-400">🗑️</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Catégories Entrées */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">📈 Catégories Entrées</h3>
                <button onClick={() => setModal({ type: 'category', data: { type: 'entree' } })} className="text-sm text-emerald-600 font-medium">+ Ajouter</button>
              </div>
              {categories.entree.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">Aucune</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.entree.map(c => (
                    <div key={c.id} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg text-sm group">
                      {c.icon} {c.label}
                      <button onClick={() => setModal({ type: 'category', data: { ...c, type: 'entree' } })} className="opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                      <button onClick={() => deleteCategory(c, 'entree')} className="opacity-0 group-hover:opacity-100 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégories Sorties */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">📉 Catégories Sorties</h3>
                <button onClick={() => setModal({ type: 'category', data: { type: 'sortie' } })} className="text-sm text-red-600 font-medium">+ Ajouter</button>
              </div>
              {categories.sortie.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">Aucune</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.sortie.map(c => (
                    <div key={c.id} className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-sm group">
                      {c.icon} {c.label}
                      <button onClick={() => setModal({ type: 'category', data: { ...c, type: 'sortie' } })} className="opacity-0 group-hover:opacity-100 text-xs">✏️</button>
                      <button onClick={() => deleteCategory(c, 'sortie')} className="opacity-0 group-hover:opacity-100 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold mb-3">🔧 Maintenance</h3>
              {orphanTransactions.length > 0 && (
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg mb-2">
                  <span className="text-sm">{orphanTransactions.length} orpheline(s)</span>
                  <button onClick={() => setModal({ type: 'reset', data: { mode: 'orphans' } })} className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg">Nettoyer</button>
                </div>
              )}
              <button onClick={() => setModal({ type: 'reset', data: { mode: 'all' } })} className="w-full py-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                🗑️ Tout réinitialiser
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      {activeTab === 'operations' && currentCaisse && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2">
          <button onClick={() => setModal({ type: 'transaction', data: null })} 
            className="bg-teal-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2">
            + Opération
          </button>
        </div>
      )}

      {/* MODALS */}
      {modal.type === 'transaction' && (
        <TransactionModal data={modal.data} categories={categories} team={team} currentUserId={getCurrentUserId()}
          saving={saving} onSave={saveTransaction} onClose={() => setModal({ type: null, data: null })} />
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

function StatCard({ title, items, total, color }) {
  if (items.length === 0) return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm text-center py-2">Aucune donnée</p>
    </div>
  )
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-bold mb-3">{title}</h3>
      <div className="space-y-2">
        {items.sort((a,b) => b.total - a.total).map(c => (
          <div key={c.id}>
            <div className="flex justify-between text-sm mb-1">
              <span>{c.icon} {c.label}</span>
              <span className={`font-medium text-${color}-600`}>{formatMoney(c.total)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${total > 0 ? (c.total/total)*100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TransactionModal({ data, categories, team, currentUserId, saving, onSave, onClose }) {
  const [type, setType] = useState(data?.type || 'sortie')
  const now = new Date()
  const [form, setForm] = useState(() => {
    if (data?.id) {
      const d = new Date(data.date)
      return { id: data.id, amount: data.amount.toString(), reason: data.reason, user: data.user, category: data.category, note: data.note || '',
        date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0,5) }
    }
    return { amount: '', reason: '', user: currentUserId || '', category: '', note: '',
      date: now.toISOString().split('T')[0], time: now.toTimeString().slice(0,5) }
  })
  
  const submit = (e) => {
    e.preventDefault()
    if (!form.amount || !form.reason || !form.user || !form.category) return
    onSave({ ...form, type, id: data?.id })
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold">{data?.id ? 'Modifier' : 'Nouvelle opération'}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        
        <form onSubmit={submit} className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button type="button" onClick={() => { setType('sortie'); setForm(f => ({...f, category: ''})) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'sortie' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>
              📤 Sortie
            </button>
            <button type="button" onClick={() => { setType('entree'); setForm(f => ({...f, category: ''})) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'entree' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>
              📥 Entrée
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Catégorie</label>
            {categories[type].length === 0 ? (
              <p className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">⚠️ Créez une catégorie dans Config</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories[type].map(c => (
                  <button key={c.id} type="button" onClick={() => setForm(f => ({...f, category: c.id}))}
                    className={`p-2 rounded-lg text-left text-sm border ${
                      form.category === c.id ? type === 'entree' ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Montant</label>
            <input type="number" step="0.01" placeholder="0.00" value={form.amount}
              onChange={(e) => setForm(f => ({...f, amount: e.target.value}))}
              className="w-full p-3 bg-gray-100 rounded-lg text-xl font-bold text-center outline-none" required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm(f => ({...f, date: e.target.value}))}
                className="w-full p-2 bg-gray-100 rounded-lg text-sm outline-none" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Heure</label>
              <input type="time" value={form.time} onChange={(e) => setForm(f => ({...f, time: e.target.value}))}
                className="w-full p-2 bg-gray-100 rounded-lg text-sm outline-none" required />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Par</label>
            <select value={form.user} onChange={(e) => setForm(f => ({...f, user: e.target.value}))}
              className="w-full p-3 bg-gray-100 rounded-lg text-sm outline-none" required>
              <option value="">Choisir...</option>
              {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Motif</label>
            <input type="text" placeholder="Description..." value={form.reason}
              onChange={(e) => setForm(f => ({...f, reason: e.target.value}))}
              className="w-full p-3 bg-gray-100 rounded-lg text-sm outline-none" required />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Note (optionnel)</label>
            <input type="text" placeholder="Détails..." value={form.note}
              onChange={(e) => setForm(f => ({...f, note: e.target.value}))}
              className="w-full p-3 bg-gray-100 rounded-lg text-sm outline-none" />
          </div>
        </form>
        
        <div className="p-4 border-t">
          <button type="submit" onClick={submit} disabled={!form.category || saving}
            className={`w-full py-3 rounded-xl font-bold text-white ${
              !form.category || saving ? 'bg-gray-300' : type === 'entree' ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
            {saving ? '...' : data?.id ? 'Modifier' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberModal({ saving, onSave, onClose }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', role: 'membre' })
  return (
    <Modal title="Nouveau membre" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (form.nom && form.email && form.password) onSave(form) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm({...form, nom: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" required />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" required />
        <input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" required />
        <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none">
          <option value="membre">Membre</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Annuler</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-teal-600 text-white rounded-lg font-medium">{saving ? '...' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  )
}

function CaisseModal({ data, saving, onSave, onClose }) {
  const [form, setForm] = useState({ nom: data?.nom || '', description: data?.description || '', icon: data?.icon || '💰' })
  return (
    <Modal title={data?.id ? 'Modifier caisse' : 'Nouvelle caisse'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (form.nom) onSave({ ...form, id: data?.id }) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm({...form, nom: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" required />
        <input type="text" placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" />
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Icône</p>
          <div className="flex flex-wrap gap-1 p-2 bg-gray-100 rounded-lg max-h-24 overflow-y-auto">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setForm({...form, icon: e})}
                className={`w-8 h-8 rounded ${form.icon === e ? 'bg-teal-500 scale-110' : 'bg-white'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
          <span className="text-xl">{form.icon}</span>
          <span className="font-medium">{form.nom || 'Aperçu'}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Annuler</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-teal-600 text-white rounded-lg font-medium">{saving ? '...' : data?.id ? 'Modifier' : 'Créer'}</button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteCaisseModal({ caisse, count, saving, onDelete, onClose }) {
  return (
    <Modal title="Supprimer caisse" onClose={onClose}>
      <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2 mb-3">
        <span className="text-xl">{caisse.icon}</span>
        <div>
          <p className="font-medium">{caisse.nom}</p>
          <p className="text-xs text-gray-500">{count} opération(s)</p>
        </div>
      </div>
      {count > 0 && <p className="text-sm text-orange-700 bg-orange-50 p-2 rounded-lg mb-3">⚠️ Les {count} opérations seront supprimées</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Annuler</button>
        <button onClick={() => onDelete(caisse, count > 0)} disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium">
          {saving ? '...' : 'Supprimer'}
        </button>
      </div>
    </Modal>
  )
}

function CategoryModal({ data, saving, onSave, onClose }) {
  const type = data?.type || 'sortie'
  const [form, setForm] = useState({ label: data?.label || '', icon: data?.icon || '📦' })
  return (
    <Modal title={data?.id ? 'Modifier catégorie' : 'Nouvelle catégorie'} onClose={onClose}>
      <div className={`text-center py-1.5 rounded-lg mb-3 text-sm ${type === 'entree' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {type === 'entree' ? '📈 Entrée' : '📉 Sortie'}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (form.label) onSave({ ...form, type, id: data?.id }) }} className="space-y-3">
        <input type="text" placeholder="Nom" value={form.label} onChange={(e) => setForm({...form, label: e.target.value})} className="w-full p-3 bg-gray-100 rounded-lg outline-none" required />
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Icône</p>
          <div className="flex flex-wrap gap-1 p-2 bg-gray-100 rounded-lg max-h-24 overflow-y-auto">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setForm({...form, icon: e})}
                className={`w-8 h-8 rounded ${form.icon === e ? 'bg-teal-500 scale-110' : 'bg-white'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div className={`p-3 rounded-lg flex items-center gap-2 ${type === 'entree' ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <span>{form.icon}</span>
          <span className="font-medium">{form.label || 'Aperçu'}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Annuler</button>
          <button type="submit" disabled={saving} className={`flex-1 py-2 text-white rounded-lg font-medium ${type === 'entree' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {saving ? '...' : data?.id ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetModal({ mode, caisseName, count, hasEntryCategory, saving, onReset, onClose }) {
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState('')
  
  const title = mode === 'caisse' ? 'Réinitialiser' : mode === 'all' ? 'Tout réinitialiser' : 'Nettoyer orphelines'
  const desc = mode === 'caisse' ? `${count} op. de ${caisseName}` : mode === 'all' ? `${count} opérations` : `${count} orpheline(s)`
  
  return (
    <Modal title={`⚠️ ${title}`} onClose={onClose}>
      <p className="text-gray-600 text-sm mb-3">{desc}</p>
      
      {mode === 'caisse' && (
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Montant de départ (optionnel)</label>
          <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 bg-gray-100 rounded-lg text-lg font-bold text-center outline-none" />
          {parseFloat(amount) > 0 && !hasEntryCategory && (
            <p className="text-orange-600 text-xs mt-1">⚠️ Créez une catégorie d'entrée d'abord</p>
          )}
          {parseFloat(amount) > 0 && hasEntryCategory && (
            <p className="text-emerald-600 text-xs mt-1">✓ Une entrée de {formatMoney(parseFloat(amount))} sera créée</p>
          )}
        </div>
      )}
      
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Tapez <code className="bg-gray-100 px-1 rounded">REINITIALISER</code>
        </label>
        <input type="text" placeholder="REINITIALISER" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full p-3 bg-gray-100 rounded-lg font-mono text-center outline-none" />
      </div>
      
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Annuler</button>
        <button onClick={() => onReset(mode, parseFloat(amount) || 0)} disabled={confirm !== 'REINITIALISER' || saving}
          className={`flex-1 py-2 rounded-lg font-medium ${confirm === 'REINITIALISER' && !saving ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
          {saving ? '...' : 'Confirmer'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default App
