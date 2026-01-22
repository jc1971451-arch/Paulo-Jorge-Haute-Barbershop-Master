
export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
  image: string;
}

export interface Stylist {
  id: string;
  name: string;
  role: string;
  specialty: string;
  bio: string;
  avatar: string;
  email?: string; // Email para login profissional
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isLoggedIn: boolean;
  role: 'client' | 'staff' | 'admin';
}

export interface Booking {
  id: string;
  service: Service;
  stylist: Stylist;
  date: Date;
  status: 'confirmed' | 'completed' | 'cancelled';
  clientName?: string;
  clientPhone?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'confirmation' | 'reminder';
  date: Date;
  read: boolean;
}
