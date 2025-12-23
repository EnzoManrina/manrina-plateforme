import { useState } from 'react'

// === EMOJIS DISPONIBLES ===
const EMOJIS = ['💵', '🏦', '📦', '🚗', '💸', '🛒', '🍽️', '⛽', '📱', '💼', '🎁', '🔧', '📝', '💳', '🏠', '⚡', '💊', '🎉', '✈️', '🚌', '☕', '🍕', '👕', '📚', '🎬', '💇', '🧹', '🌿', '🥭', '➕', '➖']

function App() {
  // === ÉTATS ===
  const [activeTab, setActiveTab] = useState('mouvements')
  
  // Catégories personnalisables
  const [categories, setCategories] = useState({
    entree: [
      { id: 'ventes', label: 'Ventes espèces', icon: '💵' },
      { id: 'fond', label: 'Fond de caisse', icon: '🏦' },
      { id: 'remb_recu', label: 'Remboursement reçu', icon: '↩️' },
      { id: 'autre_entree', label: 'Autre entrée', icon: '➕' },
    ],
    sortie: [
      { id: 'fournitures', label: 'Achat fournitures', icon: '📦' },
      { id: 'transport', label: 'Frais transport', icon: '🚗' },
      { id: 'remb_client', label: 'Remboursement client', icon: '↪️' },
      { id: 'retrait', label: 'Retrait caisse', icon: '💸' },
      { id: 'autre_sortie', label: 'Autre sortie', icon: '➖' },
    ]
  })

  const [transactions, setTransactions] = useState([
    { id: 1, type: 'entree', category: 'fond', amount: 500, reason: 'Ouverture caisse', user: 'Enzo', date: '2024-12-22', note: '' },
    { id: 2, type: 'sortie', category: 'fournitures', amount: 45.50, reason: 'Sacs papier', user: 'Alain', date: '2024-12-22', note: 'Fournisseur Carton+' },
  ])
  
  const [team, setTeam] = useState([
    { id: 1, name: 'Enzo' },
    { id: 2, name: 'Alain' },
    { id: 3, name: 'Guy' },
  ])
  
  const [soldeCaisse, setSoldeCaisse] = useState(0)
  
  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  
  // Formulaires
  const [newType, setNewType] = useState('sortie')
  const [formData, setFormData] = useState({ amount: '', reason: '', user: '', category: '', note: '', date: '' })
  const [newUserName, setNewUserName] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [categoryForm, setCategoryForm] = useState({ type: 'sortie', label: '', icon: '📦' })
  
  // Filtres
  const [filterPeriod, setFilterPeriod] = useState('tout')
  const [filterUser, setFilterUser] = useState('tous')
  const [searchQuery, setSearchQuery] = useState('')

  // === CALCULS ===
  const filterTransactions = () => {
    let filtered = [...transactions]
    
    const now = new Date()
    if (filterPeriod === 'jour') {
      const today = now.toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date === today)
    } else if (filterPeriod === 'semaine') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date >= weekAgo)
    } else if (filterPeriod === 'mois') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date >= monthAgo)
    }
    
    if (filterUser !== 'tous') {
      filtered = filtered.filter(t => t.user === filterUser)
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.reason.toLowerCase().includes(q) || 
        t.note?.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q)
      )
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const filteredTransactions = filterTransactions()
  
  const totalEntrees = filteredTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0)
  const totalSorties = filteredTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)
  const soldeActuel = soldeCaisse + transactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.amount, 0) - transactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0)

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
      name: u.name,
      entrees: filteredTransactions.filter(t => t.user === u.name && t.type === 'entree').reduce((sum, t) => sum + t.amount, 0),
      sorties: filteredTransactions.filter(t => t.user === u.name && t.type === 'sortie').reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.filter(t => t.user === u.name).length
    })).filter(u => u.count > 0)
  }

  // === ACTIONS TRANSACTIONS ===
  const openNewTransaction = () => {
    setEditingTransaction(null)
    setNewType('sortie')
    setFormData({ amount: '', reason: '', user: '', category: '', note: '', date: new Date().toISOString().split('T')[0] })
    setShowModal(true)
  }

  const openEditTransaction = (t) => {
    setEditingTransaction(t)
    setNewType(t.type)
    setFormData({
      amount: t.amount.toString(),
      reason: t.reason,
      user: t.user,
      category: t.category,
      note: t.note || '',
      date: t.date
    })
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.amount || !formData.reason || !formData.user || !formData.category) return
    
    if (editingTransaction) {
      // Modifier
      setTransactions(transactions.map(t => 
        t.id === editingTransaction.id 
          ? {
              ...t,
              type: newType,
              category: formData.category,
              amount: parseFloat(formData.amount),
              reason: formData.reason,
              user: formData.user,
              date: formData.date,
              note: formData.note
            }
          : t
      ))
    } else {
      // Créer
      const newTransaction = {
        id: Date.now(),
        type: newType,
        category: formData.category,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        user: formData.user,
        date: formData.date || new Date().toISOString().split('T')[0],
        note: formData.note
      }
      setTransactions([newTransaction, ...transactions])
    }
    
    setFormData({ amount: '', reason: '', user: '', category: '', note: '', date: '' })
    setEditingTransaction(null)
    setShowModal(false)
  }

  const deleteTransaction = (id) => {
    if (confirm('Supprimer cette opération ?')) {
      setTransactions(transactions.filter(t => t.id !== id))
    }
  }

  // === ACTIONS UTILISATEURS ===
  const handleUserSubmit = (e) => {
    e.preventDefault()
    if (!newUserName.trim()) return
    
    if (editingUser) {
      setTeam(team.map(u => u.id === editingUser.id ? { ...u, name: newUserName } : u))
      setTransactions(transactions.map(t => t.user === editingUser.name ? { ...t, user: newUserName } : t))
    } else {
      setTeam([...team, { id: Date.now(), name: newUserName }])
    }
    
    setNewUserName('')
    setEditingUser(null)
    setShowUserModal(false)
  }

  const deleteUser = (user) => {
    if (transactions.some(t => t.user === user.name)) {
      alert('Impossible : cet utilisateur a des opérations enregistrées')
      return
    }
    if (confirm(`Supprimer ${user.name} ?`)) {
      setTeam(team.filter(u => u.id !== user.id))
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

  const handleCategorySubmit = (e) => {
    e.preventDefault()
    if (!categoryForm.label.trim()) return
    
    const type = categoryForm.type
    
    if (editingCategory) {
      // Modifier
      setCategories({
        ...categories,
        [type]: categories[type].map(c => 
          c.id === editingCategory.id 
            ? { ...c, label: categoryForm.label, icon: categoryForm.icon }
            : c
        )
      })
    } else {
      // Créer
      const newCat = {
        id: `cat_${Date.now()}`,
        label: categoryForm.label,
        icon: categoryForm.icon
      }
      setCategories({
        ...categories,
        [type]: [...categories[type], newCat]
      })
    }
    
    setCategoryForm({ type: 'sortie', label: '', icon: '📦' })
    setEditingCategory(null)
    setShowCategoryModal(false)
  }

  const deleteCategory = (type, cat) => {
    if (transactions.some(t => t.type === type && t.category === cat.id)) {
      alert('Impossible : cette catégorie est utilisée par des opérations')
      return
    }
    if (confirm(`Supprimer la catégorie "${cat.label}" ?`)) {
      setCategories({
        ...categories,
        [type]: categories[type].filter(c => c.id !== cat.id)
      })
    }
  }

  // === RESET ===
  const handleReset = () => {
    if (resetConfirm !== 'REINITIALISER') return
    setTransactions([])
    setSoldeCaisse(0)
    setResetConfirm('')
    setShowResetModal(false)
  }

  // === RENDU ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl">🥭</div>
              <div>
                <h1 className="text-lg font-bold text-white">Caisse Manrina</h1>
                <p className="text-xs text-white/70">Gestion des flux</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">Solde actuel</p>
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
              { id: 'categories', label: '🏷️ Catégories' },
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
                    <option key={u.id} value={u.name} className="text-gray-800">{u.name}</option>
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
                filteredTransactions.map(t => (
                  <div key={t.id} className="bg-white rounded-2xl p-4 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div 
                        className="flex items-start gap-3 flex-1 cursor-pointer"
                        onClick={() => openEditTransaction(t)}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                          t.type === 'entree' ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                          {categories[t.type]?.find(c => c.id === t.category)?.icon || '💰'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{t.reason}</p>
                          <p className="text-xs text-gray-400">
                            {categories[t.type]?.find(c => c.id === t.category)?.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {t.user} • {t.date}
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
                ))
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
                    <div key={u.name} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
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

            <button
              onClick={() => setShowResetModal(true)}
              className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-medium text-sm"
            >
              ⚠️ Réinitialiser la caisse
            </button>
          </div>
        )}

        {/* === ONGLET ÉQUIPE === */}
        {activeTab === 'equipe' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">👥 Équipe</h3>
                <button
                  onClick={() => { setEditingUser(null); setNewUserName(''); setShowUserModal(true); }}
                  className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium"
                >
                  + Ajouter
                </button>
              </div>
              
              <div className="space-y-2">
                {team.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white font-bold">
                        {u.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingUser(u); setNewUserName(u.name); setShowUserModal(true); }}
                        className="p-2 text-gray-400 hover:text-teal-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === ONGLET CATÉGORIES === */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
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
            </div>
          </div>
        )}
      </main>

      {/* Bouton Ajouter (fixe) */}
      {activeTab === 'mouvements' && (
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

              {/* Date */}
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
                    <option key={u.id} value={u.name}>{u.name}</option>
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
                disabled={!formData.category}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  !formData.category 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : newType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {editingTransaction ? 'Enregistrer les modifications' : 'Valider l\'opération'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL UTILISATEUR === */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
            </h2>
            
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nom..."
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                required
                autoFocus
              />
              
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
                  className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium"
                >
                  {editingUser ? 'Modifier' : 'Ajouter'}
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
              {/* Nom */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom de la catégorie</label>
                <input
                  type="text"
                  placeholder="Ex: Frais bancaires..."
                  value={categoryForm.label}
                  onChange={(e) => setCategoryForm({...categoryForm, label: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl font-medium"
                  required
                  autoFocus
                />
              </div>

              {/* Emoji */}
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

              {/* Aperçu */}
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
                  className={`flex-1 py-3 text-white rounded-xl font-medium ${
                    categoryForm.type === 'entree' ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                >
                  {editingCategory ? 'Modifier' : 'Créer'}
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
            <h2 className="text-lg font-bold text-red-600 mb-2">⚠️ Réinitialisation</h2>
            <p className="text-sm text-gray-600 mb-4">
              Cette action supprimera <strong>toutes les opérations</strong>. Cette action est irréversible.
            </p>
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
                onClick={() => { setShowResetModal(false); setResetConfirm(''); }}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                disabled={resetConfirm !== 'REINITIALISER'}
                className={`flex-1 py-3 rounded-xl font-medium ${
                  resetConfirm === 'REINITIALISER' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App