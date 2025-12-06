import React, { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { FileText, Brain, Network, BookOpen, Stethoscope, Download, CheckCircle, Loader2, AlertCircle, ChevronRight, X, Eye, Play, Plus, User, ArrowLeft, Trash2, FileUp, FileJson, Users, BarChart3, Calendar, Settings, Save, Building2, FolderOpen } from 'lucide-react'
import './App.css'

const API = 'https://voither-api.voither.workers.dev/api'
const STAGES: {id:string;name:string;fullName:string;icon:LucideIcon;color:string;deps:string[]}[] = [
  {id:'asl',name:'ASL',fullName:'Análise Sistêmica Linguística',icon:FileText,color:'#3b82f6',deps:[]},
  {id:'vdlp',name:'VDLP',fullName:'15 Dimensões do Espaço Mental',icon:Brain,color:'#8b5cf6',deps:['asl']},
  {id:'gem',name:'GEM',fullName:'Grafo do Espaço-Campo Mental',icon:Network,color:'#10b981',deps:['asl','vdlp']},
  {id:'narrative',name:'Narrativa',fullName:'Narrativa Fenomenológica',icon:BookOpen,color:'#f59e0b',deps:['asl','gem']},
  {id:'soap',name:'SOAP',fullName:'Nota SOAP Trajetorial',icon:Stethoscope,color:'#ef4444',deps:['asl','vdlp']}
]
type SID='asl'|'vdlp'|'gem'|'narrative'|'soap'

const fmtCPF = (c: string) => {
  const n = c.replace(/\D/g, '')
  if (n.length <= 3) return n
  if (n.length <= 6) return n.slice(0, 3) + '.' + n.slice(3)
  if (n.length <= 9) return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6)
  return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6, 9) + '-' + n.slice(9, 11)
}

