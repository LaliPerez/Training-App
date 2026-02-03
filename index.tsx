
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, Eye, EyeOff, 
  QrCode, Award, BookOpen, FileText, X, Download, 
  BarChart3, Briefcase, Link as LinkIcon, Info
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const SignatureComp = (SignatureCanvas as any).default || SignatureCanvas;
const STORAGE_KEY = 'trainer_pro_core_v4';

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

// --- Componente Administrador ---
const AdminDashboard: React.FC<{ data: AppState, setData: any, onLogout: () => void }> = ({ data, setData, onLogout }) => {
  const [tab, setTab] = useState<'overview' | 'asistencias' | 'config' | 'operaciones'>('overview');
  const [form, setForm] = useState({ client: '', module: '', driveUrl: '' });
  const instructorSig = useRef<any>(null);

  const generatePDF = (aid: string) => {
    const as = data.assignments.find(x => x.id === aid);
    if (!as) return;
    const client = data.clients.find(c => c.id === as.clientId);
    const mod = data.modules.find(m => m.id === as.moduleId);
    const records = data.records.filter(r => r.assignmentId === aid);

    const doc = new jsPDF();
    doc.setFillColor(3, 7, 18); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text('ACTA DE CAPACITACIÓN', 14, 25);
    
    doc.setTextColor(30, 30, 30); doc.setFontSize(10);
    doc.text(`EMPRESA: ${client?.name || '---'}`, 14, 50);
    doc.text(`TEMÁTICA: ${mod?.name || '---'}`, 14, 56);
    doc.text(`FECHA: ${new Date(as.createdAt).toLocaleDateString()}`, 14, 62);

    autoTable(doc, {
      startY: 70,
      head: [['#', 'NOMBRE', 'DNI', 'FIRMA']],
      body: records.map((r, i) => [i + 1, r.name, r.dni, '']),
      didDrawCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index === 3) {
          const rec = records[dataCell.row.index];
          if (rec?.signature) doc.addImage(rec.signature, 'PNG', dataCell.cell.x + 2, dataCell.cell.y + 1, 25, 12);
        }
      },
      headStyles: { fillColor: [59, 130, 246] },
      styles: { minCellHeight: 15, valign: 'middle' }
    });

    doc.save(`Reporte_${aid}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 400 });
    const doc = new jsPDF();
    doc.text('ESCANEÉ PARA FIRMAR ASISTENCIA', 105, 30, { align: 'center' });
    doc.addImage(qrData, 'PNG', 55, 50, 100, 100);
    doc.save(`QR_Sesion_${aid}.pdf`);
  };

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center py-8 border-b border-white/5 mb-8">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Panel de Control</h2>
        <button className="btn btn-secondary text-danger" onClick={onLogout}><LogOut size={18}/> Salir</button>
      </header>

      <nav className="flex gap-4 mb-8 overflow-x-auto pb-2 no-scrollbar">
        <button className={`btn ${tab==='overview'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Resumen</button>
        <button className={`btn ${tab==='operaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('operaciones')}><QrCode size={18}/> Sesiones</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><ClipboardList size={18}/> Ajustes</button>
      </nav>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card text-center">
            <div className="icon-container mx-auto mb-4 bg-accent/10"><Users size={32} className="text-accent"/></div>
            <div className="text-4xl font-black">{data.records.length}</div>
            <div className="text-muted text-sm font-bold uppercase tracking-widest mt-2">Firmas Totales</div>
          </div>
          <div className="card text-center">
            <div className="icon-container mx-auto mb-4 bg-success/10"><CheckCircle size={32} className="text-success"/></div>
            <div className="text-4xl font-black">{data.assignments.length}</div>
            <div className="text-muted text-sm font-bold uppercase tracking-widest mt-2">Sesiones Activas</div>
          </div>
        </div>
      )}

      {tab === 'operaciones' && (
        <div className="flex flex-col gap-6">
          <div className="card bg-accent/5 border-accent/20">
            <h3 className="mb-6 font-black">Nueva Sesión de Capacitación</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <select id="selCli">
                <option value="">-- Seleccionar Empresa --</option>
                {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select id="selMod">
                <option value="">-- Seleccionar Módulo --</option>
                {data.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary w-full" onClick={() => {
              const cid = (document.getElementById('selCli') as HTMLSelectElement).value;
              const mid = (document.getElementById('selMod') as HTMLSelectElement).value;
              if(!cid || !mid) return alert('Seleccione cliente y módulo');
              setData({...data, assignments: [...data.assignments, {id: Math.random().toString(36).substr(2,6).toUpperCase(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString()}]});
            }}>CREAR SESIÓN Y GENERAR QR</button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.assignments.map(as => {
              const cli = data.clients.find(c => c.id === as.clientId);
              const mod = data.modules.find(m => m.id === as.moduleId);
              return (
                <div key={as.id} className="card p-6">
                  <div className="text-xs font-black text-accent mb-2">ID: {as.id}</div>
                  <div className="font-bold text-lg mb-1">{cli?.name}</div>
                  <div className="text-sm text-muted mb-6">{mod?.name}</div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary flex-1" onClick={() => generateQR(as.id)}><QrCode size={18}/></button>
                    <button className="btn btn-secondary flex-1" onClick={() => generatePDF(as.id)}><Download size={18}/></button>
                    <button className="btn btn-secondary text-danger" onClick={() => setData({...data, assignments: data.assignments.filter(x => x.id !== as.id)})}><Trash2 size={18}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="mb-4 font-black">Empresas</h3>
            <div className="flex gap-2 mb-4">
              <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nombre Empresa"/>
              <button className="btn btn-primary" onClick={() => { if(form.client) { setData({...data, clients: [...data.clients, {id: Date.now().toString(), name: form.client.toUpperCase()}]}); setForm({...form, client: ''}); } }}><Plus/></button>
            </div>
            {data.clients.map(c => <div key={c.id} className="text-sm p-2 bg-white/5 mb-1 rounded flex justify-between">{c.name} <button onClick={() => setData({...data, clients: data.clients.filter(x => x.id !== c.id)})}><X size={14}/></button></div>)}
          </div>
          <div className="card">
            <h3 className="mb-4 font-black">Módulos</h3>
            <div className="flex flex-col gap-2 mb-4">
              <input value={form.module} onChange={e => setForm({...form, module: e.target.value})} placeholder="Título Módulo"/>
              <input value={form.driveUrl} onChange={e => setForm({...form, driveUrl: e.target.value})} placeholder="URL Dropbox/Drive"/>
              <button className="btn btn-primary" onClick={() => { if(form.module) { setData({...data, modules: [...data.modules, {id: Date.now().toString(), name: form.module.toUpperCase(), driveUrl: form.driveUrl}]}); setForm({...form, module: '', driveUrl: ''}); } }}>AÑADIR MÓDULO</button>
            </div>
            {data.modules.map(m => <div key={m.id} className="text-sm p-2 bg-white/5 mb-1 rounded flex justify-between">{m.name} <button onClick={() => setData({...data, modules: data.modules.filter(x => x.id !== m.id)})}><X size={14}/></button></div>)}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Componente Empleado ---
const EmployeePortal: React.FC<{ data: AppState, setData: any, onBack: () => void }> = ({ data, setData, onBack }) => {
  const [step, setStep] = useState(0);
  const [assignment, setAssignment] = useState<any>(null);
  const [user, setUser] = useState({ name: '', dni: '' });
  const sig = useRef<any>(null);

  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get('a');
    if (aid) {
      const found = data.assignments.find(x => x.id === aid);
      if (found) { setAssignment(found); setStep(1); }
    }
  }, [data.assignments]);

  const handleConfirm = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Complete todos los campos');
    const rec: Record = { 
      id: Date.now().toString(), 
      name: user.name.toUpperCase(), 
      dni: user.dni, 
      clientId: assignment.clientId, 
      assignmentId: assignment.id, 
      signature: sig.current.getTrimmedCanvas().toDataURL(), 
      timestamp: new Date().toISOString() 
    };
    setData({...data, records: [rec, ...data.records]});
    setStep(3);
  };

  if (step === 0) return (
    <div className="max-w-[400px] mx-auto py-20 text-center animate-in">
      <div className="icon-container mx-auto mb-6 bg-accent/10"><Info size={40} className="text-accent"/></div>
      <h2 className="font-black text-2xl mb-4">Acceso Inválido</h2>
      <p className="text-muted mb-8">Debe escanear un código QR válido proporcionado por su instructor.</p>
      <button className="btn btn-secondary w-full" onClick={onBack}>VOLVER AL INICIO</button>
    </div>
  );

  const mod = data.modules.find(m => m.id === assignment.moduleId);

  return (
    <div className="max-w-[500px] mx-auto py-10 animate-in">
      <h2 className="text-center font-black text-2xl mb-10">{mod?.name}</h2>
      
      {step === 1 && (
        <div className="card flex flex-col gap-6">
          <label>Nombre y Apellido</label>
          <input value={user.name} onChange={e => setUser({...user, name: e.target.value})} placeholder="Ej: JUAN PEREZ"/>
          <label>DNI</label>
          <input value={user.dni} onChange={e => setUser({...user, dni: e.target.value})} placeholder="Ej: 30123456" type="number"/>
          <button className="btn btn-primary w-full mt-4" onClick={() => setStep(2)}>CONTINUAR <ChevronRight/></button>
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-6">
          <label>Firma Digital</label>
          <div className="signature-wrapper" style={{ height: 300 }}>
            <SignatureComp ref={sig} canvasProps={{ style: { width: '100%', height: '100%' } }} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => sig.current?.clear()}>LIMPIAR</button>
            <button className="btn btn-primary flex-1" onClick={handleConfirm}>CONFIRMAR</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center flex flex-col items-center py-12">
          <div className="bg-success/20 p-6 rounded-full text-success mb-6"><CheckCircle size={60}/></div>
          <h2 className="font-black text-3xl mb-4">¡Registrado!</h2>
          <p className="text-muted mb-10">Su asistencia ha sido guardada con éxito.</p>
          {mod?.driveUrl && (
            <a href={mod.driveUrl} target="_blank" className="btn btn-primary w-full mb-4"><Download/> DESCARGAR MATERIAL</a>
          )}
          <button className="btn btn-secondary w-full" onClick={onBack}>FINALIZAR</button>
        </div>
      )}
    </div>
  );
};

// --- Aplicación Principal ---
const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'employee'>('home');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [data, setData] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { clients: [], modules: [], assignments: [], records: [], instructorName: 'Instructor', instructorRole: 'Trainer', instructorSignature: '' };
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('a')) setView('employee');
  }, []);

  return (
    <div className="container">
      {view === 'home' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-in">
          <h1 style={{ fontSize: '4rem', fontWeight: 900, marginBottom: '1rem' }}>Trainer<span className="text-accent">Pro</span></h1>
          <p className="text-muted text-xl mb-12">Gestión Digital de Capacitaciones</p>
          <div className="grid md:grid-cols-2 gap-6 w-full max-w-[800px]">
            <div className="card hover:border-accent cursor-pointer flex flex-col items-center" onClick={() => setView('login')}>
              <div className="icon-container bg-accent/10 mb-4"><Shield className="text-accent" size={32}/></div>
              <div className="font-black text-xl">ADMINISTRADOR</div>
              <p className="text-xs text-muted mt-2">Configuración y Reportes</p>
            </div>
            <div className="card hover:border-success cursor-pointer flex flex-col items-center" onClick={() => setView('employee')}>
              <div className="icon-container bg-success/10 mb-4"><User className="text-success" size={32}/></div>
              <div className="font-black text-xl">EMPLEADO</div>
              <p className="text-xs text-muted mt-2">Firmar Asistencia</p>
            </div>
          </div>
        </div>
      )}

      {view === 'login' && (
        <div className="flex items-center justify-center min-h-[80vh] animate-in">
          <div className="card w-full max-w-[400px]">
            <h2 className="font-black text-2xl mb-8 flex items-center gap-2"><Lock className="text-accent"/> Acceso</h2>
            <div className="relative mb-6">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Contraseña Administrador"/>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
            <button className="btn btn-primary w-full py-4 mb-4" onClick={() => pass === 'admin123' ? setView('admin') : alert('Incorrecta')}>INGRESAR</button>
            <button className="btn btn-secondary w-full" onClick={() => setView('home')}>VOLVER</button>
          </div>
        </div>
      )}

      {view === 'admin' && <AdminDashboard data={data} setData={setData} onLogout={() => setView('home')} />}
      {view === 'employee' && <EmployeePortal data={data} setData={setData} onBack={() => setView('home')} />}
    </div>
  );
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
