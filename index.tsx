
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, Eye, EyeOff, 
  QrCode, FileText, X, Download, BarChart3, Info
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fix for SignatureCanvas module structure
const SignatureComp = (SignatureCanvas as any).default || SignatureCanvas;

const STORAGE_KEY = 'trainer_pro_final_v5';

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
}

// --- Componente Administrador ---
const AdminDashboard: React.FC<{ data: AppState, setData: any, onLogout: () => void }> = ({ data, setData, onLogout }) => {
  const [tab, setTab] = useState<'overview' | 'asistencias' | 'config' | 'operaciones'>('overview');
  const [form, setForm] = useState({ client: '', module: '', driveUrl: '' });

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
    doc.setFontSize(18);
    doc.text('ESCANEÉ PARA FIRMAR ASISTENCIA', 105, 30, { align: 'center' });
    doc.addImage(qrData, 'PNG', 55, 50, 100, 100);
    doc.save(`QR_Sesion_${aid}.pdf`);
  };

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center py-6 border-b border-white/5 mb-8">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>Panel de Control</h2>
        <button className="btn btn-secondary text-danger" onClick={onLogout}><LogOut size={18}/> Salir</button>
      </header>

      <nav className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        <button className={`btn ${tab==='overview'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Resumen</button>
        <button className={`btn ${tab==='operaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('operaciones')}><QrCode size={18}/> Sesiones</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><ClipboardList size={18}/> Ajustes</button>
      </nav>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2">
          <div className="card text-center">
            <div className="icon-container mx-auto bg-accent/10"><Users size={32} className="text-accent"/></div>
            <div className="text-4xl font-black">{data.records.length}</div>
            <div className="text-muted text-xs font-bold uppercase tracking-widest mt-2">Firmas Registradas</div>
          </div>
          <div className="card text-center">
            <div className="icon-container mx-auto bg-success/10"><CheckCircle size={32} className="text-success"/></div>
            <div className="text-4xl font-black">{data.assignments.length}</div>
            <div className="text-muted text-xs font-bold uppercase tracking-widest mt-2">Sesiones Generadas</div>
          </div>
        </div>
      )}

      {tab === 'operaciones' && (
        <div className="flex flex-col gap-6">
          <div className="card bg-accent/5 border-accent/20">
            <h3 className="mb-4 font-black">Abrir Nueva Capacitación</h3>
            <div className="grid md:grid-cols-2">
              <div>
                <label>Empresa Cliente</label>
                <select id="selCli">
                  <option value="">-- Seleccionar --</option>
                  {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Módulo Técnico</label>
                <select id="selMod">
                  <option value="">-- Seleccionar --</option>
                  {data.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary w-full mt-6" onClick={() => {
              const cid = (document.getElementById('selCli') as HTMLSelectElement).value;
              const mid = (document.getElementById('selMod') as HTMLSelectElement).value;
              if(!cid || !mid) return alert('Seleccione cliente y módulo');
              setData({...data, assignments: [...data.assignments, {id: Math.random().toString(36).substr(2,6).toUpperCase(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString()}]});
            }}>INICIAR SESIÓN DE FIRMAS</button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3">
            {data.assignments.map(as => {
              const cli = data.clients.find(c => c.id === as.clientId);
              const mod = data.modules.find(m => m.id === as.moduleId);
              return (
                <div key={as.id} className="card p-6">
                  <div className="text-xs font-black text-accent mb-2">ID: {as.id}</div>
                  <div className="font-bold mb-1">{cli?.name}</div>
                  <div className="text-sm text-muted mb-6">{mod?.name}</div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary flex-1" onClick={() => generateQR(as.id)} title="QR"><QrCode size={18}/></button>
                    <button className="btn btn-secondary flex-1" onClick={() => generatePDF(as.id)} title="Reporte"><Download size={18}/></button>
                    <button className="btn btn-secondary text-danger" onClick={() => setData({...data, assignments: data.assignments.filter(x => x.id !== as.id)})}><Trash2 size={18}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="grid md:grid-cols-2">
          <div className="card">
            <h3 className="mb-4 font-black">Gestión de Clientes</h3>
            <div className="flex gap-2 mb-6">
              <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nombre Empresa"/>
              <button className="btn btn-primary" onClick={() => { if(form.client) { setData({...data, clients: [...data.clients, {id: Date.now().toString(), name: form.client.toUpperCase()}]}); setForm({...form, client: ''}); } }}><Plus/></button>
            </div>
            {data.clients.map(c => <div key={c.id} className="text-sm p-3 bg-white/5 mb-2 rounded-lg flex justify-between items-center">{c.name} <button className="bg-transparent border-none text-muted hover:text-danger cursor-pointer" onClick={() => setData({...data, clients: data.clients.filter(x => x.id !== c.id)})}><Trash2 size={14}/></button></div>)}
          </div>
          <div className="card">
            <h3 className="mb-4 font-black">Módulos de Capacitación</h3>
            <div className="flex flex-col gap-3 mb-6">
              <input value={form.module} onChange={e => setForm({...form, module: e.target.value})} placeholder="Nombre del Módulo"/>
              <input value={form.driveUrl} onChange={e => setForm({...form, driveUrl: e.target.value})} placeholder="URL Material (Drive/Dropbox)"/>
              <button className="btn btn-primary" onClick={() => { if(form.module) { setData({...data, modules: [...data.modules, {id: Date.now().toString(), name: form.module.toUpperCase(), driveUrl: form.driveUrl}]}); setForm({...form, module: '', driveUrl: ''}); } }}>AÑADIR CAPACITACIÓN</button>
            </div>
            {data.modules.map(m => <div key={m.id} className="text-sm p-3 bg-white/5 mb-2 rounded-lg flex justify-between items-center">{m.name} <button className="bg-transparent border-none text-muted hover:text-danger cursor-pointer" onClick={() => setData({...data, modules: data.modules.filter(x => x.id !== m.id)})}><Trash2 size={14}/></button></div>)}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Portal de Usuario (Firma) ---
const UserPortal: React.FC<{ data: AppState, setData: any, onBack: () => void }> = ({ data, setData, onBack }) => {
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
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Complete todos los campos y firme en el recuadro.');
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
    <div className="max-w-[440px] mx-auto py-20 text-center animate-in">
      <div className="icon-container mx-auto bg-accent/10"><Info size={32} className="text-accent"/></div>
      <h2 className="font-black text-2xl mb-4">Acceso Pendiente</h2>
      <p className="text-muted mb-8">Debe escanear el código QR proporcionado por el instructor para acceder a la firma de asistencia.</p>
      <button className="btn btn-secondary w-full" onClick={onBack}>VOLVER AL MENÚ</button>
    </div>
  );

  const mod = data.modules.find(m => m.id === assignment.moduleId);

  return (
    <div className="max-w-[500px] mx-auto py-10 animate-in">
      <h2 className="text-center font-black text-2xl mb-10 text-accent">{mod?.name}</h2>
      
      {step === 1 && (
        <div className="card">
          <label>Nombre y Apellido Completo</label>
          <input className="mb-4" value={user.name} onChange={e => setUser({...user, name: e.target.value})} placeholder="Ej: JUAN PEREZ"/>
          <label>DNI / Identificación</label>
          <input className="mb-6" value={user.dni} onChange={e => setUser({...user, dni: e.target.value})} placeholder="Sin puntos ni espacios" type="number"/>
          <button className="btn btn-primary w-full" onClick={() => setStep(2)}>IR A FIRMAR <ChevronRight size={18}/></button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <label>Firma en el recuadro blanco</label>
          <div className="signature-wrapper mb-6" style={{ height: 320 }}>
            <SignatureComp ref={sig} canvasProps={{ style: { width: '100%', height: '100%' } }} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => sig.current?.clear()}>BORRAR</button>
            <button className="btn btn-primary flex-1" onClick={handleConfirm}>REGISTRAR</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center py-12">
          <div className="bg-success/20 p-6 rounded-full text-success mb-6 inline-flex"><CheckCircle size={54}/></div>
          <h2 className="font-black text-2xl mb-2">¡Firma Registrada!</h2>
          <p className="text-muted mb-10">Su asistencia ha sido guardada en el sistema.</p>
          {mod?.driveUrl && (
            <a href={mod.driveUrl} target="_blank" className="btn btn-primary w-full mb-4"><Download size={18}/> DESCARGAR MATERIAL</a>
          )}
          <button className="btn btn-secondary w-full" onClick={onBack}>FINALIZAR</button>
        </div>
      )}
    </div>
  );
};

// --- Lógica Principal ---
const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'employee'>('home');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [data, setData] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { clients: [], modules: [], assignments: [], records: [], instructorName: 'Instructor', instructorRole: 'Trainer' };
    } catch {
      return { clients: [], modules: [], assignments: [], records: [], instructorName: 'Instructor', instructorRole: 'Trainer' };
    }
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('a')) setView('employee');
  }, []);

  return (
    <div className="container">
      {view === 'home' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-in">
          <div className="mb-4 text-accent font-black tracking-widest text-sm">TRAINER PRO v5.0</div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>Portal de<br/><span className="text-accent">Capacitación</span></h1>
          <p className="text-muted text-lg mb-12 max-w-[500px]">Gestione asistencias de forma digital y proporcione material técnico a sus empleados.</p>
          <div className="grid md:grid-cols-2 w-full max-w-[800px]">
            <div className="card hover:border-accent cursor-pointer group" onClick={() => setView('login')}>
              <div className="icon-container bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors"><Shield size={32}/></div>
              <div className="font-black text-xl">ADMINISTRADOR</div>
              <p className="text-sm text-muted mt-2">Control de sesiones y reportes PDF</p>
            </div>
            <div className="card hover:border-success cursor-pointer group" onClick={() => setView('employee')}>
              <div className="icon-container bg-success/10 text-success group-hover:bg-success group-hover:text-white transition-colors"><User size={32}/></div>
              <div className="font-black text-xl">EMPLEADO</div>
              <p className="text-sm text-muted mt-2">Firma de asistencia y descarga</p>
            </div>
          </div>
        </div>
      )}

      {view === 'login' && (
        <div className="flex items-center justify-center min-h-[80vh] animate-in">
          <div className="card w-full max-w-[400px]">
            <h2 className="font-black text-2xl mb-8 flex items-center gap-2"><Lock className="text-accent" size={24}/> Acceso Seguro</h2>
            <div className="relative mb-6">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Clave de administrador"/>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted cursor-pointer" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            <button className="btn btn-primary w-full py-4 mb-4" onClick={() => pass === 'admin123' ? setView('admin') : alert('Contraseña Incorrecta')}>ENTRAR AL PANEL</button>
            <button className="btn btn-secondary w-full" onClick={() => setView('home')}>VOLVER AL INICIO</button>
          </div>
        </div>
      )}

      {view === 'admin' && <AdminDashboard data={data} setData={setData} onLogout={() => setView('home')} />}
      {view === 'employee' && <UserPortal data={data} setData={setData} onBack={() => setView('home')} />}
    </div>
  );
};

// Render Defensivo
const init = () => {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(<App />);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
