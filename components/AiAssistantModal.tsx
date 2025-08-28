import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";

const CloseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const SendIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const LoadingSpinner: React.FC<{className?: string}> = ({ className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface AiAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    containerFile: File | null;
}

const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, containerFile }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen && containerFile && !chat) {
            try {
                const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
                const newChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                         systemInstruction: `You are a helpful AI assistant and an expert in steganography and polyglot files. The user has uploaded a container file and wants to know what kind of files they can hide inside it. Provide clear, concise, and helpful advice. Keep your answers brief and to the point. The container file is a ${containerFile.name} of type ${containerFile.type} and size ${formatBytes(containerFile.size)}. Frame your advice around general principles for the container type, rather than making absolute guarantees. Do not use markdown.`,
                    }
                });
                setChat(newChat);
                setMessages([
                    { role: 'model', content: `I see you've uploaded a ${containerFile.type} file. I can help you understand what kinds of files are best to hide inside it. What would you like to know?` }
                ]);
                setError(null);
            } catch(e) {
                console.error("Failed to initialize AI Chat:", e);
                setError("Could not initialize the AI assistant. Please check your API key configuration.");
            }
        } else if (!isOpen) {
            setChat(null);
            setMessages([]);
            setInput('');
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen, containerFile, chat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading || !chat) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const result = await chat.sendMessageStream({ message: input });
            
            let fullResponse = "";
            setMessages(prev => [...prev, { role: 'model', content: '' }]);

            for await (const chunk of result) {
                fullResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = fullResponse;
                    return newMessages;
                });
            }
        } catch (err) {
            console.error("AI chat error:", err);
            setError("Sorry, I encountered an error. Please try again.");
            setMessages(prev => prev.filter(m => m.content !== ''));
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, chat]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in" aria-modal="true" role="dialog" onClick={onClose}>
            <div className="bg-slate-800 w-full max-w-2xl h-[90vh] max-h-[700px] rounded-2xl shadow-2xl flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">AI Assistant</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Close">
                        <CloseIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white flex-shrink-0 text-sm">AI</div>}
                            <div className={`max-w-md lg:max-w-lg p-3 rounded-2xl whitespace-pre-wrap break-words ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-300 rounded-bl-none'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-end gap-3 justify-start">
                             <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white flex-shrink-0 text-sm">AI</div>
                             <div className="max-w-md lg:max-w-lg p-3 rounded-2xl bg-slate-700 text-slate-300 rounded-bl-none">
                                <LoadingSpinner className="w-5 h-5 text-slate-400" />
                             </div>
                        </div>
                    )}
                     <div ref={messagesEndRef} />
                </div>
                
                {error && <p className="px-4 pb-2 text-red-400 text-center">{error}</p>}

                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask a question..."
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-3 pr-12 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 max-h-40 overflow-y-auto"
                            rows={1}
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiAssistantModal;
