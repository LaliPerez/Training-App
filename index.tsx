
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
  Wifi,
  WifiOff,
  AlertCircle,
  Key
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
  MASTER_KEY: 'trainer_master_key_v26',
  WSID: 'trainer_ws_id_v26', 
  AUTH: 'trainer_auth_v26',
  STATE_CACHE: 'trainer_state_cache_v26'
};
const API_URL = 'https://api.restful-api.dev/objects';

const api = {
  // Función para cargar datos con validación estricta
  load: async (id: string): Promise<AppState | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`${API_URL}/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      const data = json.data;
      
      // Verificamos que sea un objeto válido de TrainerApp
      if (data && typeof data === 'object' && Array.isArray(data.clients || [])) {
        return data as AppState;
      }
      return null;
    } catch (err) { 
      console.error("API Load Error:", err);
      return null; 
    }
  },

  // Función para guardar con protección contra borrado accidental
  save: async (id: string, masterKey: string, data: AppState): Promise<boolean> => {
    if (!id || !masterKey) return false;
    try {
      // Protección: no guardamos si el estado parece corrupto o vacío si antes no lo estaba
      if (!data.clients || !data.modules) {
        console.error("Tentativa de guardar estado corrupto abortada.");
        return false;
      }

      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `TrainerCloud_${masterKey}`, 
          data: data 
        })
      });

      if (res.status === 500) {
        console.error("Error 500: El servidor rechazó la carga. Probablemente el archivo es muy grande.");
      }
      
      return res.ok;
    } catch (err) { 
      console.error("API Save Error:", err);
      return false; 
    }
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
  
  const [masterKey, setMasterKey] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('mk') || localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "";
  });

  const [wsid, setWsid] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('wsid') || localStorage.getItem(STORAGE_KEYS.WSID) || "";
  });

  const [isAuth, setIsAuth] = useState(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  
  const [state, setState] = useState<AppState>(() => {
    const cache = localStorage.getItem(STORAGE_KEYS.STATE_CACHE);
    return cache ? JSON.parse(cache) : { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } };
  });

  const [adminTab, setAdminTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const isUpdatingRef = useRef(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Guardar en cache local siempre
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(state));
  }, [state]);

  // Sincronización proactiva inteligente
  const sync = useCallback(async (silent = true) => {
    if (isUpdatingRef.current || !wsid) return;
    if (!silent) setSyncStatus('syncing');
    
    const cloudData = await api.load(wsid);
    if (cloudData) {
      // Mezclamos inteligentemente para no perder lo local si la nube falló parcialmente
      setState(prev => {
        if (JSON.stringify(cloudData) === JSON.stringify(prev)) return prev;
        return cloudData;
      });
      setSyncStatus('idle');
    } else {
      if (!silent) setSyncStatus('error');
    }
  }, [wsid]);

  useEffect(() => {
    if (wsid) sync(false);
    const timer = setInterval(() => sync(true), 10000);
    return () => clearInterval(timer);
  }, [wsid, sync]);

  // Detectar portal de usuario desde URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('cid') && p.get('mid')) {
      setView('userForm');
    }
  }, []);

  const updateGlobal = async (patch: Partial<AppState>) => {
    if (!wsid) return;
    isUpdatingRef.current = true;
    setSyncStatus('syncing');
    
    // FETCH-AND-MERGE: Obtenemos lo último de la nube justo antes de guardar
    const latestCloud = await api.load(wsid);
    const baseState = latestCloud || state;
    
    const newState = { 
      ...baseState, 
      ...patch,
      clients: patch.clients || baseState.clients || [],
      modules: patch.modules || baseState.modules || [],
      records: patch.records || baseState.records || [],
      assignments: patch.assignments || baseState.assignments || [],
      instructor: patch.instructor || baseState.instructor || { name: "", role: "", signature: "" }
    };
    
    setState(newState);
    const success = await api.save(wsid, masterKey, newState);
    setSyncStatus(success ? 'saved' : 'error');
    if (success) setTimeout(() => setSyncStatus('idle'), 2000);
    
    isUpdatingRef.current = false;
  };

  const handleLogin = async (keyInput: string) => {
    if (!keyInput) return alert("Ingrese clave");
    setIsLoggingIn(true);
    const cleanKey = keyInput.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      const existing = await api.findByKey(cleanKey);
      let targetWsid = existing ? existing.id : await api.create(cleanKey);
      
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
    } catch (e) {
      alert("Error de conexión. Verifique internet.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="bg-[#060912] min-h-screen text-slate-200 font-sans selection:bg-blue-600 antialiased overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/90 backdrop-blur-lg border-b border-gray-800/50 px-4 md:px-6 py-4 flex justify-between items-center h-16 md:h-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.origin + window.location.pathname}>
          <div className="bg-blue-600 p-1.5 rounded-lg"><BookOpen size={18} className="text-white" /></div>
          <span className="text-white font-black italic uppercase text-lg md:text-xl tracking-tighter">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-800 ${syncStatus === 'error' ? 'bg-red-500/10' : 'bg-slate-900'}`}>
            <div className={`size-1.5 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
              {syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'error' ? 'Error Conexión' : 'Nube Activa'}
            </span>
          </div>
          {isAuth && view === 'adminDashboard' && (
            <button onClick={() => { localStorage.clear(); window.location.href = window.location.origin + window.location.pathname; }} className="text-red-500 font-black uppercase text-[10px] px-3 py-1.5 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all">Salir</button>
          )}
        </div>
      </nav>

      <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
        {view === 'landing' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in">
            <h1 className="text-[clamp(2.5rem,10vw,7rem)] font-black italic uppercase text-white tracking-tighter mb-4 leading-none">TRAINER<span className="text-blue-600">APP</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[clamp(0.6rem,2vw,0.8rem)] mb-12 italic">Formación Técnica y Firma en la Nube</p>
            <button onClick={() => setView('adminLogin')} className="bg-blue-600 text-white font-black px-12 py-6 rounded-[2.5rem] uppercase text-xs shadow-2xl hover:scale-105 transition-all">Panel de Control</button>
          </div>
        )}

        {view === 'adminLogin' && <AdminLoginView onLogin={handleLogin} isLoading={isLoggingIn} initialValue={masterKey} />}

        {view === 'adminDashboard' && (
          <div className="animate-in slide-in-from-bottom-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-8">
              <div className="space-y-3">
                <h1 className="text-white text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">Mi <span className="text-blue-600">Gestión</span></h1>
                <div className="flex bg-[#111827] px-4 py-2 rounded-full border border-gray-800 items-center gap-2 w-fit">
                   <Key size={12} className="text-blue-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal: {masterKey}</span>
                </div>
              </div>
              <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shadow-xl no-scrollbar">
                {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                  <button key={t} onClick={() => setAdminTab(t as any)} className={`flex items-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all whitespace-nowrap ${adminTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#111827] rounded-[2.5rem] border border-gray-800 p-6 md:p-12 shadow-2xl min-h-[500px]">
              {adminTab === 'asistencias' && <AsistenciasView state={state} update={updateGlobal} onSync={() => sync(false)} isSyncing={syncStatus === 'syncing'} />}
              {adminTab === 'asignaciones' && <AsignacionesView state={state} update={updateGlobal} wsid={wsid} masterKey={masterKey} />}
              {adminTab === 'modulos' && <ModulosView state={state} update={updateGlobal} />}
              {adminTab === 'clientes' && <ClientesView state={state} update={updateGlobal} />}
              {adminTab === 'instructor' && <InstructorView state={state} update={updateGlobal} />}
            </div>
          </div>
        )}

        {view === 'userForm' && <UserPortal state={state} wsid={wsid} masterKey={masterKey} onSync={() => sync(false)} onSubmit={async (rec) => {
          if (!wsid) return;
          // FLUJO DE SEGURIDAD: Intentamos cargar lo último de la nube para no pisar nada
          const cloud = await api.load(wsid);
          const baseState = cloud || state;
          
          const updated = { ...baseState, records: [rec, ...(baseState.records || [])] };
          const ok = await api.save(wsid, masterKey, updated);
          
          if (!ok) {
            // Si falló por tamaño (error 500), intentamos avisar
            throw new Error("Error al guardar en la nube (posible límite de tamaño)");
          }
          setState(updated);
        }} />}
      </main>
    </div>
  );
};

