
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, Trash2, CheckCircle2, ShieldCheck, RefreshCw, ChevronRight, Lock, Key, Eraser, AlertTriangle, LogOut, Award, Loader2
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';

// --- Interfaces ---
interface Client { id: string; name: string; cuit: string; }
interface Module { id: string; name: string; documents: any[]; }
interface Assignment { id: string; clientId: string; moduleId: string; createdAt: string; }
interface AttendanceRecord { id: string; name: string; dni: string; companyId: string; moduleId: string; timestamp: string; signature: string; }
interface Instructor { name: string; role: string; signature: string; }
interface AppState { clients: Client[]; modules: Module[]; assignments: Assignment[]; records: AttendanceRecord[]; instructor: Instructor; }

// --- Config ---
const STORAGE_KEYS = { 
  MASTER_KEY: 'trainer_pro_mk_v42',
  WSID: 'trainer_pro_wsid_v42', 
  AUTH: 'trainer_pro_auth_v42',
  STATE_CACHE: 'trainer_pro_cache_v42'
};
const API_URL = 'https://api.restful-api.dev/objects';

// Helper: Ultra-Compression for Cloud Storage
const compressSignature = (canvas: HTMLCanvasElement): string => {
  const targetW = 180;
  const targetH = 90;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetW;
  tempCanvas.height = targetH;
  const ctx = tempCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
  }
  return tempCanvas.toDataURL('image/jpeg', 0.15);
};

