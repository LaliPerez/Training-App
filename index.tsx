
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, 
  Trash2, 
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
  Lock,
  Cloud,
  AlertCircle,
  Key,
  Eraser
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  MASTER_KEY: 'trainer_master_key_v40',
  WSID: 'trainer_ws_id_v40', 
  AUTH: 'trainer_auth_v40',
  STATE_CACHE: 'trainer_state_cache_v40'
};
const API_URL = 'https://api.restful-api.dev/objects';

// Compresión Ultra (Máximo ahorro de espacio para evitar Error 500)
const compressSignature = (canvas: HTMLCanvasElement): string => {
  const targetW = 200;
  const targetH = 100;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetW;
  tempCanvas.height = targetH;
  const ctx = tempCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
  }
  // Calidad 0.1 para que el JSON sea minúsculo
  return tempCanvas.toDataURL('image/jpeg', 0.1); 
};

const api = {
  load: async (id: string): Promise<AppState | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`${API_URL}/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) { return null; }
  },

  save: async (id: string, masterKey: string, data: AppState): Promise<boolean> => {
    if (!id || !masterKey) return false;
    try {
      // Limitar a los últimos 20 registros para no sobrecargar el servidor
      const limitedData = {
        ...data,
        records: (data.records || []).slice(0, 20)
      };

      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `TrainerCloud_${masterKey}`, 
          data: limitedData 
        })
      });
      return res.ok;
    } catch (err) { return false; }
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
    } catch (err) { return null; }
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
  const isUpdatingRef = useRef(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const sync = useCallback(async (silent = true) => {
    if (isUpdatingRef.current || !wsid) return;
    if (!silent) setSyncStatus('syncing');
    const cloudData = await api.load(wsid);
    if (cloudData) {
      if (JSON.stringify(cloudData) !== JSON.stringify(state)) {
        setState(cloudData);
      }
      setSyncStatus('idle');
    } else if (!silent) {
      setSyncStatus('error');
    }
  }, [wsid, state]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const urlWsid = p.get('wsid');
    const urlMk = p.get('mk');
    if (urlWsid) setWsid(urlWsid);
    if (urlMk) setMasterKey(urlMk);
    if (p.get('cid') && p.get('mid')) setView('userForm');
  }, []);

  useEffect(() => {
    if (wsid) sync(false);
    const timer = setInterval(() => sync(true), 15000);
    return () => clearInterval(timer);
  }, [wsid, sync]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(state));
  }, [state]);

  const updateGlobal = async (patch: Partial<AppState>) => {
    if (!wsid) return;
    isUpdatingRef.current = true;
    setSyncStatus('syncing');
    const latestCloud = await api.load(wsid);
    const baseState = latestCloud || state;
    const newState = { ...baseState, ...patch };
    setState(newState);
    const success = await api.save(wsid, masterKey, newState);
    setSyncStatus(success ? 'saved' : 'error');
    if (success) setTimeout(() => setSyncStatus('idle'), 2000);
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
    } catch (e) { alert("Error de red"); }
    finally { setIsLoggingIn(false); }
  };

  return (
    <div className="min-h-screen bg-[#060912] font-sans antialiased">
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href='/'}>
          <div className="bg-blue-600 p-1.5 rounded-lg"><BookOpen size={18} /></div>
          <span className="font-black italic uppercase text-lg">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 ${syncStatus === 'error' ? 'bg-red-500/10' : 'bg-slate-900'}`}>
            <div className={`size-1.5 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-400">{syncStatus === 'syncing' ? 'Sync...' : 'Online'}</span>
          </div>
          {isAuth && view === 'adminDashboard' && (
            <button onClick={() => { localStorage.clear(); window.location.href='/'; }} className="text-red-500 font-bold uppercase text-[10px] px-3 py-1 border border-red-500/20 rounded-lg">Salir</button>
          )}
        </div>
      </nav>

      <main className="pt-24 px-4 max-w-5xl mx-auto pb-20">
        {view === 'landing' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
            <h1 className="text-6xl md:text-8xl font-black italic uppercase leading-none">TRAINER<br/><span className="text-blue-600">APP</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Gestión de Capacitaciones con Firma en la Nube</p>
            <button onClick={() => setView('adminLogin')} className="bg-blue-600 hover:bg-blue-700 px-10 py-5 rounded-full font-black uppercase text-xs transition-all shadow-xl shadow-blue-900/20">Panel Administrativo</button>
          </div>
        )}

        {view === 'adminLogin' && (
          <div className="max-w-md mx-auto mt-20 p-8 bg-[#111827] rounded-3xl border border-gray-800 text-center space-y-8">
            <ShieldCheck size={48} className="mx-auto text-blue-600" />
            <h2 className="text-2xl font-black uppercase italic">Acceso Seguro</h2>
            <input type="password" placeholder="Clave Maestra" className="w-full bg-[#0d111c] border border-gray-800 p-5 rounded-2xl outline-none focus:border-blue-600 font-bold" onKeyDown={(e) => e.key === 'Enter' && handleLogin((e.target as HTMLInputElement).value)} />
            <button disabled={isLoggingIn} onClick={() => handleLogin((document.querySelector('input[type="password"]') as HTMLInputElement).value)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
              {isLoggingIn ? <Loader2 className="animate-spin" size={16} /> : "Entrar"}
            </button>
          </div>
        )}

        {view === 'adminDashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                <h1 className="text-4xl font-black uppercase italic">Mi <span className="text-blue-600">Panel</span></h1>
                <div className="flex items-center gap-2 mt-2 bg-slate-900 px-3 py-1 rounded-full border border-gray-800 w-fit">
                  <Key size={12} className="text-blue-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">{masterKey}</span>
                </div>
              </div>
              <div className="flex bg-[#111827] p-1 rounded-2xl border border-gray-800 overflow-x-auto">
                {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                  <button key={t} onClick={() => setAdminTab(t as any)} className={`px-4 py-3 rounded-xl font-black uppercase text-[9px] transition-all whitespace-nowrap ${adminTab === t ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#111827] rounded-3xl border border-gray-800 p-6 md:p-10 min-h-[400px]">
              {adminTab === 'asistencias' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black uppercase italic text-xl">Registros (Nube)</h3>
                    <div className="flex gap-2">
                      <button onClick={() => confirm("¿Borrar todos?") && updateGlobal({ records: [] })} className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Eraser size={18}/></button>
                      <button onClick={() => sync(false)} className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-500 font-bold uppercase border-b border-gray-800">
                        <tr><th className="pb-4">Empleado</th><th className="pb-4">Curso</th><th className="pb-4 text-center">Firma</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {(state.records || []).map(r => (
                          <tr key={r.id} className="hover:bg-slate-800/30">
                            <td className="py-4 font-bold">{r.name}<div className="text-[9px] text-slate-600">{r.dni}</div></td>
                            <td className="py-4 text-blue-500 font-bold">{state.modules.find(m => m.id === r.moduleId)?.name || 'N/A'}</td>
                            <td className="py-4 text-center">{r.signature && <img src={r.signature} className="h-8 mx-auto bg-white rounded" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'asignaciones' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <select id="sel-client" className="bg-[#0d111c] border border-gray-800 p-4 rounded-xl outline-none font-bold uppercase text-xs">
                        <option value="">-- Cliente --</option>
                        {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                     <select id="sel-module" className="bg-[#0d111c] border border-gray-800 p-4 rounded-xl outline-none font-bold uppercase text-xs">
                        <option value="">-- Módulo --</option>
                        {state.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                     </select>
                   </div>
                   <button onClick={() => {
                     const cid = (document.getElementById('sel-client') as HTMLSelectElement).value;
                     const mid = (document.getElementById('sel-module') as HTMLSelectElement).value;
                     if(cid && mid) updateGlobal({ assignments: [...(state.assignments || []), { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] });
                   }} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase text-xs">Crear Acceso QR</button>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                     {state.assignments.map(a => (
                       <div key={a.id} className="bg-slate-900/50 p-6 rounded-2xl border border-gray-800 flex flex-col gap-4">
                          <h4 className="font-black uppercase text-sm leading-tight">{state.modules.find(m => m.id === a.moduleId)?.name}</h4>
                          <p className="text-[10px] text-blue-500 font-bold uppercase italic">{state.clients.find(c => c.id === a.clientId)?.name}</p>
                          <button onClick={async () => {
                            const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}&mk=${masterKey}`;
                            const qrData = await QRCode.toDataURL(url, { width: 400 });
                            const win = window.open();
                            win?.document.write(`<div style="text-align:center;font-family:sans-serif;padding:40px;"><h1>${state.modules.find(m => m.id === a.moduleId)?.name}</h1><img src="${qrData}" style="width:300px;"><p>Escanee para registrarse</p></div>`);
                          }} className="bg-blue-600 py-3 rounded-xl font-bold uppercase text-[10px]">Ver QR</button>
                          <button onClick={() => updateGlobal({ assignments: state.assignments.filter(x => x.id !== a.id) })} className="text-red-500 text-[9px] uppercase font-bold text-center">Eliminar</button>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {adminTab === 'modulos' && (
                <div className="space-y-6">
                  <div className="flex gap-2">
                    <input id="mod-name" placeholder="TÍTULO CURSO" className="flex-1 bg-[#0d111c] border border-gray-800 p-4 rounded-xl outline-none font-bold uppercase text-xs" />
                    <button onClick={() => {
                      const n = (document.getElementById('mod-name') as HTMLInputElement).value;
                      if(n) { updateGlobal({ modules: [...(state.modules || []), { id: Date.now().toString(), name: n.toUpperCase(), documents: [] }] }); (document.getElementById('mod-name') as HTMLInputElement).value = ""; }
                    }} className="bg-blue-600 px-6 rounded-xl font-black uppercase text-xs">Crear</button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {state.modules.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-gray-800">
                        <span className="font-bold text-xs uppercase italic">{m.name}</span>
                        <button onClick={() => updateGlobal({ modules: state.modules.filter(x => x.id !== m.id) })} className="text-red-500"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'clientes' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input id="cli-name" placeholder="EMPRESA" className="bg-[#0d111c] border border-gray-800 p-4 rounded-xl outline-none font-bold uppercase text-xs" />
                    <input id="cli-cuit" placeholder="CUIT" className="bg-[#0d111c] border border-gray-800 p-4 rounded-xl outline-none font-bold uppercase text-xs" />
                  </div>
                  <button onClick={() => {
                    const n = (document.getElementById('cli-name') as HTMLInputElement).value;
                    const c = (document.getElementById('cli-cuit') as HTMLInputElement).value;
                    if(n) { updateGlobal({ clients: [...(state.clients || []), { id: Date.now().toString(), name: n.toUpperCase(), cuit: c }] }); (document.getElementById('cli-name') as HTMLInputElement).value = ""; (document.getElementById('cli-cuit') as HTMLInputElement).value = ""; }
                  }} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase text-xs">Añadir Cliente</button>
                  <div className="grid grid-cols-1 gap-2">
                    {state.clients.map(cl => (
                      <div key={cl.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-gray-800">
                        <span className="font-bold text-xs uppercase italic">{cl.name}</span>
                        <button onClick={() => updateGlobal({ clients: state.clients.filter(x => x.id !== cl.id) })} className="text-red-500"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'instructor' && (
                <div className="max-w-md mx-auto space-y-8">
                   <input value={state.instructor?.name || ""} onChange={e => updateGlobal({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} placeholder="NOMBRE INSTRUCTOR" className="w-full bg-[#0d111c] border border-gray-800 p-5 rounded-2xl outline-none font-bold uppercase text-xs" />
                   <input value={state.instructor?.role || ""} onChange={e => updateGlobal({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} placeholder="CARGO / ESPECIALIDAD" className="w-full bg-[#0d111c] border border-gray-800 p-5 rounded-2xl outline-none font-bold uppercase text-xs" />
                   <div className="space-y-2">
                     <div className="flex justify-between items-center"><label className="text-[10px] font-bold uppercase italic text-slate-500">Firma</label></div>
                     <div className="bg-white rounded-2xl h-40 overflow-hidden"><SignatureCanvas ref={null as any} penColor="blue" canvasProps={{ className: 'w-full h-full' }} /></div>
                     <p className="text-[9px] text-slate-600 italic">La firma del instructor debe ser configurada localmente.</p>
                   </div>
                   <button onClick={() => alert("Perfil actualizado localmente")} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs">Guardar Instructor</button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'userForm' && (
          <UserPortal 
            state={state} 
            onSubmit={async (rec) => {
              const cloud = await api.load(wsid);
              const base = cloud || state;
              const updated = { ...base, records: [rec, ...(base.records || [])].slice(0, 20) };
              const ok = await api.save(wsid, masterKey, updated);
              if (!ok) throw new Error("Error Cloud 500");
              setState(updated);
            }} 
          />
        )}
      </main>
    </div>
  );
};

// --- Portal de Usuario Móvil ---
const UserPortal = ({ state, onSubmit }: { state: AppState, onSubmit: (r: AttendanceRecord) => Promise<void> }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  
  const p = new URLSearchParams(window.location.search);
  const cid = p.get('cid'), mid = p.get('mid');
  const cl = state.clients?.find(c => c.id === cid);
  const mo = state.modules?.find(m => m.id === mid);

  if (done) return (
    <div className="max-w-md mx-auto text-center py-20 animate-in zoom-in space-y-8">
      <CheckCircle2 size={64} className="mx-auto text-green-500" />
      <h2 className="text-3xl font-black uppercase italic">¡REGISTRO EXITOSO!</h2>
      <p className="text-slate-500 text-sm">Su asistencia ha sido procesada correctamente en la nube.</p>
      <button onClick={() => window.location.href='/'} className="w-full bg-slate-800 py-5 rounded-3xl font-bold uppercase text-[10px]">Cerrar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-6">
      <div className="text-center">
        <h1 className="text-2xl font-black uppercase italic leading-tight">{mo?.name || "Curso no encontrado"}</h1>
        <div className="mt-2 text-blue-500 font-bold uppercase text-[10px] italic">{cl?.name || "Cliente no encontrado"}</div>
      </div>

      <div className="bg-[#111827] rounded-[40px] border border-gray-800 p-8 space-y-8">
        {step === 1 ? (
          <div className="space-y-6">
            <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO" className="w-full bg-[#0d111c] border border-gray-800 p-5 rounded-2xl font-bold uppercase outline-none focus:border-blue-600" />
            <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI / DOCUMENTO" className="w-full bg-[#0d111c] border border-gray-800 p-5 rounded-2xl font-bold outline-none focus:border-blue-600" />
            <button onClick={() => { if(name && dni) setStep(2); }} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">Continuar <ChevronRight size={16}/></button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 italic">Firme en el recuadro</label>
              <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-bold uppercase text-slate-700">Borrar</button>
            </div>
            <div className="bg-white rounded-3xl h-60 overflow-hidden relative">
              <SignatureCanvas ref={sigRef} penColor="blue" canvasProps={{ className: 'w-full h-full' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 py-5 rounded-2xl font-bold uppercase text-[10px]">Atrás</button>
              <button disabled={isSubmitting} onClick={async () => {
                if(sigRef.current?.isEmpty()) return;
                setIsSubmitting(true);
                try {
                  const sig = compressSignature(sigRef.current!.getTrimmedCanvas());
                  await onSubmit({ id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: sig });
                  setDone(true);
                } catch(e) { alert("Error al subir. La base de datos puede estar llena."); }
                finally { setIsSubmitting(false); }
              }} className="flex-[2] bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Finalizar Registro"}
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
