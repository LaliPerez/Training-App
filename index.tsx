
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Users, 
  BookOpen, 
  QrCode, 
  UserCircle, 
  LogOut, 
  Trash2, 
  Download, 
  Plus, 
  Copy, 
  FileText, 
  CheckCircle2, 
  ShieldCheck,
  ExternalLink,
  X,
  AlertCircle,
  ChevronRight,
  Layers,
  ScanLine,
  Upload,
  Database,
  Eye,
  EyeOff,
  CloudLightning,
  RefreshCw,
  Cloud,
  Globe,
  Link,
  Smartphone
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
interface Client {
  id: string;
  name: string;
  cuit: string;
}

interface ModuleDocument {
  name: string;
  url: string;
}

interface Module {
  id: string;
  name: string;
  documents: ModuleDocument[];
}

interface Assignment {
  id: string;
  clientId: string;
  moduleId: string;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  name: string;
  dni: string;
  companyId: string;
  moduleId: string;
  timestamp: string;
  signature: string;
}

interface Instructor {
  name: string;
  role: string;
  signature: string;
}

interface AppState {
  clients: Client[];
  modules: Module[];
  assignments: Assignment[];
  records: AttendanceRecord[];
  instructor: Instructor;
}

// --- Constants ---
const ADMIN_PASSWORD = "admin2025";
const STORAGE_KEYS = {
  WORKSPACE_ID: 'trainer_app_wsid_v6',
  AUTH: 'trainer_app_auth_v6'
};
const CLOUD_API_URL = 'https://api.restful-api.dev/objects';

