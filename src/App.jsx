import { useState, useEffect } from 'react'
import Caisse from './Caisse'
import Marche from './Marche'

// === AUTH CONTEXT ===
const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [setupKey, setSetupKey] = useState('')
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setAuthLoading(true)
    
    try {
      const res = await fetch('/api.php?action=check_setup')
      const data = await res.json()
      setSetupComplete(data.setupComplete)
      
      if (!data.setupComplete) {
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
    
    const savedUser = localStorage.getItem('manrina_user')
    const savedToken = localStorage.getItem('manrina_token')
    
    if (savedUser && savedToken) {
      setCurrentUser(JSON.parse(savedUser))
      setIsLoggedIn(true)
    }
    
    setAuthLoading(false)
  }

  const handleLogin = async (email, password) => {
    const res = await fetch('/api.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await res.json()
    
    if (data.success) {
      localStorage.setItem('manrina_user', JSON.stringify(data.user))
      localStorage.setItem('manrina_token', data.token)
      setCurrentUser(data.user)
      setIsLoggedIn(true)
      return { success: true }
    }
    
    return { success: false, error: data.error || 'Erreur de connexion' }
  }

  const handleSetup = async (nom, email, password) => {
    const res = await fetch(`/api.php?action=setup&key=${setupKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, password })
    })
    
    const data = await res.json()
    
    if (data.success) {
      setSetupComplete(true)
      setShowSetup(false)
      window.history.replaceState({}, document.title, window.location.pathname)
      return { success: true }
    }
    
    return { success: false, error: data.error || 'Erreur lors du setup' }
  }

  const handleLogout = () => {
    localStorage.removeItem('manrina_user')
    localStorage.removeItem('manrina_token')
    localStorage.removeItem('manrina_cache')
    setCurrentUser(null)
    setIsLoggedIn(false)
  }

  return {
    isLoggedIn,
    currentUser,
    setupComplete,
    showSetup,
    setupKey,
    authLoading,
    handleLogin,
    handleSetup,
    handleLogout
  }
}

// === PAGES AUTH ===
function SetupPage({ onSetup }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    
    setSaving(true)
    const result = await onSetup(form.nom, form.email, form.password)
    
    if (!result.success) {
      setError(result.error)
    } else {
      alert('Compte administrateur créé ! Vous pouvez maintenant vous connecter.')
    }
    
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🥭</div>
          <h1 className="text-xl font-bold text-gray-800">Configuration initiale</h1>
          <p className="text-sm text-gray-500">Créez votre compte administrateur</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Nom</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({...form, nom: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
              minLength={8}
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Confirmer mot de passe</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-bold"
          >
            {saving ? 'Création...' : 'Créer le compte admin'}
          </button>
        </form>
      </div>
    </div>
  )
}

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    
    const result = await onLogin(form.email, form.password)
    
    if (!result.success) {
      setError(result.error)
    }
    
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🥭</div>
          <h1 className="text-xl font-bold text-gray-800">Manrina</h1>
          <p className="text-sm text-gray-500">Connectez-vous pour continuer</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              className="w-full p-3 bg-gray-100 rounded-xl"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-bold"
          >
            {saving ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}

// === MODULE SELECTOR ===
function ModuleSelector({ onSelect }) {
  const modules = [
    { id: 'caisse', icon: '💰', name: 'Caisse', description: 'Gestion de trésorerie' },
    { id: 'marche', icon: '🏪', name: 'Marché', description: 'Marchés du samedi' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥭</div>
          <h1 className="text-2xl font-bold text-white">Manrina</h1>
          <p className="text-white/70 text-sm">Choisissez un module</p>
        </div>
        
        <div className="space-y-4">
          {modules.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full bg-white rounded-2xl p-6 shadow-xl flex items-center gap-4 hover:scale-[1.02] transition-transform"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-2xl flex items-center justify-center text-3xl">
                {m.icon}
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-gray-800">{m.name}</h2>
                <p className="text-sm text-gray-500">{m.description}</p>
              </div>
              <div className="ml-auto text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// === APP PRINCIPALE ===
function App() {
  const auth = useAuth()
  const [activeModule, setActiveModule] = useState(null)

  // Loading
  if (auth.authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🥭</div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // Setup
  if (!auth.setupComplete && auth.showSetup) {
    return <SetupPage onSetup={auth.handleSetup} />
  }

  // Login
  if (!auth.isLoggedIn) {
    return <LoginPage onLogin={auth.handleLogin} />
  }

  // Module selector
  if (!activeModule) {
    return <ModuleSelector onSelect={setActiveModule} />
  }

  // Render active module
  const handleBack = () => setActiveModule(null)
  
  switch (activeModule) {
    case 'caisse':
      return <Caisse currentUser={auth.currentUser} onLogout={auth.handleLogout} onBack={handleBack} />
    case 'marche':
      return <Marche currentUser={auth.currentUser} onLogout={auth.handleLogout} onBack={handleBack} />
    default:
      return <ModuleSelector onSelect={setActiveModule} />
  }
}

export default App
