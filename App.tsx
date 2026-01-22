
import React, { useState, useEffect, createContext, useContext, useRef, useMemo, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { SERVICES as INITIAL_SERVICES, STYLISTS as INITIAL_STYLISTS } from './constants';
import { User, Notification, Booking, Service, Stylist } from './types';
import LiveAssistant from './components/LiveAssistant';

// --- Contexts ---

interface ThemeContextType { theme: 'light' | 'dark'; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('pj_theme_v6') as 'light' | 'dark') || 'dark');
  const toggleTheme = () => setTheme(prev => {
    const next = prev === 'light' ? 'dark' : 'light';
    localStorage.setItem('pj_theme_v6', next);
    return next;
  });
  return <ThemeContext.Provider value={{ theme, toggleTheme }}><div className={theme === 'dark' ? 'dark' : ''}>{children}</div></ThemeContext.Provider>;
};
export const useTheme = () => { const context = useContext(ThemeContext); if (!context) throw new Error('useTheme must be used within ThemeProvider'); return context; };

interface NotificationContextType { 
  notifications: Notification[]; 
  addNotification: (notif: Omit<Notification, 'id' | 'date' | 'read'>) => void; 
  markAsRead: (id: string) => void; 
  unreadCount: number; 
}
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const addNotification = (notif: Omit<Notification, 'id' | 'date' | 'read'>) => setNotifications(prev => [{ ...notif, id: Math.random().toString(36).substr(2, 9), date: new Date(), read: false }, ...prev]);
  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const unreadCount = notifications.filter(n => !n.read).length;
  return <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, unreadCount }}>{children}</NotificationContext.Provider>;
};
export const useNotifications = () => { const context = useContext(NotificationContext); if (!context) throw new Error('useNotifications must be used within NotificationProvider'); return context; };

interface AuthContextType { 
  user: User | null; 
  login: (email: string, pass: string, isPro: boolean) => { success: boolean, message?: string }; 
  register: (name: string, email: string, phone: string, pass: string) => void;
  logout: () => void; 
  isAdmin: boolean;
  isStaff: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try { const saved = localStorage.getItem('pj_user_v6'); return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);
  const isStaff = useMemo(() => user?.role === 'staff' || user?.role === 'admin', [user]);

  const login = (email: string, pass: string, isPro: boolean) => {
    const cleanEmail = email.trim().toLowerCase();
    let role: 'client' | 'staff' | 'admin' = 'client';
    let name = cleanEmail.split('@')[0];

    if (isPro) {
      if (cleanEmail === 'admin@paulojorge.pt') {
        if (pass === 'MASTER2025') {
            role = 'admin';
            name = 'Paulo Jorge';
        } else {
            return { success: false, message: 'Palavra-passe mestra incorreta.' };
        }
      } else {
        role = 'staff';
        name = `Staff ${name}`;
      }
    }

    const newUser: User = { id: Date.now().toString(), name, email: cleanEmail, isLoggedIn: true, role };
    setUser(newUser);
    localStorage.setItem('pj_user_v6', JSON.stringify(newUser));
    return { success: true };
  };

  const register = (name: string, email: string, phone: string, pass: string) => {
    const newUser: User = { id: Date.now().toString(), name, email: email.toLowerCase(), phone, isLoggedIn: true, role: 'client' };
    setUser(newUser);
    localStorage.setItem('pj_user_v6', JSON.stringify(newUser));
  };

