export interface TrainingLink {
  id: string;
  url: string;
  viewed: boolean;
}

export interface Training {
  id:string;
  name: string;
  links: TrainingLink[];
}

export interface UserSubmission {
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
