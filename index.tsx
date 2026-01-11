
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  ShieldCheck,
  ExternalLink,
  X,
  RefreshCw,
  Plus,
  Award,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Key,
  FolderOpen,
  Lock
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";

// --- Interfaces ---
interface Client { id: string; name: string; cuit: string; }
interface ModuleDocument { name: string; url: string; }
interface Module { id: string; name: string; documents: ModuleDocument[]; description?: string; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface AttendanceRecord { id: string; name: string; dni: string; companyId: string; moduleId: string; timestamp: string; signature: string; }
interface Instructor { name: string; role: string; signature: string; }
interface AppState { clients: Client[]; modules: Module[]; assignments: Assignment[]; records: AttendanceRecord[]; instructor: Instructor; }

// --- Config & API ---
const STORAGE_KEYS = { 
  MASTER_KEY: 'trainer_master_key_v13',
  WSID: 'trainer_ws_id_v13', 
  AUTH: 'trainer_auth_v13',
  STATE_CACHE: 'trainer_state_cache_v13'
};
const API_URL = 'https://api.restful-api.dev/objects';

const api = {
  // Busca un objeto por la clave maestra (usada como nombre en la API)
  findByKey: async (masterKey: string): Promise<{id: string, data: AppState} | null> => {
    try {
      const res = await fetch(API_URL);
      const objects = await res.json();
      const prefix = `TrainerCloudKey_`;
      const found = objects.find((obj: any) => obj.name === `${prefix}${masterKey}`);
      if (found) {
        const fullRes = await fetch(`${API_URL}/${found.id}`);
        const fullObj = await fullRes.json();
        return { id: found.id, data: fullObj.data };
      }
      return null;
    } catch (err) {
      return null;
    }
  },
  load: async (id: string): Promise<AppState | null> => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) { return null; }
  },
  save: async (id: string, masterKey: string, data: AppState) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `TrainerCloudKey_${masterKey}`, data })
      });
      return res.ok;
    } catch (err) { return false; }
  },
  create: async (masterKey: string): Promise<string> => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `TrainerCloudKey_${masterKey}`, 
          data: { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } } 
        })
      });
      const json = await res.json();
      return json.id;
    } catch (err) { return ""; }
  }
};

