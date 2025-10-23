// FIX: Removed invalid file markers from the beginning and end of the file.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye, EyeOff, FileText, CheckCircle, ArrowLeft, Send, LogIn, RefreshCw, Award, ClipboardList, GraduationCap, Building, ArrowRight, QrCode } from 'lucide-react';

const normalizeString = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

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
  companies?: string[];
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
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/1262973950664982528';

interface AppData {
  submissions: UserSubmission[];
  adminConfig?: AdminConfig;
  sharedTrainings?: { [key: string]: Training };
  trainings?: Training[];
  companies?: string[];
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
        return { submissions: [], adminConfig: { signature: null, clarification: '', jobTitle: '' }, sharedTrainings: {}, trainings: [], companies: [] };
      }
      const text = await response.text();
      // Handle empty blob case
      const data = text ? JSON.parse(text) : {};
      return {
        submissions: data.submissions || [],
        adminConfig: data.adminConfig || { signature: null, clarification: '', jobTitle: '' },
        sharedTrainings: data.sharedTrainings || {},
        trainings: data.trainings || [],
        companies: data.companies || [],
      };
    } catch (error) {
      console.error("Failed to fetch data from remote store:", error);
      throw error; // Re-throw the error so callers can handle it
    }
  },

  // Centralized helper for writing data. Throws an error on failure.
  _putData: async (data: AppData): Promise<void> => {
    const response = await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }
  },

  shareTraining: async (training: Training): Promise<string> => {
      const key = `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const data = await apiService._getData();
      const sharedTrainings = data.sharedTrainings || {};
      sharedTrainings[key] = training;
      const updatedData = { ...data, sharedTrainings };
      await apiService._putData(updatedData);
      return key;
  },

  getSharedTraining: async (key: string): Promise<Training | null> => {
      const data = await apiService._getData();
      return data.sharedTrainings?.[key] || null;
  }
};


// --- SERVICES ---
const generateSubmissionsPdf = (submissions: UserSubmission[], adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string, trainingName?: string, companyName?: string): void => {
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const headerHeight = 28;
    
    const tableColumns = ['#', 'Apellido', 'Nombre', 'DNI', 'Fecha', 'Firma'];
    const tableRows = submissions.map((sub, index) => [
      (index + 1).toString(),
      sub.lastName,
      sub.firstName,
      sub.dni,
      sub.timestamp,
      '', // Placeholder for the signature image
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: headerHeight + 5,
      margin: { top: headerHeight + 5, bottom: 25 },
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle', textColor: [40, 40, 40] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        5: { cellWidth: 35, minCellHeight: 18 }, // Signature column
      },
      didDrawPage: (data) => {
          // HEADER
          doc.setFillColor(30, 41, 59); // slate-800
          doc.rect(0, 0, pageWidth, headerHeight, 'F');
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.setTextColor(255, 255, 255);
          doc.text('Registro de Asistencia', 14, 15);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          
          let subTitleParts: string[] = [];
          if (trainingName) subTitleParts.push(`Capacitación: ${trainingName}`);
          if (companyName) subTitleParts.push(`Empresa: ${companyName}`);
          let subTitle = subTitleParts.join('  |  ');
          if (!subTitle) subTitle = 'Registros Generales';

          doc.text(subTitle, 14, 22);

          // FOOTER
          const footerY = pageHeight - 18;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(14, footerY, pageWidth - 14, footerY);

          // FIX: The page number is available on the `data` object provided by the autoTable hook.
          const pageNum = data.pageNumber;
          const pageStr = "Página " + pageNum;
          const dateStr = `Generado el: ${new Date().toLocaleDateString('es-ES')}`;
          
          doc.setFontSize(8);
          doc.setTextColor(150);
          
          doc.text(dateStr, 14, footerY + 5);
          const pageTextWidth = doc.getStringUnitWidth(pageStr) * doc.getFontSize() / doc.internal.scaleFactor;
          doc.text(pageStr, pageWidth - 14 - pageTextWidth, footerY + 5);
      },
      didDrawCell: (data) => {
        if (data.column.index === 5 && data.cell.section === 'body') {
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
      signatureY = 35; // Position below header margin
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

    const pdfFileName = (trainingName 
      ? `asistencia_${trainingName.replace(/\s+/g, '_')}`
      : 'asistencia_general'
    ).toLowerCase() + '.pdf';
    
    doc.save(pdfFileName);

  } catch(e) {
    console.error("Fallo al generar el PDF general de registros:", e);
    alert("Ocurrió un error al generar el PDF. Por favor, revisa la consola para más detalles.");
  }
};

const generateSingleSubmissionPdf = (submission: UserSubmission, adminSignature: string | null, adminSignatureClarification: string, adminJobTitle: string): void => {
  if (!adminSignature) {
    alert("Error: La firma del administrador no está configurada.");
    return;
  }
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // --- BORDER ---
    doc.setDrawColor(107, 114, 128); // gray-500
    doc.setLineWidth(1);
    doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin);
    doc.setLineWidth(0.2);
    doc.rect(margin / 2 + 2, margin / 2 + 2, pageWidth - margin - 4, pageHeight - margin - 4);
    
    // --- HEADER ---
    doc.setFont('times', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(41, 128, 185); // A professional blue
    doc.text('Certificado de Finalización', pageWidth / 2, 40, { align: 'center' });

    // --- SUB-HEADER ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Por la presente se certifica que:', pageWidth / 2, 60, { align: 'center' });

    // --- RECIPIENT NAME ---
    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0);
    doc.text(`${submission.firstName} ${submission.lastName}`, pageWidth / 2, 85, { align: 'center' });
    
    // --- RECIPIENT DETAILS ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Con DNI ${submission.dni}, de la empresa ${submission.company},`, pageWidth / 2, 95, { align: 'center' });

    // --- COMPLETION STATEMENT ---
    doc.text('ha completado satisfactoriamente la capacitación de:', pageWidth / 2, 120, { align: 'center' });

    // --- TRAINING NAME ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text(`"${submission.trainingName}"`, pageWidth / 2, 135, { align: 'center' });

    // --- COMPLETION DATE ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Completada el: ${submission.timestamp}`, pageWidth / 2, 150, { align: 'center' });

    // --- SIGNATURE AREA ---
    const signatureAreaY = 190;
    const signatureX = (pageWidth / 2) - 40;
    
    // SIGNATURE
    try {
      doc.addImage(adminSignature, 'PNG', signatureX, signatureAreaY, 80, 40);
    } catch (e) { 
        console.error("Could not add admin signature image to PDF", e); 
        doc.text("[Firma no disponible]", signatureX + 40, signatureAreaY + 20, { align: 'center' });
    }
    
    doc.setDrawColor(0); // Black line
    doc.setLineWidth(0.2);
    doc.line(signatureX, signatureAreaY + 43, signatureX + 80, signatureAreaY + 43);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(adminSignatureClarification, signatureX + 40, signatureAreaY + 50, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(adminJobTitle, signatureX + 40, signatureAreaY + 56, { align: 'center' });
    
    const pdfFileName = `constancia_${submission.trainingName.replace(/\s+/g, '_')}_${submission.dni}.pdf`.toLowerCase();
    doc.save(pdfFileName);

  } catch (e) {
    console.error("Error al generar o mostrar el PDF:", e);
    alert("Ocurrió un error al generar la constancia. Por favor, inténtalo de nuevo o contacta al administrador.");
  }
};

