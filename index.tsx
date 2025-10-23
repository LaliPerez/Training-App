import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  viewed: boolean;
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
          // FIX: `toLocaleDateTimeString` is not a valid method on the Date object. Using `toLocaleString` to get both date and time.
          const dateStr = `Generado el: ${new Date().toLocaleString('es-ES')}`;
          
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
    doc.addImage(adminSignature, 'PNG', adminSignatureX, signatureBlockY, signatureWidth, signatureHeight);
    doc.line(adminSignatureX, signatureLineY, adminSignatureX + signatureWidth, signatureLineY);
    doc.text(adminSignatureClarification, adminSignatureX + signatureWidth/2, signatureLineY + 5, { align: 'center' });
    doc.setFontSize(9);
    doc.text(adminJobTitle, adminSignatureX + signatureWidth/2, signatureLineY + 10, { align: 'center' });
    
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

    const [isConfigModalOpen, setConfigModalOpen] = useState(false);
    const [isTrainingModalOpen, setTrainingModalOpen] = useState(false);
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    
    const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
    const [selectedCompaniesForTraining, setSelectedCompaniesForTraining] = useState<string[]>([]);
    const [trainingToShare, setTrainingToShare] = useState<Training | null>(null);
    const [isGeneratingShareLink, setIsGeneratingShareLink] = useState<string | null>(null);

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
            // Do not show alert on every save, only when there is a message
        } catch (e: any) {
            setError(`Error al guardar los datos: ${e.message}`);
            alert(`Error al guardar los datos: ${e.message}`);
        } finally {
            isFetching.current = false;
            setIsSaving(false);
        }
    };

    const handleUpdateConfig = () => {
        const signature = adminSigCanvasRef.current?.isEmpty()
            ? data.adminConfig?.signature
            : adminSigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png');
        
        const newClarification = (document.getElementById('adminClarification') as HTMLInputElement).value;
        const newJobTitle = (document.getElementById('adminJobTitle') as HTMLInputElement).value;

        if (!signature || !newClarification || !newJobTitle) {
            alert("Por favor, complete todos los campos de configuración, incluyendo la firma.");
            return;
        }

        const newConfig: AdminConfig = {
            signature,
            clarification: newClarification,
            jobTitle: newJobTitle
        };

        const newData = { ...data, adminConfig: newConfig };
        saveData(newData).then(() => {
            alert("Configuración del administrador guardada.");
            setConfigModalOpen(false);
        });
    };

    const filteredSubmissions = useMemo(() => {
        return (data.submissions || []).filter(sub => {
            const searchMatch = filter === '' || 
                normalizeString(sub.firstName).includes(normalizeString(filter)) ||
                normalizeString(sub.lastName).includes(normalizeString(filter)) ||
                normalizeString(sub.dni).includes(normalizeString(filter));
            const companyMatch = selectedCompany === '' || sub.company === selectedCompany;
            const trainingMatch = selectedTraining === '' || sub.trainingId === selectedTraining;
            return searchMatch && companyMatch && trainingMatch;
        }).sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [data.submissions, filter, selectedCompany, selectedTraining]);

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
            viewed: false
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
        setCurrentTraining({ id: '', name: '', links: [{id: 'new-1', url: '', viewed: false, name: ''}], companies: [] });
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
                                    onClick={() => generateSubmissionsPdf(filteredSubmissions, data.adminConfig?.signature || null, data.adminConfig?.clarification || '', data.adminConfig?.jobTitle || '', selectedTraining ? data.trainings?.find(t=>t.id===selectedTraining)?.name : undefined, selectedCompany || undefined)} 
                                    disabled={filteredSubmissions.length === 0 || !data.adminConfig?.signature}
                                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    <FileDown size={16}/><span>Descargar PDF ({filteredSubmissions.length})</span>
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
                                {[...new Set(data.submissions?.map(s => s.company) || [])].sort().map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border border-slate-700 rounded-lg">
                             <table className="min-w-full divide-y divide-slate-700">
                                <thead className="bg-slate-900 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Asistente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Capacitación</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-slate-800 divide-y divide-slate-700">
                                    {filteredSubmissions.length > 0 ? filteredSubmissions.map((sub, index) => (
                                        <tr key={sub.id} className="hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400 text-center">{index + 1}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-slate-100">{sub.lastName}, {sub.firstName}</div>
                                                <div className="text-xs text-slate-400">DNI: {sub.dni}</div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">{sub.trainingName}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">{sub.company}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">{new Date(sub.timestamp).toLocaleString('es-ES')}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => generateSingleSubmissionPdf(sub, data.adminConfig?.signature || null, data.adminConfig?.clarification || '', data.adminConfig?.jobTitle || '')} disabled={!data.adminConfig?.signature} title="Descargar Certificado" className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-md disabled:opacity-30"><FileText size={16}/></button>
                                                    <button onClick={() => handleDeleteSubmission(sub.id)} title="Eliminar Registro" className="p-1.5 text-red-400 hover:bg-red-900/50 rounded-md"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-sm text-slate-500">
                                                No se encontraron registros con los filtros actuales.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </div>
            
            <Modal isOpen={isConfigModalOpen} onClose={() => setConfigModalOpen(false)} title="Configurar Datos del Administrador">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="adminClarification" className="block text-sm font-medium text-slate-300 mb-1">Aclaración de Firma</label>
                        <input type="text" id="adminClarification" defaultValue={data.adminConfig?.clarification} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" placeholder="Nombre y Apellido"/>
                    </div>
                     <div>
                        <label htmlFor="adminJobTitle" className="block text-sm font-medium text-slate-300 mb-1">Cargo / Puesto</label>
                        <input type="text" id="adminJobTitle" defaultValue={data.adminConfig?.jobTitle} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" placeholder="Ej: Gerente de RRHH"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Firma Digital</label>
                         {data.adminConfig?.signature && (
                            <div className="mb-2 p-2 border rounded-md bg-slate-700 flex items-center justify-center">
                                <img src={data.adminConfig.signature} alt="Firma guardada" className="h-20"/>
                            </div>
                        )}
                        <SignaturePad sigCanvasRef={adminSigCanvasRef} />
                    </div>
                    <div className="flex justify-end pt-4">
                         <button onClick={handleUpdateConfig} disabled={isSaving} className="flex items-center justify-center w-36 h-10 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:bg-slate-600">
                            {isSaving ? <Spinner size={5}/> : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isTrainingModalOpen} onClose={() => {setTrainingModalOpen(false); setCurrentTraining(null);}} title={currentTraining?.id ? 'Editar Capacitación' : 'Nueva Capacitación'}>
                <div className="space-y-6">
                    <div>
                        <h4 className="text-lg font-bold text-slate-200 mb-2 border-b border-slate-700 pb-2">1. Detalles de la Capacitación</h4>
                        <label htmlFor="trainingName" className="block text-sm font-medium text-slate-300 mb-1 mt-3">Nombre</label>
                        <input type="text" id="trainingName" defaultValue={currentTraining?.name} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200" required placeholder="Ej: Seguridad e Higiene 2024" />
                    </div>

                    <hr className="border-slate-700" />

                    <div>
                        <h4 className="text-lg font-bold text-slate-200 mb-3">2. Material de Estudio (Enlaces)</h4>
                        <div className="space-y-3">
                        {(currentTraining?.links || []).map((link, index) => (
                            <div key={link.id || index} className="p-3 bg-slate-700/50 border border-slate-600 rounded-lg space-y-2 training-link-group">
                                <div className="flex items-center justify-between">
                                     <span className="text-sm font-semibold text-slate-400">Enlace #{index + 1}</span>
                                     <button type="button" onClick={() => {
                                        if(currentTraining) {
                                            const newLinks = currentTraining.links.filter((_, i) => i !== index);
                                            setCurrentTraining({...currentTraining, links: newLinks});
                                        }
                                    }} className="p-1.5 text-red-400 hover:bg-red-900/50 rounded-full transition"><Trash2 size={16}/></button>
                                </div>
                                <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-2">
                                    <input type="text" placeholder="Nombre del material (Opcional)" defaultValue={link.name} className="flex-grow w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 training-link-name" />
                                    <input type="url" placeholder="https://ejemplo.com/material" defaultValue={link.url} required className="flex-grow w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-200 training-link-url" />
                                </div>
                            </div>
                        ))}
                        </div>
                        <button onClick={() => {
                            if (currentTraining) {
                                setCurrentTraining({
                                    ...currentTraining,
                                    links: [...currentTraining.links, {id: `new-${Date.now()}`, url: '', viewed: false, name: ''}]
                                });
                            }
                        }} className="mt-3 flex items-center space-x-2 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-900/50 px-3 py-1.5 rounded-md border border-blue-800">
                            <PlusCircle size={16}/><span>Añadir Enlace</span>
                        </button>
                    </div>
                    
                    <hr className="border-slate-700" />

                    <div>
                        <h4 className="text-lg font-bold text-slate-200 mb-3">3. Asignar a Empresas (Opcional)</h4>
                        <div className="max-h-32 overflow-y-auto space-y-2 p-3 bg-slate-700 rounded-md border border-slate-600">
                            {(data.companies && data.companies.length > 0) ? data.companies.map(company => (
                                <label key={company} className="flex items-center space-x-3 cursor-pointer p-1 rounded-md hover:bg-slate-600/50">
                                    <input 
                                        type="checkbox"
                                        checked={selectedCompaniesForTraining.includes(company)}
                                        onChange={() => {
                                            setSelectedCompaniesForTraining(prev => 
                                                prev.includes(company) 
                                                    ? prev.filter(c => c !== company)
                                                    : [...prev, company]
                                            );
                                        }}
                                        className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-300">{company}</span>
                                </label>
                            )) : <p className="text-sm text-slate-500">No hay empresas. Añádalas desde el panel de Empresas.</p>}
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                         <button onClick={handleSaveTraining} disabled={isSaving} className="flex items-center justify-center w-32 h-10 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:bg-slate-600">
                             {isSaving ? <Spinner size={5}/> : 'Guardar'}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isShareModalOpen} onClose={() => {setShareModalOpen(false); setTrainingToShare(null)}} title={`Compartir: ${trainingToShare?.name}`}>
                 <ShareModalContent training={trainingToShare} />
            </Modal>
        </div>
    );
};

// --- USER PORTAL COMPONENTS ---

const UserForm: React.FC<{ training: Training; companyName?: string | null; onSubmit: (submission: Omit<UserSubmission, 'id' | 'timestamp'>) => Promise<void> }> = ({ training, companyName, onSubmit }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dni, setDni] = useState('');
    const [company, setCompany] = useState(companyName || '');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const sigCanvasRef = useRef<SignatureCanvas>(null);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !lastName || !dni || !company) {
            alert('Por favor, complete todos los campos obligatorios: Nombre, Apellido, DNI y Empresa.');
            return;
        }
        if (sigCanvasRef.current?.isEmpty()) {
            alert('La firma es obligatoria para completar el registro.');
            return;
        }
        
        const signature = sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png');
        if (!signature) {
             alert('No se pudo obtener la firma. Por favor, intente de nuevo.');
             return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                trainingId: training.id,
                trainingName: training.name,
                firstName,
                lastName,
                dni,
                company,
                signature,
                email,
                phone
            });
        } catch (error) {
            console.error("Submission failed:", error);
            alert("Hubo un error al enviar sus datos. Por favor, intente de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" required className="p-3 bg-slate-700 border border-slate-600 rounded-lg w-full text-slate-100 placeholder:text-slate-400"/>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" required className="p-3 bg-slate-700 border border-slate-600 rounded-lg w-full text-slate-100 placeholder:text-slate-400"/>
                <input type="text" value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI" required className="p-3 bg-slate-700 border border-slate-600 rounded-lg w-full text-slate-100 placeholder:text-slate-400"/>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Empresa" required readOnly={!!companyName} className={`p-3 border rounded-lg w-full text-slate-100 placeholder:text-slate-400 ${companyName ? 'bg-slate-600 border-slate-500 cursor-not-allowed' : 'bg-slate-700 border-slate-600'}`}/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Opcional)" className="p-3 bg-slate-700 border border-slate-600 rounded-lg w-full text-slate-100 placeholder:text-slate-400"/>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono (Opcional)" className="p-3 bg-slate-700 border border-slate-600 rounded-lg w-full text-slate-100 placeholder:text-slate-400"/>
            </div>

            <div>
                 <h3 className="text-lg font-semibold text-slate-100 mb-2">Firma Digital</h3>
                 <SignaturePad sigCanvasRef={sigCanvasRef} />
            </div>
            
            <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-500 transition disabled:bg-slate-600">
                {isSubmitting ? <Spinner size={6} /> : <Send size={20}/>}
                <span>{isSubmitting ? 'Enviando...' : 'Finalizar y Enviar Registro'}</span>
            </button>
        </form>
    );
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="w-full bg-slate-700 rounded-full h-4 mb-4 border border-slate-600">
        <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
        ></div>
    </div>
);


