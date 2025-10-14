// FIX: Removed invalid file markers from the beginning and end of the file.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye, FileText, CheckCircle, ArrowLeft, Send, LogIn, RefreshCw } from 'lucide-react';


// --- TYPES ---
interface TrainingLink {
  id: string;
  name?: string;
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

interface AdminConfig {
  signature: string | null;
  clarification: string;
  jobTitle: string;
}

// --- SIMULATED BACKEND API SERVICE ---
// Using a live, centralized JSON store to allow multi-device synchronization.
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/1251394142642536448';

interface AppData {
  submissions: UserSubmission[];
  adminConfig?: AdminConfig;
  sharedTrainings?: { [key: string]: Training };
  trainings?: Training[];
}


const apiService = {
  // Fetches the entire data blob from the cloud store.
  _getData: async (): Promise<AppData> => {
    try {
      const response = await fetch(JSON_BLOB_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        cache: 'no-store', // Prevent browser caching to ensure data is always fresh
      });
      if (!response.ok) {
        console.error(`Network response was not ok: ${response.statusText}`);
        return { submissions: [], adminConfig: { signature: null, clarification: '', jobTitle: '' }, sharedTrainings: {}, trainings: [] };
      }
      const text = await response.text();
      // Handle empty blob case
      const data = text ? JSON.parse(text) : {};
      return {
        submissions: data.submissions || [],
        adminConfig: data.adminConfig || { signature: null, clarification: '', jobTitle: '' },
        sharedTrainings: data.sharedTrainings || {},
        trainings: data.trainings || []
      };
    } catch (error) {
      console.error("Failed to fetch data from remote store:", error);
      return { submissions: [], adminConfig: { signature: null, clarification: '', jobTitle: '' }, sharedTrainings: {}, trainings: [] }; // Return default structure on error
    }
  },

