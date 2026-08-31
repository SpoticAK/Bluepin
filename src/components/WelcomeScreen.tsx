import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Activity, FileText, ChevronRight, TrendingUp, Clock, Shield, Zap, Heart, Sparkles, Hash, Droplets, Eye, CircleDot, Bean, Brain } from 'lucide-react';
import { cn } from '../lib/utils';
import { LegalDocsModal } from './LegalDocsModal';


// --- Ambient Dynamic Curves ---
const AmbientCurves = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-white dark:bg-slate-950">
    <motion.svg
      animate={{ x: ['-100vw', '100vw'] }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute top-[15%] w-[120vw] h-[120px] opacity-60"
    >
      <path d="M 0 50 Q 250 150 500 50 T 1000 50" stroke="url(#grad-blue-1)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="grad-blue-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>

    <motion.svg
      animate={{ x: ['-100vw', '100vw'] }}
      transition={{ duration: 35, repeat: Infinity, ease: "linear", delay: 5 }}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute top-[35%] w-[140vw] h-[160px] opacity-50"
    >
      <path d="M 0 50 Q 250 -50 500 50 T 1000 50" stroke="url(#grad-emerald-1)" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="grad-emerald-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>

    <motion.svg
      animate={{ x: ['-100vw', '100vw'] }}
      transition={{ duration: 28, repeat: Infinity, ease: "linear", delay: 12 }}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute top-[50%] w-[100vw] h-[100px] opacity-60"
    >
      <path d="M 0 50 Q 250 150 500 50 T 1000 50" stroke="url(#grad-purple-1)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="grad-purple-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>

    <motion.svg
      animate={{ x: ['-100vw', '100vw'] }}
      transition={{ duration: 40, repeat: Infinity, ease: "linear", delay: 2 }}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute top-[70%] w-[150vw] h-[140px] opacity-40"
    >
      <path d="M 0 50 Q 250 -50 500 50 T 1000 50" stroke="url(#grad-blue-2)" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="grad-blue-2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>

    <motion.svg
      animate={{ x: ['-100vw', '100vw'] }}
      transition={{ duration: 30, repeat: Infinity, ease: "linear", delay: 8 }}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute top-[85%] w-[130vw] h-[90px] opacity-60"
    >
      <path d="M 0 50 Q 250 150 500 50 T 1000 50" stroke="url(#grad-emerald-2)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="grad-emerald-2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>

    <div className="absolute inset-0 backdrop-blur-[2px]"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white dark:via-slate-950/30 dark:to-slate-950"></div>
  </div>
);

