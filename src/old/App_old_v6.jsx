import { useState, useEffect, useMemo, useCallback } from 'react'

// === CONFIGURATION ===
const API_URL = '/api.php'

// === CONSTANTES ===
const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '➕', '➖', '🏪', '🚚', '🍳', '💰', '🎯', '📊', '🔒']

const TABS = [
  { id: 'mouvements', label: '📋 Opérations' },
  { id: 'resume', label: '📊 Résumé' },
  { id: 'equipe', label: '👥 Équipe' },
  { id: 'parametres', label: '⚙️ Paramètres' },
]

// === HELPERS ===
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
}

const formatTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`
}

const formatDateTime = (dateString) => {
  if (!dateString) return ''
  return `${formatDate(dateString)} à ${formatTime(dateString)}`
}

const toAirtableDateTime = (dateStr, timeStr) => {
  if (!dateStr) return new Date().toISOString()
  const [year, month, day] = dateStr.split('-')
  const [hours, minutes] = timeStr ? timeStr.split(':') : ['12', '00']
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

const getCurrentDateTime = () => {
  const now = new Date()
  return {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5)
  }
}

// === COMPOSANT PRINCIPAL ===
function App() {
  // === ÉTATS AUTH ===
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    currentUser: null,
    setupComplete: true,
    showSetup: false,
    loading: true
  })
  
  // === ÉTATS APP ===
  const [activeTab, setActiveTab] = useState('mouvements')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // === DONNÉES ===
  const [data, setData] = useState({
    caisses: [],
    categories: { entree: [], sortie: [] },
    transactions: [],
    team: []
  })
  const [currentCaisse, setCurrentCaisse] = useState(null)
  
  // === MODALS ===
  const [modals, setModals] = useState({
    transaction: false,
    user: false,
    reset: false,
    category: false,
    caisse: false,
    deleteCaisse: false
  })
  
  // === ÉDITION ===
  const [editing, setEditing] = useState({
    transaction: null,
    user: null,
    category: null,
    caisse: null,
    caisseToDelete: null
  })
  
  // === FORMULAIRES ===
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [setupForm, setSetupForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const [setupKey, setSetupKey] = useState('')
  const [newType, setNewType] = useState('sortie')
  const [formData, setFormData] = useState({ amount: '', reason: '', user: '', category: '', note: '', date: '', time: '' })
  const [memberForm, setMemberForm] = useState({ nom: '', email: '', password: '', role: 'membre' })
  const [categoryForm, setCategoryForm] = useState({ type: 'sortie', label: '', icon: '📦' })
  const [caisseForm, setCaisseForm] = useState({ nom: '', description: '', icon: '💰' })
  
  // === RÉINITIALISATION ===
  const [resetState, setResetState] = useState({
    mode: 'caisse', // 'caisse' | 'all' | 'orphans'
    withAmount: false,
    amount: '',
    confirm: ''
  })
  
  // === FILTRES ===
  const [filters, setFilters] = useState({
    period: 'tout',
    user: 'tous',
    search: ''
  })
  
  // === ERREURS ===
  const [errors, setErrors] = useState({ login: '', setup: '' })

  // === RACCOURCIS ===
  const { caisses, categories, transactions, team } = data
  const { isLoggedIn, currentUser, setupComplete, showSetup } = authState

  // === VÉRIFICATION AUTH AU DÉMARRAGE ===
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      const res = await fetch(`${API_URL}?action=check_setup`)
      const result = await res.json()
      
      let newState = { setupComplete: result.setupComplete, loading: false }
      
      if (!result.setupComplete) {
        const urlParams = new URLSearchParams(window.location.search)
        const key = urlParams.get('key')
        if (key) {
          setSetupKey(key)
          newState.showSetup = true
        }
      }
      
      // Vérifier session existante
      const savedUser = localStorage.getItem('manrina_user')
      const savedToken = localStorage.getItem('manrina_token')
      
      if (savedUser && savedToken) {
        newState.currentUser = JSON.parse(savedUser)
        newState.isLoggedIn = true
      }
      
      setAuthState(prev => ({ ...prev, ...newState }))
    } catch (err) {
      console.error('Erreur check auth:', err)
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }

  // === CHARGEMENT DONNÉES ===
  useEffect(() => {
    if (isLoggedIn) {
      loadData()
    }
  }, [isLoggedIn])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [teamRes, catRes, transRes, caissesRes] = await Promise.all([
        fetch(`${API_URL}?table=Equipe`),
        fetch(`${API_URL}?table=Categories`),
        fetch(`${API_URL}?table=Transactions&sort_field=Date&sort_direction=desc`),
        fetch(`${API_URL}?table=Caisses`)
      ])
      
      const [teamData, catData, transData, caissesData] = await Promise.all([
        teamRes.json(),
        catRes.json(),
        transRes.json(),
        caissesRes.json()
      ])
      
      // Parser équipe
      const parsedTeam = teamData.records?.map(r => ({
        id: r.id,
        name: r.fields.Nom || '',
        email: r.fields.Email || '',
        role: r.fields.Role || 'membre'
      })) || []
      
      // Parser caisses
      const parsedCaisses = caissesData.records?.map(r => ({
        id: r.id,
        nom: r.fields.Nom || '',
        description: r.fields.Description || '',
        icon: r.fields.Icon || '💰'
      })) || []
      
      // Parser catégories
      const parsedCategories = { entree: [], sortie: [] }
      catData.records?.forEach(r => {
        const type = r.fields.Type || 'sortie'
        parsedCategories[type].push({
          id: r.id,
          label: r.fields.Label || '',
          icon: r.fields.Icon || '📦'
        })
      })
      
      // Parser transactions
      const parsedTransactions = transData.records?.map(r => ({
        id: r.id,
        type: r.fields.Type || 'sortie',
        category: r.fields.Categorie?.[0] || '',
        amount: r.fields.Montant || 0,
        reason: r.fields.Motif || '',
        user: r.fields.Utilisateur?.[0] || '',
        date: r.fields.Date || '',
        note: r.fields.Note || '',
        caisse: r.fields.Caisse?.[0] || ''
      })) || []
      
      setData({
        team: parsedTeam,
        caisses: parsedCaisses,
        categories: parsedCategories,
        transactions: parsedTransactions
      })
      
      // Sélectionner première caisse si aucune sélectionnée
      if (!currentCaisse && parsedCaisses.length > 0) {
        setCurrentCaisse(parsedCaisses[0].id)
      }
    } catch (err) {
      console.error('Erreur chargement:', err)
    }
    setLoading(false)
  }, [currentCaisse])

  // === CALCULS MÉMOÏSÉS ===
  const filteredTransactions = useMemo(() => {
    let filtered = currentCaisse 
      ? transactions.filter(t => t.caisse === currentCaisse)
      : transactions
    
    const now = new Date()
    if (filters.period === 'jour') {
      const today = now.toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] === today)
    } else if (filters.period === 'semaine') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= weekAgo)
    } else if (filters.period === 'mois') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= monthAgo)
    }
    
    if (filters.user !== 'tous') {
      filtered = filtered.filter(t => t.user === filters.user)
    }
    
    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(t => 
        t.reason.toLowerCase().includes(q) || 
        t.note?.toLowerCase().includes(q) ||
        team.find(u => u.id === t.user)?.name.toLowerCase().includes(q)
      )
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, currentCaisse, filters, team])

  const orphanTransactions = useMemo(() => {
    const caisseIds = caisses.map(c => c.id)
    return transactions.filter(t => !t.caisse || !caisseIds.includes(t.caisse))
  }, [transactions, caisses])

  const soldeActuel = useMemo(() => {
    const currentTrans = currentCaisse 
      ? transactions.filter(t => t.caisse === currentCaisse)
      : transactions
    const entrees = currentTrans.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
    const sorties = currentTrans.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
    return entrees - sorties
  }, [transactions, currentCaisse])

  const totaux = useMemo(() => ({
    entrees: filteredTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0),
    sorties: filteredTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
  }), [filteredTransactions])

  const statsByCategory = useMemo(() => {
    const getStats = (type) => categories[type].map(cat => ({
      ...cat,
      total: filteredTransactions.filter(t => t.type === type && t.category === cat.id).reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.filter(t => t.type === type && t.category === cat.id).length
    })).filter(c => c.count > 0)
    
    return { entree: getStats('entree'), sortie: getStats('sortie') }
  }, [filteredTransactions, categories])

  const statsByUser = useMemo(() => {
    return team.map(u => ({
      id: u.id,
      name: u.name,
      entrees: filteredTransactions.filter(t => t.user === u.id && t.type === 'entree').reduce((sum, t) => sum + t.amount, 0),
      sorties: filteredTransactions.filter(t => t.user === u.id && t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.filter(t => t.user === u.id).length
    })).filter(u => u.count > 0)
  }, [filteredTransactions, team])

  // === HELPERS ===
  const getUserName = useCallback((userId) => {
    return team.find(u => u.id === userId)?.name || ''
  }, [team])

  const getCategoryInfo = useCallback((catId, type) => {
    return categories[type]?.find(c => c.id === catId) || { label: '', icon: '💰' }
  }, [categories])

  const getCaisseName = useCallback((caisseId) => {
    const caisse = caisses.find(c => c.id === caisseId)
    return caisse ? `${caisse.icon} ${caisse.nom}` : ''
  }, [caisses])

  const getTransactionsForCaisse = useCallback((caisseId) => {
    return transactions.filter(t => t.caisse === caisseId)
  }, [transactions])

  // === AUTHENTIFICATION ===
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrors(prev => ({ ...prev, login: '' }))
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
        localStorage.setItem('manrina_token', result.token)
        setAuthState(prev => ({ ...prev, currentUser: result.user, isLoggedIn: true }))
        setLoginForm({ email: '', password: '' })
      } else {
        setErrors(prev => ({ ...prev, login: result.error || 'Erreur de connexion' }))
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, login: 'Erreur de connexion' }))
    }
    
    setSaving(false)
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    setErrors(prev => ({ ...prev, setup: '' }))
    
    if (setupForm.password !== setupForm.confirmPassword) {
      setErrors(prev => ({ ...prev, setup: 'Les mots de passe ne correspondent pas' }))
      return
    }
    
    if (setupForm.password.length < 8) {
      setErrors(prev => ({ ...prev, setup: 'Le mot de passe doit contenir au moins 8 caractères' }))
      return
    }
    
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=setup&key=${setupKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: setupForm.nom,
          email: setupForm.email,
          password: setupForm.password
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        setAuthState(prev => ({ ...prev, setupComplete: true, showSetup: false }))
        window.history.replaceState({}, document.title, window.location.pathname)
        alert('Compte administrateur créé ! Vous pouvez maintenant vous connecter.')
      } else {
        setErrors(prev => ({ ...prev, setup: result.error || 'Erreur lors du setup' }))
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, setup: 'Erreur lors du setup' }))
    }
    
    setSaving(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('manrina_user')
    localStorage.removeItem('manrina_token')
    setAuthState(prev => ({ ...prev, currentUser: null, isLoggedIn: false }))
  }

  // === ACTIONS TRANSACTIONS ===
  const openModal = (type, editData = null) => {
    setModals(prev => ({ ...prev, [type]: true }))
    
    if (type === 'transaction') {
      if (editData) {
        setEditing(prev => ({ ...prev, transaction: editData }))
        setNewType(editData.type)
        const dateObj = editData.date ? new Date(editData.date) : new Date()
        setFormData({
          amount: editData.amount.toString(),
          reason: editData.reason,
          user: editData.user,
          category: editData.category,
          note: editData.note || '',
          date: dateObj.toISOString().split('T')[0],
          time: dateObj.toTimeString().slice(0, 5)
        })
      } else {
        setEditing(prev => ({ ...prev, transaction: null }))
        setNewType('sortie')
        const { date, time } = getCurrentDateTime()
        setFormData({ amount: '', reason: '', user: currentUser?.id || '', category: '', note: '', date, time })
      }
    }
  }

  const closeModal = (type) => {
    setModals(prev => ({ ...prev, [type]: false }))
    setEditing(prev => ({ ...prev, [type.replace('Modal', '')]: null }))
  }

  const handleTransactionSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || !formData.reason || !formData.user || !formData.category || !currentCaisse) return
    
    setSaving(true)
    
    const fields = {
      Motif: formData.reason,
      Montant: parseFloat(formData.amount),
      Type: newType,
      Categorie: [formData.category],
      Utilisateur: [formData.user],
      Date: toAirtableDateTime(formData.date, formData.time),
      Note: formData.note,
      Caisse: [currentCaisse]
    }
    
    try {
      const url = editing.transaction 
        ? `${API_URL}?table=Transactions&id=${editing.transaction.id}`
        : `${API_URL}?table=Transactions`
      
      await fetch(url, {
        method: editing.transaction ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
      
      await loadData()
      closeModal('transaction')
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert('Erreur lors de la sauvegarde')
    }
    
    setSaving(false)
  }

  const deleteTransaction = async (id) => {
    if (!confirm('Supprimer cette opération ?')) return
    
    try {
      await fetch(`${API_URL}?table=Transactions&id=${id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  // === ACTIONS MEMBRES ===
  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    if (!memberForm.nom || !memberForm.email || !memberForm.password) return
    
    setSaving(true)
    
    try {
      await fetch(`${API_URL}?action=create_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm)
      })
      
      await loadData()
      setMemberForm({ nom: '', email: '', password: '', role: 'membre' })
      closeModal('user')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la création')
    }
    
    setSaving(false)
  }

  const deleteUser = async (user) => {
    const admins = team.filter(u => u.role === 'admin')
    if (user.role === 'admin' && admins.length <= 1) {
      alert('Impossible : vous devez garder au moins un administrateur')
      return
    }
    
    if (transactions.some(t => t.user === user.id)) {
      alert('Impossible : cet utilisateur a des opérations enregistrées')
      return
    }
    
    if (!confirm(`Supprimer ${user.name} ?`)) return
    
    try {
      await fetch(`${API_URL}?table=Equipe&id=${user.id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  // === ACTIONS CAISSES ===
  const openCaisseModal = (caisse = null) => {
    setEditing(prev => ({ ...prev, caisse }))
    setCaisseForm(caisse 
      ? { nom: caisse.nom, description: caisse.description, icon: caisse.icon }
      : { nom: '', description: '', icon: '💰' }
    )
    setModals(prev => ({ ...prev, caisse: true }))
  }

  const handleCaisseSubmit = async (e) => {
    e.preventDefault()
    if (!caisseForm.nom) return
    
    setSaving(true)
    
    const fields = {
      Nom: caisseForm.nom,
      Description: caisseForm.description,
      Icon: caisseForm.icon
    }
    
    try {
      const url = editing.caisse 
        ? `${API_URL}?table=Caisses&id=${editing.caisse.id}`
        : `${API_URL}?table=Caisses`
      
      await fetch(url, {
        method: editing.caisse ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
      
      await loadData()
      closeModal('caisse')
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  const openDeleteCaisseModal = (caisse) => {
    setEditing(prev => ({ ...prev, caisseToDelete: caisse }))
    setModals(prev => ({ ...prev, deleteCaisse: true }))
  }

  const deleteCaisse = async (deleteOperations = false) => {
    const caisse = editing.caisseToDelete
    if (!caisse) return
    
    setSaving(true)
    
    try {
      // Supprimer les opérations si demandé
      if (deleteOperations) {
        const toDelete = transactions.filter(t => t.caisse === caisse.id)
        for (const t of toDelete) {
          await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
        }
      }
      
      // Supprimer la caisse
      await fetch(`${API_URL}?table=Caisses&id=${caisse.id}`, { method: 'DELETE' })
      
      if (currentCaisse === caisse.id) {
        setCurrentCaisse(caisses.find(c => c.id !== caisse.id)?.id || null)
      }
      
      await loadData()
      closeModal('deleteCaisse')
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  // === ACTIONS CATÉGORIES ===
  const openCategoryModal = (type, cat = null) => {
    setEditing(prev => ({ ...prev, category: cat ? { type, ...cat } : null }))
    setCategoryForm(cat 
      ? { type, label: cat.label, icon: cat.icon }
      : { type, label: '', icon: '📦' }
    )
    setModals(prev => ({ ...prev, category: true }))
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    if (!categoryForm.label.trim()) return
    
    setSaving(true)
    
    const fields = {
      Label: categoryForm.label,
      Icon: categoryForm.icon,
      Type: categoryForm.type
    }
    
    try {
      const url = editing.category 
        ? `${API_URL}?table=Categories&id=${editing.category.id}`
        : `${API_URL}?table=Categories`
      
      await fetch(url, {
        method: editing.category ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      })
      
      await loadData()
      closeModal('category')
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  const deleteCategory = async (type, cat) => {
    if (transactions.some(t => t.type === type && t.category === cat.id)) {
      alert('Impossible : cette catégorie est utilisée par des opérations')
      return
    }
    if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return
    
    try {
      await fetch(`${API_URL}?table=Categories&id=${cat.id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  // === RÉINITIALISATION AMÉLIORÉE ===
  const openResetModal = () => {
    setResetState({ mode: 'caisse', withAmount: false, amount: '', confirm: '' })
    setModals(prev => ({ ...prev, reset: true }))
  }

  const handleReset = async () => {
    if (resetState.confirm !== 'REINITIALISER') return
    
    setSaving(true)
    
    try {
      let transactionsToDelete = []
      
      if (resetState.mode === 'caisse' && currentCaisse) {
        // Réinitialiser cette caisse seulement
        transactionsToDelete = transactions.filter(t => t.caisse === currentCaisse)
      } else if (resetState.mode === 'all') {
        // Réinitialiser TOUTES les caisses
        transactionsToDelete = [...transactions]
      } else if (resetState.mode === 'orphans') {
        // Nettoyer seulement les orphelines
        transactionsToDelete = orphanTransactions
      }
      
      // Supprimer les transactions
      for (const t of transactionsToDelete) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
      
      // Ajouter montant de départ si demandé (seulement pour mode 'caisse')
      if (resetState.mode === 'caisse' && resetState.withAmount && parseFloat(resetState.amount) > 0 && currentCaisse) {
        let categoryId = categories.entree[0]?.id
        const fondCaisseCat = categories.entree.find(c => c.label.toLowerCase().includes('fond'))
        if (fondCaisseCat) categoryId = fondCaisseCat.id
        
        const userId = currentUser?.id || team[0]?.id
        
        if (categoryId && userId) {
          const fields = {
            Motif: 'Fond de caisse initial',
            Montant: parseFloat(resetState.amount),
            Type: 'entree',
            Categorie: [categoryId],
            Utilisateur: [userId],
            Date: new Date().toISOString(),
            Note: 'Réinitialisation avec montant de départ',
            Caisse: [currentCaisse]
          }
          
          await fetch(`${API_URL}?table=Transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
          })
        }
      }
      
      await loadData()
      closeModal('reset')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la réinitialisation')
    }
    
    setSaving(false)
  }

  // === ÉCRANS DE CHARGEMENT / AUTH ===
  if (authState.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🥭</div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // === PAGE SETUP ===
  if (!setupComplete && showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🥭</div>
            <h1 className="text-xl font-bold text-gray-800">Configuration initiale</h1>
            <p className="text-sm text-gray-500">Créez votre compte administrateur</p>
          </div>
          
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Nom</label>
              <input type="text" value={setupForm.nom} onChange={(e) => setSetupForm({...setupForm, nom: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input type="email" value={setupForm.email} onChange={(e) => setSetupForm({...setupForm, email: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
              <input type="password" value={setupForm.password} onChange={(e) => setSetupForm({...setupForm, password: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required minLength={8} />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Confirmer mot de passe</label>
              <input type="password" value={setupForm.confirmPassword} onChange={(e) => setSetupForm({...setupForm, confirmPassword: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required />
            </div>
            {errors.setup && <p className="text-red-500 text-sm text-center">{errors.setup}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold">
              {saving ? 'Création...' : 'Créer le compte admin'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // === PAGE LOGIN ===
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🥭</div>
            <h1 className="text-xl font-bold text-gray-800">Caisse Manrina</h1>
            <p className="text-sm text-gray-500">Connectez-vous pour continuer</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 bg-gray-100 rounded-xl" required />
            </div>
            {errors.login && <p className="text-red-500 text-sm text-center">{errors.login}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold">
              {saving ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🥭</div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // === APP PRINCIPALE ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl">🥭</div>
              <div>
                <h1 className="text-lg font-bold text-white">Caisse Manrina</h1>
                <p className="text-xs text-white/70">{currentUser?.nom} ({currentUser?.role})</p>
              </div>
            </div>
            <button onClick={handleLogout} className="px-3 py-1 bg-white/20 text-white text-sm rounded-lg">Déconnexion</button>
          </div>
          
          {/* Sélecteur caisse + Solde */}
          <div className="flex items-center justify-between mb-3 bg-white/10 rounded-xl p-3">
            <div className="flex-1">
              <p className="text-xs text-white/70 mb-1">Caisse active</p>
              <select
                value={currentCaisse || ''}
                onChange={(e) => setCurrentCaisse(e.target.value)}
                className="w-full bg-transparent text-white font-medium text-sm border-none outline-none"
              >
                <option value="" className="text-gray-800">Sélectionner...</option>
                {caisses.map(c => (
                  <option key={c.id} value={c.id} className="text-gray-800">{c.icon} {c.nom}</option>
                ))}
              </select>
            </div>
            <div className="text-right pl-4 border-l border-white/20">
              <p className="text-xs text-white/70">Solde</p>
              <p className={`text-xl font-bold ${soldeActuel >= 0 ? 'text-white' : 'text-red-200'}`}>
                {soldeActuel.toFixed(2)} €
              </p>
            </div>
          </div>

          {/* Alerte opérations orphelines */}
          {orphanTransactions.length > 0 && (
            <div className="bg-orange-500/20 border border-orange-300/30 rounded-xl p-3 mb-3">
              <p className="text-orange-100 text-sm">
                ⚠️ {orphanTransactions.length} opération(s) orpheline(s) détectée(s)
                <button 
                  onClick={() => { setResetState(prev => ({ ...prev, mode: 'orphans' })); openResetModal(); }}
                  className="ml-2 underline"
                >
                  Nettoyer
                </button>
              </p>
            </div>
          )}
          
          {/* Navigation */}
          <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24">
        
        {/* Message si pas de caisse */}
        {caisses.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center mb-4">
            <p className="text-gray-600 mb-4">Commencez par créer une caisse</p>
            <button onClick={() => openCaisseModal()} className="px-4 py-2 bg-teal-600 text-white rounded-xl font-medium">
              + Créer une caisse
            </button>
          </div>
        )}

        {/* === ONGLET MOUVEMENTS === */}
        {activeTab === 'mouvements' && currentCaisse && (
          <div className="space-y-4">
            {/* Filtres */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 space-y-3">
              <input
                type="text"
                placeholder="🔍 Rechercher..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-4 py-2 bg-white/20 border border-white/20 rounded-xl text-white placeholder-white/50 text-sm"
              />
              
              <div className="flex gap-2">
                <select
                  value={filters.period}
                  onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/20 rounded-xl text-white text-sm"
                >
                  <option value="tout" className="text-gray-800">Toutes dates</option>
                  <option value="jour" className="text-gray-800">Aujourd'hui</option>
                  <option value="semaine" className="text-gray-800">7 derniers jours</option>
                  <option value="mois" className="text-gray-800">30 derniers jours</option>
                </select>
                
                <select
                  value={filters.user}
                  onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/20 rounded-xl text-white text-sm"
                >
                  <option value="tous" className="text-gray-800">Tous</option>
                  {team.map(u => (
                    <option key={u.id} value={u.id} className="text-gray-800">{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Résumé */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-gray-500 mb-1">Entrées</p>
                <p className="text-xl font-bold text-emerald-600">+{totaux.entrees.toFixed(2)} €</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-gray-500 mb-1">Sorties</p>
                <p className="text-xl font-bold text-red-500">-{totaux.sorties.toFixed(2)} €</p>
              </div>
            </div>

            {/* Liste transactions */}
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
                  <p className="text-white/70">Aucune opération</p>
                </div>
              ) : (
                filteredTransactions.map(t => {
                  const catInfo = getCategoryInfo(t.category, t.type)
                  return (
                    <div key={t.id} className="bg-white rounded-2xl p-4 shadow-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => openModal('transaction', t)}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {catInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{t.reason}</p>
                            <p className="text-xs text-gray-400">{catInfo.label}</p>
                            <p className="text-xs text-gray-400 mt-1">{getUserName(t.user)} • {formatDateTime(t.date)}</p>
                            {t.note && <p className="text-xs text-gray-500 mt-1 italic">📝 {t.note}</p>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className={`font-bold ${t.type === 'entree' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {t.type === 'entree' ? '+' : '-'}{t.amount.toFixed(2)} €
                          </p>
                          <div className="flex gap-1">
                            <button onClick={() => openModal('transaction', t)} className="text-xs text-gray-400 hover:text-teal-500 p-1">✏️</button>
                            <button onClick={() => deleteTransaction(t.id)} className="text-xs text-gray-400 hover:text-red-500 p-1">🗑️</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* === ONGLET RÉSUMÉ === */}
        {activeTab === 'resume' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-3">📈 Entrées par catégorie</h3>
              {statsByCategory.entree.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune entrée</p>
              ) : (
                <div className="space-y-2">
                  {statsByCategory.entree.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center">
                      <span className="text-sm">{cat.icon} {cat.label}</span>
                      <span className="font-medium text-emerald-600">+{cat.total.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-3">📉 Sorties par catégorie</h3>
              {statsByCategory.sortie.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune sortie</p>
              ) : (
                <div className="space-y-2">
                  {statsByCategory.sortie.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center">
                      <span className="text-sm">{cat.icon} {cat.label}</span>
                      <span className="font-medium text-red-500">-{cat.total.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-3">👥 Par utilisateur</h3>
              {statsByUser.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune opération</p>
              ) : (
                <div className="space-y-3">
                  {statsByUser.map(u => (
                    <div key={u.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.count} opération(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-emerald-600">+{u.entrees.toFixed(2)} €</p>
                        <p className="text-xs text-red-500">-{u.sorties.toFixed(2)} €</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {currentCaisse && (
              <button onClick={openResetModal} className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-medium text-sm">
                ⚠️ Réinitialisation
              </button>
            )}
          </div>
        )}

        {/* === ONGLET ÉQUIPE === */}
        {activeTab === 'equipe' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">👥 Équipe</h3>
                {currentUser?.role === 'admin' && (
                  <button onClick={() => setModals(prev => ({ ...prev, user: true }))} className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium">
                    + Ajouter
                  </button>
                )}
              </div>
              
              {team.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucun membre</p>
              ) : (
                <div className="space-y-2">
                  {team.map(u => (
                    <div key={u.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white font-bold">
                          {u.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="font-medium">{u.name}</span>
                          <p className="text-xs text-gray-400">{u.email} • {u.role}</p>
                        </div>
                      </div>
                      {currentUser?.role === 'admin' && u.id !== currentUser?.id && (
                        <button onClick={() => deleteUser(u)} className="p-2 text-gray-400 hover:text-red-500">🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ONGLET PARAMÈTRES === */}
        {activeTab === 'parametres' && (
          <div className="space-y-4">
            {/* Caisses */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">💰 Caisses</h3>
                <button onClick={() => openCaisseModal()} className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium">
                  + Ajouter
                </button>
              </div>
              
              {caisses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucune caisse</p>
              ) : (
                <div className="space-y-2">
                  {caisses.map(c => {
                    const count = getTransactionsForCaisse(c.id).length
                    return (
                      <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{c.icon}</span>
                          <div>
                            <p className="font-medium">{c.nom}</p>
                            <p className="text-xs text-gray-400">
                              {c.description || `${count} opération(s)`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openCaisseModal(c)} className="p-2 text-gray-400 hover:text-teal-600">✏️</button>
                          <button onClick={() => openDeleteCaisseModal(c)} className="p-2 text-gray-400 hover:text-red-500">🗑️</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Catégories Entrées */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">📈 Catégories Entrées</h3>
                <button onClick={() => openCategoryModal('entree')} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                  + Ajouter
                </button>
              </div>
              
              {categories.entree.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucune catégorie</p>
              ) : (
                <div className="space-y-2">
                  {categories.entree.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="font-medium text-gray-700">{cat.label}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openCategoryModal('entree', cat)} className="p-2 text-gray-400 hover:text-teal-600">✏️</button>
                        <button onClick={() => deleteCategory('entree', cat)} className="p-2 text-gray-400 hover:text-red-500">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégories Sorties */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">📉 Catégories Sorties</h3>
                <button onClick={() => openCategoryModal('sortie')} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                  + Ajouter
                </button>
              </div>
              
              {categories.sortie.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucune catégorie</p>
              ) : (
                <div className="space-y-2">
                  {categories.sortie.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-3 bg-red-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="font-medium text-gray-700">{cat.label}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openCategoryModal('sortie', cat)} className="p-2 text-gray-400 hover:text-teal-600">✏️</button>
                        <button onClick={() => deleteCategory('sortie', cat)} className="p-2 text-gray-400 hover:text-red-500">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-4">🔧 Maintenance</h3>
              
              <div className="space-y-3">
                {orphanTransactions.length > 0 && (
                  <div className="p-3 bg-orange-50 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-orange-700">Opérations orphelines</p>
                        <p className="text-xs text-orange-600">{orphanTransactions.length} opération(s) sans caisse</p>
                      </div>
                      <button 
                        onClick={() => { setResetState(prev => ({ ...prev, mode: 'orphans', confirm: '' })); setModals(prev => ({ ...prev, reset: true })); }}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-sm"
                      >
                        Nettoyer
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => { setResetState(prev => ({ ...prev, mode: 'all', confirm: '' })); setModals(prev => ({ ...prev, reset: true })); }}
                  className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-medium text-sm"
                >
                  🗑️ Réinitialiser TOUTES les caisses
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bouton Ajouter */}
      {activeTab === 'mouvements' && currentCaisse && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center">
          <button onClick={() => openModal('transaction')} className="bg-white text-teal-700 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2">
            <span className="text-xl">+</span> Nouvelle opération
          </button>
        </div>
      )}

      {/* === MODAL TRANSACTION === */}
      {modals.transaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">{editing.transaction ? 'Modifier l\'opération' : 'Nouvelle opération'}</h2>
              <button onClick={() => closeModal('transaction')} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
            </div>
            
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              {/* Type */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => { setNewType('sortie'); setFormData(prev => ({ ...prev, category: '' })); }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${newType === 'sortie' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>
                  ➖ Sortie
                </button>
                <button type="button" onClick={() => { setNewType('entree'); setFormData(prev => ({ ...prev, category: '' })); }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${newType === 'entree' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>
                  ➕ Entrée
                </button>
              </div>

              {/* Catégorie */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Catégorie</label>
                {categories[newType].length === 0 ? (
                  <p className="text-gray-400 text-sm p-4 bg-gray-100 rounded-xl">
                    Aucune catégorie. <button type="button" onClick={() => { closeModal('transaction'); setActiveTab('parametres'); }} className="text-teal-600 underline">Créer une catégorie</button>
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {categories[newType].map(cat => (
                      <button key={cat.id} type="button" onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                        className={`p-3 rounded-xl text-left text-sm transition-all ${
                          formData.category === cat.id 
                            ? newType === 'entree' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500' : 'bg-red-100 text-red-700 ring-2 ring-red-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Montant */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Montant</label>
                <input type="number" step="0.01" placeholder="0.00 €" value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl text-2xl font-bold" required />
              </div>

              {/* Date et Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Date</label>
                  <input type="date" value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Heure</label>
                  <input type="time" value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
                </div>
              </div>

              {/* Utilisateur */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Opéré par</label>
                <select value={formData.user} onChange={(e) => setFormData(prev => ({ ...prev, user: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium" required>
                  <option value="">Sélectionner...</option>
                  {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Motif */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Motif</label>
                <input type="text" placeholder="Description de l'opération..." value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              </div>

              {/* Note */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Note (optionnel)</label>
                <input type="text" placeholder="Détails supplémentaires..." value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl" />
              </div>

              <button type="submit" disabled={!formData.category || saving}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  !formData.category || saving ? 'bg-gray-300 cursor-not-allowed' 
                    : newType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
                {saving ? 'Enregistrement...' : editing.transaction ? 'Enregistrer' : 'Valider'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL MEMBRE === */}
      {modals.user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Nouveau membre</h2>
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <input type="text" placeholder="Nom..." value={memberForm.nom}
                onChange={(e) => setMemberForm(prev => ({ ...prev, nom: e.target.value }))}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              <input type="email" placeholder="Email..." value={memberForm.email}
                onChange={(e) => setMemberForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              <input type="password" placeholder="Mot de passe..." value={memberForm.password}
                onChange={(e) => setMemberForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              <select value={memberForm.role} onChange={(e) => setMemberForm(prev => ({ ...prev, role: e.target.value }))}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium">
                <option value="membre">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => closeModal('user')} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium">
                  {saving ? '...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL CAISSE === */}
      {modals.caisse && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">{editing.caisse ? 'Modifier la caisse' : 'Nouvelle caisse'}</h2>
            <form onSubmit={handleCaisseSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom</label>
                <input type="text" placeholder="Ex: Marché Triple 8..." value={caisseForm.nom}
                  onChange={(e) => setCaisseForm(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Description (optionnel)</label>
                <input type="text" placeholder="Description..." value={caisseForm.description}
                  onChange={(e) => setCaisseForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Icône</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-xl max-h-32 overflow-y-auto">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setCaisseForm(prev => ({ ...prev, icon: emoji }))}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${caisseForm.icon === emoji ? 'bg-teal-500 scale-110' : 'bg-white hover:bg-gray-200'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                <span className="text-2xl">{caisseForm.icon}</span>
                <span className="font-medium">{caisseForm.nom || 'Aperçu'}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => closeModal('caisse')} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium">
                  {saving ? '...' : editing.caisse ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL SUPPRESSION CAISSE === */}
      {modals.deleteCaisse && editing.caisseToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">🗑️ Supprimer la caisse</h2>
            
            <p className="text-gray-600 mb-4">
              Caisse : <strong>{editing.caisseToDelete.icon} {editing.caisseToDelete.nom}</strong>
            </p>
            
            {getTransactionsForCaisse(editing.caisseToDelete.id).length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-orange-50 rounded-xl">
                  <p className="text-orange-700 text-sm">
                    ⚠️ Cette caisse contient <strong>{getTransactionsForCaisse(editing.caisseToDelete.id).length} opération(s)</strong>
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">Que voulez-vous faire ?</p>
                
                <div className="flex flex-col gap-2">
                  <button onClick={() => deleteCaisse(true)} disabled={saving}
                    className="w-full py-3 bg-red-600 text-white rounded-xl font-medium">
                    {saving ? '...' : 'Supprimer caisse ET opérations'}
                  </button>
                  <button onClick={() => closeModal('deleteCaisse')} className="w-full py-3 bg-gray-100 rounded-xl font-medium">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => closeModal('deleteCaisse')} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
                <button onClick={() => deleteCaisse(false)} disabled={saving} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium">
                  {saving ? '...' : 'Supprimer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODAL CATÉGORIE === */}
      {modals.category && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editing.category ? 'Modifier la catégorie' : `Nouvelle catégorie (${categoryForm.type === 'entree' ? 'Entrée' : 'Sortie'})`}
            </h2>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom</label>
                <input type="text" placeholder="Ex: Frais bancaires..." value={categoryForm.label}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium" required />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Icône</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-xl max-h-32 overflow-y-auto">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setCategoryForm(prev => ({ ...prev, icon: emoji }))}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${categoryForm.icon === emoji ? 'bg-teal-500 scale-110' : 'bg-white hover:bg-gray-200'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                <span className="text-2xl">{categoryForm.icon}</span>
                <span className="font-medium">{categoryForm.label || 'Aperçu'}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => closeModal('category')} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
                <button type="submit" disabled={saving}
                  className={`flex-1 py-3 text-white rounded-xl font-medium ${categoryForm.type === 'entree' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  {saving ? '...' : editing.category ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL RÉINITIALISATION === */}
      {modals.reset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-red-600 mb-4">⚠️ Réinitialisation</h2>
            
            {/* Mode de réinitialisation */}
            <div className="space-y-3 mb-4">
              {currentCaisse && (
                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                  <input type="radio" name="resetMode" checked={resetState.mode === 'caisse'}
                    onChange={() => setResetState(prev => ({ ...prev, mode: 'caisse' }))} className="w-5 h-5 mt-0.5 text-teal-600" />
                  <div>
                    <p className="font-medium">Cette caisse seulement</p>
                    <p className="text-xs text-gray-500">{getCaisseName(currentCaisse)} ({transactions.filter(t => t.caisse === currentCaisse).length} opérations)</p>
                  </div>
                </label>
              )}
              
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input type="radio" name="resetMode" checked={resetState.mode === 'all'}
                  onChange={() => setResetState(prev => ({ ...prev, mode: 'all' }))} className="w-5 h-5 mt-0.5 text-teal-600" />
                <div>
                  <p className="font-medium">TOUTES les caisses</p>
                  <p className="text-xs text-gray-500">{transactions.length} opérations au total</p>
                </div>
              </label>
              
              {orphanTransactions.length > 0 && (
                <label className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl cursor-pointer">
                  <input type="radio" name="resetMode" checked={resetState.mode === 'orphans'}
                    onChange={() => setResetState(prev => ({ ...prev, mode: 'orphans' }))} className="w-5 h-5 mt-0.5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-700">Opérations orphelines</p>
                    <p className="text-xs text-orange-600">{orphanTransactions.length} opération(s) sans caisse</p>
                  </div>
                </label>
              )}
            </div>

            {/* Option montant de départ (seulement pour mode 'caisse') */}
            {resetState.mode === 'caisse' && (
              <div className="mb-4">
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" checked={resetState.withAmount}
                    onChange={(e) => setResetState(prev => ({ ...prev, withAmount: e.target.checked }))}
                    className="w-5 h-5 text-teal-600 rounded" />
                  <span className="text-sm font-medium">Avec montant de départ</span>
                </label>
                
                {resetState.withAmount && (
                  <input type="number" step="0.01" placeholder="Ex: 200.00 €" value={resetState.amount}
                    onChange={(e) => setResetState(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full p-4 bg-gray-100 rounded-xl text-xl font-bold" />
                )}
              </div>
            )}

            {/* Confirmation */}
            <p className="text-sm text-gray-600 mb-2">Tapez <strong>REINITIALISER</strong> pour confirmer :</p>
            <input type="text" value={resetState.confirm}
              onChange={(e) => setResetState(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full p-4 bg-gray-100 rounded-xl font-mono mb-4" placeholder="REINITIALISER" />
            
            <div className="flex gap-2">
              <button onClick={() => closeModal('reset')} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">Annuler</button>
              <button onClick={handleReset}
                disabled={resetState.confirm !== 'REINITIALISER' || saving || (resetState.mode === 'caisse' && resetState.withAmount && !resetState.amount)}
                className={`flex-1 py-3 rounded-xl font-medium ${
                  resetState.confirm === 'REINITIALISER' && !saving ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}>
                {saving ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