  const logout = () => { setUser(null); localStorage.removeItem('pj_user_v6'); };
  return <AuthContext.Provider value={{ user, login, register, logout, isAdmin, isStaff }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context; };

interface ShopContextType {
  stylists: Stylist[];
  services: Service[];
  timeSlots: string[];
  updateStylist: (id: string, data: Partial<Stylist>) => void;
  addStylist: (s: Stylist) => void;
  removeStylist: (id: string) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  resetToDefaults: () => void;
}
const ShopContext = createContext<ShopContextType | undefined>(undefined);
export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stylists, setStylists] = useState<Stylist[]>(() => {
    try { const saved = localStorage.getItem('pj_stylists_v6'); return saved ? JSON.parse(saved) : INITIAL_STYLISTS; } catch(e) { return INITIAL_STYLISTS; }
  });
  const [services, setServices] = useState<Service[]>(() => {
    try { const saved = localStorage.getItem('pj_services_v6'); return saved ? JSON.parse(saved) : INITIAL_SERVICES; } catch(e) { return INITIAL_SERVICES; }
  });
  const [timeSlots] = useState(['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']);

  useEffect(() => { localStorage.setItem('pj_stylists_v6', JSON.stringify(stylists)); }, [stylists]);
  useEffect(() => { localStorage.setItem('pj_services_v6', JSON.stringify(services)); }, [services]);

  const updateStylist = (id: string, data: Partial<Stylist>) => setStylists(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const addStylist = (s: Stylist) => setStylists(prev => [...prev, s]);
  const removeStylist = (id: string) => setStylists(prev => prev.filter(s => s.id !== id));
  const updateService = (id: string, data: Partial<Service>) => setServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const resetToDefaults = () => { setStylists(INITIAL_STYLISTS); setServices(INITIAL_SERVICES); };

  return <ShopContext.Provider value={{ stylists, services, timeSlots, updateStylist, addStylist, removeStylist, updateService, resetToDefaults }}>{children}</ShopContext.Provider>;
};
export const useShop = () => { const context = useContext(ShopContext); if (!context) throw new Error('useShop must be used within ShopProvider'); return context; };

interface BookingContextType { bookings: Booking[]; addBooking: (service: Service, stylist: Stylist, date: Date, clientName: string) => void; cancelBooking: (id: string) => void; }
const BookingContext = createContext<BookingContextType | undefined>(undefined);
export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try { 
      const saved = localStorage.getItem('pj_bookings_v6'); 
      return saved ? JSON.parse(saved).map((b: any) => ({ ...b, date: new Date(b.date) })) : []; 
    } catch(e) { return []; }
  });
  const addBooking = (service: Service, stylist: Stylist, date: Date, clientName: string) => {
    const newBooking: Booking = { id: Math.random().toString(36).substr(2, 6), service, stylist, date, status: 'confirmed', clientName };
    setBookings(prev => [newBooking, ...prev]);
  };
  useEffect(() => { localStorage.setItem('pj_bookings_v6', JSON.stringify(bookings)); }, [bookings]);
  const cancelBooking = (id: string) => setBookings(prev => prev.filter(b => b.id !== id));
  return <BookingContext.Provider value={{ bookings, addBooking, cancelBooking }}>{children}</BookingContext.Provider>;
};
export const useBookings = () => { const context = useContext(BookingContext); if (!context) throw new Error('useBookings must be used within BookingProvider'); return context; };

// --- Sub-components for Admin Panel to avoid full re-renders ---

