import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

const MAX_SUBMISSIONS_PER_DAY = 3;

export function FeedbackWidget({ trigger }: { trigger?: React.ReactElement }) {
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'limit_reached'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState(0); // 0 = initial, 1 = option selected, 2 = submitted
  
  const user = auth.currentUser;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      checkLimit();
      scrollToBottom();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [step, status, message]);

  const checkLimit = () => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = user ? `bluepin_feedback_count_${user.uid}` : 'bluepin_feedback_count_anonymous';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const { date, count } = JSON.parse(stored);
        if (date === today && count >= MAX_SUBMISSIONS_PER_DAY) {
          setStatus('limit_reached');
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const incrementLimit = () => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = user ? `bluepin_feedback_count_${user.uid}` : 'bluepin_feedback_count_anonymous';
    const stored = localStorage.getItem(storageKey);
    let newCount = 1;
    if (stored) {
      try {
        const { date, count } = JSON.parse(stored);
        if (date === today) {
          newCount = count + 1;
        }
      } catch (e) {
        // ignore
      }
    }
    localStorage.setItem(storageKey, JSON.stringify({ date: today, count: newCount }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message.trim()) return;

    setStatus('loading');
    setErrorMessage('');
    setStep(2); // message displayed as sent

    try {
      await addDoc(collection(db, 'feedbacks'), {
        subject,
        message,
        userEmail: user?.email || 'Anonymous',
        createdAt: new Date().toISOString(),
      });

      setStatus('success');
      incrementLimit();
      
      setTimeout(() => {
        setIsOpen(false);
        setTimeout(() => {
          setStatus('idle');
          setStep(0);
          setSubject('');
          setMessage('');
        }, 300);
      }, 4000);

    } catch (err: any) {
      console.error('Feedback submission error:', err);
      setStatus('error');
      setStep(1); // revert back so they can try again
      setErrorMessage('Something went wrong. Please try again later.');
    }
  };

  const closeChat = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStatus('idle');
      setStep(0);
      setSubject('');
      setMessage('');
    }, 300);
  };

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, {
          onClick: (e: any) => {
            if (trigger.props.onClick) trigger.props.onClick(e);
            setIsOpen(true);
          }
        })
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-10 h-10 rounded-full bg-theme-bg-sec flex items-center justify-center text-theme-text hover:bg-theme-border transition-colors relative group"
          aria-label="Feedback and Support"
        >
          <Sparkles className="w-5 h-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-theme-card border border-theme-border text-theme-text text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Chat with Sparsh
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-theme-bg flex flex-col sm:max-w-md sm:mx-auto sm:border-x sm:border-theme-border sm:shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 sm:fade-in duration-300 sm:rounded-t-3xl sm:mt-12 pb-safe">
          
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-theme-border bg-theme-bg/80 backdrop-blur-md sticky top-0 z-10 sm:rounded-t-3xl">
            <button 
              onClick={closeChat}
              className="p-2 -ml-2 rounded-full hover:bg-theme-bg-sec text-theme-text transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center overflow-hidden">
                <span className="text-xl">👋</span>
              </div>
              <div>
                <h2 className="font-medium text-theme-text">Sparsh</h2>
                <p className="text-xs text-theme-text-sec">Founder, Bluepin</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Limit Reached handling */}
            {status === 'limit_reached' ? (
               <div className="flex items-end gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-xs">👋</div>
                <div className="bg-theme-bg-sec text-theme-text px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                  You have reached the limit of {MAX_SUBMISSIONS_PER_DAY} messages for today. I'll get back to you soon!
                </div>
              </div>
            ) : (
              <>
                {/* Sparsh Bubble 1 */}
                <div className="flex items-end gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-xs">👋</div>
                  <div className="bg-theme-bg-sec text-theme-text px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                    Hey there! I am Sparsh, the founder of Bluepin. I am building this for you, and I read every single message.
                  </div>
                </div>

                {/* Sparsh Bubble 2 */}
                <div className="flex items-end gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300 delay-150 fill-mode-both">
                  <div className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center flex-shrink-0 text-xs"></div>
                  <div className="bg-theme-bg-sec text-theme-text px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                    I might take a few days to respond! Thank you :)
                  </div>
                </div>

                {/* Options */}
                {step === 0 && (
                  <div className="flex flex-col items-end gap-2 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300 delay-300 fill-mode-both">
                    {[
                      "I have an idea / feature request",
                      "Something isn't working right",
                      "Just sharing some feedback"
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setSubject(opt); setStep(1); }}
                        className="bg-theme-bg text-blue-500 border border-blue-500/30 hover:bg-blue-500/10 px-4 py-2.5 rounded-2xl rounded-br-sm text-sm transition-colors text-left"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* User selected option */}
                {step >= 1 && (
                  <div className="flex flex-col items-end gap-1 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="bg-blue-500 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm max-w-[85%] leading-relaxed">
                      {subject}
                    </div>
                  </div>
                )}

                {/* Sparsh replies after option */}
                {step >= 1 && (
                  <div className="flex items-end gap-2 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300 delay-150 fill-mode-both">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-xs">👋</div>
                    <div className="bg-theme-bg-sec text-theme-text px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                      Got it! Type your message below:
                    </div>
                  </div>
                )}

                {/* User message sent */}
                {step >= 2 && (
                  <div className="flex flex-col items-end gap-1 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="bg-blue-500 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap">
                      {message}
                    </div>
                  </div>
                )}

                {/* Sparsh final confirmation */}
                {status === 'success' && (
                  <div className="flex items-end gap-2 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300 delay-150 fill-mode-both">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-xs">👋</div>
                    <div className="bg-theme-bg-sec text-theme-text px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                      Message Sent! Thank you for helping improve Bluepin. I'll read it soon.
                    </div>
                  </div>
                )}
                
                {status === 'error' && (
                  <div className="flex items-end gap-2 mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300 delay-150 fill-mode-both">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 text-xs">❌</div>
                    <div className="bg-red-500/10 text-red-500 px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] leading-relaxed">
                      {errorMessage}
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {step === 1 && status !== 'loading' && status !== 'limit_reached' && (
            <div className="p-4 border-t border-theme-border bg-theme-bg animate-in slide-in-from-bottom-2 duration-300 flex flex-col gap-2">
              <p className="text-[11px] text-theme-text-sec/80 text-center mb-1">
                Please note: You can send up to {MAX_SUBMISSIONS_PER_DAY} messages per day.
              </p>
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-theme-bg-sec border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text placeholder:text-theme-text-sec/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[44px]"
                  rows={1}
                  required
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="h-11 w-11 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-5 h-5 -ml-0.5" />
                </button>
              </form>
            </div>
          )}

          {status === 'loading' && (
            <div className="p-4 border-t border-theme-border bg-theme-bg flex justify-center">
              <span className="flex items-center gap-2 text-sm text-theme-text-sec">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