  shareTraining: async (training: Training): Promise<string> => {
      const key = `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const data = await apiService._getData();
      const sharedTrainings = data.sharedTrainings || {};
      sharedTrainings[key] = training;
      
      const updatedData = { ...data, sharedTrainings };

      await fetch(JSON_BLOB_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData),
      });

      return key;
  },

  getSharedTraining: async (key: string): Promise<Training | null> => {
      const data = await apiService._getData();
      return data.sharedTrainings?.[key] || null;
  },

  getTrainings: async (): Promise<Training[]> => {
    const data = await apiService._getData();
    return data.trainings || [];
  },

  updateTrainings: async (trainings: Training[]): Promise<void> => {
    const data = await apiService._getData();
    const updatedData = { ...data, trainings };
    
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
  },

  getSubmissions: async (): Promise<UserSubmission[]> => {
    const data = await apiService._getData();
    return data.submissions || [];
  },

  getAdminConfig: async (): Promise<AdminConfig> => {
    const data = await apiService._getData();
    return data.adminConfig || { signature: null, clarification: '', jobTitle: '' };
  },

  updateAdminConfig: async (config: AdminConfig): Promise<void> => {
    const data = await apiService._getData();
    const updatedData = { ...data, adminConfig: config };
    
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
  },

  addSubmission: async (submission: UserSubmission): Promise<UserSubmission> => {
    const data = await apiService._getData();
    const newSubmissions = [...(data.submissions || []), submission];
    const updatedData = { ...data, submissions: newSubmissions };
    
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
    return submission;
  },

  deleteSubmission: async (id: string): Promise<void> => {
    const data = await apiService._getData();
    let submissions = (data.submissions || []).filter(sub => sub.id !== id);
    const updatedData = { ...data, submissions };
    
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
  },

  deleteAllSubmissions: async (): Promise<void> => {
    const data = await apiService._getData();
    const updatedData = { ...data, submissions: [] };
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
  }
};


// --- SERVICES ---
const generateSubmissionsPdf = (submissions: UserSubmission[], adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string): void => {
  if (!adminSignature || !adminSignatureClarification || !adminJobTitle) {
      alert("Error: La firma y los datos del administrador deben estar configurados para generar el PDF.");
      return;
  }
  if (!submissions || submissions.length === 0) {
    alert('No hay registros de usuarios para generar el PDF.');
    return;
  }
  
  try {
    const doc = new jsPDF();
    
    doc.text('Registro de Asistencia a Capacitaciones', 14, 16);
    
    const tableColumns = ['Nombre', 'Apellido', 'DNI', 'Empresa', 'Capacitación', 'Fecha', 'Firma'];
    const tableRows = submissions.map(sub => [
      sub.firstName,
      sub.lastName,
      sub.dni,
      sub.company,
      sub.trainingName,
      sub.timestamp,
      '', // Placeholder for the signature image
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 24,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
      columnStyles: {
        6: { cellWidth: 40, minCellHeight: 20 }, // Signature column
      },
      didDrawCell: (data) => {
        if (data.column.index === 6 && data.cell.section === 'body') {
          const submission = submissions[data.row.index];
          if (submission && submission.signature) {
            try {
              // Add user signature image to the cell, scaled to fit.
              const cellPadding = 2;
              const cellHeight = data.cell.height - (cellPadding * 2);
              const cellWidth = data.cell.width - (cellPadding * 2);

              const imgProps = doc.getImageProperties(submission.signature);
              const aspectRatio = imgProps.width / imgProps.height;
              
              let imgWidth = cellWidth;
              let imgHeight = imgWidth / aspectRatio;

              if (imgHeight > cellHeight) {
                imgHeight = cellHeight;
                imgWidth = imgHeight * aspectRatio;
              }

              const x = data.cell.x + (data.cell.width - imgWidth) / 2;
              const y = data.cell.y + (data.cell.height - imgHeight) / 2;
              
              doc.addImage(submission.signature, 'PNG', x, y, imgWidth, imgHeight);
            } catch (e) {
              console.error(`Error adding signature for user ${submission.dni}:`, e);
              doc.text("Error firma", data.cell.x + 2, data.cell.y + data.cell.height / 2);
            }
          }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 100;
    const pageHeight = doc.internal.pageSize.getHeight();
    let signatureY = finalY + 15;

    if (signatureY + 60 > pageHeight) {
      doc.addPage();
      signatureY = 20;
    }
    
    try {
        doc.addImage(adminSignature, 'PNG', 14, signatureY + 5, 60, 30);
        doc.setDrawColor(0);
        doc.line(14, signatureY + 38, 74, signatureY + 38);
        doc.text(adminSignatureClarification, 14, signatureY + 43);
        doc.setFontSize(9);
        doc.text(adminJobTitle, 14, signatureY + 48);
    } catch (imageError) {
        console.error("Error al añadir la firma al PDF:", imageError);
        doc.text("Error al cargar la firma.", 14, signatureY + 20);
    }

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        alert('Tu navegador ha bloqueado la apertura de una nueva pestaña. Por favor, permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
    }

  } catch(e) {
    console.error("Fallo al generar el PDF general de registros:", e);
    alert("Ocurrió un error al generar el PDF. Por favor, revisa la consola para más detalles.");
  }
};


const generateSingleSubmissionPdf = (submission: UserSubmission, adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string): void => {
  try {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Constancia de Capacitación', doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Por la presente se certifica que:', 20, 60);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${submission.firstName} ${submission.lastName}`, doc.internal.pageSize.getWidth() / 2, 80, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Con DNI ${submission.dni}, de la empresa ${submission.company},`, doc.internal.pageSize.getWidth() / 2, 90, { align: 'center' });
    
    doc.text('ha completado satisfactoriamente la capacitación:', 20, 110);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`"${submission.trainingName}"`, doc.internal.pageSize.getWidth() / 2, 125, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Completada el: ${submission.timestamp}`, 20, 145);

    const signatureY = 180;
    if (adminSignature) {
        const signatureX = (doc.internal.pageSize.getWidth() / 2) - 30;
        doc.addImage(adminSignature, 'PNG', signatureX, signatureY, 60, 30);
        doc.setDrawColor(0); // Black line
        doc.line(signatureX, signatureY + 33, signatureX + 60, signatureY + 33); // Line under signature
        if (adminSignatureClarification) {
            doc.setFont('helvetica', 'bold');
            doc.text(adminSignatureClarification, doc.internal.pageSize.getWidth() / 2, signatureY + 38, { align: 'center'});
        }
        if (adminJobTitle) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.text(adminJobTitle, doc.internal.pageSize.getWidth() / 2, signatureY + 44, { align: 'center'});
        }
    }

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        alert('Tu navegador ha bloqueado la apertura de una nueva pestaña. Por favor, permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
    }
  } catch (e) {
    console.error("Error al generar o mostrar el PDF:", e);
    alert("Ocurrió un error al generar la constancia. Por favor, inténtalo de nuevo o contacta al administrador.");
  }
};


// --- COMPONENTS ---

