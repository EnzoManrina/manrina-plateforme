import { useState, useEffect, useMemo, useCallback } from 'react'
import { getCache, setCache, clearCache, formatDate, formatTime, formatDateTime, toAirtableDateTime, EMOJIS } from './old/api_old'

const API_URL = '/api.php'

export default function Caisse({ currentUser, onLogout, onBack }) {
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
  
  // === MENU FAB ===
  const [menuOpen, setMenuOpen] = useState(false)
  
  // === MODALS ===
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showCaisseModal, setShowCaisseModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingCaisse, setEditingCaisse] = useState(null)
  
  // === FORMULAIRES ===
  const [newType, setNewType] = useState('sortie')
  const [formData, setFormData] = useState({ amount: '', reason: '', user: '', category: '', note: '', date: '', time: '', isPrevue: false })
  const [newMemberForm, setNewMemberForm] = useState({ nom: '', email: '', password: '', role: 'membre' })
  const [memberError, setMemberError] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetMode, setResetMode] = useState('zero')
  const [resetAmount, setResetAmount] = useState('')
  const [categoryForm, setCategoryForm] = useState({ type: 'sortie', label: '', icon: '📦' })
  const [caisseForm, setCaisseForm] = useState({ nom: '', description: '', icon: '💰' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  
  // === FILTRES ===
  const [filterPeriod, setFilterPeriod] = useState('tout')
  const [filterUser, setFilterUser] = useState('tous')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPrevues, setShowPrevues] = useState(true)

  // === CHARGEMENT DONNÉES ===
  useEffect(() => {
    loadData()
  }, [])

  const loadData = useCallback(async (useCache = true) => {
    if (useCache) {
      const cached = getCache()
      if (cached) {
        setCaisses(cached.caisses || [])
        setCategories(cached.categories || { entree: [], sortie: [] })
        setTransactions(cached.transactions || [])
        setTeam(cached.team || [])
        if (!currentCaisse && cached.caisses?.length > 0) {
          setCurrentCaisse(cached.caisses[0].id)
        }
        setLoading(false)
      }
    }
    
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
      
      let loadedTeam = []
      let loadedCaisses = []
      let loadedCategories = { entree: [], sortie: [] }
      let loadedTransactions = []
      
      if (teamData.records) {
        loadedTeam = teamData.records.map(r => ({
          id: r.id,
          name: r.fields.Nom || '',
          email: r.fields.Email || '',
          role: r.fields.Role || 'membre'
        }))
        setTeam(loadedTeam)
      }
      
      if (caissesData.records) {
        loadedCaisses = caissesData.records.map(r => ({
          id: r.id,
          nom: r.fields.Nom || '',
          description: r.fields.Description || '',
          icon: r.fields.Icon || '💰'
        }))
        setCaisses(loadedCaisses)
        
        if (!currentCaisse && loadedCaisses.length > 0) {
          setCurrentCaisse(loadedCaisses[0].id)
        }
      }
      
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
        loadedCategories = cats
        setCategories(cats)
      }
      
      if (transData.records) {
        loadedTransactions = transData.records.map(r => ({
          id: r.id,
          type: r.fields.Type || 'sortie',
          category: r.fields.Categorie?.[0] || '',
          amount: r.fields.Montant || 0,
          reason: r.fields.Motif || '',
          user: r.fields.Utilisateur?.[0] || '',
          date: r.fields.Date || '',
          note: r.fields.Note || '',
          caisse: r.fields.Caisse?.[0] || '',
          statut: r.fields.Statut || 'effectuee'
        }))
        setTransactions(loadedTransactions)
      }
      
      setCache({
        team: loadedTeam,
        caisses: loadedCaisses,
        categories: loadedCategories,
        transactions: loadedTransactions
      })
      
    } catch (err) {
      console.error('Erreur chargement:', err)
    }
    setLoading(false)
  }, [currentCaisse])

  // === HELPERS ===
  const getUserName = useCallback((userId) => {
    const user = team.find(u => u.id === userId)
    return user?.name || ''
  }, [team])

  const getCategoryInfo = useCallback((catId, type) => {
    const cat = categories[type]?.find(c => c.id === catId)
    return cat || { label: '', icon: '💰' }
  }, [categories])

  const getCaisseName = useCallback((caisseId) => {
    const caisse = caisses.find(c => c.id === caisseId)
    return caisse ? `${caisse.icon} ${caisse.nom}` : ''
  }, [caisses])

  // === CALCULS AVEC MEMO ===
  const currentCaisseTransactions = useMemo(() => {
    if (!currentCaisse) return transactions
    return transactions.filter(t => t.caisse === currentCaisse)
  }, [transactions, currentCaisse])

  const transEffectuees = useMemo(() => {
    return currentCaisseTransactions.filter(t => t.statut !== 'prevue')
  }, [currentCaisseTransactions])

  const transPrevues = useMemo(() => {
    return currentCaisseTransactions.filter(t => t.statut === 'prevue')
  }, [currentCaisseTransactions])

  const filteredTransactions = useMemo(() => {
    let filtered = showPrevues ? currentCaisseTransactions : transEffectuees
    
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
  }, [currentCaisseTransactions, transEffectuees, showPrevues, filterPeriod, filterUser, searchQuery, getUserName])

  const filteredEffectuees = useMemo(() => {
    return filteredTransactions.filter(t => t.statut !== 'prevue')
  }, [filteredTransactions])

  const totalEntrees = useMemo(() => {
    return filteredEffectuees.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
  }, [filteredEffectuees])

  const totalSorties = useMemo(() => {
    return filteredEffectuees.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
  }, [filteredEffectuees])

  const soldeEffectif = useMemo(() => {
    const entrees = transEffectuees.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
    const sorties = transEffectuees.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
    return entrees - sorties
  }, [transEffectuees])

  const soldePrevisionnel = useMemo(() => {
    const entrees = currentCaisseTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
    const sorties = currentCaisseTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
    return entrees - sorties
  }, [currentCaisseTransactions])

  const getStatsByCategory = useCallback((type) => {
    const cats = categories[type]
    return cats.map(cat => ({
      ...cat,
      total: filteredEffectuees.filter(t => t.type === type && t.category === cat.id).reduce((sum, t) => sum + t.amount, 0),
      count: filteredEffectuees.filter(t => t.type === type && t.category === cat.id).length
    })).filter(c => c.count > 0)
  }, [categories, filteredEffectuees])

  const getStatsByUser = useCallback(() => {
    return team.map(u => ({
      id: u.id,
      name: u.name,
      entrees: filteredEffectuees.filter(t => t.user === u.id && t.type === 'entree').reduce((sum, t) => sum + t.amount, 0),
      sorties: filteredEffectuees.filter(t => t.user === u.id && t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0),
      count: filteredEffectuees.filter(t => t.user === u.id).length
    })).filter(u => u.count > 0)
  }, [team, filteredEffectuees])

  // === ACTIONS TRANSACTIONS ===
  const openNewTransaction = () => {
    setEditingTransaction(null)
    setNewType('sortie')
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().slice(0, 5)
    setFormData({ amount: '', reason: '', user: currentUser?.id || '', category: '', note: '', date: dateStr, time: timeStr, isPrevue: false })
    setShowModal(true)
    setMenuOpen(false)
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
      time: timeStr,
      isPrevue: t.statut === 'prevue'
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
      Caisse: [currentCaisse],
      Statut: formData.isPrevue ? 'prevue' : 'effectuee'
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
      
      clearCache()
      await loadData(false)
      setFormData({ amount: '', reason: '', user: '', category: '', note: '', date: '', time: '', isPrevue: false })
      setEditingTransaction(null)
      setShowModal(false)
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert('Erreur lors de la sauvegarde')
    }
    
    setSaving(false)
  }

  const markAsEffectuee = async (t) => {
    setSaving(true)
    try {
      await fetch(`${API_URL}?table=Transactions&id=${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Statut: 'effectuee' } })
      })
      clearCache()
      await loadData(false)
    } catch (err) {
      console.error('Erreur:', err)
    }
    setSaving(false)
  }

  const deleteTransaction = async (id) => {
    if (!confirm('Supprimer cette opération ?')) return
    
    try {
      await fetch(`${API_URL}?table=Transactions&id=${id}`, { method: 'DELETE' })
      clearCache()
      await loadData(false)
    } catch (err) {
      console.error('Erreur suppression:', err)
    }
  }

  // === ACTIONS MEMBRES ===
  const openNewMember = () => {
    setEditingUser(null)
    setNewMemberForm({ nom: '', email: '', password: '', role: 'membre' })
    setMemberError('')
    setShowUserModal(true)
    setMenuOpen(false)
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    if (!newMemberForm.nom || !newMemberForm.email || !newMemberForm.password) return
    
    setMemberError('')
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=create_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemberForm)
      })
      
      const data = await res.json()
      
      if (data.error) {
        setMemberError(data.error)
        setSaving(false)
        return
      }
      
      clearCache()
      await loadData(false)
      setNewMemberForm({ nom: '', email: '', password: '', role: 'membre' })
      setShowUserModal(false)
    } catch (err) {
      console.error('Erreur:', err)
      setMemberError('Erreur de connexion au serveur')
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
      clearCache()
      await loadData(false)
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  const toggleUserRole = async (user) => {
    const admins = team.filter(u => u.role === 'admin')
    
    if (user.role === 'admin' && admins.length <= 1) {
      alert('Impossible : vous devez garder au moins un administrateur')
      return
    }
    
    const newRole = user.role === 'admin' ? 'membre' : 'admin'
    const confirmMsg = user.role === 'admin' 
      ? `Retirer les droits admin de ${user.name} ?`
      : `Promouvoir ${user.name} en administrateur ?`
    
    if (!confirm(confirmMsg)) return
    
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=update_role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role: newRole })
      })
      
      const data = await res.json()
      
      if (data.success) {
        clearCache()
        await loadData(false)
      } else {
        alert(data.error || 'Erreur lors de la modification')
      }
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur de connexion')
    }
    
    setSaving(false)
  }

  // === CHANGER MOT DE PASSE ===
  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError('')
    setPasswordSuccess('')
    setShowPasswordModal(true)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas')
      return
    }
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    
    setSaving(true)
    
    try {
      const res = await fetch(`${API_URL}?action=change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setPasswordSuccess('Mot de passe modifié avec succès !')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setShowPasswordModal(false), 2000)
      } else {
        setPasswordError(data.error || 'Erreur lors de la modification')
      }
    } catch (err) {
      console.error('Erreur:', err)
      setPasswordError('Erreur de connexion au serveur')
    }
    
    setSaving(false)
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
      
      clearCache()
      await loadData(false)
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
      clearCache()
      await loadData(false)
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
      
      clearCache()
      await loadData(false)
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
      clearCache()
      await loadData(false)
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
      const toDelete = transactions.filter(t => t.caisse === currentCaisse)
      for (const t of toDelete) {
        await fetch(`${API_URL}?table=Transactions&id=${t.id}`, { method: 'DELETE' })
      }
      
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
            Caisse: [currentCaisse],
            Statut: 'effectuee'
          }
          
          await fetch(`${API_URL}?table=Transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
          })
        }
      }
      
      clearCache()
      await loadData(false)
      setResetConfirm('')
      setResetAmount('')
      setShowResetModal(false)
    } catch (err) {
      console.error('Erreur:', err)
    }
    
    setSaving(false)
  }

  // === NAVIGATION MENU ===
  const goToStats = () => {
    setActiveTab('resume')
    setMenuOpen(false)
  }

  const goToEquipe = () => {
    setActiveTab('equipe')
    setMenuOpen(false)
  }

  const goToParams = () => {
    setActiveTab('parametres')
    setMenuOpen(false)
  }

  // === LOADING SCREEN ===
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 pb-24">
      {/* === HEADER === */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-white/80 hover:text-white flex items-center gap-1">
            <span>←</span>
            <span className="text-sm">Retour</span>
          </button>
          <h1 className="text-lg font-bold text-white">💰 Caisse</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">{currentUser?.name}</span>
            <button onClick={onLogout} className="text-xs text-white/50 hover:text-white">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Sélecteur caisse */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {caisses.map(c => (
            <button
              key={c.id}
              onClick={() => setCurrentCaisse(c.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                currentCaisse === c.id
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {c.icon} {c.nom}
            </button>
          ))}
          <button
            onClick={openNewCaisse}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20"
          >
            ➕
          </button>
        </div>

        {/* Soldes */}
        {currentCaisse && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs text-white/70">Solde effectif</p>
              <p className={`text-xl font-bold ${soldeEffectif >= 0 ? 'text-white' : 'text-red-300'}`}>
                {soldeEffectif.toFixed(2)} €
              </p>
            </div>
            {transPrevues.length > 0 && (
              <div className="bg-amber-500/20 rounded-xl p-3">
                <p className="text-xs text-amber-200">Prévisionnel</p>
                <p className={`text-xl font-bold ${soldePrevisionnel >= 0 ? 'text-amber-100' : 'text-red-300'}`}>
                  {soldePrevisionnel.toFixed(2)} €
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === CONTENU PRINCIPAL === */}
      <div className="p-4 space-y-4">
        {/* Onglets */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
          {['mouvements', 'resume', 'equipe', 'parametres'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-teal-700 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab === 'mouvements' && '📋 Mouvements'}
              {tab === 'resume' && '📊 Résumé'}
              {tab === 'equipe' && '👥 Équipe'}
              {tab === 'parametres' && '⚙️ Paramètres'}
            </button>
          ))}
        </div>

        {/* === ONGLET MOUVEMENTS === */}
        {activeTab === 'mouvements' && (
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

              {transPrevues.length > 0 && (
                <button
                  onClick={() => setShowPrevues(!showPrevues)}
                  className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${
                    showPrevues 
                      ? 'bg-amber-500/30 text-amber-100' 
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {showPrevues ? '👁️ Masquer' : '👁️ Afficher'} les {transPrevues.length} opération(s) prévue(s)
                </button>
              )}
            </div>

            {/* Résumé rapide */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-white/80 mb-1">Entrées</p>
                <p className="text-xl font-bold text-white">+{totalEntrees.toFixed(2)} €</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 shadow-lg">
                <p className="text-xs text-white/80 mb-1">Sorties</p>
                <p className="text-xl font-bold text-white">-{totalSorties.toFixed(2)} €</p>
              </div>
            </div>

            {/* Liste transactions - BUG FIX: overflow-hidden ajouté */}
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
                  <p className="text-white/70">Aucune opération</p>
                </div>
              ) : (
                filteredTransactions.map(t => {
                  const catInfo = getCategoryInfo(t.category, t.type)
                  const isPrevue = t.statut === 'prevue'
                  return (
                    <div 
                      key={t.id} 
                      className={`bg-white rounded-2xl p-4 shadow-lg overflow-hidden ${
                        isPrevue ? 'opacity-70 border-2 border-dashed border-amber-400' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div 
                          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => openEditTransaction(t)}
                        >
                          <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${
                            t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'
                          }`}>
                            {catInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-800 truncate">{t.reason}</p>
                              {isPrevue && (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                  Prévue
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{catInfo.label}</p>
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {getUserName(t.user)} • {formatDateTime(t.date)}
                            </p>
                            {t.note && (
                              <p className="text-xs text-gray-500 mt-1 italic truncate">📝 {t.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <p className={`font-bold whitespace-nowrap ${t.type === 'entree' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {t.type === 'entree' ? '+' : '-'}{t.amount.toFixed(2)} €
                          </p>
                          <div className="flex gap-1">
                            {isPrevue && (
                              <button 
                                onClick={() => markAsEffectuee(t)}
                                className="text-xs text-amber-500 hover:text-emerald-600 p-1"
                                title="Marquer comme effectuée"
                              >
                                ✓
                              </button>
                            )}
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
                className="w-full py-3 bg-red-100 text-red-600 rounded-2xl font-medium"
              >
                🔄 Réinitialiser cette caisse
              </button>
            )}
          </div>
        )}

        {/* === ONGLET ÉQUIPE === */}
        {activeTab === 'equipe' && (
          <div className="space-y-4">
            {team.map(user => (
              <div key={user.id} className="bg-white rounded-2xl p-4 shadow-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  {currentUser?.role === 'admin' && user.id !== currentUser.id && (
                    <>
                      <button
                        onClick={() => toggleUserRole(user)}
                        className="text-xs text-gray-400 hover:text-purple-500 p-2"
                        title={user.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                      >
                        {user.role === 'admin' ? '👤' : '👑'}
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        className="text-xs text-gray-400 hover:text-red-500 p-2"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            
            <button
              onClick={openNewMember}
              className="w-full py-3 bg-white/20 text-white rounded-2xl font-medium"
            >
              ➕ Ajouter un membre
            </button>
          </div>
        )}

        {/* === ONGLET PARAMÈTRES === */}
        {activeTab === 'parametres' && (
          <div className="space-y-4">
            {/* Catégories entrées */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">📈 Catégories d'entrées</h3>
                <button
                  onClick={() => openNewCategory('entree')}
                  className="text-emerald-600 text-sm"
                >
                  ➕ Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {categories.entree.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2 bg-emerald-50 rounded-xl">
                    <span className="text-sm">{cat.icon} {cat.label}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditCategory('entree', cat)}
                        className="text-xs text-gray-400 hover:text-teal-500"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteCategory('entree', cat)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Catégories sorties */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">📉 Catégories de sorties</h3>
                <button
                  onClick={() => openNewCategory('sortie')}
                  className="text-red-600 text-sm"
                >
                  ➕ Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {categories.sortie.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2 bg-red-50 rounded-xl">
                    <span className="text-sm">{cat.icon} {cat.label}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditCategory('sortie', cat)}
                        className="text-xs text-gray-400 hover:text-teal-500"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteCategory('sortie', cat)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gestion des caisses */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <h3 className="font-bold text-gray-800 mb-3">💰 Caisses</h3>
              <div className="space-y-2">
                {caisses.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-sm">{c.icon} {c.nom}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditCaisse(c)}
                        className="text-xs text-gray-400 hover:text-teal-500"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteCaisse(c)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Changer mot de passe */}
            <button
              onClick={openPasswordModal}
              className="w-full py-3 bg-white rounded-2xl font-medium text-gray-700 shadow-lg"
            >
              🔐 Changer mon mot de passe
            </button>
          </div>
        )}
      </div>

      {/* === FAB MENU === */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className={`flex items-center gap-2 transition-all duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            onClick={goToStats}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-110 transition-transform"
          >
            📊
          </button>
          <button
            onClick={goToEquipe}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-110 transition-transform"
          >
            👥
          </button>
          <button
            onClick={openNewTransaction}
            className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform text-white"
          >
            ➕
          </button>
          <button
            onClick={openNewMember}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-110 transition-transform"
          >
            👤
          </button>
          <button
            onClick={goToParams}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-110 transition-transform"
          >
            ⚙️
          </button>
        </div>
        
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`absolute left-1/2 -translate-x-1/2 -bottom-2 w-16 h-16 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-300 ${menuOpen ? 'rotate-45' : ''}`}
        >
          <span className="text-white">✚</span>
        </button>
      </div>

      {/* === MODALS === */}
      
      {/* Modal Transaction */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              {editingTransaction ? 'Modifier' : 'Nouvelle opération'}
            </h2>
            
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setNewType('sortie')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  newType === 'sortie' ? 'bg-red-500 text-white' : 'bg-gray-100'
                }`}
              >
                ➖ Sortie
              </button>
              <button
                type="button"
                onClick={() => setNewType('entree')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  newType === 'entree' ? 'bg-emerald-500 text-white' : 'bg-gray-100'
                }`}
              >
                ➕ Entrée
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl text-2xl font-bold text-center"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Motif</label>
                <input
                  type="text"
                  placeholder="Ex: Achat légumes..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Catégorie</label>
                <div className="flex flex-wrap gap-2">
                  {categories[newType]?.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({...formData, category: cat.id})}
                      className={`px-3 py-2 rounded-xl text-sm transition-all ${
                        formData.category === cat.id
                          ? newType === 'entree' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Effectué par</label>
                <select
                  value={formData.user}
                  onChange={(e) => setFormData({...formData, user: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {team.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full p-3 bg-gray-100 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Heure</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full p-3 bg-gray-100 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPrevue}
                    onChange={(e) => setFormData({...formData, isPrevue: e.target.checked})}
                    className="w-5 h-5 text-amber-500 rounded"
                  />
                  <div>
                    <p className="font-medium text-amber-700">Opération prévue</p>
                    <p className="text-xs text-amber-600">Ne sera pas comptée dans le solde effectif</p>
                  </div>
                </label>
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Note (optionnel)</label>
                <textarea
                  placeholder="Détails supplémentaires..."
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingTransaction(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-3 text-white rounded-xl font-medium ${
                    newType === 'entree' ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                >
                  {saving ? '...' : editingTransaction ? 'Modifier' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nouveau Membre */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Nouveau membre</h2>
            
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom</label>
                <input
                  type="text"
                  placeholder="Prénom Nom"
                  value={newMemberForm.nom}
                  onChange={(e) => setNewMemberForm({...newMemberForm, nom: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Email</label>
                <input
                  type="email"
                  placeholder="email@exemple.com"
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Mot de passe</label>
                <input
                  type="password"
                  placeholder="8 caractères minimum"
                  value={newMemberForm.password}
                  onChange={(e) => setNewMemberForm({...newMemberForm, password: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Rôle</label>
                <select
                  value={newMemberForm.role}
                  onChange={(e) => setNewMemberForm({...newMemberForm, role: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                >
                  <option value="membre">Membre</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {memberError && (
                <p className="text-red-500 text-sm text-center">{memberError}</p>
              )}
              
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
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">🔐 Changer mon mot de passe</h2>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Mot de passe actuel</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nouveau mot de passe</label>
                <input
                  type="password"
                  placeholder="8 caractères minimum"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Confirmer le nouveau mot de passe</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>

              {passwordError && (
                <p className="text-red-500 text-sm text-center">{passwordError}</p>
              )}
              
              {passwordSuccess && (
                <p className="text-emerald-500 text-sm text-center">{passwordSuccess}</p>
              )}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : 'Modifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Caisse */}
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
                  placeholder="Ex: Caisse principale..."
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
                  placeholder="Ex: Caisse du marché..."
                  value={caisseForm.description}
                  onChange={(e) => setCaisseForm({...caisseForm, description: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
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
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : editingCaisse ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catégorie */}
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

      {/* Modal Réinitialisation */}
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
