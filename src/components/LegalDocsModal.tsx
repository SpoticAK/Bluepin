import React from 'react';
import { X } from 'lucide-react';
import { LegalDocType } from '../lib/consentManager';
import { cn } from '../lib/utils';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalDocType;
}

export function LegalDocsModal({ isOpen, onClose, defaultTab = 'terms' }: LegalDocsModalProps) {
  const [activeTab, setActiveTab] = React.useState<LegalDocType>(defaultTab);

  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-theme-text/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-card w-full max-w-3xl max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-theme-border">
          <h2 className="text-xl font-bold text-theme-text">Legal Documents</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-theme-bg hover:bg-theme-border text-theme-text-sec hover:text-theme-text rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex bg-theme-bg p-2 sm:px-6 overflow-x-auto border-b border-theme-border gap-2 shrink-0 hide-scrollbar">
          {(['terms', 'privacy'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors",
                activeTab === tab 
                  ? "bg-theme-card text-theme-text shadow-sm" 
                  : "text-theme-text-sec hover:text-theme-text hover:bg-theme-card/50"
              )}
            >
              {tab === 'terms' && 'Terms of Service'}
              {tab === 'privacy' && 'Privacy Policy'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="prose prose-sm md:prose-base max-w-none text-theme-text text-sm">
            {activeTab === 'terms' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">Terms of Service</h3>
                  <p className="text-theme-text-sec text-sm">Effective Date: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">1. About Bluepin</h4>
                  <p>Bluepin is a health and wellness application designed to help users track health metrics, upload medical reports, and receive AI-generated insights. These Terms of Service ("Terms") govern your use of the Bluepin application.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">2. Eligibility and Account Ownership</h4>
                  <p>By creating an account, you confirm that you are legally capable of entering into a binding contract and are solely responsible for all activities that occur under your account. You agree to provide accurate and complete information during registration and keep it updated.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">3. Acceptable Use</h4>
                  <p>You agree to use Bluepin strictly for lawful purposes. You shall not upload any false data, misrepresent your identity, attempt to gain unauthorized access to our systems, or use the platform in any way that violates applicable local, state, national, or international law, including the Digital Personal Data Protection Act, 2023.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">4. Consent to Processing</h4>
                  <p>By actively checking the required consent checkboxes during account creation, you explicitly consent to Bluepin collecting, storing, and processing your personal and health information solely for the purpose of providing the application's services, as described in our Privacy Policy. You maintain the right to withdraw this consent at any time by deleting your account via the settings menu or by contacting our support team.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200">
                    <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                      <span className="text-amber-500">⚠️</span> 5. AI & Medical Disclaimer
                    </h4>
                    <ul className="list-disc pl-5 space-y-2">
                      <li><strong>Not a Medical Device:</strong> Bluepin is an informational tool and is not classified as a medical device.</li>
                      <li><strong>No Medical Advice:</strong> Bluepin does not provide professional medical advice, diagnosis, or treatment recommendations.</li>
                      <li><strong>AI Limitations:</strong> AI-generated insights are informational only and may occasionally make mistakes or hallucinate information.</li>
                      <li><strong>Consult Professionals:</strong> You should always consult qualified healthcare professionals before making medical decisions or altering any treatments.</li>
                      <li><strong>Emergencies:</strong> Bluepin should never be relied upon in medical emergencies. If you experience a medical emergency, immediately contact your local emergency services.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">6. Intellectual Property</h4>
                  <p>All content, features, and functionality of Bluepin, including but not limited to text, graphics, logos, and software, are the exclusive property of Bluepin and its licensors and are protected by copyright, trademark, and other intellectual property laws.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">7. Limitation of Liability</h4>
                  <p>To the maximum extent permitted by law, Bluepin and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the application; (b) any conduct or content of any third party on the application; or (c) unauthorized access, use, or alteration of your transmissions or content.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">8. Account Suspension / Termination</h4>
                  <p>We reserve the right to suspend or terminate your account and access to the services at our sole discretion, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">9. Governing Law</h4>
                  <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in India to resolve any legal matter arising from these Terms.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">10. Contact Information</h4>
                  <p>If you have any questions about these Terms, please contact us at <a href="mailto:legal@bluepin.app" className="text-theme-accent hover:underline">legal@bluepin.app</a>.</p>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">Privacy Policy</h3>
                  <p className="text-theme-text-sec text-sm">Effective Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <p>Welcome to Bluepin. We are committed to protecting your personal information and your right to privacy in compliance with India's Digital Personal Data Protection (DPDP) Act, 2023.</p>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">1. What Information We Collect</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Personal Information:</strong> Name, age, gender, email address, and account credentials.</li>
                    <li><strong>Health Information:</strong> Weight, height, uploaded medical lab reports, glucose readings, and other health metrics you choose to provide.</li>
                    <li><strong>Technical Data:</strong> IP address, browser type, device identifiers, and application usage analytics.</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">2. Why We Collect It & How We Use It</h4>
                  <p>We collect this data solely to provide, personalize, and improve the Bluepin application. Specifically, your data is used to:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Create and manage your user account.</li>
                    <li>Store and organize your medical reports and health metrics.</li>
                    <li>Generate AI-driven insights to help you understand your health trends better.</li>
                    <li>Ensure the security and proper functioning of the application.</li>
                  </ul>
                  <p>We do not use your data for targeted advertising or sell it to data brokers.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">3. Where It Is Stored & How We Protect It</h4>
                  <p>Your data is securely stored in cloud databases managed by Google Cloud (Firebase). We implement robust technical and organizational security measures, including encryption in transit and at rest, to protect your personal and health information from unauthorized access, disclosure, alteration, or destruction.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">4. Whether We Share It With Anyone</h4>
                  <p>We do not sell your personal or health data. We may share information only in the following limited circumstances:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Service Providers:</strong> With trusted third-party services (like our AI processing partners and hosting providers) bound by strict confidentiality agreements, solely to operate the application.</li>
                    <li><strong>Legal Obligations:</strong> When legally required to do so by a valid request from law enforcement or government authorities.</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">5. Data Retention</h4>
                  <p>We retain your personal and health information only for as long as your account remains active or as needed to provide you with the services. If you delete your account, your data will be permanently removed from our active databases, subject to legal requirements.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">6. Your User Rights</h4>
                  <p>Under the DPDP Act, you have the right to:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Access:</strong> Request a copy of the personal and health data we hold about you.</li>
                    <li><strong>Correction:</strong> Update or correct any inaccurate information in your profile.</li>
                    <li><strong>Withdrawal of Consent:</strong> Withdraw your consent at any time (which may limit your ability to use the app).</li>
                    <li><strong>Deletion:</strong> Request the deletion of your account and associated data directly through the application settings.</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">7. Contact Information</h4>
                  <p>If you have any questions, concerns, or wish to exercise your data rights, please contact our Data Protection Officer at <a href="mailto:privacy@bluepin.app" className="text-theme-accent hover:underline">privacy@bluepin.app</a>.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