const api = {
  load: async (id: string): Promise<AppState | null> => {
    if (!id) return null;
    try {
      const res = await fetch(`${API_URL}/${id}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch { return null; }
  },
  save: async (id: string, masterKey: string, data: AppState): Promise<boolean> => {
    if (!id || !masterKey) return false;
    try {
      const optimizedData = { ...data, records: (data.records || []).slice(0, 15) };
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `TrainerCloud_${masterKey}`, data: optimizedData })
      });
      return res.ok;
    } catch { return false; }
  },
  findByKey: async (masterKey: string): Promise<{id: string, data: AppState} | null> => {
    try {
      const res = await fetch(API_URL);
      const objects = await res.json();
      const prefix = `TrainerCloud_`;
      const found = objects.find((obj: any) => obj.name === `${prefix}${masterKey}`);
      if (found) {
        const fullRes = await fetch(`${API_URL}/${found.id}`);
        const fullObj = await fullRes.json();
        return { id: found.id, data: fullObj.data };
      }
      return null;
    } catch { return null; }
  },
  create: async (masterKey: string): Promise<string> => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `TrainerCloud_${masterKey}`, 
          data: { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } } 
        })
      });
      const json = await res.json();
      return json.id;
    } catch { return ""; }
  }
};

const App = () => {
  const [view, setView] = useState<'landing' | 'userPortal' | 'adminLogin' | 'adminDashboard'>('landing');
  const [masterKey, setMasterKey] = useState(() => localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || "");
  const [wsid, setWsid] = useState(() => localStorage.getItem(STORAGE_KEYS.WSID) || "");
  const [isAuth, setIsAuth] = useState(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  const [state, setState] = useState<AppState>(() => {
    const cache = localStorage.getItem(STORAGE_KEYS.STATE_CACHE);
    return cache ? JSON.parse(cache) : { clients: [], modules: [], assignments: [], records: [], instructor: { name: "", role: "", signature: "" } };
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'asistencias' | 'asignaciones' | 'modulos' | 'clientes' | 'instructor'>('asistencias');

  // Ref to store the hash/string of the last synced state to avoid redundant renders and main thread blocking
  const lastStateHashRef = useRef(JSON.stringify(state));

  const sync = useCallback(async (silent = true) => {
    if (!wsid) return;
    if (!silent) setSyncStatus('syncing');
    
    try {
      const cloud = await api.load(wsid);
      if (cloud) {
        const cloudString = JSON.stringify(cloud);
        if (cloudString !== lastStateHashRef.current) {
          lastStateHashRef.current = cloudString;
          setState(cloud);
        }
        setSyncStatus('idle');
      } else if (!silent) {
        setSyncStatus('error');
      }
    } catch (e) {
      if (!silent) setSyncStatus('error');
    }
  }, [wsid]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const urlWsid = p.get('wsid'), urlMk = p.get('mk');
    if (urlWsid) setWsid(urlWsid);
    if (urlMk) setMasterKey(urlMk);
    if (p.get('cid') && p.get('mid')) setView('userPortal');
  }, []);

  useEffect(() => {
    if (wsid) sync(false);
    // Increased sync interval to reduce main thread pressure
    const timer = setInterval(() => sync(true), 45000);
    return () => clearInterval(timer);
  }, [wsid, sync]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATE_CACHE, JSON.stringify(state));
  }, [state]);

  const updateGlobal = async (patch: Partial<AppState>) => {
    if (!wsid) return;
    setSyncStatus('syncing');
    const newState = { ...state, ...patch };
    setState(newState);
    lastStateHashRef.current = JSON.stringify(newState);
    
    try {
      const ok = await api.save(wsid, masterKey, newState);
      setSyncStatus(ok ? 'saved' : 'error');
      if (ok) setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
    }
  };

  const handleLogin = async (keyInput: string) => {
    if (!keyInput) return;
    setIsLoggingIn(true);
    const cleanKey = keyInput.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      const existing = await api.findByKey(cleanKey);
      const targetWsid = existing ? existing.id : await api.create(cleanKey);
      if (targetWsid) {
        if (existing) {
          setState(existing.data);
          lastStateHashRef.current = JSON.stringify(existing.data);
        }
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        localStorage.setItem(STORAGE_KEYS.MASTER_KEY, cleanKey);
        localStorage.setItem(STORAGE_KEYS.WSID, targetWsid);
        setMasterKey(cleanKey); setWsid(targetWsid); setIsAuth(true);
        setView('adminDashboard');
      }
    } catch { alert("Error de conexión"); }
    finally { setIsLoggingIn(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <div className="flex items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setView('landing')}>
          <div style={{ background: 'var(--brand-600)', padding: '0.4rem', borderRadius: '0.6rem', display: 'flex' }}><BookOpen size={18} color="white" /></div>
          <span className="font-black italic uppercase tracking-tighter" style={{ fontSize: '1.1rem' }}>TRAINER<span className="text-brand">PRO</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.8rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: syncStatus === 'error' ? 'var(--danger)' : 'var(--success)' }}></div>
            <span className="text-xs font-black uppercase tracking-widest text-dim">{syncStatus === 'syncing' ? 'Sync' : 'Cloud'}</span>
          </div>
          {isAuth && view === 'adminDashboard' && <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem' }}><LogOut size={18} /></button>}
        </div>
      </header>

      <main className="container mt-24">
        {view === 'landing' && (
          <div className="animate-fade text-center" style={{ height: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
            <div>
              <h1 className="font-black italic uppercase tracking-tighter h-large" style={{ margin: 0, lineHeight: 0.9 }}>TRAINER<br/><span className="text-brand">PRO</span></h1>
              <p className="font-black uppercase tracking-widest text-xs" style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Digital Training Records & Signatures</p>
            </div>
            <button className="btn btn-brand" onClick={() => isAuth ? setView('adminDashboard') : setView('adminLogin')}>Acceder al Panel <ChevronRight size={16} /></button>
          </div>
        )}

        {view === 'adminLogin' && (
          <div className="card animate-fade" style={{ maxWidth: '400px', margin: '2rem auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(14, 140, 233, 0.1)', padding: '1rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '1rem' }}><ShieldCheck size={32} color="var(--brand-500)" /></div>
              <h2 className="font-black uppercase italic text-xl">Acceso Seguro</h2>
            </div>
            <div className="grid gap-4">
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '1rem', top: '1.2rem', color: 'var(--text-muted)' }} size={18} />
                <input type="password" placeholder="Clave de Acceso" className="input-field" style={{ paddingLeft: '3rem' }} onKeyDown={(e) => e.key === 'Enter' && handleLogin((e.target as HTMLInputElement).value)} />
              </div>
              <button disabled={isLoggingIn} className="btn btn-brand" onClick={() => handleLogin((document.querySelector('input[type="password"]') as HTMLInputElement).value)}>
                {isLoggingIn ? <RefreshCw className="animate-spin" size={16} /> : "Iniciar Sesión"}
              </button>
            </div>
          </div>
        )}

        {view === 'adminDashboard' && (
          <div className="animate-fade flex flex-col gap-6">
            <div className="dashboard-header flex justify-between items-end gap-4" style={{ flexWrap: 'wrap' }}>
              <div>
                <h1 className="font-black italic uppercase text-2xl tracking-tighter">Mi <span className="text-brand">Gestión</span></h1>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', width: 'fit-content' }}>
                  <Key size={12} color="var(--brand-500)" />
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{masterKey}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '1rem', display: 'flex', overflowX: 'auto' }} className="no-scrollbar">
                {['asistencias', 'asignaciones', 'modulos', 'clientes'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} style={{ 
                    padding: '0.6rem 1.2rem', 
                    borderRadius: '0.8rem', 
                    border: 'none', 
                    fontSize: '0.65rem', 
                    fontWeight: 900, 
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background: activeTab === t ? 'var(--brand-600)' : 'transparent',
                    color: activeTab === t ? 'white' : 'var(--text-muted)',
                    whiteSpace: 'nowrap'
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <div className="card" style={{ minHeight: '500px' }}>
              {activeTab === 'asistencias' && (
                <div className="flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black uppercase italic text-lg">Firmas Recibidas</h3>
                    <div className="flex gap-2">
                      <button className="btn btn-outline-danger" style={{ padding: '0.6rem' }} onClick={() => confirm("¿Vaciar?") && updateGlobal({ records: [] })}><Eraser size={18} /></button>
                      <button className="btn btn-brand" style={{ padding: '0.6rem', background: 'rgba(14, 140, 233, 0.1)', color: 'var(--brand-500)', boxShadow: 'none' }} onClick={() => sync(false)}><RefreshCw size={18} /></button>
                    </div>
                  </div>
                  <div className="no-scrollbar" style={{ overflowX: 'auto', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead style={{ background: 'var(--bg-input)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        <tr>
                          <th style={{ padding: '1rem', textAlign: 'left' }}>Empleado</th>
                          <th style={{ padding: '1rem', textAlign: 'left' }}>Módulo</th>
                          <th style={{ padding: '1rem', textAlign: 'center' }}>Firma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(state.records || []).map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '1rem' }}><strong style={{ display: 'block' }}>{r.name}</strong><span style={{ color: 'var(--text-muted)' }}>{r.dni}</span></td>
                            <td style={{ padding: '1rem', color: 'var(--brand-500)', fontWeight: 900 }}>{state.modules.find(m => m.id === r.moduleId)?.name || 'CURSO'}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              {r.signature ? <img src={r.signature} style={{ height: '30px', background: 'white', padding: '2px', borderRadius: '4px' }} /> : '-'}
                            </td>
                          </tr>
                        ))}
                        {(!state.records || state.records.length === 0) && (
                          <tr><td colSpan={3} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay registros en la nube</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'asignaciones' && (
                <div className="grid gap-6">
                  <div className="grid grid-cols-md-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase font-black text-muted italic" style={{ paddingLeft: '0.5rem' }}>Empresa</label>
                      <select id="sel-client" className="select-field">
                        <option value="">SELECCIONE CLIENTE</option>
                        {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase font-black text-muted italic" style={{ paddingLeft: '0.5rem' }}>Curso</label>
                      <select id="sel-module" className="select-field">
                        <option value="">SELECCIONE MÓDULO</option>
                        {state.modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-brand" onClick={() => {
                    const cid = (document.getElementById('sel-client') as HTMLSelectElement).value;
                    const mid = (document.getElementById('sel-module') as HTMLSelectElement).value;
                    if(cid && mid) updateGlobal({ assignments: [...(state.assignments || []), { id: Date.now().toString(), clientId: cid, moduleId: mid, createdAt: new Date().toISOString() }] });
                  }}>Generar Código QR</button>
                  
                  <div className="grid grid-cols-md-2 gap-4">
                    {state.assignments.map(a => (
                      <div key={a.id} className="card" style={{ padding: '1.5rem', background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="flex justify-between items-start">
                          <h4 className="font-black uppercase text-sm italic" style={{ margin: 0 }}>{state.modules.find(m => m.id === a.moduleId)?.name}</h4>
                          <Trash2 size={16} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => updateGlobal({ assignments: state.assignments.filter(x => x.id !== a.id) })} />
                        </div>
                        <p className="text-brand font-black uppercase italic" style={{ fontSize: '0.65rem' }}>{state.clients.find(c => c.id === a.clientId)?.name}</p>
                        <button className="btn btn-brand" style={{ width: '100%', fontSize: '0.65rem', padding: '0.75rem' }} onClick={async () => {
                          const url = `${window.location.origin}${window.location.pathname}?cid=${a.clientId}&mid=${a.moduleId}&wsid=${wsid}&mk=${masterKey}`;
                          const qrData = await QRCode.toDataURL(url, { width: 500, margin: 2 });
                          const win = window.open();
                          win?.document.write(`
                            <body style="background:#060912;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                              <div style="text-align:center;background:#111827;padding:50px;border-radius:40px;border:1px solid rgba(255,255,255,0.1);max-width:400px;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
                                <h2 style="text-transform:uppercase;margin-bottom:10px;font-size:18px;font-weight:900;">REGISTRO DIGITAL</h2>
                                <p style="color:#38a9f8;font-weight:bold;text-transform:uppercase;font-size:10px;margin-bottom:40px;letter-spacing:2px;">${state.modules.find(m => m.id === a.moduleId)?.name}</p>
                                <div style="background:white;padding:20px;border-radius:20px;display:inline-block;"><img src="${qrData}" style="width:250px;display:block;"></div>
                                <p style="margin-top:30px;font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Escanee para iniciar sesión de firma</p>
                              </div>
                            </body>
                          `);
                        }}>Abrir QR</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'modulos' && (
                <div className="grid gap-6">
                  <div className="flex gap-4">
                    <input id="mod-name" placeholder="TÍTULO DE CAPACITACIÓN" className="input-field" />
                    <button className="btn btn-brand" onClick={() => {
                      const n = (document.getElementById('mod-name') as HTMLInputElement).value;
                      if(n) { updateGlobal({ modules: [...(state.modules || []), { id: Date.now().toString(), name: n.toUpperCase(), documents: [] }] }); (document.getElementById('mod-name') as HTMLInputElement).value = ""; }
                    }}>Crear</button>
                  </div>
                  <div className="grid gap-2">
                    {state.modules.map(m => (
                      <div key={m.id} className="flex justify-between items-center" style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: '1rem' }}>
                        <span className="font-black italic text-sm">{m.name}</span>
                        <Trash2 size={16} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => confirm("¿Borrar?") && updateGlobal({ modules: state.modules.filter(x => x.id !== m.id) })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'clientes' && (
                <div className="grid gap-6">
                  <div className="grid grid-cols-md-2 gap-4">
                    <input id="cli-name" placeholder="NOMBRE DE EMPRESA" className="input-field" />
                    <input id="cli-cuit" placeholder="CUIT / IDENTIFICADOR" className="input-field" />
                  </div>
                  <button className="btn btn-brand" onClick={() => {
                    const n = (document.getElementById('cli-name') as HTMLInputElement).value;
                    const c = (document.getElementById('cli-cuit') as HTMLInputElement).value;
                    if(n) { updateGlobal({ clients: [...(state.clients || []), { id: Date.now().toString(), name: n.toUpperCase(), cuit: c }] }); (document.getElementById('cli-name') as HTMLInputElement).value = ""; (document.getElementById('cli-cuit') as HTMLInputElement).value = ""; }
                  }}>Registrar Cliente</button>
                  <div className="grid gap-2">
                    {state.clients.map(cl => (
                      <div key={cl.id} className="flex justify-between items-center" style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: '1rem' }}>
                        <div><strong className="text-sm font-black italic">{cl.name}</strong><br/><small style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700 }}>{cl.cuit}</small></div>
                        <Trash2 size={16} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => confirm("¿Borrar?") && updateGlobal({ clients: state.clients.filter(x => x.id !== cl.id) })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'userPortal' && (
          <UserPortal 
            state={state} 
            onSubmit={async (rec) => {
              const cloud = await api.load(wsid);
              const base = cloud || state;
              const updated = { ...base, records: [rec, ...(base.records || [])].slice(0, 15) };
              const ok = await api.save(wsid, masterKey, updated);
              if (!ok) throw new Error("Cloud Error");
              setState(updated);
              lastStateHashRef.current = JSON.stringify(updated);
            }} 
          />
        )}
      </main>
      
      <footer style={{ marginTop: 'auto', padding: '2rem 0', textAlign: 'center', opacity: 0.3 }}>
        <p className="font-black uppercase tracking-widest italic" style={{ fontSize: '0.6rem' }}>TrainerPro v4.2 Cloud Infrastructure</p>
      </footer>
    </div>
  );
};

// --- Portal de Usuario Móvil ---
const UserPortal = ({ state, onSubmit }: { state: AppState, onSubmit: (r: AttendanceRecord) => Promise<void> }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  
  const p = new URLSearchParams(window.location.search);
  const cid = p.get('cid'), mid = p.get('mid');
  const cl = state.clients?.find(c => c.id === cid);
  const mo = state.modules?.find(m => m.id === mid);

  if (done) return (
    <div className="animate-fade text-center flex flex-col items-center justify-center" style={{ padding: '4rem 0', gap: '2rem' }}>
      <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '2rem', borderRadius: '50%' }}><CheckCircle2 size={64} color="var(--success)" /></div>
      <div>
        <h2 className="font-black uppercase italic text-xl">¡Registro Exitoso!</h2>
        <p className="text-dim text-sm" style={{ marginTop: '0.5rem' }}>Su asistencia y firma han sido enviadas correctamente.</p>
      </div>
      <button className="btn" style={{ background: 'var(--bg-card)', color: 'white' }} onClick={() => window.location.href='/'}>Volver al Inicio</button>
    </div>
  );

  return (
    <div className="animate-fade" style={{ maxWidth: '450px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="text-center">
        <h1 className="font-black uppercase italic text-lg leading-tight" style={{ margin: 0 }}>{mo?.name || "CARGA DE ASISTENCIA"}</h1>
        <div style={{ display: 'inline-block', background: 'rgba(14, 140, 233, 0.1)', padding: '0.2rem 0.8rem', borderRadius: '1rem', marginTop: '0.5rem' }}>
          <span className="text-brand font-black uppercase italic text-xs tracking-widest">{cl?.name || "CLIENTE"}</span>
        </div>
      </div>

      <div className="card">
        {step === 1 ? (
          <div className="grid gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase font-black text-muted px-2">Nombre Completo</label>
              <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="EJ: PEDRO SÁNCHEZ" className="input-field" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase font-black text-muted px-2">Documento / DNI</label>
              <input value={dni} onChange={e => setDni(e.target.value)} placeholder="SOLO NÚMEROS" className="input-field" />
            </div>
            <button className="btn btn-brand" onClick={() => { if(name && dni) setStep(2); else alert("Complete sus datos"); }}>Siguiente Paso <ChevronRight size={16} /></button>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-black uppercase text-dim italic">Firma Digital Requerida</span>
              <button onClick={() => sigRef.current?.clear()} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>Borrar</button>
            </div>
            <div style={{ background: 'white', borderRadius: '1.5rem', height: '260px', overflow: 'hidden', border: '4px solid var(--bg-input)' }}>
              <SignatureCanvas ref={sigRef} penColor="blue" canvasProps={{ style: { width: '100%', height: '100%', cursor: 'crosshair' } }} />
            </div>
            <div className="flex gap-3">
              <button className="btn" style={{ background: 'var(--bg-input)', color: 'white', flex: 1 }} onClick={() => setStep(1)}>Atrás</button>
              <button disabled={isSubmitting} className="btn btn-brand" style={{ flex: 2 }} onClick={async () => {
                if(sigRef.current?.isEmpty()) return alert("Debe firmar para continuar");
                setIsSubmitting(true);
                try {
                  const canvas = sigRef.current!.getTrimmedCanvas();
                  const sig = compressSignature(canvas);
                  await onSubmit({ id: Date.now().toString(), name, dni, companyId: cid!, moduleId: mid!, timestamp: new Date().toISOString(), signature: sig });
                  setDone(true);
                } catch { alert("Error de servidor. Intente nuevamente."); }
                finally { setIsSubmitting(false); }
              }}>
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Finalizar y Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
