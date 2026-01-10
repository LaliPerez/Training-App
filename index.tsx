import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Users, 
  BookOpen, 
  Trash2, 
  Download, 
  FileText, 
  CheckCircle2, 
  ShieldCheck,
  ExternalLink,
  X,
  Layers,
  RefreshCw,
  Eye, 
  EyeOff,
  CloudLightning,
  Smartphone,
  Link as LinkIcon,
  Plus,
  AlertCircle,
  Award,
  Loader2,
  Copy,
  Check,
  Save,
  ChevronRight,
  Wifi
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

// --- Config & API ---
const ADMIN_PASSWORD = "admin2025";
const STORAGE_KEYS = { 
  WSID: 'trainer_ws_v7', 
  AUTH: 'trainer_auth_v7',
  REMEMBERED_PASS: 'trainer_remembered_v7'
};
const API_URL = 'https://api.restful-api.dev/objects';

const api = {
  load: async (id: string): Promise<AppState | null> => {
    try {
      const res = await fetch(`${API_URL}/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch { return null; }
  },
  save: async (id: string, data: AppState) => {
    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "TrainerCloud", data })
      });
    } catch (err) {
      console.error("Error saving to cloud:", err);
    }
  },
  create: async (): Promise<string> => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "TrainerCloud", data: { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } } })
      });
      if (!res.ok) throw new Error("Error al crear espacio");
      const json = await res.json();
      return json.id;
    } catch (err) { 
      console.error("API Create Error:", err);
      return ""; 
    }
  }
};

const App = () => {
  const [view, setView] = useState<'landing' | 'userForm' | 'adminLogin' | 'adminDashboard'>('landing');
  const [wsid, setWsid] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('admin_ws') || p.get('wsid') || localStorage.getItem(STORAGE_KEYS.WSID) || "";
  });
  const [isAuth, setIsAuth] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('atoken') === btoa(ADMIN_PASSWORD)) return true;
    return localStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
  });

  const [state, setState] = useState<AppState>({ clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } });
  const [adminTab, setAdminTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  const [loginPass, setLoginPass] = useState(() => localStorage.getItem(STORAGE_KEYS.REMEMBERED_PASS) || "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(STORAGE_KEYS.REMEMBERED_PASS));

  const sync = useCallback(async (silent = true) => {
    if (!wsid) {
      setHasInitialLoad(true);
      return;
    }
    if (!silent) setIsSyncing(true);
    const data = await api.load(wsid);
    if (data && data.records) {
      setState(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data;
      });
    }
    setHasInitialLoad(true);
    if (!silent) setIsSyncing(false);
  }, [wsid]);

  useEffect(() => {
    sync();
    if (isAuth && wsid) {
      const timer = setInterval(() => sync(true), 5000);
      return () => clearInterval(timer);
    }
  }, [wsid, isAuth, sync]);

  useEffect(() => {
    if (isAuth && !wsid && view === 'adminDashboard') {
      const initWs = async () => {
        setIsSyncing(true);
        const newId = await api.create();
        if (newId) {
          setWsid(newId);
          localStorage.setItem(STORAGE_KEYS.WSID, newId);
        }
        setIsSyncing(false);
      };
      initWs();
    }
  }, [isAuth, wsid, view]);

  const updateGlobal = async (patch: Partial<AppState>) => {
    const newState = { ...state, ...patch };
    setState(newState);
    if (wsid) await api.save(wsid, newState);
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cid = p.get('cid'), mid = p.get('mid');
    if (cid && mid) {
      setView('userForm');
    }
  }, []);

  const handleLogin = async () => {
    const cleanPass = loginPass.trim();
    if (cleanPass !== ADMIN_PASSWORD) {
      alert("Contraseña incorrecta.");
      return;
    }
    if (rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBERED_PASS, cleanPass);
    else localStorage.removeItem(STORAGE_KEYS.REMEMBERED_PASS);
    setIsAuth(true);
    localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
    setView('adminDashboard');
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="bg-[#060912] min-h-screen text-slate-200 font-sans selection:bg-blue-600">
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/80 backdrop-blur-md border-b border-gray-800 px-4 md:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
          <div className="bg-blue-600 p-1 rounded-lg"><BookOpen size={16} className="text-white" /></div>
          <span className="text-white font-black italic uppercase text-lg md:text-xl tracking-tighter">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        {isAuth && view === 'adminDashboard' && (
          <button onClick={() => { localStorage.removeItem(STORAGE_KEYS.AUTH); location.reload(); }} className="text-red-500 font-black uppercase text-[9px] tracking-widest px-3 py-1.5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all">Salir</button>
        )}
      </nav>

      <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
        {!hasInitialLoad ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="font-black uppercase italic text-[10px] tracking-widest text-slate-500 text-center">Sincronizando con TrainerCloud...</p>
          </div>
        ) : (
          <>
            {view === 'landing' && (
              <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
                <h1 className="text-5xl sm:text-7xl md:text-9xl font-black italic uppercase text-white tracking-tighter mb-4">TRAINER<span className="text-blue-600">APP</span></h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] text-[9px] md:text-[10px] mb-12">Firma Digital y Capacitación</p>
                <button onClick={() => setView('adminLogin')} className="bg-[#111827] border border-gray-800 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] hover:border-blue-500/50 transition-all shadow-2xl group max-w-sm w-full">
                  <ShieldCheck size={40} className="text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform md:size-[48px]" />
                  <h3 className="text-white font-black uppercase italic text-lg md:text-xl">Panel Instructor</h3>
                </button>
              </div>
            )}

            {view === 'adminLogin' && (
              <div className="min-h-[60vh] flex items-center justify-center animate-in zoom-in">
                <div className="bg-[#111827] p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-gray-800 w-full max-w-md text-center shadow-2xl">
                  <ShieldCheck size={50} className="text-blue-600 mx-auto mb-6 md:mb-8" />
                  <h2 className="text-white text-2xl md:text-3xl font-black uppercase italic mb-8 md:mb-10">Ingresar</h2>
                  <div className="relative mb-4">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="CONTRASEÑA" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-[#0d111c] border border-gray-800 text-white px-4 py-4 md:px-6 md:py-6 rounded-2xl md:rounded-3xl outline-none font-bold text-center tracking-[0.1em] md:tracking-[0.2em] focus:border-blue-500 text-lg md:text-xl" 
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-slate-500">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-8 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`w-4 h-4 rounded border border-gray-700 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent'}`}>
                      {rememberMe && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest select-none">Recordar contraseña</span>
                  </div>

                  <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-[2rem] uppercase text-[10px] md:text-xs shadow-xl active:scale-95 transition-transform">Entrar al Sistema</button>
                </div>
              </div>
            )}

            {view === 'adminDashboard' && (
              <div className="animate-in slide-in-from-bottom-6">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 md:mb-10 gap-6">
                  <div>
                    <h1 className="text-white text-3xl md:text-5xl font-black italic uppercase mb-2 tracking-tighter">Panel <span className="text-blue-600">Admin</span></h1>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-slate-600 font-bold uppercase text-[9px] tracking-widest flex items-center gap-2">
                        <CloudLightning size={12} className={isSyncing ? "text-yellow-500 animate-pulse" : "text-blue-500"}/> 
                        {isSyncing ? "Sincronizando..." : "Nube Conectada"}
                      </p>
                      <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                         <div className="size-1 bg-green-500 rounded-full animate-pulse"></div>
                         <span className="text-[7px] md:text-[8px] font-black uppercase text-green-500 tracking-tighter">En Vivo (5s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex bg-[#111827] p-1 rounded-xl md:rounded-2xl border border-gray-800 overflow-x-auto shadow-lg no-scrollbar">
                    {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                      <button key={t} onClick={() => setAdminTab(t as any)} className={`flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-4 rounded-lg md:rounded-xl font-black uppercase tracking-widest text-[8px] md:text-[10px] transition-all whitespace-nowrap ${adminTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t === 'asistencias' && <Users size={12} />}
                        {t === 'asignaciones' && <Layers size={12} />}
                        {t === 'modulos' && <BookOpen size={12} />}
                        {t === 'clientes' && <FileText size={12} />}
                        {t === 'instructor' && <ShieldCheck size={12} />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#111827] rounded-[2rem] md:rounded-[3rem] border border-gray-800 p-5 md:p-12 shadow-2xl min-h-[500px]">
                  {adminTab === 'asistencias' && <AsistenciasView state={state} update={updateGlobal} onSync={() => sync(false)} isSyncing={isSyncing} />}
                  {adminTab === 'asignaciones' && <AsignacionesView state={state} update={updateGlobal} wsid={wsid} />}
                  {adminTab === 'modulos' && <ModulosView state={state} update={updateGlobal} />}
                  {adminTab === 'clientes' && <ClientesView state={state} update={updateGlobal} />}
                  {adminTab === 'instructor' && <InstructorView state={state} update={updateGlobal} wsid={wsid} />}
                </div>
              </div>
            )}

            {view === 'userForm' && <UserPortal state={state} wsid={wsid} onSync={() => sync(false)} onSubmit={async (rec) => {
              if (wsid) {
                const latest = await api.load(wsid);
                if (latest) {
                  const updated = { ...latest, records: [rec, ...(latest.records || [])] };
                  setState(updated);
                  await api.save(wsid, updated);
                }
              }
            }} />}
          </>
        )}
      </main>
    </div>
  );
};

// --- Sub-vistas Dashboard ---
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
      didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 4) { const rec = data[d.row.index]; doc.addImage(rec.signature, 'PNG', d.cell.x + 2, d.cell.y + 1, 30, 8); } }
    });
    doc.save(`Reporte_Asistencias_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div className="flex items-center gap-3">
           <h2 className="text-white text-xl md:text-3xl font-black italic uppercase">Registros</h2>
           <div className="bg-[#0d111c] px-2 py-0.5 rounded-full border border-gray-800 text-[8px] md:text-[9px] font-black uppercase text-slate-500">
              Total: {state.records.length}
           </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onSync} title="Sincronizar Manual" className="p-2 md:p-3 bg-blue-500/10 rounded-lg md:rounded-xl text-blue-500 transition-colors hover:bg-blue-500/20"><RefreshCw className={isSyncing ? "animate-spin" : ""} size={18} /></button>
          <button onClick={() => confirm("¿Desea eliminar los registros seleccionados?") && update({ records: state.records.filter((r: any) => !sel.includes(r.id)) })} disabled={!sel.length} className="flex-1 sm:flex-none bg-red-500/10 text-red-500 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[8px] md:text-[10px] disabled:opacity-20 transition-all">Borrar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[8px] md:text-[10px] shadow-xl disabled:opacity-30 transition-all">Descargar PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl md:rounded-[2rem] bg-[#0d111c] border border-gray-800">
        <table className="w-full text-left min-w-[600px]">
          <thead className="text-slate-500 text-[9px] md:text-[10px] font-black uppercase border-b border-gray-800 bg-[#161e2e]">
            <tr>
              <th className="px-4 md:px-6 py-4 md:py-5 w-12"><input type="checkbox" onChange={e => setSel(e.target.checked ? state.records.map((r: any) => r.id) : [])} /></th>
              <th className="px-4 md:px-6 py-4 md:py-5">Empleado</th>
              <th className="px-4 md:px-6 py-4 md:py-5">Módulo</th>
              <th className="px-4 md:px-6 py-4 md:py-5 text-center">Firma</th>
              <th className="px-4 md:px-6 py-4 md:py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-[11px] md:text-sm">
            {state.records.length === 0 ? (
              <tr><td colSpan={5} className="py-16 md:py-20 text-center text-slate-700 font-bold uppercase tracking-widest italic text-[10px]">Aún no hay asistencias registradas</td></tr>
            ) : state.records.map((r: any) => (
              <tr key={r.id} className="hover:bg-blue-600/5 transition-all cursor-pointer" onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-4 md:px-6 py-5 md:py-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} readOnly /></td>
                <td className="px-4 md:px-6 py-5 md:py-6 font-bold text-white uppercase">{r.name}<div className="text-[9px] md:text-[10px] text-slate-600">DNI: {r.dni}</div></td>
                <td className="px-4 md:px-6 py-5 md:py-6 text-[9px] md:text-[10px] font-black text-blue-500 uppercase">{state.modules.find((m: any) => m.id === r.moduleId)?.name}</td>
                <td className="px-4 md:px-6 py-5 md:py-6 text-center"><img src={r.signature} className="h-6 md:h-8 mx-auto bg-white rounded p-0.5 md:p-1 shadow-sm" /></td>
                <td className="px-4 md:px-6 py-5 md:py-6 text-[9px] md:text-[10px] text-slate-600 text-center">{new Date(r.timestamp).toLocaleDateString()}<br/>{new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
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
      <h2 className="text-white text-xl md:text-3xl font-black italic uppercase mb-8 md:mb-10">Clientes</h2>
      <div className="bg-[#0d111c] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-gray-800 flex flex-col lg:flex-row gap-4 items-end mb-10 md:mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-1">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Empresa</label>
          <input value={n} onChange={e => setN(e.target.value.toUpperCase())} placeholder="NOMBRE EMPRESA" className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold uppercase text-sm" />
        </div>
        <div className="flex-1 w-full space-y-1">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Identificador</label>
          <input value={c} onChange={e => setC(e.target.value)} placeholder="CUIT / ID" className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold text-sm" />
        </div>
        <button onClick={() => { if(!n) return; update({ clients: [...state.clients, { id: Date.now().toString(), name: n, cuit: c }] }); setN(""); setC(""); }} className="w-full lg:w-auto bg-blue-600 text-white px-8 md:px-12 py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs active:scale-95 transition-transform shadow-xl">Registrar</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {state.clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-gray-800 relative group shadow-lg hover:border-blue-500/30 transition-colors">
            <h3 className="text-white font-black uppercase italic mb-1 text-base md:text-lg truncate pr-8">{i.name}</h3>
            <p className="text-slate-600 text-[9px] md:text-[10px] font-black uppercase">ID: {i.cuit}</p>
            <button onClick={() => confirm("¿Eliminar cliente?") && update({ clients: state.clients.filter((cl: any) => cl.id !== i.id) })} className="absolute top-6 md:top-8 right-6 md:right-8 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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

  const addDoc = (id: string) => {
    if(!docName || !docUrl) return;
    update({ modules: state.modules.map((m: any) => m.id === id ? { ...m, documents: [...(m.documents || []), { name: docName.toUpperCase(), url: docUrl }] } : m) });
    setDocName(""); setDocUrl(""); setActiveMod(null);
  };

  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-xl md:text-3xl font-black italic uppercase mb-8 md:mb-10">Módulos</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-10 md:mb-12 bg-[#0d111c] p-4 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-800 shadow-inner">
        <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="TÍTULO CAPACITACIÓN" className="flex-1 bg-transparent text-white px-4 md:px-6 font-bold uppercase outline-none text-sm md:text-base" />
        <button onClick={() => { if(!name) return; update({ modules: [...state.modules, { id: Date.now().toString(), name: name, documents: [] }] }); setName(""); }} className="bg-blue-600 text-white px-8 md:px-12 py-3.5 md:py-5 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs active:scale-95 transition-transform">Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {state.modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[2rem] md:rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl flex flex-col">
             <div className="bg-[#161e2e] p-5 md:p-6 border-b border-gray-800 flex justify-between items-center">
               <h3 className="text-white font-black uppercase text-[10px] md:text-xs italic truncate pr-4">{m.name}</h3>
               <button onClick={() => confirm("¿Eliminar módulo?") && update({ modules: state.modules.filter((i: any) => i.id !== m.id) })} className="text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="p-6 md:p-8 space-y-4 flex-1">
                <div className="space-y-2">
                  {m.documents?.map((d: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#111827] p-2.5 md:p-3 rounded-lg md:rounded-xl border border-gray-800 group">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={12} className="text-blue-500 shrink-0" />
                        <span className="text-slate-300 font-bold uppercase text-[8px] md:text-[9px] truncate">{d.name}</span>
                      </div>
                      <button onClick={() => update({ modules: state.modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, i: number) => i !== idx) } : mod) })} className="text-slate-700 hover:text-red-500 transition-colors"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-500/30 space-y-3 animate-in zoom-in duration-200">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE DEL ARCHIVO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-2.5 md:p-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase outline-none focus:border-blue-500" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL (DROPBOX / DRIVE)" className="w-full bg-[#0d111c] border border-gray-800 text-white p-2.5 md:p-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold outline-none focus:border-blue-500" />
                    <div className="flex gap-2">
                      <button onClick={() => addDoc(m.id)} className="flex-1 bg-blue-600 text-white py-2.5 md:py-3 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase active:scale-95">Añadir</button>
                      <button onClick={() => setActiveMod(null)} className="px-3 md:px-4 bg-slate-800 text-slate-500 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[8px] md:text-[9px]">X</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-3.5 md:py-4 border-2 border-dashed border-gray-800 rounded-xl md:rounded-2xl text-slate-800 font-black uppercase text-[9px] md:text-[10px] hover:text-blue-500 hover:border-blue-500/30 transition-all flex items-center justify-center gap-2">
                    <Plus size={12} /> Adjuntar Material
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
      <h2 className="text-white text-xl md:text-3xl font-black italic uppercase mb-8 md:mb-10">Vínculos QR</h2>
      <div className="bg-[#0d111c] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-gray-800 flex flex-col lg:flex-row gap-5 md:gap-6 items-end mb-10 md:mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Seleccionar Cliente</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold uppercase text-[10px] md:text-xs outline-none focus:border-blue-500">
            <option value="">Empresa...</option>
            {state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Módulo Capacitación</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold uppercase text-[10px] md:text-xs outline-none focus:border-blue-500">
            <option value="">Módulo...</option>
            {state.modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={() => { if(!cid || !mid) return; update({ assignments: [...state.assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] }); }} className="w-full lg:w-auto bg-blue-600 text-white px-8 md:px-12 h-14 md:h-16 rounded-xl md:rounded-3xl font-black uppercase text-[10px] md:text-xs shadow-xl active:scale-95 transition-all">Generar</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {state.assignments.map((a: any) => (
          <div key={a.id} className="bg-[#0d111c] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-gray-800 flex flex-col group shadow-lg hover:border-blue-500/20 transition-all">
            <p className="text-blue-500 font-black uppercase text-[8px] md:text-[9px] mb-1">{state.clients.find((c: any) => c.id === a.clientId)?.name}</p>
            <h3 className="text-white text-lg md:text-xl font-black italic uppercase mb-5 md:mb-6 truncate">{state.modules.find((m: any) => m.id === a.moduleId)?.name}</h3>
            <button onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}`;
              setLink(url);
              setQr(await QRCode.toDataURL(url, { width: 512, margin: 2 }));
            }} className="w-full bg-blue-600/10 text-blue-500 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] hover:bg-blue-600 hover:text-white transition-all">Ver QR y Enlace</button>
            <button onClick={() => confirm("¿Eliminar vínculo?") && update({ assignments: state.assignments.filter((as: any) => as.id !== a.id) })} className="mt-4 text-slate-800 text-[8px] md:text-[9px] uppercase font-black hover:text-red-500 transition-colors">Borrar Vínculo</button>
          </div>
        ))}
      </div>
      {qr && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { setQr(null); setCopied(false); }}>
          <div className="bg-[#111827] p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-gray-800 text-center animate-in zoom-in max-w-sm w-full shadow-[0_0_100px_rgba(37,99,235,0.15)]" onClick={e => e.stopPropagation()}>
            <img src={qr} className="size-52 md:size-64 rounded-2xl md:rounded-3xl border-4 md:border-8 border-white mb-6 md:mb-8 mx-auto shadow-2xl" />
            <div className="space-y-4">
              <p className="text-slate-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest italic">Link del Portal de Empleado</p>
              <div className="flex bg-[#0d111c] p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-gray-800 items-center overflow-hidden">
                <input readOnly value={link} className="flex-1 bg-transparent text-[7px] md:text-[8px] text-blue-500 px-2 md:px-3 truncate outline-none font-bold" />
                <button 
                  onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
                  className={`p-2.5 md:p-3 rounded-lg md:rounded-xl transition-all shadow-lg ${copied ? 'bg-green-600' : 'bg-blue-600'}`}
                >
                  {copied ? <Check size={12} className="text-white" /> : <Copy size={12} className="text-white" />}
                </button>
              </div>
              <a href={link} target="_blank" className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] hover:bg-slate-700 transition-colors shadow-lg">
                <ExternalLink size={12} /> Abrir Link
              </a>
            </div>
            <button onClick={() => setQr(null)} className="mt-8 text-slate-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const InstructorView = ({ state, update, wsid }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (sigRef.current) {
        const canvas = sigRef.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        
        if (state.instructor.signature) {
          sigRef.current.fromDataURL(state.instructor.signature);
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [state.instructor.signature]);

  const handleSave = () => {
    const signatureData = sigRef.current?.isEmpty() ? "" : sigRef.current?.toDataURL();
    update({ instructor: { ...state.instructor, signature: signatureData || "" } });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="animate-in fade-in max-w-2xl mx-auto py-4">
      <div className="bg-[#0d111c] p-6 md:p-10 rounded-[2rem] md:rounded-[4rem] border border-gray-800 space-y-8 md:space-y-10 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl md:text-3xl font-black italic uppercase">Perfil del Instructor</h2>
          {/* Fixed line 553: Removed invalid 'md:size' prop from CheckCircle2 and used responsive Tailwind class instead */}
          {state.instructor.signature && <div className="bg-green-600/10 text-green-500 p-1.5 rounded-lg"><CheckCircle2 size={16} className="md:size-5" /></div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1">
            <label className="text-slate-600 text-[8px] md:text-[9px] font-black uppercase px-2">Nombre Instructor</label>
            <input 
              value={state.instructor.name} 
              onChange={e => update({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} 
              placeholder="NOMBRE COMPLETO" 
              className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold uppercase text-xs md:text-sm focus:border-blue-500 outline-none transition-all" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-600 text-[8px] md:text-[9px] font-black uppercase px-2">Cargo</label>
            <input 
              value={state.instructor.role} 
              onChange={e => update({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} 
              placeholder="CARGO / ROL" 
              className="w-full bg-[#111827] border border-gray-800 text-white p-4 md:p-5 rounded-xl md:rounded-2xl font-bold uppercase text-xs md:text-sm focus:border-blue-500 outline-none transition-all" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-slate-600 text-[8px] md:text-[9px] font-black uppercase">Firma Digital (Dedo o Mouse)</label>
            <button onClick={() => sigRef.current?.clear()} className="text-[8px] md:text-[9px] font-black uppercase text-slate-700 hover:text-red-500 transition-colors">Limpiar</button>
          </div>
          <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] h-48 md:h-60 border-4 border-gray-800 overflow-hidden shadow-inner relative group">
            <SignatureCanvas 
              {...({
                ref: sigRef,
                penColor: "blue",
                canvasProps: { className: 'w-full h-full' }
              } as any)}
            />
          </div>
          <p className="text-center text-[7px] md:text-[8px] text-slate-800 font-black uppercase tracking-widest italic px-4">Esta firma se utilizará para validar las constancias de los alumnos</p>
        </div>

        <button 
          onClick={handleSave} 
          className={`w-full py-4 md:py-6 rounded-xl md:rounded-[2rem] font-black uppercase text-[10px] md:text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
        >
          {saveSuccess ? (
            <><Check size={16} /> Perfil Actualizado</>
          ) : (
            <><Save size={16} /> Guardar Perfil Instructor</>
          )}
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
  
  useEffect(() => {
    if (!mo && onSync) {
      const timer = setTimeout(onSync, 2000);
      return () => clearTimeout(timer);
    }
  }, [mo, onSync]);

  const generateReceipt = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Certificado de Capacitación", 15, 28);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Por medio de la presente, se certifica que", 15, 65);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(name, 15, 80);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const cuitPart = cl?.cuit ? ` (CUIT: ${cl.cuit})` : '';
    const descText = `con DNI N° ${dni}, de la empresa ${cl?.name || 'TRAINERAPP'}${cuitPart},\nha completado y aprobado la capacitación denominada:`;
    doc.text(descText, 15, 90);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`"${mo?.name || 'CAPACITACIÓN'}"`, 15, 110);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Realizada en la fecha ${new Date().toLocaleDateString()}.`, 15, 125);

    const lineY = pageHeight - 60;
    const col1X = 30;
    const col2X = pageWidth - 90;

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(col1X, lineY, col1X + 50, lineY);
    doc.setFontSize(9);
    doc.text("Firma del Empleado", col1X + 25, lineY + 7, { align: "center" });
    if(sigRef.current) {
      doc.addImage(sigRef.current.toDataURL(), 'PNG', col1X + 5, lineY - 22, 40, 18);
    }

    doc.line(col2X, lineY, col2X + 60, lineY);
    doc.setFont("helvetica", "bold");
    doc.text(state.instructor?.name || "INSTRUCTOR RESPONSABLE", col2X + 30, lineY + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(state.instructor?.role || "RESP. HIGIENE Y SEGURIDAD", col2X + 30, lineY + 12, { align: "center" });
    if(state.instructor?.signature) {
      doc.addImage(state.instructor.signature, 'PNG', col2X + 10, lineY - 22, 40, 18);
    }

    doc.save(`Certificado_${name.replace(/\s/g, '_')}.pdf`);
  };

  useLayoutEffect(() => {
    if(step === 2 && sigRef.current) {
      const timer = setTimeout(() => {
        const canvas = sigRef.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        sigRef.current.clear();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (done) return (
    <div className="max-w-md mx-auto py-20 md:py-24 text-center animate-in zoom-in p-6">
      <div className="bg-green-600/10 size-20 md:size-24 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8">
        <CheckCircle2 size={40} className="text-green-500 md:size-[50px]" />
      </div>
      <h2 className="text-2xl md:text-3xl font-black text-white italic uppercase mb-10 md:mb-12 leading-tight">¡REGISTRO EXITOSO!<br/><span className="text-blue-500 text-xs md:text-sm italic normal-case">Su asistencia ha sido guardada en la nube.</span></h2>
      <button onClick={generateReceipt} className="w-full bg-blue-600 text-white py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase mb-4 flex gap-3 items-center justify-center shadow-2xl active:scale-95 transition-transform text-[10px] md:text-xs"><Award size={18}/> Descargar Certificado PDF</button>
      <button onClick={() => window.location.href = window.location.pathname} className="w-full bg-slate-800 text-white py-4 md:py-5 rounded-xl md:rounded-[2rem] font-black uppercase opacity-50 hover:opacity-100 transition-opacity text-[10px] md:text-xs">Finalizar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-8 md:py-10 px-4 animate-in slide-in-from-bottom-8">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-black italic text-white uppercase mb-2 leading-none">{mo?.name || "Validando..."}</h1>
        <div className="bg-blue-600/10 px-4 py-1.5 md:px-5 md:py-2 rounded-full border border-blue-500/20 text-blue-400 text-[8px] md:text-[10px] font-black uppercase inline-block mt-2">{cl?.name || "TrainerCloud Connect"}</div>
      </div>
      
      <div className="bg-[#111827] rounded-[2.5rem] md:rounded-[3.5rem] border border-gray-800 p-6 md:p-10 shadow-2xl relative overflow-hidden">
        {step === 1 ? (
          <div className="space-y-6 md:space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-blue-500" />
                  <p className="text-[8px] md:text-[10px] text-slate-200 font-black uppercase tracking-widest italic">Material de Estudio Obligatorio</p>
                </div>
                {!mo && <Loader2 size={10} className="animate-spin text-blue-500" />}
              </div>

              <div className="grid gap-2 md:gap-3">
                {mo?.documents?.map((doc: any, i: number) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-blue-600/10 border border-blue-500/30 p-4 md:p-5 rounded-xl md:rounded-2xl hover:bg-blue-600/20 transition-all shadow-md group">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white font-black uppercase text-[10px] md:text-[11px] truncate pr-2">{doc.name}</span>
                      <span className="text-blue-400 text-[7px] md:text-[8px] font-bold uppercase">Click para abrir manual</span>
                    </div>
                    <div className="bg-blue-600 p-1.5 md:p-2 rounded-lg md:rounded-xl group-hover:scale-110 transition-transform">
                      <ExternalLink size={14} className="text-white" />
                    </div>
                  </a>
                ))}
                
                {mo && (!mo.documents || mo.documents.length === 0) && (
                  <div className="text-center p-5 md:p-6 bg-[#0d111c] rounded-xl md:rounded-2xl border border-dashed border-gray-800">
                    <AlertCircle size={16} className="text-slate-700 mx-auto mb-2 md:size-[20px]" />
                    <p className="text-slate-700 font-bold text-[8px] md:text-[9px] uppercase">No hay archivos adicionales para este módulo</p>
                  </div>
                )}
                
                {!mo && (
                   <div className="text-center p-5 md:p-6 bg-[#0d111c] rounded-xl md:rounded-2xl border border-dashed border-gray-800 animate-pulse">
                     <p className="text-slate-700 font-bold text-[8px] md:text-[9px] uppercase italic">Descargando contenidos de la nube...</p>
                   </div>
                )}
              </div>
            </div>

            <div className="space-y-6 pt-6 md:pt-8 border-t border-gray-800">
              <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest text-center italic">Luego de estudiar, complete sus datos</p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-slate-600 text-[8px] md:text-[9px] font-black uppercase px-2">Nombre y Apellido del Empleado</label>
                  <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="EJ: JUAN PÉREZ" className="w-full bg-[#0d111c] border border-gray-800 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-bold uppercase outline-none focus:border-blue-500 transition-all shadow-inner text-sm" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-600 text-[8px] md:text-[9px] font-black uppercase px-2">Documento de Identidad</label>
                  <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI / PASAPORTE" className="w-full bg-[#0d111c] border border-gray-800 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-bold outline-none focus:border-blue-500 transition-all shadow-inner text-sm" />
                </div>
              </div>
              
              <button 
                onClick={() => { if(!name || !dni) return alert("Complete sus datos"); setStep(2); }} 
                className="w-full bg-blue-600 text-white py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase shadow-xl mt-4 active:scale-95 transition-all flex items-center justify-center gap-3 text-[10px] md:text-xs"
              >
                Continuar a Firma <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8 animate-in fade-in">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-[8px] md:text-[10px] font-black uppercase text-slate-500">Firma del Empleado</label>
                <button onClick={() => sigRef.current?.clear()} className="text-[8px] md:text-[9px] font-black uppercase text-slate-700">Limpiar</button>
              </div>
              <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] h-40 md:h-52 overflow-hidden border-4 border-gray-800 relative shadow-2xl">
                <SignatureCanvas 
                  {...({
                    ref: sigRef,
                    penColor: "blue",
                    canvasProps: { className: 'w-full h-full' }
                  } as any)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-slate-400 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[8px] md:text-[10px] tracking-widest">Atrás</button>
              <button 
                disabled={isSubmitting}
                onClick={async () => { 
                  if(sigRef.current?.isEmpty()) return alert("Debe firmar para confirmar su asistencia."); 
                  setIsSubmitting(true);
                  const rec = { id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: sigRef.current!.toDataURL() };
                  await onSubmit(rec); 
                  setDone(true); 
                  setIsSubmitting(false);
                }} 
                className="flex-[2] bg-blue-600 text-white py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-[10px] md:text-xs"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : "Finalizar Registro"}
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