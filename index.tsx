// FIX: Removed invalid file markers from the beginning and end of the file.
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
const JSONBIN_BIN_ID = '68fa2244d0ea881f40b57b27'; // Ejemplo: '667d7e3aad19ca34f881b2c3'

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

interface AppData {
  submissions: UserSubmission[];
  adminConfig?: AdminConfig;
  sharedTrainings?: { [key: string]: Training };
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
        sharedTrainings: data.sharedTrainings || {},
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
    doc.text(`Realizada en la fecha ${submission.timestamp}.`, margin, bodyY + 55);

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
  <div className={`w-${size} h-${size} border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin`}></div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};


const SignaturePad: React.FC<{ onSave: (dataUrl: string) => void; onClear: () => void; sigCanvasRef: React.RefObject<SignatureCanvas> }> = ({ onSave, onClear, sigCanvasRef }) => {
  
  const handleSave = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      onSave(dataUrl);
    } else {
      alert("Por favor, provea su firma.");
    }
  };

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    onClear();
  };
  
  // FIX: The 'penColor' prop is valid but causes a type error, likely due to incorrect library typings.
  // Casting the component to 'any' to bypass the incorrect type check for this prop.
  const AnySignatureCanvas = SignatureCanvas as any;

  return (
    <div className="w-full">
      <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden">
        <AnySignatureCanvas
          ref={sigCanvasRef}
          penColor='black'
          canvasProps={{ className: 'w-full h-48' }}
        />
      </div>
      <div className="flex justify-end space-x-3 mt-4">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
        >
          Limpiar
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-700 transition-colors"
        >
          Guardar Firma
        </button>
      </div>
    </div>
  );
};


