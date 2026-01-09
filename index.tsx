
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { 
  ShieldCheck, PlusCircle, Users, LogOut, 
  Trash2, CheckCircle, ArrowLeft, GraduationCap, 
  Download, Settings, Save, AlertCircle, Link as LinkIcon,
  Copy, QrCode, ExternalLink, Building, Info, FileText, FilterX, Hash,
  CheckSquare, Square
} from 'lucide-react';

// --- CONFIGURATION ---
const JSONBIN_BIN_ID = '68fa221e43b1c97be97a84f2'; 
const JSONBIN_MASTER_KEY = '$2a$10$CGBmrjbO1PM5CPstFtwXN.PMvfkyYUpEb9rGtO5rJZBLuEtAfWQ7i';
const ADMIN_PASSWORD = 'admin2025';

// --- TYPES ---
interface Training {
  id: string;
  name: string;
}

interface Company {
    id: string;
    name: string;
    cuit: string; 
}

interface UserSubmission {
  id: string;
  trainingId: string;
  trainingName: string;
  firstName: string;
  lastName: string;
  dni: string;
  companyId: string;
  companyName: string; 
  companyCuit: string; 
  signature: string; 
  timestamp: string;
}

interface AdminConfig {
  signature: string | null;
  clarification: string;
  jobTitle: string;
}

interface AppData {
  submissions: UserSubmission[];
  adminConfig: AdminConfig;
  trainings: Training[];
  companies: Company[];
}

// --- API SERVICE ---
const apiService = {
  getData: async (): Promise<AppData> => {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY },
      });
      if (!response.ok) throw new Error('Error fetching data');
      const json = await response.json();
      const d = json.record;
      return {
          submissions: d.submissions || [],
          adminConfig: d.adminConfig || { signature: null, clarification: '', jobTitle: '' },
          trainings: d.trainings || [],
          companies: (d.companies || []).map((c: any) => ({ 
              id: c.id, 
              name: c.name, 
              cuit: c.cuit || 'S/N' 
          })),
      };
    } catch (e) {
      console.error('Fetch error:', e);
      return {
        submissions: [],
        adminConfig: { signature: null, clarification: '', jobTitle: '' },
        trainings: [],
        companies: [],
      };
    }
  },
  saveData: async (data: AppData): Promise<void> => {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify(data),
    });
  }
};

// --- COMPONENTS ---

const Toast = ({ message, type }: { message: string, type: 'success' | 'error' }) => (
  <div className={`fixed bottom-4 right-4 p-5 rounded-2xl shadow-2xl z-50 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-5 duration-300 border ${type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50' : 'bg-rose-900/90 text-rose-100 border-rose-500/50'} backdrop-blur-xl`}>
    {type === 'success' ? <CheckCircle size={24} className="text-emerald-400" /> : <AlertCircle size={24} className="text-rose-400" />}
    <span className="font-semibold text-lg text-white">{message}</span>
  </div>
);

