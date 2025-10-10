import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
// FIX: Import the missing `LogIn` icon from `lucide-react`.
import { ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye, FileText, CheckCircle, ArrowLeft, Send, LogIn } from 'lucide-react';


// --- TYPES ---
interface TrainingLink {
  id: string;
  url: string;
  viewed: boolean;
}

interface Training {
  id:string;
  name: string;
  links: TrainingLink[];
}

interface UserSubmission {
  id: string;
  trainingId: string;
  trainingName: string;
  firstName: string;
  lastName: string;
  dni: string;
  company: string;
  signature: string; // Base64 data URL from the signature pad
  timestamp: string;
  email?: string;
  phone?: string;
}


// --- SERVICES ---
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const generateSubmissionsPdf = (submissions: UserSubmission[], adminSignature: string, adminSignatureClarification: string): void => {
  const doc = new jsPDF();
  
  doc.text('Registro de Asistencia a Capacitaciones', 14, 16);
  
  const tableColumns = ['Nombre', 'Apellido', 'DNI', 'Empresa', 'Capacitación', 'Fecha'];
  const tableRows = submissions.map(sub => [
    sub.firstName,
    sub.lastName,
    sub.dni,
    sub.company,
    sub.trainingName,
    sub.timestamp,
  ]);

  doc.autoTable({
    head: [tableColumns],
    body: tableRows,
    startY: 24,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] }, // Dark blue header
    styles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 100;
  const pageHeight = doc.internal.pageSize.getHeight();
  let signatureY = finalY + 15;

  if (signatureY + 55 > pageHeight) { // Increased space for clarification
    doc.addPage();
    signatureY = 20;
  }

  doc.setFontSize(10);
  doc.text('Constancia de registro de asistencia emitida por el administrador:', 14, signatureY);

  try {
    if (adminSignature) {
      doc.addImage(adminSignature, 'PNG', 14, signatureY + 5, 60, 30);
      doc.setDrawColor(0); // Black line
      doc.line(14, signatureY + 38, 74, signatureY + 38); // Line under signature
      if (adminSignatureClarification) {
        doc.text(adminSignatureClarification, 14, signatureY + 43);
      }
    }
  } catch(e) {
    doc.text('No se pudo cargar la imagen de la firma.', 14, signatureY + 10);
    console.error("Error adding admin signature image to PDF: ", e);
  }

  doc.save('constancia_asistencia.pdf');
};


// --- COMPONENTS ---

// SignaturePad.tsx
interface SignaturePadProps {
  onSignatureEnd: (signature: string) => void;
  signatureRef: React.RefObject<SignatureCanvas>;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureEnd, signatureRef }) => {
  // FIX: The type definitions for `react-signature-canvas` appear to be incorrect, causing a type error for the `penColor` prop.
  // Casting to `any` to bypass the faulty type check for this valid prop.
  const AnySignatureCanvas = SignatureCanvas as any;

  return (
    <div className="border border-slate-700 rounded-lg bg-white">
      <AnySignatureCanvas
        ref={signatureRef}
        penColor='black'
        canvasProps={{ className: 'w-full h-40 rounded-lg' }}
        onEnd={() => {
          if (signatureRef.current) {
            onSignatureEnd(signatureRef.current.toDataURL());
          }
        }}
      />
    </div>
  );
};

// UserPortal.tsx
interface UserPortalProps {
  trainings: Training[];
  setTrainings: React.Dispatch<React.SetStateAction<Training[]>>;
  addUserSubmission: (submission: Omit<UserSubmission, 'id'>) => void;
  onBack: () => void;
}