// SignaturePad.tsx
interface SignaturePadProps {
  onSignatureEnd: (signature: string) => void;
  signatureRef: React.RefObject<SignatureCanvas>;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureEnd, signatureRef }) => {
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
  setTrainingsStateForUser: React.Dispatch<React.SetStateAction<Training[]>>;
  onBack: () => void;
}

const UserPortal: React.FC<UserPortalProps> = ({ trainings, setTrainingsStateForUser: setTrainings, onBack }) => {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [formCompleted, setFormCompleted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<UserSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [isLoadingAdminConfig, setIsLoadingAdminConfig] = useState(true);

  useEffect(() => {
    const fetchAdminConfig = async () => {
      try {
        const config = await apiService.getAdminConfig();
        setAdminConfig(config);
      } catch (error) {
        console.error("Failed to fetch admin config:", error);
      } finally {
        setIsLoadingAdminConfig(false);
      }
    };
    fetchAdminConfig();
  }, []); // Run only once on mount

  useEffect(() => {
    if (trainings.length > 0) {
        const loadedTrainings = trainings.map(t => {
            const progress = localStorage.getItem(`training-progress-${t.id}`);
            if (progress) {
                try {
                    const viewedLinkIds: string[] = JSON.parse(progress);
                    const updatedLinks = t.links.map(l => 
                        viewedLinkIds.includes(l.id) ? { ...l, viewed: true } : l
                    );
                    return { ...t, links: updatedLinks };
                } catch (e) {
                    console.error("Failed to parse training progress from localStorage", e);
                    return t;
                }
            }
            return t;
        });

        if (JSON.stringify(loadedTrainings) !== JSON.stringify(trainings)) {
            setTrainings(loadedTrainings);
        }
    }
  }, [trainings, setTrainings]);

  const selectedTraining = useMemo(() => {
    return trainings.find(t => t.id === selectedTrainingId) || null;
  }, [selectedTrainingId, trainings]);

  const allLinksViewed = useMemo(() => {
    if (!selectedTraining) return false;
    return selectedTraining.links.every(link => link.viewed);
  }, [selectedTraining]);
  
  const handleLinkClick = (trainingId: string, linkId: string) => {
    setTrainings(currentTrainings => {
      const updatedTrainings = currentTrainings.map(t =>
        t.id === trainingId
          ? { ...t, links: t.links.map(l => l.id === linkId ? { ...l, viewed: true } : l) }
          : t
      );
      
      const targetTraining = updatedTrainings.find(t => t.id === trainingId);
      if (targetTraining) {
          const viewedLinkIds = targetTraining.links
              .filter(l => l.viewed)
              .map(l => l.id);
          localStorage.setItem(`training-progress-${trainingId}`, JSON.stringify(viewedLinkIds));
      }
      
      return updatedTrainings;
    });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraining || !formData.signature) {
        alert("Por favor, proporciona toda la información requerida, incluyendo tu firma.");
        return;
    }
    
    setIsSubmitting(true);
    
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }) + ' ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const newSubmission: UserSubmission = {
        id: `sub-${selectedTraining.id}-${formData.dni}-${Date.now()}`,
        timestamp: formattedTimestamp,
        trainingId: selectedTraining.id,
        trainingName: selectedTraining.name,
        ...formData
    };
    
    try {
      await apiService.addSubmission(newSubmission);
      setLastSubmission(newSubmission);
      setFormCompleted(true);
    } catch (error) {
      console.error("Failed to submit training data:", error);
      alert("Hubo un error al enviar tu registro. Por favor, inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (formCompleted && lastSubmission) {
    const downloadDisabled = isLoadingAdminConfig || !adminConfig?.signature || !adminConfig?.clarification || !adminConfig?.jobTitle;
    const downloadTitle = isLoadingAdminConfig 
        ? "Cargando configuración..."
        : (!adminConfig?.signature || !adminConfig?.clarification || !adminConfig?.jobTitle) 
        ? "El administrador aún no ha configurado firma, aclaración y cargo para las constancias." 
        : "Descargar mi constancia en PDF";

    return (
        <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl max-w-2xl mx-auto">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-white">¡Registro Enviado con Éxito!</h2>
            <p className="mt-2 text-gray-400">Tu registro ha sido enviado al administrador.</p>
            <div className="mt-6 border-t border-slate-700 pt-6 space-y-4 text-left">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center font-bold text-white">1</div>
                    <div>
                        <h3 className="font-semibold text-white">Descarga tu constancia personal (Opcional)</h3>
                        <p className="text-sm text-gray-400 mb-2">Guarda este PDF como comprobante personal de que has completado la capacitación.</p>
                        <button
                            onClick={() => {
                                if (!adminConfig || !adminConfig.signature || !adminConfig.clarification || !adminConfig.jobTitle) {
                                    console.error("Download button clicked in an invalid state. AdminConfig:", adminConfig);
                                    alert("No se puede generar la constancia porque faltan datos del administrador. Contacte al administrador.");
                                    return;
                                }
                                generateSingleSubmissionPdf(lastSubmission, adminConfig.signature, adminConfig.clarification, adminConfig.jobTitle);
                            }}
                            disabled={downloadDisabled}
                            title={downloadTitle}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-500 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            <FileDown className="h-4 w-4 mr-2" />
                            {isLoadingAdminConfig ? 'Cargando...' : 'Descargar Mi Constancia'}
                        </button>
                    </div>
                </div>
                 <div className="text-center mt-6">
                    <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300">Volver a la página principal</button>
                </div>
            </div>
        </div>
    );
  }

  if (selectedTraining) {
    const progress = (selectedTraining.links.filter(l => l.viewed).length / selectedTraining.links.length) * 100;
    
    return (
        <div className="w-full max-w-4xl mx-auto bg-slate-800 p-8 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setSelectedTrainingId(null)} className="flex items-center text-sm text-indigo-400 hover:text-indigo-300">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a la lista de capacitaciones
                </button>
                <button onClick={onBack} className="flex items-center text-sm text-gray-400 hover:text-gray-200">
                    Volver al menú principal
                </button>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{selectedTraining.name}</h2>
            <p className="text-gray-400 mb-4">Revisa los siguientes enlaces para completar la capacitación. Una vez revisados todos, podrás registrar tu asistencia.</p>
            
            <div className="mb-4">
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-sm text-right text-gray-400 mt-1">{Math.round(progress)}% completado</p>
            </div>

            <div className="space-y-3 mb-8">
                {selectedTraining.links.map((link, index) => (
                    <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(selectedTraining.id, link.id)}
                        title={link.url}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${link.viewed ? 'bg-green-900/30 border-green-500/50' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-700'}`}
                    >
                        <div className="flex items-center min-w-0">
                            <FileText className="h-5 w-5 mr-3 text-indigo-400 flex-shrink-0"/>
                            <div className="min-w-0">
                                <span className="font-medium text-white">{link.name?.trim() ? link.name : `Material de Estudio ${index + 1}`}</span>
                                <p className="text-sm text-gray-400 truncate">{link.url}</p>
                            </div>
                        </div>
                        {link.viewed && <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 ml-4" />}
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
                        disabled={!formData.signature || isSubmitting}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed">
                        <Send className="h-5 w-5 mr-2" />
                        {isSubmitting ? 'Enviando...' : 'Enviar Registro'}
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
          Volver al menú principal
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
interface LinkInput {
    tempId: number;
    name: string;
    url: string;
}

interface AdminDashboardProps {
  trainings: Training[];
  addTraining: (name: string, links: { name: string, url: string }[]) => Promise<void>;
  updateTraining: (id: string, name: string, links: { name: string, url: string }[]) => Promise<void>;
  deleteTraining: (id: string) => Promise<void>;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    trainings, addTraining, updateTraining, deleteTraining, onLogout
}) => {
  const [trainingName, setTrainingName] = useState('');
  const [newTrainingLinks, setNewTrainingLinks] = useState<LinkInput[]>([{ tempId: Date.now(), name: '', url: '' }]);
  const [feedback, setFeedback] = useState('');
  
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedTrainingLinks, setEditedTrainingLinks] = useState<LinkInput[]>([]);

  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingTrainingName, setSharingTrainingName] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmission | null>(null);
  const [showAdminSignatureModal, setShowAdminSignatureModal] = useState(false);
  
  const [adminSignature, setAdminSignature] = useState<string | null>(null);
  const [adminSignatureClarification, setAdminSignatureClarification] = useState('');
  const [adminJobTitle, setAdminJobTitle] = useState('');
  
  const [currentClarification, setCurrentClarification] = useState('');
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  
  const [userSubmissions, setUserSubmissions] = useState<UserSubmission[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const adminSignatureRef = useRef<SignatureCanvas>(null);
  
  const fetchSubmissions = async () => {
    const subs = await apiService.getSubmissions();
    setUserSubmissions(currentSubs => {
        if(JSON.stringify(currentSubs) !== JSON.stringify(subs)){
            return subs;
        }
        return currentSubs;
    });
  };
  
  const fetchAdminConfig = async () => {
      const config = await apiService.getAdminConfig();
      setAdminSignature(config.signature);
      setAdminSignatureClarification(config.clarification);
      setAdminJobTitle(config.jobTitle);
      setCurrentClarification(config.clarification);
      setCurrentJobTitle(config.jobTitle);
  };

  useEffect(() => {
    fetchSubmissions();
    fetchAdminConfig();

    const intervalId = setInterval(() => {
        fetchSubmissions();
        fetchAdminConfig();
    }, 5000); // Poll every 5 seconds for updates

    return () => {
        clearInterval(intervalId); // Cleanup on unmount
    };
  }, []);

  useEffect(() => {
    if (editingTraining) {
      setEditedName(editingTraining.name);
      setEditedTrainingLinks(
        editingTraining.links.map(l => ({
          tempId: Math.random(),
          name: l.name || '',
          url: l.url
        }))
      );
    }
  }, [editingTraining]);


  // Handlers for creating new training links
  const handleNewLinkChange = (index: number, field: 'name' | 'url', value: string) => {
      const updatedLinks = [...newTrainingLinks];
      updatedLinks[index][field] = value;
      setNewTrainingLinks(updatedLinks);
  };

  const addNewLink = () => {
      setNewTrainingLinks([...newTrainingLinks, { tempId: Date.now(), name: '', url: '' }]);
  };

  const removeNewLink = (index: number) => {
      if (newTrainingLinks.length > 1) {
          setNewTrainingLinks(newTrainingLinks.filter((_, i) => i !== index));
      }
  };

  // Handlers for editing existing training links
  const handleEditedLinkChange = (index: number, field: 'name' | 'url', value: string) => {
    const updatedLinks = [...editedTrainingLinks];
    updatedLinks[index][field] = value;
    setEditedTrainingLinks(updatedLinks);
  };

  const addEditedLink = () => {
      setEditedTrainingLinks([...editedTrainingLinks, { tempId: Date.now(), name: '', url: '' }]);
  };

  const removeEditedLink = (index: number) => {
      if (editedTrainingLinks.length > 1) {
          setEditedTrainingLinks(editedTrainingLinks.filter((_, i) => i !== index));
      }
  };

  const handleAddTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingName.trim()) {
      setFeedback('El nombre de la capacitación no puede estar vacío.');
      return;
    }
    const links = newTrainingLinks
      .map(l => ({ name: l.name.trim(), url: l.url.trim() }))
      .filter(l => l.url !== '');

    if (links.length === 0) {
        setFeedback('Debe proporcionar al menos un enlace válido.');
        return;
    }
    await addTraining(trainingName, links);
    setTrainingName('');
    setNewTrainingLinks([{ tempId: Date.now(), name: '', url: '' }]);
    setFeedback('¡Capacitación agregada exitosamente!');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleUpdateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTraining) return;

    const links = editedTrainingLinks
        .map(l => ({ name: l.name.trim(), url: l.url.trim() }))
        .filter(l => l.url !== '');

    if (!editedName.trim() || links.length === 0) {
      alert("El nombre y al menos un enlace válido son requeridos.");
      return;
    }
    await updateTraining(editingTraining.id, editedName, links);
    setEditingTraining(null);
  }

  const handleDeleteTraining = async (id: string) => {
    if(window.confirm('¿Estás seguro de que quieres eliminar esta capacitación? Esta acción no se puede deshacer.')) {
      await deleteTraining(id);
    }
  }

  const handleShare = async (trainingToShare: Training) => {
    const pristineTraining = {
      ...trainingToShare,
      links: trainingToShare.links.map(link => ({ ...link, viewed: false }))
    };
    
    try {
      const shareKey = await apiService.shareTraining(pristineTraining);
      const link = `${window.location.origin}${window.location.pathname}?shareKey=${shareKey}`;
      
      setShareableLink(link);
      setSharingTrainingName(trainingToShare.name);

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
    const pristineTrainings = trainings.map(training => ({
      ...training,
      links: training.links.map(link => ({...link, viewed: false }))
    }));

    const data = btoa(encodeURIComponent(JSON.stringify(pristineTrainings)));
    const userViewUrl = `${window.location.origin}${window.location.pathname}?data=${data}`;
    window.open(userViewUrl, '_blank');
  };

  const handleSaveAdminSignature = async () => {
    if (adminSignatureRef.current) {
      if (adminSignatureRef.current.isEmpty()) {
          alert("Por favor, dibuja tu firma antes de guardar.");
          return;
      }
       if (!currentClarification.trim()) {
          alert("Por favor, ingresa tu aclaración de firma.");
          return;
      }
       if (!currentJobTitle.trim()) {
          alert("Por favor, ingresa tu cargo.");
          return;
      }
      const signatureDataUrl = adminSignatureRef.current.toDataURL();
      const newConfig = {
        signature: signatureDataUrl,
        clarification: currentClarification,
        jobTitle: currentJobTitle
      };
      await apiService.updateAdminConfig(newConfig);
      setAdminSignature(signatureDataUrl);
      setAdminSignatureClarification(currentClarification);
      setAdminJobTitle(currentJobTitle);
      setShowAdminSignatureModal(false);
    }
  };
  
  const handleClearAdminSignature = async () => {
      if (window.confirm("¿Estás seguro de que quieres eliminar la firma y los datos guardados? Esta acción no se puede deshacer.")) {
        const newConfig = { signature: null, clarification: '', jobTitle: '' };
        await apiService.updateAdminConfig(newConfig);
        setAdminSignature(null);
        setAdminSignatureClarification('');
        setAdminJobTitle('');
        setCurrentClarification('');
        setCurrentJobTitle('');
        adminSignatureRef.current?.clear();
        setShowAdminSignatureModal(false);
      }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro? Esta acción es irreversible.')) {
      await apiService.deleteSubmission(submissionId);
    }
  };

  const handleDeleteAllSubmissions = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar TODOS los registros? Esta acción es irreversible.')) {
        if (window.confirm('Por favor, confirma de nuevo. Esta acción eliminará permanentemente todos los registros de usuarios.')) {
            await apiService.deleteAllSubmissions();
        }
    }
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubmissions();
    await fetchAdminConfig();
    setIsRefreshing(false);
  };

  const downloadButtonTitle = userSubmissions.length === 0 
    ? "No hay registros para descargar" 
    : (!adminSignature || !adminSignatureClarification || !adminJobTitle) 
    ? "Debe configurar firma, aclaración y cargo para descargar" 
    : "Descargar constancia de todos los registros";

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Panel de Administrador</h1>
        <button onClick={onLogout} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
          <ArrowLeft className="h-4 w-4 mr-2"/>
          Menú Principal
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
                  required
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Enlaces</label>
                  <div className="space-y-3">
                      {newTrainingLinks.map((link, index) => (
                          <div key={link.tempId} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-md border border-slate-600">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-grow">
                                  <input
                                      type="text"
                                      value={link.name}
                                      onChange={(e) => handleNewLinkChange(index, 'name', e.target.value)}
                                      placeholder={`Nombre del Enlace ${index + 1} (Opcional)`}
                                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  />
                                  <input
                                      type="url"
                                      value={link.url}
                                      onChange={(e) => handleNewLinkChange(index, 'url', e.target.value)}
                                      placeholder="https://ejemplo.com/recurso"
                                      required
                                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  />
                              </div>
                              <button
                                  type="button"
                                  onClick={() => removeNewLink(index)}
                                  disabled={newTrainingLinks.length <= 1}
                                  className="p-2 text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed hover:bg-red-900/30 rounded-full transition-colors flex-shrink-0"
                                  title="Eliminar enlace"
                              >
                                  <Trash2 className="h-4 w-4" />
                              </button>
                          </div>
                      ))}
                  </div>
                  <button
                      type="button"
                      onClick={addNewLink}
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md shadow-sm text-gray-300 bg-slate-700 hover:bg-slate-600 focus:outline-none"
                  >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Añadir Otro Enlace
                  </button>
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
                        title={trainings.length === 0 ? "Crea una capacitación para previsualizar" : "Previsualizar cómo ven los usuarios"}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Vista de Usuario
                    </button>
                </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trainings.length > 0 ? (
                trainings.map(training => (
                  <div key={training.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <span className="font-medium text-gray-200 truncate pr-2" title={training.name}>{training.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleShare(training)} className="p-2 text-teal-400 hover:text-teal-300 hover:bg-teal-900/30 rounded-full transition-colors" title="Compartir">
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingTraining(training)} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-full transition-colors" title="Editar">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteTraining(training.id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-full transition-colors" title="Eliminar">
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
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-200">Usuarios Registrados ({userSubmissions.length})</h2>
              <button 
                  onClick={handleRefresh} 
                  disabled={isRefreshing} 
                  title="Actualizar registros"
                  className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors disabled:cursor-wait"
              >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
                       <div className="pr-2">
                        {adminSignatureClarification && <p className="text-xs text-gray-300">{adminSignatureClarification}</p>}
                        {adminJobTitle && <p className="text-xs text-gray-400 italic">{adminJobTitle}</p>}
                       </div>
                    </div>
                  )}
              </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center border-t border-slate-700 pt-4">
              <button
                  onClick={() => {
                      if (userSubmissions.length === 0) {
                          alert('No hay registros de usuarios para generar el PDF.');
                          return;
                      }
                      if (!adminSignature || !adminSignatureClarification || !adminJobTitle) {
                          alert("Error: La firma y los datos del administrador deben estar configurados para generar el PDF.");
                          return;
                      }
                      generateSubmissionsPdf(userSubmissions, adminSignature, adminSignatureClarification, adminJobTitle);
                  }}
                  disabled={userSubmissions.length === 0 || !adminSignature || !adminSignatureClarification || !adminJobTitle}
                  title={downloadButtonTitle}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                  <FileDown className="h-5 w-5 mr-2" />
                  Descargar Constancia Gral.
              </button>
              <button
                  onClick={handleDeleteAllSubmissions}
                  disabled={userSubmissions.length === 0}
                  title={userSubmissions.length === 0 ? "No hay registros para borrar" : "Borrar todos los registros"}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Borrar Todos los Registros
              </button>
          </div>
          
          <div className="overflow-x-auto mt-4">
            {userSubmissions.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">DNI</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Capacitación</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {userSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-700">
                      <td onClick={() => setSelectedSubmission(sub)} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white cursor-pointer">{sub.firstName} {sub.lastName}</td>
                      <td onClick={() => setSelectedSubmission(sub)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 cursor-pointer">{sub.dni}</td>
                      <td onClick={() => setSelectedSubmission(sub)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 cursor-pointer">{sub.trainingName}</td>
                      <td onClick={() => setSelectedSubmission(sub)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 cursor-pointer">{sub.timestamp}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-right">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubmission(sub.id);
                            }}
                            title="Eliminar registro"
                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-900/30 rounded-full transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-2 text-sm text-gray-500">Aún no hay registros de usuarios.</p>
                <p className="mt-1 text-xs text-gray-600">Cuando un usuario complete una capacitación, su registro aparecerá aquí automáticamente.</p>
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
                <input id="editedName" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Enlaces</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                      {editedTrainingLinks.map((link, index) => (
                          <div key={link.tempId} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-md border border-slate-600">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-grow">
                                  <input
                                      type="text"
                                      value={link.name}
                                      onChange={(e) => handleEditedLinkChange(index, 'name', e.target.value)}
                                      placeholder={`Nombre del Enlace ${index + 1} (Opcional)`}
                                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  />
                                  <input
                                      type="url"
                                      value={link.url}
                                      onChange={(e) => handleEditedLinkChange(index, 'url', e.target.value)}
                                      placeholder="https://ejemplo.com/recurso"
                                      required
                                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  />
                              </div>
                              <button
                                  type="button"
                                  onClick={() => removeEditedLink(index)}
                                  disabled={editedTrainingLinks.length <= 1}
                                  className="p-2 text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed hover:bg-red-900/30 rounded-full transition-colors flex-shrink-0"
                                  title="Eliminar enlace"
                              >
                                  <Trash2 className="h-4 w-4" />
                              </button>
                          </div>
                      ))}
                  </div>
                  <button
                      type="button"
                      onClick={addEditedLink}
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md shadow-sm text-gray-300 bg-slate-700 hover:bg-slate-600 focus:outline-none"
                  >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Añadir Otro Enlace
                  </button>
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
              <h2 className="text-xl font-semibold text-white truncate pr-2">Compartir: {sharingTrainingName}</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-gray-400 hover:text-white flex-shrink-0"><X className="h-6 w-6" /></button>
            </div>
            <p className="text-gray-400 mb-4">Los usuarios pueden escanear este código QR o usar el enlace para acceder a la capacitación.</p>
            
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
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-gray-400 mb-2">Dibuja tu firma en el recuadro.</p>
                        <SignaturePad signatureRef={adminSignatureRef} onSignatureEnd={() => {}} />
                    </div>
                    <div>
                        <label htmlFor="clarification" className="block text-sm font-medium text-gray-300">Aclaración de Firma (Nombre y Apellido)</label>
                        <input
                            id="clarification"
                            type="text"
                            value={currentClarification}
                            onChange={(e) => setCurrentClarification(e.target.value)}
                            placeholder="Ej: Juan Pérez"
                            className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-300">Cargo</label>
                        <input
                            id="jobTitle"
                            type="text"
                            value={currentJobTitle}
                            onChange={(e) => setCurrentJobTitle(e.target.value)}
                            placeholder="Ej: Gerente de RRHH"
                            className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-between items-center mt-6">
                <div>
                    <button
                        type="button"
                        onClick={() => adminSignatureRef.current?.clear()}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700 rounded-md hover:bg-slate-600"
                    >
                        Limpiar Dibujo
                    </button>
                    {adminSignature && (
                       <button
                          type="button"
                          onClick={handleClearAdminSignature}
                          className="ml-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-transparent rounded-md hover:bg-red-900/20"
                        >
                            Eliminar Firma Guardada
                        </button>
                    )}
                </div>
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
  const [userPortalTrainings, setUserPortalTrainings] = useState<Training[]>([]);
  
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shareKey = params.get('shareKey');
        let urlWasModified = false;

        if (shareKey) {
          const sharedTraining = await apiService.getSharedTraining(shareKey);
          if (sharedTraining) {
            localStorage.removeItem(`training-progress-${sharedTraining.id}`);
            setUserPortalTrainings([sharedTraining]);
            setView('user');
            urlWasModified = true;
          } else {
            alert("El enlace de la capacitación es inválido o ha expirado.");
          }
        } 
        
        const adminTrainings = await apiService.getTrainings();
        setTrainings(adminTrainings);

        if (urlWasModified) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
         console.error("Failed to load data from URL or remote store", error);
         alert("Ocurrió un error al cargar la capacitación.");
      }
    };

    loadInitialData();
    
    // Polling mechanism for cross-device sync
    const intervalId = setInterval(async () => {
        try {
            const latestTrainings = await apiService.getTrainings();
            setTrainings(currentTrainings => {
                // Prevent re-render if data is identical
                if (JSON.stringify(currentTrainings) !== JSON.stringify(latestTrainings)) {
                    return latestTrainings;
                }
                return currentTrainings;
            });
        } catch (error) {
            console.error("Error polling for trainings:", error);
        }
    }, 5000); // Poll every 5 seconds

    return () => {
        clearInterval(intervalId); // Cleanup on unmount
    };
  }, []);

  const addTraining = async (name: string, links: { name: string, url: string }[]) => {
    const newTraining: Training = {
      id: `training-${Date.now()}`,
      name,
      links: links.map((link, index) => ({
        id: `link-${Date.now()}-${index}`,
        name: link.name,
        url: link.url,
        viewed: false,
      })),
    };
    const updatedTrainings = [...trainings, newTraining];
    await apiService.updateTrainings(updatedTrainings);
    setTrainings(updatedTrainings);
  };

  const updateTraining = async (id: string, name: string, links: { name: string, url: string }[]) => {
    const updatedTrainings = trainings.map(t => {
      if (t.id === id) {
        return {
          ...t,
          name,
          links: links.map((link, index) => {
            const existingLink = t.links.find(l => l.url === link.url);
            return {
                id: existingLink?.id || `link-${id}-${index}`,
                name: link.name,
                url: link.url,
                viewed: existingLink?.viewed || false,
            };
          }),
        };
      }
      return t;
    });
    await apiService.updateTrainings(updatedTrainings);
    setTrainings(updatedTrainings);
  };

  const deleteTraining = async (id: string) => {
    const updatedTrainings = trainings.filter(t => t.id !== id);
    await apiService.updateTrainings(updatedTrainings);
    setTrainings(updatedTrainings);
  };

  const renderView = () => {
    switch (view) {
      case 'login':
        return <AdminLogin onLoginSuccess={() => setView('admin')} onBack={() => setView('selector')} />;
      case 'admin':
        return <AdminDashboard 
                    trainings={trainings}
                    addTraining={addTraining}
                    updateTraining={updateTraining}
                    deleteTraining={deleteTraining}
                    onLogout={() => setView('selector')}
                />;
      case 'user':
        return <UserPortal 
                    trainings={userPortalTrainings.length > 0 ? userPortalTrainings : trainings} 
                    setTrainingsStateForUser={userPortalTrainings.length > 0 ? setUserPortalTrainings : setTrainings} 
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