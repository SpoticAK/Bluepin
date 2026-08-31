import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

// --- Ambient Background with tasteful gradient curves & blur ---
const AmbientBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 flex justify-center">
    {/* Abstract blurred orb 1 */}
    <motion.div
      animate={{
        scale: [1, 1.1, 1],
        opacity: [0.3, 0.5, 0.3],
        rotate: [0, 90, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-blue-500/10 blur-[100px] md:blur-[120px]"
    />
    {/* Abstract blurred orb 2 */}
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.2, 0.4, 0.2],
        rotate: [0, -90, 0]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute top-[10%] -right-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-[40%] bg-theme-accent/10 blur-[100px] md:blur-[120px]"
    />
    {/* Sweeping precise geometric curve */}
    <div className="absolute top-[20%] inset-x-0 h-[400px] opacity-40">
      <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="w-full h-full">
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          d="M 0 300 C 300 300, 400 100, 1000 200"
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="var(--color-theme-accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);

// --- Abstract Hero Data Visualization ---
const HeroVisual = () => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
    className="relative w-full max-w-5xl mx-auto mt-12 md:mt-20 aspect-[4/3] md:aspect-[24/9] rounded-[2rem] border border-theme-border/40 bg-theme-card/20 backdrop-blur-3xl overflow-hidden shadow-2xl"
  >
    {/* Inner subtle glow gradient mask */}
    <div className="absolute inset-0 bg-gradient-to-t from-theme-bg/90 via-transparent to-transparent z-10 pointer-events-none"></div>

    {/* Minimalist Grid */}
    <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
       <line x1="0" y1="33" x2="100" y2="33" stroke="currentColor" className="text-theme-text" strokeWidth="0.2" strokeDasharray="1 2" />
       <line x1="0" y1="66" x2="100" y2="66" stroke="currentColor" className="text-theme-text" strokeWidth="0.2" strokeDasharray="1 2" />
       <line x1="33" y1="0" x2="33" y2="100" stroke="currentColor" className="text-theme-text" strokeWidth="0.2" strokeDasharray="1 2" />
       <line x1="66" y1="0" x2="66" y2="100" stroke="currentColor" className="text-theme-text" strokeWidth="0.2" strokeDasharray="1 2" />
    </svg>

    {/* Animated Data Spline */}
    <svg viewBox="0 0 1000 400" className="absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]" preserveAspectRatio="none">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, ease: "easeInOut", delay: 0.5 }}
        d="M -50 350 C 150 350, 200 100, 400 150 C 600 200, 700 250, 850 100 C 950 0, 1050 150, 1100 150"
        fill="none"
        stroke="url(#splineGrad)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="splineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="var(--color-theme-accent)" />
        </linearGradient>
      </defs>
    </svg>

    {/* Floating Dynamic Nodes (Abstract representations of data points) */}
    <motion.div
      animate={{ y: [-8, 8, -8] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[20%] right-[15%] md:right-[25%] z-20 px-4 py-2 rounded-2xl bg-theme-card border border-theme-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl"
    >
      <div className="flex flex-col">
        <span className="text-[10px] text-theme-text-sec uppercase tracking-widest font-semibold">Variance</span>
        <span className="font-mono text-base md:text-lg font-medium text-theme-text">+1.2%</span>
      </div>
    </motion.div>

    <motion.div
      animate={{ y: [6, -6, 6] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      className="absolute bottom-[35%] left-[10%] md:left-[20%] z-20 px-4 py-2 rounded-2xl bg-theme-card border border-theme-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl"
    >
      <div className="flex flex-col">
        <span className="text-[10px] text-theme-text-sec uppercase tracking-widest font-semibold">Synthesis</span>
        <span className="font-mono text-base md:text-lg font-medium text-theme-text">Stable</span>
      </div>
    </motion.div>
  </motion.div>
);

// --- Abstract Bento Grid ---
const AbstractBento = () => (
  <section className="max-w-6xl mx-auto px-4 py-24 md:py-32 relative z-10">
    <div className="grid md:grid-cols-3 gap-6">
      
      {/* Box 1: Fluid Tracking */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="col-span-1 md:col-span-2 rounded-[2rem] bg-theme-card/40 border border-theme-border/40 backdrop-blur-2xl p-8 md:p-12 overflow-hidden relative group min-h-[320px] flex flex-col justify-end transition-colors hover:bg-theme-card/60"
      >
        <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none">
          <svg viewBox="0 0 400 200" className="w-full h-full drop-shadow-[0_0_10px_var(--color-theme-accent)]" preserveAspectRatio="none">
             <motion.path
                animate={{ d: [
                  "M 0 100 C 100 50, 300 150, 400 100",
                  "M 0 100 C 100 150, 300 50, 400 100",
                  "M 0 100 C 100 50, 300 150, 400 100"
                ]}}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                fill="none" stroke="var(--color-theme-accent)" strokeWidth="1.5"
             />
          </svg>
        </div>
        <div className="relative z-10 mt-auto">
          <h3 className="font-display text-2xl md:text-3xl font-semibold mb-3 text-theme-text">Fluid Tracking.</h3>
          <p className="text-theme-text-sec text-base md:text-lg max-w-sm leading-relaxed">Watch the noise fade. We extract pure signal from your daily glucose markers.</p>
        </div>
      </motion.div>

      {/* Box 2: Unified History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ delay: 0.1 }}
        className="col-span-1 rounded-[2rem] bg-theme-card/40 border border-theme-border/40 backdrop-blur-2xl p-8 md:p-12 overflow-hidden relative group min-h-[320px] flex flex-col justify-end transition-colors hover:bg-theme-card/60"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <motion.div
             animate={{ rotate: 5, y: -8 }}
             transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
             className="absolute w-28 h-36 rounded-xl border border-theme-border/40 bg-theme-bg/50 backdrop-blur-sm shadow-sm translate-x-4 -rotate-6"
           />
           <motion.div
             animate={{ rotate: -5, y: 8 }}
             transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatType: "reverse", delay: 0.5 }}
             className="absolute w-28 h-36 rounded-xl border border-theme-border/60 bg-theme-card/90 backdrop-blur-xl shadow-lg -translate-x-4 rotate-3"
           />
        </div>
        <div className="relative z-10 mt-auto">
          <h3 className="font-display text-2xl md:text-3xl font-semibold mb-3 text-theme-text">Unified History.</h3>
          <p className="text-theme-text-sec text-base md:text-lg leading-relaxed">Every scattered lab report, synthesized into one timeline.</p>
        </div>
      </motion.div>

      {/* Box 3: AI Intelligence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ delay: 0.2 }}
        className="col-span-1 md:col-span-3 rounded-[2rem] bg-theme-card/40 border border-theme-border/40 backdrop-blur-2xl p-8 md:p-14 overflow-hidden relative group min-h-[300px] flex flex-col md:flex-row items-center justify-between transition-colors hover:bg-theme-card/60"
      >
        <div className="relative z-10 md:max-w-2xl mb-12 md:mb-0 text-center md:text-left w-full">
          <h3 className="font-display text-3xl md:text-4xl font-semibold mb-4 text-theme-text">Clarity through Intelligence.</h3>
          <p className="text-theme-text-sec text-lg md:text-xl leading-relaxed">Our engine doesn't just store data; it understands it. Spotting micro-trends before they become macro-problems.</p>
        </div>
        
        {/* Abstract Orbiting Nodes */}
        <div className="relative w-40 h-40 md:w-56 md:h-56 flex items-center justify-center shrink-0 pointer-events-none">
           <motion.div
             animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
             className="absolute w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-500/20 blur-xl"
           />
           <div className="absolute w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,1)]" />
           
           {[0, 1, 2].map((i) => (
             <motion.div
               key={i}
               animate={{ rotate: 360 }}
               transition={{ duration: 12 + i * 4, repeat: Infinity, ease: "linear", delay: i * 2 }}
               className="absolute w-full h-full"
               style={{ border: '1px solid var(--color-theme-border)', borderRadius: '50%', transform: `scale(${0.5 + i * 0.25})`, opacity: 0.5 }}
             >
                <div className="absolute top-0 left-1/2 w-1.5 h-1.5 md:w-2 md:h-2 bg-theme-text rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_currentColor]" />
             </motion.div>
           ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// --- Bottom Call to Action ---
const BottomCTA = ({ onStart }: { onStart: (v?: boolean) => void }) => (
  <section className="relative py-32 px-4 flex flex-col items-center justify-center text-center overflow-hidden border-t border-theme-border/20 bg-theme-card/10 backdrop-blur-sm">
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       whileInView={{ opacity: 1, y: 0 }}
       viewport={{ once: true }}
       className="relative z-10 max-w-2xl mx-auto"
     >
       <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-semibold mb-6 tracking-tight text-theme-text">The clarity you deserve.</h2>
       <p className="text-xl md:text-2xl text-theme-text-sec mb-12 font-editorial italic">Join Bluepin and let your data speak clearly.</p>
       <button onClick={() => onStart(false)} className="group inline-flex items-center justify-center gap-3 px-10 py-5 bg-theme-text text-theme-bg rounded-full transition-transform active:scale-95 shadow-xl hover:opacity-90">
         <span className="font-medium text-lg">Initialize Setup</span>
         <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
       </button>
     </motion.div>
  </section>
);

// --- Main Layout ---
export default function WelcomeScreen({ onStart }: { onStart: (isLogin?: boolean) => void }) {
  return (
    <div className="min-h-screen bg-theme-bg text-theme-text font-sans selection:bg-theme-accent/20 overflow-x-hidden">
      <AmbientBackground />
      
      {/* Minimalist Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-theme-border/30 bg-theme-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/Bluepin.png" alt="Bluepin Logo" className="w-7 h-7 object-contain drop-shadow-sm" />
            <span className="font-display font-bold text-xl tracking-tighter">Bluepin</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onStart(true)} className="text-sm font-medium text-theme-text-sec hover:text-theme-text transition-colors px-2 py-2">
              Log in
            </button>
            <button onClick={() => onStart(false)} className="text-sm font-medium bg-theme-text text-theme-bg px-5 py-2 rounded-full transition-transform active:scale-95 hover:opacity-90">
              Start Free
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 md:pt-48 pb-10">
        {/* Hero Copy */}
        <section className="px-4 max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-accent/10 border border-theme-accent/20 text-theme-accent text-xs font-medium uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse"></span>
              Precision Health
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-display font-semibold tracking-tighter text-theme-text leading-[1.05] md:leading-[1] mb-8">
              Decoding your <br className="hidden md:block" /> metabolic health.
            </h1>
            
            <p className="text-lg md:text-2xl text-theme-text-sec max-w-2xl mx-auto mb-10 leading-relaxed">
              Transforming scattered glucose readings and static lab reports into a fluid, understandable story.
            </p>
            
            <button onClick={() => onStart(false)} className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-theme-text text-theme-bg rounded-full transition-transform active:scale-95 shadow-2xl hover:opacity-90">
              <span className="font-medium text-base">Begin Analysis</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </section>

        <HeroVisual />
        <AbstractBento />
        <BottomCTA onStart={onStart} />
      </main>
      
      {/* Footer */}
      <footer className="py-8 border-t border-theme-border/20 bg-theme-bg/50 backdrop-blur-md text-center text-theme-text-sec text-sm flex flex-col items-center gap-2">
        <p>&copy; {new Date().getFullYear()} Bluepin. Abstracted for clarity.</p>
        <p className="text-xs opacity-60">Not a replacement for professional medical advice.</p>
      </footer>
    </div>
  );
}
