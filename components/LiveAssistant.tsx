
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../services/audioUtils';
import { useBookings, useNotifications } from '../App';
import { SERVICES, STYLISTS } from '../constants';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const LiveAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isError, setIsError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Clique para falar com o assistente do Paulo Jorge.');
  const [typedStatus, setTypedStatus] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  const { addBooking } = useBookings();
  const { addNotification } = useNotifications();

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const speakingTimeoutRef = useRef<number | null>(null);
  const typingIntervalRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startTyping = useCallback((text: string) => {
    if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
    setTypedStatus('');
    let i = 0;
    typingIntervalRef.current = window.setInterval(() => {
      setTypedStatus((prev) => text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
      }
    }, 30);
  }, []);

  useEffect(() => {
    startTyping(statusMessage);
  }, [statusMessage, startTyping]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typedStatus]);

  const playDing = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current.output;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }, []);

  const playConnectSound = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current.output;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    const now = ctx.currentTime;
    playNote(523.25, now, 0.15); // C5
    playNote(659.25, now + 0.12, 0.25); // E5
  }, []);

  const agendarFunctionDeclaration: FunctionDeclaration = {
    name: 'agendarServico',
    parameters: {
      type: Type.OBJECT,
      description: 'Agenda um serviço de barbearia para o cliente.',
      properties: {
        serviceName: { type: Type.STRING, description: 'O nome do serviço desejado.' },
        stylistName: { type: Type.STRING, description: 'O nome do barbeiro preferido.' },
        dayOffset: { type: Type.NUMBER, description: 'Número de dias a partir de hoje.' }
      },
      required: ['serviceName'],
    },
  };

  const handleVoiceBooking = useCallback((args: any) => {
    const { serviceName, stylistName, dayOffset = 1 } = args;
    const service = SERVICES.find(s => s.name.toLowerCase().includes(serviceName.toLowerCase())) || SERVICES[0];
    const stylist = STYLISTS.find(s => stylistName && s.name.toLowerCase().includes(stylistName.toLowerCase())) || STYLISTS[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    targetDate.setHours(10, 0, 0, 0);
    addBooking(service, stylist, targetDate);
    addNotification({
      title: 'Agendamento via Assistente',
      message: `O seu serviço de ${service.name} com ${stylist.name} foi reservado para ${dayOffset === 0 ? 'hoje' : 'amanhã'} às 10:00.`,
      type: 'confirmation'
    });
    playDing();
    return { status: 'success', service: service.name, stylist: stylist.name, date: targetDate.toLocaleDateString('pt-PT'), time: '10:00' };
  }, [addBooking, addNotification, playDing]);

  const stopConversation = useCallback((explicitError?: string) => {
    const wasActive = isActive;
    
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    setIsActive(false);
    setIsSpeaking(false);
    setIsConnecting(false);
    
    if (explicitError) {
      setIsError(true);
      setStatusMessage(explicitError);
    } else if (!isError) {
      setStatusMessage('Atendimento encerrado.');
    }

    if (wasActive && !explicitError) {
      setShowFeedbackModal(true);
    }
  }, [isActive, isError]);

  const handleSendTextMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now() + '-tu', role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    
    if (isActive && sessionRef.current) {
       setStatusMessage("Processando sua mensagem...");
    } else {
       setTimeout(() => {
          setMessages(prev => [...prev, { 
            id: Date.now() + '-ta', 
            role: 'assistant', 
            text: "Recebi sua mensagem! Inicie a chamada de voz para eu te ajudar a agendar agora mesmo." 
          }]);
       }, 800);
    }
    
    setInputText('');
  };

  const startConversation = async () => {
    setIsConnecting(true);
    setIsError(false);
    setShowFeedbackModal(false);
    setStatusMessage('Conectando ao PJ Assistente...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!audioContextRef.current) {
        audioContextRef.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }),
        };
      }
      if (audioContextRef.current.output.state === 'suspended') {
        await audioContextRef.current.output.resume();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      } catch (err: any) {
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Microfone bloqueado. Por favor, permita o acesso.' 
          : 'Não foi possível encontrar um microfone.';
        stopConversation(errorMsg);
        return;
      }

      let currentAssistantBuffer = '';
      let currentUserBuffer = '';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
          },
          tools: [{ functionDeclarations: [agendarFunctionDeclaration] }],
          systemInstruction: `Você é o PJ Assistente da Paulo Jorge Barbershop. Ajude o cliente a agendar serviços e escolher barbeiros. Seja breve, cortês e premium. Responda sempre em Português.`,
        },
        callbacks: {
          onopen: () => {
            playConnectSound();
            setIsActive(true);
            setIsConnecting(false);
            setStatusMessage('Ouvindo... Como podemos cuidar do seu visual hoje?');

            const source = audioContextRef.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.input.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              if (rms > 0.015) {
                setIsSpeaking(true);
                if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
                speakingTimeoutRef.current = window.setTimeout(() => setIsSpeaking(false), 200);
              }
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.input.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentUserBuffer += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.outputTranscription) {
              currentAssistantBuffer += message.serverContent.outputTranscription.text;
              setStatusMessage(currentAssistantBuffer);
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'agendarServico') {
                  const result = handleVoiceBooking(fc.args);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result }, }
                    });
                  });
                }
              }
            }

            if (message.serverContent?.turnComplete) {
              playDing();
              const newMsgs: Message[] = [];
              if (currentUserBuffer) {
                newMsgs.push({ id: Date.now() + '-u', role: 'user', text: currentUserBuffer });
                currentUserBuffer = '';
              }
              if (currentAssistantBuffer) {
                newMsgs.push({ id: Date.now() + '-a', role: 'assistant', text: currentAssistantBuffer });
                currentAssistantBuffer = '';
              }
              if (newMsgs.length > 0) {
                setMessages(prev => [...prev, ...newMsgs]);
              }
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current.output;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentAssistantBuffer = '';
              currentUserBuffer = '';
            }
          },
          onerror: (e) => {
            stopConversation('Falha na conexão. Verifique sua internet.');
          },
          onclose: (e) => {
            if (!e.wasClean) stopConversation('Conexão perdida.');
            else stopConversation();
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (error: any) {
      stopConversation('Serviço indisponível.');
    }
  };

  const handleFeedback = (liked: boolean) => {
    setShowFeedbackModal(false);
    addNotification({
      title: 'Feedback Enviado',
      message: `Obrigado por avaliar nosso assistente com um ${liked ? 'Joinha' : 'Negativo'}.`,
      type: 'reminder'
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 bg-zinc-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[85vh] relative">
          <div className="p-4 bg-zinc-800 flex justify-between items-center border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400 animate-pulse' : (isError ? 'bg-red-500' : 'bg-zinc-500')}`}></div>
              <span className="font-semibold text-[10px] tracking-[0.2em] uppercase text-zinc-300">PJ Assistente</span>
            </div>
            <button onClick={() => { setIsOpen(false); stopConversation(); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-700 transition-colors">
              <i className="fas fa-times text-xs opacity-40"></i>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-900/50 min-h-[200px] scroll-smooth relative">
            {showFeedbackModal && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                <div className="bg-zinc-800 border border-zinc-700 rounded-3xl p-6 shadow-2xl text-center">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">Avaliação</h3>
                  <p className="text-xs font-bold text-white mb-6">Gostaria de deixar uma avaliação sobre o atendimento do assistente?</p>
                  <div className="flex justify-center gap-6">
                    <button 
                      onClick={() => handleFeedback(true)}
                      className="w-14 h-14 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-2xl hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all active:scale-90"
                    >
                      👍
                    </button>
                    <button 
                      onClick={() => handleFeedback(false)}
                      className="w-14 h-14 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-2xl hover:bg-red-500 hover:text-black hover:border-red-500 transition-all active:scale-90"
                    >
                      👎
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowFeedbackModal(false)}
                    className="mt-6 text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            )}

            {messages.length === 0 && !isActive && !isConnecting && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-10">
                <i className="fas fa-comments text-4xl mb-4 text-amber-500"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Envie uma mensagem ou inicie chamada</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-amber-500 text-black rounded-tr-none shadow-lg shadow-amber-500/10' 
                    : 'bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[7px] font-black text-zinc-600 uppercase mt-1.5 px-1 tracking-widest">
                  {msg.role === 'user' ? 'Cliente' : 'PJ Assistente'}
                </span>
              </div>
            ))}

            {isActive && typedStatus && (
              <div className="flex flex-col items-start animate-in fade-in duration-300">
                <div className="max-w-[85%] p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-tl-none">
                  {typedStatus}
                  <span className="inline-block w-1 h-3 bg-amber-500 ml-1 animate-pulse"></span>
                </div>
                <span className="text-[7px] font-black text-zinc-600 uppercase mt-1.5 px-1 tracking-widest">PJ Assistente</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800/50">
            <form onSubmit={handleSendTextMessage} className="flex gap-2 relative">
               <input 
                 type="text" 
                 placeholder="Escreva sua mensagem..."
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-[11px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all"
               />
               <button 
                 type="submit"
                 disabled={!inputText.trim()}
                 className="w-11 h-11 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 hover:text-amber-500 disabled:opacity-30 transition-all active:scale-90"
               >
                 <i className="fas fa-paper-plane text-xs"></i>
               </button>
            </form>
          </div>

          <div className="p-6 bg-zinc-800/30 border-t border-zinc-800 flex flex-col items-center gap-4">
            <div className="relative">
              {isSpeaking && <div className="absolute inset-[-15px] rounded-full border-2 border-amber-500/20 animate-[ping_1.5s_infinite]"></div>}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-500 border-2 relative z-10 
                ${isActive ? (isSpeaking ? 'border-amber-400 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border-amber-400 text-amber-400') : (isError ? 'border-red-900 text-red-500' : 'border-zinc-700 text-zinc-600')}`}>
                <i className={`fas ${isError ? 'fa-exclamation' : 'fa-microphone'} ${isSpeaking ? 'animate-pulse' : ''}`}></i>
              </div>
            </div>

            <div className="w-full">
              {!isActive ? (
                <button 
                  onClick={startConversation} 
                  disabled={isConnecting} 
                  className={`w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-black py-3.5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-amber-500/10 active:scale-95 transition-all ${!isConnecting ? 'animate-pulse-gold' : ''}`}
                >
                  {isConnecting ? <i className="fas fa-spinner animate-spin"></i> : (isError ? 'Tentar Chamada' : 'Falar por Voz')}
                </button>
              ) : (
                <button onClick={() => stopConversation()} className="w-full bg-zinc-950 text-zinc-500 py-3.5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] border border-zinc-800 active:scale-95 transition-all">
                  Encerrar Chamada
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="w-16 h-16 bg-zinc-900 text-amber-500 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center border-2 border-amber-600/30 active:scale-95">
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-headset'} text-2xl`}></i>
      </button>
    </div>
  );
};

export default LiveAssistant;