// --- Sub-componentes Dashboard ---
const AdminLoginView = ({ onLogin, isLoading, initialValue }: any) => {
  const [val, setVal] = useState(initialValue || "");
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-in zoom-in">
      <div className="bg-[#111827] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 w-full max-w-md text-center shadow-2xl">
        <div className="size-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
          <ShieldCheck size={40} className="text-blue-600" />
        </div>
        <h2 className="text-white text-2xl font-black uppercase italic mb-6">Acceso Administrador</h2>
        <div className="space-y-6 mb-10 text-left">
          <div className="relative group">
            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
            <input type="password" placeholder="Su clave maestra..." value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLogin(val)} className="w-full bg-[#0d111c] border border-gray-800 text-white pl-16 pr-6 py-6 rounded-2xl outline-none font-bold text-lg focus:border-blue-500" />
          </div>
        </div>
        <button disabled={isLoading} onClick={() => onLogin(val)} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] uppercase text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all">
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Entrar al Panel"}
        </button>
      </div>
    </div>
  );
};

const AsistenciasView = ({ state, update, onSync, isSyncing }: any) => {
  const [sel, setSel] = useState<string[]>([]);
  const generatePDF = () => {
    const data = (state.records || []).filter((r: any) => sel.includes(r.id));
    if(!data.length) return;
    const doc = new jsPDF();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("REPORTE DE ASISTENCIA", 15, 25);
    autoTable(doc, {
      startY: 50,
      head: [['Empleado', 'DNI', 'Curso', 'Fecha', 'Firma']],
      headStyles: { fillColor: [30, 41, 59], fontSize: 10 },
      body: data.map((r: any) => [
        r.name, r.dni, 
        state.modules.find((m: any) => m.id === r.moduleId)?.name || "N/A", 
        new Date(r.timestamp).toLocaleDateString(), ''
      ]),
      columnStyles: { 4: { cellWidth: 40, minCellHeight: 25 } },
      didDrawCell: (d: any) => {
        if (d.section === 'body' && d.column.index === 4) {
          const rec = data[d.row.index];
          if (rec?.signature) doc.addImage(rec.signature, 'JPEG', d.cell.x + 2, d.cell.y + 2, 36, 21);
        }
      },
      styles: { valign: 'middle', fontSize: 9 }
    });
    doc.save(`Reporte_Asistencias_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
        <h2 className="text-white text-2xl font-black italic uppercase">Firmas Digitales</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onSync} className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><RefreshCw className={isSyncing ? "animate-spin" : ""} size={20} /></button>
          <button onClick={() => confirm("¿Desea borrar los seleccionados?") && update({ records: state.records.filter((r: any) => !sel.includes(r.id)) })} disabled={!sel.length} className="flex-1 bg-red-500/10 text-red-500 px-6 py-3 rounded-xl font-black text-[10px] disabled:opacity-20 uppercase">Eliminar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="flex-1 bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] shadow-lg disabled:opacity-30 uppercase">Generar PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[2rem] bg-[#0d111c] border border-gray-800">
        <table className="w-full text-left min-w-[700px]">
          <thead className="text-slate-500 text-[10px] font-black uppercase border-b border-gray-800">
            <tr>
              <th className="px-6 py-5"><input type="checkbox" onChange={e => setSel(e.target.checked ? state.records.map((r: any) => r.id) : [])} className="accent-blue-600" /></th>
              <th className="px-6 py-5">Empleado</th>
              <th className="px-6 py-5">Curso</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {(state.records || []).map((r: any) => (
              <tr key={r.id} className="hover:bg-blue-600/5 cursor-pointer" onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} readOnly className="accent-blue-600" /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-xs">{r.name}<div className="text-[10px] text-slate-600 font-normal">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] font-black text-blue-500 uppercase">{state.modules.find((m: any) => m.id === r.moduleId)?.name || 'N/A'}</td>
                <td className="px-6 py-6 text-center">{r.signature && <img src={r.signature} className="h-10 mx-auto bg-white rounded p-1 shadow-sm border border-gray-200" />}</td>
                <td className="px-6 py-6 text-[10px] text-slate-600 text-center font-bold">{new Date(r.timestamp).toLocaleDateString()}</td>
              </tr>
            ))}
            {(state.records || []).length === 0 && (
              <tr><td colSpan={5} className="py-20 text-center text-slate-700 font-bold uppercase italic text-[10px]">No hay registros en la nube</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AsignacionesView = ({ state, update, wsid, masterKey }: any) => {
  const [cid, setCid] = useState(""), [mid, setMid] = useState("");
  const [qr, setQr] = useState<string | null>(null), [link, setLink] = useState(""), [copied, setCopied] = useState(false);
  return (
    <div className="animate-in fade-in text-left">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Gestionar Accesos QR</h2>
      <div className="bg-[#0d111c] p-6 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2">Empresa Cliente</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none">
            <option value="">-- SELECCIONE CLIENTE --</option>
            {state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2">Módulo de Capacitación</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none">
            <option value="">-- SELECCIONE MÓDULO --</option>
            {state.modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={() => { if(!cid || !mid) return; update({ assignments: [...(state.assignments || []), { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] }); }} className="w-full lg:w-auto bg-blue-600 text-white px-12 h-16 rounded-[2rem] font-black uppercase text-xs active:scale-95 transition-all">Crear Acceso</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {(state.assignments || []).map((a: any) => (
          <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col shadow-lg">
            <p className="text-blue-500 font-black uppercase text-[8px] mb-1 italic tracking-widest">{state.clients.find((c: any) => c.id === a.clientId)?.name}</p>
            <h3 className="text-white text-lg font-black italic uppercase mb-6 truncate leading-tight">{state.modules.find((m: any) => m.id === a.moduleId)?.name}</h3>
            <button onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}&mk=${masterKey}`;
              setLink(url);
              setQr(await QRCode.toDataURL(url, { width: 600, margin: 2 }));
            }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] hover:bg-blue-700 shadow-lg uppercase">Abrir QR</button>
            <button onClick={() => confirm("¿Eliminar acceso?") && update({ assignments: state.assignments.filter((as: any) => as.id !== a.id) })} className="mt-4 text-slate-800 text-[9px] uppercase font-black hover:text-red-500 transition-colors text-center">Borrar</button>
          </div>
        ))}
      </div>
      {qr && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in" onClick={() => { setQr(null); setCopied(false); }}>
          <div className="bg-[#111827] p-8 rounded-[4rem] border border-gray-800 text-center animate-in zoom-in max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-white p-4 rounded-[2.5rem] mb-8 inline-block shadow-2xl"><img src={qr} className="size-64 md:size-80" /></div>
            <div className="space-y-4">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Escanee para completar registro</p>
              <div className="flex bg-[#0d111c] p-2 rounded-2xl border border-gray-800 items-center overflow-hidden">
                <input readOnly value={link} className="flex-1 bg-transparent text-[8px] text-blue-500 px-3 truncate font-bold outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }} className={`p-3 rounded-xl transition-all ${copied ? 'bg-green-600' : 'bg-blue-600'}`}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModulosView = ({ state, update }: any) => {
  const [name, setName] = useState(""), [activeMod, setActiveMod] = useState<string | null>(null), [docName, setDocName] = useState(""), [docUrl, setDocUrl] = useState("");
  const addDoc = (id: string) => {
    if(!docName || !docUrl) return;
    update({ modules: state.modules.map((m: any) => m.id === id ? { ...m, documents: [...(m.documents || []), { name: docName.toUpperCase(), url: docUrl }] } : m) });
    setDocName(""); setDocUrl(""); setActiveMod(null);
  };
  return (
    <div className="animate-in fade-in text-left">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Cursos de Formación</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-12 bg-[#0d111c] p-5 rounded-[2.5rem] border border-gray-800">
        <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="TÍTULO DE CAPACITACIÓN" className="flex-1 bg-transparent text-white px-6 font-bold uppercase outline-none text-sm" />
        <button onClick={() => { if(!name) return; update({ modules: [...(state.modules || []), { id: Date.now().toString(), name, documents: [] }] }); setName(""); }} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">Crear Módulo</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {(state.modules || []).map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl flex flex-col">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center">
               <h3 className="text-white font-black uppercase text-[11px] italic pr-4">{m.name}</h3>
               <button onClick={() => confirm("¿Borrar curso?") && update({ modules: state.modules.filter((i: any) => i.id !== m.id) })} className="text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
             </div>
             <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-slate-600 italic tracking-wider">Documentación Adjunta</p>
                  {m.documents?.map((d: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#111827] p-4 rounded-xl border border-gray-800">
                      <span className="font-bold uppercase text-[10px] text-slate-300 truncate pr-4">{d.name}</span>
                      <button onClick={() => update({ modules: state.modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, i: number) => i !== idx) } : mod) })} className="text-slate-700 hover:text-red-500"><X size={16} /></button>
                    </div>
                  ))}
                </div>
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-6 rounded-2xl border border-blue-500/30 space-y-4 animate-in zoom-in">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE DEL ARCHIVO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3.5 rounded-xl text-[10px] font-bold outline-none" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL (DROPBOX/DRIVE)" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3.5 rounded-xl text-[10px] font-bold outline-none" />
                    <button onClick={() => addDoc(m.id)} className="w-full bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">Vincular</button>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-5 border-2 border-dashed border-gray-800 rounded-2xl text-slate-800 font-black uppercase text-[10px] hover:border-blue-500/50 hover:text-blue-500 transition-all">
                    <Plus size={16} className="inline mr-2" /> Agregar Documento
                  </button>
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ClientesView = ({ state, update }: any) => {
  const [n, setN] = useState(""), [c, setC] = useState("");
  return (
    <div className="animate-in fade-in text-left">
      <h2 className="text-white text-2xl font-black italic uppercase mb-10">Cartera de Empresas</h2>
      <div className="bg-[#0d111c] p-6 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 italic">Razón Social</label>
          <input value={n} onChange={e => setN(e.target.value.toUpperCase())} placeholder="EJ: TECH CORP S.A." className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
        </div>
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 italic">CUIT / RUT</label>
          <input value={c} onChange={e => setC(e.target.value)} placeholder="00-00000000-0" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
        </div>
        <button onClick={() => { if(!n) return; update({ clients: [...(state.clients || []), { id: Date.now().toString(), name: n, cuit: c }] }); setN(""); setC(""); }} className="w-full lg:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">Registrar</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(state.clients || []).map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 relative group shadow-lg hover:border-blue-500/30 transition-all">
            <h3 className="text-white font-black uppercase italic mb-1 text-base truncate pr-8">{i.name}</h3>
            <p className="text-slate-600 text-[10px] font-black uppercase">CUIT: {i.cuit}</p>
            <button onClick={() => confirm("¿Desea borrar cliente?") && update({ clients: state.clients.filter((cl: any) => cl.id !== i.id) })} className="absolute top-8 right-8 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const InstructorView = ({ state, update }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (sigRef.current && state.instructor?.signature) sigRef.current.fromDataURL(state.instructor.signature);
    }, 500);
    return () => clearTimeout(timer);
  }, [state.instructor?.signature]);
  const handleSave = () => {
    // Para el instructor guardamos en JPEG también para consistencia de tamaño
    const sigData = sigRef.current?.isEmpty() ? "" : sigRef.current?.getTrimmedCanvas().toDataURL('image/jpeg', 0.5);
    update({ instructor: { ...state.instructor, signature: sigData || "" } });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };
  return (
    <div className="animate-in fade-in max-w-2xl mx-auto py-4 text-left">
      <div className="bg-[#0d111c] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl overflow-hidden">
        <h2 className="text-white text-2xl font-black italic uppercase">Datos del Instructor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-slate-600 text-[10px] font-black uppercase px-2">Nombre y Apellido</label>
            <input value={state.instructor?.name || ""} onChange={e => update({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} placeholder="EJ: ING. RICARDO GÓMEZ" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>
          <div className="space-y-2">
            <label className="text-slate-600 text-[10px] font-black uppercase px-2">Especialidad / Cargo</label>
            <input value={state.instructor?.role || ""} onChange={e => update({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} placeholder="EJ: SEGURIDAD INDUSTRIAL" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-slate-600 text-[10px] font-black uppercase italic">Firma Digital</label>
            <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-black uppercase text-slate-700 hover:text-red-500">Borrar</button>
          </div>
          <div className="bg-white rounded-[2.5rem] h-60 overflow-hidden border-4 border-gray-800 relative cursor-crosshair">
            <SignatureCanvas {...({ ref: sigRef, penColor: "blue", canvasProps: { className: 'w-full h-full' } } as any)} />
          </div>
        </div>
        <button onClick={handleSave} className={`w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl transition-all active:scale-95 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saveSuccess ? "Sincronizado con Éxito" : "Guardar Perfil"}
        </button>
      </div>
    </div>
  );
};

// --- UserPortal (Móvil) ---
const UserPortal = ({ state, onSubmit, onSync }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState(1), [name, setName] = useState(""), [dni, setDni] = useState(""), [done, setDone] = useState(false), [isSubmitting, setIsSubmitting] = useState(false), [cloudErr, setCloudErr] = useState("");
  const p = new URLSearchParams(window.location.search), cid = p.get('cid'), mid = p.get('mid');
  
  const cl = state.clients?.find((c: any) => c.id === cid);
  const mo = state.modules?.find((m: any) => m.id === mid);
  
  useEffect(() => {
    if ((!mo || !cl) && onSync) onSync();
  }, [mo, cl, onSync]);

  const generateReceipt = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.text("Certificado de Capacitación", 15, 28);
    doc.setTextColor(0, 0, 0); doc.setFontSize(22); doc.text(name, 15, 80);
    doc.setFontSize(11); doc.text(`DNI N° ${dni}, de la firma ${cl?.name || 'TRAINERAPP'},\nha participado satisfactoriamente de la capacitación de:`, 15, 90);
    doc.setFontSize(18); doc.text(`"${mo?.name || 'CAPACITACIÓN TÉCNICA'}"`, 15, 110);
    const lineY = doc.internal.pageSize.getHeight() - 65;
    if(sigRef.current && !sigRef.current.isEmpty()) {
       // Para el PDF usamos PNG para transparencia si es posible, o el JPEG comprimido
       doc.addImage(sigRef.current.getTrimmedCanvas().toDataURL('image/png'), 'PNG', 20, lineY - 22, 50, 18);
    }
    if(state.instructor?.signature) doc.addImage(state.instructor.signature, 'JPEG', pageWidth - 80, lineY - 22, 50, 18);
    doc.line(20, lineY, 80, lineY); doc.line(pageWidth - 80, lineY, pageWidth - 20, lineY);
    doc.setFontSize(9); doc.text("Firma Empleado", 35, lineY + 7); doc.text(state.instructor?.name || "Instructor Responsable", pageWidth - 75, lineY + 7);
    doc.save(`Certificado_Trainer_${name.replace(/\s/g, '_')}.pdf`);
  };

  const handleFinalSubmit = async () => {
    if(sigRef.current?.isEmpty()) return alert("Su firma es obligatoria."); 
    setIsSubmitting(true);
    setCloudErr("");
    try {
      // COMPRESIÓN CRÍTICA: JPEG 0.4 para ahorrar espacio y evitar Error 500
      const sig = sigRef.current!.getTrimmedCanvas().toDataURL('image/jpeg', 0.4); 
      const rec = { id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: sig };
      await onSubmit(rec); 
      setDone(true); 
    } catch(e: any) {
      setCloudErr("Error al conectar con la nube. El archivo puede ser muy pesado o no hay internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) return (
    <div className="max-w-md mx-auto py-24 text-center animate-in zoom-in p-6">
      <div className="bg-green-600/10 size-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><CheckCircle2 size={50} className="text-green-500" /></div>
      <h2 className="text-3xl font-black text-white italic uppercase mb-12">¡FIRMA REGISTRADA!<br/><span className="text-blue-500 text-sm normal-case font-bold">Sus datos se han guardado exitosamente.</span></h2>
      <button onClick={generateReceipt} className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black uppercase mb-4 flex gap-3 items-center justify-center shadow-xl active:scale-95 transition-all"><Award size={20}/> Descargar Certificado</button>
      <button onClick={() => window.location.href = window.location.origin + window.location.pathname} className="w-full bg-slate-800 text-white py-5 rounded-[2.5rem] font-black uppercase opacity-60 hover:opacity-100 transition-all text-[10px]">Cerrar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-6 md:py-12 px-4 animate-in slide-in-from-bottom-10">
      <div className="text-center mb-10">
        <h1 className="text-[clamp(1.5rem,8vw,2.5rem)] font-black italic text-white uppercase mb-2 leading-none">{mo?.name || "Buscando Curso..."}</h1>
        <div className="bg-blue-600/10 px-5 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase inline-block mt-2 tracking-widest italic">{cl?.name || "Sincronizando..."}</div>
      </div>
      <div className="bg-[#111827] rounded-[4rem] border border-gray-800/80 p-8 md:p-12 shadow-2xl relative">
        {step === 1 ? (
          <div className="space-y-8 text-left">
            {mo && (
              <div className="space-y-5">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2 italic">Material del Curso</p>
                <div className="grid gap-4">
                  {mo?.documents?.map((doc: any, i: number) => (
                    <a key={i} href={doc.url} target="_blank" rel="noopener" className="flex items-center justify-between bg-blue-600/10 border border-blue-500/20 p-5 rounded-2xl hover:bg-blue-600/20 transition-all shadow-md active:scale-95 group">
                      <div className="flex flex-col gap-1 truncate text-left"><span className="text-white font-black uppercase text-[11px] truncate pr-4 tracking-wide">{doc.name}</span><span className="text-blue-400 text-[8px] font-bold uppercase tracking-tight italic">Click para estudiar</span></div>
                      <div className="bg-blue-600 p-2.5 rounded-xl"><ExternalLink size={18} className="text-white" /></div>
                    </a>
                  ))}
                  {(!mo.documents || mo.documents.length === 0) && <p className="text-[10px] text-slate-700 italic text-center py-4">Sin manuales adjuntos</p>}
                </div>
              </div>
            )}
            <div className="space-y-6 pt-10 border-t border-gray-800/50">
              <p className="text-[10px] text-slate-600 font-black uppercase text-center italic">Sus Datos Personales</p>
              <div className="space-y-5">
                <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-5 md:p-6 rounded-2xl font-bold uppercase outline-none focus:border-blue-500 shadow-inner" />
                <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI / IDENTIFICACIÓN" className="w-full bg-[#0d111c] border border-gray-800 text-white p-5 md:p-6 rounded-2xl font-bold outline-none focus:border-blue-500 shadow-inner" />
              </div>
              <button onClick={() => { if(!name || !dni) return alert("Faltan completar campos."); setStep(2); }} className="w-full bg-blue-600 text-white py-5 md:py-6 rounded-[2.5rem] font-black uppercase shadow-xl mt-6 active:scale-95 transition-all flex items-center justify-center gap-3">Siguiente Paso <ChevronRight size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <label className="text-[10px] font-black uppercase text-slate-500 italic">Dibuje su firma abajo</label>
                <button onClick={() => sigRef.current?.clear()} className="text-[10px] font-black uppercase text-slate-700">Borrar</button>
              </div>
              <div className="bg-white rounded-[2.5rem] h-64 overflow-hidden border-4 border-gray-800 relative shadow-2xl">
                <SignatureCanvas {...({ ref: sigRef, penColor: "blue", canvasProps: { className: 'w-full h-full' } } as any)} />
              </div>
            </div>
            {cloudErr && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in shake">
                 <AlertCircle className="text-red-500" size={20} />
                 <p className="text-red-400 text-[9px] font-bold leading-tight">{cloudErr}</p>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-slate-500 py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Atrás</button>
              <button disabled={isSubmitting} onClick={handleFinalSubmit} className="flex-[2] bg-blue-600 text-white py-5 md:py-6 rounded-[2.5rem] font-black uppercase shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 transition-all">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Finalizar y Guardar"}
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
