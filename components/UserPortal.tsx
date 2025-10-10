import React, { useState, useMemo, useRef } from 'react';
import type { Training, TrainingLink, UserSubmission } from '../types';
import { FileText, CheckCircle, ArrowLeft, Send } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import SignaturePad from './SignaturePad';

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
          ? {
              ...t,
              links: t.links.map(l =>
                l.id === linkId ? { ...l, viewed: true } : l
              ),
            }
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
        <div className="text-center p-8 bg-white rounded-lg shadow-xl">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-800">¡Capacitación Completada!</h2>
            <p className="mt-2 text-gray-600">Gracias por enviar tu información. Ya puedes cerrar esta ventana.</p>
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
        <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
            <button onClick={() => setSelectedTrainingId(null)} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedTraining.name}</h2>
            <p className="text-gray-600 mb-4">Por favor, haz clic en todos los enlaces para marcarlos como vistos. Una vez completado, podrás cargar tus datos.</p>
            
            <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-sm text-right text-gray-500 mt-1">{Math.round(progress)}% completado</p>
            </div>

            <div className="space-y-3 mb-8">
                {selectedTraining.links.map(link => (
                    <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(selectedTraining.id, link.id)}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${link.viewed ? 'bg-green-50 border-green-300 text-gray-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center">
                            <FileText className="h-5 w-5 mr-3 text-indigo-500"/>
                            <span className="font-medium">{link.url}</span>
                        </div>
                        {link.viewed && <CheckCircle className="h-6 w-6 text-green-500" />}
                    </a>
                ))}
            </div>

            {allLinksViewed && (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                     <h3 className="text-xl font-semibold text-gray-800 border-t pt-6">Completa tus datos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input type="text" name="firstName" placeholder="Nombre" onChange={handleInputChange} required className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="lastName" placeholder="Apellido" onChange={handleInputChange} required className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="dni" placeholder="DNI" onChange={handleInputChange} required className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="text" name="company" placeholder="Empresa" onChange={handleInputChange} required className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="email" name="email" placeholder="Email (Opcional)" onChange={handleInputChange} className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                        <input type="tel" name="phone" placeholder="Teléfono (Opcional)" onChange={handleInputChange} className="p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Firma Digital (Obligatorio)</label>
                         <SignaturePad onSignatureEnd={handleSignatureEnd} signatureRef={signatureRef} />
                        <button type="button" onClick={clearSignature} className="text-sm text-indigo-600 hover:underline mt-2">Limpiar firma</button>
                    </div>
                    <button 
                        type="submit" 
                        disabled={!formData.signature}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
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
      <button onClick={onBack} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
      </button>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Capacitaciones Disponibles</h1>
        <p className="mt-2 text-gray-600">Selecciona una capacitación para comenzar.</p>
      </div>
      <div className="space-y-4">
        {trainings.length > 0 ? (
          trainings.map(training => (
            <button
              key={training.id}
              onClick={() => setSelectedTrainingId(training.id)}
              className="w-full text-left p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200"
            >
              <h3 className="text-xl font-semibold text-indigo-700">{training.name}</h3>
              <p className="text-gray-500 mt-1">{training.links.length} enlace(s)</p>
            </button>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No hay capacitaciones disponibles en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPortal;