const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Data state
    const [data, setData] = useState<AppData>({
        submissions: [],
        trainings: [],
        companies: [],
        adminConfig: { signature: null, clarification: '', jobTitle: '' },
        sharedTrainings: {}
    });

    const [filter, setFilter] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [selectedTraining, setSelectedTraining] = useState<string>('');

    const [isConfigModalOpen, setConfigModalOpen] = useState(false);
    const [isTrainingModalOpen, setTrainingModalOpen] = useState(false);
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    
    const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
    const [shareableLink, setShareableLink] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');

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
            alert("¡Configuración guardada exitosamente!");
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
        saveData(newData);
        setConfigModalOpen(false);
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
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
        })).filter(link => link.url); // Only save links that have a URL
    
        if (links.length === 0) {
            alert('Debe agregar al menos un enlace a la capacitación.');
            return;
        }
        
        let updatedTrainings;
        if (currentTraining) { // Editing existing training
            updatedTrainings = data.trainings?.map(t => t.id === currentTraining.id ? { ...currentTraining, name, links } : t) || [];
        } else { // Creating new training
            const newTraining: Training = {
                id: `train-${Date.now()}`,
                name,
                links,
            };
            updatedTrainings = [...(data.trainings || []), newTraining];
        }
    
        const newData = { ...data, trainings: updatedTrainings };
        saveData(newData);
        setTrainingModalOpen(false);
        setCurrentTraining(null);
    };
    
    const handleAddLinkField = () => {
        if (currentTraining) {
            const newLinks = [...(currentTraining.links || []), { id: `new-${Date.now()}`, url: '', viewed: false, name: '' }];
            setCurrentTraining({ ...currentTraining, links: newLinks });
        } else {
             // If creating a new training, we need to handle this differently.
             // This logic should be handled inside the modal state.
             // For now, let's just log a warning.
             console.warn("Cannot add link field when not editing a training. State should be managed within the modal.");
        }
    };
    
    // A simplified version to be used inside the modal render
    const renderTrainingLinks = (training: Training | null) => {
        // This is a placeholder. The actual state management for new/edited links should be inside the modal component itself
        // to avoid re-renders of the entire dashboard.
        const links = training?.links || [{ id: 'new-1', url: '', viewed: false, name: '' }];
        return links.map((link, index) => (
            <div key={link.id || index} className="training-link-group flex items-center space-x-2 mb-2">
                <input type="text" defaultValue={link.name} placeholder="Nombre del enlace (opcional)" className="training-link-name flex-grow p-2 border border-slate-300 rounded-md text-sm" />
                <input type="url" defaultValue={link.url} placeholder="https://ejemplo.com" required className="training-link-url flex-grow p-2 border border-slate-300 rounded-md text-sm" />
                <button type="button" onClick={() => removeLink(index)} className="p-2 text-red-500 hover:text-red-700">
                    <Trash2 size={16}/>
                </button>
            </div>
        ));
    };
    
    const removeLink = (indexToRemove: number) => {
        if (currentTraining) {
            const newLinks = currentTraining.links.filter((_, index) => index !== indexToRemove);
            setCurrentTraining({ ...currentTraining, links: newLinks });
        }
    };
    
    const openNewTrainingModal = () => {
        setCurrentTraining({ id: '', name: '', links: [{id: 'new-1', url: '', viewed: false, name: ''}] });
        setTrainingModalOpen(true);
    };
    
    const openEditTrainingModal = (training: Training) => {
        setCurrentTraining(JSON.parse(JSON.stringify(training))); // Deep copy to avoid direct mutation
        setTrainingModalOpen(true);
    };

    const handleDeleteTraining = (trainingId: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar esta capacitación? Esta acción no se puede deshacer.")) {
            const updatedTrainings = data.trainings?.filter(t => t.id !== trainingId);
            const newData = { ...data, trainings: updatedTrainings };
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
    
    const handleShareTraining = async (training: Training) => {
        try {
            const key = await apiService.shareTraining(training);
            const url = `${window.location.origin}${window.location.pathname}?trainingKey=${key}`;
            setShareableLink(url);
            const qr = await QRCode.toDataURL(url, { width: 256, margin: 2 });
            setQrCodeUrl(qr);
            setShareModalOpen(true);
        } catch (error) {
            console.error("Error sharing training:", error);
            alert("No se pudo generar el enlace para compartir.");
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Spinner size={12} /></div>;
    }
    
    const configCheck = () => {
        if (JSONBIN_BIN_ID.startsWith('REEMPLAZA') || JSONBIN_MASTER_KEY.startsWith('REEMPLAZA')) {
             return (
                <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl text-center">
                        <ShieldCheck size={48} className="mx-auto text-red-500 mb-4" />
                        <h1 className="text-2xl font-bold text-red-800 mb-2">Configuración Requerida</h1>
                        <p className="text-slate-600">
                            Para utilizar la aplicación, primero debe configurar las credenciales de la API de 
                            <a href="https://jsonbin.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold"> jsonbin.io</a>.
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
        <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-300">
                    <div className="flex items-center space-x-3">
                         <ShieldCheck className="w-8 h-8 text-slate-800" />
                        <h1 className="text-3xl font-bold text-slate-800">Panel de Administrador</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={fetchData} disabled={isFetching.current} className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors">
                            <RefreshCw size={20} className={isFetching.current ? 'animate-spin' : ''}/>
                        </button>
                        <button onClick={() => setConfigModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition">
                           <User size={16}/><span>Configurar Firma</span>
                        </button>
                        <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 transition">
                            <LogOut size={16}/><span>Cerrar Sesión</span>
                        </button>
                    </div>
                </header>
                 {error && <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert">{error}</div>}

                {/* Main Content */}
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    {/* Trainings Section */}
                    <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm">
                         <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center"><Award size={22} className="mr-2"/>Capacitaciones</h2>
                            <button onClick={openNewTrainingModal} className="flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-700 transition">
                               <PlusCircle size={16}/><span>Nueva</span>
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                             {(data.trainings || []).length > 0 ? (
                                data.trainings?.map(training => (
                                    <div key={training.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-all group">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-700">{training.name}</p>
                                                <span className="text-xs text-slate-500">{training.links.length} enlace(s)</span>
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleShareTraining(training)} title="Compartir" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md"><Share2 size={16}/></button>
                                                <button onClick={() => openEditTrainingModal(training)} title="Editar" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteTraining(training.id)} title="Eliminar" className="p-1.5 text-red-500 hover:bg-red-100 rounded-md"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-8">No hay capacitaciones creadas.</p>
                            )}
                        </div>
                    </section>
                    
                    {/* Submissions Section */}
                    <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center"><Users size={22} className="mr-2"/>Registros de Asistentes</h2>
                            <button 
                                onClick={() => generateSubmissionsPdf(filteredSubmissions, data.adminConfig?.signature || null, data.adminConfig?.clarification || '', data.adminConfig?.jobTitle || '', selectedTraining ? data.trainings?.find(t=>t.id===selectedTraining)?.name : undefined, selectedCompany || undefined)} 
                                disabled={filteredSubmissions.length === 0 || !data.adminConfig?.signature}
                                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                <FileDown size={16}/><span>Descargar PDF ({filteredSubmissions.length})</span>
                            </button>
                        </div>

                        {/* Filters */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <input
                                type="text"
                                placeholder="Buscar por nombre, apellido o DNI..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="p-2 border border-slate-300 rounded-md text-sm"
                            />
                            <select value={selectedTraining} onChange={e => setSelectedTraining(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm bg-white">
                                <option value="">Todas las Capacitaciones</option>
                                {data.trainings?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm bg-white">
                                <option value="">Todas las Empresas</option>
                                {/* Unique companies */}
                                {[...new Set(data.submissions?.map(s => s.company) || [])].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        
                        {/* Submissions Table */}
                        <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-200 rounded-lg">
                             <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Asistente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacitación</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-slate-900">{sub.lastName}, {sub.firstName}</div>
                                                <div className="text-xs text-slate-500">DNI: {sub.dni}</div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{sub.trainingName}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{sub.company}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{new Date(sub.timestamp).toLocaleString('es-ES')}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => generateSingleSubmissionPdf(sub, data.adminConfig?.signature || null, data.adminConfig?.clarification || '', data.adminConfig?.jobTitle || '')} disabled={!data.adminConfig?.signature} title="Descargar Certificado" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md disabled:opacity-30"><FileText size={16}/></button>
                                                    <button onClick={() => handleDeleteSubmission(sub.id)} title="Eliminar Registro" className="p-1.5 text-red-500 hover:bg-red-100 rounded-md"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-sm text-slate-500">
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
            
             {/* Modals */}
            <Modal isOpen={isConfigModalOpen} onClose={() => setConfigModalOpen(false)} title="Configurar Datos del Administrador">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="adminClarification" className="block text-sm font-medium text-slate-700 mb-1">Aclaración de Firma</label>
                        <input type="text" id="adminClarification" defaultValue={data.adminConfig?.clarification} className="w-full p-2 border border-slate-300 rounded-md" placeholder="Nombre y Apellido"/>
                    </div>
                     <div>
                        <label htmlFor="adminJobTitle" className="block text-sm font-medium text-slate-700 mb-1">Cargo / Puesto</label>
                        <input type="text" id="adminJobTitle" defaultValue={data.adminConfig?.jobTitle} className="w-full p-2 border border-slate-300 rounded-md" placeholder="Ej: Gerente de RRHH"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Firma Digital</label>
                         {data.adminConfig?.signature && (
                            <div className="mb-2 p-2 border rounded-md bg-slate-50 flex items-center justify-center">
                                <img src={data.adminConfig.signature} alt="Firma guardada" className="h-20"/>
                            </div>
                        )}
                        <SignaturePad onSave={() => {}} onClear={() => {}} sigCanvasRef={adminSigCanvasRef} />
                    </div>
                    <div className="flex justify-end pt-4">
                         <button onClick={handleUpdateConfig} disabled={isSaving} className="flex items-center justify-center w-32 h-10 px-4 py-2 font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-700 transition disabled:bg-slate-400">
                            {isSaving ? <Spinner size={5}/> : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isTrainingModalOpen} onClose={() => {setTrainingModalOpen(false); setCurrentTraining(null);}} title={currentTraining?.id ? 'Editar Capacitación' : 'Nueva Capacitación'}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="trainingName" className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Capacitación</label>
                        <input type="text" id="trainingName" defaultValue={currentTraining?.name} className="w-full p-2 border border-slate-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Enlaces</label>
                        <div className="space-y-2">
                        {(currentTraining?.links || []).map((link, index) => (
                            <div key={link.id || index} className="flex items-center space-x-2">
                                <input type="text" placeholder="Nombre del enlace (Opcional)" value={link.name} onChange={(e) => {
                                    if(currentTraining){
                                        const newLinks = [...currentTraining.links];
                                        newLinks[index].name = e.target.value;
                                        setCurrentTraining({...currentTraining, links: newLinks});
                                    }
                                }} className="flex-grow p-2 border border-slate-300 rounded-md text-sm" />
                                <input type="url" placeholder="https://ejemplo.com" value={link.url} onChange={(e) => {
                                      if(currentTraining){
                                        const newLinks = [...currentTraining.links];
                                        newLinks[index].url = e.target.value;
                                        setCurrentTraining({...currentTraining, links: newLinks});
                                    }
                                }} required className="flex-grow p-2 border border-slate-300 rounded-md text-sm" />
                                <button type="button" onClick={() => removeLink(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition"><Trash2 size={16}/></button>
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
                        }} className="mt-2 flex items-center space-x-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
                            <PlusCircle size={16}/><span>Añadir Enlace</span>
                        </button>
                    </div>
                    <div className="flex justify-end pt-4">
                         <button onClick={handleSaveTraining} disabled={isSaving} className="flex items-center justify-center w-32 h-10 px-4 py-2 font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-700 transition disabled:bg-slate-400">
                             {isSaving ? <Spinner size={5}/> : 'Guardar'}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isShareModalOpen} onClose={() => setShareModalOpen(false)} title="Compartir Capacitación">
                <div className="space-y-4 text-center">
                    <p className="text-slate-600">Usa el siguiente enlace o código QR para que los asistentes se registren:</p>
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="mx-auto my-4 border-4 border-slate-200 rounded-lg"/>}
                    <div className="flex items-center w-full bg-slate-100 p-2 rounded-md border border-slate-200">
                        <input type="text" value={shareableLink} readOnly className="flex-grow bg-transparent text-sm text-slate-700 outline-none"/>
                        <button onClick={() => { navigator.clipboard.writeText(shareableLink); alert('Enlace copiado!'); }} className="p-2 text-slate-500 hover:bg-slate-200 rounded-md"><Copy size={16}/></button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- USER PORTAL COMPONENTS ---

const UserForm: React.FC<{ training: Training; onSubmit: (submission: Omit<UserSubmission, 'id' | 'timestamp'>) => Promise<void> }> = ({ training, onSubmit }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dni, setDni] = useState('');
    const [company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const sigCanvasRef = useRef<SignatureCanvas>(null);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !lastName || !dni || !company) {
            alert('Por favor, complete todos los campos obligatorios: Nombre, Apellido, DNI y Empresa.');
            return;
        }
        if (!signature) {
            alert('La firma es obligatoria para completar el registro.');
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
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" required className="p-3 border border-slate-300 rounded-lg w-full"/>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" required className="p-3 border border-slate-300 rounded-lg w-full"/>
                <input type="text" value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI" required className="p-3 border border-slate-300 rounded-lg w-full"/>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Empresa" required className="p-3 border border-slate-300 rounded-lg w-full"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Opcional)" className="p-3 border border-slate-300 rounded-lg w-full"/>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono (Opcional)" className="p-3 border border-slate-300 rounded-lg w-full"/>
            </div>

            <div>
                 <h3 className="text-lg font-semibold text-slate-800 mb-2">Firma Digital</h3>
                 <SignaturePad 
                    sigCanvasRef={sigCanvasRef} 
                    onSave={setSignature} 
                    onClear={() => setSignature(null)}
                />
            </div>
            
            <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 transition disabled:bg-slate-400">
                {isSubmitting ? <Spinner size={6} /> : <Send size={20}/>}
                <span>{isSubmitting ? 'Enviando...' : 'Finalizar y Enviar Registro'}</span>
            </button>
        </form>
    );
};

const UserPortal: React.FC<{ training: Training; onBackToHome: () => void }> = ({ training, onBackToHome }) => {
    const [links, setLinks] = useState<TrainingLink[]>(training.links.map(l => ({ ...l, viewed: false })));
    const [allLinksViewed, setAllLinksViewed] = useState(false);
    const [submissionComplete, setSubmissionComplete] = useState(false);

    useEffect(() => {
        setAllLinksViewed(links.every(link => link.viewed));
    }, [links]);

    const handleLinkClick = (linkId: string) => {
        setLinks(prevLinks => prevLinks.map(link => link.id === linkId ? { ...link, viewed: true } : link));
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
            const uniqueCompanies = [...new Set([...(data.companies || []), fullSubmission.company])];
            
            await apiService._putData({ ...data, submissions: updatedSubmissions, companies: uniqueCompanies });
            
            setSubmissionComplete(true);
        } catch (e) {
            console.error("Failed to submit user data", e);
            throw e; // Re-throw to be caught by the form handler
        }
    };
    
    if (submissionComplete) {
        return (
            <div className="text-center py-20 px-4">
                 <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                <h2 className="text-3xl font-bold text-slate-800 mb-2">¡Registro Completado!</h2>
                <p className="text-slate-600 max-w-md mx-auto">Gracias por completar la capacitación. Sus datos han sido enviados correctamente.</p>
                <button onClick={onBackToHome} className="mt-8 flex items-center justify-center mx-auto space-x-2 bg-slate-800 text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-700 transition">
                    <ArrowLeft size={18}/><span>Volver al Inicio</span>
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <header className="text-center mb-8">
                <GraduationCap size={48} className="mx-auto text-slate-800 mb-2"/>
                <h1 className="text-4xl font-extrabold text-slate-800">{training.name}</h1>
                <p className="text-slate-500 mt-2">Siga los pasos a continuación para completar su registro.</p>
            </header>

            <section className="bg-white p-6 rounded-xl shadow-md mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center"><ClipboardList size={24} className="mr-2"/>Paso 1: Ver el material</h2>
                <p className="text-slate-600 mb-4">Haga clic en cada enlace para ver el contenido. Se marcarán como vistos automáticamente.</p>
                <div className="space-y-3">
                    {links.map(link => (
                        <a 
                            key={link.id} 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={() => handleLinkClick(link.id)}
                            className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group"
                        >
                            <span className="font-semibold text-slate-700">{link.name || link.url}</span>
                             <div className="flex items-center space-x-3">
                                {link.viewed ? (
                                    <span className="flex items-center text-xs font-bold text-green-600"><CheckCircle size={16} className="mr-1"/>Visto</span>
                                ) : (
                                    <span className="flex items-center text-xs font-bold text-slate-500"><Eye size={16} className="mr-1"/>Pendiente</span>
                                )}
                                <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors"/>
                            </div>
                        </a>
                    ))}
                </div>
            </section>
            
            {allLinksViewed && (
                <section className="bg-white p-6 rounded-xl shadow-md animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center"><User size={24} className="mr-2"/>Paso 2: Registrar sus datos</h2>
                    <p className="text-slate-600 mb-4">Una vez visto todo el material, por favor complete el siguiente formulario con sus datos y firme para confirmar su asistencia.</p>
                    <UserForm training={training} onSubmit={handleUserSubmit} />
                </section>
            )}

            <button onClick={onBackToHome} className="mt-12 flex items-center justify-center mx-auto space-x-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
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
        if (password === 'admin') {
            onLogin();
        } else {
            setError('Contraseña incorrecta.');
            setPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                     <ShieldCheck size={48} className="mx-auto text-slate-800 mb-2"/>
                    <h1 className="text-3xl font-bold text-slate-800">Acceso de Administrador</h1>
                    <p className="text-slate-500 mt-1">Ingrese la contraseña para continuar.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className={`w-full p-3 pr-10 border rounded-lg ${error ? 'border-red-500' : 'border-slate-300'}`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                    </div>
                    <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 transition">
                         <LogIn size={20}/>
                        <span>Ingresar</span>
                    </button>
                </form>

                 <div className="text-center mt-8">
                    <button onClick={onUserView} className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition">
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
    const [error, setError] = useState<string | null>(null);

    const loadSharedTraining = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const trainingKey = urlParams.get('trainingKey');
        
        if (trainingKey) {
            try {
                const fetchedTraining = await apiService.getSharedTraining(trainingKey);
                if (fetchedTraining) {
                    setTraining(fetchedTraining);
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
        // Clear URL params and reload to go to the home/login screen
        window.history.pushState({}, document.title, window.location.pathname);
        setTraining(null);
        setError(null);
        setIsLoadingTraining(false); // Make sure we don't show a loader
    };
    
    useEffect(() => {
        // Check if user was previously logged in
        if (localStorage.getItem('isAdmin') === 'true') {
            setIsAdmin(true);
        }
    }, []);

    if (isLoadingTraining) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
                <Spinner size={12} />
                <p className="mt-4 text-slate-600">Cargando capacitación...</p>
            </div>
        );
    }
    
     if (training) {
        return <UserPortal training={training} onBackToHome={resetToHome} />;
    }

    if(error){
         return (
             <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-4 text-center">
                 <X size={48} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-red-800 mb-2">Error al Cargar</h2>
                <p className="text-slate-600 max-w-md">{error}</p>
                 <button onClick={resetToHome} className="mt-8 flex items-center justify-center mx-auto space-x-2 bg-slate-800 text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-700 transition">
                    <ArrowLeft size={18}/><span>Volver al Inicio</span>
                </button>
            </div>
         )
    }

    if (isAdmin) {
        return <AdminDashboard onLogout={handleLogout} />;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg text-center">
                 <QrCode size={48} className="mx-auto text-slate-800 mb-2"/>
                 <h1 className="text-3xl font-bold text-slate-800">Portal de Capacitaciones</h1>
                <p className="text-slate-500 mt-2">
                    Si eres un asistente, por favor utiliza el código QR o el enlace proporcionado por el administrador para acceder a la capacitación.
                </p>
                <div className="mt-8 border-t border-slate-300 pt-8">
                    <button onClick={() => setIsAdmin(true)} className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition">
                        ¿Eres el administrador? Inicia sesión aquí
                    </button>
                </div>
            </div>
        </div>
    );

};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);