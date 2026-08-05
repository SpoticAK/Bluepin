import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MessageSquare, Calendar, Mail, User, ChevronLeft, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function AdminFeedbackView() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFeedbacks(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching feedback:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const selectedFeedback = feedbacks.find(f => f.id === selectedId);

  const getTag = (subject: string) => {
    if (subject.includes('idea')) return { label: 'Feature', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
    if (subject.includes('working')) return { label: 'Bug', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
    return { label: 'General', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 flex justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-theme-border border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] max-w-6xl mx-auto py-4 px-4 sm:px-6">
      <div className="bg-theme-card border border-theme-border rounded-2xl h-full flex overflow-hidden shadow-sm">
        
        {/* Left Pane - List */}
        <div className={cn(
          "w-full md:w-1/3 flex flex-col border-r border-theme-border bg-theme-bg/50",
          selectedId ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b border-theme-border bg-theme-card">
            <h1 className="text-xl font-bold text-theme-text flex items-center gap-2">
              <Inbox className="w-5 h-5 text-blue-500" />
              Feedbacks
            </h1>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {feedbacks.length === 0 ? (
              <div className="p-8 text-center text-theme-text-sec">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No feedback received yet.</p>
              </div>
            ) : (
              feedbacks.map((item) => {
                const tag = getTag(item.subject);
                const email = item.userEmail || 'Anonymous';
                const initial = email.charAt(0).toUpperCase();
                const isSelected = item.id === selectedId;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full p-4 flex items-start gap-3 border-b border-theme-border/50 text-left transition-colors hover:bg-theme-bg",
                      isSelected ? "bg-theme-bg" : ""
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-theme-text truncate block">{email}</span>
                        <span className="text-[10px] text-theme-text-sec shrink-0 ml-2">
                          {item.createdAt ? format(new Date(item.createdAt), 'MMM d') : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-theme-text-sec truncate block max-w-[140px]">
                          {item.message}
                        </span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap", tag.color)}>
                          {tag.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane - Detail */}
        <div className={cn(
          "w-full md:w-2/3 flex flex-col bg-theme-bg",
          !selectedId ? "hidden md:flex" : "flex"
        )}>
          {selectedFeedback ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-theme-border bg-theme-card flex items-center gap-3">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-theme-bg text-theme-text-sec"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-semibold shrink-0">
                  {(selectedFeedback.userEmail || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-theme-text">
                    {selectedFeedback.userEmail || 'Anonymous'}
                  </h2>
                  <p className="text-xs text-theme-text-sec">
                    {selectedFeedback.createdAt ? format(new Date(selectedFeedback.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown Date'}
                  </p>
                </div>
              </div>
              
              {/* Message Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="bg-theme-card border border-theme-border rounded-2xl p-6 shadow-sm max-w-3xl">
                  <div className="mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-sec mb-1 block">Subject</span>
                    <div className="font-medium text-theme-text">{selectedFeedback.subject}</div>
                  </div>
                  
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-sec mb-2 block">Message</span>
                    <div className="text-theme-text whitespace-pre-wrap leading-relaxed text-sm bg-theme-bg p-4 rounded-xl border border-theme-border/50">
                      {selectedFeedback.message}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-theme-text-sec">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a feedback to read</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
