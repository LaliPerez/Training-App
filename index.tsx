
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, Eye, EyeOff, 
  QrCode, Info, Award, ExternalLink, BookOpen,
  FileText, X
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces de Datos ---
interface Client { id: string; name: string; }
interface Module { id: string; name: string; driveUrl: string; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface Record { id: string; name: string; dni: string; clientId: string; assignmentId: string; signature: string; timestamp: string; }
interface AppState { clients: Client[]; modules: Module[]; assignments: Assignment[]; records: Record[]; instructorName: string; instructorRole: string; instructorSignature: string; }

const STORAGE_KEY = 'trainer_pro_final_v1';

const App: React.FC = () => {
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
      return JSON.parse(saved);
    } catch (e) {
      return { clients: [], modules: [], assignments: [], records: [], instructorName: 'Adrian Ramundo', instructorRole: 'Resp. Higiene y Seguridad', instructorSignature: '' };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Capturar el ID de asignación del QR mediante la URL (?a=ID)
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
      alert('Contraseña de administrador incorrecta.'); 
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
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Gestión de Firmas y Capacitación Técnica</p>
          </div>
          <div className="flex gap-4 w-full flex-col md:flex-row" style={{ maxWidth: '600px' }}>
            <button className="card w-full flex flex-col items-center gap-4 hover:scale-[1.03] transition-all cursor-pointer" onClick={() => setView('admin-login')}>
              <Shield size={56} color="var(--accent)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display:'block', fontWeight: 800, fontSize:'1.1rem' }}>ADMINISTRADOR</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configuración y Reportes PDF</span>
              </div>
            </button>
            <button className="card w-full flex flex-col items-center gap-4 hover:scale-[1.03] transition-all cursor-pointer" onClick={() => setView('trainer')}>
              <User size={56} color="var(--success)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display:'block', fontWeight: 800, fontSize:'1.1rem' }}>ALUMNO / OPERARIO</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firma de asistencia capacitaciones</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === 'admin-login' && (
        <div className="animate-in flex flex-col items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="card w-full max-w-[400px]">
            <h2 className="mb-6 flex items-center gap-2"><Lock size={20} /> Panel de Control</h2>
            <div className="flex flex-col gap-4">
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Contraseña de gestión" 
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} 
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button className="btn btn-primary w-full" onClick={handleAdminLogin}>Entrar al Sistema</button>
              <button className="btn btn-secondary w-full" onClick={handleGlobalBack}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && (
        <AdminPanel data={data} setData={setData} onLogout={handleGlobalBack} />
      )}

      {view === 'trainer' && (
        <TrainerPanel data={data} setData={setData} onBack={handleGlobalBack} />
      )}
    </div>
  );
};

