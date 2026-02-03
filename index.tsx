
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

// --- Desregistrar Service Workers para evitar conflictos de caché ---
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

// Manejo robusto de la importación de SignatureCanvas para ESM
const SignatureComp = (SignatureCanvas as any).default || SignatureCanvas;

// --- Interfaces de Datos ---
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

const STORAGE_KEY = 'trainer_pro_v5_final';

// --- COMPONENTE: PANEL DE ADMINISTRACIÓN ---
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
    
    doc.save(`Reporte_Capacitacion_${as.id}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 500 });
    const doc = new jsPDF();
    doc.text('REGISTRO DE ASISTENCIA', 105, 30, {align:'center'});
    doc.addImage(qrData, 'PNG', 55, 50, 100, 100);
    doc.text(`ESCANEÁ PARA REGISTRARTE`, 105, 160, {align:'center'});
    doc.text(`CÓDIGO: ${aid}`, 105, 170, {align:'center'});
    doc.save(`QR_Acceso_${aid}.pdf`);
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
        <h2 className="font-black text-2xl">Panel de Control</h2>
        <button className="btn btn-secondary text-danger" onClick={onLogout}><LogOut size={18}/> Salir</button>
      </header>

      <nav className="flex gap-2 mb-10 overflow-x-auto no-scrollbar">
        <button className={`btn ${tab==='overview'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('overview')}><BarChart3 size={18}/> Resumen</button>
        <button className={`btn ${tab==='operaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('operaciones')}><QrCode size={18}/> Sesiones</button>
        <button className={`btn ${tab==='asistencias'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asistencias')}><Users size={18}/> Firmas</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><ClipboardList size={18}/> Ajustes</button>
      </nav>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="card text-center bg-white/5 p-8 border-white/5">
            <span className="text-4xl font-black">{stats.totalFirmas}</span>
            <p className="text-muted text-xs uppercase mt-2">Firmas Totales</p>
          </div>
          <div className="card text-center bg-white/5 p-8 border-white/5">
            <span className="text-4xl font-black">{stats.totalActivas}</span>
            <p className="text-muted text-xs uppercase mt-2">Sesiones QR</p>
          </div>
          <div className="card text-center bg-white/5 p-8 border-white/5">
            <span className="text-4xl font-black">{stats.totalClientes}</span>
            <p className="text-muted text-xs uppercase mt-2">Clientes</p>
          </div>
          <div className="card text-center bg-white/5 p-8 border-white/5">
            <span className="text-4xl font-black">{stats.totalModulos}</span>
            <p className="text-muted text-xs uppercase mt-2">Módulos</p>
          </div>
        </div>
      )}

      {tab === 'operaciones' && (
        <div className="animate-in">
          <div className="card bg-accent/5 grid grid-cols-1 md:grid-cols-3 gap-6 p-8 mb-8 border-accent/20">
            <div>
              <label>Seleccionar Empresa</label>
              <select id="sCli" className="h-14 mt-1">
                <option value="">-- Seleccionar --</option>
                {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label>Seleccionar Módulo</label>
              <select id="sMod" className="h-14 mt-1">
                <option value="">-- Seleccionar --</option>
                {data.modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary h-14 w-full" onClick={()=>{
                const c = (document.getElementById('sCli') as any).value;
                const m = (document.getElementById('sMod') as any).value;
                if(!c || !m) return alert('Seleccioná Empresa y Módulo.');
                setData({...data, assignments:[...data.assignments, {id:Math.random().toString(36).substr(2,6).toUpperCase(), clientId:c, moduleId:m, createdAt:new Date().toISOString()}]});
              }}>VINCULAR Y CREAR QR</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.assignments.map(as=>(
              <div key={as.id} className="card bg-white/5 p-6 border-white/5 flex flex-col justify-between">
                <div>
                  <div className="font-black text-accent text-lg mb-1">{data.clients.find(c=>c.id===as.clientId)?.name}</div>
                  <div className="text-sm mb-4 font-semibold text-muted">{data.modules.find(m=>m.id===as.moduleId)?.name}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-secondary flex-1" title="Descargar QR" onClick={()=>generateQR(as.id)}><QrCode size={16}/></button>
                  <button className="btn btn-secondary flex-1" title="Generar Acta PDF" onClick={()=>generatePDF(as.id)}><Download size={16}/></button>
                  <button className="btn btn-secondary text-danger" title="Eliminar" onClick={()=>{if(confirm('¿Eliminar sesión?'))setData({...data, assignments:data.assignments.filter(x=>x.id!==as.id)})}}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card bg-white/5 p-8 border-white/5">
            <h3 className="font-bold mb-6 flex items-center gap-2"><Briefcase size={20}/> Gestión de Empresas</h3>
            <input placeholder="Nombre de la nueva empresa" value={form.client} onChange={e=>setForm({...form, client:e.target.value})} className="mb-4"/>
            <button className="btn btn-primary w-full" onClick={()=>{
              if(!form.client) return;
              setData({...data, clients:[...data.clients, {id:Date.now().toString(), name:form.client.toUpperCase()}]});
              setForm({...form, client:''});
            }}>AGREGAR EMPRESA</button>
            <div className="mt-6 flex flex-wrap gap-2">
              {data.clients.map(c=>(
                <div key={c.id} className="bg-white/5 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  {c.name} 
                  <X size={12} className="cursor-pointer text-danger" onClick={()=>setData({...data, clients: data.clients.filter(x=>x.id!==c.id)})}/>
                </div>
              ))}
            </div>
          </div>
          <div className="card bg-white/5 p-8 border-white/5">
            <h3 className="font-bold mb-6 flex items-center gap-2"><Layers size={20}/> Gestión de Módulos</h3>
            <input placeholder="Nombre del tema / módulo" value={form.module} onChange={e=>setForm({...form, module:e.target.value})} className="mb-4"/>
            <input placeholder="Link de Material (Dropbox / Drive)" value={form.driveUrl} onChange={e=>setForm({...form, driveUrl:e.target.value})} className="mb-4"/>
            <button className="btn btn-primary w-full" onClick={()=>{
              if(!form.module) return;
              setData({...data, modules:[...data.modules, {id:Date.now().toString(), name:form.module.toUpperCase(), driveUrl:form.driveUrl}]});
              setForm({...form, module:'', driveUrl:''});
            }}>AGREGAR MÓDULO</button>
            <div className="mt-6 flex flex-col gap-2">
              {data.modules.map(m=>(
                <div key={m.id} className="bg-white/5 px-3 py-2 rounded-lg text-xs flex justify-between items-center">
                  <span>{m.name}</span>
                  <X size={12} className="cursor-pointer text-danger" onClick={()=>setData({...data, modules: data.modules.filter(x=>x.id!==m.id)})}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'asistencias' && (
        <div className="card bg-white/5 overflow-hidden p-0 border-white/5">
          <div className="p-4 border-b border-white/5">
            <input placeholder="Buscar por nombre o DNI..." onChange={e=>setSearchTerm(e.target.value)}/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-white/10 text-muted uppercase text-[10px] tracking-widest">
                <th className="p-4">Empleado</th>
                <th className="p-4">DNI</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Firma</th>
              </tr></thead>
              <tbody>
                {data.records.filter(r=>r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.dni.includes(searchTerm)).map(r=>(
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold">{r.name}</td>
                    <td className="p-4">{r.dni}</td>
                    <td className="p-4">{data.clients.find(c=>c.id===r.clientId)?.name}</td>
                    <td className="p-4 text-xs text-muted">{new Date(r.timestamp).toLocaleDateString()}</td>
                    <td className="p-4"><img src={r.signature} height="24" className="bg-white rounded px-1"/></td>
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

// --- COMPONENTE: PORTAL DE USUARIO (EMPLEADO) ---
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
    if (found) { setAssignment(found); setStep(1); } else alert('Código de sesión no válido.');
  };

  const handleSave = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Por favor, completá todos los campos y firmá.');
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
      <div className="card bg-white/5 p-10 text-center border-white/5 shadow-2xl">
        <div className="icon-container mx-auto mb-6 bg-accent/10 text-accent"><QrCode size={32}/></div>
        <h2 className="font-black text-2xl mb-2">Portal Empleado</h2>
        <p className="text-muted text-sm mb-8">Ingresá el código de 6 caracteres que ves en pantalla para registrar tu asistencia.</p>
        <input placeholder="CÓDIGO DE SESIÓN" maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="text-center mb-6 h-16 text-3xl font-black tracking-widest bg-bg border-white/10"/>
        <button className="btn btn-primary w-full h-14 font-black" onClick={handleAccess}>INGRESAR AHORA</button>
        <button className="btn btn-secondary w-full mt-4" onClick={onBack}>VOLVER AL INICIO</button>
      </div>
    </div>
  );

  const mod = data.modules.find(m=>m.id===assignment?.moduleId);

  return (
    <div className="max-w-[500px] mx-auto py-10 animate-in">
      {step === 1 && (
        <div className="card bg-white/5 p-10 border-white/5">
          <h2 className="font-black text-2xl mb-1 text-accent">Tus Datos</h2>
          <p className="text-muted text-sm mb-8">Completá tu información para el certificado.</p>
          <div className="mb-4">
            <label>Nombre y Apellido Completo</label>
            <input placeholder="Ej: JUAN PEREZ" value={user.name} onChange={e=>setUser({...user, name:e.target.value})} className="mt-1"/>
          </div>
          <div className="mb-8">
            <label>DNI / Documento</label>
            <input placeholder="Ej: 35123456" type="number" value={user.dni} onChange={e=>setUser({...user, dni:e.target.value})} className="mt-1"/>
          </div>
          <button className="btn btn-primary w-full h-14 font-black" onClick={()=>setStep(2)}>SIGUIENTE PASO <ChevronRight/></button>
        </div>
      )}
      {step === 2 && (
        <div className="card bg-white/5 p-8 border-white/5">
          <h2 className="font-black text-2xl mb-2 text-accent">Firma Digital</h2>
          <p className="text-muted text-sm mb-6">Firma con tu dedo en el recuadro blanco.</p>
          <div className="signature-wrapper mb-6" style={{height:300}}>
            <SignatureComp ref={sig} canvasProps={{style:{width:'100%', height:'100%'}}}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button className="btn btn-secondary py-4" onClick={()=>sig.current?.clear()}>BORRAR</button>
            <button className="btn btn-primary py-4 font-black" onClick={handleSave}>CONFIRMAR</button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="card bg-white/5 p-10 text-center border-white/5 shadow-2xl">
          <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48}/>
          </div>
          <h2 className="font-black text-3xl mb-4">¡Registro Exitoso!</h2>
          <p className="text-muted mb-10">Tu asistencia ha sido guardada. Si el instructor habilitó material, podés descargarlo aquí abajo.</p>
          
          <div className="flex flex-col gap-4">
            {mod?.driveUrl && (
              <a href={mod.driveUrl} target="_blank" className="btn btn-success h-16 w-full text-lg font-black">
                <Download size={24}/> DESCARGAR MATERIAL
              </a>
            )}
            <button className="btn btn-secondary w-full py-4 mt-6" onClick={onBack}>FINALIZAR</button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE RAÍZ: APLICACIÓN ---
const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'portal'>('home');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  const [data, setData] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { 
      clients: [], 
      modules: [], 
      assignments: [], 
      records: [], 
      instructorName: 'Adrian Ramundo', 
      instructorRole: 'Instructor Técnico', 
      instructorSignature: '' 
    };
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('a')) setView('portal');
  }, []);

  return (
    <div className="container">
      {view === 'home' && (
        <div className="flex flex-col items-center justify-center min-h-[85vh] animate-in text-center">
          <div className="mb-12">
            <h1 className="text-7xl font-black mb-2 tracking-tighter">Trainer<span className="text-accent">Pro</span></h1>
            <p className="text-muted text-lg font-medium opacity-60">SISTEMA INTEGRAL DE CAPACITACIONES</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl">
            <button className="card group bg-white/5 p-12 hover:border-accent transition-all cursor-pointer border-white/5" onClick={()=>setView('login')}>
              <div className="p-5 bg-accent/10 rounded-2xl text-accent group-hover:bg-accent group-hover:text-white transition-all mx-auto w-fit mb-6"><Shield size={48}/></div>
              <div className="font-black text-xl">ADMINISTRADOR</div>
              <p className="text-xs text-muted mt-2">Gestión de sesiones, reportes y PDF</p>
            </button>
            <button className="card group bg-white/5 p-12 hover:border-success transition-all cursor-pointer border-white/5" onClick={()=>setView('portal')}>
              <div className="p-5 bg-success/10 rounded-2xl text-success group-hover:bg-success group-hover:text-white transition-all mx-auto w-fit mb-6"><User size={48}/></div>
              <div className="font-black text-xl">PORTAL EMPLEADO</div>
              <p className="text-xs text-muted mt-2">Registrar firma y ver material</p>
            </button>
          </div>
          <div className="mt-16 text-[10px] text-muted tracking-widest font-bold opacity-30">© 2025 TRAINERPRO SYSTEMS</div>
        </div>
      )}

      {view === 'login' && (
        <div className="flex items-center justify-center min-h-[85vh] animate-in">
          <div className="card w-full max-w-sm bg-white/5 p-12 border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Lock size={24} className="text-accent"/>
              <h2 className="font-black text-2xl m-0">Acceso Admin</h2>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <label>Contraseña Maestra</label>
                <div className="relative mt-2">
                  <input 
                    type={showPass ? "text" : "password"} 
                    placeholder="Contraseña" 
                    value={pass} 
                    onChange={e=>setPass(e.target.value)} 
                    onKeyDown={e=> e.key === 'Enter' && (pass==='admin2025' ? setView('admin') : alert('Contraseña Incorrecta'))}
                    className="pr-12"
                  />
                  <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted bg-transparent border-none cursor-pointer">
                    {showPass ? <EyeOff size={20}/> : <Eye size={20}/>}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary w-full py-4 font-black" onClick={()=>{ if(pass==='admin2025') setView('admin'); else alert('Contraseña Incorrecta'); }}>ENTRAR AL PANEL</button>
              <button className="btn btn-secondary w-full mt-2" onClick={()=>setView('home')}>VOLVER</button>
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && <AdminPanel data={data} setData={setData} onLogout={()=>setView('home')}/>}
      {view === 'portal' && <UserPortal data={data} setData={setData} onBack={()=>setView('home')}/>}
    </div>
  );
};

// Montaje de la aplicación
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
