import { useState, useEffect } from 'react'

// === API CONFIG ===
const API_URL = '/api.php'

// === EMOJIS DISPONIBLES ===
const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '➕', '➖', '🏪', '🚚', '🍳']

// === HELPERS FORMAT DATE ===
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const jour = date.getDate().toString().padStart(2, '0')
  const mois = (date.getMonth() + 1).toString().padStart(2, '0')
  const annee = date.getFullYear()
  return `${jour}/${mois}/${annee}`
}

const formatTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const heures = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${heures}h${minutes}`
}

const formatDateTime = (dateString) => {
  if (!dateString) return ''
  return `${formatDate(dateString)} à ${formatTime(dateString)}`
}

const toAirtableDateTime = (dateStr, timeStr) => {
  if (!dateStr) return new Date().toISOString()
  const [year, month, day] = dateStr.split('-')
  const [hours, minutes] = timeStr ? timeStr.split(':') : ['12', '00']
  const date = new Date(year, month - 1, day, hours, minutes)
  return date.toISOString()
}

function App() {
  // === ÉTATS AUTH ===
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  
  // === ÉTATS APP ===
  const [activeTab, setActiveTab] = useState('mouvements')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // === DONNÉES ===
  const [caisses, setCaisses] = useState([])
  const [currentCaisse, setCurrentCaisse] = useState(null)
  const [categories, setCategories] = useState({ entree: [], sortie: [] })
  const [transactions, setTransactions] = useState([])
  const [team, setTeam] = useState([])
  
  // === MODALS ===
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showCaisseModal, setShowCaisseModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingCaisse, setEditingCaisse] = useState(null)
  
  // === FORMULAIRES ===
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [setupForm, setSetupForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const [setupKey, setSetupKey] = useState('')
  const [newType, setNewType] = useState('sortie')
  const [formData, setFormData] = useState({ amount: '', reason: '', user: '', category: '', note: '', date: '', time: '' })
  const [newMemberForm, setNewMemberForm] = useState({ nom: '', email: '', password: '', role: 'membre' })
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetMode, setResetMode] = useState('zero')
  const [resetAmount, setResetAmount] = useState('')
  const [categoryForm, setCategoryForm] = useState({ type: 'sortie', label: '', icon: '📦' })
  const [caisseForm, setCaisseForm] = useState({ nom: '', description: '', icon: '💰' })
  
  // === FILTRES ===
  const [filterPeriod, setFilterPeriod] = useState('tout')
  const [filterUser, setFilterUser] = useState('tous')
  const [searchQuery, setSearchQuery] = useState('')
  const [loginError, setLoginError] = useState('')
  const [setupError, setSetupError] = useState('')

  // === VÉRIFICATION AUTH AU DÉMARRAGE ===
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setAuthLoading(true)
    
    // Vérifier si setup nécessaire
    try {
      const res = await fetch(`${API_URL}?action=check_setup`)
      const data = await res.json()
      setSetupComplete(data.setupComplete)
      
      if (!data.setupComplete) {
        // Vérifier si clé dans URL
        const urlParams = new URLSearchParams(window.location.search)
        const key = urlParams.get('key')
        if (key) {
          setSetupKey(key)
          setShowSetup(true)
        }
      }
    } catch (err) {
      console.error('Erreur check setup:', err)
    }
    
    // Vérifier si déjà connecté
    const savedUser = localStorage.getItem('manrina_user')
    const savedToken = localStorage.getItem('manrina_token')
    
    if (savedUser && savedToken) {
      setCurrentUser(JSON.parse(savedUser))
      setIsLoggedIn(true)
    }
    
    setAuthLoading(false)
  }

  // === CHARGEMENT DONNÉES ===
  useEffect(() => {
    if (isLoggedIn) {
      loadData()
    }
  }, [isLoggedIn, currentCaisse])

  const loadData = async () => {
    setLoading(true)
    try {
      const [teamRes, catRes, transRes, caissesRes] = await Promise.all([
        fetch(`${API_URL}?table=Equipe`),
        fetch(`${API_URL}?table=Categories`),
        fetch(`${API_URL}?table=Transactions&sort_field=Date&sort_direction=desc`),
        fetch(`${API_URL}?table=Caisses`)
      ])
      
      const teamData = await teamRes.json()
      const catData = await catRes.json()
      const transData = await transRes.json()
      const caissesData = await caissesRes.json()
      
      // Équipe
      if (teamData.records) {
        setTeam(teamData.records.map(r => ({
          id: r.id,
          name: r.fields.Nom || '',
          email: r.fields.Email || '',
          role: r.fields.Role || 'membre'
        })))
      }
      
      // Caisses
      if (caissesData.records) {
        const loadedCaisses = caissesData.records.map(r => ({
          id: r.id,
          nom: r.fields.Nom || '',
          description: r.fields.Description || '',
          icon: r.fields.Icon || '💰'
        }))
        setCaisses(loadedCaisses)
        
        // Sélectionner la première caisse par défaut
        if (!currentCaisse && loadedCaisses.length > 0) {
          setCurrentCaisse(loadedCaisses[0].id)
        }
      }
      
      // Catégories
      if (catData.records) {
        const cats = { entree: [], sortie: [] }
        catData.records.forEach(r => {
          const type = r.fields.Type || 'sortie'
          cats[type].push({
            id: r.id,
            label: r.fields.Label || '',
            icon: r.fields.Icon || '📦'
          })
        })
        setCategories(cats)
      }
      
      // Transactions
      if (transData.records) {
        setTransactions(transData.records.map(r => ({
          id: r.id,
          type: r.fields.Type || 'sortie',
          category: r.fields.Categorie?.[0] || '',
          amount: r.fields.Montant || 0,
          reason: r.fields.Motif || '',
          user: r.fields.Utilisateur?.[0] || '',
          date: r.fields.Date || '',
          note: r.fields.Note || '',
          caisse: r.fields.Caisse?.[0] || ''
        })))
      }
    } catch (err) {
      console.error('Erreur chargement:', err)
    }
    setLoading(false)
  }

  // === AUTHENTIFICATION ===
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      
      const data = await res.json()
      
      if (data.success) {
        localStorage.setItem('manrina_user', JSON.stringify(data.user))
        localStorage.setItem('manrina_token', data.token)
        setCurrentUser(data.user)
        setIsLoggedIn(true)
        setLoginForm({ email: '', password: '' })
      } else {
        setLoginError(data.error || 'Erreur de connexion')
      }
    } catch (err) {
      setLoginError('Erreur de connexion')
    }
    
    setSaving(false)
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    setSetupError('')
    
    if (setupForm.password !== setupForm.confirmPassword) {
      setSetupError('Les mots de passe ne correspondent pas')
      return
    }
    
    if (setupForm.password.length < 8) {
      setSetupError('Le mot de passe doit contenir au moins 8 caractères')
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
      
      const data = await res.json()
      
      if (data.success) {
        setSetupComplete(true)
        setShowSetup(false)
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname)
        alert('Compte administrateur créé ! Vous pouvez maintenant vous connecter.')
      } else {
        setSetupError(data.error || 'Erreur lors du setup')
      }
    } catch (err) {
      setSetupError('Erreur lors du setup')
    }
    
    setSaving(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('manrina_user')
    localStorage.removeItem('manrina_token')
    setCurrentUser(null)
    setIsLoggedIn(false)
  }

  // === HELPERS ===
  const getUserName = (userId) => {
    const user = team.find(u => u.id === userId)
    return user?.name || ''
  }

  const getCategoryInfo = (catId, type) => {
    const cat = categories[type]?.find(c => c.id === catId)
    return cat || { label: '', icon: '💰' }
  }

  const getCaisseName = (caisseId) => {
    const caisse = caisses.find(c => c.id === caisseId)
    return caisse ? `${caisse.icon} ${caisse.nom}` : ''
  }

  // === CALCULS ===
  const getTransactionsForCurrentCaisse = () => {
    if (!currentCaisse) return transactions
    return transactions.filter(t => t.caisse === currentCaisse)
  }

  const filterTransactions = () => {
    let filtered = getTransactionsForCurrentCaisse()
    
    const now = new Date()
    if (filterPeriod === 'jour') {
      const today = now.toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] === today)
    } else if (filterPeriod === 'semaine') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= weekAgo)
    } else if (filterPeriod === 'mois') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date?.split('T')[0] >= monthAgo)
    }
    
    if (filterUser !== 'tous') {
      filtered = filtered.filter(t => t.user === filterUser)
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.reason.toLowerCase().includes(q) || 
        t.note?.toLowerCase().includes(q) ||
        getUserName(t.user).toLowerCase().includes(q)
      )
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const filteredTransactions = filterTransactions()
  const currentCaisseTransactions = getTransactionsForCurrentCaisse()
  
  const totalEntrees = filteredTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
  const totalSorties = filteredTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
  const soldeActuel = currentCaisseTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0) - currentCaisseTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)

  const getStatsByCategory = (type) => {
    const cats = categories[type]
    return cats.map(cat => ({
      ...cat,
      total: filteredTransactions.filter(t => t.type === type && t.category === cat.id).reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.filter(t => t.type === type && t.category === cat.id).length
    })).filter(c => c.count > 0)
  }

  const getStatsByUser = () => {
    return team.map(u => ({
      id: u.id,
      name: u.name,
      entrees: filteredTransactions.filter(t => t.user === u.id && t.type === 'entree').reduce((sum, t) => sum + t.amount, 0),
      sorties: filteredTransactions.filter(t => t.user === u.id && t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.filter(t => t.user === u.id).length
    })).filter(u => u.count > 0)
  }

  // === ACTIONS TRANSACTIONS ===
  const openNewTransaction = () => {
    setEditingTransaction(null)
    setNewType('sortie')
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().slice(0, 5)
    setFormData({ amount: '', reason: '', user: currentUser?.id || '', category: '', note: '', date: dateStr, time: timeStr })
    setShowModal(true)
  }

  const openEditTransaction = (t) => {
    setEditingTransaction(t)
    setNewType(t.type)
    const dateObj = t.date ? new Date(t.date) : new Date()
    const dateStr = dateObj.toISOString().split('T')[0]
    const timeStr = dateObj.toTimeString().slice(0, 5)
    setFormData({
      amount: t.amount.toString(),
      reason: t.reason,
      user: t.user,
      category: t.category,
      note: t.note || '',
      date: dateStr,
      time: timeStr
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || !formData.reason || !formData.user || !formData.category || !currentCaisse) return
    
    setSaving(true)
    
    const dateTime = toAirtableDateTime(formData.date, formData.time)
    
    const fields = {
      Motif: formData.reason,
      Montant: parseFloat(formData.amount),
      Type: newType,
      Categorie: [formData.category],
      Utilisateur: [formData.user],
      Date: dateTime,
      Note: formData.note,
      Caisse: [currentCaisse]
    }
    
    try {
      if (editingTransaction) {
        await fetch(`${API_URL}?table=Transactions&id=${editingTransaction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setFormData({ amount: '', reason: '', user: '', category: '', note: '', date: '', time: '' })
      setEditingTransaction(null)
      setShowModal(false)
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
  const openNewMember = () => {
    setEditingUser(null)
    setNewMemberForm({ nom: '', email: '', password: '', role: 'membre' })
    setShowUserModal(true)
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    if (!newMemberForm.nom || !newMemberForm.email || !newMemberForm.password) return
    
    setSaving(true)
    
    try {
      await fetch(`${API_URL}?action=create_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemberForm)
      })
      
      await loadData()
      setNewMemberForm({ nom: '', email: '', password: '', role: 'membre' })
      setShowUserModal(false)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la création')
    }
    
    setSaving(false)
  }

  const deleteUser = async (user) => {
    // Vérifier si c'est le dernier admin
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
  const openNewCaisse = () => {
    setEditingCaisse(null)
    setCaisseForm({ nom: '', description: '', icon: '💰' })
    setShowCaisseModal(true)
  }

  const openEditCaisse = (caisse) => {
    setEditingCaisse(caisse)
    setCaisseForm({ nom: caisse.nom, description: caisse.description, icon: caisse.icon })
    setShowCaisseModal(true)
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
      if (editingCaisse) {
        await fetch(`${API_URL}?table=Caisses&id=${editingCaisse.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Caisses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setCaisseForm({ nom: '', description: '', icon: '💰' })
      setEditingCaisse(null)
      setShowCaisseModal(false)
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  const deleteCaisse = async (caisse) => {
    if (transactions.some(t => t.caisse === caisse.id)) {
      alert('Impossible : cette caisse a des opérations enregistrées')
      return
    }
    if (!confirm(`Supprimer la caisse "${caisse.nom}" ?`)) return
    
    try {
      await fetch(`${API_URL}?table=Caisses&id=${caisse.id}`, { method: 'DELETE' })
      if (currentCaisse === caisse.id) {
        setCurrentCaisse(null)
      }
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  // === ACTIONS CATÉGORIES ===
  const openNewCategory = (type) => {
    setEditingCategory(null)
    setCategoryForm({ type, label: '', icon: '📦' })
    setShowCategoryModal(true)
  }

  const openEditCategory = (type, cat) => {
    setEditingCategory({ type, ...cat })
    setCategoryForm({ type, label: cat.label, icon: cat.icon })
    setShowCategoryModal(true)
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
      if (editingCategory) {
        await fetch(`${API_URL}?table=Categories&id=${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setCategoryForm({ type: 'sortie', label: '', icon: '📦' })
      setEditingCategory(null)
      setShowCategoryModal(false)
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

  // === RESET ===
  const openResetModal = () => {
    setResetMode('zero')
    setResetAmount('')
    setResetConfirm('')
    setShowResetModal(true)
  }

  const handleReset = async () => {
    if (resetConfirm !== 'REINITIALISER') return
    
    setSaving(true)
    
    try {
      // Supprimer les transactions de la caisse actuelle
      const toDelete = transactions.filter(t => t.caisse === currentCaisse)
      for (const t of toDelete) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
      
      // Si montant de départ
      if (resetMode === 'montant' && parseFloat(resetAmount) > 0) {
        let categoryId = categories.entree[0]?.id
        const fondCaisseCat = categories.entree.find(c => c.label.toLowerCase().includes('fond'))
        if (fondCaisseCat) categoryId = fondCaisseCat.id
        
        const userId = currentUser?.id || team[0]?.id
        
        if (categoryId && userId && currentCaisse) {
          const fields = {
            Motif: 'Fond de caisse initial',
            Montant: parseFloat(resetAmount),
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
      setResetConfirm('')
      setResetAmount('')
      setShowResetModal(false)
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  // === LOADING SCREEN ===
  if (authLoading) {
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
              <input
                type="text"
                value={setupForm.nom}
                onChange={(e) => setSetupForm({...setupForm, nom: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={setupForm.email}
                onChange={(e) => setSetupForm({...setupForm, email: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={setupForm.password}
                onChange={(e) => setSetupForm({...setupForm, password: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
                minLength={8}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Confirmer mot de passe</label>
              <input
                type="password"
                value={setupForm.confirmPassword}
                onChange={(e) => setSetupForm({...setupForm, confirmPassword: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
              />
            </div>
            
            {setupError && (
              <p className="text-red-500 text-sm text-center">{setupError}</p>
            )}
            
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold"
            >
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
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full p-3 bg-gray-100 rounded-xl"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}
            
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold"
            >
              {saving ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // === APP PRINCIPALE ===
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          {/* Ligne 1: Logo + User */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl">🥭</div>
              <div>
                <h1 className="text-lg font-bold text-white">Caisse Manrina</h1>
                <p className="text-xs text-white/70">{currentUser?.nom} ({currentUser?.role})</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-white/20 text-white text-sm rounded-lg"
            >
              Déconnexion
            </button>
          </div>
          
          {/* Ligne 2: Sélecteur de caisse + Solde */}
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
          
          {/* Navigation */}
          <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
            {[
              { id: 'mouvements', label: '📋 Opérations' },
              { id: 'resume', label: '📊 Résumé' },
              { id: 'equipe', label: '👥 Équipe' },
              { id: 'parametres', label: '⚙️ Paramètres' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-white/80 hover:bg-white/10'
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
            <button
              onClick={openNewCaisse}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl font-medium"
            >
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/20 rounded-xl text-white placeholder-white/50 text-sm"
              />
              
              <div className="flex gap-2">
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/20 rounded-xl text-white text-sm"
                >
                  <option value="tout" className="text-gray-800">Toutes dates</option>
                  <option value="jour" className="text-gray-800">Aujourd'hui</option>
                  <option value="semaine" className="text-gray-800">7 derniers jours</option>
                  <option value="mois" className="text-gray-800">30 derniers jours</option>
                </select>
                
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/20 border border-white/20 rounded-xl text-white text-sm"
                >
                  <option value="tous" className="text-gray-800">Tous</option>
                  {team.map(u => (
                    <option key={u.id} value={u.id} className="text-gray-800">{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Résumé rapide */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-gray-500 mb-1">Entrées</p>
                <p className="text-xl font-bold text-emerald-600">+{totalEntrees.toFixed(2)} €</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-gray-500 mb-1">Sorties</p>
                <p className="text-xl font-bold text-red-500">-{totalSorties.toFixed(2)} €</p>
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
                        <div 
                          className="flex items-start gap-3 flex-1 cursor-pointer"
                          onClick={() => openEditTransaction(t)}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                            t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'
                          }`}>
                            {catInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{t.reason}</p>
                            <p className="text-xs text-gray-400">{catInfo.label}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {getUserName(t.user)} • {formatDateTime(t.date)}
                            </p>
                            {t.note && (
                              <p className="text-xs text-gray-500 mt-1 italic">📝 {t.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className={`font-bold ${t.type === 'entree' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {t.type === 'entree' ? '+' : '-'}{t.amount.toFixed(2)} €
                          </p>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => openEditTransaction(t)}
                              className="text-xs text-gray-400 hover:text-teal-500 p-1"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => deleteTransaction(t.id)}
                              className="text-xs text-gray-400 hover:text-red-500 p-1"
                            >
                              🗑️
                            </button>
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
              {getStatsByCategory('entree').length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune entrée</p>
              ) : (
                <div className="space-y-2">
                  {getStatsByCategory('entree').map(cat => (
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
              {getStatsByCategory('sortie').length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune sortie</p>
              ) : (
                <div className="space-y-2">
                  {getStatsByCategory('sortie').map(cat => (
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
              {getStatsByUser().length === 0 ? (
                <p className="text-gray-400 text-sm">Aucune opération</p>
              ) : (
                <div className="space-y-3">
                  {getStatsByUser().map(u => (
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
              <button
                onClick={openResetModal}
                className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-medium text-sm"
              >
                ⚠️ Réinitialiser cette caisse
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
                  <button
                    onClick={openNewMember}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium"
                  >
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
                        <button
                          onClick={() => deleteUser(u)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          🗑️
                        </button>
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
                <button
                  onClick={openNewCaisse}
                  className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium"
                >
                  + Ajouter
                </button>
              </div>
              
              {caisses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucune caisse</p>
              ) : (
                <div className="space-y-2">
                  {caisses.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{c.icon}</span>
                        <div>
                          <p className="font-medium">{c.nom}</p>
                          {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditCaisse(c)}
                          className="p-2 text-gray-400 hover:text-teal-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteCaisse(c)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégories Entrées */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">📈 Catégories Entrées</h3>
                <button
                  onClick={() => openNewCategory('entree')}
                  className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium"
                >
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
                        <button
                          onClick={() => openEditCategory('entree', cat)}
                          className="p-2 text-gray-400 hover:text-teal-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteCategory('entree', cat)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          🗑️
                        </button>
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
                <button
                  onClick={() => openNewCategory('sortie')}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium"
                >
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
                        <button
                          onClick={() => openEditCategory('sortie', cat)}
                          className="p-2 text-gray-400 hover:text-teal-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteCategory('sortie', cat)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bouton Ajouter (fixe) */}
      {activeTab === 'mouvements' && currentCaisse && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center">
          <button 
            onClick={openNewTransaction}
            className="bg-white text-teal-700 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2"
          >
            <span className="text-xl">+</span> Nouvelle opération
          </button>
        </div>
      )}

      {/* === MODAL TRANSACTION === */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">
                {editingTransaction ? 'Modifier l\'opération' : 'Nouvelle opération'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingTransaction(null); }} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={() => { setNewType('sortie'); setFormData({...formData, category: ''}); }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                    newType === 'sortie' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  ➖ Sortie
                </button>
                <button 
                  type="button"
                  onClick={() => { setNewType('entree'); setFormData({...formData, category: ''}); }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                    newType === 'entree' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  ➕ Entrée
                </button>
              </div>

              {/* Catégorie */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Catégorie</label>
                {categories[newType].length === 0 ? (
                  <p className="text-gray-400 text-sm p-4 bg-gray-100 rounded-xl">
                    Aucune catégorie. <button type="button" onClick={() => { setShowModal(false); setActiveTab('parametres'); }} className="text-teal-600 underline">Créer une catégorie</button>
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {categories[newType].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({...formData, category: cat.id})}
                        className={`p-3 rounded-xl text-left text-sm transition-all ${
                          formData.category === cat.id 
                            ? newType === 'entree' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500' : 'bg-red-100 text-red-700 ring-2 ring-red-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Montant */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Montant</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00 €"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl text-2xl font-bold"
                  required
                />
              </div>

              {/* Date et Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Heure</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Utilisateur */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Opéré par</label>
                <select
                  value={formData.user}
                  onChange={(e) => setFormData({...formData, user: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {team.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Motif */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Motif</label>
                <input
                  type="text"
                  placeholder="Description de l'opération..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                  required
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Note (optionnel)</label>
                <input
                  type="text"
                  placeholder="Détails supplémentaires..."
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                />
              </div>

              {/* Valider */}
              <button
                type="submit"
                disabled={!formData.category || saving}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  !formData.category || saving
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : newType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {saving ? 'Enregistrement...' : editingTransaction ? 'Enregistrer' : 'Valider'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL MEMBRE === */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Nouveau membre</h2>
            
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nom..."
                value={newMemberForm.nom}
                onChange={(e) => setNewMemberForm({...newMemberForm, nom: e.target.value})}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                required
              />
              
              <input
                type="email"
                placeholder="Email..."
                value={newMemberForm.email}
                onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                required
              />
              
              <input
                type="password"
                placeholder="Mot de passe..."
                value={newMemberForm.password}
                onChange={(e) => setNewMemberForm({...newMemberForm, password: e.target.value})}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                required
              />
              
              <select
                value={newMemberForm.role}
                onChange={(e) => setNewMemberForm({...newMemberForm, role: e.target.value})}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium"
              >
                <option value="membre">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL CAISSE === */}
      {showCaisseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingCaisse ? 'Modifier la caisse' : 'Nouvelle caisse'}
            </h2>
            
            <form onSubmit={handleCaisseSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom</label>
                <input
                  type="text"
                  placeholder="Ex: Marché Triple 8..."
                  value={caisseForm.nom}
                  onChange={(e) => setCaisseForm({...caisseForm, nom: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Description (optionnel)</label>
                <input
                  type="text"
                  placeholder="Description..."
                  value={caisseForm.description}
                  onChange={(e) => setCaisseForm({...caisseForm, description: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">Icône</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-xl max-h-32 overflow-y-auto">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCaisseForm({...caisseForm, icon: emoji})}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        caisseForm.icon === emoji 
                          ? 'bg-teal-500 scale-110' 
                          : 'bg-white hover:bg-gray-200'
                      }`}
                    >
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
                <button
                  type="button"
                  onClick={() => { setShowCaisseModal(false); setEditingCaisse(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : editingCaisse ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL CATÉGORIE === */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingCategory ? 'Modifier la catégorie' : `Nouvelle catégorie (${categoryForm.type === 'entree' ? 'Entrée' : 'Sortie'})`}
            </h2>
            
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom</label>
                <input
                  type="text"
                  placeholder="Ex: Frais bancaires..."
                  value={categoryForm.label}
                  onChange={(e) => setCategoryForm({...categoryForm, label: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">Icône</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-xl max-h-32 overflow-y-auto">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCategoryForm({...categoryForm, icon: emoji})}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        categoryForm.icon === emoji 
                          ? 'bg-teal-500 scale-110' 
                          : 'bg-white hover:bg-gray-200'
                      }`}
                    >
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
                <button
                  type="button"
                  onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-3 text-white rounded-xl font-medium ${
                    categoryForm.type === 'entree' ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                >
                  {saving ? '...' : editingCategory ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL RÉINITIALISATION === */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">⚠️ Réinitialiser la caisse</h2>
            
            <p className="text-sm text-gray-600 mb-4">
              Caisse : <strong>{getCaisseName(currentCaisse)}</strong>
            </p>
            
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetMode === 'zero'}
                  onChange={() => setResetMode('zero')}
                  className="w-5 h-5 text-teal-600"
                />
                <div>
                  <p className="font-medium">Remettre à zéro</p>
                  <p className="text-xs text-gray-500">Solde = 0 €</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetMode === 'montant'}
                  onChange={() => setResetMode('montant')}
                  className="w-5 h-5 text-teal-600"
                />
                <div>
                  <p className="font-medium">Avec montant de départ</p>
                  <p className="text-xs text-gray-500">Définir un fond de caisse</p>
                </div>
              </label>
            </div>

            {resetMode === 'montant' && (
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 200.00"
                  value={resetAmount}
                  onChange={(e) => setResetAmount(e.target.value)}
                  className="w-full p-4 bg-gray-100 rounded-xl text-xl font-bold"
                />
              </div>
            )}

            <p className="text-sm text-gray-600 mb-4">
              Tapez <strong>REINITIALISER</strong> pour confirmer :
            </p>
            
            <input
              type="text"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="w-full p-4 bg-gray-100 rounded-xl font-mono mb-4"
              placeholder="REINITIALISER"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirm(''); setResetAmount(''); }}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                disabled={resetConfirm !== 'REINITIALISER' || saving || (resetMode === 'montant' && !resetAmount)}
                className={`flex-1 py-3 rounded-xl font-medium ${
                  resetConfirm === 'REINITIALISER' && !saving && (resetMode === 'zero' || resetAmount)
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
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
