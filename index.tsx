
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, Trash2, CheckCircle2, ShieldCheck, ExternalLink, X, RefreshCw, Plus, 
  Award, Loader2, Copy, Check, ChevronRight, Lock, Key, Eraser, AlertTriangle, LogOut
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces ---
interface Client { id: string; name: string; cuit: string; }
interface ModuleDocument { name: string; url: string; }
interface Module { id: string; name: string; documents: ModuleDocument[]; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface AttendanceRecord { id: string; name: string; dni: string; companyId: string; moduleId: string; timestamp: string; signature: string; }
interface Instructor { name: string; role: string; signature: string; }
interface AppState { clients: Client[]; modules: Module[]; assignments: Assignment[]; records: AttendanceRecord[]; instructor: Instructor; }

// --- Config ---
const STORAGE_KEYS = { 
  MASTER_KEY: 'trainer_pro_mk_v42',
  WSID: 'trainer_pro_wsid_v42', 
  AUTH: 'trainer_pro_auth_v42',
  STATE_CACHE: 'trainer_pro_cache_v42'
};
const API_URL = 'https://api.restful-api.dev/objects';

// Helper: Ultra-Compression (Reduces size significantly to prevent 500 errors)
const compressSignature = (canvas: HTMLCanvasElement): string => {
  const targetW = 180; // Small but legible for signatures
  const targetH = 90;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetW;
  tempCanvas.height = targetH;
  const ctx = tempCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
  }
  return tempCanvas.toDataURL('image/jpeg', 0.15); // High compression
};

