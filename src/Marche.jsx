import { useState, useEffect, useMemo, useCallback } from 'react'
import { clearCache, formatDate } from './old/api_old'

const API_URL = '/api.php'

export default function Marche({ currentUser, onLogout, onBack }) {
  // === ÉTATS ===
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('marches')
  
  // === DONNÉES ===
  const [marches, setMarches] = useState([])
  const [exposants, setExposants] = useState([])
  const [participations, setParticipations] = useState([])
  const [selectedMarche, setSelectedMarche] = useState(null)
  
  // === MODALS ===
  const [showMarcheModal, setShowMarcheModal] = useState(false)
  const [showExposantModal, setShowExposantModal] = useState(false)
  const [showParticipationModal, setShowParticipationModal] = useState(false)
  const [editingMarche, setEditingMarche] = useState(null)
  const [editingExposant, setEditingExposant] = useState(null)
  const [editingParticipation, setEditingParticipation] = useState(null)
  
  // === FORMULAIRES ===
  const [marcheForm, setMarcheForm] = useState({
    date: '',
    lieu: 'Triple 8, Ducos',
    commissionDefaut: '7',
    notes: ''
  })
  
  const [exposantForm, setExposantForm] = useState({
    nom: '',
    email: '',
    telephone: '',
    description: '',
    statut: 'candidat',
    notes: ''
  })
  
  const [participationForm, setParticipationForm] = useState({
    exposant: '',
    statut: 'invite',
    ca: '',
    tauxCommission: '',
    modePaiement: '',
    paye: false,
    notes: ''
  })

  // === CHARGEMENT ===
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [marchesRes, exposantsRes, participationsRes] = await Promise.all([
        fetch(`${API_URL}?table=Marches&sort_field=Date&sort_direction=desc`),
        fetch(`${API_URL}?table=Exposants`),
        fetch(`${API_URL}?table=Participations`)
      ])
      
      const marchesData = await marchesRes.json()
      const exposantsData = await exposantsRes.json()
      const participationsData = await participationsRes.json()
      
      if (marchesData.records) {
        const loaded = marchesData.records.map(r => ({
          id: r.id,
          date: r.fields.Date || '',
          lieu: r.fields.Lieu || 'Triple 8, Ducos',
          commissionDefaut: r.fields.CommissionDefaut || 7,
          nbVisiteurs: r.fields.NbVisiteurs || 0,
          statut: r.fields.Statut || 'planifie',
          notes: r.fields.Notes || ''
        }))
        setMarches(loaded)
      }
      
      if (exposantsData.records) {
        const loaded = exposantsData.records.map(r => ({
          id: r.id,
          nom: r.fields.Nom || '',
          email: r.fields.Email || '',
          telephone: r.fields.Telephone || '',
          description: r.fields.Description || '',
          statut: r.fields.Statut || 'candidat',
          commissionCustom: r.fields.CommissionCustom || null,
          dateInscription: r.fields.DateInscription || '',
          notes: r.fields.Notes || ''
        }))
        setExposants(loaded)
      }
      
      if (participationsData.records) {
        const loaded = participationsData.records.map(r => ({
          id: r.id,
          reference: r.fields.Reference || '',
          marche: r.fields.Marche?.[0] || '',
          exposant: r.fields.Exposant?.[0] || '',
          statut: r.fields.Statut || 'invite',
          ca: r.fields.CA || 0,
          tauxCommission: r.fields.TauxCommission || 7,
          montantCommission: r.fields.MontantCommission || 0,
          modePaiement: r.fields.ModePaiement || '',
          paye: r.fields.Paye || false,
          datePaiement: r.fields.DatePaiement || '',
          notes: r.fields.Notes || ''
        }))
        setParticipations(loaded)
      }
      
    } catch (err) {
      console.error('Erreur chargement:', err)
    }
    setLoading(false)
  }

  // === HELPERS ===
  const getExposantName = useCallback((exposantId) => {
    const exp = exposants.find(e => e.id === exposantId)
    return exp?.nom || 'Inconnu'
  }, [exposants])

  const getMarcheParticipations = useCallback((marcheId) => {
    return participations.filter(p => p.marche === marcheId)
  }, [participations])

  const getMarcheStats = useCallback((marcheId) => {
    const parts = getMarcheParticipations(marcheId)
    const confirmes = parts.filter(p => p.statut === 'confirme')
    const totalCA = confirmes.reduce((sum, p) => sum + (p.ca || 0), 0)
    const totalCommission = confirmes.reduce((sum, p) => sum + (p.montantCommission || 0), 0)
    return {
      nbExposants: confirmes.length,
      totalCA,
      totalCommission
    }
  }, [getMarcheParticipations])

  // === ACTIONS MARCHÉS ===
  const openNewMarche = () => {
    setEditingMarche(null)
    const today = new Date()
    // Prochain samedi
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
    const nextSaturday = new Date(today)
    nextSaturday.setDate(today.getDate() + daysUntilSaturday)
    
    setMarcheForm({
      date: nextSaturday.toISOString().split('T')[0],
      lieu: 'Triple 8, Ducos',
      commissionDefaut: '7',
      notes: ''
    })
    setShowMarcheModal(true)
  }

  const openEditMarche = (marche) => {
    setEditingMarche(marche)
    setMarcheForm({
      date: marche.date?.split('T')[0] || '',
      lieu: marche.lieu,
      commissionDefaut: marche.commissionDefaut.toString(),
      notes: marche.notes
    })
    setShowMarcheModal(true)
  }

  const handleMarcheSubmit = async (e) => {
    e.preventDefault()
    if (!marcheForm.date) return
    
    setSaving(true)
    
    const fields = {
      Date: marcheForm.date,
      Lieu: marcheForm.lieu,
      CommissionDefaut: parseFloat(marcheForm.commissionDefaut) || 7,
      Notes: marcheForm.notes,
      Statut: 'planifie'
    }
    
    try {
      if (editingMarche) {
        await fetch(`${API_URL}?table=Marches&id=${editingMarche.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Marches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setShowMarcheModal(false)
      setEditingMarche(null)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la sauvegarde')
    }
    
    setSaving(false)
  }

  const deleteMarche = async (marche) => {
    const parts = getMarcheParticipations(marche.id)
    if (parts.length > 0) {
      alert('Impossible : ce marché a des participations enregistrées')
      return
    }
    
    if (!confirm(`Supprimer le marché du ${formatDate(marche.date)} ?`)) return
    
    try {
      await fetch(`${API_URL}?table=Marches&id=${marche.id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  const updateMarcheStatut = async (marche, newStatut) => {
    setSaving(true)
    try {
      await fetch(`${API_URL}?table=Marches&id=${marche.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Statut: newStatut } })
      })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
    setSaving(false)
  }

  // === ACTIONS EXPOSANTS ===
  const openNewExposant = () => {
    setEditingExposant(null)
    setExposantForm({
      nom: '',
      email: '',
      telephone: '',
      description: '',
      statut: 'candidat',
      notes: ''
    })
    setShowExposantModal(true)
  }

  const openEditExposant = (exposant) => {
    setEditingExposant(exposant)
    setExposantForm({
      nom: exposant.nom,
      email: exposant.email,
      telephone: exposant.telephone,
      description: exposant.description,
      statut: exposant.statut,
      notes: exposant.notes
    })
    setShowExposantModal(true)
  }

  const handleExposantSubmit = async (e) => {
    e.preventDefault()
    if (!exposantForm.nom) return
    
    setSaving(true)
    
    const fields = {
      Nom: exposantForm.nom,
      Email: exposantForm.email,
      Telephone: exposantForm.telephone,
      Description: exposantForm.description,
      Statut: exposantForm.statut,
      Notes: exposantForm.notes
    }
    
    if (!editingExposant) {
      fields.DateInscription = new Date().toISOString().split('T')[0]
    }
    
    try {
      if (editingExposant) {
        await fetch(`${API_URL}?table=Exposants&id=${editingExposant.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Exposants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setShowExposantModal(false)
      setEditingExposant(null)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la sauvegarde')
    }
    
    setSaving(false)
  }

  const deleteExposant = async (exposant) => {
    const hasParticipations = participations.some(p => p.exposant === exposant.id)
    if (hasParticipations) {
      alert('Impossible : cet exposant a des participations enregistrées')
      return
    }
    
    if (!confirm(`Supprimer l'exposant "${exposant.nom}" ?`)) return
    
    try {
      await fetch(`${API_URL}?table=Exposants&id=${exposant.id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  // === ACTIONS PARTICIPATIONS ===
  const openNewParticipation = (marche) => {
    setSelectedMarche(marche)
    setEditingParticipation(null)
    setParticipationForm({
      exposant: '',
      statut: 'invite',
      ca: '',
      tauxCommission: marche.commissionDefaut.toString(),
      modePaiement: '',
      paye: false,
      notes: ''
    })
    setShowParticipationModal(true)
  }

  const openEditParticipation = (participation, marche) => {
    setSelectedMarche(marche)
    setEditingParticipation(participation)
    setParticipationForm({
      exposant: participation.exposant,
      statut: participation.statut,
      ca: participation.ca?.toString() || '',
      tauxCommission: participation.tauxCommission?.toString() || '7',
      modePaiement: participation.modePaiement || '',
      paye: participation.paye,
      notes: participation.notes
    })
    setShowParticipationModal(true)
  }

  const handleParticipationSubmit = async (e) => {
    e.preventDefault()
    if (!participationForm.exposant || !selectedMarche) return
    
    setSaving(true)
    
    const ca = parseFloat(participationForm.ca) || 0
    const tauxCommission = parseFloat(participationForm.tauxCommission) || 7
    const montantCommission = ca * (tauxCommission / 100)
    
    const exposant = exposants.find(e => e.id === participationForm.exposant)
    const reference = `${exposant?.nom || 'Exposant'} - ${formatDate(selectedMarche.date)}`
    
    const fields = {
      Reference: reference,
      Marche: [selectedMarche.id],
      Exposant: [participationForm.exposant],
      Statut: participationForm.statut,
      CA: ca,
      TauxCommission: tauxCommission,
      MontantCommission: montantCommission,
      ModePaiement: participationForm.modePaiement,
      Paye: participationForm.paye,
      Notes: participationForm.notes
    }
    
    if (participationForm.paye && !editingParticipation?.paye) {
      fields.DatePaiement = new Date().toISOString().split('T')[0]
    }
    
    try {
      if (editingParticipation) {
        await fetch(`${API_URL}?table=Participations&id=${editingParticipation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`${API_URL}?table=Participations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        })
      }
      
      await loadData()
      setShowParticipationModal(false)
      setEditingParticipation(null)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la sauvegarde')
    }
    
    setSaving(false)
  }

  const deleteParticipation = async (participation) => {
    if (!confirm('Supprimer cette participation ?')) return
    
    try {
      await fetch(`${API_URL}?table=Participations&id=${participation.id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  // === STATS GLOBALES ===
  const globalStats = useMemo(() => {
    const totalCA = participations.reduce((sum, p) => sum + (p.ca || 0), 0)
    const totalCommission = participations.reduce((sum, p) => sum + (p.montantCommission || 0), 0)
    const nbMarches = marches.filter(m => m.statut === 'termine').length
    return { totalCA, totalCommission, nbMarches }
  }, [marches, participations])

  // === LOADING ===
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">🏪</div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 pb-24">
      {/* === HEADER === */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-white/80 hover:text-white flex items-center gap-1">
            <span>←</span>
            <span className="text-sm">Retour</span>
          </button>
          <h1 className="text-lg font-bold text-white">🏪 Marché</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">{currentUser?.name}</span>
            <button onClick={onLogout} className="text-xs text-white/50 hover:text-white">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <p className="text-xs text-white/70">Marchés</p>
            <p className="text-lg font-bold text-white">{globalStats.nbMarches}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <p className="text-xs text-white/70">CA Total</p>
            <p className="text-lg font-bold text-white">{globalStats.totalCA.toFixed(0)}€</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <p className="text-xs text-white/70">Commissions</p>
            <p className="text-lg font-bold text-white">{globalStats.totalCommission.toFixed(0)}€</p>
          </div>
        </div>
      </div>

      {/* === CONTENU === */}
      <div className="p-4 space-y-4">
        {/* Onglets */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
          {['marches', 'exposants'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-orange-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab === 'marches' && '📅 Marchés'}
              {tab === 'exposants' && '👥 Exposants'}
            </button>
          ))}
        </div>

        {/* === ONGLET MARCHÉS === */}
        {activeTab === 'marches' && (
          <div className="space-y-4">
            <button
              onClick={openNewMarche}
              className="w-full py-3 bg-white/20 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
            >
              ➕ Planifier un marché
            </button>

            {marches.length === 0 ? (
              <div className="bg-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/70">Aucun marché planifié</p>
              </div>
            ) : (
              marches.map(marche => {
                const stats = getMarcheStats(marche.id)
                const parts = getMarcheParticipations(marche.id)
                
                return (
                  <div key={marche.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Header marché */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800">📅 {formatDate(marche.date)}</p>
                          <p className="text-sm text-gray-500">{marche.lieu}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            marche.statut === 'termine' ? 'bg-green-100 text-green-700' :
                            marche.statut === 'ouvert' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {marche.statut === 'termine' ? '✓ Terminé' :
                             marche.statut === 'ouvert' ? '🟢 En cours' : '📋 Planifié'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Stats marché */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-orange-600">Exposants</p>
                          <p className="font-bold text-orange-700">{stats.nbExposants}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-emerald-600">CA</p>
                          <p className="font-bold text-emerald-700">{stats.totalCA.toFixed(0)}€</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-purple-600">Commission</p>
                          <p className="font-bold text-purple-700">{stats.totalCommission.toFixed(0)}€</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Liste participations */}
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-medium text-gray-600">Participants</p>
                        <button
                          onClick={() => openNewParticipation(marche)}
                          className="text-xs text-orange-600 font-medium"
                        >
                          ➕ Ajouter
                        </button>
                      </div>
                      
                      {parts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">Aucun participant</p>
                      ) : (
                        <div className="space-y-2">
                          {parts.map(p => (
                            <div 
                              key={p.id}
                              className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  p.statut === 'confirme' ? 'bg-green-500' :
                                  p.statut === 'absent' ? 'bg-red-500' : 'bg-yellow-500'
                                }`} />
                                <span className="text-sm truncate">{getExposantName(p.exposant)}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {p.ca > 0 && (
                                  <span className="text-xs text-emerald-600 font-medium">{p.ca}€</span>
                                )}
                                {p.paye && (
                                  <span className="text-xs text-green-500">✓</span>
                                )}
                                <button
                                  onClick={() => openEditParticipation(p, marche)}
                                  className="text-gray-400 hover:text-orange-500 p-1"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deleteParticipation(p)}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions marché */}
                    <div className="p-4 bg-gray-50 flex gap-2">
                      {marche.statut === 'planifie' && (
                        <button
                          onClick={() => updateMarcheStatut(marche, 'ouvert')}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                        >
                          🟢 Ouvrir
                        </button>
                      )}
                      {marche.statut === 'ouvert' && (
                        <button
                          onClick={() => updateMarcheStatut(marche, 'termine')}
                          className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                        >
                          ✓ Terminer
                        </button>
                      )}
                      <button
                        onClick={() => openEditMarche(marche)}
                        className="py-2 px-4 bg-gray-200 rounded-lg text-sm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteMarche(marche)}
                        className="py-2 px-4 bg-gray-200 rounded-lg text-sm text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* === ONGLET EXPOSANTS === */}
        {activeTab === 'exposants' && (
          <div className="space-y-4">
            <button
              onClick={openNewExposant}
              className="w-full py-3 bg-white/20 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
            >
              ➕ Ajouter un exposant
            </button>

            {exposants.length === 0 ? (
              <div className="bg-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/70">Aucun exposant</p>
              </div>
            ) : (
              exposants.map(exp => {
                const nbParticipations = participations.filter(p => p.exposant === exp.id).length
                
                return (
                  <div key={exp.id} className="bg-white rounded-2xl p-4 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 truncate">{exp.nom}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            exp.statut === 'valide' ? 'bg-green-100 text-green-700' :
                            exp.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                            exp.statut === 'suspendu' ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {exp.statut}
                          </span>
                        </div>
                        {exp.description && (
                          <p className="text-sm text-gray-500 truncate">{exp.description}</p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                          {exp.email && <span>✉️ {exp.email}</span>}
                          {exp.telephone && <span>📱 {exp.telephone}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{nbParticipations} participation(s)</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditExposant(exp)}
                          className="text-gray-400 hover:text-orange-500 p-2"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteExposant(exp)}
                          className="text-gray-400 hover:text-red-500 p-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* === MODALS === */}
      
      {/* Modal Marché */}
      {showMarcheModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingMarche ? 'Modifier le marché' : 'Nouveau marché'}
            </h2>
            
            <form onSubmit={handleMarcheSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Date</label>
                <input
                  type="date"
                  value={marcheForm.date}
                  onChange={(e) => setMarcheForm({...marcheForm, date: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Lieu</label>
                <input
                  type="text"
                  value={marcheForm.lieu}
                  onChange={(e) => setMarcheForm({...marcheForm, lieu: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Commission par défaut (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={marcheForm.commissionDefaut}
                  onChange={(e) => setMarcheForm({...marcheForm, commissionDefaut: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Notes</label>
                <textarea
                  value={marcheForm.notes}
                  onChange={(e) => setMarcheForm({...marcheForm, notes: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowMarcheModal(false); setEditingMarche(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : editingMarche ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exposant */}
      {showExposantModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              {editingExposant ? 'Modifier l\'exposant' : 'Nouvel exposant'}
            </h2>
            
            <form onSubmit={handleExposantSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Nom *</label>
                <input
                  type="text"
                  placeholder="Nom de l'exposant"
                  value={exposantForm.nom}
                  onChange={(e) => setExposantForm({...exposantForm, nom: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Email</label>
                <input
                  type="email"
                  placeholder="email@exemple.com"
                  value={exposantForm.email}
                  onChange={(e) => setExposantForm({...exposantForm, email: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Téléphone</label>
                <input
                  type="tel"
                  placeholder="+596 696..."
                  value={exposantForm.telephone}
                  onChange={(e) => setExposantForm({...exposantForm, telephone: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Description (ce qu'il vend)</label>
                <textarea
                  placeholder="Fruits, légumes, artisanat..."
                  value={exposantForm.description}
                  onChange={(e) => setExposantForm({...exposantForm, description: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl resize-none"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Statut</label>
                <select
                  value={exposantForm.statut}
                  onChange={(e) => setExposantForm({...exposantForm, statut: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                >
                  <option value="candidat">Candidat</option>
                  <option value="valide">Validé</option>
                  <option value="refuse">Refusé</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Notes</label>
                <textarea
                  value={exposantForm.notes}
                  onChange={(e) => setExposantForm({...exposantForm, notes: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowExposantModal(false); setEditingExposant(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : editingExposant ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Participation */}
      {showParticipationModal && selectedMarche && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">
              {editingParticipation ? 'Modifier participation' : 'Nouvelle participation'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">Marché du {formatDate(selectedMarche.date)}</p>
            
            <form onSubmit={handleParticipationSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Exposant *</label>
                <select
                  value={participationForm.exposant}
                  onChange={(e) => setParticipationForm({...participationForm, exposant: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                  required
                  disabled={!!editingParticipation}
                >
                  <option value="">Sélectionner...</option>
                  {exposants.filter(e => e.statut === 'valide').map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.nom}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Statut</label>
                <div className="flex gap-2">
                  {['invite', 'confirme', 'absent'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setParticipationForm({...participationForm, statut: s})}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        participationForm.statut === s
                          ? s === 'confirme' ? 'bg-green-500 text-white' :
                            s === 'absent' ? 'bg-red-500 text-white' :
                            'bg-yellow-500 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {s === 'invite' && '📨 Invité'}
                      {s === 'confirme' && '✓ Confirmé'}
                      {s === 'absent' && '✗ Absent'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">CA (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={participationForm.ca}
                    onChange={(e) => setParticipationForm({...participationForm, ca: e.target.value})}
                    className="w-full p-4 bg-gray-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Commission (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={participationForm.tauxCommission}
                    onChange={(e) => setParticipationForm({...participationForm, tauxCommission: e.target.value})}
                    className="w-full p-4 bg-gray-100 rounded-xl"
                  />
                </div>
              </div>
              
              {participationForm.ca && participationForm.tauxCommission && (
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-sm text-purple-700">
                    Commission : <strong>{(parseFloat(participationForm.ca) * parseFloat(participationForm.tauxCommission) / 100).toFixed(2)} €</strong>
                  </p>
                </div>
              )}
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Mode de paiement</label>
                <select
                  value={participationForm.modePaiement}
                  onChange={(e) => setParticipationForm({...participationForm, modePaiement: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl"
                >
                  <option value="">Non défini</option>
                  <option value="cb">Carte bancaire</option>
                  <option value="virement">Virement</option>
                  <option value="especes">Espèces</option>
                </select>
              </div>
              
              <label className="flex items-center gap-3 p-3 bg-green-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={participationForm.paye}
                  onChange={(e) => setParticipationForm({...participationForm, paye: e.target.checked})}
                  className="w-5 h-5 text-green-500 rounded"
                />
                <span className="font-medium text-green-700">Commission payée</span>
              </label>
              
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Notes</label>
                <textarea
                  value={participationForm.notes}
                  onChange={(e) => setParticipationForm({...participationForm, notes: e.target.value})}
                  className="w-full p-4 bg-gray-100 rounded-xl resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowParticipationModal(false); setEditingParticipation(null); }}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium"
                >
                  {saving ? '...' : editingParticipation ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