// A custom hook to debounce a function call.
const useDebounce = (callback: () => void, delay: number) => {
    const timeoutRef = useRef<number | null>(null);
    useEffect(() => {
        // Cleanup timeout on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const debouncedCallback = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
            callback();
        }, delay);
    };

    return debouncedCallback;
};

// --- COMPONENTS ---

// SignaturePad.tsx
interface SignaturePadProps {
  onSignatureEnd: (signature: string) => void;
  signatureRef: React.RefObject<SignatureCanvas>;
  initialData?: string | null;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureEnd, signatureRef, initialData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const AnySignatureCanvas = SignatureCanvas as any;
  
  const resizeCanvas = () => {
    if (containerRef.current && signatureRef.current) {
        const canvas: HTMLCanvasElement = (signatureRef.current as any).getCanvas();
        // Use device pixel ratio for sharp rendering on high-DPI screens
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;

        // Set the canvas buffer size to match the display size multiplied by the pixel ratio
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        
        // Scale the drawing context to match the device pixel ratio.
        // This is the crucial step to correct the cursor offset on high-DPI screens.
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.scale(ratio, ratio);
        }
        
        // When resizing, we restore the initial data if provided.
        // Any drawing in progress will be lost, which is an acceptable trade-off for responsive correctness.
        if (initialData) {
          try {
            signatureRef.current.fromDataURL(initialData);
          } catch(e) {
            console.error("Failed to load initial signature data.", e);
            signatureRef.current.clear();
          }
        } else {
            signatureRef.current.clear();
        }
    }
  };
  
  // Use a debounced resize handler for performance, preventing rapid-fire resizes.
  const debouncedResize = useDebounce(resizeCanvas, 250);

  // useLayoutEffect runs synchronously after DOM mutations, which is ideal for measurements.
  React.useLayoutEffect(() => {
    // A small delay is added before the initial resize. This is a pragmatic fix to ensure
    // that containers with CSS transitions (like modals) have stabilized their dimensions
    // before the canvas is sized, preventing cursor offset issues on HiDPI screens.
    const timerId = setTimeout(resizeCanvas, 50);

    window.addEventListener('resize', debouncedResize);
    
    return () => {
        clearTimeout(timerId);
        window.removeEventListener('resize', debouncedResize);
    };
  }, [initialData]); // Re-run if initialData changes (e.g. admin signature loads after fetch)

  return (
    // The `touch-none` class is critical for a good mobile experience, preventing the page from scrolling while drawing.
    <div ref={containerRef} className="border border-slate-700 rounded-lg bg-white w-full h-40 touch-none">
      <AnySignatureCanvas
        ref={signatureRef}
        penColor='black'
        canvasProps={{
            // The canvas is styled via CSS to fill the container, while its internal drawing buffer size is managed by our resize logic.
            style: { width: '100%', height: '100%' },
            className: 'rounded-lg' 
        }}
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
const UserPortal: React.FC<{
    userTrainings: Training[];
    adminConfig: AdminConfig | null;
    onSubmit: (submission: UserSubmission) => Promise<void>;
}> = ({ userTrainings, adminConfig, onSubmit }) => {
    const [training, setTraining] = useState<Training | null>(userTrainings[0] || null);
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

    const [viewingLinkIndex, setViewingLinkIndex] = useState<number | null>(null);

    const isKnownIncompatibleLink = (url: string): boolean => {
        try {
            const domain = new URL(url).hostname.toLowerCase();
            if (domain.endsWith('google.com')) return true;
            if (['forms.gle', 'youtu.be', 'youtube.com'].includes(domain)) return true;
            return false;
        } catch (e) {
            console.warn("Could not parse URL to check compatibility, opening externally:", url);
            return true;
        }
    };

    useEffect(() => {
        if (training) {
            const authorizedCompanies = training.companies || [];
            if (authorizedCompanies.length === 1) {
                setFormData(prev => ({ ...prev, company: authorizedCompanies[0] }));
            } else {
                setFormData(prev => ({ ...prev, company: '' }));
            }
        }
    }, [training]);

    useEffect(() => {
        if (training) {
            const progress = localStorage.getItem(`training-progress-${training.id}`);
            if (progress) {
                try {
                    const viewedLinkIds: string[] = JSON.parse(progress);
                    const updatedLinks = training.links.map(l =>
                        viewedLinkIds.includes(l.id) ? { ...l, viewed: true } : l
                    );
                    setTraining(prev => prev ? { ...prev, links: updatedLinks } : null);
                } catch (e) {
                    console.error("Failed to parse training progress from localStorage", e);
                }
            }
        }
    }, [training?.id]);


    const allLinksViewed = useMemo(() => {
        if (!training) return false;
        return training.links.every(link => link.viewed);
    }, [training]);

    const handleLinkClick = (linkId: string) => {
        if (!training) return;

        const updatedLinks = training.links.map(l => l.id === linkId ? { ...l, viewed: true } : l);
        const viewedLinkIds = updatedLinks.filter(l => l.viewed).map(l => l.id);
        localStorage.setItem(`training-progress-${training.id}`, JSON.stringify(viewedLinkIds));
        setTraining({ ...training, links: updatedLinks });
    };

    const handleOpenLink = (index: number) => {
        if (!training) return;
        const linkToOpen = training.links[index];
        handleLinkClick(linkToOpen.id);
        if (isKnownIncompatibleLink(linkToOpen.url)) {
            window.open(linkToOpen.url, '_blank', 'noopener,noreferrer');
        } else {
            setViewingLinkIndex(index);
        }
    };

    const handleCloseViewer = () => setViewingLinkIndex(null);

    const navigateLink = (direction: 'next' | 'prev') => {
        if (viewingLinkIndex === null || !training) return;
        const newIndex = direction === 'next' ? viewingLinkIndex + 1 : viewingLinkIndex - 1;
        if (newIndex >= 0 && newIndex < training.links.length) {
            const linkToOpen = training.links[newIndex];
            handleLinkClick(linkToOpen.id);
            if (isKnownIncompatibleLink(linkToOpen.url)) {
                window.open(linkToOpen.url, '_blank', 'noopener,noreferrer');
                handleCloseViewer();
            } else {
                setViewingLinkIndex(newIndex);
            }
        }
    };
    
    const handleNextLink = () => navigateLink('next');
    const handlePrevLink = () => navigateLink('prev');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        if (!training || !formData.signature || !formData.company) {
            alert("Por favor, proporciona toda la información requerida, incluyendo tu empresa y firma.");
            return;
        }

        setIsSubmitting(true);
        const now = new Date();
        const formattedTimestamp = now.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        }) + ' ' + now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

        const newSubmission: UserSubmission = {
            id: `sub-${training.id}-${formData.dni}-${Date.now()}`,
            timestamp: formattedTimestamp,
            trainingId: training.id,
            trainingName: training.name,
            ...formData
        };

        try {
            await onSubmit(newSubmission);
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
        const downloadDisabled = !adminConfig?.signature || !adminConfig?.clarification || !adminConfig?.jobTitle;
        const downloadTitle = downloadDisabled
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
                                    if (adminConfig?.signature) {
                                        generateSingleSubmissionPdf(lastSubmission, adminConfig.signature, adminConfig.clarification, adminConfig.jobTitle);
                                    }
                                }}
                                disabled={downloadDisabled}
                                title={downloadTitle}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-500 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileDown className="h-4 w-4 mr-2" />
                                Descargar Mi Constancia
                            </button>
                        </div>
                    </div>
                     <div className="text-center mt-6">
                        <button onClick={() => window.location.reload()} className="text-indigo-400 hover:text-indigo-300">Realizar otra capacitación</button>
                    </div>
                </div>
            </div>
        );
    }

    const viewingLink = viewingLinkIndex !== null && training ? training.links[viewingLinkIndex] : null;

    if (!training) {
        return <div className="text-center p-8 bg-slate-800 rounded-lg"><h2 className="text-xl text-white">Error</h2><p className="text-gray-400">No se pudo cargar la capacitación. Por favor, intente escanear el código QR de nuevo.</p></div>;
    }

    const progress = (training.links.filter(l => l.viewed).length / (training.links.length || 1)) * 100;
    const authorizedCompanies = training.companies || [];
    const isCompanyDetermined = authorizedCompanies.length === 1;

    return (
        <div className="w-full max-w-4xl mx-auto bg-slate-800 p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-2">{training.name}</h2>
            <p className="text-gray-400 mb-4">Revisa los siguientes enlaces para completar la capacitación. Una vez revisados todos, podrás registrar tu asistencia.</p>

            <div className="mb-4">
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-sm text-right text-gray-400 mt-1">{Math.round(progress)}% completado</p>
            </div>

            <div className="space-y-3 mb-8">
                {training.links.map((link, index) => (
                    <button key={link.id} onClick={() => handleOpenLink(index)} title={link.url} className={`flex items-center justify-between p-4 rounded-lg border transition-all w-full text-left ${link.viewed ? 'bg-green-900/30 border-green-500/50' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-700'}`}>
                        <div className="flex items-center min-w-0">
                            <FileText className="h-5 w-5 mr-3 text-indigo-400 flex-shrink-0"/>
                            <div className="min-w-0">
                                <span className="font-medium text-white">{link.name?.trim() ? link.name : `Material de Estudio ${index + 1}`}</span>
                                <p className="text-sm text-gray-400 truncate">{link.url}</p>
                            </div>
                        </div>
                        {link.viewed && <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 ml-4" />}
                    </button>
                ))}
            </div>

            {allLinksViewed && (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                    <h3 className="text-xl font-semibold text-white border-t border-slate-700 pt-6">Completa tus datos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input type="text" name="firstName" value={formData.firstName} placeholder="Nombre" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="lastName" value={formData.lastName} placeholder="Apellido" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="dni" value={formData.dni} placeholder="DNI" onChange={handleInputChange} required className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <div>
                            {isCompanyDetermined ? (
                                <input type="text" name="company" value={formData.company} readOnly disabled className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-gray-400 cursor-not-allowed"/>
                            ) : authorizedCompanies.length > 1 ? (
                                <select name="company" value={formData.company} onChange={handleInputChange} required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="" disabled>-- Selecciona tu empresa --</option>
                                    {authorizedCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            ) : (
                                <><input type="text" value="No asignada" readOnly disabled className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-gray-400 cursor-not-allowed"/><p className="mt-1 text-xs text-yellow-400">Advertencia: Esta capacitación no tiene empresas asignadas. Contacta al administrador.</p></>
                            )}
                        </div>
                        <input type="email" name="email" value={formData.email} placeholder="Email (Opcional)" onChange={handleInputChange} className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="tel" name="phone" value={formData.phone} placeholder="Teléfono (Opcional)" onChange={handleInputChange} className="p-3 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Firma Digital (Obligatorio)</label>
                        <SignaturePad onSignatureEnd={handleSignatureEnd} signatureRef={signatureRef} />
                        <button type="button" onClick={clearSignature} className="text-sm text-indigo-400 hover:underline mt-2">Limpiar firma</button>
                    </div>
                    <button type="submit" disabled={!formData.signature || isSubmitting} className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Send className="h-5 w-5 mr-2" />
                        {isSubmitting ? 'Enviando...' : 'Enviar Registro'}
                    </button>
                </form>
            )}

            {viewingLink && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col p-2 sm:p-4 z-50 animate-fade-in">
                    <div className="flex justify-between items-center p-2 bg-slate-800 rounded-t-lg border-b border-slate-700 flex-shrink-0">
                        <h2 className="text-lg font-semibold text-white truncate pr-4">{viewingLink.name?.trim() ? viewingLink.name : `Material ${viewingLinkIndex! + 1}`}</h2>
                        <div className="flex items-center gap-2">
                            <a href={viewingLink.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Abrir en nueva pestaña"><Share2 className="h-5 w-5" /></a>
                            <button onClick={handleCloseViewer} className="p-2 text-gray-400 hover:text-white" title="Cerrar visor"><X className="h-6 w-6" /></button>
                        </div>
                    </div>
                    <div className="flex-grow bg-slate-900">
                        <iframe src={viewingLink.url} title={viewingLink.name || 'Material de capacitación'} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-800 rounded-b-lg border-t border-slate-700 flex-shrink-0">
                        <button onClick={handlePrevLink} disabled={viewingLinkIndex === 0} className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"><ArrowLeft className="h-6 w-6" /></button>
                        <span className="text-sm text-gray-400">{viewingLinkIndex! + 1} / {training.links.length}</span>
                        <button onClick={handleNextLink} disabled={viewingLinkIndex === training.links.length - 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"><ArrowRight className="h-6 w-6" /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- ADMIN DASHBOARD COMPONENT ---
interface AdminDashboardProps {
  // Data from App
  trainings: Training[];
  submissions: UserSubmission[];
  companies: string[];
  adminConfig: AdminConfig;
  error: string | null;
  isSaving: boolean;
  // Modal state setters
  setIsTrainingModalOpen: (open: boolean) => void;
  setCurrentTraining: (t: Training | null) => void;
  setIsSignatureModalOpen: (open: boolean) => void;
  setIsCompaniesModalOpen: (open: boolean) => void;
  // Action Handlers
  onLogout: () => void;
  onDeleteSubmission: (id: string) => Promise<void>;
  onDeleteTraining: (id: string) => Promise<void>;
  onOpenShareModal: (t: Training) => Promise<void>;
  onAddCompany: (name: string) => Promise<void>;
  onDeleteCompany: (name: string) => Promise<void>;
}

const AdminDashboard = React.memo<AdminDashboardProps>(({
  trainings, submissions, companies, adminConfig, error, isSaving,
  setIsTrainingModalOpen, setCurrentTraining, setIsSignatureModalOpen, setIsCompaniesModalOpen,
  onLogout, onDeleteSubmission, onDeleteTraining, onOpenShareModal, onAddCompany, onDeleteCompany
}) => {
  // UI state is now local to the dashboard, preventing App-level re-renders on input change.
  const [searchTerm, setSearchTerm] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [filterTraining, setFilterTraining] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedSubmissions = [...submissions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredSubmissions = sortedSubmissions.filter(sub => {
    const matchesSearch = searchTerm === '' ||
      normalizeString(sub.firstName).includes(normalizeString(searchTerm)) ||
      normalizeString(sub.lastName).includes(normalizeString(searchTerm)) ||
      normalizeString(sub.dni).includes(normalizeString(searchTerm)) ||
      normalizeString(sub.company).includes(normalizeString(searchTerm));
    const matchesTraining = filterTraining === 'all' || sub.trainingId === filterTraining;
    const matchesCompany = filterCompany === 'all' || sub.company === filterCompany;
    return matchesSearch && matchesTraining && matchesCompany;
  });
  
  const PageButton = ({ children, onClick, disabled = false }: { children: React.ReactNode, onClick: () => void, disabled?: boolean}) => (
    <button onClick={onClick} disabled={disabled} className="px-3 py-1 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
  );
  const submissionsPerPage = 10;
  const totalPages = Math.ceil(filteredSubmissions.length / submissionsPerPage);
  const paginatedSubmissions = filteredSubmissions.slice((currentPage - 1) * submissionsPerPage, currentPage * submissionsPerPage);

  return (
    <div className="bg-slate-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {error && <div className="bg-red-800/50 border border-red-700 text-red-200 p-3 rounded-md mb-4">{error}</div>}
        <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center">
            <ShieldCheck className="h-8 w-8 text-indigo-400 mr-3"/>
            <h1 className="text-2xl sm:text-3xl font-bold">Panel de Administrador</h1>
          </div>
          <div className="flex items-center gap-4">
              {isSaving && <span className="text-sm text-yellow-400 flex items-center"><RefreshCw className="animate-spin h-4 w-4 mr-2"/>Guardando...</span>}
              <button onClick={onLogout} className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-500">
                  <LogOut className="h-4 w-4 mr-2"/>
                  Cerrar Sesión
              </button>
          </div>
        </header>

        {/* Admin Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 p-5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Capacitaciones</p>
                <p className="text-3xl font-bold">{trainings.length}</p>
              </div>
              <GraduationCap className="h-10 w-10 text-indigo-500 opacity-50"/>
            </div>
            <div className="bg-slate-800 p-5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Registros</p>
                <p className="text-3xl font-bold">{submissions.length}</p>
              </div>
              <ClipboardList className="h-10 w-10 text-green-500 opacity-50"/>
            </div>
            <div className="bg-slate-800 p-5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Empresas</p>
                <p className="text-3xl font-bold">{companies.length}</p>
              </div>
              <Building className="h-10 w-10 text-sky-500 opacity-50"/>
            </div>
             <div className="bg-slate-800 p-5 rounded-lg flex flex-col justify-center">
                <p className="text-sm text-gray-400 mb-2">Firma del Administrador</p>
                {adminConfig.signature ?
                  <div className="flex items-center gap-4">
                      <img src={adminConfig.signature} alt="Firma" className="h-10 bg-white p-1 rounded-md" />
                      <button onClick={() => setIsSignatureModalOpen(true)} className="text-sm text-indigo-400 hover:underline">Editar</button>
                  </div>
                  :
                  <button onClick={() => setIsSignatureModalOpen(true)} className="text-sm text-indigo-400 hover:underline">Configurar Firma</button>
                }
            </div>
        </div>
        
        {/* Trainings Management Section */}
        <div className="bg-slate-800 p-6 rounded-lg mb-8">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold">Gestionar Capacitaciones</h2>
            <button
              onClick={() => { setCurrentTraining(null); setIsTrainingModalOpen(true); }}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500"
            >
              <PlusCircle className="h-5 w-5 mr-2"/>
              Nueva Capacitación
            </button>
          </div>
          <div className="space-y-3">
            {trainings.length > 0 ? trainings.map(t => (
              <div key={t.id} className="bg-slate-700/50 p-3 rounded-md flex flex-wrap justify-between items-center gap-3">
                <div className="font-medium">{t.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => onOpenShareModal(t)} disabled={isSaving} className="px-3 py-1 text-xs rounded bg-sky-600 hover:bg-sky-700 disabled:bg-slate-500"><Share2 size={14} className="inline mr-1"/>Compartir</button>
                  <button onClick={() => { setCurrentTraining(t); setIsTrainingModalOpen(true); }} disabled={isSaving} className="px-3 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 disabled:bg-slate-500"><Edit size={14} className="inline mr-1"/>Editar</button>
                  <button onClick={() => onDeleteTraining(t.id)} disabled={isSaving} className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-500"><Trash2 size={14} className="inline mr-1"/>Eliminar</button>
                </div>
              </div>
            )) : <p className="text-center text-gray-400 py-4">No hay capacitaciones creadas.</p>}
          </div>
        </div>

        {/* Submissions Table Section */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <div className="flex flex-wrap justify-between items-start mb-4 gap-4">
            <h2 className="text-xl font-semibold">Registros de Usuarios</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsCompaniesModalOpen(true)}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-500 disabled:bg-slate-500"
              >
                <Building className="h-4 w-4 mr-2"/>Gestionar Empresas
              </button>
              <button 
                onClick={() => generateSubmissionsPdf(filteredSubmissions, adminConfig.signature, adminConfig.clarification, adminConfig.jobTitle, 
                  filterTraining !== 'all' ? trainings.find(t=>t.id === filterTraining)?.name : undefined,
                  filterCompany !== 'all' ? filterCompany : undefined
                )}
                disabled={filteredSubmissions.length === 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-500 disabled:opacity-60"
              >
                <FileDown className="h-4 w-4 mr-2"/>Descargar Filtrados
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input type="text" placeholder="Buscar por nombre, DNI, empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 bg-slate-700 border border-slate-600 rounded-md text-white"/>
            <select value={filterTraining} onChange={e => {setFilterTraining(e.target.value); setCurrentPage(1);}} className="p-2 bg-slate-700 border border-slate-600 rounded-md text-white">
              <option value="all">Todas las Capacitaciones</option>
              {trainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterCompany} onChange={e => {setFilterCompany(e.target.value); setCurrentPage(1);}} className="p-2 bg-slate-700 border border-slate-600 rounded-md text-white">
              <option value="all">Todas las Empresas</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3">Capacitación</th>
                  <th scope="col" className="px-4 py-3">Participante</th>
                  <th scope="col" className="px-4 py-3">DNI</th>
                  <th scope="col" className="px-4 py-3">Empresa</th>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubmissions.length > 0 ? paginatedSubmissions.map(sub => (
                  <tr key={sub.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium">{sub.trainingName}</td>
                    <td className="px-4 py-3">{sub.lastName}, {sub.firstName}</td>
                    <td className="px-4 py-3">{sub.dni}</td>
                    <td className="px-4 py-3">{sub.company}</td>
                    <td className="px-4 py-3">{sub.timestamp}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button onClick={() => generateSingleSubmissionPdf(sub, adminConfig.signature, adminConfig.clarification, adminConfig.jobTitle)} className="p-1.5 text-sky-400 hover:text-sky-300" title="Descargar Constancia"><FileDown size={16}/></button>
                      <button onClick={() => onDeleteSubmission(sub.id)} disabled={isSaving} className="p-1.5 text-red-400 hover:text-red-300 disabled:text-gray-500" title="Eliminar Registro"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No se encontraron registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 &&
            <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-400">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-2">
                    <PageButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</PageButton>
                    <PageButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</PageButton>
                </div>
            </div>
          }
        </div>
      </div>
    </div>
  );
  });

// --- MAIN APP COMPONENT ---

const App = () => {
  type AppMode = 'user' | 'admin' | 'login';
  const [mode, setMode] = useState<AppMode>('user');
  const [userTrainings, setUserTrainings] = useState<Training[]>([]);
  
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({ signature: null, clarification: '', jobTitle: '' });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pollingRef = useRef<number | null>(null);

  // State for Admin Modals
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isCompaniesModalOpen, setIsCompaniesModalOpen] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Login State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const ADMIN_PASSWORD = 'admin2025';

  // Admin signature modal state
  const [modalAdminName, setModalAdminName] = useState('');
  const [modalAdminJob, setModalAdminJob] = useState('');
  const adminSignatureRef = useRef<SignatureCanvas>(null);
  
  // Admin companies modal state
  const [newCompanyName, setNewCompanyName] = useState('');

  const fetchData = async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    setError(null);
    try {
      const data = await apiService._getData();
      setTrainings(data.trainings || []);
      setSubmissions(data.submissions || []);
      setCompanies(data.companies || []);
      setAdminConfig(data.adminConfig || { signature: null, clarification: '', jobTitle: '' });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      setError(`Failed to fetch data, will retry automatically: ${errorMessage}`);
      console.error("Fetch data error:", e);
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling(); // Ensure no multiple pollers are running
    if (!document.hidden) {
      fetchData(); // Fetch immediately
      pollingRef.current = window.setInterval(fetchData, 15000); // Increased interval
    }
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trainingKey = urlParams.get('training');
    const adminParam = urlParams.get('admin');
    
    if (adminParam !== null) {
      setMode('login');
      setIsLoading(false);
    } else if (trainingKey) {
      setIsLoading(true);
      apiService.getSharedTraining(trainingKey)
        .then(training => {
          if (training) {
              setUserTrainings([training]);
              setMode('user');
          } else {
              setError("Capacitación no encontrada. Por favor, consulte con el administrador.");
          }
        })
        .catch(err => {
            console.error(err);
            setError("Error al cargar la capacitación.");
        })
        .finally(() => setIsLoading(false));
    } else {
      setMode('user');
      setIsLoading(false);
      // This will show the "scan QR code" message if no trainings are loaded
    }
  }, []);

  useEffect(() => {
    // Smart polling: only poll when the tab is visible and in admin mode.
    const handleVisibilityChange = () => {
      if (mode === 'admin') {
        if (document.hidden) {
          stopPolling();
        } else {
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [mode]);

  useEffect(() => {
    if (isSignatureModalOpen) {
        setModalAdminName(adminConfig.clarification || '');
        setModalAdminJob(adminConfig.jobTitle || '');
    }
  }, [isSignatureModalOpen, adminConfig]);


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
        setLoginError('');
        setPassword('');
        setMode('admin');
        startPolling();
    } else {
        setLoginError('Contraseña incorrecta. Inténtalo de nuevo.');
    }
  };
  
  const handleLogout = () => {
      stopPolling();
      // Remove admin parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.pushState({}, '', url.toString());
      setMode('user'); // Or redirect to a logged-out page
  };
  
  const handleUserSubmit = async (submission: UserSubmission) => {
    setIsSaving(true);
    try {
        const currentData = await apiService._getData();
        const updatedSubmissions = [...currentData.submissions, submission];
        await apiService._putData({ ...currentData, submissions: updatedSubmissions });
        setSubmissions(updatedSubmissions); // Optimistic update
    } catch(e) {
        console.error("Failed to save submission", e);
        alert("Hubo un error al guardar tu registro. Por favor, inténtalo de nuevo.");
        throw e; // Re-throw to inform the caller
    } finally {
        setIsSaving(false);
    }
  };


  const handleDeleteSubmission = async (submissionId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este registro? Esta acción no se puede deshacer.")) return;
    setIsSaving(true);
    stopPolling();
    try {
      const currentData = await apiService._getData();
      const updatedSubmissions = currentData.submissions.filter(s => s.id !== submissionId);
      await apiService._putData({ ...currentData, submissions: updatedSubmissions });
      setSubmissions(updatedSubmissions);
      alert('Registro eliminado con éxito.');
    } catch (e) {
      console.error("Error al eliminar el registro:", e);
      alert(`Error al eliminar el registro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
      startPolling();
    }
  };

  const handleUpdateAdminConfig = async (newConfig: AdminConfig) => {
    setIsSaving(true);
    stopPolling();
    try {
        const currentData = await apiService._getData();
        const updatedData = { ...currentData, adminConfig: newConfig };
        await apiService._putData(updatedData);
        setAdminConfig(newConfig);
        alert('Firma y datos del administrador actualizados con éxito.');
    } catch (e) {
        console.error("Error al actualizar la configuración del administrador:", e);
        alert(`Error al actualizar la configuración: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        setIsSaving(false);
        startPolling();
    }
  };

  const handleDeleteTraining = async (trainingId: string) => {
      if (!window.confirm("¿Estás seguro de que quieres eliminar esta capacitación? Se eliminarán todos los registros asociados.")) return;
      setIsSaving(true);
      stopPolling();
      try {
          const currentData = await apiService._getData();
          const updatedTrainings = currentData.trainings.filter(t => t.id !== trainingId);
          const updatedSubmissions = currentData.submissions.filter(s => s.trainingId !== trainingId);
          await apiService._putData({ ...currentData, trainings: updatedTrainings, submissions: updatedSubmissions });
          setTrainings(updatedTrainings);
          setSubmissions(updatedSubmissions);
          alert('Capacitación eliminada con éxito.');
      } catch (e) {
          console.error("Error al eliminar la capacitación:", e);
          alert(`Error al eliminar la capacitación: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSaving(false);
          startPolling();
      }
  };

  const handleSaveTraining = async (trainingToSave: Training) => {
      setIsSaving(true);
      stopPolling();
      try {
          const currentData = await apiService._getData();
          const existingIndex = currentData.trainings.findIndex(t => t.id === trainingToSave.id);
          let updatedTrainings;
          if (existingIndex > -1) {
              updatedTrainings = [...currentData.trainings];
              updatedTrainings[existingIndex] = trainingToSave;
          } else {
              updatedTrainings = [...currentData.trainings, trainingToSave];
          }
          await apiService._putData({ ...currentData, trainings: updatedTrainings });
          setTrainings(updatedTrainings);
          alert('Capacitación guardada con éxito.');
          setIsTrainingModalOpen(false);
      } catch (e) {
          console.error("Error al guardar la capacitación:", e);
          alert(`Error al guardar la capacitación: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSaving(false);
          startPolling();
      }
  };
  
  const handleAddCompany = async (newCompany: string) => {
    if (!newCompany || companies.map(normalizeString).includes(normalizeString(newCompany))) {
        alert("El nombre de la empresa no puede estar vacío o ya existe.");
        return;
    }
    setIsSaving(true);
    stopPolling();
    try {
        const currentData = await apiService._getData();
        const updatedCompanies = [...(currentData.companies || []), newCompany];
        await apiService._putData({ ...currentData, companies: updatedCompanies });
        setCompanies(updatedCompanies);
        alert('Empresa agregada con éxito.');
    } catch(e) {
        console.error("Error al agregar la empresa:", e);
        alert(`Error al agregar la empresa: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        setIsSaving(false);
        startPolling();
    }
  };

  const handleDeleteCompany = async (companyToDelete: string) => {
      if (!window.confirm(`¿Estás seguro de que quieres eliminar la empresa "${companyToDelete}"? También se desasignará de todas las capacitaciones.`)) return;
      setIsSaving(true);
      stopPolling();
      try {
          const currentData = await apiService._getData();
          const updatedCompanies = (currentData.companies || []).filter(c => c !== companyToDelete);
          const updatedTrainings = (currentData.trainings || []).map(t => ({
              ...t,
              companies: (t.companies || []).filter(c => c !== companyToDelete)
          }));
          await apiService._putData({ ...currentData, companies: updatedCompanies, trainings: updatedTrainings });
          setCompanies(updatedCompanies);
          setTrainings(updatedTrainings);
          alert('Empresa eliminada con éxito.');
      } catch(e) {
          console.error("Error al eliminar la empresa:", e);
          alert(`Error al eliminar la empresa: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSaving(false);
          startPolling();
      }
  };
  
  const handleOpenShareModal = async (training: Training) => {
      setIsSaving(true);
      try {
          const key = await apiService.shareTraining(training);
          const url = `${window.location.origin}${window.location.pathname}?training=${key}`;
          setShareUrl(url);
          const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', width: 256 });
          setQrCodeUrl(qr);
          setIsShareModalOpen(true);
      } catch (e) {
          console.error("Error al compartir la capacitación:", e);
          alert("Error al generar el enlace para compartir.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveAdminSignature = () => {
      const signatureToSave = !adminSignatureRef.current?.isEmpty()
          ? adminSignatureRef.current?.toDataURL()
          : adminConfig.signature;

      if (!signatureToSave) {
          alert("Por favor, dibuje una firma antes de guardar.");
          return;
      }

      const newAdminConfig: AdminConfig = {
          signature: signatureToSave,
          clarification: modalAdminName.trim(),
          jobTitle: modalAdminJob.trim(),
      };
      handleUpdateAdminConfig(newAdminConfig);
      setIsSignatureModalOpen(false);
  };
  
  // A simple modal component
  const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

  const TrainingForm: React.FC<{ training: Training | null; onSave: (training: Training) => void; onCancel: () => void; companies: string[]; isSaving: boolean; }> = 
    ({ training: initialTraining, onSave, onCancel, companies, isSaving }) => {
        const [training, setTraining] = useState<Training>(
            initialTraining || { id: `t-${Date.now()}`, name: '', links: [], companies: [] }
        );
        
        const handleTrainingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setTraining({ ...training, name: e.target.value });
        };
        
        const handleLinkChange = (index: number, field: 'name' | 'url', value: string) => {
            const newLinks = [...training.links];
            newLinks[index] = { ...newLinks[index], [field]: value };
            setTraining({ ...training, links: newLinks });
        };

        const handleAddLink = () => {
            const newLink: TrainingLink = { id: `l-${Date.now()}-${training.links.length}`, url: '', viewed: false };
            setTraining({ ...training, links: [...training.links, newLink] });
        };

        const handleRemoveLink = (index: number) => {
            const newLinks = training.links.filter((_, i) => i !== index);
            setTraining({ ...training, links: newLinks });
        };
      
        const handleCompanyToggle = (company: string) => {
            const currentCompanies = training.companies || [];
            const newCompanies = currentCompanies.includes(company)
                ? currentCompanies.filter(c => c !== company)
                : [...currentCompanies, company];
            setTraining({ ...training, companies: newCompanies });
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!training.name.trim()) {
                alert("El nombre de la capacitación no puede estar vacío.");
                return;
            }
            if (training.links.some(l => !l.url.trim())) {
                alert("Todas las URLs de los enlaces deben estar completas.");
                return;
            }
            onSave(training);
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="trainingName" className="block text-sm font-medium text-gray-300">Nombre de la Capacitación</label>
                    <input id="trainingName" type="text" value={training.name} onChange={handleTrainingChange} required className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"/>
                </div>

                <div>
                    <h4 className="text-lg font-medium text-white mb-2">Material de Estudio (Enlaces)</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {training.links.map((link, index) => (
                            <div key={link.id || index} className="p-3 bg-slate-900/50 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Enlace {index + 1}</span>
                                  <button type="button" onClick={() => handleRemoveLink(index)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                                </div>
                                <input type="text" placeholder="Nombre del material (ej. Video de Seguridad)" value={link.name || ''} onChange={e => handleLinkChange(index, 'name', e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm" />
                                <input type="url" placeholder="https://ejemplo.com/material" value={link.url} onChange={e => handleLinkChange(index, 'url', e.target.value)} required className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm" />
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddLink} className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        <PlusCircle size={16} className="mr-2"/>Añadir Enlace
                    </button>
                </div>
              
                <div>
                    <h4 className="text-lg font-medium text-white mb-2">Empresas Autorizadas</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2">
                        {companies.map(company => (
                            <label key={company} className="flex items-center space-x-2 p-2 bg-slate-700 rounded-md text-sm">
                                <input
                                    type="checkbox"
                                    checked={(training.companies || []).includes(company)}
                                    onChange={() => handleCompanyToggle(company)}
                                    className="h-4 w-4 rounded text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500"
                                />
                                <span className="text-white">{company}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-600 rounded-md hover:bg-slate-500">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-slate-500">{isSaving ? 'Guardando...' : 'Guardar Capacitación'}</button>
                </div>
            </form>
        );
    };


  if (isLoading) {
    return <div className="bg-slate-900 text-white min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin h-8 w-8 mr-3"/>Cargando...</div>;
  }
  
  if (mode === 'login') {
      return (
          <div className="bg-slate-900 min-h-screen flex items-center justify-center p-4">
              <div className="w-full max-w-sm mx-auto bg-slate-800 p-8 rounded-xl shadow-lg text-white">
                  <div className="text-center">
                      <ShieldCheck className="mx-auto h-12 w-12 text-indigo-500" />
                      <h2 className="mt-6 text-2xl font-bold">Portal de Administrador</h2>
                      <p className="mt-2 text-gray-400">Inicia sesión para continuar</p>
                  </div>
                  <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                      <div>
                          <label htmlFor="password-input" className="sr-only">Contraseña</label>
                          <div className="relative">
                              <input
                                  id="password-input"
                                  name="password"
                                  type={showPassword ? 'text' : 'password'}
                                  autoComplete="current-password"
                                  required
                                  value={password}
                                  onChange={(e) => {
                                      setPassword(e.target.value);
                                      setLoginError('');
                                  }}
                                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-slate-600 bg-slate-700 placeholder-gray-400 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  placeholder="Contraseña"
                              />
                              <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                              >
                                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                          </div>
                          {loginError && <p className="mt-2 text-sm text-red-400">{loginError}</p>}
                      </div>
                      <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                          <LogIn className="h-5 w-5 mr-2" />
                          Ingresar
                      </button>
                  </form>
                  <button onClick={() => setMode('user')} className="w-full text-center mt-6 text-sm text-indigo-400 hover:text-indigo-300 flex items-center justify-center">
                      <ArrowLeft className="inline h-4 w-4 mr-1" />
                      Volver al portal de usuario
                  </button>
              </div>
          </div>
      );
  }

  if (mode === 'user') {
    if (userTrainings.length > 0) {
        return <div className="bg-slate-900 min-h-screen flex items-center justify-center p-4">
            <UserPortal userTrainings={userTrainings} adminConfig={adminConfig} onSubmit={handleUserSubmit}/>
        </div>;
    }
    return (
        <div className="bg-slate-900 min-h-screen flex items-center justify-center text-center text-white p-4 relative">
            <div>
                <QrCode className="mx-auto h-24 w-24 text-indigo-400 mb-6" />
                <h1 className="text-3xl font-bold">Portal de Capacitaciones</h1>
                <p className="mt-4 text-lg text-gray-400 max-w-md mx-auto">Para comenzar, por favor escanea el código QR proporcionado para la capacitación específica.</p>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <button onClick={() => setMode('login')} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    Acceso Administrador
                </button>
            </div>
        </div>
    );
  }

  // Admin Dashboard
  if (mode === 'admin') {
    // The AdminDashboard component is now rendered here.
    // It manages its own UI state, making the inputs responsive.
    return (
      <>
        <AdminDashboard
          trainings={trainings}
          submissions={submissions}
          companies={companies}
          adminConfig={adminConfig}
          error={error}
          isSaving={isSaving}
          setIsTrainingModalOpen={setIsTrainingModalOpen}
          setCurrentTraining={setCurrentTraining}
          setIsSignatureModalOpen={setIsSignatureModalOpen}
          setIsCompaniesModalOpen={setIsCompaniesModalOpen}
          onLogout={handleLogout}
          onDeleteSubmission={handleDeleteSubmission}
          onDeleteTraining={handleDeleteTraining}
          onOpenShareModal={handleOpenShareModal}
          onAddCompany={handleAddCompany}
          onDeleteCompany={handleDeleteCompany}
        />
        
        {/* Modals are still rendered here, controlled by state in App */}
        {isTrainingModalOpen && (
            <Modal title={currentTraining ? "Editar Capacitación" : "Nueva Capacitación"} onClose={() => setIsTrainingModalOpen(false)}>
                <TrainingForm training={currentTraining} onSave={handleSaveTraining} onCancel={() => setIsTrainingModalOpen(false)} companies={companies} isSaving={isSaving}/>
            </Modal>
        )}

        {isShareModalOpen && (
            <Modal title="Compartir Capacitación" onClose={() => setIsShareModalOpen(false)}>
                <div className="text-center space-y-4">
                    <p className="text-gray-300">Escanea el código QR o comparte el enlace directo.</p>
                    <img src={qrCodeUrl} alt="Código QR" className="mx-auto rounded-lg" />
                    <div className="flex items-center space-x-2">
                      <input type="text" value={shareUrl} readOnly className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"/>
                      <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('¡Enlace copiado!'); }} className="p-2 bg-indigo-600 rounded-md hover:bg-indigo-700"><Copy size={20}/></button>
                    </div>
                </div>
            </Modal>
        )}

        {isCompaniesModalOpen && (
          <Modal title="Gestionar Empresas" onClose={() => { setIsCompaniesModalOpen(false); setNewCompanyName(''); }}>
              <div className="space-y-4">
                  <div>
                      <label htmlFor="newCompany" className="text-sm font-medium text-gray-300">Añadir nueva empresa</label>
                      <div className="flex gap-2 mt-1">
                          <input
                              id="newCompany"
                              type="text"
                              value={newCompanyName}
                              onChange={(e) => setNewCompanyName(e.target.value)}
                              className="flex-grow p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                              placeholder="Nombre de la empresa"
                          />
                          <button
                              onClick={() => { handleAddCompany(newCompanyName); setNewCompanyName(''); }}
                              disabled={isSaving || !newCompanyName.trim()}
                              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500 disabled:opacity-70 disabled:cursor-not-allowed"
                          >Añadir</button>
                      </div>
                  </div>
                  <div className="border-t border-slate-700 pt-4">
                      <h4 className="font-semibold text-white mb-2">Empresas Existentes</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                          {companies.length > 0 ? companies.map(c => (
                              <div key={c} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-md">
                                  <span>{c}</span>
                                  <button
                                      onClick={() => handleDeleteCompany(c)}
                                      disabled={isSaving}
                                      className="text-red-400 hover:text-red-300 disabled:text-gray-500"
                                  ><Trash2 size={16}/></button>
                              </div>
                          )) : <p className="text-gray-400 text-center">No hay empresas registradas.</p>}
                      </div>
                  </div>
              </div>
          </Modal>
        )}
        
        {isSignatureModalOpen && (
            <Modal title="Editar Firma y Datos" onClose={() => setIsSignatureModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="adminNameModal" className="block text-sm font-medium text-gray-300">Aclaración (Nombre Completo)</label>
                        <input
                            type="text"
                            id="adminNameModal"
                            value={modalAdminName}
                            onChange={(e) => setModalAdminName(e.target.value)}
                            className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="adminJobModal" className="block text-sm font-medium text-gray-300">Cargo</label>
                        <input
                            type="text"
                            id="adminJobModal"
                            value={modalAdminJob}
                            onChange={(e) => setModalAdminJob(e.target.value)}
                            className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <p className="block text-sm font-medium text-gray-300 mb-1">
                            Firma (dibujar para reemplazar la existente)
                        </p>
                        <SignaturePad
                            signatureRef={adminSignatureRef}
                            onSignatureEnd={() => {}}
                            initialData={adminConfig.signature}
                        />
                        <button
                            type="button"
                            onClick={() => adminSignatureRef.current?.clear()}
                            className="text-sm text-indigo-400 hover:underline mt-2"
                        >
                            Limpiar firma
                        </button>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveAdminSignature}
                            disabled={isSaving}
                            className="inline-flex justify-center items-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-500 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </Modal>
        )}
      </>
    );
  }

  return null; // Should not be reached
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
// FIX: Removed invalid file content markers from the end of the file. The trailing text was causing a major syntax error, leading to a cascade of incorrect parsing errors throughout the component.
root.render(<App />);