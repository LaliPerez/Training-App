
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Loader2
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
  
  // Login State
  const [loginPass, setLoginPass] = useState(() => localStorage.getItem(STORAGE_KEYS.REMEMBERED_PASS) || "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(STORAGE_KEYS.REMEMBERED_PASS));

  const sync = useCallback(async (silent = true) => {
    if (!wsid) return;
    if (!silent) setIsSyncing(true);
    const data = await api.load(wsid);
    if (data) {
      setState(data);
      setHasInitialLoad(true);
    }
    if (!silent) setIsSyncing(false);
  }, [wsid]);

  useEffect(() => {
    if (wsid) {
      sync();
      if (isAuth) {
        const timer = setInterval(() => sync(true), 15000);
        return () => clearInterval(timer);
      }
    } else {
      setHasInitialLoad(true);
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

  const handleLogout = () => {
    if (confirm("¿Cerrar sesión?")) {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      location.reload();
    }
  };

  return (
    <div className="bg-[#060912] min-h-screen text-slate-200 font-sans selection:bg-blue-600">
      <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.pathname}>
          <div className="bg-blue-600 p-1.5 rounded-lg"><BookOpen size={18} className="text-white" /></div>
          <span className="text-white font-black italic uppercase text-xl">TRAINER<span className="text-blue-600">APP</span></span>
        </div>
        {isAuth && (
          <button onClick={handleLogout} className="text-red-500 font-black uppercase text-[10px] tracking-widest px-4 py-2 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all">Salir</button>
        )}
      </nav>

      <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
        {!hasInitialLoad && view === 'userForm' ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-blue-500" size={40} />
            <p className="font-black uppercase italic text-xs tracking-widest text-slate-500">Cargando Capacitación...</p>
          </div>
        ) : (
          <>
            {view === 'landing' && (
              <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
                <h1 className="text-7xl md:text-9xl font-black italic uppercase text-white tracking-tighter mb-4">TRAINER<span className="text-blue-600">APP</span></h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mb-12">Capacitación y Firmas Digitales</p>
                <button onClick={() => setView('adminLogin')} className="bg-[#111827] border border-gray-800 p-10 rounded-[3rem] hover:border-blue-500/50 transition-all shadow-2xl group max-w-sm w-full">
                  <ShieldCheck size={48} className="text-blue-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-black uppercase italic text-xl">Panel Instructor</h3>
                  <p className="text-slate-500 text-[10px] mt-2 uppercase font-bold tracking-widest">Acceso Administrativo</p>
                </button>
              </div>
            )}

            {view === 'adminLogin' && (
              <div className="min-h-[60vh] flex items-center justify-center animate-in zoom-in duration-300">
                <div className="bg-[#111827] p-10 md:p-14 rounded-[4rem] border border-gray-800 w-full max-w-md text-center shadow-2xl">
                  <ShieldCheck size={60} className="text-blue-600 mx-auto mb-8" />
                  <h2 className="text-white text-3xl font-black uppercase italic mb-10">Ingresar</h2>
                  <div className="relative mb-6">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="CONTRASEÑA" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-6 rounded-3xl outline-none font-bold text-center tracking-[0.2em] focus:border-blue-500 text-xl" 
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500"><Eye size={24} /></button>
                  </div>
                  <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] uppercase text-xs tracking-widest shadow-xl">Ingresar al Panel</button>
                </div>
              </div>
            )}

            {view === 'adminDashboard' && (
              <div className="animate-in slide-in-from-bottom-6 duration-500">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
                  <div>
                    <h1 className="text-white text-5xl font-black italic uppercase tracking-tighter mb-2">Panel de <span className="text-blue-600">Control</span></h1>
                    <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <CloudLightning size={14} className={isSyncing ? "text-yellow-500 animate-pulse" : "text-blue-500"}/> 
                      {isSyncing ? "Sincronizando..." : "Sincronización Automática Activa"}
                    </p>
                  </div>
                  <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto shadow-lg">
                    {[
                      { id: 'asistencias', label: 'Reportes', icon: Users },
                      { id: 'asignaciones', label: 'Vínculos QR', icon: Layers },
                      { id: 'modulos', label: 'Módulos', icon: BookOpen },
                      { id: 'clientes', label: 'Clientes', icon: FileText },
                      { id: 'instructor', label: 'Perfil', icon: ShieldCheck }
                    ].map(t => (
                      <button key={t.id} onClick={() => setAdminTab(t.id as any)} className={`flex items-center gap-2 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${adminTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        <t.icon size={14} /> {t.label}
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
              // FUNCIÓN DE GUARDADO SEGURO: Protege contra el borrado de capacitaciones y empresas
              if (wsid) {
                const latestCloudState = await api.load(wsid);
                if (latestCloudState) {
                  const updatedState = {
                    ...latestCloudState, // Mantenemos módulos, clientes e instructor de la nube
                    records: [rec, ...(latestCloudState.records || [])] // Solo añadimos el nuevo registro
                  };
                  setState(updatedState);
                  await api.save(wsid, updatedState);
                }
              }
            }} />}
          </>
        )}
      </main>
    </div>
  );
};

// --- Sub-vistas (Dashboard) ---
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
    doc.save(`Reporte_Asistencias_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-white text-3xl font-black italic uppercase">Registros</h2>
        <div className="flex gap-3">
          <button onClick={onSync} className="p-3 text-blue-500 bg-blue-500/10 rounded-xl"><RefreshCw className={isSyncing ? "animate-spin" : ""} /></button>
          <button onClick={() => update({ records: state.records.filter((r: any) => !sel.includes(r.id)) })} disabled={!sel.length} className="bg-red-500/10 text-red-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] disabled:opacity-20">Borrar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-xl disabled:opacity-30">PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[2rem] bg-[#0d111c]">
        <table className="w-full text-left">
          <thead className="text-slate-500 text-[10px] font-black uppercase border-b border-gray-800">
            <tr>
              <th className="px-6 py-5 w-12"><input type="checkbox" onChange={e => setSel(e.target.checked ? state.records.map((r: any) => r.id) : [])} /></th>
              <th className="px-6 py-5">Colaborador</th>
              <th className="px-6 py-5">Módulo / Empresa</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {state.records.map((r: any) => (
              <tr key={r.id} className="hover:bg-blue-600/5 transition-all cursor-pointer" onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} readOnly /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-sm">{r.name}<div className="text-[10px] text-slate-600">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] font-black text-blue-500 uppercase">{state.modules.find((m: any) => m.id === r.moduleId)?.name}<div className="text-slate-500">{state.clients.find((c: any) => c.id === r.companyId)?.name}</div></td>
                <td className="px-6 py-6 text-center"><img src={r.signature} className="h-8 mx-auto bg-white rounded p-1" /></td>
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
      <div className="bg-[#0d111c] p-8 rounded-[3rem] flex flex-col lg:flex-row gap-4 items-end mb-12 border border-gray-800">
        <div className="flex-1 w-full"><input value={n} onChange={e => setN(e.target.value.toUpperCase())} placeholder="NOMBRE EMPRESA" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase" /></div>
        <div className="flex-1 w-full"><input value={c} onChange={e => setC(e.target.value)} placeholder="CUIT" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold" /></div>
        <button onClick={() => { if(!n) return; update({ clients: [...state.clients, { id: Date.now().toString(), name: n, cuit: c }] }); setN(""); setC(""); }} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs">Registrar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {state.clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 relative group">
            <h3 className="text-white font-black uppercase italic mb-1 text-lg truncate pr-8">{i.name}</h3>
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">CUIT: {i.cuit}</p>
            <button onClick={() => update({ clients: state.clients.filter((cl: any) => cl.id !== i.id) })} className="absolute top-8 right-8 text-slate-800 hover:text-red-500"><Trash2 size={18} /></button>
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
        <button onClick={() => { if(!name) return; update({ modules: [...state.modules, { id: Date.now().toString(), name: name, documents: [] }] }); setName(""); }} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs">Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center">
               <h3 className="text-white font-black uppercase text-xs italic truncate pr-4">{m.name}</h3>
               <button onClick={() => update({ modules: state.modules.filter((i: any) => i.id !== m.id) })} className="text-slate-800 hover:text-red-500"><Trash2 size={16} /></button>
             </div>
             <div className="p-8 space-y-4">
                {m.documents?.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-[#111827] p-3 rounded-xl border border-gray-800">
                    <span className="text-slate-300 font-bold uppercase text-[9px] truncate">{d.name}</span>
                    <button onClick={() => update({ modules: state.modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, i: number) => i !== idx) } : mod) })}><X size={14} /></button>
                  </div>
                ))}
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-4 rounded-2xl space-y-3">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3 rounded-xl text-[10px]" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL DROPBOX" className="w-full bg-[#0d111c] border border-gray-800 text-white p-3 rounded-xl text-[10px]" />
                    <div className="flex gap-2"><button onClick={() => addDoc(m.id)} className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-[9px]">AÑADIR</button></div>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-2xl text-slate-800 font-black uppercase text-[10px] hover:text-blue-500">+ Material</button>
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
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Vínculos QR</h2>
      <div className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col lg:flex-row gap-6 items-end mb-12">
        <div className="flex-1 w-full"><select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs">{state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Empresa...</option></select></div>
        <div className="flex-1 w-full"><select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs">{state.modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}<option value="">Capacitación...</option></select></div>
        <button onClick={() => { if(!cid || !mid) return; update({ assignments: [...state.assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] }); }} className="bg-blue-600 text-white px-12 h-16 rounded-3xl font-black uppercase text-xs">Generar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {state.assignments.map((a: any) => (
          <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col group">
            <h3 className="text-white text-xl font-black italic uppercase mb-6 truncate">{state.modules.find((m: any) => m.id === a.moduleId)?.name}</h3>
            <button onClick={async () => setQr(await QRCode.toDataURL(`${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}`))} className="w-full bg-blue-600/10 text-blue-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-blue-600 hover:text-white">Ver QR</button>
            <button onClick={() => update({ assignments: state.assignments.filter((as: any) => as.id !== a.id) })} className="mt-2 text-slate-800 text-[10px] uppercase font-black">Eliminar</button>
          </div>
        ))}
      </div>
      {qr && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setQr(null)}><img src={qr} className="size-64 rounded-3xl border-8 border-white animate-in zoom-in" /></div>}
    </div>
  );
};

const InstructorView = ({ state, update, wsid }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [cloned, setCloned] = useState("");
  return (
    <div className="animate-in fade-in max-w-2xl mx-auto space-y-12">
      <div className="bg-[#0d111c] p-10 rounded-[4rem] border border-gray-800 space-y-8 shadow-2xl">
        <h2 className="text-white text-3xl font-black italic uppercase">Perfil</h2>
        <div className="grid grid-cols-2 gap-4">
          <input value={state.instructor.name} onChange={e => update({ instructor: { ...state.instructor, name: e.target.value.toUpperCase() } })} placeholder="NOMBRE" className="bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm" />
          <input value={state.instructor.role} onChange={e => update({ instructor: { ...state.instructor, role: e.target.value.toUpperCase() } })} placeholder="CARGO" className="bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-sm" />
        </div>
        <div className="bg-white rounded-[2rem] h-52 border-4 border-gray-800 overflow-hidden relative">
          <SignatureCanvas ref={sigRef} canvasProps={{ className: 'w-full h-full' }} />
        </div>
        <button onClick={() => update({ instructor: { ...state.instructor, signature: sigRef.current?.toDataURL() || "" } })} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl">Guardar Perfil</button>
      </div>
      <div className="bg-blue-600/5 p-12 rounded-[4rem] border border-blue-500/20 text-center space-y-6">
        <Smartphone size={40} className="text-blue-500 mx-auto" />
        <h3 className="text-white text-2xl font-black italic uppercase">Vincular Dispositivo</h3>
        <button onClick={async () => setCloned(await QRCode.toDataURL(`${window.location.origin}${window.location.pathname}?admin_ws=${wsid}&atoken=${btoa(ADMIN_PASSWORD)}`))} className="bg-blue-600/20 text-blue-400 px-10 py-5 rounded-2xl font-black uppercase text-[10px]">Generar Clonación</button>
        {cloned && <img src={cloned} className="size-52 mx-auto rounded-[2rem] border-8 border-white animate-in zoom-in" />}
      </div>
    </div>
  );
};

const UserPortal = ({ state, onSubmit }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState(1), [name, setName] = useState(""), [dni, setDni] = useState(""), [done, setDone] = useState(false);
  const p = new URLSearchParams(window.location.search), cid = p.get('cid'), mid = p.get('mid');
  const cl = state.clients.find((c: any) => c.id === cid), mo = state.modules.find((m: any) => m.id === mid);
  
  const generateReceipt = () => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text("CONSTANCIA DE CAPACITACIÓN", 15, 25);
    doc.setTextColor(0, 0, 0); doc.setFontSize(12);
    doc.text(`Colaborador: ${name}`, 20, 60);
    doc.text(`DNI: ${dni}`, 20, 70);
    doc.text(`Empresa: ${cl?.name || 'N/A'}`, 20, 80);
    doc.text(`Capacitación: ${mo?.name || 'N/A'}`, 20, 90);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 100);
    doc.text("Firma del Colaborador:", 20, 130);
    doc.addImage(sigRef.current!.toDataURL(), 'PNG', 20, 135, 60, 20);
    if(state.instructor?.signature) {
      doc.text("Instructor:", 120, 130);
      doc.addImage(state.instructor.signature, 'PNG', 120, 135, 60, 20);
      doc.setFontSize(8); doc.text(state.instructor.name || "", 120, 160);
    }
    doc.save(`Constancia_${name}.pdf`);
  };

  if (done) return (
    <div className="max-w-md mx-auto py-24 text-center animate-in zoom-in">
      <CheckCircle2 size={70} className="text-green-500 mx-auto mb-6" />
      <h2 className="text-3xl font-black text-white italic uppercase mb-12">REGISTRO EXITOSO</h2>
      <button onClick={generateReceipt} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase mb-4 flex gap-3 items-center justify-center"><Award size={20}/> Descargar Constancia</button>
      <button onClick={() => location.reload()} className="w-full bg-slate-800 text-white py-5 rounded-[2rem] font-black uppercase">Finalizar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-10 px-4 animate-in slide-in-from-bottom-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black italic text-white uppercase mb-2 leading-none">{mo?.name || "Cargando..."}</h1>
        <div className="bg-blue-600/10 px-5 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase inline-block mt-2">{cl?.name || "TrainerApp Cloud"}</div>
      </div>
      <div className="bg-[#111827] rounded-[3.5rem] border border-gray-800 p-10 shadow-2xl">
        {step === 1 ? (
          <div className="space-y-6">
            <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="APELLIDO Y NOMBRE" className="w-full bg-[#0d111c] border border-gray-800 text-white p-6 rounded-2xl font-bold uppercase outline-none focus:border-blue-500" />
            <input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI" className="w-full bg-[#0d111c] border border-gray-800 text-white p-6 rounded-2xl font-bold outline-none focus:border-blue-500" />
            {mo?.documents?.length ? (
              <div className="space-y-3 pt-4 border-t border-gray-800/50">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center">Material Requerido</p>
                {mo.documents.map((doc: any, i: number) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-[#0d111c] border border-gray-800 p-4 rounded-xl hover:border-blue-500/50 group">
                    <span className="text-slate-300 font-bold uppercase text-[9px] truncate pr-2">{doc.name}</span>
                    <ExternalLink size={14} className="text-slate-600 group-hover:text-blue-500" />
                  </a>
                ))}
              </div>
            ) : <p className="text-center text-slate-700 uppercase italic font-bold text-[9px]">Sin material de lectura</p>}
            <button onClick={() => name && dni && setStep(2)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl mt-4 transition-transform active:scale-95">Ir a Firma</button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] h-52 overflow-hidden border-4 border-gray-800 relative">
              <SignatureCanvas ref={sigRef} canvasProps={{ className: 'w-full h-full' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => sigRef.current?.clear()} className="flex-1 text-slate-600 text-[10px] font-black uppercase border border-gray-800 py-4 rounded-2xl">Limpiar</button>
              <button onClick={async () => { 
                if(sigRef.current?.isEmpty()) return alert("Firma requerida"); 
                await onSubmit({ id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: sigRef.current!.toDataURL() }); 
                setDone(true); 
              }} className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl">Confirmar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