const App = () => {
  const [view, setView] = useState<'landing' | 'userForm' | 'adminLogin' | 'adminDashboard'>('landing');
  const [masterKey, setMasterKey] = useState(() => localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "");
  const [wsid, setWsid] = useState(() => localStorage.getItem(STORAGE_KEYS.WSID) || "");
  const [isAuth, setIsAuth] = useState(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  
  const [state, setState] = useState<AppState>(() => {
    const cache = localStorage.getItem(STORAGE_KEYS.STATE_CACHE);
    return cache ? JSON.parse(cache) : { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } };
  });

  const [adminTab, setAdminTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const isUpdatingRef = useRef(false);
  
  // Login States
  const [inputKey, setInputKey] = useState(() => localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(state));
  }, [state]);

  const sync = useCallback(async (silent = true) => {
    if (isUpdatingRef.current || !wsid) {
      if (!wsid) setHasInitialLoad(true);
      return;
    }
    if (!silent) setSyncStatus('syncing');
    const cloudData = await api.load(wsid);
    if (cloudData) {
      setState(prev => JSON.stringify(prev) === JSON.stringify(cloudData) ? prev : cloudData);
      if (!silent) setSyncStatus('idle');
    } else if (!silent) {
      setSyncStatus('error');
    }
    setHasInitialLoad(true);
  }, [wsid]);

  useEffect(() => {
    sync();
    const timer = setInterval(() => sync(true), 15000);
    return () => clearInterval(timer);
  }, [wsid, sync]);

  const updateGlobal = async (patch: Partial<AppState>) => {
    isUpdatingRef.current = true;
    setSyncStatus('syncing');
    const newState = { ...state, ...patch };
    setState(newState);
    if (wsid && masterKey) {
      const success = await api.save(wsid, masterKey, newState);
      setSyncStatus(success ? 'saved' : 'error');
      if (success) setTimeout(() => setSyncStatus('idle'), 2000);
    }
    isUpdatingRef.current = false;
  };

  const handleLogin = async () => {
    if (!inputKey.trim()) {
      alert("Por favor ingrese su Clave de Acceso.");
      return;
    }

    setIsLoggingIn(true);
    const cleanKey = inputKey.trim().toLowerCase().replace(/\s+/g, '_');
    
    // 1. Buscar si ya existe esta clave maestra en la nube
    const existing = await api.findByKey(cleanKey);
    
    let targetWsid = "";
    if (existing) {
      targetWsid = existing.id;
      setState(existing.data);
    } else {
      // 2. Si es nueva, crear el espacio
      targetWsid = await api.create(cleanKey);
    }

    if (targetWsid) {
      localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      localStorage.setItem(STORAGE_KEYS.MASTER_KEY, cleanKey);
      localStorage.setItem(STORAGE_KEYS.WSID, targetWsid);
      
      setMasterKey(cleanKey);
      setWsid(targetWsid);
      setIsAuth(true);
      setView('adminDashboard');
    } else {
      alert("Error de conexión. Verifique su internet.");
    }
    setIsLoggingIn(false);
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('cid') && p.get('mid')) setView('userForm');
  }, []);

  return (
    <div className="bg-[#060912] min-h-screen text-slate-200 font-sans selection:bg-blue-600 antialiased overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/90 backdrop-blur-lg border-b border-gray-800/50 px-4 md:px-6 py-4 flex justify-between items-center h-16 md:h-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20"><BookOpen size={18} className="text-white" /></div>
          <span className="text-white font-black italic uppercase text-lg md:text-xl tracking-tighter">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        <div className="flex items-center gap-4">
          {isAuth && view === 'adminDashboard' && (
            <button onClick={() => { localStorage.removeItem(STORAGE_KEYS.AUTH); location.reload(); }} className="text-red-500 font-black uppercase text-[10px] tracking-widest px-4 py-2 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95">Salir</button>
          )}
        </div>
      </nav>

      <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
        {view === 'landing' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <h1 className="text-[clamp(2.5rem,10vw,7rem)] font-black italic uppercase text-white tracking-tighter mb-4 leading-none">TRAINER<span className="text-blue-600">APP</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[clamp(0.6rem,2vw,0.8rem)] mb-12">Gestión de Capacitaciones y Firmas Digitales</p>
            <button onClick={() => setView('adminLogin')} className="bg-blue-600 text-white font-black px-12 py-6 rounded-[2.5rem] uppercase text-xs shadow-2xl hover:bg-blue-700 transition-all active:scale-95">Entrar al Panel</button>
          </div>
        )}

        {view === 'adminLogin' && (
          <div className="min-h-[60vh] flex items-center justify-center animate-in zoom-in">
            <div className="bg-[#111827] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 w-full max-w-md text-center shadow-2xl">
              <div className="size-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
                <ShieldCheck size={40} className="text-blue-600" />
              </div>
              <h2 className="text-white text-2xl font-black uppercase italic mb-6">Acceso Seguro</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-10 leading-relaxed italic">Su clave maestra identifica y protege su información en la nube.</p>
              
              <div className="space-y-6 mb-10 text-left">
                <div className="space-y-3">
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input 
                      type="password" 
                      placeholder="Ingrese su Clave..." 
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-[#0d111c] border border-gray-800 text-white pl-16 pr-6 py-6 rounded-2xl outline-none font-bold text-lg focus:border-blue-500 transition-all shadow-inner tracking-widest" 
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 px-4 font-medium uppercase tracking-tight">Si es su primera vez, elija cualquier palabra difícil de adivinar.</p>
                </div>
              </div>

              <button 
                disabled={isLoggingIn}
                onClick={handleLogin} 
                className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] uppercase text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : "Iniciar Sesión"}
              </button>
            </div>
          </div>
        )}

        {view === 'adminDashboard' && (
          <div className="animate-in slide-in-from-bottom-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-8">
              <div className="space-y-3">
                <h1 className="text-white text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">Mi <span className="text-blue-600">Panel</span></h1>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#111827] px-4 py-2 rounded-full border border-gray-800">
                    <Key size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider italic">Llave: {masterKey}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#111827] px-4 py-2 rounded-full border border-gray-800">
                    <div className={`size-1.5 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Cloud Live</span>
                  </div>
                </div>
              </div>
              <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shadow-xl no-scrollbar">
                {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                  <button key={t} onClick={() => setAdminTab(t as any)} className={`flex items-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[9px] md:text-[10px] transition-all whitespace-nowrap ${adminTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#111827] rounded-[2.5rem] md:rounded-[3rem] border border-gray-800 p-6 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.4)] relative">
              {adminTab === 'asistencias' && <AsistenciasView state={state} update={updateGlobal} onSync={() => sync(false)} isSyncing={syncStatus === 'syncing'} />}
              {adminTab === 'asignaciones' && <AsignacionesView state={state} update={updateGlobal} wsid={wsid} />}
              {adminTab === 'modulos' && <ModulosView state={state} update={updateGlobal} />}
              {adminTab === 'clientes' && <ClientesView state={state} update={updateGlobal} />}
              {adminTab === 'instructor' && <InstructorView state={state} update={updateGlobal} />}
            </div>
          </div>
        )}

        {view === 'userForm' && <UserPortal state={state} wsid={wsid} onSync={() => sync(false)} onSubmit={async (rec) => {
          if (wsid) {
            const latest = await api.load(wsid);
            const updated = { ...latest, records: [rec, ...(latest?.records || [])] } as AppState;
            setState(updated);
            if (masterKey) await api.save(wsid, masterKey, updated);
          }
        }} />}
      </main>
    </div>
  );
};