const UserPortal: React.FC<{ training: Training; companyName: string | null; onBackToHome: () => void }> = ({ training, companyName, onBackToHome }) => {
    const [links, setLinks] = useState<TrainingLink[]>(training.links.map(l => ({ ...l, viewed: false })));
    const [submissionComplete, setSubmissionComplete] = useState(false);
    const [completedSubmission, setCompletedSubmission] = useState<UserSubmission | null>(null);
    const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
    const lastOpenedLinkId = useRef<string | null>(null);
    
    const prefilledCompany = useMemo(() => {
        if (companyName) return companyName;
        if (training.companies && training.companies.length === 1) return training.companies[0];
        return null;
    }, [companyName, training.companies]);
    
    useEffect(() => {
        const handleFocus = () => {
            if (lastOpenedLinkId.current) {
                setLinks(prevLinks => 
                    prevLinks.map(link => 
                        link.id === lastOpenedLinkId.current ? { ...link, viewed: true } : link
                    )
                );
                lastOpenedLinkId.current = null; // Reset after marking
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const handleOpenMaterial = (linkId: string) => {
        lastOpenedLinkId.current = linkId;
    };

    const handleUserSubmit = async (submissionData: Omit<UserSubmission, 'id' | 'timestamp'>) => {
        const fullSubmission: UserSubmission = {
            ...submissionData,
            id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
        };

        try {
            const data = await apiService._getData();
            const updatedSubmissions = [...(data.submissions || []), fullSubmission];
            const uniqueCompanies = [...new Set([...(data.companies || []), fullSubmission.company])].sort();
            
            await apiService._putData({ ...data, submissions: updatedSubmissions, companies: uniqueCompanies });
            
            setCompletedSubmission(fullSubmission);
            setAdminConfig(data.adminConfig || null);
            setSubmissionComplete(true);
        } catch (e) {
            console.error("Failed to submit user data", e);
            throw e; // Re-throw to be caught by the form handler
        }
    };

    const viewedLinksCount = links.filter(link => link.viewed).length;
    const totalLinksCount = links.length;
    const progress = totalLinksCount > 0 ? (viewedLinksCount / totalLinksCount) * 100 : 0;
    const allLinksViewed = progress === 100;
    
    if (submissionComplete && completedSubmission) {
        return (
            <div className="text-center py-20 px-4">
                 <CheckCircle size={64} className="mx-auto text-green-400 mb-4" />
                <h2 className="text-3xl font-bold text-slate-100 mb-2">¡Registro Completado!</h2>
                <p className="text-slate-400 max-w-md mx-auto mb-8">Gracias por completar la capacitación. Sus datos han sido enviados correctamente.</p>

                {adminConfig?.signature ? (
                     <button onClick={() => generateSingleSubmissionPdf(completedSubmission, adminConfig.signature, adminConfig.clarification, adminConfig.jobTitle)} className="flex items-center justify-center mx-auto space-x-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-500 transition">
                        <FileDown size={18}/><span>Descargar Certificado</span>
                    </button>
                ) : (
                    <p className="text-sm text-yellow-400 bg-yellow-900/50 p-3 rounded-md max-w-md mx-auto">La descarga del certificado no está disponible porque el administrador no ha configurado su firma.</p>
                )}

                <button onClick={onBackToHome} className="mt-8 flex items-center justify-center mx-auto space-x-2 text-slate-400 hover:text-slate-200 transition">
                    <ArrowLeft size={18}/><span>Volver al Inicio</span>
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <header className="text-center mb-8">
                <GraduationCap size={48} className="mx-auto text-slate-300 mb-2"/>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100">{training.name}</h1>
                <p className="text-slate-400 mt-2">Siga los pasos a continuación para completar su registro.</p>
            </header>

            <section className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md mb-8">
                <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center"><ClipboardList size={24} className="mr-2 text-blue-400"/>Paso 1: Ver el material</h2>
                <p className="text-slate-400 mb-4">
                    Abra cada material en una nueva pestaña. Su progreso se guardará automáticamente al volver a esta ventana.
                </p>
                <div className="mb-4">
                    <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-semibold text-slate-300">Progreso</span>
                        <span className="text-slate-400">{viewedLinksCount} de {totalLinksCount} completados</span>
                    </div>
                    <ProgressBar progress={progress} />
                </div>
                <div className="space-y-3">
                    {links.map((link, index) => (
                        <div 
                            key={link.id}
                            className="flex flex-col sm:flex-row items-center justify-between text-left p-4 bg-slate-900 border border-slate-700 rounded-lg gap-4"
                        >
                            <span className="font-semibold text-slate-200 flex-grow">{link.name || `Material de Estudio #${index + 1}`}</span>
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <a 
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleOpenMaterial(link.id)}
                                    className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold rounded-md transition ${
                                        link.viewed
                                        ? 'bg-green-800 text-green-200 cursor-default'
                                        : 'text-slate-200 bg-slate-700 hover:bg-slate-600'
                                    }`}
                                >
                                    {link.viewed ? <CheckCircle size={16}/> : <Eye size={16}/>}
                                    <span>{link.viewed ? 'Visto' : 'Abrir Material'}</span>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            
            {allLinksViewed && (
                <section className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center"><User size={24} className="mr-2 text-blue-400"/>Paso 2: Registrar sus datos</h2>
                    <p className="text-slate-400 mb-4">¡Excelente! Ha completado todo el material. Por favor, complete el formulario con sus datos y firme para confirmar su asistencia.</p>
                    <UserForm training={training} companyName={prefilledCompany} onSubmit={handleUserSubmit} />
                </section>
            )}

            <button onClick={onBackToHome} className="mt-12 flex items-center justify-center mx-auto space-x-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                 <ArrowLeft size={16}/><span>No soy un asistente / Volver</span>
            </button>
        </div>
    );
};


// --- ADMIN LOGIN & MAIN APP ---

const AdminLogin: React.FC<{ onLogin: () => void; onUserView: () => void }> = ({ onLogin, onUserView }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple hardcoded password. In a real app, this should be secure.
        if (password === 'admin2025') {
            onLogin();
        } else {
            setError('Contraseña incorrecta.');
            setPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                     <ShieldCheck size={48} className="mx-auto text-slate-300 mb-2"/>
                    <h1 className="text-3xl font-bold text-slate-100">Acceso de Administrador</h1>
                    <p className="text-slate-400 mt-1">Ingrese la contraseña para continuar.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 p-8 rounded-xl shadow-lg space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className={`w-full p-3 pr-10 bg-slate-700 border rounded-lg text-slate-100 ${error ? 'border-red-500' : 'border-slate-600'}`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                    </div>
                    <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-500 transition">
                         <LogIn size={20}/>
                        <span>Ingresar</span>
                    </button>
                </form>

                 <div className="text-center mt-8">
                    <button onClick={onUserView} className="text-sm text-slate-400 hover:text-slate-200 hover:underline transition">
                        ¿Buscas registrarte a una capacitación? Haz clic aquí
                    </button>
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoadingTraining, setIsLoadingTraining] = useState(true);
    const [training, setTraining] = useState<Training | null>(null);
    const [company, setCompany] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadSharedTraining = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const trainingKey = urlParams.get('trainingKey');
        const companyName = urlParams.get('company');
        
        if (trainingKey) {
            try {
                const fetchedTraining = await apiService.getSharedTraining(trainingKey);
                if (fetchedTraining) {
                    setTraining(fetchedTraining);
                    if(companyName) {
                        setCompany(companyName);
                    }
                } else {
                    setError("El enlace de la capacitación no es válido o ha expirado.");
                }
            } catch (e: any) {
                console.error("Error loading shared training:", e);
                setError(`No se pudo cargar la capacitación: ${e.message}`);
            }
        }
        setIsLoadingTraining(false);
    };

    useEffect(() => {
        loadSharedTraining();
    }, []);

    const handleLogin = () => {
        localStorage.setItem('isAdmin', 'true');
        setIsAdmin(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('isAdmin');
        setIsAdmin(false);
    };
    
    const resetToHome = () => {
        // Navigate to the base URL of the app. This triggers a reload and state reset.
        const url = new URL(window.location.href);
        url.search = ''; // Clear query parameters
        url.hash = ''; // Clear hash
        window.location.href = url.pathname;
    };
    
    useEffect(() => {
        if (localStorage.getItem('isAdmin') === 'true') {
            setIsAdmin(true);
        }
    }, []);

    if (isLoadingTraining) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <Spinner size={12} />
                <p className="mt-4 text-slate-400">Cargando capacitación...</p>
            </div>
        );
    }
    
     if (training) {
        return <UserPortal training={training} companyName={company} onBackToHome={resetToHome} />;
    }

    if(error){
         return (
             <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                 <X size={48} className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-300 mb-2">Error al Cargar</h2>
                <p className="text-slate-400 max-w-md">{error}</p>
                 <button onClick={resetToHome} className="mt-8 flex items-center justify-center mx-auto space-x-2 bg-slate-700 text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-600 transition">
                    <ArrowLeft size={18}/><span>Volver al Inicio</span>
                </button>
            </div>
         )
    }

    if (isAdmin) {
        return <AdminDashboard onLogout={handleLogout} />;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('admin') === 'true') {
        return <AdminLogin onLogin={handleLogin} onUserView={resetToHome}/>;
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <GraduationCap size={64} className="mx-auto text-blue-400 mb-4" />
                <h1 className="text-4xl font-extrabold text-slate-100">Bienvenido</h1>
                <p className="text-lg text-slate-400 mt-2 mb-10">Portal de Capacitaciones</p>
                
                <div className="space-y-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-left">
                         <div className="flex items-center mb-3">
                            <User size={22} className="mr-3 text-slate-300"/>
                            <h2 className="text-xl font-bold text-slate-100">Soy Asistente</h2>
                         </div>
                         <p className="text-slate-400 leading-relaxed">
                             Para registrar tu asistencia, escanea el código QR o utiliza el enlace que te proporcionó el administrador.
                         </p>
                    </div>

                    <button 
                        onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('admin', 'true');
                            window.location.href = url.href;
                        }} 
                        className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white font-bold py-4 px-4 rounded-xl hover:bg-blue-500 transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                         <ShieldCheck size={22}/>
                         <span className="text-lg">Acceso Administrador</span>
                         <ArrowRight size={22}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);