
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
  Wifi,
  WifiOff
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
  WORKSPACE_ID: 'trainer_app_wsid_v4',
  AUTH: 'trainer_app_auth_v4',
  REMEMBER_ME: 'trainer_app_remember_v4'
};

const getStorage = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(key);
  if (!saved) return defaultValue;
  try {
    const parsed = JSON.parse(saved);
    return parsed ?? defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

// --- API Persistence Helpers (Automatic Cloud Sync) ---
const CLOUD_API_URL = 'https://api.restful-api.dev/objects';

const saveToCloud = async (wsid: string, state: AppState) => {
  if (!wsid) return;
  try {
    await fetch(`${CLOUD_API_URL}/${wsid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `TrainerAppWS_${wsid}`,
        data: state
      })
    });
  } catch (e) {
    console.error("Error auto-saving to cloud:", e);
  }
};

const loadFromCloud = async (wsid: string): Promise<AppState | null> => {
  if (!wsid) return null;
  try {
    const response = await fetch(`${CLOUD_API_URL}/${wsid}`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.data as AppState;
  } catch (e) {
    console.error("Error loading from cloud:", e);
    return null;
  }
};

const createNewWorkspace = async (initialState: AppState): Promise<string | null> => {
  try {
    const response = await fetch(CLOUD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `TrainerAppWS_${Date.now()}`,
        data: initialState
      })
    });
    const result = await response.json();
    return result.id;
  } catch (e) {
    console.error("Error creating workspace:", e);
    return null;
  }
};

// --- PDF Generation Helpers ---

const isValidBase64 = (str: string) => {
  if (!str || typeof str !== 'string' || str.length < 10) return false;
  return str.startsWith('data:image');
};

const generateIndividualCertificate = (record: AttendanceRecord, client: Client, module: Module, instructor: Instructor) => {
  try {
    const doc = new jsPDF();
    doc.setFillColor(31, 41, 55); 
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("Certificado de Capacitación", 15, 28);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Por medio de la presente, se certifica que", 15, 65);
    
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(record.name, 15, 80);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`con DNI N° ${record.dni}, de la empresa ${client.name} (CUIT: ${client.cuit}),`, 15, 92);
    doc.text("ha completado y aprobado la capacitación denominada:", 15, 100);
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`"${module.name}"`, 15, 115);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Realizada en la fecha ${new Date(record.timestamp).toLocaleDateString()}.`, 15, 128);

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    if (isValidBase64(record.signature)) {
      doc.addImage(record.signature, 'PNG', 15, pageHeight - 60, 60, 20);
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(15, pageHeight - 40, 75, pageHeight - 40);
    doc.setFontSize(10);
    doc.text("Firma del Asistente", 45, pageHeight - 34, { align: "center" });

    if (isValidBase64(instructor.signature)) {
      doc.addImage(instructor.signature, 'PNG', pageWidth - 75, pageHeight - 60, 60, 20);
    }
    doc.line(pageWidth - 75, pageHeight - 40, pageWidth - 15, pageHeight - 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(instructor.name || "N/A", pageWidth - 45, pageHeight - 34, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(instructor.role || "Instructor", pageWidth - 45, pageHeight - 28, { align: "center" });

    doc.save(`Certificado_${record.name.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Error al generar certificado.");
  }
};

// --- Main App Component ---

const App = () => {
  const [view, setView] = useState<'landing' | 'userForm' | 'adminLogin' | 'adminDashboard'>('landing');
  const [activeParams, setActiveParams] = useState<{cid: string | null, mid: string | null, wsid: string | null}>({ cid: null, mid: null, wsid: null });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => getStorage(STORAGE_KEYS.AUTH, false));
  const [rememberMe, setRememberMe] = useState<boolean>(() => getStorage(STORAGE_KEYS.REMEMBER_ME, false));
  const [adminTab, setAdminTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');

  // App State
  const [clients, setClients] = useState<Client[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [instructor, setInstructor] = useState<Instructor>({ name: "", role: "", signature: "" });
  const [workspaceId, setWorkspaceId] = useState<string>(() => getStorage(STORAGE_KEYS.WORKSPACE_ID, ""));

  // UI States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const getBaseUrl = () => {
    return window.location.origin + window.location.pathname;
  };

  const handleScanSimulation = useCallback((cid: string, mid: string, wsid: string) => {
    const baseUrl = getBaseUrl();
    const newUrl = `${baseUrl}?cid=${cid}&mid=${mid}&wsid=${wsid}`;
    setActiveParams({ cid, mid, wsid });
    setView('userForm');
    window.history.pushState({ cid, mid, wsid }, '', newUrl);
    window.scrollTo(0, 0);
  }, []);

  const handleGoHome = useCallback(() => {
    const baseUrl = getBaseUrl();
    window.history.pushState({}, '', baseUrl);
    setActiveParams({ cid: null, mid: null, wsid: null });
    setView(isAdminAuthenticated ? 'adminDashboard' : 'landing');
  }, [isAdminAuthenticated]);

  // Initial Sync from URL or Cloud
  useEffect(() => {
    const syncFromUrl = async () => {
      const p = new URLSearchParams(window.location.search);
      const cid = p.get('cid');
      const mid = p.get('mid');
      const wsid = p.get('wsid');
      
      if (wsid) {
        setIsSyncing(true);
        const cloudData = await loadFromCloud(wsid);
        if (cloudData) {
          setClients(cloudData.clients);
          setModules(cloudData.modules);
          setAssignments(cloudData.assignments);
          setRecords(cloudData.records);
          setInstructor(cloudData.instructor);
          setWorkspaceId(wsid);
        }
        setIsSyncing(false);
      }

      if (cid && mid && wsid) {
        setActiveParams({ cid, mid, wsid });
        setView('userForm');
      }
    };
    syncFromUrl();
  }, []);

  // Workspace Auto-Loading for Admin
  useEffect(() => {
    if (isAdminAuthenticated && workspaceId && clients.length === 0) {
      setIsSyncing(true);
      loadFromCloud(workspaceId).then(data => {
        if (data) {
          setClients(data.clients);
          setModules(data.modules);
          setAssignments(data.assignments);
          setRecords(data.records);
          setInstructor(data.instructor);
          setLastSaved(new Date());
        }
        setIsSyncing(false);
      });
    }
  }, [isAdminAuthenticated, workspaceId]);

  // Automatic Cloud Persistence (Debounced)
  const saveTimeout = useRef<any>(null);
  useEffect(() => {
    if (isAdminAuthenticated && workspaceId) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const state: AppState = { clients, modules, assignments, records, instructor };
        setIsSyncing(true);
        saveToCloud(workspaceId, state).then(() => {
          setLastSaved(new Date());
          setIsSyncing(false);
        });
      }, 1500); // 1.5s debounce
    }

    // Local Storage Backup
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(isAdminAuthenticated));
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, JSON.stringify(workspaceId));
    }
  }, [clients, modules, assignments, records, instructor, workspaceId, isAdminAuthenticated, rememberMe]);

  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginWorkspace, setLoginWorkspace] = useState(workspaceId);

  const handleAdminAuth = async () => {
    if (loginPassword === ADMIN_PASSWORD) {
      if (!loginWorkspace) {
        // Create new workspace if none provided
        setIsSyncing(true);
        const newId = await createNewWorkspace({ clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } });
        if (newId) {
          setWorkspaceId(newId);
          setLoginWorkspace(newId);
          setIsAdminAuthenticated(true);
          setView('adminDashboard');
        } else {
          alert("Error al inicializar espacio en la nube.");
        }
        setIsSyncing(false);
      } else {
        // Load existing workspace
        setIsSyncing(true);
        const data = await loadFromCloud(loginWorkspace);
        if (data) {
          setClients(data.clients);
          setModules(data.modules);
          setAssignments(data.assignments);
          setRecords(data.records);
          setInstructor(data.instructor);
          setWorkspaceId(loginWorkspace);
          setIsAdminAuthenticated(true);
          setView('adminDashboard');
        } else {
          alert("El ID de Espacio no existe.");
        }
        setIsSyncing(false);
      }
    } else {
      alert("Contraseña incorrecta.");
    }
  };

  return (
    <div className="font-sans text-slate-200 antialiased bg-[#060912] min-h-screen selection:bg-blue-600 selection:text-white">
      <Navbar 
        isAdminAuthenticated={isAdminAuthenticated} 
        onLogout={() => { setIsAdminAuthenticated(false); setRememberMe(false); setWorkspaceId(""); handleGoHome(); }} 
        onGoHome={handleGoHome} 
        onLoginClick={() => setView('adminLogin')} 
        isSyncing={isSyncing}
        lastSaved={lastSaved}
      />

      <main className="pt-20">
        {view === 'landing' && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
            <div className="mb-12 text-center">
              <h1 className="text-white text-7xl md:text-9xl font-black italic tracking-tighter uppercase leading-none mb-4">TRAINER<br/><span className="text-blue-600">APP</span></h1>
              <p className="text-slate-500 font-bold tracking-[0.5em] uppercase text-xs md:text-sm italic">Sincronización Automática Cloud</p>
            </div>
            <div className="max-w-md w-full bg-[#111827] p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl">
               <div className="flex items-center gap-4 mb-6">
                 <div className="bg-blue-600 p-3 rounded-2xl"><ScanLine className="text-white" /></div>
                 <h3 className="text-white text-xl font-black uppercase italic">Escanear para comenzar</h3>
               </div>
               <p className="text-slate-400 text-sm mb-6 leading-relaxed">Escanee el código QR proporcionado por su instructor. Todos sus documentos y progresos se sincronizan automáticamente.</p>
               <QRSimulator assignments={assignments} clients={clients} modules={modules} onScan={handleScanSimulation} workspaceId={workspaceId} />
            </div>
          </div>
        )}

        {view === 'adminLogin' && (
          <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="bg-[#111827] p-10 rounded-[3rem] border border-gray-800 w-full max-w-md shadow-2xl text-center animate-in zoom-in duration-300">
              <ShieldCheck size={48} className="text-blue-500 mx-auto mb-6" />
              <h2 className="text-white text-2xl font-black italic mb-8 uppercase">Gestión de Workspace</h2>
              
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="CONTRASEÑA ADMIN" 
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full bg-[#0d111c] border border-blue-500/20 text-white px-6 py-5 rounded-2xl outline-none font-bold text-center tracking-widest focus:border-blue-500 transition-all" 
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 p-2">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest px-2">ID de Espacio (Opcional si es nuevo)</label>
                  <input 
                    type="text" 
                    placeholder="Escriba su ID para sincronizar..." 
                    value={loginWorkspace}
                    onChange={e => setLoginWorkspace(e.target.value)}
                    className="w-full bg-[#0d111c] border border-gray-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-center text-xs focus:border-blue-500 transition-all" 
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-8 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`size-5 rounded-md border-2 transition-all flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-700'}`}>
                  {rememberMe && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest group-hover:text-slate-300">Persistir Sesión</span>
              </div>

              <button 
                onClick={handleAdminAuth}
                disabled={isSyncing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <Globe size={16} />}
                Ingresar al Sistema
              </button>
            </div>
          </div>
        )}

        {view === 'adminDashboard' && (
          <div className="min-h-screen px-4 md:px-8 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-white text-4xl font-black italic uppercase tracking-tighter">Panel <span className="text-blue-600">Pro</span></h1>
                    <div className="bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-2">
                       <span className="size-2 bg-blue-500 rounded-full animate-pulse" />
                       <span className="text-blue-400 font-mono text-[9px] font-bold">WS: {workspaceId}</span>
                    </div>
                 </div>
                 <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                    <CloudLightning size={12} /> Sincronizado automáticamente en la nube
                 </p>
               </div>
               <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-gray-800 overflow-x-auto no-scrollbar shadow-lg">
                {[
                  { id: 'asistencias', label: 'Reportes', icon: Users },
                  { id: 'asignaciones', label: 'QR', icon: Layers },
                  { id: 'modulos', label: 'Módulos', icon: BookOpen },
                  { id: 'clientes', label: 'Clientes', icon: FileText },
                  { id: 'instructor', label: 'Instructor', icon: UserCircle }
                ].map(t => (
                  <button key={t.id} onClick={() => setAdminTab(t.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${adminTab === t.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#111827] rounded-[3rem] border border-gray-800 p-6 md:p-10 min-h-[600px] shadow-2xl relative">
               {adminTab === 'asistencias' && <AsistenciasView records={records} setRecords={setRecords} clients={clients} modules={modules} instructor={instructor} />}
               {adminTab === 'asignaciones' && <AsignacionesView clients={clients} modules={modules} assignments={assignments} setAssignments={setAssignments} onSimulate={handleScanSimulation} getBaseUrl={getBaseUrl} workspaceId={workspaceId} />}
               {adminTab === 'modulos' && <ModulosView modules={modules} setModules={setModules} />}
               {adminTab === 'clientes' && <ClientesView clients={clients} setClients={setClients} />}
               {adminTab === 'instructor' && <InstructorView instructor={instructor} setInstructor={setInstructor} />}
            </div>
          </div>
        )}

        {view === 'userForm' && <UserPortal clients={clients} modules={modules} activeParams={activeParams} onGoHome={handleGoHome} setRecords={setRecords} instructor={instructor} isSyncing={isSyncing} />}
      </main>
    </div>
  );
};

// --- Components ---

const Navbar = ({ isAdminAuthenticated, onLogout, onGoHome, onLoginClick, isSyncing, lastSaved }: any) => (
  <nav className="flex items-center justify-between px-6 py-4 bg-[#0a1120]/80 border-b border-gray-800 fixed top-0 w-full z-50 backdrop-blur-md">
    <div className="flex items-center gap-2 cursor-pointer group" onClick={onGoHome}>
      <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
        <BookOpen className="text-white size-5" />
      </div>
      <span className="text-white font-black italic tracking-tighter text-xl uppercase">TRAINER<span className="text-blue-600">APP</span></span>
    </div>
    
    <div className="flex items-center gap-6">
      <div className="hidden sm:flex items-center gap-2">
        {isSyncing ? (
          <div className="flex items-center gap-2 text-blue-500 font-black uppercase text-[9px] tracking-widest">
            <RefreshCw size={12} className="animate-spin" /> Guardando...
          </div>
        ) : lastSaved ? (
          <div className="flex items-center gap-2 text-slate-500 font-black uppercase text-[9px] tracking-widest">
            <CheckCircle2 size={12} className="text-green-500" /> Al día
          </div>
        ) : null}
      </div>

      {isAdminAuthenticated ? (
        <button onClick={onLogout} className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all">
          <LogOut size={14} /> Salir
        </button>
      ) : (
        <button onClick={onLoginClick} className="bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-800 transition-all">
          Admin
        </button>
      )}
    </div>
  </nav>
);

const AsistenciasView = ({ records, setRecords, clients, modules, instructor }: any) => {
  const [sel, setSel] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState("");
  const [filterModule, setFilterModule] = useState("");

  const filteredRecords = useMemo(() => {
    return records.filter((r: any) => {
      const matchClient = !filterClient || r.companyId === filterClient;
      const matchModule = !filterModule || r.moduleId === filterModule;
      return matchClient && matchModule;
    });
  }, [records, filterClient, filterModule]);

  const handleGenerateReport = () => {
    const finalData = filteredRecords.filter((r: any) => sel.includes(r.id));
    if (finalData.length === 0) return alert("Seleccione registros.");
    
    try {
      const doc = new jsPDF();
      const first = finalData[0];
      const client = clients.find((c: any) => c.id === first.companyId);
      const mod = modules.find((m: any) => m.id === first.moduleId);

      doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text("REGISTRO DE CAPACITACIÓN", 15, 25);

      doc.setTextColor(30, 30, 30); doc.setFontSize(14);
      doc.text("Detalles de la sesión:", 15, 55);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Empresa: ${client?.name || 'Múltiples'} (CUIT: ${client?.cuit || 'N/A'})`, 15, 63);
      doc.text(`Tema: ${mod?.name || 'Múltiples'}`, 15, 69);
      doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 15, 75);

      const tableRows = finalData.map((r: any) => [r.name, r.dni, '']);

      autoTable(doc, {
        startY: 85,
        head: [['Apellido y Nombre', 'DNI', 'Firma']],
        body: tableRows,
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, valign: 'middle', halign: 'center', cellPadding: 5 },
        columnStyles: { 2: { cellWidth: 45 } },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const record = finalData[data.row.index];
            if (isValidBase64(record.signature)) {
              doc.addImage(record.signature, 'PNG', data.cell.x + 5, data.cell.y + 1, 35, 8);
            }
          }
        }
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const signatureBottomY = pageHeight - 40;
      const signatureRightX = pageWidth - 80;

      if (isValidBase64(instructor.signature)) {
        doc.addImage(instructor.signature, 'PNG', signatureRightX + 5, signatureBottomY - 22, 60, 20);
      }
      doc.setDrawColor(180, 180, 180);
      doc.line(signatureRightX, signatureBottomY, pageWidth - 15, signatureBottomY);
      doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      doc.text("Firma del Instructor Responsable", signatureRightX + 32, signatureBottomY + 6, { align: "center" });
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
      doc.text(instructor.name || "Instructor", signatureRightX + 32, signatureBottomY + 12, { align: "center" });

      doc.save(`Reporte_Trainer_${Date.now()}.pdf`);
    } catch (error) {
      alert("Error al generar PDF.");
    }
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-white text-3xl font-black italic uppercase">Asistencias</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Sincronizado Cloud</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => confirm("¿Eliminar registros seleccionados?") && (setRecords(records.filter((r: any) => !sel.includes(r.id))), setSel([]))} disabled={sel.length === 0} className="bg-red-600/10 text-red-500 px-5 py-3 rounded-2xl font-bold uppercase text-[10px] border border-red-500/20 disabled:opacity-30">
            <Trash2 size={14}/> Borrar Selección
          </button>
          <button onClick={handleGenerateReport} disabled={sel.length === 0} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold uppercase text-[10px] shadow-xl flex items-center gap-2 disabled:opacity-30">
            <Download size={14}/> Generar Reporte ({sel.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-[#0d111c] p-4 rounded-3xl border border-gray-800 shadow-inner">
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
          <option value="">TODAS LAS EMPRESAS</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)} className="bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
          <option value="">TODOS LOS MÓDULOS</option>
          {modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-gray-800 bg-[#0d111c]">
        <table className="w-full text-left">
          <thead className="bg-[#161e2e] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-800">
            <tr>
              <th className="px-6 py-5 w-12 text-center">
                <input type="checkbox" checked={filteredRecords.length > 0 && sel.length === filteredRecords.length} 
                  onChange={e => setSel(e.target.checked ? filteredRecords.map((r: any) => r.id) : [])} className="size-4 rounded border-gray-700 bg-gray-800 text-blue-600" />
              </th>
              <th className="px-6 py-5">Colaborador</th>
              <th className="px-6 py-5">Capacitación</th>
              <th className="px-6 py-5 text-center">Firma</th>
              <th className="px-6 py-5 text-center w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-600 font-black uppercase text-sm italic opacity-40 tracking-widest">No hay registros cargados</td></tr>
            ) : filteredRecords.map((r: any) => (
              <tr key={r.id} className={`hover:bg-slate-800/30 transition-all cursor-pointer ${sel.includes(r.id) ? 'bg-blue-600/5' : ''}`} onClick={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])}>
                <td className="px-6 py-6 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel(s => s.includes(r.id) ? s.filter(i => i !== r.id) : [...s, r.id])} className="size-5 rounded border-gray-700 bg-gray-800 text-blue-600" /></td>
                <td className="px-6 py-6 font-bold text-white uppercase text-sm">{r.name}<div className="text-[10px] text-slate-600 font-bold mt-1">DNI: {r.dni}</div></td>
                <td className="px-6 py-6 text-[10px] uppercase font-black text-blue-500">{modules.find((m: any) => m.id === r.moduleId)?.name}<div className="text-slate-500 font-bold mt-1">{clients.find((c: any) => c.id === r.companyId)?.name}</div></td>
                <td className="px-6 py-6 text-center"><div className="bg-white p-1 rounded-xl h-10 w-28 overflow-hidden inline-block shadow-inner"><img src={r.signature} className="h-full w-full object-contain" /></div></td>
                <td className="px-6 py-6 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => confirm("Eliminar registro?") && setRecords(records.filter((rec: any) => rec.id !== r.id))} className="p-3 text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const QRSimulator = ({ assignments, clients, modules, onScan, workspaceId }: any) => {
  return (
    <div className="space-y-3">
      {assignments.length > 0 ? assignments.map((a: any) => {
        const client = clients.find((c: any) => c.id === a.clientId);
        const mod = modules.find((m: any) => m.id === a.moduleId);
        if (!client || !mod) return null;
        return (
          <button key={a.id} onClick={() => onScan(a.clientId, a.moduleId, workspaceId)} className="w-full bg-slate-800/50 hover:bg-blue-600/20 text-left p-5 rounded-3xl border border-slate-700 hover:border-blue-500/50 transition-all group flex items-center justify-between">
            <div className="overflow-hidden">
              <div className="text-[10px] text-blue-500 font-black uppercase mb-1 tracking-widest">{client.name}</div>
              <div className="text-white font-bold text-sm uppercase italic truncate">{mod.name}</div>
            </div>
            <ChevronRight size={18} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
          </button>
        );
      }) : (
        <div className="text-center py-6 opacity-30 italic font-bold uppercase text-[10px] tracking-widest border-2 border-dashed border-gray-800 rounded-3xl">No hay capacitaciones activas</div>
      )}
    </div>
  );
};

const UserPortal = ({ clients, modules, activeParams, onGoHome, setRecords, instructor, isSyncing }: any) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [step, setStep] = useState<'identity' | 'material' | 'signature'>('identity');
  const [formData, setFormData] = useState({ name: '', dni: '' });
  const [viewedDocs, setViewedDocs] = useState<Set<number>>(new Set());
  const [lastRecord, setLastRecord] = useState<AttendanceRecord | null>(null);

  const activeClient = useMemo(() => clients.find((c: any) => c.id === activeParams.cid), [clients, activeParams.cid]);
  const activeModule = useMemo(() => modules.find((m: any) => m.id === activeParams.mid), [modules, activeParams.mid]);

  const allDocsRead = useMemo(() => {
    if (!activeModule?.documents?.length) return true;
    return viewedDocs.size >= activeModule.documents.length;
  }, [viewedDocs, activeModule]);

  useEffect(() => {
    if (lastRecord) {
      const timer = setTimeout(onGoHome, 15000);
      return () => clearTimeout(timer);
    }
  }, [lastRecord, onGoHome]);

  if (isSyncing && clients.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-in fade-in">
        <RefreshCw size={64} className="text-blue-500 mx-auto mb-6 animate-spin" />
        <h2 className="text-2xl font-black uppercase italic text-white mb-2">Sincronizando...</h2>
        <p className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Cargando material de capacitación</p>
      </div>
    );
  }

  if (!activeClient || !activeModule) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-in fade-in">
        <AlertCircle size={64} className="text-amber-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black uppercase italic text-white mb-4">Enlace no Encontrado</h2>
        <p className="text-slate-500 mb-8 font-bold text-sm">Este QR no pertenece a un espacio de trabajo válido o está expirado.</p>
        <button onClick={onGoHome} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs">Ir al Inicio</button>
      </div>
    );
  }

  if (lastRecord) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center animate-in zoom-in duration-300">
        <div className="bg-green-500/10 size-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20">
          <CheckCircle2 size={48} className="text-green-500" />
        </div>
        <h2 className="text-3xl font-black uppercase italic text-white mb-2 leading-none">REGISTRO<br/><span className="text-blue-500">EXITOSO</span></h2>
        <p className="text-slate-500 font-bold mb-8 text-xs tracking-widest uppercase">Asistencia confirmada y sincronizada</p>
        <button onClick={() => generateIndividualCertificate(lastRecord, activeClient, activeModule, instructor)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl uppercase text-xs flex items-center justify-center gap-3 transition-all">
          <Download size={18} /> Descargar Certificado
        </button>
        <button onClick={onGoHome} className="mt-4 text-slate-600 font-black uppercase text-[10px] tracking-widest">Cerrar</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 md:px-6 pb-20 animate-in slide-in-from-bottom-8">
      <div className="text-center mb-8">
        <div className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Portal Sincronizado</div>
        <h2 className="text-white text-3xl font-black italic uppercase leading-none">{activeModule.name}</h2>
        <div className="mt-3 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-500/20 inline-block">
          <span className="text-blue-400 font-black uppercase text-[9px] tracking-widest">{activeClient.name}</span>
        </div>
      </div>

      <div className="bg-[#111827] rounded-[3rem] border border-gray-800 shadow-2xl overflow-hidden p-8">
        {step === 'identity' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-600 font-black uppercase px-2">Nombre Completo</label>
                <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="ESCRIBA AQUÍ..." className="w-full bg-[#0d111c] border border-gray-800 focus:border-blue-500 text-white px-5 py-4 rounded-2xl outline-none font-bold transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-600 font-black uppercase px-2">DNI / Documento</label>
                <input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="SÓLO NÚMEROS..." className="w-full bg-[#0d111c] border border-gray-800 focus:border-blue-500 text-white px-5 py-4 rounded-2xl outline-none font-bold transition-all" />
              </div>
            </div>
            <button onClick={() => { if(!formData.name || !formData.dni) return alert("Complete los datos."); setStep('material'); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Siguiente Paso</button>
          </div>
        )}

        {step === 'material' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="text-center px-4">
               <BookOpen size={40} className="text-blue-500 mx-auto mb-4" />
               <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase">Revise el material pedagógico oficial antes de confirmar su firma.</p>
             </div>
             <div className="space-y-3">
               {activeModule.documents?.map((doc, idx) => (
                 <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" onClick={() => setViewedDocs(prev => new Set(prev).add(idx))}
                   className={`flex items-center justify-between w-full p-5 rounded-2xl border font-bold text-[10px] uppercase transition-all ${viewedDocs.has(idx) ? 'bg-blue-600/10 border-blue-600/40 text-blue-400' : 'bg-[#0d111c] border-gray-800 text-slate-300 hover:border-blue-500/50'}`}>
                   <span className="truncate pr-4">{doc.name}</span>
                   {viewedDocs.has(idx) ? <CheckCircle2 size={16} /> : <ExternalLink size={16} className="opacity-40" />}
                 </a>
               ))}
               {!activeModule.documents?.length && <div className="text-center py-6 opacity-20 italic font-black uppercase text-[10px]">Sin material cargado</div>}
             </div>
             <button onClick={() => setStep('signature')} disabled={!allDocsRead} className={`w-full font-black py-5 rounded-3xl uppercase tracking-widest text-xs transition-all shadow-xl ${allDocsRead ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'}`}>
               Proceder a la Firma
             </button>
          </div>
        )}

        {step === 'signature' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="text-center px-4">
               <h3 className="text-white text-xl font-black uppercase italic mb-2">Firma Digital</h3>
               <p className="text-slate-500 text-[9px] uppercase font-black leading-tight">Su firma se guardará en el servidor central de capacitación.</p>
             </div>
             <div className="bg-white rounded-[2rem] h-60 overflow-hidden border-4 border-gray-800 shadow-inner cursor-crosshair">
                {/* @ts-ignore */}
                <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-full' }} />
             </div>
             <div className="flex gap-2">
               <button onClick={() => sigCanvas.current?.clear()} className="flex-1 bg-slate-800 text-slate-400 font-bold py-4 rounded-2xl uppercase text-[10px] tracking-widest">Limpiar</button>
               <button onClick={() => {
                 if (!sigCanvas.current || sigCanvas.current.isEmpty()) return alert("Firme el documento.");
                 const record = {
                   id: Date.now().toString(),
                   name: formData.name,
                   dni: formData.dni,
                   companyId: activeParams.cid!,
                   moduleId: activeParams.mid!,
                   timestamp: new Date().toISOString(),
                   signature: sigCanvas.current.toDataURL()
                 };
                 setRecords((prev: any) => [record, ...prev]);
                 setLastRecord(record);
               }} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl transition-all">Confirmar Firma</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AsignacionesView = ({ clients, modules, assignments, setAssignments, onSimulate, getBaseUrl, workspaceId }: any) => {
  const [cid, setCid] = useState("");
  const [mid, setMid] = useState("");
  const [qrModal, setQrModal] = useState<string | null>(null);

  const handleCreate = () => {
    if(!cid || !mid) return alert("Seleccione datos.");
    setAssignments([...assignments, { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }]);
    setCid(""); setMid("");
  };

  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10">Vínculos QR</h2>
      <div className="bg-[#0d111c] p-6 md:p-8 rounded-[2.5rem] border border-gray-800 flex flex-wrap gap-4 items-end mb-12 shadow-inner">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest">Empresa Cliente</label>
          <select value={cid} onChange={e => setCid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
            <option value="">ELIJA CLIENTE...</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-slate-600 text-[10px] font-black uppercase px-2 tracking-widest">Módulo</label>
          <select value={mid} onChange={e => setMid(e.target.value)} className="w-full bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase text-xs focus:border-blue-500 outline-none">
            <option value="">ELIJA MÓDULO...</option>
            {modules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 h-14 rounded-2xl uppercase tracking-widest text-[11px] shadow-lg transition-all">Vincular</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((a: any) => {
          const client = clients.find((c: any) => c.id === a.clientId);
          const mod = modules.find((m: any) => m.id === a.moduleId);
          if(!client || !mod) return null;
          return (
            <div key={a.id} className="bg-[#0d111c] p-8 rounded-[2.5rem] border border-gray-800 flex flex-col hover:border-blue-500/50 transition-all shadow-xl group">
               <div className="flex-1 mb-6">
                  <div className="text-blue-500 text-[10px] font-black uppercase mb-1 tracking-widest">{client.name}</div>
                  <h3 className="text-white text-xl font-black italic uppercase leading-tight">{mod.name}</h3>
               </div>
               <div className="flex flex-col gap-2">
                  <button onClick={() => setQrModal(a.id)} className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-bold py-3.5 rounded-xl uppercase text-[10px] border border-blue-600/30 transition-all">Generar QR Sincronizado</button>
                  <button onClick={() => onSimulate(a.clientId, a.moduleId, workspaceId)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3.5 rounded-xl uppercase text-[10px] transition-all">Vista Previa</button>
                  <button onClick={() => confirm("¿Eliminar vínculo?") && setAssignments(assignments.filter((i: any) => i.id !== a.id))} className="text-red-500/30 hover:text-red-500 text-[9px] font-black uppercase mt-3 tracking-widest transition-colors">Eliminar</button>
               </div>
               {qrModal === a.id && (
                  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setQrModal(null)}>
                    <div className="bg-[#111827] p-8 rounded-[2.5rem] max-w-sm w-full border border-gray-800 shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                      <QRGenerator clientId={a.clientId} moduleId={a.moduleId} getBaseUrl={getBaseUrl} onCancel={() => setQrModal(null)} clientName={client.name} moduleName={mod.name} workspaceId={workspaceId} />
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

const QRGenerator = ({ clientId, moduleId, getBaseUrl, onCancel, clientName, moduleName, workspaceId }: any) => {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const assignmentUrl = useMemo(() => {
    const base = getBaseUrl();
    return `${base}?cid=${clientId}&mid=${moduleId}&wsid=${workspaceId}`;
  }, [clientId, moduleId, getBaseUrl, workspaceId]);

  useEffect(() => {
    QRCode.toDataURL(assignmentUrl, { 
      width: 1024, margin: 1, color: { dark: '#000000', light: '#ffffff' } 
    }).then(setQrDataUrl).catch(console.error);
  }, [assignmentUrl]);

  const downloadProfessionalPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      doc.setFillColor(31, 41, 55); 
      doc.rect(0, 0, pageWidth, 60, 'F');
      doc.setFillColor(59, 130, 246); 
      doc.rect(0, 58, pageWidth, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont("helvetica", "bold");
      doc.text("ACCESO CAPACITACIÓN", pageWidth / 2, 35, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 200, 200);
      doc.text("SISTEMA SINCRONIZADO TRAINERAPP PRO", pageWidth / 2, 45, { align: "center" });
      
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(moduleName, pageWidth / 2, 90, { align: "center" });
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Empresa: ${clientName}`, pageWidth / 2, 100, { align: "center" });

      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(1.5);
      doc.roundedRect(pageWidth / 2 - 55, 120, 110, 110, 5, 5, 'D');

      if(qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', pageWidth / 2 - 50, 125, 100, 100);
      }

      doc.setFillColor(31, 41, 55);
      doc.roundedRect(pageWidth / 2 - 80, 245, 160, 22, 11, 11, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ESCANEÉ EL CÓDIGO PARA REGISTRAR ASISTENCIA", pageWidth / 2, 259, { align: "center" });
      
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("ID Espacio: " + workspaceId, pageWidth / 2, 280, { align: "center" });

      doc.save(`QR_Oficial_${moduleName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Error al generar PDF.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="bg-white/95 p-6 rounded-[2.5rem] shadow-2xl border-8 border-blue-600/5">
        {qrDataUrl ? (
          <img src={qrDataUrl} className="size-64 object-contain rounded-xl" alt="QR" />
        ) : (
          <div className="size-64 flex items-center justify-center animate-pulse text-slate-800 font-black">Cargando...</div>
        )}
      </div>
      
      <div className="w-full flex flex-col gap-3">
        <button onClick={downloadProfessionalPDF} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all">
          <Download size={18}/> Descargar PDF QR Oficial
        </button>
        <button onClick={() => { navigator.clipboard.writeText(assignmentUrl); alert("URL copiada."); }} className="w-full bg-[#1e293b] text-slate-300 font-black py-4 rounded-2xl uppercase text-[10px] border border-slate-700 flex items-center justify-center gap-2">
          <Copy size={16}/> Copiar Enlace Directo
        </button>
        <button onClick={onCancel} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl uppercase text-[10px]">Cerrar</button>
      </div>
    </div>
  );
};

const ModulosView = ({ modules, setModules }: any) => {
  const [name, setName] = useState("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [activeMod, setActiveMod] = useState<string | null>(null);

  const handleAddModule = () => {
    if(!name) return;
    setModules([...modules, { id: Date.now().toString(), name: name.toUpperCase(), documents: [] }]);
    setName("");
  };

  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10 tracking-tight">Módulos</h2>
      <div className="flex gap-3 mb-12 bg-[#0d111c] p-4 rounded-[2rem] border border-gray-800 shadow-inner">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="TÍTULO DEL MÓDULO..." className="flex-1 bg-transparent text-white px-4 font-bold uppercase outline-none placeholder:text-slate-700 tracking-widest text-xs" />
        <button onClick={handleAddModule} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-4 rounded-2xl uppercase text-[10px] shadow-lg transition-all">Crear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((m: any) => (
          <div key={m.id} className="bg-[#0d111c] rounded-[2.5rem] border border-gray-800 overflow-hidden flex flex-col shadow-xl group hover:border-blue-500/20 transition-all">
             <div className="bg-[#161e2e] p-6 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-white font-black uppercase text-xs italic tracking-widest truncate pr-4">{m.name}</h3>
                <button onClick={() => confirm("Eliminar?") && setModules(modules.filter((i: any) => i.id !== m.id))} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
             </div>
             <div className="p-8 space-y-4">
                <div className="space-y-2">
                  {m.documents?.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-[#111827] p-3 rounded-xl border border-gray-800 group">
                      <span className="text-slate-300 font-bold uppercase text-[10px] truncate max-w-[200px]">{d.name}</span>
                      <button onClick={() => setModules(modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: mod.documents.filter((_: any, idx: number) => idx !== i) } : mod))} className="text-red-500/20 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  ))}
                  {!m.documents?.length && <div className="text-center py-4 text-slate-800 text-[9px] uppercase font-black tracking-widest italic opacity-50">Sin material</div>}
                </div>
                {activeMod === m.id ? (
                  <div className="bg-[#111827] p-5 rounded-[2rem] space-y-3 border border-blue-500/20 animate-in zoom-in duration-200">
                    <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NOMBRE" className="w-full bg-[#0d111c] border border-gray-800 p-4 rounded-xl text-[10px] text-white font-bold uppercase outline-none focus:border-blue-500 transition-colors" />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL (DRIVE/PDF)" className="w-full bg-[#0d111c] border border-gray-800 p-4 rounded-xl text-[10px] text-blue-400 font-bold outline-none focus:border-blue-500 transition-colors" />
                    <button onClick={() => { if(!docName || !docUrl) return; setModules(modules.map((mod: any) => mod.id === m.id ? { ...mod, documents: [...mod.documents, { name: docName.toUpperCase(), url: docUrl }] } : mod)); setDocName(""); setDocUrl(""); setActiveMod(null); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95">Guardar</button>
                    <button onClick={() => setActiveMod(null)} className="w-full text-slate-600 text-[9px] font-black uppercase tracking-widest text-center">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setActiveMod(m.id)} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-2xl text-slate-700 font-black uppercase text-[10px] tracking-widest hover:text-blue-500 hover:border-blue-500/30 transition-all">+ Gestionar Material</button>
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ClientesView = ({ clients, setClients }: any) => {
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const handleAdd = () => {
    if(!n || !c) return alert("Datos requeridos.");
    setClients([...clients, { id: Date.now().toString(), name: n.toUpperCase(), cuit: c }]);
    setN(""); setC("");
  };
  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10 tracking-tight">Clientes</h2>
      <div className="bg-[#0d111c] p-6 md:p-8 rounded-[2.5rem] border border-gray-800 flex flex-wrap gap-4 items-end mb-12 shadow-inner">
        <div className="flex-1 min-w-[200px] space-y-2"><label className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-2">Razón Social</label><input value={n} onChange={e => setN(e.target.value)} placeholder="EMPRESA..." className="w-full bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none transition-colors" /></div>
        <div className="flex-1 min-w-[200px] space-y-2"><label className="text-slate-600 text-[10px] font-black uppercase tracking-widest px-2">CUIT</label><input value={c} onChange={e => setC(e.target.value)} placeholder="NUMERO..." className="w-full bg-[#111827] border border-gray-800 text-white p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-colors" /></div>
        <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 h-14 rounded-2xl uppercase tracking-widest text-[11px] shadow-lg transition-all">Registrar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((i: any) => (
          <div key={i.id} className="bg-[#0d111c] p-8 rounded-[2.5rem] border border-gray-800 relative shadow-xl hover:border-blue-500/30 transition-all group overflow-hidden">
            <h3 className="text-white font-black uppercase italic mb-1 text-lg group-hover:text-blue-400 transition-colors tracking-tighter leading-tight">{i.name}</h3>
            <p className="text-slate-500 text-[10px] font-black tracking-[0.2em] mb-4">CUIT: {i.cuit}</p>
            <button onClick={() => confirm("Eliminar?") && setClients(clients.filter((cl: any) => cl.id !== i.id))} className="absolute top-8 right-8 text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const InstructorView = ({ instructor, setInstructor }: any) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [localInstructor, setLocalInstructor] = useState(instructor);
  
  useEffect(() => {
    setLocalInstructor(instructor);
  }, [instructor]);

  const handleSave = () => {
    const canvasEmpty = sigCanvas.current?.isEmpty();
    const newSignature = !canvasEmpty ? sigCanvas.current?.toDataURL() : instructor.signature;
    setInstructor({...localInstructor, signature: newSignature}); 
    alert("Perfil guardado y sincronizado.");
  };

  return (
    <div className="animate-in fade-in">
      <h2 className="text-white text-3xl font-black italic uppercase mb-10 tracking-tight">Perfil del Instructor</h2>
      <div className="max-w-xl mx-auto bg-[#0d111c] p-10 rounded-[3rem] border border-gray-800 shadow-2xl space-y-8">
        <div className="space-y-5">
          <div className="space-y-1">
             <label className="text-[10px] text-slate-600 font-black uppercase px-2 tracking-widest">Nombre Completo</label>
             <input value={localInstructor.name} onChange={e => setLocalInstructor({...localInstructor, name: e.target.value.toUpperCase()})} placeholder="NOMBRE" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl outline-none font-bold uppercase focus:border-blue-500 transition-all" />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] text-slate-600 font-black uppercase px-2 tracking-widest">Cargo Profesional</label>
             <input value={localInstructor.role} onChange={e => setLocalInstructor({...localInstructor, role: e.target.value.toUpperCase()})} placeholder="PUESTO / TÍTULO" className="w-full bg-[#111827] border border-gray-800 text-white p-5 rounded-2xl outline-none font-bold uppercase focus:border-blue-500 transition-all" />
          </div>
        </div>
        
        <div className="space-y-3">
          <label className="text-[10px] text-slate-600 font-black uppercase px-2 flex justify-between tracking-widest">Firma Digital</label>
          <div className="bg-white rounded-[2rem] h-52 border-4 border-gray-800 overflow-hidden shadow-inner cursor-crosshair">
             {/* @ts-ignore */}
             <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-full' }} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => sigCanvas.current?.clear()} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black py-5 rounded-3xl uppercase text-[10px] tracking-widest transition-all">Borrar Pad</button>
          <button onClick={handleSave} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl uppercase text-[10px] tracking-widest shadow-xl transition-all">Guardar Cambios</button>
        </div>
        
        {instructor.signature && (
          <div className="mt-10 pt-10 border-t border-gray-800/50 text-center">
            <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest mb-4">Firma actual en la nube:</p>
            <div className="bg-white p-4 rounded-[2rem] h-28 w-48 mx-auto overflow-hidden shadow-md flex items-center justify-center">
              <img src={instructor.signature} className="h-full w-full object-contain" alt="Instructor Signature" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
