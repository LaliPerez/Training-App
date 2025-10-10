import React, { useState, useEffect, useRef } from 'react';
import type { Training, UserSubmission } from '../types';
import { generateSubmissionsPdf } from '../services/fileGenerators';
import { PlusCircle, Users, FileDown, LogOut, Trash2, Edit, X, Share2, Copy, Eye } from 'lucide-react';
import SignaturePad from './SignaturePad';
import SignatureCanvas from 'react-signature-canvas';

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
  const [copySuccess, setCopySuccess] = useState('');
  
  const [selectedSubmission, setSelectedSubmission] = useState<UserSubmission | null>(null);

  const [adminSignature, setAdminSignature] = useState<string | null>(null);
  const [showAdminSignatureModal, setShowAdminSignatureModal] = useState(false);
  const adminSignatureRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const savedSignature = localStorage.getItem('adminSignature');
    if (savedSignature) {
      setAdminSignature(savedSignature);
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

  const handleShare = () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(trainings))));
    const link = `${window.location.origin}${window.location.pathname}?data=${data}`;
    setShareableLink(link);
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
    const userViewUrl = `${window.location.origin}${window.location.pathname}?view=user`;
    window.open(userViewUrl, '_blank');
  };

  const handleSaveAdminSignature = () => {
    if (adminSignatureRef.current) {
      if (adminSignatureRef.current.isEmpty()) {
          alert("Por favor, dibuja tu firma antes de guardar.");
          return;
      }
      const signatureDataUrl = adminSignatureRef.current.toDataURL();
      setAdminSignature(signatureDataUrl);
      localStorage.setItem('adminSignature', signatureDataUrl);
      setShowAdminSignatureModal(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Panel de Administrador</h1>
        <button onClick={onLogout} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
          <LogOut className="h-4 w-4 mr-2"/>
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Crear Nueva Capacitación</h2>
            <form onSubmit={handleAddTraining} className="space-y-4">
              <div>
                <label htmlFor="trainingName" className="block text-sm font-medium text-gray-700">Nombre de la Capacitación</label>
                <input
                  id="trainingName"
                  type="text"
                  value={trainingName}
                  onChange={(e) => setTrainingName(e.target.value)}
                  placeholder="Ej: Inducción de Seguridad"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="links" className="block text-sm font-medium text-gray-700">Enlaces (uno por línea)</label>
                <textarea
                  id="links"
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  rows={4}
                  placeholder="https://ejemplo.com/link1&#10;https://ejemplo.com/link2"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                {feedback && <p className="text-sm text-green-600">{feedback}</p>}
              </div>
            </form>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">Gestionar Capacitaciones</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={openUserView}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        Vista de Usuario
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={trainings.length === 0}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartir
                    </button>
                </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trainings.length > 0 ? (
                trainings.map(training => (
                  <div key={training.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <span className="font-medium text-gray-800">{training.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingTraining(training)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteTraining(training.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors">
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

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-gray-700">Usuarios Registrados</h2>
              <div className="flex gap-2 flex-wrap items-center">
                  <button 
                    onClick={() => setShowAdminSignatureModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <Edit className="h-4 w-4 mr-2" />
                    {adminSignature ? 'Cambiar Firma' : 'Configurar Firma'}
                </button>
                {adminSignature && (
                    <img src={adminSignature} alt="Admin signature preview" className="h-10 w-20 object-contain border rounded-md bg-gray-50 p-1" />
                )}
                  <button
                  onClick={() => generateSubmissionsPdf(userSubmissions, adminSignature!)}
                  disabled={userSubmissions.length === 0 || !adminSignature}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                  <FileDown className="h-5 w-5 mr-2" />
                  Descargar Constancia
                  </button>
              </div>
          </div>
          
          <div className="overflow-x-auto">
            {userSubmissions.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DNI</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacitación</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userSubmissions.map((sub) => (
                    <tr key={sub.id} onClick={() => setSelectedSubmission(sub)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.firstName} {sub.lastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.dni}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.trainingName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Aún no hay registros de usuarios.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {editingTraining && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-semibold text-gray-800">Editar Capacitación</h2>
               <button onClick={() => setEditingTraining(null)} className="p-1 text-gray-500 hover:text-gray-800">
                 <X className="h-6 w-6" />
               </button>
             </div>
             <form onSubmit={handleUpdateTraining} className="space-y-4">
              <div>
                <label htmlFor="editedName" className="block text-sm font-medium text-gray-700">Nombre de la Capacitación</label>
                <input id="editedName" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="editedLinks" className="block text-sm font-medium text-gray-700">Enlaces (uno por línea)</label>
                <textarea id="editedLinks" value={editedLinksText} onChange={(e) => setEditedLinksText(e.target.value)} rows={5} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                 <button type="button" onClick={() => setEditingTraining(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
                 <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Guardar Cambios</button>
              </div>
             </form>
           </div>
         </div>
      )}

      {showShareModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg text-center">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-semibold text-gray-800">Compartir Capacitaciones</h2>
               <button onClick={() => setShowShareModal(false)} className="p-1 text-gray-500 hover:text-gray-800"><X className="h-6 w-6" /></button>
             </div>
             <p className="text-gray-600 mb-4">Copia y envía este enlace a tus usuarios. Al abrirlo, se cargarán todas las capacitaciones.</p>
             <div className="relative">
                <input type="text" value={shareableLink} readOnly className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 pr-10 text-sm"/>
                <button onClick={copyToClipboard} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 hover:text-indigo-600"><Copy className="h-5 w-5" /></button>
             </div>
             {copySuccess && <p className="text-green-600 text-sm mt-2">{copySuccess}</p>}
           </div>
         </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Detalles del Registro</h2>
              <button onClick={() => setSelectedSubmission(null)} className="p-1 text-gray-500 hover:text-gray-800"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-3 text-sm">
                <p><strong>Capacitación:</strong> {selectedSubmission.trainingName}</p>
                <p><strong>Nombre:</strong> {selectedSubmission.firstName} {selectedSubmission.lastName}</p>
                <p><strong>DNI:</strong> {selectedSubmission.dni}</p>
                <p><strong>Empresa:</strong> {selectedSubmission.company}</p>
                <p><strong>Email:</strong> {selectedSubmission.email || 'N/A'}</p>
                <p><strong>Teléfono:</strong> {selectedSubmission.phone || 'N/A'}</p>
                <p><strong>Fecha:</strong> {selectedSubmission.timestamp}</p>
                <div>
                    <p><strong>Firma:</strong></p>
                    <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                        <img src={selectedSubmission.signature} alt="Firma digital del usuario" className="mx-auto"/>
                    </div>
                </div>
            </div>
             <div className="flex justify-end pt-4">
                 <button type="button" onClick={() => setSelectedSubmission(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cerrar</button>
              </div>
          </div>
        </div>
      )}

      {showAdminSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Firma del Administrador</h2>
                <button onClick={() => setShowAdminSignatureModal(false)} className="p-1 text-gray-500 hover:text-gray-800">
                    <X className="h-6 w-6" />
                </button>
                </div>
                <p className="text-sm text-gray-600 mb-2">Dibuja tu firma en el recuadro. Esta firma se incluirá en el PDF de constancia.</p>
                <SignaturePad signatureRef={adminSignatureRef} onSignatureEnd={() => {}} />
                <div className="flex justify-between items-center mt-4">
                <button
                    type="button"
                    onClick={() => adminSignatureRef.current?.clear()}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                    Limpiar
                </button>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setShowAdminSignatureModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
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

export default AdminDashboard;