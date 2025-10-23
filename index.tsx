import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye, EyeOff, FileText, CheckCircle, ArrowLeft, Send, LogIn, RefreshCw, Award, ClipboardList, GraduationCap, Building, ArrowRight, QrCode } from 'lucide-react';

// --- CONFIGURACIÓN REQUERIDA ---
// 1. Ve a https://jsonbin.io, crea una cuenta gratuita.
// 2. Crea un nuevo "JSON Bin" vacío.
// 3. Pega el ID de tu Bin aquí (de la URL).
const JSONBIN_BIN_ID = '68fa221e43b1c97be97a84f2'; // Ejemplo: '667d7e3aad19ca34f881b2c3'

// 4. Ve a la sección "API Keys" en tu perfil.
// 5. Pega tu "Master Key" aquí.
const JSONBIN_MASTER_KEY = '$2a$10$CGBmrjbO1PM5CPstFtwXN.PMvfkyYUpEb9rGtO5rJZBLuEtAfWQ7i'; // Ejemplo: '$2a$10$...'

const normalizeString = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// --- TYPES ---
interface TrainingLink {
  id: string;
  name?: string;
  url: string;
}

interface Training {
  id:string;
  name: string;
  links: TrainingLink[];
  shareKey?: string; // Clave permanente para compartir
  companies?: string[]; // Empresas asociadas
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

interface AppData {
  submissions: UserSubmission[];
  adminConfig?: AdminConfig;
  trainings?: Training[];
  companies?: string[];
}

// --- CLOUD API SERVICE (JSONBIN.IO) ---
const apiService = {
  // Fetches the entire data blob from jsonbin.io.
  _getData: async (): Promise<AppData> => {
    if (JSONBIN_BIN_ID.startsWith('REEMPLAZA') || JSONBIN_MASTER_KEY.startsWith('REEMPLAZA')) {
      throw new Error("Configuración de API requerida. Por favor, edita index.tsx.");
    }
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_MASTER_KEY,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch data from jsonbin: ${response.statusText}`);
    }
    const jsonResponse = await response.json();
    const data = jsonResponse.record;
    // Ensure all keys exist to prevent runtime errors
    return {
        submissions: data.submissions || [],
        adminConfig: data.adminConfig || { signature: null, clarification: '', jobTitle: '' },
        trainings: data.trainings || [],
        companies: data.companies || [],
    };
  },

  // Writes the entire data blob to jsonbin.io.
  _putData: async (data: AppData): Promise<void> => {
    if (JSONBIN_BIN_ID.startsWith('REEMPLAZA') || JSONBIN_MASTER_KEY.startsWith('REEMPLAZA')) {
      throw new Error("Configuración de API requerida. Por favor, edita index.tsx.");
    }
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to save data to jsonbin: ${response.statusText}`);
    }
  },

  getSharedTraining: async (key: string): Promise<Training | null> => {
      const data = await apiService._getData();
      // Find training by its permanent shareKey in the main trainings list
      return data.trainings?.find(t => t.shareKey === key) || null;
  },

  getAdminConfig: async (): Promise<AdminConfig> => {
    const data = await apiService._getData();
    return data.adminConfig || { signature: null, clarification: '', jobTitle: '' };
  },
};