const ServiceEditor: React.FC<{ service: Service, onUpdate: (id: string, data: any) => void }> = ({ service, onUpdate }) => {
    const [localService, setLocalService] = useState(service);
    const [isDirty, setIsDirty] = useState(false);

    const handleSave = () => {
        onUpdate(service.id, localService);
        setIsDirty(false);
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-[32px] border border-zinc-800 space-y-4">
            <div className="flex gap-4">
                <div className="w-20 h-20 relative flex-shrink-0">
                    <img src={localService.image} className="w-full h-full object-cover rounded-2xl" alt="" />
                    <button onClick={() => { const url = prompt('URL Imagem:', localService.image); if(url) setLocalService({...localService, image: url}); setIsDirty(true); }} className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl opacity-0 hover:opacity-100"><i className="fas fa-edit text-white"></i></button>
                </div>
                <div className="flex-1 space-y-2">
                    <input 
                        className="bg-zinc-950 w-full text-xs font-black text-white uppercase outline-none px-3 py-2 rounded-xl border border-zinc-800 focus:border-amber-500/40" 
                        value={localService.name} 
                        onChange={e => { setLocalService({...localService, name: e.target.value}); setIsDirty(true); }}
                    />
                    <textarea 
                        className="bg-zinc-950 w-full text-[9px] font-medium text-zinc-500 outline-none px-3 py-2 rounded-xl border border-zinc-800 focus:border-amber-500/40 h-12 resize-none" 
                        value={localService.description} 
                        onChange={e => { setLocalService({...localService, description: e.target.value}); setIsDirty(true); }}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[7px] font-black uppercase text-zinc-600 mb-1">Preço (€)</p>
                    <input 
                        type="number"
                        className="bg-transparent w-full text-xs font-black text-amber-500 outline-none" 
                        value={localService.price} 
                        onChange={e => { setLocalService({...localService, price: Number(e.target.value)}); setIsDirty(true); }}
                    />
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-[7px] font-black uppercase text-zinc-600 mb-1">Duração (min)</p>
                    <input 
                        className="bg-transparent w-full text-xs font-black text-zinc-400 outline-none" 
                        value={localService.duration} 
                        onChange={e => { setLocalService({...localService, duration: e.target.value}); setIsDirty(true); }}
                    />
                </div>
            </div>
            {isDirty && (
                <button onClick={handleSave} className="w-full bg-amber-500 text-black py-2 rounded-xl font-black text-[9px] uppercase tracking-widest animate-pulse">Guardar Alterações</button>
            )}
        </div>
    );
};

const StylistEditor: React.FC<{ stylist: Stylist, onUpdate: (id: string, data: any) => void, onRemove: (id: string) => void }> = ({ stylist, onUpdate, onRemove }) => {
    const [localStylist, setLocalStylist] = useState(stylist);
    const [isDirty, setIsDirty] = useState(false);

    const handleSave = () => {
        onUpdate(stylist.id, localStylist);
        setIsDirty(false);
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-[32px] border border-zinc-800 relative group">
            <button onClick={() => { if(confirm('Apagar barbeiro?')) onRemove(stylist.id); }} className="absolute -top-2 -right-2 w-8 h-8 bg-zinc-800 rounded-full text-zinc-600 hover:text-red-500 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash text-[10px]"></i></button>
            <div className="flex gap-4 mb-4">
                <div className="relative">
                    <img src={localStylist.avatar} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                    <button onClick={() => { const url = prompt('URL Imagem:', localStylist.avatar); if(url) setLocalStylist({...localStylist, avatar: url}); setIsDirty(true); }} className="absolute bottom-0 right-0 w-6 h-6 bg-amber-500 rounded-lg text-black flex items-center justify-center text-[10px]"><i className="fas fa-camera"></i></button>
                </div>
                <div className="flex-1 space-y-2">
                    <input 
                        className="bg-zinc-950 w-full text-xs font-black text-white uppercase outline-none px-3 py-2 rounded-xl border border-zinc-800" 
                        value={localStylist.name} 
                        onChange={e => { setLocalStylist({...localStylist, name: e.target.value}); setIsDirty(true); }}
                    />
                    <input 
                        className="bg-zinc-950 w-full text-[9px] font-medium text-amber-500 uppercase outline-none px-3 py-2 rounded-xl border border-zinc-800" 
                        value={localStylist.email || ''} 
                        placeholder="Email de Login"
                        onChange={e => { setLocalStylist({...localStylist, email: e.target.value}); setIsDirty(true); }}
                    />
                </div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 mb-4">
                <p className="text-[7px] font-black uppercase text-zinc-600 mb-1">Especialidade</p>
                <input 
                    className="bg-transparent w-full text-[10px] font-bold text-zinc-400 outline-none uppercase" 
                    value={localStylist.role} 
                    onChange={e => { setLocalStylist({...localStylist, role: e.target.value}); setIsDirty(true); }}
                />
            </div>
            {isDirty && (
                <button onClick={handleSave} className="w-full bg-amber-500 text-black py-2 rounded-xl font-black text-[9px] uppercase tracking-widest animate-pulse">Guardar Barbeiro</button>
            )}
        </div>
    );
};

