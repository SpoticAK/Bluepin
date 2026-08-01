        {/* 5. FAMILY */}
      <section 
        onClick={() => onNavigate('family')}
        className="bg-theme-card p-5 sm:p-6 rounded-[24px] border border-theme-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold text-theme-text">Your Family</h2>
          <ChevronDown size={20} className="text-theme-text-sec" />
        </div>

        {otherMembers.length > 0 ? (
          <div className="space-y-4">
            {otherMembers.slice(0, 2).map((member, idx) => {
              const { recentStreak, currentStreak } = getAdjustedMemberStreak(member);
              const mockWeek = recentStreak;
              return (
                <div key={member.userId}>
                  {idx > 0 && <div className="h-px bg-theme-border/50 my-4" />}
                  
                  <div className="flex items-center justify-between">
                    {/* Left Side */}
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                        style={{ backgroundColor: member.avatarColor || '#94a3b8' }}
                      >
                        {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-theme-text">{member.name}</span>
                          {currentStreak > 0 && (
                            <div className="flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                              <span className="text-[11px] sm:text-xs font-black text-theme-text">{currentStreak}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {mockWeek.slice(-7).map((status, i) => {
                            const isToday = i === mockWeek.length - 1;
                            
                            return (
                              <ActivityCircle 
                                key={i}
                                status={status as any}
                                isToday={isToday}
                                size="xs"
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Side */}
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-display font-medium text-theme-text">{member.healthScore || 0}</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-medium text-theme-text-sec mb-1">Health Score</span>
                      
                      {member.glucoseEnabled && member.latestGlucose && (
                        <>
                          <div className="flex items-baseline gap-0.5 mt-0.5">
                            <span className="text-sm font-bold text-theme-text">{member.latestGlucose}</span>
                            <span className="text-[10px] font-medium text-theme-text-sec">{member.glucoseUnit || 'mg/dL'}</span>
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-medium text-theme-text-sec">Glucose</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-bold text-theme-text mb-1">Health works better together</p>
            <p className="text-xs text-theme-text-sec mb-4">Create or join a family to help each other stay on top of health.</p>
            <button className="text-sm font-bold bg-theme-bg text-theme-text px-4 py-2 rounded-full border border-theme-border" onClick={(e) => { e.stopPropagation(); onNavigate('family'); }}>
              Create or Join Family
            </button>
          </div>
        )}
      </section>

      {/* QUICK ADD FLOATING BUTTON */}
      <button 
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-24 md:bottom-10 right-6 sm:right-8 w-14 h-14 bg-theme-text text-theme-bg rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>

      {/* QUICK ADD BOTTOM SHEET */}
      <AnimatePresence>
        {showQuickAdd && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickAdd(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-theme-bg rounded-t-[32px] shadow-2xl z-50 p-6 sm:p-8 max-w-md mx-auto pb-safe"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[22px] font-display font-medium text-theme-text">Quick Add</h3>
                <button onClick={() => setShowQuickAdd(false)} className="p-2 -mr-2 text-theme-text-sec hover:text-theme-text transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex flex-col pb-20 md:pb-6">
                <button 
                  onClick={() => { setQuickAddAction('report'); }}
                  className="flex items-center gap-4 py-5 border-b border-theme-border/50 hover:bg-theme-card-sec/50 transition-colors text-left group px-2 -mx-2 rounded-xl"
                >
                  <FileText size={24} className="text-emerald-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-[17px] font-medium text-theme-text block mb-0.5">Add Health Report</span>
                    <span className="text-[13px] font-medium text-theme-text-sec block">Upload a health report.</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => { setQuickAddAction('glucose'); }}
                  className="flex items-center gap-4 py-5 border-b border-theme-border/50 hover:bg-theme-card-sec/50 transition-colors text-left group px-2 -mx-2 rounded-xl"
                >
                  <Droplet size={24} className="text-red-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-[17px] font-medium text-theme-text block mb-0.5">Log Glucose</span>
                    <span className="text-[13px] font-medium text-theme-text-sec block">Record blood sugar level</span>
                  </div>
                </button>

                <button 
                  onClick={() => { setQuickAddAction('weight'); }}
                  className="flex items-center gap-4 py-5 hover:bg-theme-card-sec/50 transition-colors text-left group px-2 -mx-2 rounded-xl"
                >
                  <Circle size={24} className="text-orange-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-[17px] font-medium text-theme-text block mb-0.5">Log Weight</span>
                    <span className="text-[13px] font-medium text-theme-text-sec block">Update your current weight</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {quickAddAction === 'weight' && (
        <AddWeightModal 
          onClose={() => { setQuickAddAction('none'); setShowQuickAdd(false); }} 
          onAdd={async (weight, date) => {
            const existingEntry = weightEntries.find(w => w.date === date);
            try {
              await addWeightEntry({
                id: existingEntry ? existingEntry.id : crypto.randomUUID(),
                weight,
                date,
                createdAt: Date.now()
              });
              setQuickAddAction('none');
              setShowQuickAdd(false);
            } catch(e: any) {
              alert(e.message || "Failed to add weight");
            }
          }} 
        />
      )}
      {quickAddAction === 'glucose' && (
        <AddGlucoseModal 
          onClose={() => { setQuickAddAction('none'); setShowQuickAdd(false); }}
          onAdd={async (r) => {
            try {
              await addGlucoseReading(r);
              setQuickAddAction('none');
              setShowQuickAdd(false);
            } catch(e: any) {
              alert(e.message || "Failed to add glucose");
            }
          }}
        />
      )}
      {quickAddAction === 'report' && (
        <AddReportFlow 
          onClose={() => { setQuickAddAction('none'); }}
          onSuccess={() => { setQuickAddAction('none'); setShowQuickAdd(false); }}
        />
      )}
 </div>
 );
}
