
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, ArrowLeft, Eye, EyeOff, 
  QrCode, FileDown, Info, Award, ExternalLink, BookOpen,
  FileText, X, Link as LinkIcon
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces de Datos ---
interface Client { id: string; name: string; cuit: string; }
interface Module { id: string; name: string; driveUrl: string; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface Record { id: string; name: string; dni: string; clientId: string; assignmentId: string; signature: string; timestamp: string; }
interface AppState { clients: Client[]; modules: Module[]; assignments: Assignment[]; records: Record[]; instructorName: string; instructorRole: string; instructorSignature: string; }

const STORAGE_KEY = 'trainer_pro_v8_stable';

const App = () => {
  const [view, setView] = useState<'role-select' | 'admin-login' | 'admin' | 'trainer'>('role-select');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [data, setData] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const defaultState: AppState = { 
        clients: [], 
        modules: [], 
        assignments: [], 
        records: [], 
        instructorName: 'Adrian Ramundo', 
        instructorRole: 'Resp. Higiene y Seguridad de la Empresa',
        instructorSignature: ''
      };
      if (!saved) return defaultState;
      const parsed = JSON.parse(saved);
      return { 
        ...defaultState, 
        ...parsed,
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        modules: Array.isArray(parsed.modules) ? parsed.modules : [],
        assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
        records: Array.isArray(parsed.records) ? parsed.records : []
      };
    } catch (e) {
      console.error("Error loading localStorage", e);
      return { clients: [], modules: [], assignments: [], records: [], instructorName: 'Adrian Ramundo', instructorRole: 'Resp. Higiene y Seguridad', instructorSignature: '' };
    }
  });

  // --- Sincronización Local ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Manejo de parámetros URL (?a=ID) para acceso directo de alumnos vía QR
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('a')) setView('trainer');
  }, []);

  const handleGlobalBack = () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    setView('role-select');
  };

  const handleAdminLogin = () => {
    if (password === 'admin2025') { 
      setView('admin'); 
      setPassword(''); 
    } else { 
      alert('Contraseña incorrecta'); 
    }
  };

  return (
    <div className="container">
      {view === 'role-select' && (
        <div className="animate-in flex flex-col gap-8 items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="text-center">
            <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '0.5rem', color: 'white', letterSpacing: '-0.03em' }}>
              Trainer<span style={{ color: 'var(--accent)' }}>Pro</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Sistema de Gestión de Firmas y Capacitación</p>
          </div>
          <div className="flex gap-4 w-full flex-col md:flex-row" style={{ maxWidth: '600px' }}>
            <button className="card w-full flex flex-col items-center gap-4 hover:scale-[1.03] transition-all cursor-pointer" onClick={() => setView('admin-login')}>
              <Shield size={56} color="var(--accent)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display:'block', fontWeight: 800, fontSize:'1.1rem' }}>ADMINISTRADOR</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Módulos, QR y Planillas PDF</span>
              </div>
            </button>
            <button className="card w-full flex flex-col items-center gap-4 hover:scale-[1.03] transition-all cursor-pointer" onClick={() => setView('trainer')}>
              <User size={56} color="var(--success)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display:'block', fontWeight: 800, fontSize:'1.1rem' }}>OPERARIO / ALUMNO</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firma de asistencia capacitación</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === 'admin-login' && (
        <div className="animate-in flex flex-col items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="card w-full max-w-[400px]">
            <h2 className="mb-6 flex items-center gap-2"><Lock size={20} /> Acceso Restringido</h2>
            <div className="flex flex-col gap-4">
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Contraseña de gestión" 
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                  style={{ paddingRight: '45px' }}
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button className="btn btn-primary w-full" onClick={handleAdminLogin}>Acceder al Panel</button>
              <button className="btn btn-secondary w-full" onClick={handleGlobalBack}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && (
        <AdminPanel 
          data={data} 
          setData={setData} 
          onLogout={handleGlobalBack} 
        />
      )}

      {view === 'trainer' && (
        <TrainerPanel 
          data={data} 
          setData={setData} 
          onBack={handleGlobalBack} 
        />
      )}
    </div>
  );
};