const App = () => {
  const [view, setView] = useState<'user' | 'admin-login' | 'admin-dashboard'>('user');
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // User Form State
  const [selectedTrainingId, setSelectedTrainingId] = useState('');
  const [autoCompany, setAutoCompany] = useState<Company | null>(null);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', dni: '' });
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const companyId = params.get('companyId');
    const trainingId = params.get('trainingId');
    
    if (companyId) {
      const company = data.companies.find(c => c.id === companyId);
      if (company) setAutoCompany(company);
    }
    if (trainingId) setSelectedTrainingId(trainingId);
  }, [data]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await apiService.getData();
      setData(result);
    } catch (e) {
      showToast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setView('admin-dashboard');
      setPassword('');
    } else {
      showToast('Credenciales incorrectas', 'error');
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !autoCompany) return;
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      showToast('Se requiere su firma manuscrita', 'error');
      return;
    }
    if (!selectedTrainingId) {
      showToast('Seleccione una capacitación', 'error');
      return;
    }

    const training = data.trainings.find(t => t.id === selectedTrainingId);

    const newSubmission: UserSubmission = {
      id: crypto.randomUUID(),
      trainingId: selectedTrainingId,
      trainingName: training?.name || 'Capacitación',
      companyId: autoCompany.id,
      companyName: autoCompany.name,
      companyCuit: autoCompany.cuit,
      ...userForm,
      signature: sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png'),
      timestamp: new Date().toISOString()
    };

    const updatedData = {
      ...data,
      submissions: [newSubmission, ...data.submissions]
    };

    setData(updatedData);
    await apiService.saveData(updatedData);
    showToast('¡Registro completado!', 'success');
    generateCertificate(newSubmission, data.adminConfig);
    
    setUserForm({ firstName: '', lastName: '', dni: '' });
    sigCanvasRef.current?.clear();
  };

  const generateCertificate = (sub: UserSubmission, config: AdminConfig) => {
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, width, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE ASISTENCIA', width/2, 30, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text('Se certifica la participación de:', width/2, 70, { align: 'center' });
    
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sub.lastName.toUpperCase()}, ${sub.firstName}`, width/2, 85, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`DNI: ${sub.dni} | Empresa: ${sub.companyName} (${sub.companyCuit})`, width/2, 95, { align: 'center' });

    doc.setFontSize(14);
    doc.text('En la formación técnica de:', width/2, 115, { align: 'center' });
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`"${sub.trainingName}"`, width/2, 130, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Fecha de emisión: ${new Date(sub.timestamp).toLocaleDateString()}`, width/2, 145, { align: 'center' });

    if (config.signature) {
      doc.addImage(config.signature, 'PNG', 40, 165, 40, 20);
      doc.line(30, 185, 90, 185);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(config.clarification, 60, 192, { align: 'center' });
      doc.setFontSize(8);
      doc.text(config.jobTitle, 60, 197, { align: 'center' });
    }

    if (sub.signature) {
      doc.addImage(sub.signature, 'PNG', 130, 165, 40, 20);
      doc.line(120, 185, 180, 185);
      doc.setFontSize(10);
      doc.text('Firma del Asistente', 150, 192, { align: 'center' });
    }

    doc.save(`Certificado_${sub.dni}.pdf`);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 text-center px-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full animate-ping absolute scale-150 opacity-20"></div>
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-slate-400 font-bold tracking-widest text-lg uppercase">Cargando TrainerApp Pro</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {toast && <Toast {...toast} />}

      <nav className="bg-slate-900/50 border-b border-slate-800 px-6 py-4 sticky top-0 z-40 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setView('user')}>
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <GraduationCap size={28} />
            </div>
            <h1 className="text-2xl font-bold tracking-tighter">TrainerApp <span className="text-indigo-400">Pro</span></h1>
          </div>
          <button 
            onClick={() => setView(view === 'user' ? 'admin-login' : 'user')}
            className="flex items-center space-x-2 px-4 py-2 text-lg font-semibold text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-xl"
          >
            {view === 'user' ? <><ShieldCheck size={20} /><span>Acceso Admin</span></> : <><ArrowLeft size={20} /><span>Volver al Portal</span></>}
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-12 animate-in fade-in duration-700">
        {view === 'user' && (
          <div className="max-w-4xl mx-auto">
            {!autoCompany ? (
              <div className="text-center bg-slate-900 p-12 rounded-[2.5rem] shadow-2xl border border-slate-800 space-y-8 mt-12">
                <div className="bg-rose-500/10 text-rose-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto ring-4 ring-rose-500/20">
                  <AlertCircle size={48} />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold">Acceso no autorizado</h2>
                  <p className="text-slate-400 max-w-sm mx-auto text-xl">Esta aplicación requiere un enlace de instructor válido para pre-configurar su empresa.</p>
                </div>
                <button 
                   onClick={() => window.location.reload()} 
                   className="bg-indigo-600 hover:bg-indigo-500 px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 text-xl"
                >
                  Intentar reconectar
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-16 items-start">
                <div className="space-y-10">
                  <div className="space-y-6">
                    <div className="inline-flex items-center px-5 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-base font-bold uppercase tracking-widest border border-emerald-500/20">
                      <CheckCircle size={18} className="mr-2" />
                      Sesión Verificada
                    </div>
                    <h2 className="text-6xl font-bold text-white leading-[1.1] tracking-tight">
                      Registro <br/><span className="text-indigo-500">{autoCompany.name}</span>
                    </h2>
                    <p className="text-2xl text-slate-300 leading-relaxed font-medium">
                      Su asistencia se registrará digitalmente. Al finalizar, obtendrá su certificado oficial firmado por el auditor.
                    </p>
                  </div>
                  
                  <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 space-y-8 backdrop-blur-md">
                    <div className="flex items-center space-x-4 text-indigo-400">
                      <Building size={28} />
                      <span className="font-bold uppercase tracking-widest text-base">Entidad Corporativa</span>
                    </div>
                    <div className="space-y-2">
                        <p className="text-4xl font-bold text-white">{autoCompany.name}</p>
                        <p className="text-xl text-slate-400 font-semibold tracking-wide">CUIT: {autoCompany.cuit}</p>
                    </div>
                    <div className="pt-8 border-t border-slate-800 flex items-start space-x-4 text-slate-400">
                      <Info size={24} className="mt-1 shrink-0 text-indigo-400" />
                      <p className="text-lg font-medium">Usted está ingresando sus datos para una capacitación avalada por su empresa.</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleUserSubmit} className="bg-slate-900 p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-slate-800 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[80px]"></div>
                  
                  <div className="space-y-4">
                    <label className="text-base font-semibold text-slate-400 uppercase tracking-widest">Seleccionar Capacitación</label>
                    <select 
                      required
                      disabled={!!new URLSearchParams(window.location.search).get('trainingId')}
                      value={selectedTrainingId}
                      onChange={(e) => setSelectedTrainingId(e.target.value)}
                      className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none disabled:opacity-50 text-white font-semibold text-xl appearance-none transition-all cursor-pointer"
                    >
                      <option value="">-- Elige la formación --</option>
                      {data?.trainings.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <label className="text-base font-semibold text-slate-400 uppercase tracking-widest">Nombre</label>
                       <input required type="text" placeholder="Ej. Javier" value={userForm.firstName} onChange={(e) => setUserForm({...userForm, firstName: e.target.value})} className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-semibold text-xl" />
                    </div>
                    <div className="space-y-4">
                       <label className="text-base font-semibold text-slate-400 uppercase tracking-widest">Apellido</label>
                       <input required type="text" placeholder="Ej. Rossi" value={userForm.lastName} onChange={(e) => setUserForm({...userForm, lastName: e.target.value})} className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-semibold text-xl" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-base font-semibold text-slate-400 uppercase tracking-widest">Documento (DNI)</label>
                    <input required type="text" placeholder="Sin puntos ni espacios" value={userForm.dni} onChange={(e) => setUserForm({...userForm, dni: e.target.value})} className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-semibold text-xl" />
                  </div>

                  <div className="space-y-5">
                    <label className="text-base font-semibold text-slate-400 uppercase tracking-widest flex justify-between">
                      <span>Firma Digital</span>
                      <button type="button" onClick={() => sigCanvasRef.current?.clear()} className="text-indigo-400 hover:text-indigo-300 font-bold tracking-normal underline text-lg">Borrar firma</button>
                    </label>
                    <div className="border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-950 overflow-hidden ring-offset-4 ring-offset-slate-900 focus-within:ring-2 ring-indigo-500 transition-all">
                      <SignatureCanvas 
                        ref={sigCanvasRef} 
                        {...({ penColor: "white" } as any)}
                        canvasProps={{ className: 'w-full h-56 cursor-crosshair' }} 
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 text-white p-7 rounded-2xl font-bold text-2xl hover:bg-indigo-500 transition-all flex items-center justify-center space-x-5 shadow-2xl shadow-indigo-600/30 transform active:scale-95 group">
                    <span>Generar Certificado</span>
                    <Download size={28} className="group-hover:translate-y-1 transition-transform" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {view === 'admin-login' && (
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-slate-900 p-12 rounded-[2.5rem] shadow-2xl border border-slate-800 space-y-10 animate-in zoom-in duration-300">
              <div className="text-center space-y-5">
                <div className="bg-indigo-600 text-white w-24 h-24 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-600/40"><ShieldCheck size={48} /></div>
                <h2 className="text-4xl font-bold">Admin Access</h2>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-8">
                <input autoFocus type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-8 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-center text-5xl tracking-[0.5em] text-white" />
                <button className="w-full bg-indigo-600 text-white p-6 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 text-2xl">Ingresar al Dashboard</button>
              </form>
            </div>
          </div>
        )}

        {view === 'admin-dashboard' && data && (
          <AdminPanel data={data} setData={setData} showToast={showToast} logout={() => setView('user')} />
        )}
      </main>
    </div>
  );
};

// --- ADMIN PANEL COMPONENT ---
const AdminPanel = ({ data, setData, showToast, logout }: { data: AppData, setData: (d: AppData) => void, showToast: any, logout: any }) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'trainings' | 'companies' | 'links' | 'config'>('submissions');
  const [newName, setNewName] = useState('');
  const [newCuit, setNewCuit] = useState(''); 
  const [saving, setSaving] = useState(false);
  const sigCanvasAdminRef = useRef<SignatureCanvas>(null);

  // Filter States
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterTrainingId, setFilterTrainingId] = useState('');

  // Row Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Link Generator State
  const [linkCompanyId, setLinkCompanyId] = useState('');
  const [linkTrainingId, setLinkTrainingId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const filteredSubmissions = useMemo(() => {
    return data.submissions.filter(s => {
      const matchCompany = filterCompanyId ? s.companyId === filterCompanyId : true;
      const matchTraining = filterTrainingId ? s.trainingId === filterTrainingId : true;
      return matchCompany && matchTraining;
    });
  }, [data.submissions, filterCompanyId, filterTrainingId]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterCompanyId, filterTrainingId]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubmissions.length && filteredSubmissions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map(s => s.id)));
    }
  };

  const saveAll = async (updatedData: AppData) => {
    setSaving(true);
    try {
      await apiService.saveData(updatedData);
      setData(updatedData);
      showToast('Datos sincronizados correctamente', 'success');
    } catch (e) {
      showToast('Fallo al sincronizar datos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addEntity = (type: 'training' | 'company') => {
    if (!newName.trim()) return;
    
    if (type === 'company') {
        const newEntry: Company = { 
            id: crypto.randomUUID(), 
            name: newName.trim(), 
            cuit: newCuit.trim() || 'S/N' 
        };
        const updated = { ...data, companies: [...(data.companies || []), newEntry] };
        saveAll(updated);
        setNewName('');
        setNewCuit('');
    } else {
        const newEntry: Training = { id: crypto.randomUUID(), name: newName.trim() };
        const updated = { ...data, trainings: [...(data.trainings || []), newEntry] };
        saveAll(updated);
        setNewName('');
    }
  };

  const deleteSubmission = (id: string) => {
    if(!confirm('¿Eliminar este registro de asistencia?')) return;
    const updated = { ...data, submissions: data.submissions.filter(s => s.id !== id) };
    saveAll(updated);
  };

  const clearFilteredSubmissions = () => {
    if (!confirm('¿Desea borrar TODOS los registros que coinciden con el filtro actual?')) return;
    const filteredIdsToRemove = new Set(filteredSubmissions.map(s => s.id));
    const updated = { ...data, submissions: data.submissions.filter(s => !filteredIdsToRemove.has(s.id)) };
    saveAll(updated);
  };

  const downloadReportPDF = () => {
    const listToPrint = selectedIds.size > 0 
        ? filteredSubmissions.filter(s => selectedIds.has(s.id)) 
        : filteredSubmissions;

    if (listToPrint.length === 0) {
      showToast('Seleccione al menos un registro para exportar', 'error');
      return;
    }

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Metadata Detection for Header
    // If filter is active, use filter. If not, check if all selected share the same data.
    let compName = 'Múltiples empresas';
    let trainName = 'Todas las capacitaciones';

    if (filterCompanyId) {
        const c = data.companies.find(x => x.id === filterCompanyId);
        if (c) compName = `${c.name} (CUIT: ${c.cuit})`;
    } else {
        const uniqueCompanies = new Set(listToPrint.map(s => s.companyId));
        if (uniqueCompanies.size === 1) {
            const c = data.companies.find(x => x.id === Array.from(uniqueCompanies)[0]);
            if (c) compName = `${c.name} (CUIT: ${c.cuit})`;
        }
    }

    if (filterTrainingId) {
        trainName = data.trainings.find(x => x.id === filterTrainingId)?.name || 'Formación Técnica';
    } else {
        const uniqueTrainings = new Set(listToPrint.map(s => s.trainingId));
        if (uniqueTrainings.size === 1) {
            trainName = listToPrint[0].trainingName;
        }
    }

    // Dark Unified Branding - Slate 950
    const DARK_COLOR: [number, number, number] = [15, 23, 42]; 
    doc.setFillColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2]); 
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSTANCIA DE CAPACITACION', 14, 17);

    // Filter Info (Header)
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información de la Formación:', 14, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${compName}`, 14, 42);
    doc.text(`Capacitación: ${trainName}`, 14, 48);

    // Build Table Body - Minimalist
    const tableRows = listToPrint.map(s => [
      new Date(s.timestamp).toLocaleDateString(),
      `${s.lastName}, ${s.firstName}`,
      s.dni,
      '' // Signature placeholder at index 3
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Apellido y Nombre', 'DNI', 'Firma']],
      body: tableRows,
      headStyles: { 
          fillColor: DARK_COLOR, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          halign: 'center'
      },
      styles: { 
          fontSize: 10, 
          cellPadding: 6,
          valign: 'middle'
      },
      columnStyles: {
          0: { halign: 'center', cellWidth: 40 },
          1: { halign: 'left', cellWidth: 100 },
          2: { halign: 'center', cellWidth: 40 },
          3: { halign: 'center', cellWidth: 60 } 
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      theme: 'grid',
      didDrawCell: (dataCell: any) => {
          if (dataCell.section === 'body' && dataCell.column.index === 3) {
              const signatureBase64 = listToPrint[dataCell.row.index].signature;
              if (signatureBase64) {
                  doc.addImage(signatureBase64, 'PNG', dataCell.cell.x + 15, dataCell.cell.y + 2, 30, 8);
              }
          }
      }
    });

    // FOOTER PLACEMENT (At the very bottom of the page)
    const finalY = (doc as any).lastAutoTable.finalY || 80;
    
    // Check if footer fits on current page
    if (finalY + 60 > pageHeight) {
        doc.addPage();
    }

    const RIGHT_MARGIN = pageWidth - 14;
    const footerBaseY = pageHeight - 35; // Positioned 3.5cm from bottom

    // Signature line
    doc.setDrawColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2]);
    doc.line(RIGHT_MARGIN - 80, footerBaseY, RIGHT_MARGIN, footerBaseY);
    
    // Signature image ABOVE the line
    if (data.adminConfig.signature) {
        doc.addImage(data.adminConfig.signature, 'PNG', RIGHT_MARGIN - 65, footerBaseY - 22, 50, 20);
    }
    
    // Text Labels BELOW the line
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Firma del Instructor', RIGHT_MARGIN, footerBaseY + 6, { align: 'right' });

    doc.setFontSize(12);
    doc.text(data.adminConfig.clarification || 'Instructor No Configurado', RIGHT_MARGIN, footerBaseY + 12, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.adminConfig.jobTitle || 'Cargo No Especificado', RIGHT_MARGIN, footerBaseY + 18, { align: 'right' });

    doc.save(`Reporte_TrainerApp_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Reporte PDF generado exitosamente', 'success');
  };

  const generateInvitationLink = async () => {
    if (!linkCompanyId) return showToast('Seleccione una empresa', 'error');
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.append('companyId', linkCompanyId);
    if (linkTrainingId) params.append('trainingId', linkTrainingId);
    
    const finalLink = `${baseUrl}?${params.toString()}`;
    setGeneratedLink(finalLink);

    try {
      const qrUrl = await QRCode.toDataURL(finalLink, { 
        width: 600, 
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      });
      setQrCodeDataUrl(qrUrl);
    } catch (err) {
      showToast('Error generando QR', 'error');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="space-y-3">
          <h2 className="text-5xl font-bold tracking-tight">Panel Instructor</h2>
          <p className="text-slate-400 font-medium text-xl">Gestión avanzada de registros y auditorías.</p>
        </div>
        <button onClick={logout} className="flex items-center space-x-3 px-8 py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl hover:bg-rose-500 hover:text-white font-bold transition-all group text-lg">
          <LogOut size={24} className="group-hover:-translate-x-1 transition-transform" />
          <span>Finalizar sesión</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-3 p-3 bg-slate-900 border border-slate-800 rounded-3xl w-fit">
        {[
          {id: 'submissions', icon: Users, label: 'Asistencias'},
          {id: 'trainings', icon: GraduationCap, label: 'Cursos'},
          {id: 'companies', icon: Building, label: 'Empresas'},
          {id: 'links', icon: QrCode, label: 'Generar QR'},
          {id: 'config', icon: Settings, label: 'Mi Perfil'}
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold uppercase text-base tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 shadow-xl shadow-indigo-600/30 text-white scale-105' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
          >
            <tab.icon size={20} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden min-h-[600px] backdrop-blur-3xl">
        {activeTab === 'submissions' && (
          <div className="flex flex-col h-full">
            {/* Filter Section */}
            <div className="p-10 border-b border-slate-800 grid md:grid-cols-4 gap-6 items-end bg-slate-950/20">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-500 uppercase">Empresa</label>
                <select value={filterCompanyId} onChange={(e) => setFilterCompanyId(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-white font-semibold outline-none focus:ring-2 focus:ring-indigo-600">
                  <option value="">Todas las empresas</option>
                  {data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-500 uppercase">Capacitación</label>
                <select value={filterTrainingId} onChange={(e) => setFilterTrainingId(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-white font-semibold outline-none focus:ring-2 focus:ring-indigo-600">
                  <option value="">Todos los cursos</option>
                  {data.trainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex space-x-3">
                 <button onClick={downloadReportPDF} className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/20">
                    <FileText size={20} />
                    <span>{selectedIds.size > 0 ? `Exportar (${selectedIds.size})` : 'Exportar PDF'}</span>
                 </button>
                 <button onClick={clearFilteredSubmissions} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 p-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all hover:bg-rose-500 hover:text-white" title="Borrado masivo filtrado">
                    <FilterX size={20} />
                 </button>
              </div>
              <div className="text-slate-500 text-sm font-bold uppercase tracking-widest text-right flex flex-col items-end">
                <span>Resultados: {filteredSubmissions.length}</span>
                {selectedIds.size > 0 && <span className="text-indigo-400">Seleccionados: {selectedIds.size}</span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-500 text-sm font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-6 w-12 text-center">
                        <button onClick={toggleSelectAll} className="p-1 hover:text-indigo-400 transition-colors">
                            {selectedIds.size === filteredSubmissions.length && filteredSubmissions.length > 0 
                                ? <CheckSquare size={24} className="text-indigo-500" /> 
                                : <Square size={24} />}
                        </button>
                    </th>
                    <th className="px-6 py-6">Fecha</th>
                    <th className="px-6 py-6">Personal</th>
                    <th className="px-6 py-6">DNI</th>
                    <th className="px-6 py-6">Empresa & CUIT</th>
                    <th className="px-6 py-6">Curso</th>
                    <th className="px-6 py-6 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSubmissions.map(s => {
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <tr key={s.id} className={`transition-colors group ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-indigo-500/5'}`}>
                        <td className="px-6 py-6 text-center">
                            <button onClick={() => toggleSelect(s.id)} className="p-1 hover:text-indigo-400 transition-colors">
                                {isSelected ? <CheckSquare size={24} className="text-indigo-500" /> : <Square size={24} />}
                            </button>
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap text-lg font-medium text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</td>
                        <td className="px-6 py-6">
                            <span className="font-bold text-white text-xl">{s.lastName}, {s.firstName}</span>
                        </td>
                        <td className="px-6 py-6">
                            <span className="text-lg text-indigo-400 font-semibold tracking-wide">{s.dni}</span>
                        </td>
                        <td className="px-6 py-6">
                           <div className="flex flex-col">
                              <span className="text-lg font-semibold text-slate-300">{s.companyName}</span>
                              <span className="text-sm text-slate-500 font-medium">CUIT: {s.companyCuit || 'S/N'}</span>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-800 text-white text-sm font-bold uppercase border border-slate-700 whitespace-nowrap">
                            {s.trainingName}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <button onClick={() => deleteSubmission(s.id)} className="p-4 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all" title="Eliminar fila">
                            <Trash2 size={24} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-32 text-center">
                        <div className="flex flex-col items-center space-y-6 opacity-20">
                          <Users size={80} />
                          <p className="font-bold uppercase tracking-widest text-xl">Sin registros coincidentes</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'trainings' || activeTab === 'companies') && (
          <div className="p-16 space-y-12">
            <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6 max-w-5xl">
              <input 
                type="text" 
                placeholder={`Nombre de la nueva ${activeTab === 'trainings' ? 'formación' : 'entidad'}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 p-6 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-semibold text-xl"
              />
              {activeTab === 'companies' && (
                <input 
                  type="text" 
                  placeholder="CUIT (Opcional)"
                  value={newCuit}
                  onChange={(e) => setNewCuit(e.target.value)}
                  className="w-full md:w-64 p-6 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-white font-semibold text-xl"
                />
              )}
              <button onClick={() => addEntity(activeTab === 'trainings' ? 'training' : 'company')} className="bg-white text-slate-900 px-12 rounded-2xl font-bold hover:bg-indigo-100 flex items-center justify-center space-x-3 transition-all text-xl py-5 md:py-0">
                <PlusCircle size={24} />
                <span>AGREGAR</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(data[activeTab === 'trainings' ? 'trainings' : 'companies'] || []).map((e: any) => (
                <div key={e.id} className="p-10 border border-slate-800 rounded-[2.5rem] flex justify-between items-center bg-slate-950/50 group hover:border-indigo-500/50 hover:bg-slate-950 transition-all hover:shadow-2xl hover:shadow-indigo-500/10">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-white text-2xl">{e.name}</span>
                    {activeTab === 'companies' && <span className="text-slate-500 text-base font-semibold">CUIT: {e.cuit || 'S/N'}</span>}
                  </div>
                  <button onClick={() => { if(confirm('¿Eliminar?')) saveAll({...data, [activeTab === 'trainings' ? 'trainings' : 'companies']: (data[activeTab === 'trainings' ? 'trainings' : 'companies'] as any).filter((x:any) => x.id !== e.id)}) }} className="p-3 text-slate-700 hover:text-rose-500 transition-colors">
                    <Trash2 size={28} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-16 grid md:grid-cols-2 gap-24">
            <div className="space-y-12">
              <div className="space-y-5">
                <h3 className="text-4xl font-bold">Generador de Acceso</h3>
                <p className="text-slate-400 font-medium text-xl leading-relaxed">Cree un portal de entrada rápido para una empresa. El usuario no tendrá que elegir su empresa manualmente.</p>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-base font-bold uppercase text-slate-500 tracking-widest">Entidad Corporativa</label>
                  <select value={linkCompanyId} onChange={(e) => setLinkCompanyId(e.target.value)} className="w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-white text-xl">
                    <option value="">Seleccione Empresa...</option>
                    {data.companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cuit})</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-base font-bold uppercase text-slate-500 tracking-widest">Curso Relacionado</label>
                  <select value={linkTrainingId} onChange={(e) => setLinkTrainingId(e.target.value)} className="w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-white text-xl">
                    <option value="">Cualquier formación</option>
                    {data.trainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <button onClick={generateInvitationLink} className="w-full bg-indigo-600 text-white p-7 rounded-2xl font-bold text-xl hover:bg-indigo-500 flex items-center justify-center space-x-4 transition-all shadow-2xl shadow-indigo-600/30">
                  <QrCode size={28} />
                  <span>GENERAR QR DE ENTRADA</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center space-y-10">
              {generatedLink ? (
                <div className="text-center space-y-10 animate-in zoom-in duration-300 w-full max-w-sm">
                  <div className="bg-white p-10 rounded-[3.5rem] shadow-[0_0_100px_rgba(79,70,229,0.3)] border-8 border-slate-800">
                    <img src={qrCodeDataUrl} className="w-full" alt="QR de acceso" />
                  </div>
                  <div className="flex gap-6">
                    <button onClick={() => { navigator.clipboard.writeText(generatedLink); showToast('Enlace copiado', 'success'); }} className="flex-1 bg-slate-800 p-5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 hover:bg-slate-700 transition-all border border-slate-700 tracking-widest">COPIAR</button>
                    <a href={qrCodeDataUrl} download={`QR_${data.companies.find(c => c.id === linkCompanyId)?.name || 'TrainerApp'}.png`} className="flex-1 bg-white text-slate-900 p-5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all tracking-widest">BAJAR</a>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-10 opacity-10 select-none scale-150">
                  <div className="bg-slate-800 w-56 h-56 rounded-[3.5rem] mx-auto flex items-center justify-center">
                    <QrCode size={112} className="text-slate-400" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-lg leading-relaxed">Configura la <br/> invitación</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="p-16 max-w-3xl space-y-12">
            <div className="space-y-4">
              <h3 className="text-4xl font-bold">Perfil del Instructor</h3>
              <p className="text-slate-400 font-medium text-xl">Sus datos y firma aparecerán en cada certificado emitido por esta plataforma.</p>
            </div>
            <div className="space-y-10">
              <div className="space-y-4">
                <label className="text-base font-bold uppercase text-slate-500 tracking-widest">Nombre y Apellido (Aclaración)</label>
                <input type="text" placeholder="Ej. Ing. Martín Lutero" value={data.adminConfig.clarification} onChange={(e) => setData({...data, adminConfig: {...data.adminConfig, clarification: e.target.value}})} className="w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-white text-xl transition-all" />
              </div>
              <div className="space-y-4">
                <label className="text-base font-bold uppercase text-slate-500 tracking-widest">Cargo Corporativo</label>
                <input type="text" placeholder="Ej. Jefe de Higiene y Seguridad" value={data.adminConfig.jobTitle} onChange={(e) => setData({...data, adminConfig: {...data.adminConfig, jobTitle: e.target.value}})} className="w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-white text-xl transition-all" />
              </div>
              <div className="space-y-5">
                <label className="text-base font-bold text-slate-500 uppercase tracking-widest mb-3 block flex justify-between">
                  <span>Firma Manuscrita Guardada</span>
                  <button onClick={() => sigCanvasAdminRef.current?.clear()} className="text-indigo-400 font-bold hover:underline tracking-normal normal-case text-lg">Limpiar lienzo</button>
                </label>
                <div className="border-2 border-dashed border-slate-800 p-8 rounded-[3rem] bg-slate-950">
                  <SignatureCanvas 
                    ref={sigCanvasAdminRef} 
                    {...({ penColor: "white" } as any)} 
                    canvasProps={{ className: 'w-full h-48 border-b border-slate-900 bg-slate-950/30 rounded-2xl cursor-crosshair' }} 
                  />
                </div>
              </div>
              <button onClick={() => {
                const sig = sigCanvasAdminRef.current?.isEmpty() ? data.adminConfig.signature : sigCanvasAdminRef.current?.getTrimmedCanvas().toDataURL('image/png');
                saveAll({...data, adminConfig: {...data.adminConfig, signature: sig || null}});
              }} className="w-full bg-indigo-600 text-white p-7 rounded-2xl font-bold text-xl hover:bg-indigo-500 flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-600/30">
                <Save size={28} />
                <span>GUARDAR CONFIGURACIÓN</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Render entry point
try {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        ReactDOM.createRoot(rootEl).render(<App />);
    } else {
        console.error('Root element not found');
    }
} catch (err) {
    console.error('Render error:', err);
}