// --- Subcomponentes (Similares a los anteriores pero manteniendo consistencia con el Login de un solo campo) ---
const AsistenciasView = ({ state, update, onSync, isSyncing }: any) => {
  const [sel, setSel] = useState<string[]>([]);
  const generatePDF = () => {
    const data = state.records.filter((r: any) => sel.includes(r.id));
    if(!data.length) return;
    const doc = new jsPDF();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("REPORTE DE ASISTENCIA", 15, 25);
    autoTable(doc, {
      startY: 50,
      head: [['Empleado', 'DNI', 'Módulo', 'Fecha', 'Firma']],
      headStyles: { fillColor: [30, 41, 59] },
      body: data.map((r: any) => [r.name, r.dni, state.modules.find((m: any) => m.id === r.moduleId)?.name || "N/A", new Date(r.timestamp).toLocaleDateString(), '']),
      didDrawCell: (d: any) => { if (d.section === 'body' && d.column.index === 4) { const rec = data[d.row.index]; if(rec.signature) doc.addImage(rec.signature, 'PNG', d.cell.x + 2, d.cell.y + 1, 30, 8); } }
    });
    doc.save(`Asistencias_${Date.now()}.pdf`);
  };
  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <h2 className="text-white text-2xl font-black italic uppercase">Firmas Recibidas</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onSync} className="p-3 bg-blue-500/10 rounded-xl text-blue-500 hover:bg-blue-500/20 transition-all"><RefreshCw className={isSyncing ? "animate-spin" : ""} size={20} /></button>
          <button onClick={() => confirm("Eliminar?") && update({ records: state.records.filter((r: any) => !sel.includes(r.id)) })} disabled={!sel.length} className="flex-1 bg-red-500/10 text-red-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] disabled:opacity-20">Borrar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="flex-1 bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-600/20 disabled:opacity-30">PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[2rem] bg-[#0d111c] border border-gray-800 shadow-inner">
        <table className="w-full text-left min-w-[600px]">
          <thead className="text-slate-500 text-[10px] font-black uppercase border-b border-gray-800 bg-[#161e2e]">
            <tr>
              <th className="px-6 py-5 w-12"><input type="checkbox" onChange={e => setSel(e.target.checked ? state.records.map((r: any) => r.id) : [])} className="accent-blue-600" /></th>
              <th className="px-6 py-5">Empleado</th>
              <th className="px-6 py-5">Módulo</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {state.records.length === 0 ? (
              <tr><td colSpan={5} className="py-24 text-center text-slate-700 font-bold uppercase tracking-widest italic text-[10px]">No hay registros todavía</td></tr>
            ) : state.records.map((r: any) => (
              <tr key={r.id} className="hover:bg-blue-600/5 transition-all cursor-pointer" onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} readOnly className="accent-blue-600" /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-xs">{r.name}<div className="text-[10px] text-slate-600 font-normal">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] font-black text-blue-500 uppercase">{state.modules.find((m: any) => m.id === r.moduleId)?.name}</td>
                <td className="px-6 py-6 text-center">{r.signature && <img src={r.signature} className="h-8 mx-auto bg-white rounded p-1 shadow-sm" />}</td>
                <td className="px-6 py-6 text-[10px] text-slate-600 text-center font-bold">{new Date(r.timestamp).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClientesView = ({ state, update }: any) => {
  const [n, setN] = useState(""), [c, setC] = useState("");
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Empresas Clientes</h2>
      <div className="bg-[#0d111c] p-6 md:p-10 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2 text-left">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">Razón Social</label>
          <input value={n} onChange={e => setN(e.target.value.toUpperCase())} placeholder="EJ: TECH CORP S.A." className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all" />
        </div>
        <div className="flex-1 w-full space-y-2 text-left">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">CUIT / RUT</label>
          <input value={c} onChange={e => setC(e.target.value)} placeholder="00-00000000-0" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all" />
        </div>
        <button onClick={() => { if(!n) return; update({ clients: [...state.clients, { id: Date.now().toString(), name: n, cuit: c }] }); setN(""); setC(""); }} className="w-full lg:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 shadow-xl">Registrar</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 relative group shadow-lg hover:border-blue-500/30 transition-all text-left">
            <h3 className="text-white font-black uppercase italic mb-1 text-base truncate pr-8">{i.name}</h3>
            <p className="text-slate-600 text-[10px] font-black uppercase">CUIT: {i.cuit}</p>
            <button onClick={() => confirm("Eliminar?") && update({ clients: state.clients.filter((cl: any) => cl.id !== i.id) })} className="absolute top-8 right-8 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ModulosView = ({ state, update }: any) => {
  const [name, setName] = useState("");
  const [activeMod, setActiveMod] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const addDoc = (id: string) => {
    if(!docName || !docUrl) return;
    update({ modules: state.modules.map((m: any) => m.id === id ? { ...m, documents: [...(m.documents || []), { name: docName.toUpperCase(), url: docUrl }] } : m) });
    setDocName(""); setDocUrl(""); setActiveMod(null);
  };
  const generateAIAssistance = async (id: string, moduleName: string) => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Descripción para el curso "${moduleName}".`,
      });
      update({ modules: state.modules.map((m: any) => m.id === id ? { ...m, description: response.text } : m) });
    } catch (err) {} finally { setIsGenerating(false); }
  };
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Módulos Técnicos</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-12 bg-[#0d111c] p-5 rounded-[2.5rem] border border-gray-800">
        <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="TÍTULO DE LA CAPACITACIÓN" className="flex-1 bg-transparent text-white px-6 font-bold uppercase outline-none text-sm" />
        <button onClick={() => { if(!name) return; update({ modules: [...state.modules, { id: Date.now().toString(), name: name, documents: [] }] }); setName(""); }} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 shadow-xl">Crear Módulo</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {state.modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl flex flex-col">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center">
               <h3 className="text-white font-black uppercase text-[11px] italic truncate pr-4">{m.name}</h3>
               <div className="flex gap-2">
                 <button onClick={() => generateAIAssistance(m.id, m.name)} className="text-blue-500 p-1">{isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}</button>
                 <button onClick={() => confirm("Eliminar?") && update({ modules: state.modules.filter((i: any) => i.id !== m.id) })} className="text-slate-800 hover:text-red-500 transition-colors p-1"><Trash2 size={18} /></button>
               </div>
             </div>
             <div className="p-8 space-y-6 flex-1 text-left">
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Manuales Vinculados</p>
                  {m.documents?.map((d: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#111827] p-4 rounded-xl border border-gray-800">
                      <span className="font-bold uppercase text-[10px] text-slate-300 truncate pr-4">{d.name}</span>
                      <button onClick={() => update({ modules: state.modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, i: number) => i !== idx) } : mod) })} className="text-slate-700 hover:text-red-500 transition-colors p-1"><X size={16} /></button>
                    </div>
                  ))}
                </div>
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-6 rounded-2xl border border-blue-500/30 space-y-4 animate-in zoom-in">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE DEL DOCUMENTO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3.5 rounded-xl text-[10px] font-bold outline-none" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="LINK DROPBOX" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3.5 rounded-xl text-[10px] font-bold outline-none" />
                    <button onClick={() => addDoc(m.id)} className="w-full bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase active:scale-95">Guardar Enlace</button>
                    <button onClick={() => setActiveMod(null)} className="w-full text-[9px] text-slate-600 font-bold uppercase">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-5 border-2 border-dashed border-gray-800 rounded-2xl text-slate-800 font-black uppercase text-[10px] hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                    <Plus size={16} /> Vincular Dropbox/Manual
                  </button>
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AsignacionesView = ({ state, update, wsid }: any) => {
  const [cid, setCid] = useState(""), [mid, setMid] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Generar Acceso para Empleados</h2>
      <div className="bg-[#0d111c] p-6 md:p-10 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2 text-left">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">Empresa</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none">
            <option value="">-- Seleccione Cliente --</option>
            {state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full space-y-2 text-left">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">Módulo</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none">
            <option value="">-- Seleccione Módulo --</option>
            {state.modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={() => { if(!cid || !mid) return; update({ assignments: [...state.assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] }); }} className="w-full lg:w-auto bg-blue-600 text-white px-12 h-16 rounded-[2rem] font-black uppercase text-xs active:scale-95">Crear Vínculo</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
        {state.assignments.map((a: any) => (
          <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col group shadow-lg">
            <p className="text-blue-500 font-black uppercase text-[8px] mb-1 italic tracking-widest">{state.clients.find((c: any) => c.id === a.clientId)?.name}</p>
            <h3 className="text-white text-lg font-black italic uppercase mb-6 truncate leading-tight">{state.modules.find((m: any) => m.id === a.moduleId)?.name}</h3>
            <button onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}`;
              setLink(url);
              setQr(await QRCode.toDataURL(url, { width: 600, margin: 2 }));
            }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-blue-700 active:scale-95 shadow-lg">Obtener QR</button>
            <button onClick={() => confirm("Borrar?") && update({ assignments: state.assignments.filter((as: any) => as.id !== a.id) })} className="mt-4 text-slate-800 text-[9px] uppercase font-black hover:text-red-500 transition-colors text-center">Eliminar</button>
          </div>
        ))}
      </div>
      {qr && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in" onClick={() => { setQr(null); setCopied(false); }}>
          <div className="bg-[#111827] p-8 md:p-12 rounded-[4rem] border border-gray-800 text-center animate-in zoom-in max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-white p-4 rounded-[2.5rem] mb-8 inline-block shadow-2xl">
              <img src={qr} className="size-64 md:size-80" />
            </div>
            <div className="space-y-4">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Portal de Firmas para Empleados</p>
              <div className="flex bg-[#0d111c] p-2 rounded-2xl border border-gray-800 items-center">
                <input readOnly value={link} className="flex-1 bg-transparent text-[8px] text-blue-500 px-3 truncate outline-none font-bold" />
                <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }} className={`p-3 rounded-xl transition-all active:scale-90 ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InstructorView = ({ state, update }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (sigRef.current && state.instructor?.signature) {
        const canvas = (sigRef.current as any).getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        sigRef.current.fromDataURL(state.instructor.signature);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.instructor?.signature]);
  const handleSave = () => {
    const signatureData = sigRef.current?.isEmpty() ? "" : sigRef.current?.toDataURL('image/png');
    update({ instructor: { ...state.instructor, signature: signatureData || "" } });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };
  return (
    <div className="animate-in fade-in max-w-2xl mx-auto py-4">
      <div className="bg-[#0d111c] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl relative overflow-hidden">
        <h2 className="text-white text-2xl font-black italic uppercase">Perfil del Instructor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="space-y-2">
            <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">Nombre Completo</label>
            <input value={state.instructor?.name || ""} onChange={e => update({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} placeholder="EJ: ING. RICARDO GÓMEZ" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>
          <div className="space-y-2">
            <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest italic">Cargo / Título Profesional</label>
            <input value={state.instructor?.role || ""} onChange={e => update({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} placeholder="EJ: RESP. HIGIENE Y SEGURIDAD" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-slate-600 text-[10px] font-black uppercase tracking-widest italic">Firma de Validación Hológrafa</label>
            <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-black uppercase text-slate-700 hover:text-red-500">Limpiar</button>
          </div>
          <div className="bg-white rounded-[2.5rem] h-60 overflow-hidden border-4 border-gray-800 relative cursor-crosshair">
            <SignatureCanvas {...({ ref: sigRef, penColor: "blue", canvasProps: { className: 'w-full h-full' } } as any)} />
          </div>
        </div>
        <button onClick={handleSave} className={`w-full py-6 rounded-[2.5rem] font-black uppercase text-xs active:scale-95 transition-all shadow-xl ${saveSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saveSuccess ? "Cambios Sincronizados" : "Guardar Configuración"}
        </button>
      </div>
    </div>
  );
};

