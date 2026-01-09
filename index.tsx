
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { 
  ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, 
  Trash2, Edit, X, Share2, Copy, Eye, FileText, 
  CheckCircle, ArrowLeft, Send, GraduationCap, 
  Building, ArrowRight, QrCode, Download, CopyPlus, 
  Briefcase, History, Settings, Tag
} from 'lucide-react';

// --- CONFIGURACIÓN ---
const JSONBIN_BIN_ID = '68fa221e43b1c97be97a84f2'; 
const JSONBIN_MASTER_KEY = '$2a$10$CGBmrjbO1PM5CPstFtwXN.PMvfkyYUpEb9rGtO5rJZBLuEtAfWQ7i';
const ADMIN_PASSWORD = 'admin2025';

type ToastType = 'success' | 'error' | 'info';

// --- TYPES ---
interface TrainingLink {
  id: string;
  name: string;
  url: string;
}

interface Training {
  id: string;
  name: string;
  links: TrainingLink[];
  shareKey: string;
  companies?: string[]; 
}

interface Company {
    id: string;
    name: string;
    cuit?: string;
}

interface UserSubmission {
  id: string;
  trainingId: string;
  trainingName: string;
  firstName: string;
  lastName: string;
  dni: string;
  company: string; 
  signature: string; 
  timestamp: string;
}

interface AdminConfig {
  signature: string | null;
  clarification: string;
  jobTitle: string;
}

interface AppData {
  submissions: UserSubmission[];
  adminConfig: AdminConfig;
  trainings: Training[];
  companies: Company[];
}

// --- API SERVICE ---
const apiService = {
  getData: async (): Promise<AppData> => {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY },
      });
      const json = await response.json();
      const d = json.record;
      return {
          submissions: d.submissions || [],
          adminConfig: d.adminConfig || { signature: null, clarification: '', jobTitle: '' },
          trainings: d.trainings || [],
          companies: d.companies || [],
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  saveData: async (data: AppData): Promise<void> => {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
      },
      body: JSON.stringify(data),
    });
  }
};

// --- PDF GENERATOR ---
const pdfService = {
  generateCertificate: (sub: UserSubmission, config: AdminConfig) => {
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, width, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE ASISTENCIA', width/2, 28, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Se deja constancia que:', width/2, 65, { align: 'center' });
    
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sub.lastName.toUpperCase()}, ${sub.firstName}`, width/2, 80, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`DNI: ${sub.dni} | Empresa: ${sub.company}`, width/2, 90, { align: 'center' });

    doc.setFontSize(14);
    doc.text('Ha completado exitosamente la capacitación de:', width/2, 110, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`"${sub.trainingName}"`, width/2, 125, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Emitido el día: ${new Date(sub.timestamp).toLocaleDateString()}`, width/2, 140, { align: 'center' });

    if (config.signature) {
      doc.addImage(config.signature, 'PNG', 40, 165, 40, 20);
      doc.line(30, 185, 90, 185);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(config.clarification, 60, 192, { align: 'center' });
      doc.setFontSize(8);
      doc.text(config.jobTitle, 60, 197, { align: 'center' });
    }

    if (sub.signature) {
      doc.addImage(sub.signature, 'PNG', 130, 165, 40, 20);
      doc.line(120, 185, 180, 185);
      doc.setFontSize(10);
      doc.text('Firma del Asistente', 150, 192, { align: 'center' });
    }

    doc.save(`Certificado_${sub.dni}_${sub.trainingId}.pdf`);
  },

  generateGeneralReport: (submissions: UserSubmission[], trainingName: string, config: AdminConfig) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Planilla de Asistencia: ${trainingName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Instructor: ${config.clarification} - ${new Date().toLocaleDateString()}`, 14, 28);

    const body = submissions.map((s, i) => [
      i + 1,
      `${s.lastName}, ${s.firstName}`,
      s.dni,
      s.company,
      new Date(s.timestamp).toLocaleString(),
      ''
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Apellido y Nombre', 'DNI', 'Empresa', 'Fecha/Hora', 'Firma']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      didDrawCell: (data) => {
        if (data.column.index === 5 && data.cell.section === 'body') {
          const s = submissions[data.row.index];
          if (s.signature) {
            doc.addImage(s.signature, 'PNG', data.cell.x