const UserPortal: React.FC<UserPortalProps> = ({ trainings, setTrainings, addUserSubmission, onBack }) => {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [formCompleted, setFormCompleted] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    company: '',
    email: '',
    phone: '',
    signature: '',
  });

  const selectedTraining = useMemo(() => {
    return trainings.find(t => t.id === selectedTrainingId) || null;
  }, [selectedTrainingId, trainings]);

  const allLinksViewed = useMemo(() => {
    if (!selectedTraining) return false;
    return selectedTraining.links.every(link => link.viewed);
  }, [selectedTraining]);
  
  const handleLinkClick = (trainingId: string, linkId: string) => {
    setTrainings(currentTrainings =>
      currentTrainings.map(t =>
        t.id === trainingId
          ? { ...t, links: t.links.map(l => l.id === linkId ? { ...l, viewed: true } : l) }
          : t
      )
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignatureEnd = (signature: string) => {
    setFormData(prev => ({ ...prev, signature }));
  };
  
  const clearSignature = () => {
    signatureRef.current?.clear();
    setFormData(prev => ({ ...prev, signature: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraining || !formData.signature) {
        alert("Please provide all required information, including your signature.");
        return;
    }
    
    const submission: Omit<UserSubmission, 'id'> = {
        trainingId: selectedTraining.id,
        trainingName: selectedTraining.name,
        ...formData,
        timestamp: new Date().toLocaleString(),
    };
    addUserSubmission(submission);
    setFormCompleted(true);
  };

  if (formCompleted) {
    return (
        <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-white">¡Capacitación Completada!</h2>
            <p className="mt-2 text-gray-400">Gracias por enviar tu información. Ya puedes cerrar esta ventana.</p>
            <button
                onClick={() => {
                    setSelectedTrainingId(null);
                    setFormCompleted(false);
                }}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Volver a la lista de capacitaciones
            </button>
        </div>
    );
  }

  if (selectedTraining) {
    const progress = (selectedTraining.links.filter(l => l.viewed).length / selectedTraining.links.length) * 100;
    
    return (
        <div className="w-full max-w-4xl mx-auto bg-slate-800 p-8 rounded-xl shadow-lg">
            <button onClick={() => setSelectedTrainingId(null)} className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
            </button>
            <h2 className="text-2xl font-bold text-white mb-2">{selectedTraining.name}</h2>
            <p className="text-gray-400 mb-4">Por favor, haz clic en todos los enlaces para marcarlos como vistos. Una vez completado, podrás cargar tus datos.</p>
            
            <div className="mb-4">
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-sm text-right text-gray-400 mt-1">{Math.round(progress)}% completado</p>
            </div>

            <div className="space-y-3 mb-8">
                {selectedTraining.links.map(link => (
                    <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(selectedTraining.id, link.id)}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${link.viewed ? 'bg-green-900/30 border-green-500/50 text-gray-300' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-700'}`}
                    >
                        <div className="flex items-center">
                            <FileText className="h-5 w-5 mr-3 text-indigo-400"/>
                            <span className="font-medium">{link.url}</span>
                        </div>
                        {link.viewed && <CheckCircle className="h-6 w-6 text-green-500" />}
                    </a>
                ))}
            </div>

            {allLinksViewed && (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                     <h3 className="text-xl font-semibold text-white border-t border-slate-700 pt-6">Completa tus datos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input type="text" name="firstName" placeholder="Nombre" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="lastName" placeholder="Apellido" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="dni" placeholder="DNI" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="company" placeholder="Empresa" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="email" name="email" placeholder="Email (Opcional)" onChange={handleInputChange} className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="tel" name="phone" placeholder="Teléfono (Opcional)" onChange={handleInputChange} className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Firma Digital (Obligatorio)</label>
                         <SignaturePad onSignatureEnd={handleSignatureEnd} signatureRef={signatureRef} />
                        <button type="button" onClick={clearSignature} className="text-sm text-indigo-400 hover:underline mt-2">Limpiar firma</button>
                    </div>
                    <button 
                        type="submit" 
                        disabled={!formData.signature}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed">
                        <Send className="h-5 w-5 mr-2" />
                        Enviar Información
                    </button>
                </form>
            )}
        </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
      </button>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">Capacitaciones Disponibles</h1>
        <p className="mt-2 text-gray-400">Selecciona una capacitación para comenzar.</p>
      </div>
      <div className="space-y-4">
        {trainings.length > 0 ? (
          trainings.map(training => (
            <button
              key={training.id}
              onClick={() => setSelectedTrainingId(training.id)}
              className="w-full text-left p-6 bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-slate-700"
            >
              <h3 className="text-xl font-semibold text-indigo-400">{training.name}</h3>
              <p className="text-gray-400 mt-1">{training.links.length} enlace(s)</p>
            </button>
          ))
        ) : (
          <div className="text-center p-8 bg-slate-800 rounded-lg border border-slate-700">
              <FileText className="mx-auto h-12 w-12 text-gray-500" />
              <h3 className="mt-4 text-xl font-semibold text-white">No hay capacitaciones cargadas</h3>
              <p className="mt-2 text-gray-400 max-w-md mx-auto">
                  Parece que no hay capacitaciones disponibles. Si recibiste un enlace o código QR de tu administrador, por favor úsalo para acceder a la capacitación.
              </p>
          </div>
        )}
      </div>
    </div>
  );
};

// AdminLogin.tsx
interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const ADMIN_PASSWORD = 'admin2025';

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onLoginSuccess();
    } else {
      setError('Contraseña incorrecta.');
      setPassword('');
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
        <button onClick={onBack} className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
        </button>
        <div className="bg-slate-800 p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-center text-white mb-6">Acceso Administrador</h2>
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    }}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Contraseña"
                />
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <div>
                <button
                    type="submit"
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <LogIn className="h-5 w-5 text-indigo-400 group-hover:text-indigo-300" aria-hidden="true" />
                    </span>
                    Ingresar
                </button>
                </div>
            </form>
        </div>
    </div>
  );
};

