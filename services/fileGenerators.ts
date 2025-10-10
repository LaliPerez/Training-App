import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserSubmission } from '../types';

// Extend the jsPDF type to include the autoTable method from the plugin
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const generateSubmissionsPdf = (submissions: UserSubmission[], adminSignature: string): void => {
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

  // Add new page for signature if there is not enough space
  if (signatureY + 45 > pageHeight) {
    doc.addPage();
    signatureY = 20;
  }

  doc.setFontSize(10);
  doc.text('Constancia de registro de asistencia emitida por el administrador:', 14, signatureY);

  try {
    if (adminSignature) {
      doc.addImage(adminSignature, 'PNG', 14, signatureY + 5, 60, 30);
    }
  } catch(e) {
    doc.text('No se pudo cargar la imagen de la firma.', 14, signatureY + 10);
    console.error("Error adding admin signature image to PDF: ", e);
  }

  doc.save('constancia_asistencia.pdf');
};