// --- API Helpers ---
const loadFromCloud = async (wsid: string): Promise<AppState | null> => {
  if (!wsid) return null;
  try {
    const response = await fetch(`${CLOUD_API_URL}/${wsid}`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.data as AppState;
  } catch (e) {
    return null;
  }
};

const saveToCloud = async (wsid: string, state: AppState) => {
  if (!wsid) return;
  try {
    await fetch(`${CLOUD_API_URL}/${wsid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `TrainerWS`, data: state })
    });
  } catch (e) {}
};

const App = () => {
  const [view, setView] = useState<'landing' | 'userForm' | 'adminLogin' | 'adminDashboard'>('landing');
  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('admin_ws') || localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID) || "";
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('admin_token') === btoa(ADMIN_PASSWORD)) return true;
    return localStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [instructor, setInstructor] = useState<Instructor>({ name: "", role: "", signature: "" });
  
  const [adminTab, setAdminTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');
  const [activeParams, setActiveParams] = useState<{cid: string | null, mid: string | null}>({ cid: null, mid: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const getBaseUrl = () => window.location.origin + window.location.pathname;

  // --- Real-time Auto Sync ---
  const syncWithCloud = useCallback(async () => {
    if (!workspaceId) return;
    const data = await loadFromCloud(workspaceId);
    if (data) {
      setClients(prev => JSON.stringify(prev) !== JSON.stringify(data.clients) ? data.clients : prev);
      setModules(prev => JSON.stringify(prev) !== JSON.stringify(data.modules) ? data.modules : prev);
      setAssignments(prev => JSON.stringify(prev) !== JSON.stringify(data.assignments) ? data.assignments : prev);
      setRecords(prev => JSON.stringify(prev) !== JSON.stringify(data.records) ? data.records : prev);
      setInstructor(prev => JSON.stringify(prev) !== JSON.stringify(data.instructor) ? data.instructor : prev);
      setLastSync(new Date());
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    syncWithCloud();
    const interval = setInterval(syncWithCloud, 10000); // Polling cada 10s para sync automática
    return () => clearInterval(interval);
  }, [workspaceId, syncWithCloud]);

  const pushUpdate = useCallback(async (newState: Partial<AppState>) => {
    if (!workspaceId || !isAdminAuthenticated) return;
    setIsSyncing(true);
    const currentState: AppState = {
      clients: newState.clients ?? clients,
      modules: newState.modules ?? modules,
      assignments: newState.assignments ?? assignments,
      records: newState.records ?? records,
      instructor: newState.instructor ?? instructor
    };
    await saveToCloud(workspaceId, currentState);
    setIsSyncing(false);
  }, [workspaceId, isAdminAuthenticated, clients, modules, assignments, records, instructor]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cid = p.get('cid');
    const mid = p.get('mid');
    const wsid = p.get('wsid');
    const adminWsid = p.get('admin_ws');

    if (wsid) setWorkspaceId(wsid);
    if (adminWsid && isAdminAuthenticated) setView('adminDashboard');
    if (cid && mid) {
      setActiveParams({ cid, mid });
      setView('userForm');
    }
  }, [isAdminAuthenticated]);

  const handleAdminLogin = async (pass: string) => {
    if (pass !== ADMIN_PASSWORD) return alert("Contraseña incorrecta");
    
    let targetWsid = workspaceId;
    if (!targetWsid) {
      setIsSyncing(true);
      const res = await fetch(CLOUD_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "TrainerWS", data: { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } } })
      });
      const result = await res.json();
      targetWsid = result.id;
    }

    setWorkspaceId(targetWsid);
    setIsAdminAuthenticated(true);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, targetWsid);
    localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
    setView('adminDashboard');
    window.history.replaceState({}, '', getBaseUrl());
  };

  const handleUserSubmission = async (newRecord: AttendanceRecord) => {
    setIsSyncing(true);
    const latest = await loadFromCloud(workspaceId);
    if (latest) {
      const updatedRecords = [newRecord, ...(latest.records || [])];
      await saveToCloud(workspaceId, { ...latest, records: updatedRecords });
      setRecords(updatedRecords);
    }
    setIsSyncing(false);
  };

  return (
    <div className="bg-[#060912] min-h-screen text-slate-200 font-sans antialiased selection:bg-blue-600">
      <Navbar 
        isAdmin={isAdminAuthenticated} 
        onLogout={() => { setIsAdminAuthenticated(false); localStorage.clear(); setView('landing'); }}
        isSyncing={isSyncing}
        lastSync={lastSync}
      />

      <main className="pt-20 px-4 max-w-7xl mx-auto">
        {view === 'landing' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-1000">
            <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter uppercase mb-4 text-white">TRAINER<span className="text-blue-600">APP</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs mb-12 italic">Gestión de Capacitaciones Pro</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              <button onClick={() => setView('adminLogin')} className="bg-[#111827] border border-gray-800 p-8 rounded-[2.5rem] hover:border-blue-500/50 transition-all group shadow-2xl">
                <ShieldCheck size={40} className="text-blue-500 mb-4 mx-auto group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-black uppercase italic text-xl">Acceso Admin</h3>
                <p className="text-slate-500 text-xs mt-2 uppercase font-bold">Gestionar Contenido y Reportes</p>
              </button>
              <div className="bg-[#111827] border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl opacity-50 cursor-not-allowed">
                <ScanLine size={40} className="text-slate-600 mb-4 mx-auto" />
                <h3 className="text-slate-500 font-black uppercase italic text-xl">Portal Personal</h3>
                <p className="text-slate-700 text-[10px] mt-2 uppercase font-bold leading-tight">Acceso mediante escaneo de código QR</p>
              </div>
            </div>
          </div>
        )}

        {view === 'adminLogin' && <AdminLogin onLogin={(pass: string) => handleAdminLogin(pass)} isSyncing={isSyncing} />}

        {view === 'adminDashboard' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <DashboardHeader adminTab={adminTab} setAdminTab={setAdminTab} />
            <div className="bg-[#111827] rounded-[2rem] md:rounded-[3rem] border border-gray-800 p-4 md:p-10 shadow-2xl mb-10">
              {adminTab === 'asistencias' && <AsistenciasView records={records} clients={clients} modules={modules} instructor={instructor} onUpdate={(recs: any) => pushUpdate({records: recs})} onManualRefresh={syncWithCloud} isSyncing={isSyncing} />}
              {adminTab === 'asignaciones' && <AsignacionesView clients={clients} modules={modules} assignments={assignments} workspaceId={workspaceId} onUpdate={(asg: any) => pushUpdate({assignments: asg})} />}
              {adminTab === 'modulos' && <ModulosView modules={modules} onUpdate={(mods: any) => pushUpdate({modules: mods})} />}
              {adminTab === 'clientes' && <ClientesView clients={clients} onUpdate={(cls: any) => pushUpdate({clients: cls})} />}
              {adminTab === 'instructor' && <InstructorView instructor={instructor} onUpdate={(inst: any) => pushUpdate({instructor: inst})} workspaceId={workspaceId} />}
            </div>
          </div>
        )}

        {view === 'userForm' && (
          <UserPortal 
            clients={clients} 
            modules={modules} 
            activeParams={activeParams} 
            onSubmit={handleUserSubmission} 
            instructor={instructor} 
            onGoHome={() => setView('landing')} 
            isSyncing={isSyncing}
          />
        )}
      </main>
    </div>
  );
};

// --- Navbar ---

const Navbar = ({ isAdmin, onLogout, isSyncing, lastSync }: any) => (
  <nav className="fixed top-0 w-full z-50 bg-[#0a1120]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = window.location.origin + window.location.pathname}>
      <div className="bg-blue-600 p-1.5 rounded-lg"><BookOpen size={18} className="text-white" /></div>
      <span className="text-white font-black italic uppercase text-xl">TRAINER<span className="text-blue-600">APP</span></span>
    </div>
    <div className="flex items-center gap-4">
      {isAdmin && (
        <button onClick={onLogout} className="bg-red-600/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20 transition-all">Salir</button>
      )}
    </div>
  </nav>
);

const DashboardHeader = ({ adminTab, setAdminTab }: any) => (
  <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-8 gap-6 px-2">
    <div>
      <h1 className="text-white text-4xl font-black italic uppercase tracking-tighter mb-1">Panel de <span className="text-blue-600">Capacitador</span></h1>
      <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><CloudLightning size={12} className="text-blue-500"/> Sincronización Automática Activa</p>
    </div>
    <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto no-scrollbar shadow-lg snap-x">
      {[
        { id: 'asistencias', label: 'Reportes', icon: Users },
        { id: 'asignaciones', label: 'Vínculos QR', icon: Layers },
        { id: 'modulos', label: 'Módulos', icon: BookOpen },
        { id: 'clientes', label: 'Clientes', icon: FileText },
        { id: 'instructor', label: 'Perfil', icon: UserCircle }
      ].map(t => (
        <button key={t.id} onClick={() => setAdminTab(t.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap snap-center ${adminTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <t.icon size={14} /> {t.label}
        </button>
      ))}
    </div>
  </div>
);

// --- Views ---

const AdminLogin = ({ onLogin, isSyncing }: any) => {
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-[#111827] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 w-full max-w-md shadow-2xl text-center animate-in zoom-in duration-300">
        <ShieldCheck size={56} className="text-blue-500 mx-auto mb-10" />
        <h2 className="text-white text-3xl font-black italic uppercase mb-12">Seguridad</h2>
        <div className="space-y-4 mb-10">
          <div className="relative">
            <input 
              type={showPass ? "text" : "password"} 
              placeholder="CONTRASEÑA" 
              value={pass} 
              onChange={e => setPass(e.target.value)} 
              className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-6 rounded-3xl outline-none font-bold text-center tracking-widest focus:border-blue-500 transition-all text-xl"
            />
            <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-2">
              {showPass ? <EyeOff size={22}/> : <Eye size={22}/>}
            </button>
          </div>
        </div>
        <button 
          onClick={() => onLogin(pass)} 
          disabled={isSyncing}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-[2rem] uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          Ingresar al Panel
        </button>
      </div>
    </div>
  );
};

const AsistenciasView = ({ records, clients, modules, instructor, onUpdate, onManualRefresh, isSyncing }: any) => {
  const [sel, setSel] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState("");

  const filtered = records.filter((r: any) => !filterClient || r.companyId === filterClient);

  const generatePDF = () => {
    const data = filtered.filter((r: any) => sel.includes(r.id));
    if (!data.length) return alert("Seleccione registros.");
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE CAPACITACIÓN", 15, 25);
    autoTable(doc, {
      startY: 50,
      head: [['Colaborador', 'DNI', 'Módulo', 'Fecha', 'Firma']],
      body: data.map((r: any) => [r.name, r.dni, modules.find((m: any) => m.id === r.moduleId)?.name, new Date(r.timestamp).toLocaleDateString(), '']),
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 4) {
          const rec = data[d.row.index];
          if (rec.signature.startsWith('data:image')) doc.addImage(rec.signature, 'PNG', d.cell.x + 2, d.cell.y + 1, 30, 8);
        }
      }
    });
    if (instructor.signature) {
      const y = (doc as any).lastAutoTable.finalY + 20;
      doc.addImage(instructor.signature, 'PNG', 140, y, 50, 15);
      doc.line(140, y + 15, 190, y + 15);
      doc.setFontSize(10); doc.text(instructor.name || "Instructor", 165, y + 20, { align: "center" });
    }
    doc.save(`Reporte_Trainer_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h2 className="text-white text-3xl font-black italic uppercase">Asistencias</h2>
          <button 
            onClick={onManualRefresh} 
            className="mt-2 text-[10px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-2 tracking-widest"
          >
            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} /> Sincronizar Ahora (Forzar Nube)
          </button>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => confirm("?") && onUpdate(records.filter((r: any) => !sel.includes(r.id)))} disabled={!sel.length} className="flex-1 md:flex-none bg-red-600/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-2xl font-black uppercase text-[10px] disabled:opacity-30">Eliminar</button>
          <button onClick={generatePDF} disabled={!sel.length} className="flex-1 md:flex-none bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl disabled:opacity-30 flex items-center justify-center gap-2"><Download size={14} /> Reporte</button>
        </div>
      </div>
      
      <div className="bg-[#0d111c] border border-gray-800 rounded-3xl p-4 mb-8">
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
          <option value="">TODAS LAS EMPRESAS</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-gray-800 bg-[#0d111c] no-scrollbar">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-[#161e2e] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-800">
            <tr>
              <th className="px-6 py-5 text-center w-12"><input type="checkbox" checked={filtered.length > 0 && sel.length === filtered.length} onChange={e => setSel(e.target.checked ? filtered.map((r: any) => r.id) : [])} className="size-4 rounded bg-gray-800 border-gray-700 text-blue-600" /></th>
              <th className="px-6 py-5">Colaborador</th>
              <th className="px-6 py-5">Capacitación</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {!filtered.length ? (
              <tr><td colSpan={5} className="py-24 text-center opacity-30 italic font-black uppercase text-sm tracking-[0.5em]">No hay registros para mostrar</td></tr>
            ) : filtered.map((r: any) => (
              <tr key={r.id} className={`hover:bg-slate-800/30 transition-all cursor-pointer ${sel.includes(r.id) ? 'bg-blue-600/5' : ''}`} onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])} className="size-5 rounded bg-gray-800 border-gray-700 text-blue-600" /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-sm">{r.name}<div className="text-[10px] text-slate-600 font-black">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] uppercase font-black text-blue-500">{modules.find((m: any) => m.id === r.moduleId)?.name}<div className="text-slate-500 font-bold">{clients.find((c: any) => c.id === r.companyId)?.name}</div></td>
                <td className="px-6 py-6 text-center"><div className="bg-white p-1 rounded-xl h-10 w-28 overflow-hidden inline-block"><img src={r.signature} className="h-full w-full object-contain" /></div></td>
                <td className="px-6 py-6 text-[10px] text-slate-600 font-black text-center">{new Date(r.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ... Resto de componentes mantenidos con lógica simplificada y sin IDs visibles ...

const AsignacionesView = ({ clients, modules, assignments, workspaceId, onUpdate }: any) => {
  const [cid, setCid] = useState("");
  const [mid, setMid] = useState("");
  const [qrModal, setQrModal] = useState<string | null>(null);

  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Vínculos QR</h2>
      <div className="bg-[#0d111c] p-6 md:p-10 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-4 items-end mb-12 shadow-inner">
        <div className="flex-1 space-y-2 w-full">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest">Empresa</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
            <option value="">SELECCIONAR CLIENTE...</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-2 w-full">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest">Módulo</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
            <option value="">SELECCIONAR CAPACITACIÓN...</option>
            {modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={() => { if(!cid || !mid) return; onUpdate([...assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }]); setCid(""); setMid(""); }} className="w-full lg:w-auto bg-blue-600 text-white font-black px-12 h-16 rounded-3xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Crear QR</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((a: any) => {
          const client = clients.find((c: any) => c.id === a.clientId);
          const mod = modules.find((m: any) => m.id === a.moduleId);
          if (!client || !mod) return null;
          return (
            <div key={a.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 flex flex-col shadow-xl hover:border-blue-500/30 transition-all group">
               <div className="flex-1 mb-8">
                  <div className="text-blue-500 text-[10px] font-black uppercase mb-1 tracking-widest">{client.name}</div>
                  <h3 className="text-white text-xl font-black italic uppercase leading-tight truncate">{mod.name}</h3>
               </div>
               <button onClick={() => setQrModal(a.id)} className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-black py-5 rounded-2xl uppercase text-[10px] border border-blue-600/20 transition-all">Ver QR de Acceso</button>
               {qrModal === a.id && (
                  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setQrModal(null)}>
                    <div className="bg-[#111827] p-10 rounded-[3.5rem] max-w-sm w-full border border-gray-800 shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                      <QRGenerator clientId={a.clientId} moduleId={a.moduleId} workspaceId={workspaceId} onCancel={() => setQrModal(null)} clientName={client.name} moduleName={mod.name} />
                    </div>
                  </div>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QRGenerator = ({ clientId, moduleId, workspaceId, onCancel, clientName, moduleName }: any) => {
  const [qr, setQr] = useState("");
  useEffect(() => {
    const link = `${window.location.origin}${window.location.pathname}?cid=${clientId}&mid=${moduleId}&wsid=${workspaceId}`;
    QRCode.toDataURL(link, { width: 1024, margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then(setQr);
  }, []);
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="bg-white p-5 rounded-[2.5rem] shadow-2xl border-4 border-blue-600/10"><img src={qr} className="size-64 rounded-xl" /></div>
      <div className="w-full space-y-3">
        <button onClick={() => {
          const doc = new jsPDF();
          doc.setFillColor(31, 41, 55); doc.rect(0,0,210,60,'F');
          doc.setTextColor(255,255,255); doc.setFontSize(26); doc.text("ACCESO CAPACITACIÓN", 105, 35, {align:"center"});
          doc.setTextColor(30,30,30); doc.text(moduleName, 105, 90, {align:"center"});
          doc.addImage(qr, 'PNG', 55, 110, 100, 100);
          doc.save(`Acceso_${moduleName}.pdf`);
        }} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl uppercase text-[10px] shadow-xl flex items-center justify-center gap-2"><Download size={18}/> Descargar PDF</button>
        <button onClick={onCancel} className="w-full text-slate-600 font-black uppercase text-[10px] py-2">Cerrar</button>
      </div>
    </div>
  );
};

const InstructorView = ({ instructor, onUpdate, workspaceId }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [local, setLocal] = useState(instructor);
  const [magicQR, setMagicQR] = useState("");

  const genLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?admin_ws=${workspaceId}&admin_token=${btoa(ADMIN_PASSWORD)}`;
    const qr = await QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: '#2563eb', light: '#ffffff' } });
    setMagicQR(qr);
  };

  return (
    <div className="animate-in fade-in max-w-2xl mx-auto space-y-12">
      <div className="bg-[#0d111c] p-8 md:p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl space-y-10">
        <h2 className="text-white text-3xl font-black italic uppercase">Perfil</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <input value={local.name} onChange={e => setLocal({...local, name: e.target.value.toUpperCase()})} placeholder="NOMBRE Y TÍTULO" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase focus:border-blue-500" />
          <input value={local.role} onChange={e => setLocal({...local, role: e.target.value.toUpperCase()})} placeholder="CARGO / ÁREA" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase focus:border-blue-500" />
        </div>
        <div className="bg-white rounded-[2.5rem] h-52 border-4 border-gray-800 overflow-hidden shadow-inner relative"><SignatureCanvas ref={sigRef} {...({ penColor: "blue" } as any)} canvasProps={{ className: 'w-full h-full' }} /></div>
        <div className="flex gap-3">
          <button onClick={() => sigRef.current?.clear()} className="flex-1 bg-slate-800 text-slate-500 font-black py-5 rounded-3xl uppercase text-[10px]">Borrar Pad</button>
          <button onClick={() => onUpdate({...local, signature: sigRef.current?.isEmpty() ? instructor.signature : sigRef.current?.toDataURL()})} className="flex-[2] bg-blue-600 text-white font-black py-5 rounded-3xl uppercase text-[10px] shadow-xl">Guardar</button>
        </div>
      </div>
      <div className="bg-blue-600/5 p-8 md:p-12 rounded-[3.5rem] border border-blue-500/20 text-center space-y-8">
        <Smartphone size={40} className="text-blue-500 mx-auto" />
        <h3 className="text-white text-xl font-black uppercase italic">Vincular Dispositivo Admin</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">Escanee con su tablet para heredar la sesión de administrador sin necesidad de volver a autenticar.</p>
        <button onClick={genLink} className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600/30 transition-all flex items-center justify-center gap-3 mx-auto">Vincular Ahora</button>
        {magicQR && (
          <div className="animate-in zoom-in pt-6">
            <div className="bg-white p-6 rounded-[2.5rem] inline-block shadow-2xl border-8 border-blue-500/10"><img src={magicQR} className="size-52" /></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ... Resto de componentes (ModulosView, ClientesView, UserPortal) se mantienen consistentes ...

const ModulosView = ({ modules, onUpdate }: any) => {
  const [name, setName] = useState("");
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Módulos</h2>
      <div className="flex flex-col md:flex-row gap-3 mb-12 bg-[#0d111c] p-4 rounded-3xl border border-gray-800">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="TÍTULO CAPACITACIÓN..." className="flex-1 bg-transparent text-white px-6 font-bold uppercase outline-none tracking-widest text-xs" />
        <button onClick={() => { if(!name) return; onUpdate([...modules, { id: Date.now().toString(), name: name.toUpperCase(), documents: [] }]); setName(""); }} className="bg-blue-600 text-white font-black px-12 py-5 rounded-2xl uppercase text-[10px] active:scale-95 transition-all">Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[3rem] border border-gray-800 overflow-hidden shadow-xl">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center"><h3 className="text-white font-black uppercase text-xs italic">{m.name}</h3><button onClick={() => confirm("?") && onUpdate(modules.filter((i: any) => i.id !== m.id))} className="text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></div>
             <div className="p-8"><button className="w-full py-4 border-2 border-dashed border-gray-800 rounded-2xl text-slate-800 font-black uppercase text-[10px] hover:text-blue-500 hover:border-blue-500/30 transition-all">+ Gestionar Adjuntos</button></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ClientesView = ({ clients, onUpdate }: any) => {
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Clientes</h2>
      <div className="bg-[#0d111c] p-6 md:p-10 rounded-[2.5rem] border border-gray-800 flex flex-col lg:flex-row gap-4 items-end mb-12 shadow-inner">
        <div className="flex-1 space-y-2 w-full"><label className="text-slate-600 text-[10px] font-black uppercase px-2 block">Razón Social</label><input value={n} onChange={e => setN(e.target.value)} placeholder="EMPRESA S.A." className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none text-xs" /></div>
        <div className="flex-1 space-y-2 w-full"><label className="text-slate-600 text-[10px] font-black uppercase px-2 block">CUIT</label><input value={c} onChange={e => setC(e.target.value)} placeholder="00-00000000-0" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl font-bold focus:border-blue-500 outline-none text-xs" /></div>
        <button onClick={() => { if(!n || !c) return; onUpdate([...clients, { id: Date.now().toString(), name: n.toUpperCase(), cuit: c }]); setN(""); setC(""); }} className="w-full lg:w-auto bg-blue-600 text-white font-black px-12 h-16 rounded-3xl uppercase tracking-widest text-xs active:scale-95 transition-all">Registrar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[3rem] border border-gray-800 relative shadow-xl hover:border-blue-500/30 transition-all group overflow-hidden">
            <h3 className="text-white font-black uppercase italic mb-1 text-lg group-hover:text-blue-400 truncate pr-8">{i.name}</h3>
            <p className="text-slate-500 text-[10px] font-black">CUIT: {i.cuit}</p>
            <button onClick={() => confirm("?") && onUpdate(clients.filter((cl: any) => cl.id !== i.id))} className="absolute top-8 right-8 text-slate-900 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const UserPortal = ({ clients, modules, activeParams, onSubmit, instructor, onGoHome, isSyncing }: any) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState<'id' | 'material' | 'sign'>('id');
  const [form, setForm] = useState({ name: "", dni: "" });
  const [read, setRead] = useState(false);
  const [done, setDone] = useState(false);

  const client = clients.find((c: any) => c.id === activeParams.cid);
  const mod = modules.find((m: any) => m.id === activeParams.mid);

  if (done) return (
    <div className="max-w-md mx-auto py-24 text-center animate-in zoom-in">
      <div className="bg-green-500/10 size-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20"><CheckCircle2 size={48} className="text-green-500" /></div>
      <h2 className="text-3xl font-black uppercase italic text-white mb-4 leading-none">REGISTRO<br/><span className="text-blue-500">EXITOSO</span></h2>
      <button onClick={onGoHome} className="w-full bg-slate-800 text-white font-black py-5 rounded-[2rem] uppercase tracking-widest text-xs">Cerrar</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-8 animate-in slide-in-from-bottom-8">
      <div className="text-center mb-10">
        <h2 className="text-white text-4xl font-black italic uppercase leading-none">{mod?.name || 'Cargando...'}</h2>
        <div className="mt-4 bg-blue-600/10 px-5 py-2 rounded-full border border-blue-500/20 inline-block text-blue-400 text-[10px] font-black uppercase tracking-widest">{client?.name || 'Empresa'}</div>
      </div>
      <div className="bg-[#111827] rounded-[3.5rem] border border-gray-800 p-8 shadow-2xl">
        {step === 'id' && (
          <div className="space-y-6">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} placeholder="NOMBRE Y APELLIDO" className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-5 rounded-2xl outline-none font-bold uppercase focus:border-blue-500 transition-all" />
            <input value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} placeholder="DNI" className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-5 rounded-2xl outline-none font-bold focus:border-blue-500" />
            <button onClick={() => { if(!form.name || !form.dni) return; setStep('material'); }} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl uppercase text-xs shadow-xl active:scale-95 transition-all">Siguiente</button>
          </div>
        )}
        {step === 'material' && (
          <div className="space-y-8">
            <p className="text-slate-400 text-xs font-bold uppercase text-center leading-relaxed">Revise el material pedagógico antes de firmar.</p>
            <div className="space-y-3">
              {mod?.documents?.map((d: any, idx: number) => (
                <a key={idx} href={d.url} target="_blank" rel="noopener noreferrer" onClick={() => setRead(true)} className="flex items-center justify-between bg-[#0d111c] border border-gray-800 p-5 rounded-2xl hover:border-blue-500/50 transition-all group">
                  <span className="text-slate-300 font-bold uppercase text-[10px] truncate pr-4">{d.name}</span>
                  <ExternalLink size={16} className="text-slate-600 group-hover:text-blue-500" />
                </a>
              ))}
              {!mod?.documents?.length && <div className="text-center py-6 opacity-20 italic font-black uppercase text-[10px]" onMouseEnter={() => setRead(true)}>Sin material adjunto</div>}
            </div>
            <button onClick={() => setStep('sign')} disabled={!read && !!mod?.documents?.length} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl uppercase text-xs shadow-xl disabled:opacity-30 active:scale-95 transition-all">Continuar a Firma</button>
          </div>
        )}
        {step === 'sign' && (
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] h-52 overflow-hidden border-4 border-gray-800 shadow-inner relative"><SignatureCanvas ref={sigRef} {...({ penColor: "blue" } as any)} canvasProps={{ className: 'w-full h-full' }} /></div>
            <div className="flex gap-2">
              <button onClick={() => sigRef.current?.clear()} className="flex-1 bg-slate-800 text-slate-500 font-black py-4 rounded-2xl uppercase text-[10px]">Borrar</button>
              <button onClick={async () => {
                if (!sigRef.current || sigRef.current.isEmpty()) return alert("Firme el documento");
                const rec = { id: Date.now().toString(), name: form.name, dni: form.dni, companyId: activeParams.cid!, moduleId: activeParams.mid!, timestamp: new Date().toISOString(), signature: sigRef.current.toDataURL() };
                await onSubmit(rec); setDone(true);
              }} disabled={isSyncing} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] shadow-xl">{isSyncing ? 'Enviando...' : 'Confirmar Registro'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
