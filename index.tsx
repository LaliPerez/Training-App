
// FIX: Removed invalid file markers from the beginning and end of the file.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'qrcode';
import { ShieldCheck, User, PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye, FileText, CheckCircle, ArrowLeft, Send, LogIn, RefreshCw, Award, ClipboardList, GraduationCap, Building } from 'lucide-react';

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
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/1251394142642536448';

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
      return { submissions: [], adminConfig: { signature: null, clarification: '', jobTitle: '' }, sharedTrainings: {}, trainings: [], companies: [] }; // Return default structure on error
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
  
  getCompanies: async (): Promise<string[]> => {
    const data = await apiService._getData();
    return data.companies || [];
  },

  updateCompanies: async (companies: string[]): Promise<void> => {
    const data = await apiService._getData();
    const updatedData = { ...data, companies };
    
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
      