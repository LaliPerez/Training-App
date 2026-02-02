
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, Eye, EyeOff, 
  QrCode, Info, Award, BookOpen,
  FileText, X, Download, Calendar, BarChart3, Search,
  Briefcase, Layers, Link as LinkIcon
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Robust handling for SignatureCanvas ESM
const SignatureComp = (SignatureCanvas as any).default || SignatureCanvas;

// --- Interfaces ---
interface Client { id: string; name: string; }
interface Module { id: string; name: string; driveUrl: string; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface Record { id: string; name: string; dni: string; clientId: string; assignmentId: string; signature: string; timestamp: string; }
interface AppState { 
  clients: Client[]; 
  modules: Module[]; 
  assignments: Assignment[]; 
  records: Record[]; 
  instructorName: string; 
  instructorRole: string; 
  instructorSignature: string; 
}

const STORAGE_KEY = 'trainer_pro_v3_core';

// --- Sub-componentes ---

const AdminPanel: React.FC<{ data: AppState, setData: any, onLogout: () => void }> = ({ data, setData, onLogout }) => {
  const [tab, setTab] = useState<'overview' | 'asistencias' | 'config' | 'operaciones'>('overview');
  const instructorSig = useRef<any>(null);
  const [form, setForm] = useState({ client: '', module: '', driveUrl: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const generatePDF = (aid: string) => {
    const as = data.assignments.find((x:any)=>x.id===aid);
    if (!as) return;
    const client = data.clients.find((c:any)=>c.id===as.clientId);
    const mod = data.modules.find((m:any)=>m.id===as.moduleId);
    const records = data.records.filter((r:any)=>r.assignmentId===aid);

    const doc = new jsPDF();
    doc.setFillColor(3, 7, 18); 
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255); 
    doc.setFontSize(26); 
    doc.setFont('helvetica', 'bold');
    doc.text('ACTA DE CAPACITACIÓN', 14, 28);
    doc.setFontSize(10); 
    doc.setFont('helvetica', 'normal');
    doc.text('GESTIÓN DIGITAL DE ASISTENCIAS - TRAINERPRO', 14, 38);
    
    doc.setTextColor(30, 30, 30); 
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold'); doc.text('EMPRESA:', 14, 65);
    doc.setFont('helvetica', 'normal'); doc.text(client?.name || '---', 60, 65);
    doc.setFont('helvetica', 'bold'); doc.text('TEMÁTICA:', 14, 73);
    doc.setFont('helvetica', 'normal'); doc.text(mod?.name || '---', 60, 73);
    doc.setFont('helvetica', 'bold'); doc.text('INSTRUCTOR:', 14, 81);
    doc.setFont('helvetica', 'normal'); doc.text(data.instructorName, 60, 81);
    doc.setFont('helvetica', 'bold'); doc.text('FECHA:', 14, 89);
    doc.setFont('helvetica', 'normal'); doc.text(new Date(as.createdAt).toLocaleDateString(), 60, 89);
    
    autoTable(doc, {
      startY: 100,
      head: [['#', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA']],
      body: records.map((r:any, i:number)=>[i+1, r.name, r.dni, '']),
      didDrawCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index === 3) {
          const rec = records[dataCell.row.index];
          if (rec?.signature) {
            try { 
              doc.addImage(rec.signature, 'PNG', dataCell.cell.x + 2, dataCell.cell.y + 1, 30, 14); 
            } catch(e){}
          }
        }
      },
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold', halign: 'center' },
      styles: { minCellHeight: 18, valign: 'middle', halign: 'center', fontSize: 10 },
      columnStyles: { 1: { halign: 'left', cellWidth: 80 } }
    });
    
    const pageHeight = doc.internal.pageSize.getHeight();
    if (data.instructorSignature) {
      doc.addImage(data.instructorSignature, 'PNG', 140, pageHeight - 50, 50, 20);
    }
    doc.line(140, pageHeight - 30, 195, pageHeight - 30);
    doc.setFontSize(9);
    doc.text(data.instructorName, 167.5, pageHeight - 25, { align: 'center' });
    doc.text(data.instructorRole, 167.5, pageHeight - 20, { align: 'center' });
    doc.save(`Reporte_Capacitacion_${as.id}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 800, margin: 1, color: { dark: '#030712', light: '#ffffff' } });
    const doc = new jsPDF();
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE ASISTENCIA', 105, 30, {align:'center'});
    doc.addImage(qrData, 'PNG', 45, 65, 120, 120);
    doc.setTextColor(3, 7, 18);
    doc.setFontSize(18);
    doc.text('ESCANEE EL CÓDIGO QR', 105, 200, {align:'center'});
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Para registrar su asistencia y descargar el material técnico.', 105, 210, {align:'center'});
    const as = data.assignments.find(a => a.id === aid);
    const modName = data.modules.find(m => m.id === as?.moduleId)?.name || '';
    const cliName = data.clients.find(c => c.id === as?.clientId)?.name || '';
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`${cliName} | ${modName}`, 105, 230, {align:'center'});
    doc.text(`ID: ${as?.id}`, 105, 236, {align:'center'});
    doc.save(`Acceso_QR_${aid}.pdf`);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return data.records;
    const s = searchTerm.toLowerCase();
    return data.records.filter(r => 
      r.name.toLowerCase().includes(s) || 
      r.dni.includes(s) || 
      data.clients.find(c => c.id === r.clientId)?.name.toLowerCase().includes(s)
    );
  }, [data.records, searchTerm]);

  const stats = useMemo(() => ({
    totalFirmas: data.records.length,
    totalClientes: data.clients.length,
    totalModulos: data.modules.length,
    totalActivas: data.assignments.length
  }), [data]);

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center mb-10 py-6 border-b border-white/5">
        <div>
          <h2 style={{margin:0, fontWeight: 900, fontSize: '2rem'}}>Panel de Gestión</h2>
          <div className="flex items-center gap-2 text-muted text-sm mt-1">
            <User size={14} /> {data.instructorName} | <Shield size={14} className="text-accent" /> Administrador
          </div>
        </div>
        <button className="btn btn-secondary border-danger/20 text-danger hover:bg-danger/10" onClick={onLogout}>
          <LogOut size={18} /> Salir
        </button>
      </header>

      <nav className="flex gap-2 mb-10 overflow-x-auto pb-2 no-scrollbar">
        <button className={`btn ${tab==='overview'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Resumen</button>
        <button className={`btn ${tab==='operaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('operaciones')}><QrCode size={18}/> Capacitaciones</button>
        <button className={`btn ${tab==='asistencias'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asistencias')}><Users size={18}/> Firmas</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><ClipboardList size={18}/> Configuración</button>
      </nav>

      {tab === 'overview' && (
        <div className="animate-in grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card text-center flex flex-col items-center bg-white/5">
            <div className="icon-container mb-2 bg-accent/10"><Users size={24} className="text-accent"/></div>
            <span className="text-4xl font-black">{stats.totalFirmas}</span>
            <span className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">Firmas Digitales</span>
          </div>
          <div className="card text-center flex flex-col items-center bg-white/5">
            <div className="icon-container mb-2 bg-success/10"><CheckCircle size={24} className="text-success"/></div>
            <span className="text-4xl font-black">{stats.totalActivas}</span>
            <span className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">Sesiones Generadas</span>
          </div>
          <div className="card text-center flex flex-col items-center bg-white/5">
            <div className="icon-container mb-2 bg-purple-500/10"><Briefcase size={24} className="text-purple-400"/></div>
            <span className="text-4xl font-black">{stats.totalClientes}</span>
            <span className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">Empresas Cliente</span>
          </div>
          <div className="card text-center flex flex-col items-center bg-white/5">
            <div className="icon-container mb-2 bg-orange-500/10"><Layers size={24} className="text-orange-400"/></div>
            <span className="text-4xl font-black">{stats.totalModulos}</span>
            <span className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">Módulos Técnicos</span>
          </div>
        </div>
      )}

      {tab === 'operaciones' && (
        <div className="animate-in">
          <div className="card bg-accent/5 border-accent/20 grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-10 shadow-xl p-8">
            <div className="flex flex-col">
              <label className="text-accent font-black mb-3">1. Seleccionar Empresa</label>
              <select id="selClient" className="bg-bg border-accent/30 h-14">
                <option value="">-- Cliente --</option>
                {data.clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-accent font-black mb-3">2. Seleccionar Módulo</label>
              <select id="selModule" className="bg-bg border-accent/30 h-14">
                <option value="">-- Capacitación --</option>
                {data.modules.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary h-14 font-black" onClick={()=>{
              const cid = (document.getElementById('selClient') as any).value;
              const mid = (document.getElementById('selModule') as any).value;
              if(!cid || !mid) return alert('Seleccione Empresa y Módulo.');
              setData({...data, assignments:[...data.assignments, {id:Math.random().toString(36).substr(2,6).toUpperCase(), clientId:cid, moduleId:mid, createdAt:new Date().toISOString()}]});
            }}>VINCULAR Y GENERAR</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {data.assignments.map((as:any)=>{
              const client = data.clients.find((c:any)=>c.id===as.clientId);
              const module = data.modules.find((m:any)=>m.id===as.moduleId);
              return (
                <div key={as.id} className="card relative p-8 bg-white/5">
                  <div className="absolute top-2 right-2 text-[10px] font-black bg-accent/20 text-accent px-2 py-1 rounded">#{as.id}</div>
                  <div className="text-xl font-black mb-4">{client?.name}</div>
                  <div className="text-sm text-muted mb-6">{module?.name}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <button className="btn btn-primary h-12" onClick={()=>generateQR(as.id)}><QrCode size={20}/></button>
                    <button className="btn btn-secondary h-12" onClick={()=>generatePDF(as.id)}><Download size={20}/></button>
                    <button className="btn btn-secondary h-12 text-danger" onClick={()=>{if(confirm('¿Eliminar sesión?'))setData({...data, assignments: data.assignments.filter((x:any)=>x.id!==as.id)})}}><Trash2 size={20}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card bg-white/5">
            <h3 className="mb-6 font-black text-xl">Perfil Instructor</h3>
            <div className="flex flex-col gap-4">
              <input value={data.instructorName} onChange={e=>setData({...data, instructorName:e.target.value})} placeholder="Nombre" />
              <input value={data.instructorRole} onChange={e=>setData({...data, instructorRole:e.target.value})} placeholder="Cargo" />
              <div className="signature-wrapper" style={{height:150}}><SignatureComp ref={instructorSig} canvasProps={{style:{width:'100%', height:'100%'}}} /></div>
              <button className="btn btn-primary" onClick={()=>{if(!instructorSig.current?.isEmpty()) setData({...data, instructorSignature: instructorSig.current.getTrimmedCanvas().toDataURL()})}}>GUARDAR FIRMA</button>
            </div>
          </div>
          <div className="card bg-white/5">
            <h3 className="mb-6 font-black text-xl">Empresas y Módulos</h3>
            <div className="flex flex-col gap-6">
              <div>
                <label>Nueva Empresa</label>
                <div className="flex gap-2">
                  <input value={form.client} onChange={e=>setForm({...form, client:e.target.value})} placeholder="Nombre empresa" />
                  <button className="btn btn-primary" onClick={()=>{if(form.client) { setData({...data, clients:[...data.clients, {id:Date.now().toString(), name:form.client.toUpperCase()}]}); setForm({...form, client:''}); }}}><Plus/></button>
                </div>
              </div>
              <div>
                <label>Nuevo Módulo (Con Link Dropbox)</label>
                <div className="flex flex-col gap-2">
                  <input value={form.module} onChange={e=>setForm({...form, module:e.target.value})} placeholder="Nombre módulo" />
                  <input value={form.driveUrl} onChange={e=>setForm({...form, driveUrl:e.target.value})} placeholder="URL Material (Dropbox/Drive)" />
                  <button className="btn btn-primary" onClick={()=>{if(form.module) { setData({...data, modules:[...data.modules, {id:Date.now().toString(), name:form.module.toUpperCase(), driveUrl:form.driveUrl}]}); setForm({...form, module:'', driveUrl:''}); }}}>AGREGAR MÓDULO</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'asistencias' && (
        <div className="card p-0 bg-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <input placeholder="Buscar firma..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="w-full">
              <thead><tr className="bg-white/5 text-[10px] text-muted"><th>EMPLEADO</th><th>DNI</th><th>EMPRESA</th><th>FIRMA</th></tr></thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="p-4">{r.name}</td><td className="p-4">{r.dni}</td><td className="p-4">{data.clients.find(c=>c.id===r.clientId)?.name}</td><td className="p-4"><img src={r.signature} height="20" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const TrainerPanel: React.FC<{ data: AppState, setData: any, onBack: () => void }> = ({ data, setData, onBack }) => {
  const [step, setStep] = useState(0);
  const [assignment, setAssignment] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [user, setUser] = useState({ name: '', dni: '' });
  const sig = useRef<any>(null);

  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get('a');
    if (aid) {
      const found = data.assignments.find(x => x.id === aid);
      if (found) {
        setAssignment(found);
        setStep(1);
      }
    }
  }, [data.assignments]);

  const handleManualAccess = () => {
    const found = data.assignments.find(x => x.id.toUpperCase() === manualCode.toUpperCase().trim());
    if (found) {
      setAssignment(found);
      setStep(1);
    } else {
      alert('Código de sesión inválido.');
    }
  };

  const handleConfirm = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Complete los campos');
    const rec: Record = { 
      id: Date.now().toString(), 
      name: user.name.toUpperCase(), 
      dni: user.dni, 
      clientId: assignment.clientId, 
      assignmentId: assignment.id, 
      signature: sig.current.getTrimmedCanvas().toDataURL(), 
      timestamp: new Date().toISOString() 
    };
    setData({ ...data, records: [rec, ...data.records] });
    setStep(3);
  };

  if (step === 0 && !assignment) {
    return (
      <div className="max-w-[500px] mx-auto py-10 animate-in">
        <div className="card text-center bg-white/5 p-10">
          <div className="icon-container mx-auto mb-6 bg-accent/10"><QrCode size={40} className="text-accent"/></div>
          <h2 className="font-black text-2xl mb-4">Ingreso de Capacitación</h2>
          <p className="text-muted text-sm mb-8">Escanee el código QR o ingrese el código de sesión manual proporcionado por su instructor.</p>
          <div className="flex flex-col gap-4">
            <input 
              placeholder="CÓDIGO (Ej: A1B2C3)" 
              value={manualCode} 
              onChange={e => setManualCode(e.target.value.toUpperCase())} 
              className="text-center text-2xl font-black tracking-widest uppercase h-16"
              maxLength={6}
            />
            <button className="btn btn-primary py-4 font-black" onClick={handleManualAccess}>ACCEDER</button>
            <button className="btn btn-secondary py-3 text-xs" onClick={onBack}>VOLVER AL INICIO</button>
          </div>
        </div>
      </div>
    );
  }

  const mod = data.modules.find(m => m.id === assignment?.moduleId);

  return (
    <div className="max-w-[500px] mx-auto py-10 animate-in">
      <h2 className="text-center font-black text-2xl mb-8">{mod?.name}</h2>
      
      {step === 1 && (
        <div className="card bg-white/5 flex flex-col gap-6 p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg text-accent"><User size={20}/></div>
            <h3 className="font-bold m-0">Datos del Empleado</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label>Nombre y Apellido</label>
              <input placeholder="Ej: JUAN PEREZ" value={user.name} onChange={e=>setUser({...user, name:e.target.value})}/>
            </div>
            <div>
              <label>DNI</label>
              <input placeholder="Ej: 12345678" type="number" value={user.dni} onChange={e=>setUser({...user, dni:e.target.value})}/>
            </div>
          </div>
          <button className="btn btn-primary py-4 font-black mt-4" onClick={()=>setStep(2)}>SIGUIENTE PASO <ChevronRight/></button>
        </div>
      )}

      {step === 2 && (
        <div className="card bg-white/5 flex flex-col gap-6 p-10">
           <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg text-accent"><FileText size={20}/></div>
            <h3 className="font-bold m-0">Firma Digital</h3>
          </div>
          <p className="text-xs text-muted mb-2">Firme en el recuadro blanco usando su dedo o lápiz óptico.</p>
          <div className="signature-wrapper shadow-inner" style={{height:300}}>
            <SignatureComp ref={sig} canvasProps={{style:{width:'100%', height:'100%'}}} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button className="btn btn-secondary py-3" onClick={()=>sig.current?.clear()}>BORRAR</button>
            <button className="btn btn-primary py-4 font-black" onClick={handleConfirm}>CONFIRMAR</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center bg-white/5 py-12 p-10">
          <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-success" size={48}/>
          </div>
          <h3 className="text-2xl font-black mb-2">¡Registro Exitoso!</h3>
          <p className="text-muted text-sm mb-8">Su asistencia ha sido registrada correctamente. Ya puede descargar el material de estudio.</p>
          
          <div className="flex flex-col gap-4">
            {mod?.driveUrl && (
              <a href={mod.driveUrl} target="_blank" className="btn btn-success w-full py-4 font-black flex items-center justify-center gap-3">
                <Download size={20}/> DESCARGAR MATERIAL
              </a>
            )}
            <button className="btn btn-secondary mt-4 w-full py-3" onClick={onBack}>FINALIZAR</button>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'role-select' | 'admin-login' | 'admin' | 'trainer'>('role-select');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [data, setData] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { 
        clients: [], 
        modules: [], 
        assignments: [], 
        records: [], 
        instructorName: 'Adrian Ramundo', 
        instructorRole: 'Seguridad e Higiene', 
        instructorSignature: '' 
      };
    } catch(e) {
      return { clients: [], modules: [], assignments: [], records: [], instructorName: 'Adrian Ramundo', instructorRole: 'Seguridad e Higiene', instructorSignature: '' };
    }
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);
  
  useEffect(() => { 
    if (new URLSearchParams(window.location.search).get('a')) {
      setView('trainer');
    }
  }, []);

  return (
    <div className="container">
      {view === 'role-select' && (
        <div className="animate-in flex flex-col gap-10 items-center justify-center min-h-[85vh]">
          <div className="text-center">
            <h1 className="text-7xl font-black mb-4 tracking-tighter">Trainer<span className="text-accent">Pro</span></h1>
            <p className="text-muted text-xl">Gestión Digital de Capacitaciones y Firmas</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 w-full max-w-[900px]">
            <button className="card group bg-white/5 hover:border-accent p-12 transition-all cursor-pointer flex flex-col items-center gap-6" onClick={()=>setView('admin-login')}>
              <div className="p-4 bg-accent/10 rounded-2xl text-accent group-hover:bg-accent group-hover:text-white transition-all"><Shield size={48}/></div>
              <div className="text-center">
                <div className="font-black text-2xl mb-1">ADMINISTRACIÓN</div>
                <div className="text-xs text-muted">Gestión de sesiones y reportes</div>
              </div>
            </button>
            <button className="card group bg-white/5 hover:border-success p-12 transition-all cursor-pointer flex flex-col items-center gap-6" onClick={()=>setView('trainer')}>
              <div className="p-4 bg-success/10 rounded-2xl text-success group-hover:bg-success group-hover:text-white transition-all"><User size={48}/></div>
              <div className="text-center">
                <div className="font-black text-2xl mb-1">PORTAL EMPLEADO</div>
                <div className="text-xs text-muted">Registro de asistencia y firmas</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === 'admin-login' && (
        <div className="flex items-center justify-center min-h-[85vh] animate-in">
          <div className="card w-full max-w-[440px] bg-white/5 p-10 border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Lock className="text-accent" size={24}/>
              <h2 className="font-black text-2xl m-0">Acceso Seguro</h2>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <label>Contraseña Administrador</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Ingrese clave..." 
                    onKeyDown={e => e.key === 'Enter' && (password === 'admin2025' ? setView('admin') : alert('Incorrecto'))}
                    className="pr-12"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted bg-transparent border-none cursor-pointer">
                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary w-full py-4 font-black" onClick={()=>{ if(password==='admin2025') setView('admin'); else alert('Incorrecto'); }}>ENTRAR AL PANEL</button>
              <button className="btn btn-secondary w-full py-2 text-xs" onClick={()=>setView('role-select')}>VOLVER</button>
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && <AdminPanel data={data} setData={setData} onLogout={()=>setView('role-select')} />}
      {view === 'trainer' && <TrainerPanel data={data} setData={setData} onBack={()=>setView('role-select')} />}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
