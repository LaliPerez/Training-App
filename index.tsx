
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { 
  ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, 
  Trash2, Edit, X, Share2, Copy, Eye, FileText, 
  CheckCircle, ArrowLeft, Send, GraduationCap, 
  Building, ArrowRight, QrCode, Download, CopyPlus, 
  Briefcase, History, Settings
} from 'lucide-react';

// --- CONFIGURACIÓN ---
const JSONBIN_BIN_ID = '68fa221e43b1c97be97a84f2'; 
const JSONBIN_MASTER_KEY = '$2a$10$CGBmrjbO1PM5CPstFtwXN.PMvfkyYUpEb9rGtO5rJZBLuEtAfWQ7i';
const ADMIN_PASSWORD = 'admin2025';

type ToastType = 'success' | 'error' | 'info';

// --- TYPES ---
interface TrainingLink {
  id: string;
  name: string;
  url: string;
}

interface Training {
  id: string;
  name: string;
  links: TrainingLink[];
  shareKey: string;
  companies?: string[]; 
}

interface Company {
    id: string;
    name: string;
    cuit?: string;
}

interface UserSubmission {
  id: string;
  trainingId: string;
  trainingName: string;
  firstName: string;
  lastName: string;
  dni: string;
  company: string; 
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
      const json = await response.json();
      const d = json.record;
      return {
          submissions: d.submissions || [],
          adminConfig: d.adminConfig || { signature: null, clarification: '', jobTitle: '' },
          trainings: d.trainings || [],
          companies: d.companies || [],
      };
    } catch (e) {
      console.error(e);
      throw e;
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

// --- PDF GENERATOR ---
const pdfService = {
  generateCertificate: (sub: UserSubmission, config: AdminConfig) => {
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, width, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE ASISTENCIA', width/2, 28, { align: 'center' });

    // Body
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Se deja constancia que:', width/2, 65, { align: 'center' });
    
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sub.lastName.toUpperCase()}, ${sub.firstName}`, width/2, 80, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`DNI: ${sub.dni} | Empresa: ${sub.company}`, width/2, 90, { align: 'center' });

    doc.setFontSize(14);
    doc.text('Ha completado exitosamente la capacitación de:', width/2, 110, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`"${sub.trainingName}"`, width/2, 125, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Emitido el día: ${new Date(sub.timestamp).toLocaleDateString()}`, width/2, 140, { align: 'center' });

    // Signatures
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

    doc.save(`Certificado_${sub.dni}_${sub.trainingId}.pdf`);
  },

  generateGeneralReport: (submissions: UserSubmission[], trainingName: string, config: AdminConfig) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Planilla de Asistencia: ${trainingName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Instructor: ${config.clarification} - ${new Date().toLocaleDateString()}`, 14, 28);

    const body = submissions.map((s, i) => [
      i + 1,
      `${s.lastName}, ${s.firstName}`,
      s.dni,
      s.company,
      new Date(s.timestamp).toLocaleString(),
      ''
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Apellido y Nombre', 'DNI', 'Empresa', 'Fecha/Hora', 'Firma']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      didDrawCell: (data) => {
        if (data.column.index === 5 && data.cell.section === 'body') {
          const s = submissions[data.row.index];
          if (s.signature) {
            doc.addImage(s.signature, 'PNG', data.cell.x + 2, data.cell.y + 1, 15, 8);
          }
        }
      }
    });

    doc.save(`Reporte_Asistencia_${trainingName.replace(/\s/g, '_')}.pdf`);
  }
};

// --- COMPONENTS ---

const Spinner = () => <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X/></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onDismiss }: any) => {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, []);
  const bg = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
  return <div className={`fixed bottom-6 right-6 ${bg} text-white px-6 py-3 rounded-full shadow-xl z-[100] animate-bounce`}>{message}</div>;
};

// --- MAIN APP ---

const App = () => {
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'user' | 'loading'>('loading');
  const [data, setData] = useState<AppData | null>(null);
  const [toast, setToast] = useState<any>(null);
  const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
  const [activeTab, setActiveTab] = useState<'trainings' | 'submissions' | 'companies' | 'settings'>('trainings');
  
  const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });

  const loadData = async () => {
    try {
      const d = await apiService.getData();
      setData(d);
    } catch (e) { showToast("Error al conectar con la base de datos", "error"); }
    finally { setView('home'); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key) {
      apiService.getData().then(d => {
        const t = d.trainings.find(x => x.shareKey === key);
        if (t) {
          setData(d);
          setCurrentTraining(t);
          setView('user');
        } else {
          loadData();
        }
      });
    } else {
      loadData();
    }
  }, []);

  if (view === 'loading') return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4"><Spinner/><p>Cargando Trainer App...</p></div>;

  const handleSave = async (newData: AppData) => {
    setData(newData);
    try {
      await apiService.saveData(newData);
      showToast("Cambios guardados con éxito", "success");
    } catch (e) { showToast("Error al guardar", "error"); }
  };

  const AdminDashboard = () => {
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingTraining, setEditingTraining] = useState<Training | null>(null);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const deleteTraining = (id: string) => {
      if (!confirm("¿Eliminar esta capacitación?")) return;
      handleSave({ ...data!, trainings: data!.trainings.filter(t => t.id !== id) });
    };

    const duplicateTraining = (t: Training) => {
      const newT = { ...t, id: `t-${Date.now()}`, name: `${t.name} (Copia)`, shareKey: Math.random().toString(36).substr(2, 9) };
      handleSave({ ...data!, trainings: [...data!.trainings, newT] });
    };

    const saveTraining = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const name = formData.get('name') as string;
      
      const newT: Training = {
        ...editingTraining!,
        name,
        id: editingTraining?.id || `t-${Date.now()}`,
        shareKey: editingTraining?.shareKey || Math.random().toString(36).substr(2, 9)
      };

      const newList = editingTraining?.id 
        ? data!.trainings.map(x => x.id === newT.id ? newT : x)
        : [...data!.trainings, newT];
      
      handleSave({ ...data!, trainings: newList });
      setEditModalOpen(false);
    };

    const updateCompanyGlobal = (e: React.FormEvent) => {
      e.preventDefault();
      const newName = (e.target as any).companyName.value;
      const oldName = editingCompany!.name;
      
      const updatedCompanies = data!.companies.map(c => c.id === editingCompany!.id ? { ...c, name: newName } : c);
      const updatedSubmissions = data!.submissions.map(s => s.company === oldName ? { ...s, company: newName } : s);
      
      handleSave({ ...data!, companies: updatedCompanies, submissions: updatedSubmissions });
      setEditingCompany(null);
      showToast("Empresa actualizada en todos los registros", "success");
    };

    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="text-white"/></div>
              <h1 className="text-xl font-bold tracking-tight">Admin <span className="text-blue-500">Panel</span></h1>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><LogOut size={20}/></button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="flex flex-wrap gap-2 mb-8 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
            <button onClick={() => setActiveTab('trainings')} className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'trainings' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>Capacitaciones</button>
            <button onClick={() => setActiveTab('submissions')} className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'submissions' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>Asistencias</button>
            <button onClick={() => setActiveTab('companies')} className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'companies' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>Empresas</button>
            <button onClick={() => setActiveTab('settings')} className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>Instructor</button>
          </div>

          {activeTab === 'trainings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              <button 
                onClick={() => { setEditingTraining({ id: '', name: '', links: [], shareKey: '' }); setEditModalOpen(true); }}
                className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 hover:border-blue-500 hover:bg-blue-500/5 rounded-2xl transition-all gap-4"
              >
                <div className="p-4 bg-slate-900 group-hover:bg-blue-600 rounded-full transition-colors"><PlusCircle size={32}/></div>
                <span className="font-bold text-slate-400 group-hover:text-blue-400 text-lg">Nueva Plantilla</span>
              </button>
              {data?.trainings.map(t => (
                <div key={t.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col hover:border-slate-600 transition-all shadow-xl group">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{t.name}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => duplicateTraining(t)} title="Clonar" className="p-1.5 text-slate-400 hover:text-green-400"><CopyPlus size={18}/></button>
                      <button onClick={() => { setEditingTraining(t); setEditModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-400"><Edit size={18}/></button>
                      <button onClick={() => deleteTraining(t.id)} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={18}/></button>
                    </div>
                  </div>
                  <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Enlace Público</span>
                      <code className="text-blue-400 text-sm">{t.shareKey}</code>
                    </div>
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}${window.location.pathname}?key=${t.shareKey}`;
                        navigator.clipboard.writeText(url);
                        showToast("Link copiado al portapapeles", "success");
                      }}
                      className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors"
                    ><Copy size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-xl">Registros de Asistencia</h3>
                <div className="flex gap-2">
                  <span className="text-sm bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full font-bold">{data?.submissions.length} Total</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                    <tr>
                      <th className="p-4">Persona</th>
                      <th className="p-4">DNI</th>
                      <th className="p-4">Capacitación</th>
                      <th className="p-4">Empresa</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data?.submissions.slice().reverse().map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-medium text-white">{s.lastName}, {s.firstName}</td>
                        <td className="p-4 text-slate-400">{s.dni}</td>
                        <td className="p-4"><span className="text-xs bg-slate-800 px-2 py-1 rounded">{s.trainingName}</span></td>
                        <td className="p-4 text-blue-400 font-medium">{s.company}</td>
                        <td className="p-4 flex justify-center gap-2">
                          <button onClick={() => pdfService.generateCertificate(s, data!.adminConfig)} className="p-2 bg-slate-800 hover:bg-blue-600 rounded-lg transition-colors" title="Certificado"><FileDown size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
             <div className="max-w-4xl animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Building className="text-blue-500"/> Gestionar Empresas</h3>
                  <form className="flex gap-4 mb-8" onSubmit={(e) => {
                    e.preventDefault();
                    const name = (e.target as any).comp.value;
                    if (!name) return;
                    handleSave({ ...data!, companies: [...data!.companies, { id: `c-${Date.now()}`, name }] });
                    (e.target as any).reset();
                  }}>
                    <input name="comp" placeholder="Nombre de la nueva empresa..." className="flex-grow bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"><PlusCircle size={20}/> Añadir</button>
                  </form>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data?.companies.map(c => (
                      <div key={c.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex justify-between items-center group">
                        <span className="font-medium">{c.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingCompany(c)} className="p-2 text-slate-400 hover:text-blue-400 transition-colors"><Edit size={16}/></button>
                          <button onClick={() => {
                            if(confirm("¿Eliminar empresa? No afectará registros históricos.")) {
                              handleSave({ ...data!, companies: data!.companies.filter(x => x.id !== c.id) });
                            }
                          }} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Settings className="text-blue-500"/> Firma del Instructor</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target as any);
                handleSave({
                  ...data!,
                  adminConfig: {
                    ...data!.adminConfig,
                    clarification: fd.get('clar') as string,
                    jobTitle: fd.get('job') as string
                  }
                });
              }} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Nombre Completo (Aclaración)</label>
                  <input name="clar" defaultValue={data?.adminConfig.clarification} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Cargo / Puesto</label>
                  <input name="job" defaultValue={data?.adminConfig.jobTitle} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Firma Actual</label>
                  <div className="bg-white p-4 rounded-xl mb-4 h-32 flex items-center justify-center border-4 border-slate-800">
                    {data?.adminConfig.signature ? <img src={data.adminConfig.signature} className="max-h-full"/> : <span className="text-slate-400 italic text-sm">Sin firma configurada</span>}
                  </div>
                  <button type="button" onClick={() => {
                    const canvas = document.createElement('canvas');
                    // Simulación de carga de firma para brevedad, en un caso real usaríamos un SignaturePad aquí también
                    const sig = prompt("Por favor cargue o firme en el Panel de Firma (Usa el modo usuario para generar una firma temporal si es necesario)");
                    if(sig) handleSave({ ...data!, adminConfig: { ...data!.adminConfig, signature: sig } });
                  }} className="text-blue-500 text-sm font-bold hover:underline">Cambiar Firma</button>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all">Guardar Configuración</button>
              </form>
            </div>
          )}
        </main>

        {/* MODAL EDITAR CAPACITACION */}
        <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title={editingTraining?.id ? "Editar Plantilla" : "Nueva Plantilla"}>
          <form onSubmit={saveTraining} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-500 mb-2">NOMBRE DEL CURSO</label>
              <input name="name" defaultValue={editingTraining?.name} placeholder="Ejem: Seguridad en Altura" required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-bold text-slate-500">MATERIALES / ENLACES</label>
                <button type="button" onClick={() => setEditingTraining({...editingTraining!, links: [...editingTraining!.links, { id: `l-${Date.now()}`, name: '', url: '' }]})} className="text-blue-500 text-sm font-bold">+ Añadir Link</button>
              </div>
              <div className="space-y-3">
                {editingTraining?.links.map((l, idx) => (
                  <div key={l.id} className="flex gap-2 items-center animate-fade-in">
                    <input placeholder="Nombre (Video, PDF...)" value={l.name} onChange={e => {
                      const n = [...editingTraining.links];
                      n[idx].name = e.target.value;
                      setEditingTraining({...editingTraining, links: n});
                    }} className="w-1/3 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm"/>
                    <input placeholder="https://..." value={l.url} onChange={e => {
                      const n = [...editingTraining.links];
                      n[idx].url = e.target.value;
                      setEditingTraining({...editingTraining, links: n});
                    }} className="flex-grow bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm"/>
                    <button type="button" onClick={() => setEditingTraining({...editingTraining, links: editingTraining.links.filter(x => x.id !== l.id)})} className="text-red-500 p-2"><X size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-xl">Guardar Plantilla</button>
          </form>
        </Modal>

        {/* MODAL EDITAR EMPRESA (GLOBAL) */}
        <Modal isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} title="Reemplazar Nombre de Empresa">
          <form onSubmit={updateCompanyGlobal} className="space-y-6">
             <p className="text-sm text-yellow-500 font-medium">⚠️ ¡Atención! Cambiar el nombre aquí actualizará automáticamente todas las asistencias históricas vinculadas a "{editingCompany?.name}".</p>
             <input name="companyName" defaultValue={editingCompany?.name} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"/>
             <button className="w-full bg-blue-600 py-3 rounded-xl font-bold">Actualizar Globalmente</button>
          </form>
        </Modal>
      </div>
    );
  };

  const UserPortal = () => {
    const [step, setStep] = useState<'content' | 'form' | 'success'>('content');
    const [viewed, setViewed] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigRef = useRef<any>(null);

    const progress = currentTraining!.links.length > 0 ? (viewed.size / currentTraining!.links.length) * 100 : 100;

    const handleForm = async (e: React.FormEvent) => {
      e.preventDefault();
      if (sigRef.current.isEmpty()) return showToast("Firma requerida", "error");
      
      setIsSubmitting(true);
      const fd = new FormData(e.target as any);
      const sub: UserSubmission = {
        id: `s-${Date.now()}`,
        trainingId: currentTraining!.id,
        trainingName: currentTraining!.name,
        firstName: fd.get('fn') as string,
        lastName: fd.get('ln') as string,
        dni: fd.get('dni') as string,
        company: fd.get('comp') as string,
        signature: sigRef.current.getTrimmedCanvas().toDataURL('image/png'),
        timestamp: new Date().toISOString()
      };

      try {
        const d = await apiService.getData();
        await apiService.saveData({ ...d, submissions: [...d.submissions, sub] });
        setStep('success');
      } catch (e) { showToast("Error al enviar registro", "error"); }
      finally { setIsSubmitting(false); }
    };

    if (step === 'success') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20"><CheckCircle size={40} className="text-white"/></div>
          <h2 className="text-3xl font-bold text-white mb-2">¡Registro Exitoso!</h2>
          <p className="text-slate-400 mb-8 max-w-sm">Has completado la capacitación y tu asistencia ha sido registrada correctamente.</p>
          <button onClick={() => window.location.reload()} className="bg-slate-800 px-8 py-3 rounded-xl font-bold text-white">Finalizar</button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white p-4">
        <div className="max-w-2xl mx-auto py-8">
          <header className="text-center mb-10">
            <span className="text-blue-500 font-bold uppercase tracking-widest text-xs mb-2 block">Capacitación Digital</span>
            <h1 className="text-3xl font-extrabold">{currentTraining!.name}</h1>
          </header>

          {step === 'content' ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl animate-fade-in-up">
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-slate-400">Progreso del curso</span>
                  <span className="text-xl font-black text-blue-500">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {currentTraining!.links.length > 0 ? currentTraining!.links.map(l => (
                  <button key={l.id} onClick={() => { window.open(l.url, '_blank'); setViewed(prev => new Set(prev).add(l.id)); }} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${viewed.has(l.id) ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'}`}>
                        <FileText size={20}/>
                      </div>
                      <span className="font-bold">{l.name}</span>
                    </div>
                    <ArrowRight size={18} className="text-slate-500 group-hover:translate-x-1 transition-transform"/>
                  </button>
                )) : (
                  <p className="text-center text-slate-500 py-10 italic">No hay material adjunto para esta capacitación.</p>
                )}
              </div>

              <button 
                disabled={progress < 100 && currentTraining!.links.length > 0} 
                onClick={() => setStep('form')}
                className="w-full bg-blue-600 disabled:bg-slate-800 disabled:text-slate-600 py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-500 transition-all"
              >
                IR AL REGISTRO
              </button>
            </div>
          ) : (
            <form onSubmit={handleForm} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl animate-fade-in-up space-y-6">
              <button type="button" onClick={() => setStep('content')} className="text-slate-400 flex items-center gap-2 text-sm hover:text-white"><ArrowLeft size={16}/> Volver al curso</button>
              <h3 className="text-2xl font-bold">Datos del Asistente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="ln" placeholder="Apellidos" required className="bg-slate-800 border border-slate-700 rounded-xl p-4"/>
                <input name="fn" placeholder="Nombres" required className="bg-slate-800 border border-slate-700 rounded-xl p-4"/>
              </div>
              <input name="dni" placeholder="DNI / Cédula" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4"/>
              <select name="comp" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-400">
                <option value="">Selecciona tu Empresa...</option>
                {data?.companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Firma Digital</label>
                <div className="bg-white rounded-2xl border-4 border-slate-800 h-48 overflow-hidden">
                  <SignatureCanvas ref={sigRef} penColor='black' canvasProps={{className: 'w-full h-full'}} />
                </div>
                <button type="button" onClick={() => sigRef.current.clear()} className="text-xs text-red-400 hover:underline">Limpiar firma</button>
              </div>

              <button disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-500 py-5 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3">
                {isSubmitting ? <Spinner/> : <><Send size={20}/> ENVIAR REGISTRO</>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  const Welcome = () => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
      <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-8 rotate-12 shadow-2xl shadow-blue-500/20"><GraduationCap size={48}/></div>
      <h1 className="text-5xl font-black mb-4 tracking-tighter">Trainer<span className="text-blue-600">App</span></h1>
      <p className="text-slate-400 max-w-sm mb-12 text-lg">Plataforma profesional para gestión de capacitaciones, asistencia y certificaciones digitales.</p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button onClick={() => setView('login')} className="bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl">
          <ShieldCheck size={20}/> Acceso Administrador
        </button>
      </div>
    </div>
  );

  const Login = () => {
    const [pass, setPass] = useState('');
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (pass === ADMIN_PASSWORD) setView('admin');
      else showToast("Contraseña incorrecta", "error");
    };
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white animate-fade-in">
        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6">
          <h2 className="text-2xl font-bold text-center">Inicia Sesión</h2>
          <input 
            type="password" 
            autoFocus 
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            placeholder="Contraseña Maestra" 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-center text-xl font-mono tracking-widest"
          />
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all shadow-lg">Entrar al Panel</button>
          <button type="button" onClick={() => setView('home')} className="w-full text-slate-500 text-sm hover:underline">Volver</button>
        </form>
      </div>
    );
  };

  return (
    <div className="selection:bg-blue-500 selection:text-white">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {view === 'home' && <Welcome/>}
      {view === 'login' && <Login/>}
      {view === 'admin' && <AdminDashboard/>}
      {view === 'user' && <UserPortal/>}
      
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
