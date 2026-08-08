import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Globe, Code, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install this app on your device:\n\n• On Chrome/Edge (Desktop): Click the Download/Install icon in the top right address bar.\n• On iOS Safari: Tap Share -> "Add to Home Screen".\n• On Android: Tap menu (3 dots) -> "Add to Home screen" / "Install app".');
    }
  };

  const localRunCmd = 'git clone <repo_url> && cd app && npm install && npm run dev';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-950/50">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Download & Install Deriv Hub</span>
              </h2>
              <p className="text-xs text-slate-400">
                Install as a standalone app on Mobile & Desktop, or run locally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option 1: PWA Instant Install */}
        <div className="bg-slate-950/90 border border-red-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 font-extrabold flex items-center justify-center text-xs">1</span>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Instant App Installation (PWA)</span>
              </h3>
            </div>
            {isInstalled && (
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>App Installed</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Install Deriv Trading Hub directly onto your PC, Mac, iPhone, or Android device as a standalone native-feeling application with zero app store delays.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-950/50 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.01]"
            >
              <Download className="w-4 h-4" />
              <span>{deferredPrompt ? 'Click Here to Install App Now' : 'Install Desktop / Mobile App'}</span>
            </button>
          </div>

          {/* Platform specific guidance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
            <div className="flex items-start space-x-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <Monitor className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200 block">Chrome / Edge / Windows / Mac:</strong>
                Click the <strong>Install App</strong> button above or look for the download icon in your browser's address bar.
              </div>
            </div>

            <div className="flex items-start space-x-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <Smartphone className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200 block">iOS Safari & Mobile:</strong>
                Tap the <strong>Share</strong> button at the bottom of Safari, then select <strong>"Add to Home Screen"</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: Export Source Code via AI Studio Menu */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-extrabold flex items-center justify-center text-xs">2</span>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Code className="w-4 h-4 text-amber-400" />
              <span>Export Source Code (ZIP / GitHub)</span>
            </h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            To download the full source code as a ZIP archive or sync to GitHub, click the <strong className="text-white">Settings / Export menu</strong> at the top right of your AI Studio interface, or use the local development commands below after cloning:
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono text-[11px]">
            <span className="text-emerald-400 truncate mr-2">{localRunCmd}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(localRunCmd);
                setCopiedCmd(true);
                setTimeout(() => setCopiedCmd(false), 2000);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold flex-shrink-0 transition-colors"
            >
              {copiedCmd ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Secure WSS & HTTPS Direct Client Architecture</span>
          </div>
          <span className="text-slate-500 font-mono">v3.2 PWA Ready</span>
        </div>
      </div>
    </div>
  );
};