// --- Shared Mockup Components ---
const MockupChart = () => (
  <div className="w-full h-48 md:h-64 flex items-end justify-between gap-1 md:gap-2 px-2">
    {[35, 45, 40, 60, 50, 75, 65, 80, 70, 85, 95, 80, 60, 50, 45, 55, 40].map((h, i) => (
      <motion.div 
        key={i}
        initial={{ height: 0 }}
        whileInView={{ height: `\${h}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
        className="flex-1 bg-theme-accent/20 rounded-t-sm relative group hover:bg-theme-accent/40 transition-colors"
      >
        <div className="absolute bottom-0 w-full bg-theme-accent/60 rounded-t-sm" style={{ height: '30%' }}></div>
      </motion.div>
    ))}
  </div>
);

const MockupReportItem = ({ title, date, status }: { title: string, date: string, status: 'stable' | 'up' | 'down' }) => (
  <div className="flex items-center p-4 border-b border-theme-border/40 last:border-0 hover:bg-theme-bg/50 transition-colors cursor-default">
    <div className="w-10 h-10 rounded bg-theme-bg flex items-center justify-center mr-4 shrink-0 border border-theme-border/50">
      <FileText className="w-5 h-5 text-theme-text-sec" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-base font-medium text-theme-text truncate">{title}</p>
      <p className="text-sm text-theme-text-sec">{date}</p>
    </div>
    <div className="flex items-center gap-2">
      {status === 'up' && <TrendingUp className="w-4 h-4 text-theme-warning" />}
      {status === 'stable' && <Activity className="w-4 h-4 text-theme-success" />}
    </div>
  </div>
);

// --- Sections ---

const Navbar = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => (
  <nav className="border-b border-theme-border/50 bg-white/80 dark:bg-theme-bg/80 backdrop-blur-xl sticky top-0 z-50">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/Bluepin.png" alt="Bluepin Logo" className="w-8 h-8 object-contain" />
        <span className="font-display font-bold text-xl tracking-tight">Blue<span className="font-medium opacity-80">pin.</span></span>
      </div>
      <div className="flex items-center gap-6">
        <button onClick={() => onStart(true)} className="text-base font-medium bg-white dark:bg-slate-900 text-blue-600 border border-slate-200 dark:border-slate-800 px-6 py-2.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
          Sign in
        </button>
      </div>
    </div>
  </nav>
);

const Hero = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => (
  <section className="pt-10 md:pt-16 pb-8 md:pb-12 px-6 md:px-12 max-w-[1400px] mx-auto relative z-10 flex flex-col items-start text-left">
    <div className="max-w-4xl flex flex-col items-start">
      <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-display tracking-tight text-theme-text leading-[1.05] md:leading-[1.1] mb-6">
        <span className="inline-block font-display font-black tracking-tight text-[1.15em] text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500 scale-y-110 origin-bottom pr-[0.05em]">Diabetes</span>
        {' '}management <br className="hidden lg:block" /> made <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">smarter.</span>
      </h1>
      <p className="text-xl md:text-2xl font-display text-theme-text max-w-3xl leading-relaxed mb-10 font-medium">
        Track your glucose to uncover trends and insights on your sugar levels and understand how your organs are doing over time
      </p>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative inline-block">
          <button onClick={() => onStart(false)} className="bg-blue-600 text-white text-lg px-10 py-4 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25">
            <span className="whitespace-nowrap">Get started :)</span>
          </button>
          <div className="absolute -top-3 -right-2 bg-emerald-500 text-white text-sm font-bold px-3 py-1 rounded-full rotate-[12deg] shadow-md border-2 border-white dark:border-slate-950 pointer-events-none z-10">
            Free!
          </div>
        </div>
        <button onClick={() => onStart(true)} className="bg-white dark:bg-slate-900 text-blue-600 border border-slate-200 dark:border-slate-800 text-lg px-10 py-4 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
          <span className="whitespace-nowrap">Sign in</span>
        </button>
      </div>
      
      <p className="text-lg md:text-xl font-poppins font-light text-theme-text max-w-2xl">
        Health apps were built to track. BluePin was built to understand.
      </p>

          </div>
  </section>
);


const FeatureCarousel = ({ 
  title, 
  subtitle, 
  images, 
  iconColor,
  titleGradient, 
  glowColor, 
  buttonColor, 
  activeIndicatorColor,
  stepNumber,
  stepGradient,
  reverse = false 
}: { 
  title: string, 
  subtitle: string, 
  images: string[], 
  iconColor: string,
  titleGradient?: string, 
  glowColor: string, 
  buttonColor: string, 
  activeIndicatorColor: string,
  stepNumber: number,
  stepGradient: string,
  reverse?: boolean 
}) => {
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % images.length);

  return (
    <div className="flex flex-col items-start gap-10 w-full text-left">
      {/* 1. Title */}
      <div className="inline-flex items-center gap-3 relative z-10">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex shrink-0 items-center justify-center text-white font-bold text-lg md:text-xl shadow-md ${stepGradient}`}>
          {stepNumber}
        </div>
        <h3 className={`text-3xl md:text-4xl font-garet tracking-tight font-bold ${titleGradient || iconColor}`}>
          {title}
        </h3>
      </div>
      
      {/* 2. Images (Carousel) */}
      <div className="w-full flex flex-col justify-start relative items-start">
        <div className="relative flex items-center justify-start mb-6 pl-2">
          <div className="relative w-64 md:w-80 bg-white dark:bg-slate-950 rounded-[2.5rem] border-[8px] border-slate-900 dark:border-slate-800 shadow-2xl overflow-hidden z-10 shadow-black/5">
            <AnimatePresence mode="wait">
              <motion.img 
                key={currentSlide}
                src={images[currentSlide]} 
                alt={`${title} Screenshot`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-auto object-cover" 
              />
            </AnimatePresence>
          </div>
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 ${glowColor} blur-3xl rounded-full z-0 pointer-events-none`}></div>
          
          {/* Next Button */}
          <button 
            onClick={nextSlide}
            className={`absolute -right-5 md:-right-10 z-20 w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform border border-slate-200 dark:border-slate-700 ${buttonColor}`}
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        </div>
        
        {/* Pagination Indicators */}
        <div className="flex items-center gap-2 z-10">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                currentSlide === idx 
                  ? `w-8 ${activeIndicatorColor}` 
                  : "w-3 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* 3. Content (Subtitle) - Speech Bubble */}
      <div className="relative mt-2 max-w-2xl">
        {/* Speech Bubble Tail */}
        <div className="absolute -top-3 left-16 w-6 h-6 bg-white dark:bg-slate-800 border-l border-t border-slate-200 dark:border-slate-700 transform rotate-45 rounded-tl-[4px] z-10"></div>
        {/* Speech Bubble Body */}
        <div className="relative z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 md:p-8 shadow-lg shadow-slate-200/50 dark:shadow-none">
          <p className="text-[17px] md:text-lg font-poppins text-theme-text font-normal leading-relaxed m-0">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};


const GetStartedButton = ({ onStart }: { onStart: (v?: boolean) => void }) => (
  <div className="mt-12 flex justify-start w-full max-w-5xl mx-auto">
    <div className="relative inline-block w-auto">
      <button onClick={() => onStart(false)} className="bg-blue-600 text-white text-lg px-10 py-4 rounded-full font-medium flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25">
        <span className="whitespace-nowrap">Get started :)</span>
      </button>
      <div className="absolute -top-3 -right-2 bg-emerald-500 text-white text-sm font-bold px-3 py-1 rounded-full rotate-[12deg] shadow-md border-2 border-white dark:border-slate-950 pointer-events-none z-10">
        Free!
      </div>
    </div>
  </div>
);

const FeatureShowcase = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => {
  return (
    <section className="pt-12 pb-16 md:pt-16 md:pb-24 px-6 md:px-12 max-w-[1400px] mx-auto relative z-10 border-t border-theme-border/40 mt-8 md:mt-12">
      <div className="max-w-5xl mx-auto mb-16 md:mb-20 text-left">
        <h2 className="text-4xl md:text-5xl font-display tracking-tight text-theme-text font-bold mb-6">
          Why BluePin?
        </h2>
        <p className="text-xl md:text-2xl font-display text-theme-text max-w-3xl leading-relaxed font-medium">
          We connect your glucose and health data over time to help you stay ahead of its long-term impact on your organs! Because diabetes is not a simple blood sugar problem :)
        </p>
      </div>

      <div className="flex flex-col gap-16 md:gap-20">
        <FeatureCarousel 
          title="Glucose Tracking"
          subtitle="Record your glucose daily manually or by uploading pics of your glucometers. See your glucose behaviour with graph trends and Bluepin-AI powered Insights :)"
          images={[
            "/glucose1.PNG",
            "/glucose2.PNG",
            "/glucose3.PNG"
          ]}
          iconColor="text-blue-500"
          titleGradient="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 pb-1"
          stepNumber={1}
          stepGradient="bg-gradient-to-br from-blue-500 to-cyan-400"
          glowColor="bg-emerald-500/20"
          buttonColor="text-blue-600 dark:text-blue-400"
          activeIndicatorColor="bg-blue-600"
        />

        <FeatureCarousel 
          title="Health Canvas"
          subtitle="Upload your health reports and see how your organ health changes over time. Uncover patterns with BluePin Intelligence to know which areas need help :)"
          images={[
            "/health1.PNG",
            "/health2.PNG",
            "/health3.PNG"
          ]}
          iconColor="text-emerald-500"
          titleGradient="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 pb-1"
          stepNumber={2}
          stepGradient="bg-gradient-to-br from-emerald-500 to-teal-400"
          glowColor="bg-emerald-500/20"
          buttonColor="text-emerald-600 dark:text-emerald-400"
          activeIndicatorColor="bg-emerald-500"
          reverse={true}
        />
      </div>
      <GetStartedButton onStart={onStart} />
    </section>
  );
};

const LiverIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 8c-2-2-5-2-8-1-2.5.8-6 2-7 5-1 3 0 6 3 6 1.5 0 3-1.5 3-3 0-1 1-1.5 2-1.5 1.5 0 3 1.5 3 3 0 1 1 2 2.5 2 1.5 0 2.5-1 2.5-2.5C21 13 21 10 19 8z"/>
  </svg>
);

const complications = [
  {
    id: 'ckd',
    title: 'CKD',
    stat: '1 in 3',
    desc: 'people with diabetes develop kidney disease',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: Bean,
  },
  {
    id: 'retinopathy',
    title: 'Retinopathy',
    stat: '1 in 3',
    desc: 'people with diabetes develop diabetic retinopathy',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    icon: Eye,
  },
  {
    id: 'cvd',
    title: 'CVD Risk',
    stat: '3× higher',
    desc: 'risk of cardiovascular disease',
    iconColor: 'text-rose-500 dark:text-rose-400',
    icon: Heart,
  },
  {
    id: 'liver',
    title: 'Fatty Liver',
    stat: '65%',
    desc: 'of people with diabetes have fatty liver',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: LiverIcon,
  },
  {
    id: 'neuropathy',
    title: 'Neuropathy',
    stat: '50%',
    desc: 'of people with diabetes experience neuropathy',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: Brain,
  }
];

const MultiOrganProblem = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => {
  return (
    <section className="py-6 md:py-10 relative z-10 bg-transparent border-t border-theme-border/40">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 text-center">
        <div className="max-w-4xl mx-auto text-left w-full">
          <h2 className="text-3xl md:text-4xl font-display tracking-tight text-theme-text mb-3 font-bold">Why it matters</h2>
          <p className="text-xl md:text-2xl font-display text-theme-text max-w-3xl leading-relaxed mb-6 font-medium">
            Diabetes affects your entire body. Most diabetes apps only track your sugar.
          </p>
        </div>

        {/* Premium Scientific Cards List */}
        <div className="max-w-4xl mx-auto flex flex-col gap-3 mb-8">
          {complications.map((comp, idx) => (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="w-full p-4 sm:p-5 rounded-xl border border-theme-border/60 bg-white/40 dark:bg-theme-card/30 backdrop-blur-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center text-left gap-3 sm:gap-6 hover:bg-white/70 dark:hover:bg-theme-card/70 transition-colors duration-200"
            >
              {/* Icon & Title Group */}
              <div className="flex items-center gap-3 sm:w-48 lg:w-56 shrink-0">
                <comp.icon className={`w-8 h-8 shrink-0 ${comp.iconColor}`} strokeWidth={1.5} />
                <h4 className="text-[17px] font-semibold text-theme-text tracking-tight m-0">{comp.title}</h4>
              </div>
              
              {/* Statistic & Description Group */}
              <div className="flex flex-row flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-x-2 sm:gap-x-3 gap-y-1 flex-1">
                <h3 className={`text-2xl md:text-3xl font-poppins font-bold tracking-tight ${comp.iconColor} shrink-0`}>{comp.stat}</h3>
                <p className="text-[14px] text-theme-text-sec font-medium leading-snug m-0">{comp.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto w-full text-left">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-display font-medium text-theme-text leading-tight"
          >
            Your diabetes care should look <br className="hidden md:block" /> <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-600 pb-1">beyond glucose.</span>
          </motion.h3>
          <GetStartedButton onStart={onStart} />
        </div>
      </div>
    </section>
  );
};

const HowItWorks = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => (
  <section className="py-24 bg-white/60 dark:bg-theme-card/60 backdrop-blur-2xl border-t border-theme-border/40 relative z-10">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12">
      <h2 className="text-4xl md:text-5xl font-display tracking-tight text-theme-text mb-16 text-left font-bold max-w-5xl mx-auto">How BluePin works</h2>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 max-w-5xl mx-auto">
        <div className="flex flex-col gap-3">
          <h3 className="text-xl md:text-2xl font-display text-theme-text font-medium flex items-center">
            <div className="flex items-center text-blue-500 mr-2">
              <span className="font-bold">01</span>
              <ArrowRight className="w-5 h-5 ml-1" strokeWidth={2.5} />
            </div>
            Add your health data
          </h3>
          <p className="text-theme-text-sec text-lg leading-relaxed font-display font-light">Glucose readings, blood reports, HbA1c and more.</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-xl md:text-2xl font-display text-theme-text font-medium flex items-center">
            <div className="flex items-center text-emerald-500 mr-2">
              <span className="font-bold">02</span>
              <ArrowRight className="w-5 h-5 ml-1" strokeWidth={2.5} />
            </div>
            Build your health history
          </h3>
          <p className="text-theme-text-sec text-lg leading-relaxed font-display font-light">BluePin brings your data together over time.</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-xl md:text-2xl font-display text-theme-text font-medium flex items-center">
            <div className="flex items-center text-violet-500 mr-2">
              <span className="font-bold">03</span>
              <ArrowRight className="w-5 h-5 ml-1" strokeWidth={2.5} />
            </div>
            Discover trends & patterns
          </h3>
          <p className="text-theme-text-sec text-lg leading-relaxed font-display font-light">BluePin Intelligence connects the dots across your history.</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-xl md:text-2xl font-display text-theme-text font-medium flex items-center">
            <div className="flex items-center text-amber-500 mr-2">
              <span className="font-bold">04</span>
              <ArrowRight className="w-5 h-5 ml-1" strokeWidth={2.5} />
            </div>
            Get meaningful insights
          </h3>
          <p className="text-theme-text-sec text-lg leading-relaxed font-display font-light">Understand what's changing and where your health may need attention.</p>
        </div>
      </div>
      <GetStartedButton onStart={onStart} />
    </div>
  </section>
);

const TrustAndFooter = ({ openLegal }: { openLegal: (tab: 'terms' | 'privacy') => void }) => (
  <footer className="bg-white/90 dark:bg-theme-card/90 backdrop-blur-3xl border-t border-theme-border relative z-10">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-16 pb-12">
      {/* Trust & Safety */}
      <div className="border-b border-theme-border/50 pb-12 mb-12">
        <div className="max-w-xl mx-auto md:mx-0 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
            <Shield className="w-5 h-5 text-theme-text" />
            <h4 className="text-xl font-medium">Privacy & Security</h4>
          </div>
          <p className="text-theme-text-sec">Your health data is encrypted and securely stored. BluePin is designed to help you organize your personal health information safely.</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-theme-text-sec">
        <div className="flex items-center gap-2">
           <img src="/Bluepin.png" alt="Bluepin Logo" className="w-5 h-5 grayscale opacity-50" />
           <span>&copy; {new Date().getFullYear()} Bluepin. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <button onClick={() => openLegal('terms')} className="hover:text-theme-text transition-colors">Terms of Service</button>
          <button onClick={() => openLegal('privacy')} className="hover:text-theme-text transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  </footer>
);

export default function WelcomeScreen({ onStart }: { onStart: (isLogin?: boolean) => void }) {
  const [legalModalOpen, setLegalModalOpen] = React.useState(false);
  const [legalTab, setLegalTab] = React.useState<'terms' | 'privacy'>('terms');

  const openLegal = (tab: 'terms' | 'privacy') => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-theme-text font-sans antialiased selection:bg-purple-500/30 overflow-hidden relative z-0">
      <AmbientCurves />
      <Navbar onStart={onStart} />
      <main>
        <Hero onStart={onStart} />
        <FeatureShowcase onStart={onStart} />
        <MultiOrganProblem onStart={onStart} />
        <HowItWorks onStart={onStart} />
      </main>
      <TrustAndFooter openLegal={openLegal} />
      <LegalDocsModal 
        isOpen={legalModalOpen} 
        onClose={() => setLegalModalOpen(false)} 
        defaultTab={legalTab} 
      />
    </div>
  );
}