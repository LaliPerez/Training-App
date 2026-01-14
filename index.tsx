
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, User, Users, ClipboardList, LogOut, CheckCircle, 
  ChevronRight, Trash2, Plus, Lock, ArrowLeft, Eye, EyeOff, 
  QrCode, FileDown, Info, Award, ExternalLink, BookOpen,
  FileText, X
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces ---
interface Client { 
  id: string; 
  name: string; 
  cuit: string; 
}
interface Module { 
  id: string; 
  name: string; 
  driveUrl: string; 
}
interface Assignment {
  id: string;
  clientId: string;
  moduleId: string;
  createdAt: string;
}
interface Record { 
  id: string; 
  name: string; 
  dni: string; 
  clientId: string;
  assignmentId: string; 
  signature: string; 
  timestamp: string; 
}

interface AppState {
  clients: Client[];
  modules: Module[];
  assignments: Assignment[];
  records: Record[];
  instructorName: string;
  instructorRole: string;
  instructorSignature: string; // Base64
}

const STORAGE_KEY = 'trainer_pro_v5_data';
const SYNC_KEY_STORAGE = 'trainer_sync_key';
const SYNC_API = 'https://keyvalue.xyz/1'; 

const App = () => {
  const [view, setView] = useState<'role-select' | 'admin-login' | 'admin' | 'trainer'>('role-select');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  
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
      return { ...defaultState, ...parsed };
    } catch (e) {
      return { clients: [], modules: [], assignments: [], records: [], instructorName: '', instructorRole: '', instructorSignature: '' };
    }
  });

  // --- Remote Sync ---
  const fetchRemote = async (keyToUse: string) => {
    if (!keyToUse) return;
    try {
      const res = await fetch(`${SYNC_API}/${keyToUse}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const remoteData = JSON.parse(text);
          if (remoteData && typeof remoteData === 'object' && Array.isArray(remoteData.records)) {
            setData(prev => {
              if (JSON.stringify(prev) === JSON.stringify(remoteData)) return prev;
              return { ...prev, ...remoteData };
            });
            setSyncStatus('success');
          }
        }
      }
    } catch (e) {
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    let key = localStorage.getItem(SYNC_KEY_STORAGE);
    if (!key) {
      key = 'TP_AUTO_' + Math.random().toString(36).substring(2, 12).toUpperCase();
      localStorage.setItem(SYNC_KEY_STORAGE, key);
    }
    fetchRemote(key);
    const pollInterval = setInterval(() => fetchRemote(key!), 30000); 
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const key = localStorage.getItem(SYNC_KEY_STORAGE);
    if (!key) return;

    const timeoutId = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await fetch(`${SYNC_API}/${key}`, {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' }
        });
        setSyncStatus('success');
      } catch (e) {
        setSyncStatus('error');
      }
    }, 2000); 

    return () => clearTimeout(timeoutId);
  }, [data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('a')) setView('trainer');
  }, []);

  const handleAdminLogin = () => {
    if (password === 'admin2025') { 
      setView('admin');
      setPassword('');
    } else {
      alert('Contraseña errónea.');
    }
  };

  const handleGlobalBack = () => {
    // Correctamente limpia el parámetro 'a' de la URL sin recargar la página
    const url = new URL(window.location.href);
    url.searchParams.delete('a');
    // Usamos url.href para mantener la ruta exacta pero sin el parámetro de capacitación
    window.history.replaceState({}, '', url.href);
    setView('role-select');
  };

  return (
    <div className="container">
      {view === 'role-select' && (
        <div className="animate-in flex flex-col gap-8 items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="text-center">
            <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Trainer<span style={{ color: 'var(--accent)' }}>Pro</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Gestión profesional de capacitaciones</p>
          </div>
          <div className="flex gap-6 w-full flex-col md:flex-row" style={{ maxWidth: '600px' }}>
            <button type="button" className="card w-full flex flex-col items-center gap-4 transition-all hover:scale-[1.02]" onClick={() => setView('admin-login')} style={{ cursor: 'pointer', border: '1px solid var(--border)' }}>
              <Shield size={56} color="var(--accent)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '1.2rem' }}>ADMINISTRADOR</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configuración y Reportes</span>
              </div>
            </button>
            <button type="button" className="card w-full flex flex-col items-center gap-4 transition-all hover:scale-[1.02]" onClick={() => setView('trainer')} style={{ cursor: 'pointer', border: '1px solid var(--border)' }}>
              <User size={56} color="var(--success)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '1.2rem' }}>ALUMNO</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firmar Asistencia</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === 'admin-login' && (
        <div className="animate-in flex flex-col gap-6 items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="card w-full" style={{ maxWidth: '400px' }}>
            <h2 className="flex items-center gap-3 mb-6"><Lock size={24} color="var(--accent)" /> Acceso Admin</h2>
            <div className="flex flex-col gap-5">
              <div>
                <label>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} 
                    style={{ paddingRight: '45px' }} 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button type="button" className="btn btn-primary w-full" onClick={handleAdminLogin}>Entrar</button>
              <button type="button" className="btn btn-secondary w-full" onClick={handleGlobalBack}>Volver</button>
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && (
        <AdminPanel 
          data={data} 
          setData={setData} 
          onLogout={handleGlobalBack} 
          syncStatus={syncStatus}
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

const AdminPanel = ({ data, setData, onLogout, syncStatus }: any) => {
  const [activeTab, setActiveTab] = useState<'asistencias' | 'asignaciones' | 'config'>('asistencias');
  const instructorSigCanvas = useRef<SignatureCanvas>(null);

  const [newClientName, setNewClientName] = useState('');
  const [newClientCuit, setNewClientCuit] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDriveUrl, setNewModuleDriveUrl] = useState('');

  const [selClientId, setSelClientId] = useState('');
  const [selModuleId, setSelModuleId] = useState('');

  const saveInstructorSignature = () => {
    if (instructorSigCanvas.current?.isEmpty()) return alert("Firme primero en el panel.");
    const signature = instructorSigCanvas.current!.getTrimmedCanvas().toDataURL('image/png');
    setData({ ...data, instructorSignature: signature });
    alert("Firma guardada correctamente.");
  };

  const generatePDF = (assignmentId: string) => {
    const assignment = data.assignments.find((a: any) => a.id === assignmentId);
    if (!assignment) return;
    const client = data.clients.find((c: any) => c.id === assignment.clientId);
    const module = data.modules.find((m: any) => m.id === assignment.moduleId);
    const records = data.records.filter((r: any) => r.assignmentId === assignmentId);

    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    
    // Header Bar Dark
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, width, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSTANCIA DE CAPACITACION', 14, 25);
    
    // Info Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información de la Formación:', 14, 55);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${client?.name || 'N/A'} ${client?.cuit ? `(CUIT: ${client.cuit})` : ''}`, 14, 65);
    doc.text(`Capacitación: ${module?.name || 'N/A'}`, 14, 72);

    const tableData = records.map((r: any) => [
      new Date(r.timestamp).toLocaleDateString(),
      r.name,
      r.dni,
      '' // Signature placeholder
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Fecha', 'Apellido y Nombre', 'DNI', 'Firma']],
      body: tableData,
      didDrawCell: (cellData: any) => {
        if (cellData.section === 'body' && cellData.column.index === 3) {
          const record = records[cellData.row.index];
          if (record && record.signature) {
            try {
              doc.addImage(record.signature, 'PNG', cellData.cell.x + 2, cellData.cell.y + 2, 26, 11);
            } catch (e) {
              console.error("Error adding signature to PDF", e);
            }
          }
        }
      },
      styles: { 
        minCellHeight: 16, 
        valign: 'middle', 
        fontSize: 9,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 30 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 40 }
      }
    });

    // Instructor Signature Block - Bottom Right
    // @ts-ignore
    const finalY = doc.lastAutoTable?.finalY || 200;
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = Math.max(finalY + 40, pageHeight - 60);
    const rightX = width - 14;

    if (data.instructorSignature) {
      try {
        doc.addImage(data.instructorSignature, 'PNG', rightX - 50, footerY - 25, 45, 20);
      } catch (e) {
        console.error("Error adding instructor signature", e);
      }
    }
    
    doc.setDrawColor(30, 41, 59);
    doc.line(rightX - 65, footerY + 2, rightX, footerY + 2);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Firma del Instructor', rightX, footerY + 8, { align: 'right' });
    doc.text(data.instructorName || 'N/A', rightX, footerY + 14, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.instructorRole || 'N/A', rightX, footerY + 20, { align: 'right' });

    doc.save(`Planilla_${client?.name.replace(/\s+/g, '_')}.pdf`);
  };

  const generateAccessFlyer = async (assignmentId: string) => {
    const assignment = data.assignments.find((a: any) => a.id === assignmentId);
    if (!assignment) return;
    const client = data.clients.find((c: any) => c.id === assignment.clientId);
    const module = data.modules.find((m: any) => m.id === assignment.moduleId);
    
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header Bar Dark
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, width, 55, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCESO A CAPACITACIÓN DIGITAL', width / 2, 32, { align: 'center' });
    
    // Solicitante Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SOLICITANTE:', 14, 75);
    doc.setFont('helvetica', 'normal');
    doc.text(client?.name.toUpperCase() || 'N/A', 14, 83);
    
    // Módulo Section
    doc.setFont('helvetica', 'bold');
    doc.text('MÓDULO:', 14, 100);
    doc.setFontSize(30);
    doc.text(`${module?.name.toUpperCase() || 'N/A'}`, 14, 118);
    
    const baseUrl = window.location.origin + window.location.pathname;
    const fullUrl = `${baseUrl}?a=${assignment.id}`;
    
    // QR Code Large Centered
    const qrDataUrl = await QRCode.toDataURL(fullUrl, { errorCorrectionLevel: 'H', margin: 1, width: 600 });
    doc.addImage(qrDataUrl, 'PNG', (width - 120) / 2, 135, 120, 120);
    
    // URL and Footer Text
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(fullUrl, width / 2, 265, { align: 'center', maxWidth: 180 });
    
    doc.setTextColor(100);
    doc.setFontSize(12);
    doc.text('Escanee el código QR para registrar su asistencia.', width / 2, 275, { align: 'center' });
    
    // Instructor Signature Block - Bottom Right
    const rightX = width - 14;
    const footerY = pageHeight - 45;

    if (data.instructorSignature) {
      try {
        doc.addImage(data.instructorSignature, 'PNG', rightX - 55, footerY - 25, 45, 20);
      } catch (e) {
        console.error("Error adding instructor signature", e);
      }
    }
    
    doc.setDrawColor(30, 41, 59);
    doc.line(rightX - 65, footerY + 2, rightX, footerY + 2);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.instructorName?.toUpperCase() || 'N/A', rightX, footerY + 10, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.instructorRole?.toUpperCase() || 'N/A', rightX, footerY + 16, { align: 'right' });
    
    doc.save(`QR_Acceso_${client?.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="animate-in">
      <header className="flex justify-between items-center mb-10 py-4">
        <div className="flex flex-col">
          <h1 style={{ margin: 0, fontWeight: 900 }}>Admin Dashboard</h1>
          <div className="flex items-center gap-2 text-xs font-bold mt-1">
            <span className={syncStatus === 'success' ? 'text-success' : (syncStatus === 'error' ? 'text-danger' : 'text-muted')}>
              {syncStatus === 'syncing' ? '↻ GUARDANDO...' : syncStatus === 'success' ? '● GUARDADO EN LA NUBE' : '○ MODO LOCAL'}
            </span>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onLogout}><LogOut size={18} /> Salir</button>
      </header>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <button type="button" className={`btn ${activeTab === 'asistencias' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('asistencias')}><ClipboardList size={18} /> Asistencias</button>
        <button type="button" className={`btn ${activeTab === 'asignaciones' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('asignaciones')}><QrCode size={18} /> Generar QR</button>
        <button type="button" className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('config')}><Users size={18} /> Configurar</button>
      </div>

      {activeTab === 'config' && (
        <div className="flex flex-col gap-8 animate-in">
          <div className="card">
            <h3 className="flex items-center gap-2 mb-4"><Info size={20} color="var(--accent)" /> Datos del Instructor</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <div>
                  <label>Nombre del Instructor</label>
                  <input value={data.instructorName} onChange={e => setData({...data, instructorName: e.target.value})} />
                </div>
                <div>
                  <label>Cargo / Rol</label>
                  <input value={data.instructorRole} onChange={e => setData({...data, instructorRole: e.target.value})} />
                </div>
              </div>
              <div>
                <label>Firma del Instructor (Táctil o Mouse)</label>
                <div className="signature-wrapper" style={{ height: '180px', marginBottom: '1rem' }}>
                  {React.createElement(SignatureCanvas as any, {
                    ref: instructorSigCanvas,
                    penColor: "black",
                    canvasProps: { style: { width: '100%', height: '100%' } }
                  })}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary flex-1" onClick={saveInstructorSignature}>Guardar Firma</button>
                  <button type="button" className="btn btn-secondary" onClick={() => instructorSigCanvas.current?.clear()}>Limpiar</button>
                </div>
                {data.instructorSignature && (
                  <div className="mt-4 p-2 bg-white/5 rounded border border-border flex items-center justify-between">
                    <span className="text-xs">Firma Actual Registrada</span>
                    <img src={data.instructorSignature} alt="Firma" style={{ height: '30px', background: 'white', borderRadius: '4px' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="card">
              <h3 className="mb-4">Empresas</h3>
              <div className="flex flex-col gap-3 mb-4">
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre Empresa" />
                <input value={newClientCuit} onChange={e => setNewClientCuit(e.target.value)} placeholder="CUIT" />
                <button type="button" className="btn btn-primary" onClick={() => {
                  if(!newClientName) return;
                  setData({...data, clients: [...data.clients, {id: Date.now().toString(), name: newClientName, cuit: newClientCuit}]});
                  setNewClientName(''); setNewClientCuit('');
                }}><Plus /> Añadir</button>
              </div>
              {data.clients.map((c:any) => <div key={c.id} className="flex justify-between items-center p-2 mb-2 rounded bg-white/5">{c.name} <button onClick={() => setData({...data, clients: data.clients.filter((x:any)=>x.id!==c.id)})} className="btn btn-danger" style={{padding:'5px'}}><Trash2 size={14}/></button></div>)}
            </div>
            <div className="card">
              <h3 className="mb-4">Capacitaciones</h3>
              <div className="flex flex-col gap-3 mb-4">
                <input value={newModuleName} onChange={e => setNewModuleName(e.target.value)} placeholder="Nombre del Módulo" />
                <input value={newModuleDriveUrl} onChange={e => setNewModuleDriveUrl(e.target.value)} placeholder="Link del Material (Drive)" />
                <button type="button" className="btn btn-primary" onClick={() => {
                  if(!newModuleName) return;
                  setData({...data, modules: [...data.modules, {id: Date.now().toString(), name: newModuleName, driveUrl: newModuleDriveUrl}]});
                  setNewModuleName(''); setNewModuleDriveUrl('');
                }}><Plus /> Añadir</button>
              </div>
              {data.modules.map((m:any) => <div key={m.id} className="flex justify-between items-center p-2 mb-2 rounded bg-white/5">{m.name} <button onClick={() => setData({...data, modules: data.modules.filter((x:any)=>x.id!==m.id)})} className="btn btn-danger" style={{padding:'5px'}}><Trash2 size={14}/></button></div>)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'asignaciones' && (
        <div className="grid gap-6 animate-in">
          <div className="card">
            <h3 className="mb-6">Nueva Asignación QR</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <select value={selClientId} onChange={e => setSelClientId(e.target.value)}>
                <option value="">Empresa...</option>
                {data.clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selModuleId} onChange={e => setSelModuleId(e.target.value)}>
                <option value="">Módulo...</option>
                {data.modules.map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" className="btn btn-primary" onClick={() => {
                if(!selClientId || !selModuleId) return alert("Seleccione ambos.");
                setData({...data, assignments: [...data.assignments, {id: Math.random().toString(36).substr(2,9), clientId: selClientId, moduleId: selModuleId, createdAt: new Date().toISOString()}]});
                setSelClientId(''); setSelModuleId('');
              }}>Crear Enlace QR</button>
            </div>
          </div>
          {data.assignments.map((as: any) => (
            <div key={as.id} className="card flex items-center justify-between">
              <div>
                <strong>{data.clients.find((c:any)=>c.id===as.clientId)?.name}</strong>
                <p className="text-muted text-xs">Módulo: {data.modules.find((m:any)=>m.id===as.moduleId)?.name}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-success" onClick={() => generateAccessFlyer(as.id)} title="Descargar Flyer QR"><FileDown size={14} /></button>
                <button type="button" className="btn btn-secondary" onClick={() => generatePDF(as.id)} title="Planilla de Asistencia"><ClipboardList size={14} /></button>
                <button type="button" className="btn btn-danger" onClick={() => setData({...data, assignments: data.assignments.filter((x:any)=>x.id!==as.id)})}><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'asistencias' && (
        <div className="card animate-in">
          {data.records.length === 0 ? <p className="text-center text-muted py-12">Sin registros de asistencia aún.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full">
                <thead><tr className="text-left border-b border-border"><th>Alumno</th><th>DNI</th><th>Capacitación</th><th>Fecha</th><th>Firma</th></tr></thead>
                <tbody>
                  {data.records.map((r:any) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.dni}</td>
                      <td className="py-2 text-xs text-muted">{data.modules.find((m:any)=>m.id === (data.assignments.find((a:any)=>a.id === r.assignmentId)?.moduleId))?.name || 'General'}</td>
                      <td className="py-2 text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="py-2"><img src={r.signature} height="20" style={{background:'white', borderRadius:'2px'}} /></td>
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
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ name: '', dni: '' });
  const [lastRecord, setLastRecord] = useState<Record | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aid = params.get('a');
    if (aid) {
      const found = data.assignments.find((a: any) => a.id === aid);
      if (found) setAssignment(found);
    }
  }, [data.assignments]);

  const module = assignment ? data.modules.find((m:any) => m.id === assignment.moduleId) : null;
  const client = assignment ? data.clients.find((c:any) => c.id === assignment.clientId) : null;

  const save = () => {
    if (!form.name || form.dni.length < 7 || sigCanvas.current?.isEmpty()) return alert("Complete los datos y firme.");
    const record: Record = {
      id: Date.now().toString(),
      name: form.name.toUpperCase(),
      dni: form.dni,
      clientId: assignment ? assignment.clientId : '',
      assignmentId: assignment ? assignment.id : '',
      signature: sigCanvas.current!.getTrimmedCanvas().toDataURL('image/png'),
      timestamp: new Date().toISOString()
    };
    setData({ ...data, records: [record, ...data.records] });
    setLastRecord(record);
    setStep(3); // Success step
  };

  const generateCert = () => {
    if (!lastRecord) return;
    const client = data.clients.find((c:any) => c.id === lastRecord.clientId);
    const module = assignment ? data.modules.find((m:any) => m.id === assignment.moduleId) : (data.modules.find((m:any) => m.id === (data.assignments.find((a:any) => a.id === lastRecord.assignmentId)?.moduleId)));
    
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    
    // Background Frame
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.rect(5, 5, width - 10, height - 10);
    doc.rect(7, 7, width - 14, height - 14);

    // Header Bar Dark
    doc.setFillColor(15, 23, 42); 
    doc.rect(12, 12, width - 24, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE CAPACITACIÓN', width / 2, 38, { align: 'center' });
    
    // Content
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Se otorga el presente certificado a:', width / 2, 85, { align: 'center' });
    
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text(lastRecord.name, width / 2, 105, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text(`DNI: ${lastRecord.dni}`, width / 2, 120, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Por su participación y aprobación en la capacitación:', width / 2, 145, { align: 'center' });
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(module?.name || 'Formación General', width / 2, 160, { align: 'center', maxWidth: 160 });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dictado para la empresa: ${client?.name || 'N/A'}`, width / 2, 185, { align: 'center' });
    doc.text(`Fecha: ${new Date(lastRecord.timestamp).toLocaleDateString()}`, width / 2, 195, { align: 'center' });
    
    // Signatures
    const footerY = 245;
    const rightX = width - 14;
    
    // Instructor Signature Block - Bottom Left-ish
    if (data.instructorSignature) {
      try {
        doc.addImage(data.instructorSignature, 'PNG', 30, footerY - 25, 45, 20);
      } catch (e) {
        console.error("Error adding instructor signature", e);
      }
    }
    doc.setDrawColor(200);
    doc.line(20, footerY, 85, footerY);
    doc.setFontSize(10);
    doc.text(data.instructorName || '', 52, footerY + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(data.instructorRole || '', 52, footerY + 14, { align: 'center' });

    // Student Signature Block - Bottom Right
    try {
      doc.addImage(lastRecord.signature, 'PNG', rightX - 55, footerY - 25, 45, 20);
    } catch (e) {
      console.error("Error adding student signature", e);
    }
    doc.line(rightX - 65, footerY, rightX, footerY);
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(lastRecord.name, rightX - 32, footerY + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Firma del Alumno', rightX - 32, footerY + 14, { align: 'center' });

    doc.save(`Certificado_${lastRecord.dni}.pdf`);
  };

  if (!assignment && step === 0) {
    return (
      <div className="animate-in flex flex-col items-center gap-6 py-16 text-center">
        <Info size={80} color="var(--accent)" />
        <h2 style={{ fontSize: '2rem' }}>Escanea un código QR</h2>
        <p className="text-muted">Para acceder al portal de alumnos, debes escanear un código QR de capacitación válido.</p>
        <button type="button" className="btn btn-primary" onClick={onBack}><ArrowLeft /> Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="animate-in py-8 flex flex-col gap-6 max-w-lg mx-auto">
      {/* Botón Cerrar flotante para el portal de alumnos */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={onBack}
          style={{ padding: '10px', borderRadius: '50%', width: '45px', height: '45px' }}
          title="Cerrar y volver al inicio"
        >
          <X size={24} />
        </button>
      </div>

      {step === 0 && (
        <div className="card text-center flex flex-col gap-6">
          <BookOpen size={64} color="var(--accent)" className="mx-auto" />
          <div>
            <h2 className="mb-2">¡Bienvenido!</h2>
            <p className="text-muted">Estás por firmar la asistencia para:</p>
          </div>
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 style={{ color: 'var(--accent)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>{module?.name}</h3>
            <p className="text-sm font-bold opacity-80">{client?.name}</p>
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={() => setStep(1)}>Comenzar <ChevronRight /></button>
          <button type="button" className="btn btn-secondary w-full" onClick={onBack}>Cancelar</button>
        </div>
      )}

      {step === 1 && (
        <div className="card flex flex-col gap-6 animate-in">
          <h2 className="flex items-center gap-3"><FileText size={24} color="var(--accent)" /> Tus Datos</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label>Nombre Completo</label>
              <input 
                placeholder="Ej. Juan Pérez" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
              />
            </div>
            <div>
              <label>DNI / NIE</label>
              <input 
                placeholder="Sin puntos ni espacios" 
                type="number"
                value={form.dni} 
                onChange={e => setForm({...form, dni: e.target.value})}
              />
            </div>
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={() => {
            if (form.name.length < 3 || form.dni.length < 7) return alert("Por favor complete sus datos correctamente.");
            setStep(2);
          }}>Siguiente <ChevronRight /></button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => setStep(0)}>Volver</button>
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-6 animate-in">
          <h2 className="flex items-center gap-3"><Award size={24} color="var(--accent)" /> Firmar Asistencia</h2>
          <p className="text-sm text-muted">Utilice su dedo o mouse para firmar en el recuadro blanco.</p>
          <div className="signature-wrapper" style={{ height: '250px' }}>
            {React.createElement(SignatureCanvas as any, {
              ref: sigCanvas,
              penColor: "black",
              canvasProps: { style: { width: '100%', height: '100%' } }
            })}
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => sigCanvas.current?.clear()}>Limpiar</button>
            <button type="button" className="btn btn-primary flex-1" onClick={save}>Confirmar Firma</button>
          </div>
          <button type="button" className="btn btn-secondary w-full" onClick={() => setStep(1)}>Atrás</button>
        </div>
      )}

      {step === 3 && (
        <div className="card text-center flex flex-col gap-8 animate-in">
          <div className="mx-auto w-20 h-20 bg-success/20 rounded-full flex items-center justify-center">
            <CheckCircle size={48} color="var(--success)" />
          </div>
          <div>
            <h2 className="mb-2">¡Asistencia Registrada!</h2>
            <p className="text-muted">Gracias {form.name.split(' ')[0]}, tu asistencia ha sido confirmada correctamente.</p>
          </div>
          <div className="flex flex-col gap-4">
            <button type="button" className="btn btn-success w-full" onClick={generateCert}>
              <FileDown /> Descargar Certificado (PDF)
            </button>
            {module?.driveUrl && (
              <a href={module.driveUrl} target="_blank" className="btn btn-primary w-full" rel="noreferrer">
                <ExternalLink /> Ver Material de Estudio
              </a>
            )}
            <button type="button" className="btn btn-secondary w-full" onClick={onBack}>Finalizar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
