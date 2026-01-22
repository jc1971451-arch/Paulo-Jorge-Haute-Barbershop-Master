
import { Service, Stylist } from './types';

export const SERVICES: Service[] = [
  {
    id: '1',
    name: 'Executive Precision Cut',
    price: 50,
    duration: '60 min',
    description: 'Corte artesanal utilizando técnicas de visagismo avançado para realçar a estrutura óssea facial.',
    image: 'https://images.unsplash.com/photo-1593702288056-7927b442d0fa?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '2',
    name: 'The Royal Shave',
    price: 40,
    duration: '45 min',
    description: 'Experiência sensorial com 3 camadas de toalhas quentes e navalha japonesa.',
    image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '3',
    name: 'Master Grooming Ritual',
    price: 85,
    duration: '100 min',
    description: 'Serviço assinatura Paulo Jorge. Inclui corte, barba e massagem craniana.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=800'
  }
];

export const STYLISTS: Stylist[] = [
  {
    id: 's1',
    name: 'Paulo Jorge',
    role: 'Master Founder',
    specialty: 'Visagismo & Design',
    bio: 'Fundador e mentor da marca.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=400',
    email: 'admin@paulojorge.pt'
  },
  {
    id: 's2',
    name: 'Julian Ross',
    role: 'Senior Barber',
    specialty: 'Modern Fades',
    bio: 'Especialista em degradês modernos.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400',
    email: 'julian@paulojorge.pt'
  }
];
