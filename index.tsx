
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

// --- Desregistrar Service Workers ---
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

const SignatureComp = (SignatureCanvas as any).default || SignatureCanvas;

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

const STORAGE_KEY = 'trainer_pro_v4_core';

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
    doc.setFontSize(24); 
    doc.text('ACTA DE CAPACITACIÓN', 14, 30);
    
    doc.setTextColor(30, 30, 30); 
    doc.setFontSize(12);
    doc.text(`Empresa: ${client?.name || '---'}`, 14, 65);
    doc.text(`Temática: ${mod?.name || '---'}`, 14, 73);
    doc.text(`Instructor: ${data.instructorName}`, 14, 81);
    doc.text(`Fecha: ${new Date(as.createdAt).toLocaleDateString()}`, 14, 89);
    
    autoTable(doc, {
      startY: 100,
      head: [['#', 'Nombre', 'DNI', 'Firma']],
      body: records.map((r, i)=>[i+1, r.name, r.dni, '']),
      didDrawCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index === 3) {
          const rec = records[dataCell.row.index];
          if (rec?.signature) {
            try { doc.addImage(rec.signature, 'PNG', dataCell.cell.x + 2, dataCell.cell.y + 1, 30, 14); } catch(e){}
          }
        }
      },
      styles: { minCellHeight: 18, valign: 'middle' }
    });
    
    doc.save(`Reporte_${as.id}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 500 });
    const doc = new jsPDF();
    doc.text('REGISTRO DE ASISTENCIA', 105, 30, {align:'center'});
    doc.addImage(qrData, 'PNG', 55, 50, 100, 100);
    doc.text(`CÓDIGO: ${aid}`, 105, 160, {align:'center'});
    doc.save(`QR_${aid}.pdf`);
  };

  const stats = useMemo(() => ({
    totalFirmas: data.records.length,
    totalClientes: data.clients.length,
    totalModulos: data.modules.length,
    totalActivas: data.assignments.length
  }), [data]);

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center mb-10 py-6 border-b border-white/5">
        <h2 className="font-black text-2xl">Panel Admin</h2>
        <button className="btn btn-secondary text-danger" onClick={onLogout}><LogOut size={18}/> Salir</button>
      </header>

      <nav className="flex gap-2 mb-10 overflow-x-auto no-scrollbar">
        <button className={`btn ${tab==='overview'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Resumen</button>
        <button className={`btn ${tab==='operaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('operaciones')}><QrCode size={18}/> Sesiones</button>
        <button className={`btn ${tab==='asistencias'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asistencias')}><Users size={18}/> Firmas</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><ClipboardList size={18}/> Config</button>
      </nav>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="card text-center bg-white/5 p-8">
            <span className="text-4xl font-black">{stats.totalFirmas}</span>
            <p className="text-muted text-xs uppercase mt-2">Firmas</p>
          </div>
          <div className="card text-center bg-white/5 p-8">
            <span className="text-4xl font-black">{stats.totalActivas}</span>
            <p className="text-muted text-xs uppercase mt-2">Sesiones</p>
          </div>
          <div className="card text-center bg-white/5 p-8">
            <span className="text-4xl font-black">{stats.totalClientes}</span>
            <p className="text-muted text-xs uppercase mt-2">Empresas</p>
          </div>
          <div className="card text-center bg-white/5 p-8">
            <span className="text-4xl font-black">{stats.totalModulos}</span>
            <p className="text-muted text-xs uppercase mt-2">Módulos</p>
          </div>
        </div>
      )}

      {tab === 'operaciones' && (
        <div className="animate-in">
          <div className="card bg-accent/5 grid grid-cols-1 md:grid-cols-3 gap-6 p-8 mb-8 border-accent/20">
            <select id="sCli" className="h-14"><option value="">Empresa</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select id="sMod" className="h-14"><option value="">Módulo</option>{data.modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <button className="btn btn-primary h-14" onClick={()=>{
              const c = (document.getElementById('sCli') as any).value;
              const m = (document.getElementById('sMod') as any).value;
              if(!c || !m) return alert('Campos incompletos');
              setData({...data, assignments:[...data.assignments, {id:Math.random().toString(36).substr(2,6).toUpperCase(), clientId:c, moduleId:m, createdAt:new Date().toISOString()}]});
            }}>CREAR SESIÓN</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.assignments.map(as=>(
              <div key={as.id} className="card bg-white/5 p-6 border-white/5">
                <div className="font-black text-accent text-lg mb-2">{data.clients.find(c=>c.id===as.clientId)?.name}</div>
                <div className="text-sm mb-4">{data.modules.find(m=>m.id===as.moduleId)?.name}</div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary flex-1" onClick={()=>generateQR(as.id)}><QrCode size={16}/></button>
                  <button className="btn btn-secondary flex-1" onClick={()=>generatePDF(as.id)}><Download size={16}/></button>
                  <button className="btn btn-secondary text-danger" onClick={()=>{if(confirm('Borrar?'))setData({...data, assignments:data.assignments.filter(x=>x.id!==as.id)})}}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card bg-white/5 p-8">
            <h3 className="font-bold mb-6">Nuevo Módulo</h3>
            <input placeholder="Nombre" value={form.module} onChange={e=>setForm({...form, module:e.target.value})} className="mb-4"/>
            <input placeholder="Link Material (Dropbox)" value={form.driveUrl} onChange={e=>setForm({...form, driveUrl:e.target.value})} className="mb-4"/>
            <button className="btn btn-primary w-full" onClick={()=>{
              if(!form.module) return;
              setData({...data, modules:[...data.modules, {id:Date.now().toString(), name:form.module, driveUrl:form.driveUrl}]});
              setForm({...form, module:'', driveUrl:''});
            }}>AGREGAR</button>
          </div>
          <div className="card bg-white/5 p-8">
            <h3 className="font-bold mb-6">Nueva Empresa</h3>
            <input placeholder="Nombre empresa" value={form.client} onChange={e=>setForm({...form, client:e.target.value})} className="mb-4"/>
            <button className="btn btn-primary w-full" onClick={()=>{
              if(!form.client) return;
              setData({...data, clients:[...data.clients, {id:Date.now().toString(), name:form.client}]});
              setForm({...form, client:''});
            }}>AGREGAR</button>
          </div>
        </div>
      )}

      {tab === 'asistencias' && (
        <div className="card bg-white/5 overflow-hidden p-0">
          <div className="p-4 border-b border-white/5"><input placeholder="Buscar empleado..." onChange={e=>setSearchTerm(e.target.value)}/></div>
          <table className="w-full text-sm text-left">
            <thead><tr className="bg-white/5"><th>Empleado</th><th>DNI</th><th>Empresa</th><th>Firma</th></tr></thead>
            <tbody>
              {data.records.filter(r=>r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(r=>(
                <tr key={r.id} className="border-b border-white/5">
                  <td>{r.name}</td><td>{r.dni}</td><td>{data.clients.find(c=>c.id===r.clientId)?.name}</td><td><img src={r.signature} height="20"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const UserPortal: React.FC<{ data: AppState, setData: any, onBack: () => void }> = ({ data, setData, onBack }) => {
  const [step, setStep] = useState(0);
  const [assignment, setAssignment] = useState<any>(null);
  const [code, setCode] = useState('');
  const [user, setUser] = useState({ name: '', dni: '' });
  const sig = useRef<any>(null);

  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get('a');
    if (aid) {
      const found = data.assignments.find(x => x.id === aid);
      if (found) { setAssignment(found); setStep(1); }
    }
  }, [data.assignments]);

  const handleAccess = () => {
    const found = data.assignments.find(x => x.id.toUpperCase() === code.trim().toUpperCase());
    if (found) { setAssignment(found); setStep(1); } else alert('Código inválido');
  };

  const handleSave = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Complete todo');
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

  if (step === 0) return (
    <div className="max-w-[400px] mx-auto py-10 animate-in">
      <div className="card bg-white/5 p-10 text-center">
        <h2 className="font-black text-2xl mb-8">Portal Empleado</h2>
        <input placeholder="CÓDIGO DE SESIÓN" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="text-center mb-6 h-16 text-2xl font-black"/>
        <button className="btn btn-primary w-full h-14" onClick={handleAccess}>CONTINUAR</button>
        <button className="btn btn-secondary w-full mt-4" onClick={onBack}>VOLVER</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[500px] mx-auto py-10 animate-in">
      {step === 1 && (
        <div className="card bg-white/5 p-10">
          <h2 className="font-bold mb-8">Sus Datos</h2>
          <input placeholder="Nombre Completo" value={user.name} onChange={e=>setUser({...user, name:e.target.value})} className="mb-4"/>
          <input placeholder="DNI" value={user.dni} onChange={e=>setUser({...user, dni:e.target.value})} className="mb-8"/>
          <button className="btn btn-primary w-full h-14" onClick={()=>setStep(2)}>SIGUIENTE</button>
        </div>
      )}
      {step === 2 && (
        <div className="card bg-white/5 p-10">
          <h2 className="font-bold mb-4">Firma Digital</h2>
          <div className="signature-wrapper mb-6" style={{height:300}}><SignatureComp ref={sig} canvasProps={{style:{width:'100%', height:'100%'}}}/></div>
          <button className="btn btn-primary w-full h-14" onClick={handleSave}>CONFIRMAR FIRMA</button>
          <button className="btn btn-secondary w-full mt-4" onClick={()=>sig.current?.clear()}>BORRAR</button>
        </div>
      )}
      {step === 3 && (
        <div className="card bg-white/5 p-10 text-center">
          <CheckCircle className="text-success mx-auto mb-6" size={64}/>
          <h2 className="font-black text-2xl mb-4">¡Registrado!</h2>
          {data.modules.find(m=>m.id===assignment.moduleId)?.driveUrl && (
            <a href={data.modules.find(m=>m.id===assignment.moduleId)?.driveUrl} target="_blank" className="btn btn-success h-14 w-full">DESCARGAR MATERIAL</a>
          )}
          <button className="btn btn-secondary w-full mt-4" onClick={onBack}>FINALIZAR</button>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'portal'>('home');
  const [pass, setPass] = useState('');
  
  const [data, setData] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { clients: [], modules: [], assignments: [], records: [], instructorName: 'Adrian Ramundo', instructorRole: 'Seguridad e Higiene', instructorSignature: '' };
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('a')) setView('portal');
  }, []);

  return (
    <div className="container">
      {view === 'home' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in text-center">
          <h1 className="text-6xl font-black mb-10">Trainer<span className="text-accent">Pro</span></h1>
          <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button className="card bg-white/5 p-10 hover:border-accent" onClick={()=>setView('login')}>
              <Shield size={48} className="mx-auto mb-4 text-accent"/>
              <div className="font-bold">ADMINISTRADOR</div>
            </button>
            <button className="card bg-white/5 p-10 hover:border-success" onClick={()=>setView('portal')}>
              <User size={48} className="mx-auto mb-4 text-success"/>
              <div className="font-bold">PORTAL EMPLEADO</div>
            </button>
          </div>
        </div>
      )}
      {view === 'login' && (
        <div className="flex items-center justify-center min-h-[80vh] animate-in">
          <div className="card w-full max-w-sm bg-white/5 p-10">
            <h2 className="font-bold mb-8">Acceso Admin</h2>
            <input type="password" placeholder="Clave" value={pass} onChange={e=>setPass(e.target.value)} className="mb-6"/>
            <button className="btn btn-primary w-full" onClick={()=>{ if(pass==='admin2025') setView('admin'); else alert('Incorrecto'); }}>ENTRAR</button>
            <button className="btn btn-secondary w-full mt-4" onClick={()=>setView('home')}>VOLVER</button>
          </div>
        </div>
      )}
      {view === 'admin' && <AdminPanel data={data} setData={setData} onLogout={()=>setView('home')}/>}
      {view === 'portal' && <UserPortal data={data} setData={setData} onBack={()=>setView('home')}/>}
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