const AdminPanel = ({ data, setData, onLogout }: any) => {
  const [tab, setTab] = useState<'asistencias' | 'asignaciones' | 'config'>('asistencias');
  const instructorSig = useRef<SignatureCanvas>(null);
  const [form, setForm] = useState({ client: '', module: '', driveUrl: '' });

  const generatePDF = (aid: string) => {
    const as = data.assignments.find((x:any)=>x.id===aid);
    if (!as) return;
    const client = data.clients.find((c:any)=>c.id===as.clientId);
    const mod = data.modules.find((m:any)=>m.id===as.moduleId);
    const records = data.records.filter((r:any)=>r.assignmentId===aid);

    const doc = new jsPDF();
    // Cabecera oscura
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); 
    doc.setFontSize(22); 
    doc.text('PLANILLA DE CAPACITACIÓN', 14, 25);
    
    doc.setTextColor(30); 
    doc.setFontSize(11);
    doc.text(`Cliente: ${client?.name || '---'}`, 14, 50);
    doc.text(`Capacitación: ${mod?.name || '---'}`, 14, 57);
    doc.text(`Fecha Generación: ${new Date().toLocaleDateString()}`, 14, 64);
    
    autoTable(doc, {
      startY: 70,
      head: [['#', 'Apellido y Nombre', 'DNI', 'Firma']],
      body: records.map((r:any, i:number)=>[i+1, r.name, r.dni, '']),
      didDrawCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index === 3) {
          const rec = records[dataCell.row.index];
          if (rec?.signature) {
            try { 
              doc.addImage(rec.signature, 'PNG', dataCell.cell.x + 2, dataCell.cell.y + 2, 25, 12); 
            } catch(e) {
              console.error("Error adding signature to PDF", e);
            }
          }
        }
      },
      styles: { minCellHeight: 18, valign: 'middle', fontSize: 10 }
    });
    
    const pageHeight = doc.internal.pageSize.getHeight();
    if (data.instructorSignature) {
      doc.addImage(data.instructorSignature, 'PNG', 140, pageHeight - 45, 45, 20);
    }
    doc.line(140, pageHeight - 25, 195, pageHeight - 25);
    doc.setFontSize(9);
    doc.text(data.instructorName || 'Instructor Responsable', 167.5, pageHeight - 20, { align: 'center' });
    doc.text(data.instructorRole || 'Firma y Sello', 167.5, pageHeight - 15, { align: 'center' });

    doc.save(`Planilla_${client?.name.replace(/\s+/g, '_')}_${as.id}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 600, margin: 2 });
    const doc = new jsPDF();
    doc.setFontSize(26); 
    doc.text('REGISTRO DE ASISTENCIA', 105, 40, {align:'center'});
    doc.addImage(qrData, 'PNG', 55, 60, 100, 100);
    doc.setFontSize(14); 
    doc.text('Escanea este QR para firmar tu asistencia', 105, 175, {align:'center'});
    doc.setFontSize(10); 
    doc.setTextColor(100); 
    doc.text(url, 105, 185, {align:'center'});
    doc.save(`QR_Acceso_${aid}.pdf`);
  };

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center mb-8 py-4 border-b border-border">
        <div>
          <h2 style={{margin:0, fontWeight: 900}}>Panel de Administración</h2>
          <p className="text-xs text-muted">Gestión de empresas y contenidos</p>
        </div>
        <button className="btn btn-secondary" onClick={onLogout}><LogOut size={16} /> Salir</button>
      </header>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <button className={`btn ${tab==='asistencias'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asistencias')}><ClipboardList size={18}/> Asistencias</button>
        <button className={`btn ${tab==='asignaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asignaciones')}><QrCode size={18}/> Generar QR</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}><Users size={18}/> Maestros</button>
      </div>

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-8 animate-in">
          <div className="card">
            <h3 className="mb-4 flex items-center gap-2"><Award size={20} color="var(--accent)" /> Instructor / Empresa</h3>
            <label>Nombre Instructor</label>
            <input value={data.instructorName} onChange={e=>setData({...data, instructorName:e.target.value})} placeholder="Nombre completo" className="mb-4" />
            <label>Cargo / Rol</label>
            <input value={data.instructorRole} onChange={e=>setData({...data, instructorRole:e.target.value})} placeholder="Cargo en la empresa" className="mb-4" />
            <label>Firma Digital (Hológrafa)</label>
            <div className="signature-wrapper mb-4" style={{height:150}}>
              {React.createElement(SignatureCanvas as any, { 
                ref: instructorSig, 
                canvasProps: { style: { width:'100%', height:'100%' } } 
              })}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={()=>{ 
                if(instructorSig.current && !instructorSig.current.isEmpty()) {
                  setData({...data, instructorSignature: instructorSig.current.getTrimmedCanvas().toDataURL()}); 
                  alert('Firma del instructor guardada.'); 
                } else {
                  alert('Debe firmar antes de guardar.');
                }
              }}>Guardar Firma</button>
              <button className="btn btn-secondary" onClick={()=>instructorSig.current?.clear()}>Limpiar</button>
            </div>
          </div>
          <div className="card">
            <h3 className="mb-4 flex items-center gap-2"><ExternalLink size={20} color="var(--accent)" /> Maestros de Datos</h3>
            <div className="flex flex-col gap-6">
              <div>
                <label>Nueva Empresa (Cliente)</label>
                <div className="flex gap-2">
                  <input value={form.client} onChange={e=>setForm({...form, client:e.target.value})} placeholder="Nombre empresa..." />
                  <button className="btn btn-primary" onClick={()=>{ 
                    if(!form.client) return;
                    setData({...data, clients:[...data.clients, {id:Date.now().toString(), name:form.client.toUpperCase(), cuit:''}]}); 
                    setForm({...form, client:''});
                  }}><Plus/></button>
                </div>
              </div>
              <div>
                <label>Nuevo Módulo de Capacitación</label>
                <div className="flex flex-col gap-2">
                  <input value={form.module} onChange={e=>setForm({...form, module:e.target.value})} placeholder="Nombre de capacitación..." />
                  <div className="flex gap-2">
                    <input value={form.driveUrl} onChange={e=>setForm({...form, driveUrl:e.target.value})} placeholder="URL Dropbox/Drive (Opcional)" />
                    <button className="btn btn-primary" onClick={()=>{ 
                      if(!form.module) return;
                      setData({...data, modules:[...data.modules, {id:Date.now().toString(), name:form.module.toUpperCase(), driveUrl:form.driveUrl}]}); 
                      setForm({...form, module:'', driveUrl:''});
                    }}><Plus/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'asignaciones' && (
        <div className="animate-in flex flex-col gap-6">
          <div className="card grid md:grid-cols-3 gap-4 items-end border-accent/20">
            <div>
              <label>Empresa Cliente</label>
              <select id="selClient"><option value="">Seleccione Empresa...</option>{data.clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div>
              <label>Capacitación a Dictar</label>
              <select id="selModule"><option value="">Seleccione Tema...</option>{data.modules.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </div>
            <button className="btn btn-primary" onClick={()=>{
              const cid = (document.getElementById('selClient') as any).value;
              const mid = (document.getElementById('selModule') as any).value;
              if(!cid || !mid) return alert('Seleccione Empresa y Capacitación.');
              setData({...data, assignments:[...data.assignments, {id:Math.random().toString(36).substr(2,8).toUpperCase(), clientId:cid, moduleId:mid, createdAt:new Date().toISOString()}]});
            }}>Generar Acceso QR</button>
          </div>
          
          <div className="flex flex-col gap-3">
            {data.assignments.length === 0 && <p className="text-center text-muted py-8">No hay QR generados.</p>}
            {data.assignments.map((as:any)=>(
              <div key={as.id} className="card flex justify-between items-center py-4 hover:border-accent/30 transition-colors">
                <div>
                  <strong className="text-accent">{data.clients.find((c:any)=>c.id===as.clientId)?.name}</strong>
                  <p className="text-muted text-xs uppercase font-bold tracking-widest mt-1">{data.modules.find((m:any)=>m.id===as.moduleId)?.name}</p>
                </div>
                <div className="flex gap-2">
                  <button title="QR Acceso" className="btn btn-success" style={{padding:'10px'}} onClick={()=>generateQR(as.id)}><QrCode size={18}/></button>
                  <button title="PDF Planilla" className="btn btn-secondary" style={{padding:'10px'}} onClick={()=>generatePDF(as.id)}><FileText size={18}/></button>
                  <button title="Eliminar" className="btn btn-danger" style={{padding:'10px'}} onClick={() => { if(confirm('¿Eliminar registro de capacitación?')) setData({...data, assignments: data.assignments.filter((x:any)=>x.id!==as.id)}) }}><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'asistencias' && (
        <div className="card animate-in overflow-hidden">
          <h3 className="mb-4">Registro de Firmas</h3>
          {data.records.length === 0 ? <p className="text-center text-muted py-12">No hay asistencias registradas aún.</p> : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', minWidth: '600px'}}>
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 px-4">Alumno</th>
                    <th className="pb-3 px-4">DNI</th>
                    <th className="pb-3 px-4">Empresa</th>
                    <th className="pb-3 px-4">Fecha</th>
                    <th className="pb-3 px-4">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r:any)=>(
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">{r.name}</td>
                      <td className="py-3 px-4">{r.dni}</td>
                      <td className="py-3 px-4 text-xs">{data.clients.find((c:any)=>c.id===r.clientId)?.name || '---'}</td>
                      <td className="py-3 px-4 text-xs text-muted">{new Date(r.timestamp).toLocaleDateString()}</td>
                      <td className="py-3 px-4"><img src={r.signature} height="18" style={{background:'white', borderRadius:'2px'}} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TrainerPanel = ({ data, setData, onBack }: any) => {
  const [step, setStep] = useState(0);
  const [assignment, setAssignment] = useState<any>(null);
  const [user, setUser] = useState({ name: '', dni: '' });
  const sig = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get('a');
    if (aid) setAssignment(data.assignments.find((x:any)=>x.id===aid));
  }, [data.assignments]);

  const handleConfirm = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) {
      alert('Por favor, complete sus datos y firme el recuadro.');
      return;
    }
    const rec: Record = { 
      id: Date.now().toString(), 
      name: user.name.toUpperCase().trim(), 
      dni: user.dni.trim(), 
      clientId: assignment.clientId, 
      assignmentId: assignment.id, 
      signature: sig.current!.getTrimmedCanvas().toDataURL(), 
      timestamp: new Date().toISOString() 
    };
    setData({ ...data, records: [rec, ...data.records] });
    setStep(3);
  };

  if (!assignment) return (
    <div className="card text-center py-20 animate-in">
      <Info size={64} color="var(--accent)" className="mx-auto mb-6" />
      <h2 style={{fontSize:'2rem', fontWeight: 900}}>Cámara Requerida</h2>
      <p className="text-muted mb-8">Debes escanear el QR proporcionado para registrarte.</p>
      <button className="btn btn-secondary mx-auto" onClick={onBack}>Volver al Inicio</button>
    </div>
  );

  const activeMod = data.modules.find((m:any)=>m.id===assignment.moduleId);
  const activeCli = data.clients.find((c:any)=>c.id===assignment.clientId);

  return (
    <div className="max-w-[500px] mx-auto animate-in py-8">
      <header className="flex justify-between items-center mb-6 px-2">
        <div>
          <h3 className="text-accent" style={{margin:0}}>{activeMod?.name}</h3>
          <p className="text-xs text-muted">Empresa: {activeCli?.name}</p>
        </div>
        <button onClick={onBack} className="p-2 text-muted hover:text-white"><X size={20}/></button>
      </header>

      {step === 0 && (
        <div className="card text-center gap-6 flex flex-col">
          <Award size={64} className="mx-auto text-success" />
          <div>
            <h2 style={{fontSize: '1.8rem', fontWeight: 800}}>Bienvenido</h2>
            <p className="text-muted">Registro oficial de asistencia para capacitación dictada por <strong>Adrian Ramundo</strong>.</p>
          </div>
          <button className="btn btn-primary w-full py-4 text-lg" onClick={()=>setStep(1)}>Comenzar Registro</button>
        </div>
      )}

      {step === 1 && (
        <div className="card flex flex-col gap-4">
          <h2 style={{fontSize:'1.5rem'}}>Tus Datos</h2>
          <div>
            <label>Apellido y Nombre Completo</label>
            <input value={user.name} onChange={e=>setUser({...user, name:e.target.value})} placeholder="EJ: PEREZ JUAN IGNACIO" />
          </div>
          <div>
            <label>DNI (Solo números)</label>
            <input type="number" value={user.dni} onChange={e=>setUser({...user, dni:e.target.value})} placeholder="EJ: 35123456" />
          </div>
          <button className="btn btn-primary w-full mt-4" onClick={()=>setStep(2)}>Siguiente Paso <ChevronRight size={18}/></button>
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-4">
          <h3>Firma Hológrafa Digital</h3>
          <p className="text-xs text-muted uppercase font-bold">Dibuja tu firma dentro del recuadro blanco</p>
          <div className="signature-wrapper" style={{height:280}}>
            {React.createElement(SignatureCanvas as any, { 
              ref: sig, 
              canvasProps: { style: { width:'100%', height:'100%' } } 
            })}
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1" onClick={()=>sig.current?.clear()}>Limpiar</button>
            <button className="btn btn-primary flex-1" onClick={handleConfirm}>Confirmar Firma</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center flex flex-col gap-8">
          <CheckCircle size={80} color="var(--success)" className="mx-auto" />
          <div>
            <h2 style={{fontSize: '2rem', fontWeight: 900}}>¡Registro Exitoso!</h2>
            <p className="text-muted">Tu asistencia ha sido guardada. Ya puedes cerrar esta ventana.</p>
          </div>
          {activeMod?.driveUrl && (
            <a href={activeMod.driveUrl} target="_blank" className="btn btn-success w-full py-4">
              <BookOpen size={20}/> Ver Material de Capacitación
            </a>
          )}
          <button className="btn btn-primary w-full" onClick={onBack}>Volver al Inicio</button>
        </div>
      )}
    </div>
  );
};

// Punto de entrada React 18
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