export default function App() {
  const [view, setView] = useState<'home' | 'paciente' | 'transcricao' | 'config'>('home')
  const [tab, setTab] = useState<'transcricoes' | 'importar' | 'documentos'>('transcricoes')
  const [prof, setProf] = useState({ id: 1, nome: '', crm: '', especialidade: '', instituicao: '' })
  const [profEdit, setProfEdit] = useState<typeof prof | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [load, setLoad] = useState(false)
  const [stats, setStats] = useState<{ total_pacientes: number; total_transcricoes: number; total_analises: number; analises_completas: number; total_documentos: number } | null>(null)
  const [pacs, setPacs] = useState<{ cpf: string; nome: string; data_nascimento?: string; total_transcricoes?: number; total_documentos?: number }[]>([])
  const [selPac, setSelPac] = useState<typeof pacs[0] | null>(null)
  const [showNewPac, setShowNewPac] = useState(false)
  const [newPac, setNewPac] = useState({ cpf: '', nome: '', data_nascimento: '' })
  const [trans, setTrans] = useState<{ id: string; texto: string; data_consulta?: string; notas?: string; total_analises?: number; analises_completas?: number }[]>([])
  const [docs, setDocs] = useState<{ id: string; titulo: string; stage?: string; dados_json?: string; markdown?: string; created_at: string }[]>([])
  const [selTrans, setSelTrans] = useState<typeof trans[0] | null>(null)
  const [showNewTrans, setShowNewTrans] = useState(false)
  const [newTrans, setNewTrans] = useState({ texto: '', data_consulta: '', notas: '' })
  const [anas, setAnas] = useState<{ id: string; tipo: SID; dados_json?: string; status: string; error_message?: string }[]>([])
  const [running, setRunning] = useState<SID | null>(null)
  const [mdPreview, setMdPreview] = useState<{ title: string; markdown: string } | null>(null)
  const [impData, setImpData] = useState<string | null>(null)
  const [impFile, setImpFile] = useState('')
  const [impType, setImpType] = useState<SID>('asl')
  const [impTitle, setImpTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formattedMd, setFormattedMd] = useState<string | null>(null)

  useEffect(() => {
    fetch(API + '/profissional').then(r => r.json()).then(setProf).catch(() => {})
    fetch(API + '/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch(API + '/pacientes').then(r => r.json()).then(setPacs).catch(() => {})
  }, [])

  const loadPac = async (cpf: string) => {
    setLoad(true)
    try {
      const r = await fetch(API + '/pacientes/' + cpf.replace(/\D/g, ''))
      const d = await r.json()
      setSelPac(d.paciente)
      setTrans(d.transcricoes)
      setDocs(d.documentos)
      setView('paciente')
      setTab('transcricoes')
    } catch { setErr('Erro') }
    finally { setLoad(false) }
  }

  const loadTrans = async (id: string) => {
    setLoad(true)
    try {
      const r = await fetch(API + '/transcricoes/' + id)
      const d = await r.json()
      setSelTrans(d.transcricao)
      setAnas(d.analises)
      setView('transcricao')
    } catch { setErr('Erro') }
    finally { setLoad(false) }
  }

  const saveProf = async () => {
    if (!profEdit) return
    setLoad(true)
    try {
      await fetch(API + '/profissional', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profEdit) })
      setProf(profEdit)
      setProfEdit(null)
      setView('home')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setLoad(false) }
  }

  const createPac = async () => {
    if (!newPac.cpf || !newPac.nome) { setErr('CPF e Nome obrigatórios'); return }
    setLoad(true)
    try {
      const r = await fetch(API + '/pacientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPac) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setNewPac({ cpf: '', nome: '', data_nascimento: '' })
      setShowNewPac(false)
      fetch(API + '/pacientes').then(r => r.json()).then(setPacs)
      fetch(API + '/stats').then(r => r.json()).then(setStats)
      loadPac(d.cpf)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setLoad(false) }
  }

  const createTrans = async () => {
    if (!newTrans.texto || !selPac) { setErr('Texto obrigatório'); return }
    setLoad(true)
    try {
      const r = await fetch(API + '/transcricoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf: selPac.cpf, ...newTrans }) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setNewTrans({ texto: '', data_consulta: '', notas: '' })
      setShowNewTrans(false)
      loadTrans(d.id)
      fetch(API + '/stats').then(r => r.json()).then(setStats)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setLoad(false) }
  }

  const delTrans = async (id: string) => {
    if (!confirm('Excluir?')) return
    setLoad(true)
    try {
      await fetch(API + '/transcricoes/' + id, { method: 'DELETE' })
      if (selPac) loadPac(selPac.cpf)
      setView('paciente')
      fetch(API + '/stats').then(r => r.json()).then(setStats)
    } catch { setErr('Erro') }
    finally { setLoad(false) }
  }

  const runAna = async (tipo: SID) => {
    if (!selTrans) return
    setRunning(tipo)
    setErr(null)
    try {
      const r = await fetch(API + '/analises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcricao_id: selTrans.id, tipo }) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      loadTrans(selTrans.id)
      fetch(API + '/stats').then(r => r.json()).then(setStats)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setRunning(null) }
  }

  const getAna = (t: SID) => anas.find(a => a.tipo === t)
  const canRun = (s: typeof STAGES[0]) => s.deps.every(d => getAna(d as SID)?.status === 'complete')
  
  const dl = (d: string, n: string, ext = 'json') => {
    const b = new Blob([d], { type: ext === 'md' ? 'text/markdown' : 'application/json' })
    const l = document.createElement('a')
    l.href = URL.createObjectURL(b)
    l.download = n + '.' + ext
    l.click()
  }

  const impFile2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const t = await f.text()
    setMdPreview({ title: f.name, markdown: t })
  }

  const formatWithGrok = async () => {
    if (!impData || !selPac) return
    setFormatting(true)
    setErr(null)
    try {
      const r = await fetch(API + '/documentos/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: impData,
          stage: impType,
          paciente_nome: selPac.nome,
          profissional_nome: prof.nome
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setFormattedMd(d.markdown)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao formatar') }
    finally { setFormatting(false) }
  }

  const saveImp = async () => {
    if (!impData || !selPac || !formattedMd) return
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch(API + '/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_cpf: selPac.cpf,
          tipo: 'importacao',
          stage: impType,
          titulo: impTitle || 'Importação',
          dados: impData,
          markdown: formattedMd
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setImpData(null)
      setImpFile('')
      setImpTitle('')
      setFormattedMd(null)
      loadPac(selPac.cpf)
      fetch(API + '/stats').then(r => r.json()).then(setStats)
      setTab('documentos')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setSaving(false) }
  }

  const delDoc = async (id: string) => {
    if (!confirm('Excluir?')) return
    try {
      await fetch(API + '/documentos/' + id, { method: 'DELETE' })
      if (selPac) loadPac(selPac.cpf)
      fetch(API + '/stats').then(r => r.json()).then(setStats)
    } catch { setErr('Erro') }
  }

  const needsCfg = !prof.nome || !prof.crm

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'home' && view !== 'config' && (
              <button onClick={() => { if (view === 'transcricao' && selPac) loadPac(selPac.cpf); else { setView('home'); setSelPac(null) } }} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl leading-none tracking-tight">
                <span className="font-brand font-bold">VOITHER</span>
                <span className="font-display font-light text-slate-400">HealthOS</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">
                {view === 'home' ? 'Gestão de Pacientes' : view === 'config' ? 'Configurações' : view === 'paciente' ? selPac?.nome : 'Pipeline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => { setView('config'); setProfEdit({ ...prof }) }} className="p-2 hover:bg-slate-100 rounded-lg">
              <Settings className="w-5 h-5 text-slate-500" />
            </button>
            {prof.nome && (
              <div className="text-right">
                <p className="text-sm font-semibold">{prof.nome}</p>
                <p className="text-xs text-slate-500 font-mono">{prof.crm}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Error */}
        {err && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 flex-1">{err}</p>
            <button onClick={() => setErr(null)}><X className="w-4 h-4 text-red-500" /></button>
          </div>
        )}

        {/* Loading */}
        {load && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Carregando...</span>
            </div>
          </div>
        )}

        {/* Config needed */}
        {needsCfg && view === 'home' && (
          <div className="mb-6 p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5" /> Configure seus dados</h3>
            <p className="text-sm text-amber-700 mb-4">Configure nome e CRM para começar.</p>
            <button onClick={() => { setView('config'); setProfEdit({ ...prof }) }} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold">Configurar</button>
          </div>
        )}

        {/* Config View */}
        {view === 'config' && profEdit && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-6 font-display flex items-center gap-2"><Settings className="w-5 h-5" /> Profissional</h2>
              <div className="space-y-4">
                <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Nome *</label><input value={profEdit.nome} onChange={e => setProfEdit({ ...profEdit, nome: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">CRM *</label><input value={profEdit.crm} onChange={e => setProfEdit({ ...profEdit, crm: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono" /></div>
                <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Especialidade</label><input value={profEdit.especialidade} onChange={e => setProfEdit({ ...profEdit, especialidade: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
                <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Instituição</label><input value={profEdit.instituicao} onChange={e => setProfEdit({ ...profEdit, instituicao: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={saveProf} disabled={!profEdit.nome || !profEdit.crm} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
                <button onClick={() => { setProfEdit(null); setView('home') }} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Home */}
        {view === 'home' && (
          <>
            {stats && (
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.total_pacientes}</p><p className="text-xs text-slate-500">Pacientes</p></div></div></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{stats.total_transcricoes}</p><p className="text-xs text-slate-500">Transcrições</p></div></div></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{stats.total_analises}</p><p className="text-xs text-slate-500">Análises</p></div></div></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{stats.analises_completas}</p><p className="text-xs text-slate-500">Completas</p></div></div></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><FolderOpen className="w-5 h-5 text-slate-600" /></div><div><p className="text-2xl font-bold">{stats.total_documentos}</p><p className="text-xs text-slate-500">Docs</p></div></div></div>
              </div>
            )}
            {showNewPac && (
              <div className="mb-6 bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold mb-4">Novo Paciente</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">CPF *</label><input value={fmtCPF(newPac.cpf)} onChange={e => setNewPac(p => ({ ...p, cpf: e.target.value }))} maxLength={14} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Nome *</label><input value={newPac.nome} onChange={e => setNewPac(p => ({ ...p, nome: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Nasc.</label><input type="date" value={newPac.data_nascimento} onChange={e => setNewPac(p => ({ ...p, data_nascimento: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={createPac} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold">Criar</button>
                  <button onClick={() => setShowNewPac(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">Cancelar</button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" /> Pacientes</h2>
                <button onClick={() => setShowNewPac(true)} disabled={needsCfg} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Novo</button>
              </div>
              <div className="divide-y divide-slate-100">
                {pacs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400"><User className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum</p></div>
                ) : pacs.map(p => (
                  <div key={p.cpf} onClick={() => loadPac(p.cpf)} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-slate-500" /></div>
                      <div><p className="font-semibold">{p.nome}</p><p className="text-sm text-slate-500 font-mono">{fmtCPF(p.cpf)}</p></div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center"><p className="text-sm font-semibold">{p.total_transcricoes || 0}</p><p className="text-xs text-slate-400">trans.</p></div>
                      <div className="text-center"><p className="text-sm font-semibold">{p.total_documentos || 0}</p><p className="text-xs text-slate-400">docs</p></div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Paciente View */}
        {view === 'paciente' && selPac && (
          <>
            <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-8 h-8 text-slate-500" /></div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{selPac.nome}</h2>
                  <p className="text-slate-500 font-mono">{fmtCPF(selPac.cpf)}</p>
                  {selPac.data_nascimento && <p className="text-sm text-slate-400 flex items-center gap-1 mt-1"><Calendar className="w-4 h-4" />{new Date(selPac.data_nascimento).toLocaleDateString('pt-BR')}</p>}
                </div>
                <div className="text-right text-sm text-slate-500">
                  <p className="font-mono">{prof.crm}</p>
                  {prof.instituicao && <p className="flex items-center gap-1 justify-end"><Building2 className="w-3 h-3" />{prof.instituicao}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setTab('transcricoes')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === 'transcricoes' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}><FileText className="w-4 h-4" /> Transcrições</button>
              <button onClick={() => setTab('importar')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === 'importar' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}><FileUp className="w-4 h-4" /> Importar</button>
              <button onClick={() => setTab('documentos')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === 'documentos' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}><FolderOpen className="w-4 h-4" /> Documentos</button>
            </div>

            {/* Transcricoes Tab */}
            {tab === 'transcricoes' && (
              <>
                {showNewTrans && (
                  <div className="mb-6 bg-white rounded-xl p-6 border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4">Nova Transcrição</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Data</label><input type="date" value={newTrans.data_consulta} onChange={e => setNewTrans(t => ({ ...t, data_consulta: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Notas</label><input value={newTrans.notas} onChange={e => setNewTrans(t => ({ ...t, notas: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Texto *</label>
                        <textarea value={newTrans.texto} onChange={e => setNewTrans(t => ({ ...t, texto: e.target.value }))} rows={10} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono resize-none" />
                        <p className="text-xs text-slate-400 mt-1 font-mono">{newTrans.texto.split(/\s+/).filter(Boolean).length} palavras</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={createTrans} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold">Criar</button>
                      <button onClick={() => setShowNewTrans(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Transcrições</h2>
                    <button onClick={() => setShowNewTrans(true)} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Nova</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {trans.length === 0 ? (
                      <div className="p-8 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhuma</p></div>
                    ) : trans.map(t => (
                      <div key={t.id} onClick={() => loadTrans(t.id)} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-slate-500" /></div>
                          <div>
                            <p className="font-semibold">{t.data_consulta ? new Date(t.data_consulta).toLocaleDateString('pt-BR') : 'Sem data'}{t.notas && <span className="text-xs text-slate-400 ml-2">• {t.notas}</span>}</p>
                            <p className="text-sm text-slate-500">{t.texto.slice(0, 60)}...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right"><p className="text-sm font-semibold">{t.analises_completas || 0}/{t.total_analises || 0}</p><p className="text-xs text-slate-400">análises</p></div>
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Importar Tab */}
            {tab === 'importar' && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-5">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileUp className="w-5 h-5" /> Importar</h2>
                    <p className="text-sm text-slate-500 mb-4">Importe JSON/TXT/MD para <strong>{selPac.nome}</strong></p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Tipo</label>
                        <select value={impType} onChange={e => setImpType(e.target.value as SID)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                          {STAGES.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-1 font-mono">Título</label>
                        <input value={impTitle} onChange={e => setImpTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-2 font-mono">Arquivo</label>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                          <FileJson className="w-8 h-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">{impFile || 'Selecionar .json .txt .md'}</p>
                          <input type="file" accept=".json,.txt,.md" onChange={impFile2} className="hidden" />
                        </label>
                      </div>
                      {impData && !formattedMd && (
                        <button onClick={formatWithGrok} disabled={formatting} className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                          {formatting ? <><Loader2 className="w-5 h-5 animate-spin" /> Formatando com Grok...</> : <><Brain className="w-5 h-5" /> Formatar com IA</>}
                        </button>
                      )}
                      {formattedMd && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Formatado!</p>
                        </div>
                      )}
                      {formattedMd && (
                        <button onClick={saveImp} disabled={saving} className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                          {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</> : <><Save className="w-5 h-5" /> Salvar Documento</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-7">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 h-full">
                    <h2 className="text-lg font-semibold mb-4">{formattedMd ? 'Preview Formatado' : 'Conteúdo Original'}</h2>
                    {formattedMd ? (
                      <div className="prose prose-sm max-w-none max-h-[500px] overflow-auto">
                        <ReactMarkdown>{formattedMd}</ReactMarkdown>
                      </div>
                    ) : impData ? (
                      <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap font-mono">{impData}</pre>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <FileJson className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Selecione arquivo</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Documentos Tab */}
            {tab === 'documentos' && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><FolderOpen className="w-5 h-5" /> Documentos</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {docs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400"><FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum</p></div>
                  ) : docs.map(d => {
                    const st = STAGES.find(s => s.id === d.stage)
                    return (
                      <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (st?.color || '#64748b') + '20' }}>
                            {st ? React.createElement(st.icon, { className: "w-5 h-5", style: { color: st.color } }) : <FileJson className="w-5 h-5 text-slate-500" />}
                          </div>
                          <div>
                            <p className="font-semibold">{d.titulo}</p>
                            <p className="text-xs text-slate-400 font-mono">{d.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setMdPreview({ title: d.titulo, markdown: d.markdown || '*Sem markdown*' })} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Visualizar"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => dl(d.markdown || d.dados_json || '', d.id, d.markdown ? 'md' : 'json')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Download"><Download className="w-4 h-4" /></button>
                          <button onClick={() => delDoc(d.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Transcricao View */}
        {view === 'transcricao' && selTrans && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Transcrição</h2>
                  <button onClick={() => delTrans(selTrans.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
                {selTrans.data_consulta && <p className="text-sm text-slate-500 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(selTrans.data_consulta).toLocaleDateString('pt-BR')}</p>}
                <div className="bg-slate-50 rounded-lg p-4 max-h-[500px] overflow-auto">
                  <p className="text-sm font-mono whitespace-pre-wrap">{selTrans.texto}</p>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-mono">{selTrans.texto.split(/\s+/).filter(Boolean).length} palavras</p>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Pipeline</h2>
                <p className="text-sm text-slate-500 mb-4">Execute cada etapa individualmente.</p>
                <div className="space-y-3">
                  {STAGES.map(s => {
                    const a = getAna(s.id as SID)
                    const can = canRun(s)
                    const run = running === s.id
                    const Icon = s.icon
                    return (
                      <div key={s.id} className={`border rounded-xl p-4 ${a?.status === 'complete' ? 'border-emerald-200 bg-emerald-50' : a?.status === 'error' ? 'border-red-200 bg-red-50' : run ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '20' }}>
                              <Icon className="w-5 h-5" style={{ color: s.color }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase font-mono" style={{ color: s.color }}>{s.name}</span>
                                {s.deps.length > 0 && <span className="text-xs text-slate-400">(req: {s.deps.join(', ')})</span>}
                              </div>
                              <span className="text-sm text-slate-600">{s.fullName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {a?.status === 'complete' && (
                              <>
                                <button onClick={() => setMdPreview({ title: s.fullName, markdown: a.dados_json || '{}' })} className="p-2 text-slate-500 hover:bg-white rounded-lg"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => dl(a.dados_json || '{}', s.id + '_' + a.id)} className="p-2 text-slate-500 hover:bg-white rounded-lg"><Download className="w-4 h-4" /></button>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              </>
                            )}
                            {a?.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {run && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                            {!a && !run && (
                              <button onClick={() => runAna(s.id as SID)} disabled={!can} className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 ${can ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                <Play className="w-4 h-4" /> Executar
                              </button>
                            )}
                          </div>
                        </div>
                        {a?.status === 'error' && a.error_message && <p className="mt-2 text-sm text-red-600 font-mono">{a.error_message}</p>}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: (anas.filter(a => a.status === 'complete').length / STAGES.length) * 100 + '%' }} />
                    </div>
                    <span className="text-sm text-slate-500 font-mono">{anas.filter(a => a.status === 'complete').length}/{STAGES.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Markdown Preview Modal */}
      {mdPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setMdPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold">{mdPreview.title}</h3>
              <button onClick={() => setMdPreview(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{mdPreview.markdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-6 text-xs text-slate-400 font-mono">
        VOITHER HealthOS v3.2 • {prof.crm || 'Não configurado'} • Grok + D1
      </footer>
    </div>
  )
}