// AdminDashboard.tsx
interface AdminDashboardProps {
  trainings: Training[];
  userSubmissions: UserSubmission[];
  addTraining: (name: string, links: string[]) => void;
  updateTraining: (id: string, name: string, links: string[]) => void;
  deleteTraining: (id: string) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ trainings, userSubmissions, addTraining, updateTraining, deleteTraining, onLogout }) => {
  const [trainingName, setTrainingName] = useState('');
  const [linksText, setLinksText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedLinksText, setEditedLinksText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmission | null>(null);
  const [adminSignature, setAdminSignature] = useState<string | null>(null);
  const [adminSignatureClarification, setAdminSignatureClarification] = useState<string>('');
  const [showAdminSignatureModal, setShowAdminSignatureModal] = useState(false);
  const adminSignatureRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const savedSignature = localStorage.getItem('adminSignature');
    if (savedSignature) {
      setAdminSignature(savedSignature);
    }
    const savedClarification = localStorage.getItem('adminSignatureClarification');
    if (savedClarification) {
      setAdminSignatureClarification(savedClarification);
    }
  }, []);

  useEffect(() => {
    if (editingTraining) {
      setEditedName(editingTraining.name);
      setEditedLinksText(editingTraining.links.map(l => l.url).join('\n'));
    }
  }, [editingTraining]);

  const handleAddTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingName.trim() || !linksText.trim()) {
      setFeedback('El nombre y los enlaces no pueden estar vacíos.');
      return;
    }
    const links = linksText.split('\n').filter(link => link.trim() !== '');
    if (links.length === 0) {
        setFeedback('Debe proporcionar al menos un enlace válido.');
        return;
    }
    addTraining(trainingName, links);
    setTrainingName('');
    setLinksText('');
    setFeedback('¡Capacitación agregada exitosamente!');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleUpdateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTraining) return;

    const links = editedLinksText.split('\n').filter(link => link.trim() !== '');
    if (!editedName.trim() || links.length === 0) {
      alert("El nombre y los enlaces no pueden estar vacíos.");
      return;
    }
    updateTraining(editingTraining.id, editedName, links);
    setEditingTraining(null);
  }

  const handleDeleteTraining = (id: string) => {
    if(window.confirm('¿Estás seguro de que quieres eliminar esta capacitación? Esta acción no se puede deshacer.')) {
      deleteTraining(id);
    }
  }

  const handleShare = async () => {
    const data = btoa(encodeURIComponent(JSON.stringify(trainings)));
    const link = `${window.location.origin}${window.location.pathname}?data=${data}`;
    setShareableLink(link);
    try {
      const dataUrl = await QRCode.toDataURL(link, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#1E293B' } });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      setQrCodeDataUrl('');
    }
    setShowShareModal(true);
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableLink).then(() => {
        setCopySuccess('¡Copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
    }, () => {
        setCopySuccess('Error al copiar');
    });
  };

  const openUserView = () => {
    if (trainings.length === 0) {
        alert("No hay capacitaciones para previsualizar. Crea una primero.");
        return;
    }
    const data = btoa(encodeURIComponent(JSON.stringify(trainings)));
    const userViewUrl = `${window.location.origin}${window.location.pathname}?data=${data}`;
    window.open(userViewUrl, '_blank');
  };

  const handleSaveAdminSignature = () => {
    if (adminSignatureRef.current) {
      if (adminSignatureRef.current.isEmpty()) {
          alert("Por favor, dibuja tu firma antes de guardar.");
          return;
      }
       if (!adminSignatureClarification.trim()) {
          alert("Por favor, ingresa tu aclaración de firma.");
          return;
      }
      const signatureDataUrl = adminSignatureRef.current.toDataURL();
      setAdminSignature(signatureDataUrl);
      localStorage.setItem('adminSignature', signatureDataUrl);
      localStorage.setItem('adminSignatureClarification', adminSignatureClarification);
      setShowAdminSignatureModal(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Panel de Administrador</h1>
        <button onClick={onLogout} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
          <LogOut className="h-4 w-4 mr-2"/>
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
            <h2 className="text-xl font-semibold text-gray-200 mb-4">Crear Nueva Capacitación</h2>
            <form onSubmit={handleAddTraining} className="space-y-4">
              <div>
                <label htmlFor="trainingName" className="block text-sm font-medium text-gray-300">Nombre de la Capacitación</label>
                <input
                  id="trainingName"
                  type="text"
                  value={trainingName}
                  onChange={(e) => setTrainingName(e.target.value)}
                  placeholder="Ej: Inducción de Seguridad"
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="links" className="block text-sm font-medium text-gray-300">Enlaces (uno por línea)</label>
                <textarea
                  id="links"
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  rows={4}
                  placeholder="https://ejemplo.com/link1&#10;https://ejemplo.com/link2"
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Agregar Capacitación
                </button>
                {feedback && <p className="text-sm text-green-500">{feedback}</p>}
              </div>
            </form>
          </div>
          
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-200">Gestionar Capacitaciones</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={openUserView}
                        disabled={trainings.length === 0}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Vista de Usuario
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={trainings.length === 0}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartir
                    </button>
                </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trainings.length > 0 ? (
                trainings.map(training => (
                  <div key={training.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <span className="font-medium text-gray-200">{training.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingTraining(training)} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-full transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteTraining(training.id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-full transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No hay capacitaciones creadas.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-gray-200">Usuarios Registrados</h2>
              <div className="flex gap-2 flex-wrap items-center">
                  <button 
                    onClick={() => setShowAdminSignatureModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <Edit className="h-4 w-4 mr-2" />
                    {adminSignature ? 'Cambiar Firma' : 'Configurar Firma'}
                </button>
                {adminSignature && (
                    <div className="flex items-center gap-2 border border-slate-700 rounded-md bg-slate-700 p-1">
                      <img src={adminSignature} alt="Admin signature preview" className="h-10 w-20 object-contain bg-white rounded-sm" />
                      {adminSignatureClarification && <p className="text-xs text-gray-300 pr-2">{adminSignatureClarification}</p>}
                    </div>
                )}
                  <button
                  onClick={() => generateSubmissionsPdf(userSubmissions, adminSignature!, adminSignatureClarification)}
                  disabled={userSubmissions.length === 0 || !adminSignature || !adminSignatureClarification}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                  <FileDown className="h-5 w-5 mr-2" />
                  Descargar Constancia
                  </button>
              </div>
          </div>
          
          <div className="overflow-x-auto">
            {userSubmissions.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">DNI</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Capacitación</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {userSubmissions.map((sub) => (
                    <tr key={sub.id} onClick={() => setSelectedSubmission(sub)} className="hover:bg-slate-700 cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{sub.firstName} {sub.lastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{sub.dni}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{sub.trainingName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{sub.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-2 text-sm text-gray-500">Aún no hay registros de usuarios.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {editingTraining && (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
           <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-slate-700">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-semibold text-white">Editar Capacitación</h2>
               <button onClick={() => setEditingTraining(null)} className="p-1 text-gray-400 hover:text-white">
                 <X className="h-6 w-6" />
               </button>
             </div>
             <form onSubmit={handleUpdateTraining} className="space-y-4">
              <div>
                <label htmlFor="editedName" className="block text-sm font-medium text-gray-300">Nombre de la Capacitación</label>
                <input id="editedName" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="editedLinks" className="block text-sm font-medium text-gray-300">Enlaces (uno por línea)</label>
                <textarea id="editedLinks" value={editedLinksText} onChange={(e) => setEditedLinksText(e.target.value)} rows={5} className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                 <button type="button" onClick={() => setEditingTraining(null)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-md hover:bg-slate-600">Cancelar</button>
                 <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Guardar Cambios</button>
              </div>
             </form>
           </div>
         </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md text-center border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Compartir Capacitaciones</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-gray-400 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
            <p className="text-gray-400 mb-4">Los usuarios pueden escanear este código QR o usar el enlace para acceder a las capacitaciones.</p>
            
            {qrCodeDataUrl ? (
                <div className="flex justify-center mb-4 p-2 bg-slate-900/50 rounded-lg">
                    <img src={qrCodeDataUrl} alt="QR Code for trainings" className="border-4 border-slate-700 rounded-lg" />
                </div>
            ) : (
                <div className="h-64 w-64 bg-slate-700 flex items-center justify-center rounded-lg mx-auto mb-4">
                    <p className="text-gray-500">Generando QR...</p>
                </div>
            )}

            <p className="text-gray-400 mb-2 text-sm">O copia y comparte el enlace:</p>
            <div className="relative">
               <input type="text" value={shareableLink} readOnly className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 pr-10 text-sm text-gray-300"/>
               <button onClick={copyToClipboard} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-indigo-400"><Copy className="h-5 w-5" /></button>
            </div>
            {copySuccess && <p className="text-green-500 text-sm mt-2">{copySuccess}</p>}
          </div>
        </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Detalles del Registro</h2>
              <button onClick={() => setSelectedSubmission(null)} className="p-1 text-gray-400 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-3 text-sm text-gray-300">
                <p><strong>Capacitación:</strong> {selectedSubmission.trainingName}</p>
                <p><strong>Nombre:</strong> {selectedSubmission.firstName} {selectedSubmission.lastName}</p>
                <p><strong>DNI:</strong> {selectedSubmission.dni}</p>
                <p><strong>Empresa:</strong> {selectedSubmission.company}</p>
                <p><strong>Email:</strong> {selectedSubmission.email || 'N/A'}</p>
                <p><strong>Teléfono:</strong> {selectedSubmission.phone || 'N/A'}</p>
                <p><strong>Fecha:</strong> {selectedSubmission.timestamp}</p>
                <div>
                    <p><strong>Firma:</strong></p>
                    <div className="mt-2 border border-slate-700 rounded-lg p-2 bg-white">
                        <img src={selectedSubmission.signature} alt="Firma digital del usuario" className="mx-auto"/>
                    </div>
                </div>
            </div>
             <div className="flex justify-end pt-4">
                 <button type="button" onClick={() => setSelectedSubmission(null)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-md hover:bg-slate-600">Cerrar</button>
              </div>
          </div>
        </div>
      )}

      {showAdminSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Firma del Administrador</h2>
                <button onClick={() => setShowAdminSignatureModal(false)} className="p-1 text-gray-400 hover:text-white">
                    <X className="h-6 w-6" />
                </button>
                </div>
                <p className="text-sm text-gray-400 mb-2">Dibuja tu firma en el recuadro. Esta firma se incluirá en el PDF de constancia.</p>
                <SignaturePad signatureRef={adminSignatureRef} onSignatureEnd={() => {}} />
                <div className="mt-4">
                    <label htmlFor="clarification" className="block text-sm font-medium text-gray-300">Aclaración de Firma (Nombre y Apellido)</label>
                    <input
                        id="clarification"
                        type="text"
                        value={adminSignatureClarification}
                        onChange={(e) => setAdminSignatureClarification(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="flex justify-between items-center mt-4">
                <button
                    type="button"
                    onClick={() => adminSignatureRef.current?.clear()}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-md hover:bg-slate-600"
                >
                    Limpiar
                </button>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setShowAdminSignatureModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-md hover:bg-slate-600"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveAdminSignature}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                    >
                        Guardar Firma
                    </button>
                </div>
                </div>
            </div>
        </div>
        )}
    </div>
  );
};


// --- APP ---
type View = 'selector' | 'login' | 'admin' | 'user';

const App: React.FC = () => {
  const [view, setView] = useState<View>('selector');
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserSubmission[]>(() => {
    try {
      const savedSubmissions = localStorage.getItem('userSubmissions');
      return savedSubmissions ? JSON.parse(savedSubmissions) : [];
    } catch (error) {
      console.error("Failed to parse user submissions from localStorage", error);
      return [];
    }
  });
  
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('data');
      const viewParam = params.get('view');
      let urlWasModified = false;

      if (viewParam === 'user') {
        setView('user');
        urlWasModified = true;
      }

      if (data) {
        const decodedTrainings = JSON.parse(decodeURIComponent(atob(data)));
        if (Array.isArray(decodedTrainings)) {
          setTrainings(decodedTrainings);
          localStorage.setItem('trainings', JSON.stringify(decodedTrainings));
          setView('user');
          urlWasModified = true;
        }
      } else {
         const savedTrainings = localStorage.getItem('trainings');
         if (savedTrainings) {
            setTrainings(JSON.parse(savedTrainings));
         }
      }

      if (urlWasModified) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
       console.error("Failed to load trainings from URL or localStorage", error);
       try {
            const savedTrainings = localStorage.getItem('trainings');
            if (savedTrainings) {
                setTrainings(JSON.parse(savedTrainings));
            }
       } catch (e) {
            console.error("Failed to load trainings from localStorage as fallback", e);
       }
    }
  }, []);

  useEffect(() => {
    if (trainings.length > 0) {
        try {
          localStorage.setItem('trainings', JSON.stringify(trainings));
        } catch (error) {
          console.error("Failed to save trainings to localStorage", error);
        }
    }
  }, [trainings]);

  useEffect(() => {
    try {
      localStorage.setItem('userSubmissions', JSON.stringify(userSubmissions));
    } catch (error) {
      console.error("Failed to save user submissions to localStorage", error);
    }
  }, [userSubmissions]);

  const addTraining = (name: string, urls: string[]) => {
    const newTraining: Training = {
      id: `training-${Date.now()}`,
      name,
      links: urls.map((url, index) => ({
        id: `link-${Date.now()}-${index}`,
        url,
        viewed: false,
      })),
    };
    setTrainings(prev => [...prev, newTraining]);
  };

  const updateTraining = (id: string, name: string, urls: string[]) => {
    setTrainings(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          name,
          links: urls.map((url, index) => {
            const existingLink = t.links.find(l => l.url === url);
            return existingLink || { id: `link-${Date.now()}-${index}`, url, viewed: false };
          }),
        };
      }
      return t;
    }));
  };

  const deleteTraining = (id: string) => {
    setTrainings(prev => prev.filter(t => t.id !== id));
  };

  const addUserSubmission = (submission: Omit<UserSubmission, 'id'>) => {
    const newSubmission: UserSubmission = {
      ...submission,
      id: `sub-${Date.now()}`,
    };
    setUserSubmissions(prev => [...prev, newSubmission]);
  };
  
  const renderView = () => {
    switch (view) {
      case 'login':
        return <AdminLogin onLoginSuccess={() => setView('admin')} onBack={() => setView('selector')} />;
      case 'admin':
        return <AdminDashboard 
                    trainings={trainings}
                    userSubmissions={userSubmissions} 
                    addTraining={addTraining}
                    updateTraining={updateTraining}
                    deleteTraining={deleteTraining}
                    onLogout={() => setView('selector')} 
                />;
      case 'user':
        return <UserPortal 
                    trainings={trainings} 
                    setTrainings={setTrainings} 
                    addUserSubmission={addUserSubmission}
                    onBack={() => setView('selector')}
                />;
      case 'selector':
      default:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">Bienvenido a Trainer App</h1>
            <p className="mt-4 max-w-xl mx-auto text-lg text-gray-400">Completa las capacitaciones asignadas para registrar tu asistencia.</p>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setView('user')}
                className="flex flex-col items-center justify-center w-48 h-48 p-6 bg-slate-800 rounded-2xl shadow-lg hover:shadow-sky-500/20 hover:-translate-y-1 transition-all duration-300 border border-slate-700"
              >
                <User className="h-16 w-16 text-sky-400 mb-4" />
                <span className="text-lg font-semibold text-white">Iniciar</span>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 flex items-center justify-center p-4 relative">
      {renderView()}
      {view === 'selector' && (
        <div className="absolute bottom-6 right-6">
            <button
                onClick={() => setView('login')}
                className="text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
                Acceso Administrador
            </button>
        </div>
      )}
    </div>
  );
};


// --- RENDER ---
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);