// --- SERVICES ---
const generateSubmissionsPdf = (submissions: UserSubmission[], adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string, trainingName?: string): void => {
  if (!submissions || submissions.length === 0) {
    alert('No hay registros para generar el PDF.');
    return;
  }
  
  try {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // --- Elegant Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('Certificado General de Asistencia', pageWidth / 2, 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500

    const trainingText = `Capacitación: ${trainingName || 'Varias / No especificada'}`;
    doc.text(trainingText, pageWidth / 2, 30, { align: 'center' });
    
    const instructorText = `Dictada por: ${adminSignatureClarification || '[Aclaración no configurada]'} (${adminJobTitle || '[Cargo no configurado]'})`;
    doc.text(instructorText, pageWidth / 2, 36, { align: 'center' });

    // --- Table ---
    const tableColumns = ['#', 'Apellido', 'Nombre', 'DNI', 'Fecha', 'Hora', 'Firma'];
    const tableRows = submissions.map((sub, index) => {
        const date = new Date(sub.timestamp);
        const formattedDate = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return [
          (index + 1).toString(),
          sub.lastName,
          sub.firstName,
          sub.dni,
          formattedDate,
          formattedTime,
          '', // Placeholder for signature
        ];
    });
    
    const startY = 50;
    
    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: startY,
      margin: { top: startY, bottom: 25 },
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle', textColor: [40, 40, 40] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' }, // #
        6: { cellWidth: 40, minCellHeight: 18 }, // Signature column
      },
      didDrawPage: (data) => {
          // FOOTER
          const footerY = pageHeight - 18;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(margin, footerY, pageWidth - margin, footerY);

          const pageNum = data.pageNumber;
          const pageStr = "Página " + pageNum;
          const dateStr = `Generado el: ${new Date().toLocaleString('es-ES')}`;
          
          doc.setFontSize(8);
          doc.setTextColor(150);
          
          doc.text(dateStr, margin, footerY + 5);
          const pageTextWidth = doc.getStringUnitWidth(pageStr) * doc.getFontSize() / doc.internal.scaleFactor;
          doc.text(pageStr, pageWidth - margin - pageTextWidth, footerY + 5);
      },
      didDrawCell: (data) => {
        if (data.column.index === 6 && data.cell.section === 'body') { // Column 6 is Firma
          const submission = submissions[data.row.index];
          if (submission && submission.signature) {
            try {
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

    const finalY = (doc as any).lastAutoTable.finalY;
    let signatureY = finalY + 15;

    // Add new page for signature if it doesn't fit
    if (signatureY + 60 > pageHeight) {
      doc.addPage();
      signatureY = 35;
    }
    
    if (adminSignature) {
        try {
            doc.addImage(adminSignature, 'PNG', margin, signatureY + 5, 60, 30);
            doc.setDrawColor(0);
            doc.line(margin, signatureY + 38, margin + 60, signatureY + 38);
            doc.text(adminSignatureClarification, margin, signatureY + 43);
            doc.setFontSize(9);
            doc.text(adminJobTitle, margin, signatureY + 48);
        } catch (imageError) {
            console.error("Error al añadir la firma del administrador al PDF:", imageError);
            doc.text("Error al cargar la firma.", margin, signatureY + 20);
        }
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 0, 0);
        doc.text('[Firma de administrador no configurada]', margin, signatureY + 20);
    }

    const pdfFileName = (trainingName 
      ? `asistencia_${trainingName.replace(/\s+/g, '_')}`
      : 'asistencia_general'
    ).toLowerCase() + '.pdf';
    
    doc.save(pdfFileName);

  } catch(e) {
    console.error("Fallo al generar el PDF de registros:", e);
    alert("Ocurrió un error al generar el PDF. Por favor, revisa la consola para más detalles.");
  }
};


const generateSingleSubmissionPdf = (submission: UserSubmission, adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string): void => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // --- Header ---
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Certificado de Capacitación', margin, 25);

    // --- Body ---
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    
    const bodyY = 60;
    doc.text(`Por medio de la presente, se certifica que`, margin, bodyY);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${submission.firstName} ${submission.lastName}`, margin, bodyY + 10);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`con DNI N° ${submission.dni}, de la empresa ${submission.company},`, margin, bodyY + 20);
    
    doc.text(`ha completado y aprobado la capacitación denominada:`, margin, bodyY + 30);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`"${submission.trainingName}"`, margin, bodyY + 45);

    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.text(`Realizada en la fecha ${new Date(submission.timestamp).toLocaleDateString('es-ES')}.`, margin, bodyY + 55);

    // --- Signatures ---
    const signatureBlockY = pageHeight - 80;
    const signatureWidth = 70;
    const signatureHeight = 35;
    const signatureLineY = signatureBlockY + signatureHeight + 5;

    // User Signature
    const userSignatureX = margin + 10;
    doc.addImage(submission.signature, 'PNG', userSignatureX, signatureBlockY, signatureWidth, signatureHeight);
    doc.setDrawColor(100, 100, 100);
    doc.line(userSignatureX, signatureLineY, userSignatureX + signatureWidth, signatureLineY);
    doc.setFontSize(10);
    doc.text('Firma del Asistente', userSignatureX + signatureWidth/2, signatureLineY + 5, { align: 'center' });
    
    // Admin Signature
    const adminSignatureX = pageWidth - signatureWidth - margin - 10;
    if (adminSignature) {
        doc.addImage(adminSignature, 'PNG', adminSignatureX, signatureBlockY, signatureWidth, signatureHeight);
        doc.line(adminSignatureX, signatureLineY, adminSignatureX + signatureWidth, signatureLineY);
        doc.text(adminSignatureClarification, adminSignatureX + signatureWidth/2, signatureLineY + 5, { align: 'center' });
        doc.setFontSize(9);
        doc.text(adminJobTitle, adminSignatureX + signatureWidth/2, signatureLineY + 10, { align: 'center' });
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 0, 0);
        doc.text('[Firma de administrador no configurada]', adminSignatureX + signatureWidth/2, signatureBlockY + signatureHeight/2, { align: 'center' });
    }
    
    const pdfFileName = `certificado_${submission.dni}_${submission.trainingName.replace(/\s+/g, '_')}.pdf`.toLowerCase();
    doc.save(pdfFileName);

  } catch (e) {
    console.error("Fallo al generar el PDF individual:", e);
    alert("Ocurrió un error al generar el certificado. Por favor, revisa la consola para más detalles.");
  }
};


// --- UI COMPONENTS ---

const Spinner: React.FC<{ size?: number }> = ({ size = 8 }) => (
  <div className={`w-${size} h-${size} border-4 border-slate-500 border-t-slate-200 rounded-full animate-spin`}></div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'xl' }> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        md: 'max-w-2xl',
        xl: 'max-w-6xl h-[90vh]'
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full flex flex-col relative animate-fade-in-up ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-100 truncate pr-4">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-grow">
                    {children}
                </div>
            </div>
        </div>
    );
};


const SignaturePad: React.FC<{ sigCanvasRef: React.RefObject<SignatureCanvas> }> = ({ sigCanvasRef }) => {
  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };
  
  const AnySignatureCanvas = SignatureCanvas as any;

  return (
    <div className="w-full">
      <div className="bg-white border-2 border-dashed border-slate-600 rounded-lg overflow-hidden">
        <AnySignatureCanvas
          ref={sigCanvasRef}
          penColor='black'
          canvasProps={{ className: 'w-full h-48' }}
        />
      </div>
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 text-sm font-semibold text-slate-200 bg-slate-600 rounded-md hover:bg-slate-500 transition-colors"
        >
          Limpiar Firma
        </button>
      </div>
    </div>
  );
};

const QRCodeDisplay: React.FC<{ shareKey: string | undefined }> = ({ shareKey }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (shareKey) {
            setError(false);
            setQrCodeUrl(null); // Reset for loading state
            const baseUrl = `${window.location.origin}${window.location.pathname}?trainingKey=${shareKey}`;
            QRCode.toDataURL(baseUrl, { width: 128, margin: 1, color: { dark: '#FFFFFF', light: '#1E293B' } })
                .then(url => setQrCodeUrl(url))
                .catch(err => {
                    console.error("QR generation failed:", err);
                    setError(true);
                });
        } else {
            setQrCodeUrl(null);
        }
    }, [shareKey]);

    if (!shareKey) {
        return (
            <div className="w-32 h-32 bg-slate-800 rounded-md flex items-center justify-center text-center text-xs text-slate-500 p-2">
                Comparta la capacitación para generar el QR.
            </div>
        );
    }

    if (error) {
        return <div className="w-32 h-32 bg-red-900/50 rounded-md flex items-center justify-center text-center text-xs text-red-300 p-2">Error al generar QR.</div>
    }

    if (!qrCodeUrl) {
        return <div className="w-32 h-32 bg-slate-800 rounded-md flex items-center justify-center"><Spinner size={6} /></div>;
    }

    return <img src={qrCodeUrl} alt="Código QR de la capacitación" className="w-32 h-32 rounded-md border-4 border-slate-600"/>
};

const UserTrainingPortal: React.FC<{ training: Training; onBack: () => void; prefilledCompany?: string }> = ({ training, onBack, prefilledCompany }) => {
    const [viewedLinks, setViewedLinks] = useState<Set<string>>(new Set());
    const [stage, setStage] = useState<'training' | 'form' | 'completed'>('training');
    const [lastSubmission, setLastSubmission] = useState<UserSubmission | null>(null);
    const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const sigCanvasRef = useRef<SignatureCanvas>(null);

    useEffect(() => {
      apiService.getAdminConfig().then(config => {
        setAdminConfig(config);
      }).finally(() => {
        setIsLoading(false);
      });
    }, []);

    const handleOpenLink = useCallback((link: TrainingLink) => {
        // Abre el enlace en una nueva pestaña
        window.open(link.url, '_blank', 'noopener,noreferrer');
        // Marca el enlace como visto inmediatamente para una retroalimentación instantánea y fiable
        setViewedLinks(prev => {
            if (prev.has(link.id)) return prev;
            const newSet = new Set(prev);
            newSet.add(link.id);
            return newSet;
        });
    }, []);

    const progress = training.links.length > 0 ? (viewedLinks.size / training.links.length) * 100 : 100;
    const allLinksViewed = progress >= 100;

    const autoFilledCompany = useMemo(() => {
        if (prefilledCompany) return prefilledCompany;
        if (training.companies && training.companies.length === 1) {
            return training.companies[0];
        }
        return '';
    }, [prefilledCompany, training.companies]);


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (sigCanvasRef.current?.isEmpty()) {
            alert('Por favor, provea su firma para completar el registro.');
            return;
        }

        const formData = new FormData(e.currentTarget);
        const submissionData: Omit<UserSubmission, 'id' | 'timestamp'> = {
            trainingId: training.id,
            trainingName: training.name,
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            dni: formData.get('dni') as string,
            company: formData.get('company') as string,
            signature: sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png') || '',
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
        };

        if (!submissionData.firstName || !submissionData.lastName || !submissionData.dni || !submissionData.company) {
            alert("Por favor, complete todos los campos obligatorios.");
            return;
        }

        const fullSubmission: UserSubmission = {
            ...submissionData,
            id: `sub-${Date.now()}`,
            timestamp: new Date().toISOString(),
        };

        try {
            setIsLoading(true);
            const currentData = await apiService._getData();
            const newData = { ...currentData, submissions: [...currentData.submissions, fullSubmission] };
            await apiService._putData(newData);
            setLastSubmission(fullSubmission);
            setStage('completed');
        } catch (error: any) {
            alert(`Error al enviar el registro: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isLoading) {
        return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4"><Spinner size={12} /></div>;
    }

    if (stage === 'completed' && lastSubmission) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center animate-fade-in-up">
                <CheckCircle size={64} className="text-green-400 mb-4" />
                <h1 className="text-3xl font-bold text-slate-100 mb-2">¡Registro Completado!</h1>
                <p className="text-slate-400 max-w-md mb-6">Gracias, {lastSubmission.firstName}. Tu asistencia a la capacitación "{lastSubmission.trainingName}" ha sido registrada con éxito.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => generateSingleSubmissionPdf(lastSubmission, adminConfig?.signature || null, adminConfig?.clarification || '', adminConfig?.jobTitle || '')}
                        disabled={!adminConfig?.signature}
                        title={!adminConfig?.signature ? "El administrador debe configurar su firma para habilitar la descarga." : "Descargar Certificado"}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 text-base font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        <FileDown size={20} />
                        Descargar Certificado
                    </button>
                    <button onClick={onBack} className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 text-base font-semibold text-slate-200 bg-slate-700 rounded-md hover:bg-slate-600 transition">
                        <ArrowLeft size={20} />
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-3xl">
                <header className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">{training.name}</h1>
                    <p className="text-slate-400 mt-2">Siga los pasos a continuación para completar la capacitación.</p>
                </header>

                {stage === 'training' && (
                    <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg animate-fade-in-up">
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-lg font-semibold text-slate-200">Progreso</h2>
                                <span className="text-lg font-bold text-blue-400">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {training.links.map((link, index) => (
                                <div key={link.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-md">
                                    <div className="flex items-center gap-3">
                                        {viewedLinks.has(link.id) ? <CheckCircle size={20} className="text-green-400 flex-shrink-0" /> : <FileText size={20} className="text-slate-400 flex-shrink-0" />}
                                        <span className="text-slate-200 truncate">{link.name || `Material de Estudio #${index + 1}`}</span>
                                    </div>
                                    <button
                                        onClick={() => handleOpenLink(link)}
                                        disabled={viewedLinks.has(link.id)}
                                        className="flex-shrink-0 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:bg-slate-600 disabled:text-slate-400"
                                    >
                                        {viewedLinks.has(link.id) ? 'Visto' : 'Abrir Material'}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setStage('form')}
                                disabled={!allLinksViewed}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 text-lg font-bold text-white bg-green-600 rounded-md hover:bg-green-500 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                                title={!allLinksViewed ? 'Debe ver todo el material para continuar' : ''}
                            >
                                Registrar Asistencia <ArrowRight size={22} />
                            </button>
                        </div>
                    </div>
                )}
                
                {stage === 'form' && (
                    <form onSubmit={handleSubmit} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg space-y-6 animate-fade-in-up">
                        <div>
                            <button onClick={() => setStage('training')} className="flex items-center gap-2 text-sm text-blue-400 hover:underline mb-4">
                                <ArrowLeft size={16} /> Volver al material
                            </button>
                            <h2 className="text-2xl font-bold text-slate-100">Formulario de Registro</h2>
                            <p className="text-slate-400">Complete sus datos para registrar su asistencia.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                                <input type="text" name="firstName" id="firstName" required className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                             <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1">Apellido</label>
                                <input type="text" name="lastName" id="lastName" required className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                             <div>
                                <label htmlFor="dni" className="block text-sm font-medium text-slate-300 mb-1">DNI</label>
                                <input type="text" name="dni" id="dni" required className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                            <div>
                                <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-1">Empresa</label>
                                <input type="text" name="company" id="company" defaultValue={autoFilledCompany} required className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                             <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email (Opcional)</label>
                                <input type="email" name="email" id="email" className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                             <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">Teléfono (Opcional)</label>
                                <input type="tel" name="phone" id="phone" className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Firma Digital</label>
                            <SignaturePad sigCanvasRef={sigCanvasRef} />
                        </div>
                        <div className="pt-4">
                            <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-bold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:bg-slate-600">
                                {isLoading ? <Spinner size={6} /> : <Send size={20} />}
                                Finalizar y Enviar Registro
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [data, setData] = useState<AppData>({
        submissions: [],
        trainings: [],
        companies: [],
        adminConfig: { signature: null, clarification: '', jobTitle: '' },
    });

    const [filter, setFilter] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [selectedTraining, setSelectedTraining] = useState<string>('');
    const [newCompanyName, setNewCompanyName] = useState('');
    const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());

    const [isConfigModalOpen, setConfigModalOpen] = useState(false);
    const [isTrainingModalOpen, setTrainingModalOpen] = useState(false);
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    
    const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
    const [selectedCompaniesForTraining, setSelectedCompaniesForTraining] = useState<string[]>([]);
    const [trainingToShare, setTrainingToShare] = useState<Training | null>(null);
    const [isGeneratingShareLink, setIsGeneratingShareLink] = useState<string | null>(null);
    const [isUpdatingSignature, setIsUpdatingSignature] = useState(false);

    const adminSigCanvasRef = useRef<SignatureCanvas>(null);
    const isFetching = useRef(false);

    const fetchData = async () => {
        if (isFetching.current) return;
        isFetching.current = true;
        setError(null);
        try {
            const fetchedData = await apiService._getData();
            setData(fetchedData);
        } catch (e: any) {
            setError(`Error al cargar los datos: ${e.message}`);
            console.error(e);
        } finally {
            isFetching.current = false;
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    const saveData = async (newData: AppData) => {
        if (isFetching.current) {
             alert("Otra operación ya está en progreso. Por favor, espere.");
             return;
        }
        isFetching.current = true;
        setIsSaving(true);
        setError(null);
        try {
            await apiService._putData(newData);
            setData(newData);
        } catch (e: any) {
            setError(`Error al guardar los datos: ${e.message}`);
            alert(`Error al guardar los datos: ${e.message}`);
        } finally {
            isFetching.current = false;
            setIsSaving(false);
        }
    };

    const handleUpdateConfig = () => {
        let signature = data.adminConfig?.signature;
        
        if (isUpdatingSignature) {
            if (adminSigCanvasRef.current?.isEmpty()) {
                alert("Por favor, dibuje una nueva firma o cancele la actualización.");
                return;
            }
            signature = adminSigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png') || null;
        }
        
        const newClarification = (document.getElementById('adminClarification') as HTMLInputElement).value;
        const newJobTitle = (document.getElementById('adminJobTitle') as HTMLInputElement).value;

        const newConfig: AdminConfig = {
            signature,
            clarification: newClarification,
            jobTitle: newJobTitle
        };

        const newData = { ...data, adminConfig: newConfig };
        saveData(newData).then(() => {
            alert("Configuración del administrador guardada.");
            setConfigModalOpen(false);
            setIsUpdatingSignature(false);
        });
    };
    
    const handleDeleteSignature = () => {
        if (window.confirm("¿Está seguro de que desea eliminar su firma guardada?")) {
            const newConfig = {
                ...(data.adminConfig as AdminConfig),
                signature: null,
            };
            const newData = { ...data, adminConfig: newConfig };
            saveData(newData).then(() => {
                alert("Firma eliminada.");
            });
        }
    }


    const filteredSubmissions = useMemo(() => {
        const subs = (data.submissions || []).filter(sub => {
            const searchMatch = filter === '' || 
                normalizeString(sub.firstName).includes(normalizeString(filter)) ||
                normalizeString(sub.lastName).includes(normalizeString(filter)) ||
                normalizeString(sub.dni).includes(normalizeString(filter));
            const companyMatch = selectedCompany === '' || sub.company === selectedCompany;
            const trainingMatch = selectedTraining === '' || sub.trainingId === selectedTraining;
            return searchMatch && companyMatch && trainingMatch;
        }).sort((a, b) => a.lastName.localeCompare(b.lastName));
        
        setSelectedSubmissions(new Set());

        return subs;
    }, [data.submissions, filter, selectedCompany, selectedTraining]);
    
    const handleToggleSelection = (id: string) => {
        setSelectedSubmissions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedSubmissions.size === filteredSubmissions.length) {
            setSelectedSubmissions(new Set());
        } else {
            setSelectedSubmissions(new Set(filteredSubmissions.map(s => s.id)));
        }
    };

    const submissionsForPdf = useMemo(() => {
        if (selectedSubmissions.size > 0) {
            return (data.submissions || []).filter(s => selectedSubmissions.has(s.id))
                .sort((a,b) => a.lastName.localeCompare(b.lastName));
        }
        return filteredSubmissions;
    }, [selectedSubmissions, filteredSubmissions, data.submissions]);


    const handleSaveTraining = () => {
        const name = (document.getElementById('trainingName') as HTMLInputElement).value;
        if (!name) {
            alert('El nombre de la capacitación es obligatorio.');
            return;
        }
    
        const linkElements = document.querySelectorAll('.training-link-group');
        const links: TrainingLink[] = Array.from(linkElements).map((el, index) => ({
            id: `link-${Date.now()}-${index}`,
            name: (el.querySelector('.training-link-name') as HTMLInputElement)?.value || '',
            url: (el.querySelector('.training-link-url') as HTMLInputElement).value,
        })).filter(link => link.url);
    
        if (links.length === 0) {
            alert('Debe agregar al menos un enlace a la capacitación.');
            return;
        }
        
        let updatedTrainings;
        if (currentTraining && currentTraining.id) {
            // Editing existing training
            updatedTrainings = data.trainings?.map(t => 
                t.id === currentTraining.id ? { ...currentTraining, name, links, companies: selectedCompaniesForTraining } : t
            ) || [];
        } else {
            // Creating new training
            const newTraining: Training = { 
                id: `train-${Date.now()}`, 
                name, 
                links, 
                companies: selectedCompaniesForTraining 
            };
            updatedTrainings = [...(data.trainings || []), newTraining];
        }
    
        const newData = { ...data, trainings: updatedTrainings };
        saveData(newData).then(() => {
            alert('Capacitación guardada exitosamente.');
            setTrainingModalOpen(false);
            setCurrentTraining(null);
        });
    };
    
    const openNewTrainingModal = () => {
        setCurrentTraining({ id: '', name: '', links: [{id: 'new-1', url: '', name: ''}], companies: [] });
        setSelectedCompaniesForTraining([]);
        setTrainingModalOpen(true);
    };
    
    const openEditTrainingModal = (training: Training) => {
        setCurrentTraining(JSON.parse(JSON.stringify(training)));
        setSelectedCompaniesForTraining(training.companies || []);
        setTrainingModalOpen(true);
    };

    const handleDeleteTraining = (trainingId: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar esta capacitación? Esta acción no se puede deshacer.")) {
            const updatedTrainings = data.trainings?.filter(t => t.id !== trainingId);
            const newData = { ...data, trainings: updatedTrainings };
            saveData(newData);
        }
    };
    
    const handleAddCompany = () => {
        if (!newCompanyName.trim()) {
            alert("El nombre de la empresa no puede estar vacío.");
            return;
        }
        const normalizedNew = normalizeString(newCompanyName);
        if ((data.companies || []).some(c => normalizeString(c) === normalizedNew)) {
            alert("Esta empresa ya existe.");
            setNewCompanyName('');
            return;
        }
        const updatedCompanies = [...(data.companies || []), newCompanyName.trim()].sort();
        const newData = { ...data, companies: updatedCompanies };
        saveData(newData).then(() => setNewCompanyName(''));
    };

    const handleDeleteCompany = (companyNameToDelete: string) => {
        if (window.confirm(`¿Seguro que quieres eliminar la empresa "${companyNameToDelete}"? Se eliminará de todas las listas.`)) {
            const updatedCompanies = (data.companies || []).filter(c => c !== companyNameToDelete);
            const newData = { ...data, companies: updatedCompanies };
            saveData(newData);
        }
    };

    const handleDeleteSubmission = (submissionId: string) => {
         if (window.confirm("¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.")) {
            const updatedSubmissions = data.submissions?.filter(s => s.id !== submissionId);
            const newData = { ...data, submissions: updatedSubmissions };
            saveData(newData);
        }
    };
    
    const handleDeleteAllSubmissions = () => {
        if (window.confirm(`¿Está SEGURO de que desea eliminar TODOS los ${data.submissions.length} registros? Esta acción es irreversible.`)) {
            if (window.confirm("CONFIRMACIÓN FINAL: Esta acción borrará permanentemente todos los registros de asistencia. ¿Desea continuar?")) {
                const newData = { ...data, submissions: [] };
                saveData(newData).then(() => {
                    alert("Todos los registros han sido eliminados.");
                });
            }
        }
    };
    
    const handleShareTraining = async (training: Training) => {
        let trainingToOpen = training;

        if (!training.shareKey) {
            setIsGeneratingShareLink(training.id);
            setError(null);
            try {
                const newShareKey = `st-${training.id}-${Date.now()}`;
                const updatedTraining = { ...training, shareKey: newShareKey };
                
                const newTrainings = (data.trainings || []).map(t =>
                    t.id === training.id ? updatedTraining : t
                );
                const newData = { ...data, trainings: newTrainings };

                await apiService._putData(newData);
                
                setData(newData); 
                trainingToOpen = updatedTraining;

            } catch (e: any) {
                setError(`Error al generar el enlace permanente: ${e.message}`);
                setIsGeneratingShareLink(null);
                return;
            } finally {
                setIsGeneratingShareLink(null);
            }
        }
        
        setTrainingToShare(trainingToOpen);
        setShareModalOpen(true);
    };
    
    const ShareModalContent: React.FC<{ training: Training | null }> = ({ training }) => {
        const [qrCodes, setQrCodes] = useState<{[key: string]: string}>({});
        const [isLoadingQRs, setIsLoadingQRs] = useState(true);
        
        useEffect(() => {
            const generateQRs = async () => {
                if(training && training.shareKey) {
                    setIsLoadingQRs(true);
                    try {
                        const generatedQRs: {[key: string]: string} = {};
                        const baseUrl = `${window.location.origin}${window.location.pathname}?trainingKey=${training.shareKey}`;

                        generatedQRs['general'] = await QRCode.toDataURL(baseUrl, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#1E293B' } });

                        for (const company of data.companies || []) {
                            const companyUrl = `${baseUrl}&company=${encodeURIComponent(company)}`;
                            generatedQRs[company] = await QRCode.toDataURL(companyUrl, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#1E293B' } });
                        }
                        setQrCodes(generatedQRs);

                    } catch(e) {
                        console.error("Failed to generate QR codes:", e);
                        alert("No se pudieron generar los códigos QR.");
                    } finally {
                        setIsLoadingQRs(false);
                    }
                }
            };
            generateQRs();
        }, [training]);

        if (isLoadingQRs) return <div className="flex justify-center p-8"><Spinner /></div>;
        if (!training || !training.shareKey) return <p className="text-red-400">Error: No se pudo encontrar la clave para compartir de esta capacitación.</p>;

        const baseUrl = `${window.location.origin}${window.location.pathname}?trainingKey=${training.shareKey}`;

        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-slate-400 text-center">Usa los siguientes enlaces o códigos QR para que los asistentes se registren. <strong className="text-slate-200">Estos enlaces son permanentes.</strong></p>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-slate-200 mb-2">Enlace General</h4>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            {qrCodes['general'] && <img src={qrCodes['general']} alt="QR Code General" className="border-4 border-slate-600 rounded-lg w-24 h-24"/>}
                            <div className="flex-grow w-full flex items-center bg-slate-700 p-2 rounded-md border border-slate-600">
                                <input type="text" value={baseUrl} readOnly className="flex-grow bg-transparent text-sm text-slate-300 outline-none w-full"/>
                                <button onClick={() => { navigator.clipboard.writeText(baseUrl); alert('Enlace copiado!'); }} className="p-2 text-slate-400 hover:bg-slate-600 rounded-md"><Copy size={16}/></button>
                            </div>
                        </div>
                    </div>
                    {(data.companies || []).length > 0 && (
                        <div className="border-t border-slate-700 pt-4">
                            <h4 className="font-bold text-slate-200 mb-2">Enlaces por Empresa</h4>
                            <div className="space-y-4">
                                {(data.companies || []).map(company => {
                                    const companyUrl = `${baseUrl}&company=${encodeURIComponent(company)}`;
                                    return (
                                        <div key={company}>
                                            <p className="text-sm font-semibold text-slate-300 mb-1">{company}</p>
                                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                                {qrCodes[company] && <img src={qrCodes[company]} alt={`QR Code ${company}`} className="border-4 border-slate-600 rounded-lg w-24 h-24"/>}
                                                <div className="flex-grow w-full flex items-center bg-slate-700 p-2 rounded-md border border-slate-600">
                                                    <input type="text" value={companyUrl} readOnly className="flex-grow bg-transparent text-sm text-slate-300 outline-none w-full"/>
                                                    <button onClick={() => { navigator.clipboard.writeText(companyUrl); alert(`Enlace para ${company} copiado!`); }} className="p-2 text-slate-400 hover:bg-slate-600 rounded-md"><Copy size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Spinner size={12} /></div>;
    }
    
    const configCheck = () => {
        if (JSONBIN_BIN_ID.startsWith('REEMPLAZA') || JSONBIN_MASTER_KEY.startsWith('REEMPLAZA')) {
             return (
                <div className="min-h-screen bg-red-900 bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-red-500 p-8 rounded-lg shadow-md max-w-2xl text-center">
                        <ShieldCheck size={48} className="mx-auto text-red-500 mb-4" />
                        <h1 className="text-2xl font-bold text-red-300 mb-2">Configuración Requerida</h1>
                        <p className="text-slate-400">
                            Para utilizar la aplicación, primero debe configurar las credenciales de la API de 
                            <a href="https://jsonbin.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold"> jsonbin.io</a>.
                            Siga las instrucciones en la parte superior del archivo <code>index.tsx</code> para obtener y establecer su <code>JSONBIN_BIN_ID</code> y <code>JSONBIN_MASTER_KEY</code>.
                        </p>
                    </div>
                </div>
             );
        }
        return null;
    }

    const configError = configCheck();
    if(configError) return configError;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-700">
                    <div className="flex items-center space-x-3">
                         <ShieldCheck className="w-8 h-8 text-slate-200" />
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Panel de Administrador</h1>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <button onClick={fetchData} disabled={isFetching.current} className="p-2 text-slate-400 hover:text-slate-100 disabled:opacity-50 transition-colors">
                            <RefreshCw size={20} className={isFetching.current ? 'animate-spin' : ''}/>
                        </button>
                        <button onClick={() => setConfigModalOpen(true)} className="flex items-center space-x-2 px-3 py-2 text-sm font-semibold text-slate-200 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition">
                           <User size={16}/><span>Firma</span>
                        </button>
                        <button onClick={onLogout} className="flex items-center space-x-2 px-3 py-2 text-sm font-semibold text-red-300 bg-red-900 bg-opacity-50 border border-red-800 rounded-md hover:bg-red-800 hover:text-red-200 transition">
                            <LogOut size={16}/><span>Salir</span>
                        </button>
                    </div>
                </header>
                 {error && <div className="mt-4 bg-red-900 bg-opacity-50 border border-red-500 text-red-300 px-4 py-3 rounded-md" role="alert">{error}</div>}

                <main className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-6">
                    <div className="xl:col-span-1 flex flex-col gap-8">
                        <section className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-slate-100 flex items-center"><Award size={22} className="mr-2 text-blue-400"/>Capacitaciones</h2>
                                <button onClick={openNewTrainingModal} className="flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition">
                                <PlusCircle size={16}/><span>Nueva</span>
                                </button>
                            </div>
                            <div className="space-y-4 flex-grow overflow-y-auto pr-2 -mr-2">
                                {(data.trainings || []).length > 0 ? (
                                    data.trainings?.map(training => (
                                        <div key={training.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700 group flex gap-4 items-start">
                                            <QRCodeDisplay shareKey={training.shareKey} />
                                            <div className="flex-grow flex flex-col h-full">
                                                <p className="font-bold text-lg text-slate-100 leading-tight">{training.name}</p>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {(training.companies && training.companies.length > 0) ? (
                                                        training.companies.map(c => <span key={c} className="text-xs font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{c}</span>)
                                                    ) : (
                                                        <span className="text-xs italic text-slate-500">Capacitación general</span>
                                                    )}
                                                </div>
                                                <div className="mt-auto flex items-center justify-end space-x-1 pt-2">
                                                    <button onClick={() => handleShareTraining(training)} disabled={isGeneratingShareLink === training.id} title="Compartir" className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-md disabled:opacity-50">
                                                        {isGeneratingShareLink === training.id ? <Spinner size={4}/> : <Share2 size={16}/>}
                                                    </button>
                                                    <button onClick={() => openEditTrainingModal(training)} title="Editar" className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-md"><Edit size={16}/></button>
                                                    <button onClick={() => handleDeleteTraining(training.id)} title="Eliminar" className="p-1.5 text-red-400 hover:bg-red-900/50 rounded-md"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500 text-center py-8">No hay capacitaciones creadas.</p>
                                )}
                            </div>
                        </section>
                         <section className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
                            <h2 className="text-xl font-bold text-slate-100 flex items-center mb-4"><Building size={22} className="mr-2 text-blue-400"/>Empresas</h2>
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="Nombre de la nueva empresa"
                                    className="flex-grow p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 placeholder-slate-400"
                                />
                                <button onClick={handleAddCompany} className="px-4 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition">Añadir</button>
                            </div>
                             <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                                {(data.companies || []).length > 0 ? (
                                    data.companies?.map(company => (
                                        <div key={company} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-700 group">
                                            <p className="text-sm text-slate-300">{company}</p>
                                            <button onClick={() => handleDeleteCompany(company)} title="Eliminar Empresa" className="p-1.5 text-red-400 hover:bg-red-900/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500 text-center py-8">No hay empresas añadidas.</p>
                                )}
                            </div>
                        </section>
                    </div>
                    
                    <section className="xl:col-span-2 bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                            <h2 className="text-xl font-bold text-slate-100 flex items-center"><Users size={22} className="mr-2 text-blue-400"/>Registros de Asistentes</h2>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={handleDeleteAllSubmissions} 
                                    disabled={filteredSubmissions.length === 0}
                                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-red-300 bg-red-900/50 border border-red-800 rounded-md hover:bg-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={16}/><span>Borrar Todos</span>
                                </button>
                                <button 
                                    onClick={() => generateSubmissionsPdf(submissionsForPdf, data.adminConfig?.signature || null, data.adminConfig?.clarification || '', data.adminConfig?.jobTitle || '', selectedTraining ? data.trainings?.find(t=>t.id===selectedTraining)?.name : undefined)} 
                                    disabled={submissionsForPdf.length === 0}
                                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    <FileDown size={16}/><span>Descargar PDF ({submissionsForPdf.length})</span>
                                </button>
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <input
                                type="text"
                                placeholder="Buscar por nombre, apellido o DNI..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 placeholder-slate-400"
                            />
                            <select value={selectedTraining} onChange={e => setSelectedTraining(e.target.value)} className="p-2 border bg-slate-700 border-slate-600 rounded-md text-sm text-slate-200">
                                <option value="">Todas las Capacitaciones</option>
                                {data.trainings?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="p-2 border bg-slate-700 border-slate-600 rounded-md text-sm text-slate-200">
                                <option value="">Todas las Empresas</option>
                                {data.companies?.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left text-slate-300">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                                    <tr>
                                        <th scope="col" className="p-3 w-10 text-center">
                                            <input type="checkbox"
                                                className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                                                checked={filteredSubmissions.length > 0 && selectedSubmissions.size === filteredSubmissions.length}
                                                onChange={handleToggleSelectAll}
                                                disabled={filteredSubmissions.length === 0}
                                            />
                                        </th>
                                        <th scope="col" className="p-3 w-10">#</th>
                                        <th scope="col" className="p-3">Apellido y Nombre</th>
                                        <th scope="col" className="p-3">DNI</th>
                                        <th scope="col" className="p-3 hidden md:table-cell">Empresa</th>
                                        <th scope="col" className="p-3 hidden lg:table-cell">Capacitación</th>
                                        <th scope="col" className="p-3 hidden xl:table-cell">Fecha</th>
                                        <th scope="col" className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.length > 0 ? filteredSubmissions.map((sub, index) => (
                                        <tr key={sub.id} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50">
                                            <td className="p-3 text-center">
                                                <input type="checkbox"
                                                    className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                                                    checked={selectedSubmissions.has(sub.id)}
                                                    onChange={() => handleToggleSelection(sub.id)}
                                                />
                                            </td>
                                            <td className="p-3 font-medium text-slate-400">{index + 1}</td>
                                            <td className="p-3 font-semibold text-slate-100">{sub.lastName}, {sub.firstName}</td>
                                            <td className="p-3">{sub.dni}</td>
                                            <td className="p-3 hidden md:table-cell">{sub.company}</td>
                                            <td className="p-3 hidden lg:table-cell">{sub.trainingName}</td>
                                            <td className="p-3 hidden xl:table-cell">{new Date(sub.timestamp).toLocaleDateString()}</td>
                                            <td className="p-3 text-right">
                                                 <button onClick={() => handleDeleteSubmission(sub.id)} title="Eliminar Registro" className="p-1.5 text-red-400 hover:bg-red-900/50 rounded-md"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={8} className="text-center p-8 text-slate-500">No se encontraron registros.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </div>
            
             <Modal isOpen={isConfigModalOpen} onClose={() => { setConfigModalOpen(false); setIsUpdatingSignature(false); }} title="Configuración de Administrador">
                <div className="space-y-4">
                     <div>
                        <label htmlFor="adminClarification" className="block text-sm font-medium text-slate-300 mb-1">Aclaración de Firma (Nombre Completo)</label>
                        <input type="text" id="adminClarification" defaultValue={data.adminConfig?.clarification} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                    </div>
                    <div>
                        <label htmlFor="adminJobTitle" className="block text-sm font-medium text-slate-300 mb-1">Cargo</label>
                        <input type="text" id="adminJobTitle" defaultValue={data.adminConfig?.jobTitle} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Firma Digital</label>
                        {!isUpdatingSignature ? (
                            <div className="p-4 bg-slate-900 rounded-md border border-slate-700">
                                {data.adminConfig?.signature ? (
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 mb-2">Firma actual:</p>
                                        <img src={data.adminConfig.signature} alt="Firma guardada" className="h-24 bg-white p-1 rounded mx-auto border border-slate-300" />
                                        <div className="flex justify-center gap-2 mt-4">
                                            <button onClick={() => setIsUpdatingSignature(true)} className="px-4 py-2 text-sm font-semibold text-slate-200 bg-slate-600 rounded-md hover:bg-slate-500 transition">
                                                Actualizar Firma
                                            </button>
                                            <button onClick={handleDeleteSignature} className="px-4 py-2 text-sm font-semibold text-red-300 bg-red-900/50 rounded-md hover:bg-red-800/70 transition">
                                                Eliminar Firma
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-slate-500 mb-3">No hay firma guardada.</p>
                                        <button onClick={() => setIsUpdatingSignature(true)} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition">
                                            Añadir Firma
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <SignaturePad sigCanvasRef={adminSigCanvasRef} />
                                <button onClick={() => setIsUpdatingSignature(false)} className="mt-2 text-sm text-blue-400 hover:underline">
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        <button onClick={handleUpdateConfig} className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition">
                            Guardar Configuración
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isTrainingModalOpen} onClose={() => setTrainingModalOpen(false)} title={currentTraining?.id ? 'Editar Capacitación' : 'Nueva Capacitación'}>
                {currentTraining && (
                    <div className="space-y-6">
                        {/* Section 1: Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-3">1. Detalles de la Capacitación</h3>
                            <label htmlFor="trainingName" className="block text-sm font-medium text-slate-300 mb-1">Nombre de la Capacitación</label>
                            <input
                                type="text"
                                id="trainingName"
                                defaultValue={currentTraining.name}
                                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200"
                                required
                            />
                        </div>

                        {/* Section 2: Links */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-3">2. Material de Estudio (Enlaces)</h3>
                            <div id="trainingLinksContainer" className="space-y-3">
                                {currentTraining.links.map((link, index) => (
                                    <div key={link.id} className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg space-y-2 training-link-group">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-slate-400">Enlace #{index + 1}</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newLinks = currentTraining.links.filter(l => l.id !== link.id);
                                                    setCurrentTraining({ ...currentTraining, links: newLinks });
                                                }}
                                                className="p-1 text-red-400 hover:bg-red-900/50 rounded-md"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Nombre del material (ej: Video de seguridad)"
                                            defaultValue={link.name}
                                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 training-link-name"
                                        />
                                        <input
                                            type="url"
                                            placeholder="https://ejemplo.com/recurso"
                                            defaultValue={link.url}
                                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 training-link-url"
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const newLinks = [...currentTraining.links, { id: `new-${Date.now()}`, url: '', name: '' }];
                                    setCurrentTraining({ ...currentTraining, links: newLinks });
                                }}
                                className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"
                            >
                                <PlusCircle size={16} /> Añadir otro enlace
                            </button>
                        </div>
                        
                        {/* Section 3: Companies */}
                        {(data.companies || []).length > 0 && 
                            <div>
                                <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-3">3. Asignar a Empresas</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {(data.companies || []).map(company => (
                                        <label key={company} className="flex items-center space-x-2 p-2 bg-slate-700 rounded-md cursor-pointer hover:bg-slate-600">
                                            <input 
                                                type="checkbox"
                                                value={company}
                                                checked={selectedCompaniesForTraining.includes(company)}
                                                onChange={(e) => {
                                                    if(e.target.checked) {
                                                        setSelectedCompaniesForTraining(prev => [...prev, company]);
                                                    } else {
                                                        setSelectedCompaniesForTraining(prev => prev.filter(c => c !== company));
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-200">{company}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        }

                        <div className="flex justify-end pt-4">
                            <button onClick={handleSaveTraining} className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition">
                                Guardar Capacitación
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
            
            <Modal isOpen={isShareModalOpen} onClose={() => setShareModalOpen(false)} title={`Compartir Capacitación: "${trainingToShare?.name}"`}>
                <ShareModalContent training={trainingToShare} />
            </Modal>

            {isSaving && (
                <div className="fixed bottom-4 right-4 bg-slate-700 text-slate-200 px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg">
                    <Spinner size={5}/><span>Guardando...</span>
                </div>
            )}
        </div>
    );
};

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'admin2025') {
            onLogin();
        } else {
            setError('Contraseña incorrecta.');
            setPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm mx-auto">
                <form onSubmit={handleSubmit} className="bg-slate-800 shadow-2xl rounded-xl px-8 pt-6 pb-8 mb-4 border border-slate-700 animate-fade-in-up">
                     <div className="text-center mb-6">
                        <ShieldCheck className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                        <h1 className="text-2xl font-bold text-slate-100">Acceso de Administrador</h1>
                    </div>
                    <div className="mb-4">
                        <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                className={`w-full p-3 bg-slate-700 border ${error ? 'border-red-500' : 'border-slate-600'} rounded-md text-slate-100 pr-10`}
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="******************"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                         {error && <p className="text-red-500 text-xs italic mt-2">{error}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                        <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:shadow-outline transition" type="submit">
                            <LogIn size={18}/> Ingresar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const WelcomeScreen: React.FC<{ onAdminClick: () => void }> = ({ onAdminClick }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-2xl w-full">
            <GraduationCap size={64} className="mx-auto text-blue-400 mb-6" />
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-100 mb-4 animate-fade-in-down">
                Portal de Capacitaciones
            </h1>
            <p className="text-lg text-slate-400 mb-10 animate-fade-in-up">
                Bienvenido. Seleccione su rol para continuar.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-left">
                    <div className="flex items-center gap-4 mb-3">
                        <Users size={28} className="text-slate-300" />
                        <h2 className="text-2xl font-bold text-slate-100">Asistente</h2>
                    </div>
                    <p className="text-slate-400">
                        Si recibió un enlace o un código QR para una capacitación, ábralo para comenzar su registro.
                    </p>
                </div>
                
                <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-left flex flex-col justify-center">
                     <div className="flex items-center gap-4 mb-3">
                        <ShieldCheck size={28} className="text-slate-300" />
                        <h2 className="text-2xl font-bold text-slate-100">Administrador</h2>
                    </div>
                    <p className="text-slate-400 mb-5">
                       Gestione capacitaciones, empresas y registros de asistentes.
                    </p>
                    <button 
                        onClick={onAdminClick} 
                        className="w-full mt-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition"
                    >
                        Acceder al Panel <ArrowRight size={18}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};


const App: React.FC = () => {
    const [view, setView] = useState<'home' | 'adminLogin' | 'adminDashboard' | 'user' | 'loading'>('loading');
    const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
    const [prefilledCompany, setPrefilledCompany] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const adminParam = params.get('admin');
        const trainingKey = params.get('trainingKey');
        const companyParam = params.get('company');

        if (adminParam === 'true') {
            setView('adminLogin');
            return;
        }

        if (trainingKey) {
            setView('loading');
            setError(null);
            apiService.getSharedTraining(trainingKey).then(training => {
                if (training) {
                    setCurrentTraining(training);
                    setPrefilledCompany(companyParam || undefined);
                    setView('user');
                } else {
                    setError("La capacitación solicitada no fue encontrada o el enlace es inválido.");
                    setView('home');
                }
            }).catch(e => {
                console.error("Error fetching training:", e);
                setError("Ocurrió un error al cargar la capacitación. Por favor, intente de nuevo.");
                setView('home');
            });
        } else {
            setView('home');
        }
    }, []);
    
    const handleAdminLogin = () => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('admin')) {
             window.location.href = `${window.location.pathname}?admin=true`;
        } else {
            setView('adminDashboard');
        }
    };
    
    const handleLogout = () => {
        window.location.href = window.location.pathname;
    };
    
    if(error) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                 <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
                 <p className="text-slate-300 mb-6">{error}</p>
                 <button onClick={() => window.location.href = window.location.pathname} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Volver al Inicio</button>
            </div>
        )
    }

    switch (view) {
        case 'loading':
            return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Spinner size={12} /></div>;
        case 'home':
            return <WelcomeScreen onAdminClick={() => setView('adminLogin')} />;
        case 'adminLogin':
            return <AdminLogin onLogin={handleAdminLogin} />;
        case 'adminDashboard':
            return <AdminDashboard onLogout={handleLogout} />;
        case 'user':
             if (currentTraining) {
                 return <UserTrainingPortal training={currentTraining} onBack={handleLogout} prefilledCompany={prefilledCompany} />;
             }
             return <WelcomeScreen onAdminClick={() => setView('adminLogin')} />; // Fallback
        default:
            return <WelcomeScreen onAdminClick={() => setView('adminLogin')} />;
    }
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);