const UserPortal = ({ state, onSubmit, onSync }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState(1), [name, setName] = useState(""), [dni, setDni] = useState(""), [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const p = new URLSearchParams(window.location.search), cid = p.get('cid'), mid = p.get('mid');
  const cl = state.clients.find((c: any) => c.id === cid);
  const mo = state.modules.find((m: any) => m.id === mid);
  useEffect(() => { if (!mo && onSync) onSync(); }, [mo, onSync]);
  const generateReceipt = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.text("Certificado de Capacitación", 15, 28);
    doc.setTextColor(0, 0, 0); doc.setFontSize(22); doc.text(name, 15, 80);
    doc.setFontSize(11); doc.text(`DNI N° ${dni}, de la firma ${cl?.name || 'TRAINERAPP'},\nha participado satisfactoriamente de la capacitación de:`, 15, 90);
    doc.setFontSize(18); doc.text(`"${mo?.name || 'CAPACITACIÓN TÉCNICA'}"`, 15, 110);
    const lineY = doc.internal.pageSize.getHeight() - 65;
    if(sigRef.current && !sigRef.current.isEmpty()) doc.addImage(sigRef.current.toDataURL('image/png'), 'PNG', 20, lineY - 22, 50, 18);
    if(state.instructor?.signature) doc.addImage(state.instructor.signature, 'PNG', pageWidth - 80, lineY - 22, 50, 18);
    doc.line(20, lineY, 80, lineY); doc.line(pageWidth - 80, lineY, pageWidth - 20, lineY);
    doc.setFontSize(9); doc.text("Firma del Empleado", 35, lineY + 7); doc.text(state.instructor?.name || "Instructor", pageWidth - 65, lineY + 7);
    doc.save(`Certificado_${name}.pdf`);
  };
  if (done) return (
    <div className="max-w-md mx-auto py-24 text-center animate-in zoom-in p-6">
      <div className="bg-green-600/10 size-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><CheckCircle2 size={50} className="text-green-500" /></div>
      <h2 className="text-3xl font-black text-white italic uppercase mb-12 leading-tight">¡REGISTRO EXITOSO!<br/><span className="text-blue-500 text-sm normal-case tracking-wide">Firma enviada correctamente.</span></h2>
      <button onClick={generateReceipt} className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black uppercase mb-4 flex gap-3 items-center justify-center shadow-xl active:scale-95 transition-all text-xs md:text-sm"><Award size={20}/> Descargar PDF</button>
      <button onClick={() => window.location.href = window.location.pathname} className="w-full bg-slate-800 text-white py-5 rounded-[2.5rem] font-black uppercase opacity-60 hover:opacity-100 transition-all text-[10px] md:text-xs">Cerrar</button>
    </div>
  );
  return (
    <div className="max-w-md mx-auto py-6 md:py-12 px-4 animate-in slide-in-from-bottom-10">
      <div className="text-center mb-10">
        <h1 className="text-[clamp(1.5rem,8vw,2.5rem)] font-black italic text-white uppercase mb-2 leading-none">{mo?.name || "Buscando..."}</h1>
        <div className="bg-blue-600/10 px-5 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase inline-block mt-2 tracking-widest italic">{cl?.name || "Empresa"}</div>
      </div>
      <div className="bg-[#111827] rounded-[4rem] border border-gray-800/80 p-8 md:p-12 shadow-2xl relative overflow-hidden">
        {step === 1 ? (
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2 italic text-left">Material de Estudio</p>
              <div className="grid gap-4">
                {mo?.documents?.map((doc: any, i: number) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener" className="flex items-center justify-between bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl hover:bg-blue-600/20 transition-all shadow-md active:scale-95 group">
                    <div className="flex flex-col gap-1 truncate text-left"><span className="text-white font-black uppercase text-[11px] truncate pr-4 tracking-wide">{doc.name}</span><span className="text-blue-400 text-[8px] font-bold uppercase tracking-tight italic">Click para Ver</span></div>
                    <div className="bg-blue-600 p-2.5 rounded-xl"><ExternalLink size={18} className="text-white" /></div>
                  </a>
                ))}
              </div>
            </div>
            <div className="space-y-6 pt-10 border-t border-gray-800/50 text-left">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] text-center italic">Identificación del Empleado</p>
              <div className="space-y-5">
                <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="NOMBRE Y APELLIDO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-5 md:p-6 rounded-2xl font-bold uppercase outline-none focus:border-blue-500 transition-all text-sm shadow-inner" />
                <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI / IDENTIFICACIÓN" className="w-full bg-[#0d111c] border border-gray-800 text-white p-5 md:p-6 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all text-sm shadow-inner" />
              </div>
              <button onClick={() => { if(!name || !dni) return alert("Complete sus datos."); setStep(2); }} className="w-full bg-blue-600 text-white py-5 md:py-6 rounded-[2.5rem] font-black uppercase shadow-xl mt-6 active:scale-95 flex items-center justify-center gap-3 text-xs md:text-sm">Siguiente <ChevronRight size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic">Firme abajo</label>
                <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-black uppercase text-slate-700">Limpiar</button>
              </div>
              <div className="bg-white rounded-[2.5rem] h-64 overflow-hidden border-4 border-gray-800 relative shadow-2xl">
                <SignatureCanvas {...({ ref: sigRef, penColor: "blue", canvasProps: { className: 'w-full h-full' } } as any)} />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-slate-500 py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Atrás</button>
              <button 
                disabled={isSubmitting}
                onClick={async () => { 
                  if(sigRef.current?.isEmpty()) return alert("Debe firmar."); 
                  setIsSubmitting(true);
                  const empSignature = sigRef.current!.toDataURL('image/png');
                  const rec = { id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: empSignature };
                  await onSubmit(rec); 
                  setDone(true); 
                  setIsSubmitting(false);
                }} 
                className="flex-[2] bg-blue-600 text-white py-5 md:py-6 rounded-[2.5rem] font-black uppercase shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 text-xs md:text-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Finalizar y Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