const AdminPanel: React.FC<{ data: AppState, setData: any, onLogout: () => void }> = ({ data, setData, onLogout }) => {
  const [tab, setTab] = useState<'asistencias' | 'asignaciones' | 'config'>('asistencias');
  const instructorSig = useRef<any>(null);
  const [form, setForm] = useState({ client: '', module: '', driveUrl: '' });

  const generatePDF = (aid: string) => {
    const as = data.assignments.find((x:any)=>x.id===aid);
    if (!as) return;
    const client = data.clients.find((c:any)=>c.id===as.clientId);
    const mod = data.modules.find((m:any)=>m.id===as.moduleId);
    const records = data.records.filter((r:any)=>r.assignmentId===aid);

    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text('PLANILLA DE CAPACITACIÓN', 14, 25);
    doc.setTextColor(30); doc.setFontSize(11);
    doc.text(`Empresa Cliente: ${client?.name || '---'}`, 14, 50);
    doc.text(`Tema / Módulo: ${mod?.name || '---'}`, 14, 57);
    doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 14, 64);
    
    autoTable(doc, {
      startY: 70,
      head: [['#', 'Nombre y Apellido', 'DNI', 'Firma']],
      body: records.map((r:any, i:number)=>[i+1, r.name, r.dni, '']),
      didDrawCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index === 3) {
          const rec = records[dataCell.row.index];
          if (rec?.signature) {
            try { doc.addImage(rec.signature, 'PNG', dataCell.cell.x + 2, dataCell.cell.y + 1, 25, 12); } catch(e){}
          }
        }
      },
      styles: { minCellHeight: 15, valign: 'middle' }
    });
    
    const pageHeight = doc.internal.pageSize.getHeight();
    if (data.instructorSignature) {
      doc.addImage(data.instructorSignature, 'PNG', 140, pageHeight - 40, 45, 18);
    }
    doc.line(140, pageHeight - 22, 195, pageHeight - 22);
    doc.setFontSize(9);
    doc.text(data.instructorName, 167.5, pageHeight - 17, { align: 'center' });
    doc.text(data.instructorRole, 167.5, pageHeight - 13, { align: 'center' });

    doc.save(`Planilla_${as.id}_${client?.name.replace(/\s+/g, '_')}.pdf`);
  };

  const generateQR = async (aid: string) => {
    const url = `${window.location.origin}${window.location.pathname}?a=${aid}`;
    const qrData = await QRCode.toDataURL(url, { width: 400 });
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('REGISTRO DE ASISTENCIA QR', 105, 40, {align:'center'});
    doc.addImage(qrData, 'PNG', 55, 60, 100, 100);
    doc.setFontSize(12);
    doc.text('Escanea para firmar tu asistencia', 105, 170, {align:'center'});
    doc.save(`QR_Acceso_${aid}.pdf`);
  };

  const SignatureComp = SignatureCanvas as any;

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center mb-8 py-4 border-b border-border">
        <h2 style={{margin:0, fontWeight: 900}}>Panel de Administración</h2>
        <button className="btn btn-secondary" onClick={onLogout}><LogOut size={16} /> Salir</button>
      </header>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <button className={`btn ${tab==='asistencias'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asistencias')}>Asistencias</button>
        <button className={`btn ${tab==='asignaciones'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('asignaciones')}>QR / Accesos</button>
        <button className={`btn ${tab==='config'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('config')}>Configuración</button>
      </div>

      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-8 animate-in">
          <div className="card">
            <h3 className="mb-4">Datos del Instructor</h3>
            <label>Nombre Completo</label>
            <input value={data.instructorName} onChange={e=>setData({...data, instructorName:e.target.value})} className="mb-4" />
            <label>Cargo / Rol</label>
            <input value={data.instructorRole} onChange={e=>setData({...data, instructorRole:e.target.value})} className="mb-4" />
            <label>Firma Digitalizada</label>
            <div className="signature-wrapper mb-4" style={{height:150}}>
              <SignatureComp ref={instructorSig} canvasProps={{style:{width:'100%', height:'100%'}}} />
            </div>
            <div className="flex gap-2">
                <button className="btn btn-primary flex-1" onClick={()=>{ 
                if(instructorSig.current && !instructorSig.current.isEmpty()) {
                    setData({...data, instructorSignature: instructorSig.current.getTrimmedCanvas().toDataURL()}); 
                    alert('Firma guardada correctamente.');
                }
                }}>Guardar Firma</button>
                <button className="btn btn-secondary" onClick={()=>instructorSig.current?.clear()}>Limpiar</button>
            </div>
          </div>
          <div className="card">
            <h3 className="mb-4">Maestros de Datos</h3>
            <label>Agregar Empresa (Cliente)</label>
            <div className="flex gap-2 mb-6">
              <input value={form.client} onChange={e=>setForm({...form, client:e.target.value})} placeholder="Nombre empresa" />
              <button className="btn btn-primary" onClick={()=>{if(!form.client)return;setData({...data, clients:[...data.clients, {id:Date.now().toString(), name:form.client.toUpperCase()}]}); setForm({...form, client:''})}}><Plus/></button>
            </div>
            <label>Agregar Módulo de Capacitación</label>
            <div className="flex flex-col gap-2">
              <input value={form.module} onChange={e=>setForm({...form, module:e.target.value})} placeholder="Título capacitación" />
              <div className="flex gap-2">
                <input value={form.driveUrl} onChange={e=>setForm({...form, driveUrl:e.target.value})} placeholder="URL Dropbox/Drive material" />
                <button className="btn btn-primary" onClick={()=>{if(!form.module)return;setData({...data, modules:[...data.modules, {id:Date.now().toString(), name:form.module.toUpperCase(), driveUrl:form.driveUrl}]}); setForm({...form, module:'', driveUrl:''})}}><Plus/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'asignaciones' && (
        <div className="animate-in">
          <div className="card grid md:grid-cols-3 gap-4 items-end mb-6">
            <div>
              <label>Seleccionar Empresa</label>
              <select id="selClient"><option value="">Empresa...</option>{data.clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div>
              <label>Seleccionar Capacitación</label>
              <select id="selModule"><option value="">Módulo...</option>{data.modules.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </div>
            <button className="btn btn-primary" onClick={()=>{
              const cid = (document.getElementById('selClient') as any).value;
              const mid = (document.getElementById('selModule') as any).value;
              if(!cid || !mid) return alert('Debe seleccionar Empresa y Módulo.');
              setData({...data, assignments:[...data.assignments, {id:Math.random().toString(36).substr(2,6).toUpperCase(), clientId:cid, moduleId:mid, createdAt:new Date().toISOString()}]});
            }}>Generar QR de Asistencia</button>
          </div>
          {data.assignments.length === 0 && <p className="text-center text-muted py-10">No hay accesos QR generados aún.</p>}
          {data.assignments.map((as:any)=>(
            <div key={as.id} className="card flex justify-between items-center py-4 hover:border-accent/30 transition-colors">
              <div>
                <strong>{data.clients.find((c:any)=>c.id===as.clientId)?.name}</strong>
                <p className="text-muted text-xs uppercase font-bold tracking-widest mt-1">{data.modules.find((m:any)=>m.id===as.moduleId)?.name}</p>
              </div>
              <div className="flex gap-2">
                <button title="Descargar QR" className="btn btn-success" onClick={()=>generateQR(as.id)} style={{padding:'10px'}}><QrCode size={18}/></button>
                <button title="Generar Planilla PDF" className="btn btn-secondary" onClick={()=>generatePDF(as.id)} style={{padding:'10px'}}><FileText size={18}/></button>
                <button title="Eliminar" className="btn btn-danger" onClick={()=>{if(confirm('¿Eliminar capacitación?'))setData({...data, assignments: data.assignments.filter((x:any)=>x.id!==as.id)})}} style={{padding:'10px'}}><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'asistencias' && (
        <div className="card animate-in overflow-hidden">
          <h3 className="mb-4">Registro Histórico de Firmas</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', minWidth: '600px'}}>
                <thead>
                <tr className="border-b border-border">
                    <th style={{textAlign:'left', padding:'12px'}}>Alumno</th>
                    <th style={{textAlign:'left', padding:'12px'}}>DNI</th>
                    <th style={{textAlign:'left', padding:'12px'}}>Empresa</th>
                    <th style={{textAlign:'left', padding:'12px'}}>Módulo</th>
                    <th style={{textAlign:'left', padding:'12px'}}>Firma</th>
                </tr>
                </thead>
                <tbody>
                {data.records.map((r:any)=>(
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td style={{padding:'12px'}}>{r.name}</td>
                    <td style={{padding:'12px'}}>{r.dni}</td>
                    <td style={{padding:'12px'}} className="text-xs">{data.clients.find((c:any)=>c.id===r.clientId)?.name}</td>
                    <td style={{padding:'12px'}} className="text-xs">{data.assignments.find((a:any)=>a.id===r.assignmentId) ? data.modules.find((m:any)=>m.id===data.assignments.find((a:any)=>a.id===r.assignmentId).moduleId)?.name : '---'}</td>
                    <td style={{padding:'12px'}}><img src={r.signature} height="20" style={{background:'white', borderRadius:'4px'}} /></td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>
          {data.records.length === 0 && <p className="text-center text-muted py-10">No hay firmas registradas.</p>}
        </div>
      )}
    </div>
  );
};

const TrainerPanel: React.FC<{ data: AppState, setData: any, onBack: () => void }> = ({ data, setData, onBack }) => {
  const [step, setStep] = useState(0);
  const [assignment, setAssignment] = useState<any>(null);
  const [user, setUser] = useState({ name: '', dni: '' });
  const sig = useRef<any>(null);

  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get('a');
    if (aid) {
      const found = data.assignments.find((x:any)=>x.id===aid);
      if (found) setAssignment(found);
    }
  }, [data.assignments]);

  const handleConfirm = () => {
    if (!user.name || !user.dni || sig.current?.isEmpty()) return alert('Debe completar sus datos y su firma.');
    const rec: Record = { 
      id: Date.now().toString(), 
      name: user.name.toUpperCase().trim(), 
      dni: user.dni.trim(), 
      clientId: assignment.clientId, 
      assignmentId: assignment.id, 
      signature: sig.current.getTrimmedCanvas().toDataURL(), 
      timestamp: new Date().toISOString() 
    };
    setData({ ...data, records: [rec, ...data.records] });
    setStep(3);
  };

  const SignatureComp = SignatureCanvas as any;

  if (!assignment) return (
    <div className="card text-center py-20 animate-in">
      <Info size={64} color="var(--accent)" className="mx-auto mb-6" />
      <h2 style={{fontWeight: 900}}>Acceso no identificado</h2>
      <p className="text-muted mb-8">Por favor, escanea un código QR válido proporcionado por el instructor.</p>
      <button className="btn btn-secondary mx-auto" onClick={onBack}>Volver al Inicio</button>
    </div>
  );

  const activeMod = data.modules.find((m:any)=>m.id===assignment.moduleId);
  const activeCli = data.clients.find((c:any)=>c.id===assignment.clientId);

  return (
    <div className="max-w-[500px] mx-auto animate-in py-8">
      <header className="mb-8 text-center">
        <h3 className="text-accent" style={{margin:0, fontWeight: 800}}>{activeMod?.name}</h3>
        <p className="text-sm text-muted">Empresa: {activeCli?.name}</p>
      </header>

      {step === 0 && (
        <div className="card text-center gap-6 flex flex-col">
          <Award size={64} className="mx-auto text-success" />
          <div>
            <h2 style={{fontSize: '1.8rem', fontWeight: 900}}>Bienvenido</h2>
            <p className="text-muted">Inicia el registro oficial de tu asistencia a esta capacitación técnica.</p>
          </div>
          <button className="btn btn-primary w-full py-4 text-lg" onClick={()=>setStep(1)}>Comenzar Firma</button>
        </div>
      )}

      {step === 1 && (
        <div className="card flex flex-col gap-4">
          <h2 style={{fontSize:'1.5rem'}}>Tus Datos Personales</h2>
          <div>
            <label>Nombre y Apellido Completo</label>
            <input value={user.name} onChange={e=>setUser({...user, name:e.target.value})} placeholder="EJ: JUAN PEREZ" />
          </div>
          <div>
            <label>DNI (Sin puntos ni espacios)</label>
            <input type="number" value={user.dni} onChange={e=>setUser({...user, dni:e.target.value})} placeholder="EJ: 35123456" />
          </div>
          <button className="btn btn-primary w-full mt-4" onClick={()=>setStep(2)}>Siguiente Paso <ChevronRight size={18}/></button>
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-4">
          <h3>Firma Hológrafa Digital</h3>
          <p className="text-xs text-muted uppercase font-bold">Dibuja tu firma dentro del recuadro blanco</p>
          <div className="signature-wrapper" style={{height:300}}>
            <SignatureComp ref={sig} canvasProps={{style:{width:'100%', height:'100%'}}} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={()=>sig.current?.clear()}>Limpiar</button>
            <button className="btn btn-primary flex-1" onClick={handleConfirm}>Finalizar Registro</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center flex flex-col gap-8">
          <CheckCircle size={80} color="var(--success)" className="mx-auto" />
          <div>
            <h2 style={{fontSize: '2rem', fontWeight: 900}}>¡Registro Exitoso!</h2>
            <p className="text-muted">Tu asistencia ha sido guardada en la planilla digital.</p>
          </div>
          {activeMod?.driveUrl && (
            <a href={activeMod.driveUrl} target="_blank" className="btn btn-success w-full py-4 shadow-lg shadow-success/20">
              <BookOpen size={20}/> Ver Material de Capacitación
            </a>
          )}
          <button className="btn btn-secondary w-full" onClick={onBack}>Cerrar</button>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