// --- Main Components ---

const AdminPanel: React.FC = () => {
  const { stylists, services, updateStylist, addStylist, removeStylist, updateService, resetToDefaults } = useShop();
  const { bookings } = useBookings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'agenda' | 'equipa' | 'servicos'>('agenda');
  const navigate = useNavigate();

  const myBookings = useMemo(() => {
    if (user?.role === 'admin') return bookings;
    return bookings.filter(b => b.stylist.email === user?.email);
  }, [bookings, user]);

  return (
    <div className="min-h-screen bg-black text-white pb-32 animate-in fade-in duration-500">
      <header className="p-8 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-black/95 backdrop-blur-xl z-30">
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
        <div className="text-center">
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-amber-500">Master Control</h1>
            <p className="text-[8px] font-bold text-zinc-500 uppercase">Paulo Jorge Admin</p>
        </div>
        <button onClick={() => { if(confirm('Repor dados originais?')) { resetToDefaults(); window.location.reload(); }}} className="text-zinc-700 text-xs hover:text-white"><i className="fas fa-sync-alt"></i></button>
      </header>

      <div className="p-6">
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab('agenda')} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'agenda' ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>Agenda</button>
          {user?.role === 'admin' && (
            <>
                <button onClick={() => setActiveTab('equipa')} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'equipa' ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>Equipa</button>
                <button onClick={() => setActiveTab('servicos')} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'servicos' ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>Serviços</button>
            </>
          )}
        </div>

        {activeTab === 'agenda' && (
          <section className="space-y-4">
            <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 mb-6 flex justify-between items-center">
                <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Marcações</p>
                    <p className="text-2xl font-black text-amber-500">{myBookings.length}</p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Status</p>
                    <span className="text-[10px] text-green-500 font-black uppercase tracking-widest">Ativo</span>
                </div>
            </div>
            {myBookings.map(b => (
              <div key={b.id} className="bg-zinc-900 p-6 rounded-[32px] border border-zinc-800">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[9px] font-black uppercase text-amber-500 mb-1">{b.clientName || 'Cliente VIP'}</p>
                    <h3 className="text-sm font-bold uppercase italic">{b.service.name}</h3>
                    <p className="text-[7px] text-zinc-500 uppercase mt-1">Barbeiro: {b.stylist.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black leading-none">{b.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[7px] text-zinc-500 uppercase mt-1">{b.date.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'equipa' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mestres Barbeiros</h2>
                <button onClick={() => {
                  const name = prompt('Nome:');
                  if(name) addStylist({ id: 's'+Date.now(), name, role: 'Barber', email: 'staff@paulojorge.pt', specialty: 'Corte', bio: '', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200' });
                }} className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg"><i className="fas fa-plus"></i></button>
            </div>
            <div className="space-y-6">
              {stylists.map(s => <StylistEditor key={s.id} stylist={s} onUpdate={updateStylist} onRemove={removeStylist} />)}
            </div>
          </section>
        )}

        {activeTab === 'servicos' && (
          <section className="space-y-6">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">Menu de Serviços</h2>
            <div className="space-y-6">
              {services.map(ser => <ServiceEditor key={ser.id} service={ser} onUpdate={updateService} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  if (['/auth', '/admin'].includes(location.pathname)) return null;
  return (
    <header className="px-8 pt-16 pb-8 flex items-center justify-between bg-white dark:bg-black sticky top-0 z-30 transition-all duration-700">
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/perfil')}>
        <div className="w-14 h-14 rounded-[22px] border-2 border-amber-500 p-0.5 shadow-2xl shadow-amber-500/10">
          <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=200" className="w-full h-full object-cover rounded-[18px]" alt="" />
        </div>
        <div>
          <p className="text-[7px] font-black text-amber-500 uppercase tracking-[0.4em] mb-0.5 italic">Black Label</p>
          <h1 className="text-base font-black dark:text-white uppercase tracking-tighter leading-none">{user?.name?.split(' ')[0] || 'Member'}</h1>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={toggleTheme} className="w-12 h-12 rounded-[22px] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all"><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button>
      </div>
    </header>
  );
};

const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  if (['/auth', '/admin'].includes(pathname)) return null;
  const items = [
    { icon: 'fa-home', path: '/' }, 
    { icon: 'fa-cut', path: '/servicos' },
    { icon: 'fa-calendar-alt', path: '/agendamentos' }, 
    { icon: 'fa-user', path: '/perfil' }
  ];
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[85%] h-16 bg-black/95 backdrop-blur-2xl border border-white/5 rounded-[28px] flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-40 px-6">
      {items.map(i => (
        <button key={i.path} onClick={() => navigate(i.path)} className={`relative group transition-all duration-500 ${pathname === i.path ? 'text-amber-500 scale-125' : 'text-zinc-700'}`}>
          <i className={`fas ${i.icon} text-lg`}></i>
          {pathname === i.path && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>}
        </button>
      ))}
      {isStaff && (
          <button onClick={() => navigate('/admin')} className={`relative group transition-all duration-500 ${pathname === '/admin' ? 'text-amber-500 scale-125' : 'text-zinc-700'}`}>
              <i className="fas fa-tools text-lg"></i>
          </button>
      )}
    </div>
  );
};

const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [isProMode, setIsProMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isRegister) {
      register(name, email, phone, password);
      navigate('/');
    } else {
      const result = login(email, password, isProMode);
      if (result.success) {
          navigate('/');
      } else {
          setError(result.message || 'Credenciais inválidas.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-10 text-white relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img src="https://images.unsplash.com/photo-1512690118299-a91f0799d5c4?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover opacity-20 grayscale scale-150 blur-sm" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-amber-500 rounded-[28px] flex items-center justify-center mb-10 rotate-12 shadow-[0_15px_40px_rgba(245,158,11,0.2)]">
          <i className="fas fa-scissors text-black text-3xl"></i>
        </div>
        
        <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl mb-8 border border-zinc-800 w-full max-w-[280px]">
            <button onClick={() => { setIsProMode(false); setIsRegister(false); setError(''); }} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!isProMode && !isRegister ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500'}`}>Cliente</button>
            <button onClick={() => { setIsProMode(true); setIsRegister(false); setError(''); }} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isProMode ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500'}`}>Pro Area</button>
        </div>

        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-center leading-none">Paulo Jorge</h1>
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 text-center">
            {isProMode ? 'Acesso Administrativo' : (isRegister ? 'Novo Registo VIP' : 'The Barbershop Experience')}
        </p>

        {error && <p className="text-red-500 text-[9px] font-black uppercase tracking-widest mb-6 animate-pulse text-center">{error}</p>}
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {isRegister && (
            <>
              <input type="text" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 h-14 rounded-2xl px-6 text-sm font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700" required />
              <input type="tel" placeholder="Telemóvel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 h-14 rounded-2xl px-6 text-sm font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700" required />
            </>
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 h-14 rounded-2xl px-6 text-sm font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 h-14 rounded-2xl px-6 text-sm font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700" required />
          
          <button type="submit" className="w-full bg-white text-black h-16 rounded-2xl font-black uppercase text-[10px] tracking-[0.4em] active:scale-95 transition-all shadow-2xl mt-6">
            {isRegister ? 'Criar Perfil' : 'Entrar'}
          </button>
        </form>
        
        {!isProMode && (
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="mt-8 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-500 transition-colors">
              {isRegister ? 'Já é membro? Entrar' : 'Novo aqui? Criar perfil VIP'}
            </button>
        )}
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { stylists, services } = useShop();
  const { isStaff } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="px-8 pb-36 animate-in fade-in duration-700">
      <div className="relative h-[280px] rounded-[56px] mb-14 overflow-hidden shadow-2xl group cursor-pointer" onClick={() => navigate('/servicos')}>
        <img src="https://images.unsplash.com/photo-1599351431247-f5091e38e1b6?auto=format&fit=crop&q=80&w=800" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-110" alt="" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
        <div className="absolute inset-0 p-12 flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-500 mb-4 italic">Art & Precision</p>
          <h2 className="text-4xl font-black italic uppercase leading-[0.9] text-white mb-8">Redefina seu<br/>padrão visual.</h2>
          <button className="w-fit bg-white text-black px-10 py-4 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-90 transition-all">Ver Serviços</button>
        </div>
      </div>

      {isStaff && (
        <div className="mb-12">
          <button onClick={() => navigate('/admin')} className="w-full bg-amber-500 p-6 rounded-[36px] flex items-center justify-between group shadow-[0_10px_30px_rgba(245,158,11,0.2)]">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-black text-amber-500 rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-tools"></i></div>
              <div className="text-left text-black">
                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5 italic">Consola Master</p>
                <p className="text-xs font-bold">Gestão do Salão</p>
              </div>
            </div>
            <i className="fas fa-chevron-right text-black/40 group-hover:text-black transition-colors"></i>
          </button>
        </div>
      )}

      <section className="mb-14">
        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-8 ml-2">Mestres Barbeiros</h3>
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
          {stylists.map(s => (
            <div key={s.id} className="flex-shrink-0 w-36 text-center group cursor-pointer">
              <div className="relative w-32 h-32 rounded-[40px] overflow-hidden mb-4 border-2 border-zinc-900 mx-auto transition-all group-hover:border-amber-500 shadow-xl">
                <img src={s.avatar} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
              </div>
              <p className="text-[11px] font-black dark:text-white uppercase tracking-tighter leading-none">{s.name}</p>
              <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-1.5">{s.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-8 px-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">Serviços Premium</h3>
          <button onClick={() => navigate('/servicos')} className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Menu Completo</button>
        </div>
        <div className="space-y-5">
          {services.slice(0, 3).map(ser => (
            <div key={ser.id} onClick={() => navigate(`/reservar/${ser.id}`)} className="bg-zinc-50 dark:bg-zinc-900/40 p-5 rounded-[40px] flex items-center gap-5 border dark:border-zinc-800/50 hover:border-amber-500/30 transition-all active:scale-95 group">
               <div className="w-20 h-20 rounded-[28px] overflow-hidden flex-shrink-0">
                  <img src={ser.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
               </div>
               <div className="flex-1">
                  <h4 className="text-[11px] font-black uppercase dark:text-white leading-tight mb-1">{ser.name}</h4>
                  <div className="flex items-center gap-4">
                     <span className="text-amber-500 font-black text-sm">{ser.price}€</span>
                     <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{ser.duration} min</span>
                  </div>
               </div>
               <div className="w-10 h-10 rounded-full bg-zinc-950 flex items-center justify-center text-zinc-700 group-hover:bg-amber-500 group-hover:text-black transition-all">
                  <i className="fas fa-calendar-plus text-xs"></i>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// ... Rest of pages (Services, Booking, Bookings, Profile) remain identical but consistent with the v6 version ...
const ServicesPage: React.FC = () => {
  const { services } = useShop();
  const navigate = useNavigate();
  return (
    <div className="px-8 pb-36 animate-in slide-in-from-bottom-6 duration-700">
      <div className="mb-12 pt-6">
        <h2 className="text-3xl font-black italic uppercase dark:text-white tracking-tighter leading-none mb-3">Cardápio de<br/>Experiências</h2>
        <div className="w-12 h-1.5 bg-amber-500 rounded-full"></div>
      </div>
      <div className="space-y-10">
        {services.map(ser => (
          <div key={ser.id} onClick={() => navigate(`/reservar/${ser.id}`)} className="group cursor-pointer">
            <div className="relative h-64 rounded-[56px] overflow-hidden shadow-2xl mb-6">
              <img src={ser.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-110" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
              <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10">
                <p className="text-amber-500 font-black text-sm">{ser.price}€</p>
              </div>
            </div>
            <div className="px-4">
              <h3 className="text-xl font-black italic uppercase dark:text-white leading-none mb-3">{ser.name}</h3>
              <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mb-6 line-clamp-2 uppercase tracking-wide">{ser.description}</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <i className="far fa-clock text-amber-500 text-[10px]"></i>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{ser.duration} min</span>
                </div>
                <div className="flex-1 h-px bg-zinc-800"></div>
                <button className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-500 group-hover:mr-2 transition-all">Agendar Ritual <i className="fas fa-arrow-right ml-1"></i></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BookingPage: React.FC = () => {
  const { serviceId } = useParams();
  const { services, stylists, timeSlots } = useShop();
  const { addBooking } = useBookings();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const service = services.find(s => s.id === serviceId) || services[0];
  const handleComplete = () => {
    if (!selectedStylist || !selectedTime) return;
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const [hours, minutes] = selectedTime.split(':');
    date.setHours(Number(hours), Number(minutes), 0, 0);
    addBooking(service, selectedStylist, date, user?.name || 'Cliente VIP');
    addNotification({ title: 'Reserva Confirmada', message: `O seu serviço de ${service.name} está agendado.`, type: 'confirmation' });
    navigate('/agendamentos');
  };
  return (
    <div className="min-h-screen bg-black text-white p-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-6 mb-12">
        <button onClick={() => navigate(-1)} className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
        <h1 className="text-xs font-black uppercase tracking-[0.4em] italic text-amber-500">Reserva</h1>
      </header>
      {step === 1 ? (
        <section className="animate-in slide-in-from-right-10">
          <h2 className="text-2xl font-black italic uppercase leading-none mb-10">Escolha o seu<br/>Barbeiro</h2>
          <div className="space-y-6">
            {stylists.map(s => (
              <div key={s.id} onClick={() => { setSelectedStylist(s); setStep(2); }} className={`p-6 rounded-[36px] border-2 transition-all flex items-center gap-6 ${selectedStylist?.id === s.id ? 'bg-amber-500 border-amber-500 text-black' : 'bg-zinc-900 border-zinc-800 text-white'}`}>
                <img src={s.avatar} className="w-20 h-20 rounded-[28px] object-cover" alt="" />
                <div><h3 className="text-sm font-black uppercase tracking-tighter mb-1">{s.name}</h3><p className={`text-[9px] font-bold uppercase tracking-widest ${selectedStylist?.id === s.id ? 'text-black/60' : 'text-zinc-500'}`}>{s.role}</p></div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="animate-in slide-in-from-right-10">
          <h2 className="text-2xl font-black italic uppercase leading-none mb-10">Selecione o<br/>Horário</h2>
          <div className="grid grid-cols-3 gap-4 mb-14">
            {timeSlots.map(t => (
              <button key={t} onClick={() => setSelectedTime(t)} className={`py-5 rounded-2xl text-xs font-black border-2 transition-all ${selectedTime === t ? 'bg-amber-500 border-amber-500 text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{t}</button>
            ))}
          </div>
          <button disabled={!selectedTime} onClick={handleComplete} className="w-full bg-white text-black h-20 rounded-[32px] font-black uppercase text-[10px] tracking-[0.4em] shadow-2xl disabled:opacity-20 active:scale-95 transition-all">Confirmar Ritual</button>
        </section>
      )}
    </div>
  );
};

const BookingsPage: React.FC = () => {
  const { bookings, cancelBooking } = useBookings();
  const { user } = useAuth();
  const filteredBookings = useMemo(() => {
      if (user?.role === 'client') return bookings.filter(b => b.clientName === user.name);
      if (user?.role === 'staff') return bookings.filter(b => b.stylist.email === user.email);
      return bookings;
  }, [bookings, user]);
  return (
    <div className="px-8 pb-36 animate-in fade-in duration-500">
      <div className="mb-12 pt-6">
        <h2 className="text-3xl font-black italic uppercase dark:text-white tracking-tighter leading-none mb-3">Marcações<br/>Confirmadas</h2>
        <div className="w-12 h-1.5 bg-amber-500 rounded-full"></div>
      </div>
      <div className="space-y-6">
        {filteredBookings.length > 0 ? filteredBookings.map(b => (
            <div key={b.id} className="bg-zinc-50 dark:bg-zinc-900/40 p-8 rounded-[48px] border dark:border-zinc-800/50 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-8">
                <div><p className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] mb-2">{b.service.name}</p><h3 className="text-xl font-black italic uppercase dark:text-white leading-none">Com {b.stylist.name}</h3><p className="text-[8px] text-zinc-500 font-bold mt-2 uppercase tracking-widest">CLIENTE: {b.clientName}</p></div>
                <div className="text-right"><p className="text-2xl font-black dark:text-white tracking-tighter leading-none">{b.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1.5">{b.date.toLocaleDateString()}</p></div>
              </div>
              <div className="flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Confirmado</span></div><button onClick={() => cancelBooking(b.id)} className="text-[8px] font-black uppercase text-red-500/40 hover:text-red-500 transition-colors">Cancelar</button></div>
            </div>
          )) : <div className="py-40 text-center opacity-10"><p className="text-[11px] font-black uppercase tracking-[0.4em]">Sem agendamentos</p></div>}
      </div>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user, logout, isStaff } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen px-8 pb-36 animate-in fade-in duration-500 bg-black">
      <div className="flex flex-col items-center pt-10 mb-12">
        <div className="w-28 h-28 rounded-[40px] border-4 border-amber-500 p-1 mb-6 shadow-2xl">
          <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=200" className="w-full h-full object-cover rounded-[34px]" alt="" />
        </div>
        <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter mb-1">{user?.name}</h2>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">{user?.email}</p>
        <span className="mt-4 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-amber-500">Papel: {user?.role || 'Client'}</span>
      </div>
      <div className="space-y-4">
        {isStaff && (
            <button onClick={() => navigate('/admin')} className="w-full p-6 bg-amber-500 border border-amber-500/20 rounded-[32px] flex items-center justify-between group">
              <div className="flex items-center gap-4"><div className="w-10 h-10 bg-black text-amber-500 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-lock-open"></i></div><div><p className="text-[10px] font-black uppercase tracking-widest text-black">Master Console</p><p className="text-[8px] text-black/60 font-bold uppercase">Gestão Profissional</p></div></div>
              <i className="fas fa-chevron-right text-black/40"></i>
            </button>
        )}
        <button onClick={logout} className="w-full p-6 bg-red-500/10 text-red-500 border border-red-500/10 rounded-[32px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all mt-6">Terminar Sessão</button>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <ShopProvider>
              <BookingProvider>
                <div className="min-h-screen bg-white dark:bg-black transition-all duration-700 overflow-x-hidden selection:bg-amber-500 selection:text-black">
                  <Header />
                  <Routes>
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/servicos" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
                    <Route path="/reservar/:serviceId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
                    <Route path="/agendamentos" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                    <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                  <BottomNav />
                  <LiveAssistant />
                </div>
              </BookingProvider>
            </ShopProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