const api = {
  load: async (id: string): Promise<AppState | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`${API_URL}/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch { return null; }
  },
  save: async (id: string, masterKey: string, data: AppState): Promise<boolean> => {
    if (!id || !masterKey) return false;
    try {
      // Keep only last 15 records in cloud to stay within payload limits
      const optimizedData = { ...data, records: (data.records || []).slice(0, 15) };
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `TrainerCloud_${masterKey}`, data: optimizedData })
      });
      return res.ok;
    } catch { return false; }
  },
  findByKey: async (masterKey: string): Promise<{id: string, data: AppState} | null> => {
    try {
      const res = await fetch(API_URL);
      const objects = await res.json();
      const prefix = `TrainerCloud_`;
      const found = objects.find((obj: any) => obj.name === `${prefix}${masterKey}`);
      if (found) {
        const fullRes = await fetch(`${API_URL}/${found.id}`);
        const fullObj = await fullRes.json();
        return { id: found.id, data: fullObj.data };
      }
      return null;
    } catch { return null; }
  },
  create: async (masterKey: string): Promise<string> => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `TrainerCloud_${masterKey}`, 
          data: { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } } 
        })
      });
      const json = await res.json();
      return json.id;
    } catch { return ""; }
  }
};

const App = () => {
  const [view, setView] = useState<'landing' | 'userPortal' | 'adminLogin' | 'adminDashboard'>('landing');
  const [masterKey, setMasterKey] = useState(() => localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "");
  const [wsid, setWsid] = useState(() => localStorage.getItem(STORAGE_KEYS.WSID) || "");
  const [isAuth, setIsAuth] = useState(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  const [state, setState] = useState<AppState>(() => {
    const cache = localStorage.getItem(STORAGE_KEYS.STATE_CACHE);
    return cache ? JSON.parse(cache) : { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } };
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const isUpdatingRef = useRef(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');

  const sync = useCallback(async (silent = true) => {
    if (isUpdatingRef.current || !wsid) return;
    if (!silent) setSyncStatus('syncing');
    const cloud = await api.load(wsid);
    if (cloud) {
      if (JSON.stringify(cloud) !== JSON.stringify(state)) setState(cloud);
      setSyncStatus('idle');
    } else if (!silent) setSyncStatus('error');
  }, [wsid, state]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const urlWsid = p.get('wsid');
    const urlMk = p.get('mk');
    if (urlWsid) setWsid(urlWsid);
    if (urlMk) setMasterKey(urlMk);
    if (p.get('cid') && p.get('mid')) setView('userPortal');
  }, []);

  useEffect(() => {
    if (wsid) sync(false);
    const timer = setInterval(() => sync(true), 20000);
    return () => clearInterval(timer);
  }, [wsid, sync]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(state));
  }, [state]);

  const updateGlobal = async (patch: Partial<AppState>) => {
    if (!wsid) return;
    isUpdatingRef.current = true;
    setSyncStatus('syncing');
    const latest = await api.load(wsid);
    const base = latest || state;
    const newState = { ...base, ...patch };
    setState(newState);
    const ok = await api.save(wsid, masterKey, newState);
    setSyncStatus(ok ? 'saved' : 'error');
    if (ok) setTimeout(() => setSyncStatus('idle'), 2000);
    isUpdatingRef.current = false;
  };

  const handleLogin = async (keyInput: string) => {
    if (!keyInput) return;
    setIsLoggingIn(true);
    const cleanKey = keyInput.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      const existing = await api.findByKey(cleanKey);
      const targetWsid = existing ? existing.id : await api.create(cleanKey);
      if (targetWsid) {
        if (existing) setState(existing.data);
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        localStorage.setItem(STORAGE_KEYS.MASTER_KEY, cleanKey);
        localStorage.setItem(STORAGE_KEYS.WSID, targetWsid);
        setMasterKey(cleanKey);
        setWsid(targetWsid);
        setIsAuth(true);
        setView('adminDashboard');
      }
    } catch { alert("Error de conexión"); }
    finally { setIsLoggingIn(false); }
  };

  const logOut = () => {
    localStorage.clear();
    window.location.href = window.location.origin + window.location.pathname;
  };

  return (
    <div className="min-h-screen bg-[#060912] text-slate-100 flex flex-col">
      <header className="fixed top-0 w-full z-40 bg-[#0a1120]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
          <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-600/20"><BookOpen size={20} className="text-white" /></div>
          <span className="font-black italic uppercase text-lg tracking-tighter">TRAINER<span className="text-brand-500">PRO</span></span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 ${syncStatus === 'error' ? 'bg-red-500/10' : 'bg-slate-900/50'}`}>
            <div className={`size-1.5 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : syncStatus === 'syncing' ? 'bg-brand-400 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{syncStatus === 'syncing' ? 'Sync' : 'Online'}</span>
          </div>
          {isAuth && view === 'adminDashboard' && (
            <button onClick={logOut} className="text-red-500 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all border border-red-500/20"><LogOut size={16} /></button>
          )}
        </div>
      </header>

      <main className="flex-1 pt-24 px-4 pb-12 w-full max-w-6xl mx-auto">
        {view === 'landing' && (
          <div className="h-[75vh] flex flex-col items-center justify-center text-center space-y-12">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-black italic uppercase leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">TRAINER<br/><span className="text-brand-600">PRO</span></h1>
              <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] md:text-xs">Digital Training Management & Signatures</p>
            </div>
            <button onClick={() => isAuth ? setView('adminDashboard') : setView('adminLogin')} className="group relative bg-brand-600 hover:bg-brand-700 px-12 py-5 rounded-2xl font-black uppercase text-xs transition-all shadow-2xl shadow-brand-600/40">
              <span className="flex items-center gap-3">Panel de Control <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform"/></span>
            </button>
          </div>
        )}

        {view === 'adminLogin' && (
          <div className="max-w-md mx-auto mt-20 p-10 bg-[#111827] rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 animate-in zoom-in duration-300">
            <div className="bg-brand-600/10 size-16 rounded-2xl flex items-center justify-center mx-auto"><ShieldCheck size={32} className="text-brand-600" /></div>
            <h2 className="text-xl font-black uppercase italic text-center">Acceso de Seguridad</h2>
            <div className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input type="password" placeholder="Clave de Acceso" className="w-full bg-[#0d111c] border border-white/5 pl-14 pr-6 py-5 rounded-2xl outline-none focus:border-brand-600 font-bold text-lg transition-all" onKeyDown={(e) => e.key === 'Enter' && handleLogin((e.target as HTMLInputElement).value)} />
              </div>
              <button disabled={isLoggingIn} onClick={() => handleLogin((document.querySelector('input[type="password"]') as HTMLInputElement).value)} className="w-full bg-brand-600 hover:bg-brand-700 py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-brand-600/20 active:scale-95 transition-all">
                {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : "Iniciar Sesión"}
              </button>
            </div>
          </div>
        )}

        {view === 'adminDashboard' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter">Mi <span className="text-brand-600">Gestión</span></h1>
                <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/5 w-fit">
                  <Key size={12} className="text-brand-500" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{masterKey}</span>
                </div>
              </div>
              <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar shadow-xl">
                {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === t ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#111827] rounded-[3rem] border border-white/5 p-6 md:p-12 min-h-[500px] shadow-inner">
              {activeTab === 'asistencias' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="font-black uppercase italic text-lg tracking-tight">Registro de Firmas</h3>
                    <div className="flex gap-3">
                      <button onClick={() => confirm("¿Vaciar todos los registros?") && updateGlobal({ records: [] })} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Eraser size={20}/></button>
                      <button onClick={() => sync(false)} className="p-3 bg-brand-600/10 text-brand-500 rounded-2xl hover:bg-brand-600 hover:text-white transition-all"><RefreshCw size={20} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-3xl border border-white/5">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-[#0d111c] text-slate-500 font-black uppercase text-[10px] tracking-widest">
                        <tr><th className="px-6 py-5">Empleado</th><th className="px-6 py-5">Curso</th><th className="px-6 py-5 text-center">Firma Digital</th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(state.records || []).map(r => (
                          <tr key={r.id} className="hover:bg-brand-600/5 transition-colors">
                            <td className="px-6 py-6 font-bold">{r.name}<div className="text-[10px] text-slate-600 font-medium">DNI: {r.dni}</div></td>
                            <td className="px-6 py-6 text-brand-500 font-black italic uppercase text-[11px]">{state.modules.find(m => m.id === r.moduleId)?.name || 'CURSO ELIMINADO'}</td>
                            <td className="px-6 py-6 text-center">
                              {r.signature ? <img src={r.signature} className="h-10 mx-auto bg-white rounded-lg p-1 shadow-md border border-slate-200" /> : <span className="text-slate-700 italic">Sin firma</span>}
                            </td>
                          </tr>
                        ))}
                        {(!state.records || state.records.length === 0) && (
                          <tr><td colSpan={3} className="py-24 text-center text-slate-700 font-bold uppercase italic tracking-widest">No hay registros almacenados</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'asignaciones' && (
                <div className="space-y-10">
                   <div className="bg-[#0d111c] p-6 rounded-[2.5rem] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-inner">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 px-3 italic">Empresa Cliente</label>
                       <select id="sel-client" className="w-full bg-[#111827] border border-white/5 p-5 rounded-2xl outline-none font-bold uppercase text-xs focus:border-brand-600">
                          <option value="">-- SELECCIONE CLIENTE --</option>
                          {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 px-3 italic">Capacitación</label>
                       <select id="sel-module" className="w-full bg-[#111827] border border-white/5 p-5 rounded-2xl outline-none font-bold uppercase text-xs focus:border-brand-600">
                          <option value="">-- SELECCIONE MÓDULO --</option>
                          {state.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                       </select>
                     </div>
                   </div>
                   <button onClick={() => {
                     const cid = (document.getElementById('sel-client') as HTMLSelectElement).value;
                     const mid = (document.getElementById('sel-module') as HTMLSelectElement).value;
                     if(cid && mid) updateGlobal({ assignments: [...(state.assignments || []), { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] });
                   }} className="w-full bg-brand-600 hover:bg-brand-700 py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all">Generar Nuevo QR de Asistencia</button>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {state.assignments.map(a => (
                       <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-white/5 flex flex-col gap-5 shadow-lg group">
                          <div className="flex justify-between items-start">
                            <h4 className="font-black uppercase text-base italic tracking-tight flex-1 pr-4">{state.modules.find(m => m.id === a.moduleId)?.name}</h4>
                            <button onClick={() => updateGlobal({ assignments: state.assignments.filter(x => x.id !== a.id) })} className="text-slate-800 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button>
                          </div>
                          <p className="text-[11px] text-brand-500 font-black uppercase tracking-widest italic">{state.clients.find(c => c.id === a.clientId)?.name}</p>
                          <button onClick={async () => {
                            const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}&mk=${masterKey}`;
                            const qrData = await QRCode.toDataURL(url, { width: 500, margin: 2 });
                            const win = window.open();
                            win?.document.write(`
                              <body style="background:#060912;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                                <div style="text-align:center;background:#111827;padding:50px;border-radius:40px;border:1px solid rgba(255,255,255,0.1);max-width:400px;">
                                  <h2 style="text-transform:uppercase;margin-bottom:10px;font-size:18px;">REGISTRO ASISTENCIA</h2>
                                  <p style="color:#38a9f8;font-weight:bold;text-transform:uppercase;font-size:12px;margin-bottom:40px;">${state.modules.find(m => m.id === a.moduleId)?.name}</p>
                                  <div style="background:white;padding:20px;border-radius:20px;display:inline-block;"><img src="${qrData}" style="width:300px;display:block;"></div>
                                  <p style="margin-top:30px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#64748b;">Escanee para iniciar registro digital</p>
                                </div>
                              </body>
                            `);
                          }} className="w-full bg-brand-600 group-hover:bg-brand-500 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all">Lanzar QR</button>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {activeTab === 'modulos' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-4 bg-[#0d111c] p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                    <input id="mod-name" placeholder="TÍTULO DE CAPACITACIÓN" className="flex-1 bg-transparent border-none text-white px-4 font-black uppercase outline-none text-sm placeholder:text-slate-700" />
                    <button onClick={() => {
                      const n = (document.getElementById('mod-name') as HTMLInputElement).value;
                      if(n) { updateGlobal({ modules: [...(state.modules || []), { id: Date.now().toString(), name: n.toUpperCase(), documents: [] }] }); (document.getElementById('mod-name') as HTMLInputElement).value = ""; }
                    }} className="bg-brand-600 hover:bg-brand-700 px-10 py-5 rounded-2xl font-black uppercase text-xs transition-all shadow-lg active:scale-95">Crear Módulo</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {state.modules.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-[#0d111c] p-6 rounded-3xl border border-white/5 shadow-lg group hover:border-brand-600/30 transition-all">
                        <span className="font-black text-xs uppercase italic tracking-tight">{m.name}</span>
                        <button onClick={() => confirm("¿Borrar módulo?") && updateGlobal({ modules: state.modules.filter(x => x.id !== m.id) })} className="text-slate-800 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'clientes' && (
                <div className="space-y-10">
                  <div className="bg-[#0d111c] p-8 rounded-[3rem] border border-white/5 space-y-6 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 px-3">Nombre Empresa</label>
                        <input id="cli-name" placeholder="EJ: TECH CORP S.A." className="w-full bg-[#111827] border border-white/5 p-5 rounded-2xl outline-none font-bold uppercase text-xs focus:border-brand-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 px-3">CUIT / Identificación</label>
                        <input id="cli-cuit" placeholder="EJ: 30-70809010-2" className="w-full bg-[#111827] border border-white/5 p-5 rounded-2xl outline-none font-bold text-xs focus:border-brand-600" />
                      </div>
                    </div>
                    <button onClick={() => {
                      const n = (document.getElementById('cli-name') as HTMLInputElement).value;
                      const c = (document.getElementById('cli-cuit') as HTMLInputElement).value;
                      if(n) { updateGlobal({ clients: [...(state.clients || []), { id: Date.now().toString(), name: n.toUpperCase(), cuit: c }] }); (document.getElementById('cli-name') as HTMLInputElement).value = ""; (document.getElementById('cli-cuit') as HTMLInputElement).value = ""; }
                    }} className="w-full bg-brand-600 hover:bg-brand-700 py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl transition-all">Registrar Cliente</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.clients.map(cl => (
                      <div key={cl.id} className="bg-[#0d111c] p-6 rounded-[2.5rem] border border-white/5 shadow-md flex justify-between items-center group">
                        <div className="truncate pr-4">
                          <h4 className="font-black text-xs uppercase italic truncate">{cl.name}</h4>
                          <p className="text-[9px] text-slate-600 font-bold tracking-widest">{cl.cuit}</p>
                        </div>
                        <button onClick={() => confirm("¿Eliminar cliente?") && updateGlobal({ clients: state.clients.filter(x => x.id !== cl.id) })} className="text-slate-800 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'instructor' && (
                <div className="max-w-xl mx-auto space-y-10 animate-in fade-in">
                   <div className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 px-3">Nombre Profesional</label>
                       <input value={state.instructor?.name || ""} onChange={e => updateGlobal({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} placeholder="EJ: ING. CARLOS MARTÍNEZ" className="w-full bg-[#0d111c] border border-white/5 p-6 rounded-[2rem] outline-none font-black uppercase text-xs focus:border-brand-600 shadow-inner" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 px-3">Cargo o Especialidad</label>
                       <input value={state.instructor?.role || ""} onChange={e => updateGlobal({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} placeholder="EJ: RESPONSABLE SEGURIDAD E HIGIENE" className="w-full bg-[#0d111c] border border-white/5 p-6 rounded-[2rem] outline-none font-black uppercase text-xs focus:border-brand-600 shadow-inner" />
                     </div>
                   </div>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center px-4">
                        <label className="text-[10px] font-black uppercase italic text-slate-500">Firma de Validación</label>
                        <p className="text-[9px] text-slate-700 italic">La firma se gestiona de forma individual.</p>
                     </div>
                     <div className="bg-slate-900/50 p-12 rounded-[3rem] border border-white/5 text-center space-y-4">
                        <Award size={40} className="mx-auto text-brand-600 opacity-20" />
                        <p className="text-xs text-slate-600 font-bold uppercase italic tracking-widest">Panel del Instructor Configurado</p>
                     </div>
                   </div>
                   <button onClick={() => alert("Perfil actualizado localmente")} className="w-full bg-brand-600 py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Guardar Perfil</button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'userPortal' && (
          <UserPortal 
            state={state} 
            onSubmit={async (rec) => {
              const cloud = await api.load(wsid);
              const base = cloud || state;
              // Limit records to prevent Error 500 (JSON too large)
              const updated = { ...base, records: [rec, ...(base.records || [])].slice(0, 15) };
              const ok = await api.save(wsid, masterKey, updated);
              if (!ok) throw new Error("Cloud Error: Payloads limit reached.");
              setState(updated);
            }} 
          />
        )}
      </main>
      
      {view === 'adminDashboard' && (
        <footer className="py-8 text-center border-t border-white/5 bg-[#0a1120]/50">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-700 italic">PRO PLATFORM BY TRAINERAPP &copy; 2024</p>
        </footer>
      )}
    </div>
  );
};

// --- Mobile Portal Component ---
const UserPortal = ({ state, onSubmit }: { state: AppState, onSubmit: (r: AttendanceRecord) => Promise<void> }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  const [error, setError] = useState("");
  
  const p = new URLSearchParams(window.location.search);
  const cid = p.get('cid'), mid = p.get('mid');
  const cl = state.clients?.find(c => c.id === cid);
  const mo = state.modules?.find(m => m.id === mid);

  if (done) return (
    <div className="max-w-md mx-auto text-center py-20 animate-in zoom-in duration-500 space-y-10 px-6">
      <div className="bg-green-600/10 size-28 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 size={70} className="text-green-500" /></div>
      <div className="space-y-3">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">¡LISTO!</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] leading-relaxed italic">Su asistencia y firma han sido registradas en la nube.</p>
      </div>
      <button onClick={() => window.location.href='/'} className="w-full bg-slate-800 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all shadow-xl">Cerrar Sesión</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto space-y-10 animate-in slide-in-from-bottom-12 duration-700 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-black uppercase italic leading-none tracking-tight">{mo?.name || "CURSO NO ENCONTRADO"}</h1>
        <div className="inline-block bg-brand-600/10 px-5 py-1.5 rounded-full border border-brand-500/20 text-brand-500 font-black uppercase text-[10px] italic tracking-widest">{cl?.name || "SIN CLIENTE ASIGNADO"}</div>
      </div>

      <div className="bg-[#111827] rounded-[3.5rem] border border-white/5 p-8 md:p-12 space-y-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-600/50 to-transparent"></div>
        {step === 1 ? (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 px-3 italic">Su Nombre Completo</label>
                <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="EJ: JUAN PÉREZ" className="w-full bg-[#0d111c] border border-white/5 p-5 rounded-2xl font-black uppercase outline-none focus:border-brand-600 text-sm shadow-inner" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 px-3 italic">Identificación (DNI)</label>
                <input value={dni} onChange={e => setDni(e.target.value)} placeholder="NÚMERO SIN PUNTOS" className="w-full bg-[#0d111c] border border-white/5 p-5 rounded-2xl font-bold outline-none focus:border-brand-600 text-sm shadow-inner" />
              </div>
            </div>
            <button onClick={() => { if(name && dni) setStep(2); else alert("Por favor complete sus datos"); }} className="w-full bg-brand-600 hover:bg-brand-700 py-6 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl shadow-brand-600/20 active:scale-95 transition-all">Siguiente Paso <ChevronRight size={18}/></button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <label className="text-[11px] font-black uppercase text-slate-500 italic">Firma en el recuadro blanco</label>
                <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-black uppercase text-slate-700 hover:text-red-500">Borrar</button>
              </div>
              <div className="bg-white rounded-[2rem] h-64 overflow-hidden relative shadow-2xl border-4 border-slate-900 cursor-crosshair">
                <SignatureCanvas ref={sigRef} penColor="blue" canvasProps={{ className: 'w-full h-full' }} />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-3 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 animate-bounce">
                <AlertTriangle size={20} className="text-red-500" />
                <p className="text-[10px] font-bold text-red-400 uppercase leading-tight">{error}</p>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Atrás</button>
              <button disabled={isSubmitting} onClick={async () => {
                if(sigRef.current?.isEmpty()) return alert("Debe firmar para completar.");
                setIsSubmitting(true);
                setError("");
                try {
                  const canvas = sigRef.current!.getTrimmedCanvas();
                  const sig = compressSignature(canvas);
                  await onSubmit({ 
                    id: Date.now().toString(), 
                    name, 
                    dni, 
                    companyId: cid!, 
                    moduleId: mid!, 
                    timestamp: new Date().toISOString(), 
                    signature: sig 
                  });
                  setDone(true);
                } catch(e) { 
                  setError("Error en la nube. Puede que el servidor esté saturado o el registro esté lleno.");
                } finally { setIsSubmitting(false); }
              }} className="flex-[2] bg-brand-600 hover:bg-brand-700 py-6 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl shadow-brand-600/20 active:scale-95 transition-all">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Finalizar y Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-700 italic">PLATAFORMA DE REGISTRO SEGURO TRAINERPRO</p>
      </div>
    </div>
  );
};

// --- Initialization ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
