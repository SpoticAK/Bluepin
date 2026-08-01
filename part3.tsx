 {/* 4. CARE REMINDERS */}
        <section className="mt-8 relative">
          <div className="flex items-center justify-between px-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              <h2 className="text-[17px] font-bold text-theme-text">Care Reminders</h2>
            </div>
            {activeReminders.length > 0 && (
              <span className="text-[12px] font-medium text-theme-text-sec/60">{activeReminders.length}</span>
            )}
          </div>
          
          <div className="bg-theme-card border border-theme-border/50 rounded-[20px] overflow-hidden shadow-sm">
            {activeReminders.length > 0 ? (
              <div className="flex flex-col">
                {(showAllReminders ? activeReminders : activeReminders.slice(0, 3)).map((reminder, idx) => (
                  <div 
                    key={reminder.id}
                    onClick={() => {
                      if (reminder.action === 'log_glucose') onNavigate('glucose');
                      else if (reminder.action === 'log_weight') onNavigate('fitness');
                      else if (reminder.action === 'upload_report') onNavigate('biomarkers');
                    }}
                    className={cn(
                      "flex items-start sm:items-center justify-between p-3.5 sm:px-4 sm:py-3 cursor-pointer hover:bg-theme-bg/50 transition-colors group",
                      idx < (showAllReminders ? activeReminders.length : Math.min(activeReminders.length, 3)) - 1 ? "border-b border-theme-border/20" : ""
                    )}
                  >
                    <div className="flex flex-col pr-4">
                      <h3 className="text-[14px] font-semibold text-theme-text leading-tight mb-0.5">{reminder.title}</h3>
                      <p className="text-[12px] font-normal text-theme-text-sec/80 leading-snug">{reminder.message}</p>
                    </div>
                    <ChevronRight size={14} className="text-theme-text-sec/30 group-hover:text-theme-text-sec/60 transition-colors shrink-0 mt-0.5 sm:mt-0" />
                  </div>
                ))}
                
                {activeReminders.length > 3 && !showAllReminders && (
                  <button 
                    onClick={() => setShowAllReminders(true)}
                    className="w-full py-2.5 text-[12px] font-medium text-theme-text-sec hover:text-theme-text bg-theme-bg/20 hover:bg-theme-bg/40 transition-colors border-t border-theme-border/20"
                  >
                    View all {activeReminders.length} reminders
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 flex items-center justify-center text-center">
                <p className="text-[13px] font-medium text-theme-text-sec/70">Nothing needs your attention right now.</p>
              </div>
            )}
          </div>
        </section>

