
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
  Save
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
      return res.ok ? (await res.json()).data : null;
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
    if (data) {
      setState(data);
    }
    setHasInitialLoad(true);
    if (!silent) setIsSyncing(false);
  }, [wsid]);

  useEffect(() => {
    sync();
    if (isAuth && wsid) {
      const timer = setInterval(() => sync(true), 15000);
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
    const cid = p.get('cid'), mid = p.get('mid'), remoteWsid = p.get('admin_ws');
    if (remoteWsid && isAuth) setView('adminDashboard');
    if (cid && mid) setView('userForm');
  }, [isAuth]);

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
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
          <div className="bg-blue-600 p-1.5 rounded-lg"><BookOpen size={18} className="text-white" /></div>
          <span className="text-white font-black italic uppercase text-xl">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        {isAuth && (
          <button onClick={() => { localStorage.removeItem(STORAGE_KEYS.AUTH); location.reload(); }} className="text-red-500 font-black uppercase text-[10px] tracking-widest px-4 py-2 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all">Salir</button>
        )}
      </nav>

      <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
        {!hasInitialLoad ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-blue-500" size={40} />
            <p className="font-black uppercase italic text-xs tracking-widest text-slate-500">Sincronizando con TrainerCloud...</p>
          </div>
        ) : (
          <>
            {view === 'landing' && (
              <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
                <h1 className="text-7xl md:text-9xl font-black italic uppercase text-white tracking-tighter mb-4">TRAINER<span className="text-blue-600">APP</span></h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mb-12">Firma Digital y Capacitación</p>
                <button onClick={() => setView('adminLogin')} className="bg-[#111827] border border-gray-800 p-10 rounded-[3rem] hover:border-blue-500/50 transition-all shadow-2xl group max-w-sm w-full">
                  <ShieldCheck size={48} className="text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-black uppercase italic text-xl">Panel Instructor</h3>
                </button>
              </div>
            )}

            {view === 'adminLogin' && (
              <div className="min-h-[60vh] flex items-center justify-center animate-in zoom-in">
                <div className="bg-[#111827] p-10 rounded-[4rem] border border-gray-800 w-full max-w-md text-center shadow-2xl">
                  <ShieldCheck size={60} className="text-blue-600 mx-auto mb-8" />
                  <h2 className="text-white text-3xl font-black uppercase italic mb-10">Ingresar</h2>
                  <div className="relative mb-4">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="CONTRASEÑA" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-6 rounded-3xl outline-none font-bold text-center tracking-[0.2em] focus:border-blue-500 text-xl" 
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500">
                      {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-8 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`w-5 h-5 rounded-md border border-gray-700 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent'}`}>
                      {rememberMe && <Check size={14} className="text-white" />}
                    </div>
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest select-none">Recordar contraseña</span>
                  </div>

                  <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] uppercase text-xs shadow-xl active:scale-95 transition-transform">Entrar al Sistema</button>
                </div>
              </div>
            )}

            {view === 'adminDashboard' && (
              <div className="animate-in slide-in-from-bottom-6">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
                  <div>
                    <h1 className="text-white text-5xl font-black italic uppercase mb-2 tracking-tighter">Panel <span className="text-blue-600">Admin</span></h1>
                    <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <CloudLightning size={14} className={isSyncing ? "text-yellow-500 animate-pulse" : "text-blue-500"}/> 
                      {isSyncing ? "Sincronizando..." : "Conexión en la nube estable"}
                    </p>
                  </div>
                  <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shadow-lg no-scrollbar">
                    {['asistencias', 'asignaciones', 'modulos', 'clientes', 'instructor'].map(t => (
                      <button key={t} onClick={() => setAdminTab(t as any)} className={`flex items-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${adminTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t === 'asistencias' && <Users size={14} />}
                        {t === 'asignaciones' && <Layers size={14} />}
                        {t === 'modulos' && <BookOpen size={14} />}
                        {t === 'clientes' && <FileText size={14} />}
                        {t === 'instructor' && <ShieldCheck size={14} />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#111827] rounded-[3rem] border border-gray-800 p-6 md:p-12 shadow-2xl min-h-[500px]">
                  {adminTab === 'asistencias' && <AsistenciasView state={state} update={updateGlobal} onSync={() => sync(false)} isSyncing={isSyncing} />}
                  {adminTab === 'asignaciones' && <AsignacionesView state={state} update={updateGlobal} wsid={wsid} />}
                  {adminTab === 'modulos' && <ModulosView state={state} update={updateGlobal} />}
                  {adminTab === 'clientes' && <ClientesView state={state} update={updateGlobal} />}
                  {adminTab === 'instructor' && <InstructorView state={state} update={updateGlobal} wsid={wsid} />}
                </div>
              </div>
            )}

            {view === 'userForm' && <UserPortal state={state} wsid={wsid} onSubmit={async (rec) => {
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
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("REPORTE DE CAPACITACIÓN", 15, 25);
    autoTable(doc, {
      startY: 50,
      head: [['Colaborador', 'DNI', 'Módulo', 'Fecha', 'Firma']],
      body: data.map((r: any) => [r.name, r.dni, state.modules.find((m: any) => m.id === r.moduleId)?.name || "N/A", new Date(r.timestamp).toLocaleDateString(), '']),
      didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 4) { const rec = data[d.row.index]; doc.addImage(rec.signature, 'PNG', d.cell.x + 2, d.cell.y + 1, 30, 8); } }
    });
    doc.save(`Reporte_TrainerApp_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-white text-3xl font-black italic uppercase">Registros</h2>
        <div className="flex gap-3">
          <button onClick={onSync} className="p-3 bg-blue-500/10 rounded-xl text-blue-500 transition-colors hover:bg-blue-500/20"><RefreshCw className={isSyncing ? "animate-spin" : ""} size={20} /></button>
          <button onClick={() => confirm("¿Desea eliminar los registros?") && update({ records: state.records.filter((r: any) => !sel.includes(r.id)) })} disabled={!sel.length} className="bg-red-500/10 text-red-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] disabled:opacity-20 transition-all">Borrar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-xl disabled:opacity-30 transition-all">Descargar PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[2rem] bg-[#0d111c] border border-gray-800">
        <table className="w-full text-left">
          <thead className="text-slate-500 text-[10px] font-black uppercase border-b border-gray-800 bg-[#161e2e]">
            <tr>
              <th className="px-6 py-5 w-12"><input type="checkbox" onChange={e => setSel(e.target.checked ? state.records.map((r: any) => r.id) : [])} /></th>
              <th className="px-6 py-5">Nombre</th>
              <th className="px-6 py-5">Módulo</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {state.records.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-700 font-bold uppercase tracking-widest italic text-xs">Sin registros de asistencia</td></tr>
            ) : state.records.map((r: any) => (
              <tr key={r.id} className="hover:bg-blue-600/5 transition-all cursor-pointer" onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} readOnly /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-sm">{r.name}<div className="text-[10px] text-slate-600">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] font-black text-blue-500 uppercase">{state.modules.find((m: any) => m.id === r.moduleId)?.name}</td>
                <td className="px-6 py-6 text-center"><img src={r.signature} className="h-8 mx-auto bg-white rounded p-1 shadow-sm" /></td>
                <td className="px-6 py-6 text-[10px] text-slate-600 text-center">{new Date(r.timestamp).toLocaleDateString()}</td>
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
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Clientes</h2>
      <div className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col lg:flex-row gap-4 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-1">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Empresa</label>
          <input value={n} onChange={e => setN(e.target.value.toUpperCase())} placeholder="NOMBRE EMPRESA" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase" />
        </div>
        <div className="flex-1 w-full space-y-1">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Identificador</label>
          <input value={c} onChange={e => setC(e.target.value)} placeholder="CUIT / ID" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold" />
        </div>
        <button onClick={() => { if(!n) return; update({ clients: [...state.clients, { id: Date.now().toString(), name: n, cuit: c }] }); setN(""); setC(""); }} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-transform shadow-xl">Registrar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {state.clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 relative group shadow-lg hover:border-blue-500/30 transition-colors">
            <h3 className="text-white font-black uppercase italic mb-1 text-lg truncate pr-8">{i.name}</h3>
            <p className="text-slate-600 text-[10px] font-black uppercase">ID: {i.cuit}</p>
            <button onClick={() => confirm("¿Eliminar cliente?") && update({ clients: state.clients.filter((cl: any) => cl.id !== i.id) })} className="absolute top-8 right-8 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
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
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Módulos</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-12 bg-[#0d111c] p-5 rounded-[2.5rem] border border-gray-800 shadow-inner">
        <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="TÍTULO CAPACITACIÓN" className="flex-1 bg-transparent text-white px-6 font-bold uppercase outline-none" />
        <button onClick={() => { if(!name) return; update({ modules: [...state.modules, { id: Date.now().toString(), name: name, documents: [] }] }); setName(""); }} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-transform">Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl flex flex-col">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center">
               <h3 className="text-white font-black uppercase text-xs italic truncate pr-4">{m.name}</h3>
               <button onClick={() => confirm("¿Eliminar módulo?") && update({ modules: state.modules.filter((i: any) => i.id !== m.id) })} className="text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
             </div>
             <div className="p-8 space-y-4 flex-1">
                <div className="space-y-2">
                  {m.documents?.map((d: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#111827] p-3 rounded-xl border border-gray-800 group">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={14} className="text-blue-500 shrink-0" />
                        <span className="text-slate-300 font-bold uppercase text-[9px] truncate">{d.name}</span>
                      </div>
                      <button onClick={() => update({ modules: state.modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, i: number) => i !== idx) } : mod) })} className="text-slate-700 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  ))}
                </div>
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-5 rounded-2xl border border-blue-500/30 space-y-3 animate-in zoom-in duration-200">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE DEL ARCHIVO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-500" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL (DROPBOX / DRIVE)" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3 rounded-xl text-[10px] font-bold outline-none focus:border-blue-500" />
                    <div className="flex gap-2">
                      <button onClick={() => addDoc(m.id)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[9px] font-black uppercase active:scale-95">Añadir</button>
                      <button onClick={() => setActiveMod(null)} className="px-4 bg-slate-800 text-slate-500 py-3 rounded-xl font-black uppercase text-[9px]">X</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-2xl text-slate-800 font-black uppercase text-[10px] hover:text-blue-500 hover:border-blue-500/30 transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Adjuntar Material
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
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Vínculos QR</h2>
      <div className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12 shadow-inner">
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Seleccionar Cliente</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none focus:border-blue-500">
            <option value="">Empresa...</option>
            {state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full space-y-2">
          <label className="text-slate-600 text-[9px] font-black uppercase px-2">Módulo Capacitación</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs outline-none focus:border-blue-500">
            <option value="">Módulo...</option>
            {state.modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={() => { if(!cid || !mid) return; update({ assignments: [...state.assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] }); }} className="bg-blue-600 text-white px-12 h-16 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Generar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {state.assignments.map((a: any) => (
          <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col group shadow-lg hover:border-blue-500/20 transition-all">
            <p className="text-blue-500 font-black uppercase text-[9px] mb-1">{state.clients.find((c: any) => c.id === a.clientId)?.name}</p>
            <h3 className="text-white text-xl font-black italic uppercase mb-6 truncate">{state.modules.find((m: any) => m.id === a.moduleId)?.name}</h3>
            <button onClick={async () => {
              const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}`;
              setLink(url);
              setQr(await QRCode.toDataURL(url, { width: 512, margin: 2 }));
            }} className="w-full bg-blue-600/10 text-blue-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-blue-600 hover:text-white transition-all">Ver QR y Enlace</button>
            <button onClick={() => confirm("¿Eliminar vínculo?") && update({ assignments: state.assignments.filter((as: any) => as.id !== a.id) })} className="mt-4 text-slate-800 text-[9px] uppercase font-black hover:text-red-500 transition-colors">Borrar Vínculo</button>
          </div>
        ))}
      </div>
      {qr && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => { setQr(null); setCopied(false); }}>
          <div className="bg-[#111827] p-10 rounded-[4rem] border border-gray-800 text-center animate-in zoom-in max-w-sm w-full shadow-[0_0_100px_rgba(37,99,235,0.15)]" onClick={e => e.stopPropagation()}>
            <img src={qr} className="size-64 rounded-3xl border-8 border-white mb-8 mx-auto shadow-2xl" />
            <div className="space-y-4">
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest italic">Link del Portal de Usuario</p>
              <div className="flex bg-[#0d111c] p-2 rounded-2xl border border-gray-800 items-center overflow-hidden">
                <input readOnly value={link} className="flex-1 bg-transparent text-[8px] text-blue-500 px-3 truncate outline-none font-bold" />
                <button 
                  onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
                  className={`p-3 rounded-xl transition-all shadow-lg ${copied ? 'bg-green-600' : 'bg-blue-600'}`}
                >
                  {copied ? <Check size={14} className="text-white" /> : <Copy size={14} className="text-white" />}
                </button>
              </div>
              <a href={link} target="_blank" className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-700 transition-colors shadow-lg">
                <ExternalLink size={14} /> Abrir Link
              </a>
            </div>
            <button onClick={() => setQr(null)} className="mt-8 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const InstructorView = ({ state, update, wsid }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // EFECTO CRUCIAL PARA CORREGIR OFFSET: Redimensionar canvas al montar/cambiar de pestaña
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (sigRef.current) {
        const canvas = sigRef.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        
        // Si ya hay firma guardada, no la borramos al redimensionar
        if (state.instructor.signature) {
          sigRef.current.fromDataURL(state.instructor.signature);
        }
      }
    }, 200); // Un pequeño delay asegura que el DOM ya calculó el tamaño del contenedor
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
      <div className="bg-[#0d111c] p-10 rounded-[4rem] border border-gray-800 space-y-10 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-3xl font-black italic uppercase">Perfil del Instructor</h2>
          {state.instructor.signature && <div className="bg-green-600/10 text-green-500 p-2 rounded-lg"><CheckCircle2 size={20} /></div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-slate-600 text-[9px] font-black uppercase px-2">Nombre Instructor</label>
            <input 
              value={state.instructor.name} 
              onChange={e => update({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} 
              placeholder="NOMBRE COMPLETO" 
              className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm focus:border-blue-500 outline-none transition-all" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-600 text-[9px] font-black uppercase px-2">Cargo</label>
            <input 
              value={state.instructor.role} 
              onChange={e => update({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} 
              placeholder="CARGO / ROL" 
              className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm focus:border-blue-500 outline-none transition-all" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-slate-600 text-[9px] font-black uppercase">Firma Digital (Dedo o Mouse)</label>
            <button onClick={() => sigRef.current?.clear()} className="text-[9px] font-black uppercase text-slate-700 hover:text-red-500 transition-colors">Limpiar</button>
          </div>
          <div className="bg-white rounded-[2.5rem] h-60 border-4 border-gray-800 overflow-hidden shadow-inner relative group">
            {/* Fix: Using spread and any to bypass missing penColor in SignatureCanvas types */}
            <SignatureCanvas 
              {...({
                ref: sigRef,
                penColor: "blue",
                canvasProps: { className: 'w-full h-full' }
              } as any)}
            />
          </div>
          <p className="text-center text-[8px] text-slate-800 font-black uppercase tracking-widest italic">Esta firma se utilizará para validar las constancias de los alumnos</p>
        </div>

        <button 
          onClick={handleSave} 
          className={`w-full py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${saveSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
        >
          {saveSuccess ? (
            <><Check size={18} /> Perfil Actualizado</>
          ) : (
            <><Save size={18} /> Guardar Perfil Instructor</>
          )}
        </button>
      </div>
      
      {/* Sección de "Sincronizar" eliminada a pedido del usuario para simplificar UI */}
    </div>
  );
};

const UserPortal = ({ state, onSubmit }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState(1), [name, setName] = useState(""), [dni, setDni] = useState(""), [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const p = new URLSearchParams(window.location.search), cid = p.get('cid'), mid = p.get('mid');
  
  const cl = state.clients.find((c: any) => c.id === cid);
  const mo = state.modules.find((m: any) => m.id === mid);
  
  const generateReceipt = () => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.text("CONSTANCIA DE CAPACITACIÓN", 15, 25);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(12);
    doc.text(`Colaborador: ${name}`, 20, 60);
    doc.text(`DNI: ${dni}`, 20, 70);
    doc.text(`Empresa: ${cl?.name || 'TRAINERAPP'}`, 20, 80);
    doc.text(`Módulo: ${mo?.name || 'CAPACITACIÓN'}`, 20, 90);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 100);
    
    doc.text("Firma del Colaborador:", 20, 130);
    if(sigRef.current) doc.addImage(sigRef.current.toDataURL(), 'PNG', 20, 135, 60, 20);
    
    if(state.instructor?.signature) {
      doc.text("Instructor:", 120, 130);
      doc.addImage(state.instructor.signature, 'PNG', 120, 135, 60, 20);
      doc.setFontSize(8); 
      doc.text(state.instructor.name || "INSTRUCTOR", 120, 160);
      doc.text(state.instructor.role || "", 120, 164);
    }
    doc.save(`Constancia_${name.replace(/\s/g, '_')}.pdf`);
  };

  // Corrección de offset para portal de usuario
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
    <div className="max-w-md mx-auto py-24 text-center animate-in zoom-in p-6">
      <div className="bg-green-600/10 size-24 rounded-full flex items-center justify-center mx-auto mb-8">
        <CheckCircle2 size={50} className="text-green-500" />
      </div>
      <h2 className="text-3xl font-black text-white italic uppercase mb-12 leading-tight">¡REGISTRO EXITOSO!<br/><span className="text-blue-500 text-sm italic normal-case">Su asistencia ha sido guardada en la nube.</span></h2>
      <button onClick={generateReceipt} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase mb-4 flex gap-3 items-center justify-center shadow-2xl active:scale-95 transition-transform"><Award size={20}/> Descargar Constancia PDF</button>
      <button onClick={() => window.location.href = '/'} className="w-full bg-slate-800 text-white py-5 rounded-[2rem] font-black uppercase opacity-50 hover:opacity-100 transition-opacity">Finalizar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-10 px-4 animate-in slide-in-from-bottom-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black italic text-white uppercase mb-2 leading-none">{mo?.name || "Validando..."}</h1>
        <div className="bg-blue-600/10 px-5 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase inline-block mt-2">{cl?.name || "TrainerCloud Connect"}</div>
      </div>
      <div className="bg-[#111827] rounded-[3.5rem] border border-gray-800 p-8 md:p-10 shadow-2xl relative">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-slate-600 text-[9px] font-black uppercase px-2">Identificación</label>
              <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="APELLIDO Y NOMBRE" className="w-full bg-[#0d111c] border border-gray-800 text-white p-6 rounded-2xl font-bold uppercase outline-none focus:border-blue-500 transition-all shadow-inner" />
            </div>
            <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI / DOCUMENTO" className="w-full bg-[#0d111c] border border-gray-800 text-white p-6 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all shadow-inner" />
            
            <div className="space-y-3 pt-4 border-t border-gray-800/50">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2 italic">Material de Lectura / Capacitación</p>
              {mo?.documents?.map((doc: any, i: number) => (
                <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-[#0d111c] border border-gray-800 p-5 rounded-2xl hover:border-blue-500/50 group transition-all shadow-md">
                  <span className="text-slate-200 font-bold uppercase text-[10px] truncate pr-2">{doc.name}</span>
                  <ExternalLink size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                </a>
              ))}
              {(!mo?.documents || mo.documents.length === 0) && <p className="text-center text-slate-700 italic font-bold text-[10px] uppercase">No hay archivos adjuntos</p>}
            </div>
            
            <button onClick={() => { if(!name || !dni) return alert("Complete sus datos"); setStep(2); }} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl mt-4 active:scale-95 transition-all">Siguiente: Firmar Asistencia</button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black uppercase text-slate-500">Firma del Colaborador</label>
                <button onClick={() => sigRef.current?.clear()} className="text-[9px] font-black uppercase text-slate-700">Limpiar</button>
              </div>
              <div className="bg-white rounded-[2.5rem] h-52 overflow-hidden border-4 border-gray-800 relative shadow-2xl">
                {/* Fix: Using spread and any to bypass missing penColor in SignatureCanvas types */}
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
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 text-slate-400 py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest">Atrás</button>
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
                className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : "Finalizar Registro"}
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
