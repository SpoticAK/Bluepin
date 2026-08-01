        {/* WEEKLY ACTIVITY STRIP */}
        <section 
          className="bg-theme-card px-5 py-5 sm:px-6 rounded-[28px] border border-theme-border/50 shadow-sm cursor-pointer hover:shadow-md transition-all group flex flex-col gap-4"
          onClick={() => onNavigate('fitness')}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-theme-text">Fitness</h2>
          </div>
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex-1 flex justify-between items-center relative z-10 pr-4 sm:pr-6">
              {weeklyActivity.map((day, i) => {
                const hasNext = i < weeklyActivity.length - 1;
                const nextDay = hasNext ? weeklyActivity[i + 1] : null;
                const isLineRed = nextDay?.isBreak;

                return (
                  <div key={i} className="relative flex-1 flex flex-col items-center min-w-0">
                    <div className="flex flex-col items-center gap-2 z-10 relative">
                      <div className="relative z-10 bg-theme-card rounded-full">
                         <ActivityCircle 
                           status={emojiToStatus(day.emoji)} 
                           isToday={day.isToday} 
                           size="md" 
                           className={!day.isToday ? "group-hover:scale-105" : ""} 
                         />
                      </div>
                      <span className={cn(
                        "text-[9px] sm:text-[10px] transition-colors duration-300 px-0.5 relative z-10 truncate", 
                        day.isToday ? "text-theme-text font-bold" : "text-theme-text-sec font-medium group-hover:text-theme-text"
                      )}>
                        {day.isToday ? 'TODAY' : safeFormat(day.date, 'EEEEE')}
                      </span>
                    </div>
                    {hasNext && (
                      <div className={cn(
                        "absolute top-[10px] sm:top-[14px] left-1/2 w-full h-[2px] sm:h-[3px] rounded-full z-0",
                        isLineRed ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-theme-border/60"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex flex-col items-center justify-center pl-4 sm:pl-6 border-l border-theme-border/60 shrink-0 min-w-[70px] sm:min-w-[90px] relative z-10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Flame className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] text-theme-accent drop-shadow-[0_0_8px_rgba(232,122,93,0.4)] group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                  <span className="text-[26px] sm:text-[34px] font-display font-bold leading-none bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-amber-500 drop-shadow-sm">{currentStreak}</span>
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-theme-text-sec mt-1.5 uppercase tracking-wider">Day Streak</span>
            </div>
          </div>
        </section>

        {/* 3. TODAY'S GOALS */}
 <section 
 onClick={() => onNavigate('fitness')}
 onMouseEnter={() => setIsHoveringGoals(true)}
 onMouseLeave={() => setIsHoveringGoals(false)}
 className="bg-theme-card p-4 sm:p-5 rounded-[24px] border border-theme-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
 >
 <div className="flex items-center justify-between">
 <h2 className="text-[17px] font-bold text-theme-text">Today's Goals</h2>
 <span className="text-[14px] font-bold text-theme-text-sec">{completedGoalsToday.length} of {activeGoalsToday.length}</span>
 </div>

 {activeGoalsToday.length > 0 ? (
 <>
 <div className="flex gap-1.5">
 {activeGoalsToday.map((g) => {
 const isComplete = todayLogs[g.id]?.completed;
 const isNextUp = !isComplete && currentNextUpGoal?.id === g.id;
 return (
 <div 
 key={g.id} 
 className={cn(
 "flex-1 h-2 rounded-full transition-colors duration-500",
 isComplete ? "bg-emerald-500/80 dark:bg-emerald-600" : 
 isNextUp ? "bg-amber-400/80 dark:bg-amber-600/80" : 
 "bg-stone-200 dark:bg-stone-800"
 )} 
 />
 );
 })}
 </div>
 
 {incompleteGoals.length > 0 ? (
 <div className="flex items-center justify-between mt-0.5">
 <div className="flex flex-col overflow-hidden relative h-10 w-full pr-4">
 <p className="text-[14px] font-bold text-theme-text-sec mb-0.5 shrink-0">Next up</p>
 <div className="relative flex-1">
 {incompleteGoals.map((g, idx) => (
 <p 
 key={g.id}
 className={cn(
 "text-sm font-medium text-theme-text truncate absolute inset-0 transition-all duration-500",
 idx === nextUpIndex 
 ? "opacity-100 translate-y-0 pointer-events-auto" 
 : idx < nextUpIndex 
 ? "opacity-0 -translate-y-2 pointer-events-none" 
 : "opacity-0 translate-y-2 pointer-events-none"
 )}
 >
 {g.title}
 </p>
 ))}
 </div>
 </div>
 <div className="flex items-center justify-center shrink-0">
 <ChevronRight size={16} className="text-theme-text-sec" />
 </div>
 </div>
 ) : (
 <div className="flex items-center mt-0.5">
 <p className="text-sm font-medium text-theme-text-sec">All done for today.</p>
 </div>
 )}
 </>
 ) : (
 <div className="flex items-center justify-between mt-0.5">
 <p className="text-sm font-medium text-theme-text-sec">Set your first health goal.</p>
 <span className="text-xs font-bold text-theme-text-sec">
 Add Goal ›
 </span>
 </div>
 )}
 
          {/* Compact Weight Row within Today's Goals */}
          {weightSnapshot && (
            <>
              <div className="h-px bg-theme-border/50 my-3" />
              <div 
                className="flex items-center justify-between cursor-pointer group/weight"
                onClick={(e) => { e.stopPropagation(); onNavigate('fitness'); }}
              >
                <div className="flex items-end gap-3">
                  <div>
                    <h3 className="text-[10px] font-bold text-theme-text-sec mb-0.5 uppercase tracking-wider">Weight</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-theme-text">{weightSnapshot.latest.weight}</span>
                      <span className="text-xs font-medium text-theme-text-sec">kg</span>
                    </div>
                  </div>
                  {weightSnapshot.trend && (
                    <div className="flex items-center text-[12px] font-bold text-theme-text mb-1">
                      {weightSnapshot.trend.direction === 'down' ? <ArrowDown size={14} className="text-emerald-500 mr-0.5" /> : <ArrowUp size={14} className="text-red-500 mr-0.5" />}
                      {weightSnapshot.trend.pct.toFixed(1)}%
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  {weightSnapshot.trend ? (
                    <span className="text-xs font-medium text-theme-text-sec">
                      Logged {safeFormat(weightSnapshot.latest.date, 'MMM d')}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-theme-text-sec">
                      Logged {safeFormat(weightSnapshot.latest.date, 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

