#!/bin/bash

cat << 'INNER_EOF' > src/components/WelcomeScreen.tsx
import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Activity, FileText, ChevronRight, TrendingUp, Clock, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

// --- Shared Mockup Components ---
const MockupChart = () => (
  <div className="w-full h-48 md:h-64 flex items-end justify-between gap-1 md:gap-2 px-2">
    {[35, 45, 40, 60, 50, 75, 65, 80, 70, 85, 95, 80, 60, 50, 45, 55, 40].map((h, i) => (
      <motion.div 
        key={i}
        initial={{ height: 0 }}
        whileInView={{ height: \`\${h}%\` }}
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
  <nav className="border-b border-theme-border/50 bg-theme-bg/95 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/Bluepin.png" alt="Bluepin Logo" className="w-8 h-8 object-contain" />
        <span className="font-editorial text-2xl tracking-tight text-theme-text font-medium">Bluepin</span>
      </div>
      <div className="flex items-center gap-6">
        <button onClick={() => onStart(true)} className="text-base font-medium text-theme-text-sec hover:text-theme-text transition-colors">
          Log in
        </button>
        <button onClick={() => onStart(false)} className="text-base font-medium bg-theme-text text-theme-bg px-6 py-2.5 rounded hover:opacity-90 transition-opacity">
          Start Free
        </button>
      </div>
    </div>
  </nav>
);

const Hero = ({ onStart }: { onStart: (isLogin?: boolean) => void }) => (
  <section className="pt-24 md:pt-32 pb-16 px-6 md:px-12 max-w-[1400px] mx-auto">
    <div className="max-w-4xl">
      <h1 className="text-5xl md:text-7xl lg:text-8xl font-editorial tracking-tight text-theme-text leading-[1.05] mb-8">
        Your health history, <br className="hidden md:block" /> clearly understood.
      </h1>
      <p className="text-xl md:text-2xl text-theme-text-sec max-w-2xl leading-relaxed mb-12 font-light">
        BluePin connects the dots between your daily glucose readings and long-term medical reports, turning isolated numbers into a meaningful timeline.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={() => onStart(false)} className="bg-theme-text text-theme-bg text-lg px-8 py-4 rounded font-medium flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
          Start Free
          <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={() => onStart(true)} className="bg-theme-card border border-theme-border text-theme-text text-lg px-8 py-4 rounded font-medium hover:bg-theme-card-sec transition-colors text-center">
          Log in to your account
        </button>
      </div>
    </div>
  </section>
);

const ProductDemonstration = () => (
  <section className="px-6 md:px-12 pb-24 max-w-[1400px] mx-auto -mt-4">
    <div className="bg-theme-card border border-theme-border rounded-xl shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[500px]">
      {/* Sidebar: Reports */}
      <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-theme-border bg-theme-bg/30 flex flex-col">
        <div className="p-6 border-b border-theme-border/50 flex items-center justify-between">
          <h3 className="font-editorial text-2xl text-theme-text">Lab Reports</h3>
          <span className="text-sm text-theme-text-sec">Last 12 months</span>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <MockupReportItem title="Comprehensive Metabolic Panel" date="Oct 12, 2026" status="stable" />
          <MockupReportItem title="Lipid Panel Results" date="Sep 04, 2026" status="up" />
          <MockupReportItem title="Complete Blood Count" date="Jun 15, 2026" status="stable" />
          <MockupReportItem title="HbA1c & Fasting Glucose" date="Mar 22, 2026" status="up" />
        </div>
      </div>
      
      {/* Main Content: Glucose Trend */}
      <div className="w-full lg:w-2/3 p-6 md:p-12 flex flex-col justify-between bg-theme-card">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-editorial text-3xl md:text-4xl text-theme-text">Glucose Trends</h3>
            <div className="flex items-center gap-2 bg-theme-bg px-3 py-1 rounded text-sm text-theme-text-sec border border-theme-border/50">
              <Activity className="w-4 h-4 text-theme-accent" />
              <span>Live Analysis</span>
            </div>
          </div>
          <p className="text-lg text-theme-text-sec">Estimated HbA1c trending towards 6.1% based on recent logs.</p>
        </div>
        <MockupChart />
        <div className="flex justify-between text-sm text-theme-text-sec mt-4 border-t border-theme-border/50 pt-4">
          <span>Sep 01</span>
          <span>Sep 15</span>
          <span>Sep 30</span>
        </div>
      </div>
    </div>
  </section>
);

const CoreBenefits = () => (
  <section className="py-24 bg-theme-bg border-t border-theme-border/40">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12">
      <div className="mb-20 max-w-3xl">
        <h2 className="text-4xl md:text-5xl font-editorial tracking-tight text-theme-text mb-6">See the complete picture.</h2>
        <p className="text-xl text-theme-text-sec font-light leading-relaxed">Stop managing your health through isolated numbers. BluePin brings context to your data, helping you and your doctor make better decisions.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 mb-24 items-center">
        <div className="order-2 lg:order-1 relative bg-theme-card border border-theme-border rounded-xl p-8 shadow-sm h-[320px] flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-theme-bg to-theme-card rounded-xl -z-10"></div>
          <div className="flex items-end justify-between gap-2 h-32 mb-6 border-b border-theme-border/50 pb-4">
             {[4, 5, 3, 6, 7, 5, 8].map((v, i) => (
                <div key={i} className="w-full bg-theme-text opacity-20 rounded-t" style={{ height: \`\${v * 10}%\` }}></div>
             ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-editorial text-3xl">Estimated HbA1c</span>
            <span className="text-2xl font-medium text-theme-accent">6.2%</span>
          </div>
        </div>
        <div className="order-1 lg:order-2 max-w-xl">
          <div className="w-12 h-12 bg-theme-card border border-theme-border rounded flex items-center justify-center mb-6 text-theme-text">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-3xl font-editorial mb-4">Understand glucose trends</h3>
          <p className="text-lg text-theme-text-sec leading-relaxed">Log your daily readings and let BluePin visualize the trends. We automatically calculate estimates like HbA1c, smoothing out daily fluctuations so you can see your true progress.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        <div className="max-w-xl">
          <div className="w-12 h-12 bg-theme-card border border-theme-border rounded flex items-center justify-center mb-6 text-theme-text">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-3xl font-editorial mb-4">Track changes across reports</h3>
          <p className="text-lg text-theme-text-sec leading-relaxed">Upload your PDF lab results. BluePin extracts the biomarkers and builds a historical timeline, instantly highlighting what has improved and what needs attention since your last visit.</p>
        </div>
        <div className="relative bg-theme-card border border-theme-border rounded-xl p-8 shadow-sm h-[320px] flex flex-col justify-center gap-6">
           <div className="flex items-center justify-between p-4 border border-theme-border/50 bg-theme-bg/50 rounded">
             <span className="text-lg">Cholesterol, Total</span>
             <div className="flex items-center gap-3">
               <span className="text-theme-text-sec line-through">210</span>
               <span className="text-theme-success font-medium">185 mg/dL</span>
               <TrendingUp className="w-4 h-4 text-theme-success rotate-180" />
             </div>
           </div>
           <div className="flex items-center justify-between p-4 border border-theme-border/50 bg-theme-bg/50 rounded">
             <span className="text-lg">Triglycerides</span>
             <div className="flex items-center gap-3">
               <span className="text-theme-text-sec line-through">160</span>
               <span className="text-theme-warning font-medium">145 mg/dL</span>
               <TrendingUp className="w-4 h-4 text-theme-warning rotate-180" />
             </div>
           </div>
        </div>
      </div>
    </div>
  </section>
);

const HowItWorks = () => (
  <section className="py-24 bg-theme-card border-t border-theme-border/40">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12">
      <h2 className="text-4xl md:text-5xl font-editorial tracking-tight text-theme-text mb-16 text-center">How BluePin works</h2>
      
      <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
        <div className="flex flex-col">
          <div className="text-5xl font-editorial text-theme-text-sec/30 mb-6 border-b border-theme-border/50 pb-6">01</div>
          <h3 className="text-2xl font-medium mb-3">Add your health data</h3>
          <p className="text-theme-text-sec text-lg leading-relaxed">Log your daily glucose readings, or securely upload your PDF lab reports directly from your healthcare provider.</p>
        </div>
        <div className="flex flex-col">
          <div className="text-5xl font-editorial text-theme-text-sec/30 mb-6 border-b border-theme-border/50 pb-6">02</div>
          <h3 className="text-2xl font-medium mb-3">See trends & changes</h3>
          <p className="text-theme-text-sec text-lg leading-relaxed">Our system organizes your data visually, highlighting upward or downward trends without the clinical jargon.</p>
        </div>
        <div className="flex flex-col">
          <div className="text-5xl font-editorial text-theme-text-sec/30 mb-6 border-b border-theme-border/50 pb-6">03</div>
          <h3 className="text-2xl font-medium mb-3">Build your history</h3>
          <p className="text-theme-text-sec text-lg leading-relaxed">Over time, you create a comprehensive, organized archive of your health that you can easily share with your doctor.</p>
        </div>
      </div>
    </div>
  </section>
);

const Philosophy = () => (
  <section className="py-32 bg-theme-bg border-t border-theme-border/40 text-center px-6">
    <div className="max-w-4xl mx-auto">
      <Clock className="w-8 h-8 text-theme-text-sec mx-auto mb-8" />
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-editorial tracking-tight text-theme-text leading-[1.2] mb-8">
        Health is a continuous history, <br className="hidden md:block" /> not a snapshot.
      </h2>
      <p className="text-xl md:text-2xl text-theme-text-sec font-light max-w-2xl mx-auto">
        Looking at a single lab report is like looking at one frame of a movie. BluePin stitches the frames together so you can see the whole story.
      </p>
    </div>
  </section>
);

const TrustAndFooter = ({ onStart }: { onStart: (v?: boolean) => void }) => (
  <footer className="bg-theme-card border-t border-theme-border">
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-24 pb-12">
      {/* Final CTA */}
      <div className="bg-theme-bg border border-theme-border p-12 md:p-20 rounded-2xl text-center max-w-4xl mx-auto mb-24">
        <h2 className="text-4xl md:text-5xl font-editorial text-theme-text mb-6">Start building your timeline.</h2>
        <p className="text-xl text-theme-text-sec mb-10 max-w-xl mx-auto">Join BluePin today to organize your medical reports and understand your glucose trends.</p>
        <button onClick={() => onStart(false)} className="bg-theme-text text-theme-bg text-lg px-10 py-4 rounded font-medium inline-flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
          Start Free
        </button>
      </div>

      {/* Trust & Safety */}
      <div className="grid md:grid-cols-2 gap-12 border-b border-theme-border/50 pb-12 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-theme-text" />
            <h4 className="text-xl font-medium">Privacy & Security</h4>
          </div>
          <p className="text-theme-text-sec max-w-md">Your health data is encrypted and securely stored. BluePin is designed to help you organize your personal health information safely.</p>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-theme-text" />
            <h4 className="text-xl font-medium">A Companion Tool</h4>
          </div>
          <p className="text-theme-text-sec max-w-md">BluePin provides organization and analysis of your data. It does not provide medical diagnoses and does not replace the advice of a qualified healthcare professional.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-theme-text-sec">
        <div className="flex items-center gap-2">
           <img src="/Bluepin.png" alt="Bluepin Logo" className="w-5 h-5 grayscale opacity-50" />
           <span>&copy; {new Date().getFullYear()} Bluepin. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <button className="hover:text-theme-text transition-colors">Terms of Service</button>
          <button className="hover:text-theme-text transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  </footer>
);

export default function WelcomeScreen({ onStart }: { onStart: (isLogin?: boolean) => void }) {
  return (
    <div className="min-h-screen bg-theme-bg text-theme-text font-sans antialiased selection:bg-theme-border">
      <Navbar onStart={onStart} />
      <main>
        <Hero onStart={onStart} />
        <ProductDemonstration />
        <CoreBenefits />
        <HowItWorks />
        <Philosophy />
      </main>
      <TrustAndFooter onStart={onStart} />
    </div>
  );
}
INNER_EOF

chmod +x src/components/WelcomeScreen.tsx
