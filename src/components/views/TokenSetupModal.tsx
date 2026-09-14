import React, { useState } from 'react';
import { ApiConfig, TokenDebugInfo } from '../../types/instagram';
import { debugToken } from '../../services/instagramApi';
import { REQUIRED_SCOPES, auditScopes, saveEncryptedToken, clearSecureToken } from '../../services/security';
import { HardInput } from '../common/HardInput';
import { CandyButton } from '../common/CandyButton';
import { ShieldCheck, Key, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle, Sparkles, HelpCircle } from 'lucide-react';

interface TokenSetupModalProps {
  config: ApiConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (newConfig: Partial<ApiConfig>) => void;
}

export const TokenSetupModal: React.FC<TokenSetupModalProps> = ({
  config,
  isOpen,
  onClose,
  onSaveConfig,
}) => {
  const [appId, setAppId] = useState(config.appId || '');
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [igUserId, setIgUserId] = useState(config.selectedIgUserId || '');
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey || '');
  const [showToken, setShowToken] = useState(false);
  const [debugInfo, setDebugInfo] = useState<TokenDebugInfo | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInspect = async () => {
    setIsInspecting(true);
    setErrorMsg(null);
    try {
      const info = await debugToken(appId, accessToken);
      setDebugInfo(info);
    } catch (err: any) {
      setErrorMsg(err.message || 'Token inspection failed.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSave = () => {
    saveEncryptedToken(appId, accessToken);
    onSaveConfig({
      appId,
      accessToken,
      selectedIgUserId: igUserId,
      geminiApiKey,
    });
    onClose();
  };

  const handleClear = () => {
    clearSecureToken();
    setAccessToken('');
    setAppId('');
    setIgUserId('');
    setDebugInfo(null);
    onSaveConfig({ accessToken: '', appId: '', selectedIgUserId: '' });
  };

  const scopeAudit = debugInfo ? auditScopes(debugInfo.scopes) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slateDark/70 backdrop-blur-md animate-pop-in">
      <div className="bg-white border-4 border-slateDark rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-pop-lg max-h-[88vh] overflow-y-auto relative flex flex-col justify-between">
        <div className="flex items-start justify-between pb-4 border-b-2 border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-violetBrand text-white border-2 border-slateDark flex items-center justify-center shadow-pop-sm rotate-[-3deg]">
              <Key size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-black text-slateDark leading-tight">
                Graph API & AI Guard
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Setup Meta App ID, Instagram User ID & Access Token securely
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-slateDark flex items-center justify-center font-bold hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <HardInput
            label="Meta App ID"
            placeholder="e.g. 987654321012345"
            value={appId}
            onChange={e => setAppId(e.target.value)}
            helperText="From Meta Developers App Dashboard"
            badge="Required"
          />

          <div className="space-y-1">
            <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark flex items-center justify-between">
              <span>Instagram Graph API Access Token</span>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-violetBrand hover:underline flex items-center gap-1 font-semibold"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showToken ? 'Hide Token' : 'Reveal Token'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder="EAAB..."
                className="hard-input pr-10 font-mono text-sm"
              />
              <Lock size={16} className="absolute right-3 top-3.5 text-slate-400" />
            </div>
          </div>

          <HardInput
            label="Instagram Business Account User ID"
            placeholder="e.g. 17841405309211234"
            value={igUserId}
            onChange={e => setIgUserId(e.target.value)}
            helperText="Your IG User ID connected to your Facebook Page"
            badge="Target Account"
          />

          <HardInput
            label="Gemini API Key (Optional AI Automation Upgrade)"
            placeholder="AIzaSy..."
            value={geminiApiKey}
            onChange={e => setGeminiApiKey(e.target.value)}
            helperText="Powers gemini-3.5-flash-lite AI caption & auto-reply generation"
            badge="AI"
          />

          <div className="flex items-center gap-3 pt-2">
            <CandyButton
              variant="yellow"
              size="sm"
              onClick={handleInspect}
              disabled={isInspecting}
              icon={Sparkles}
            >
              {isInspecting ? 'Inspecting...' : 'Inspect Token & Scopes'}
            </CandyButton>

            <CandyButton variant="primary" size="sm" onClick={handleSave} icon={ShieldCheck}>
              Save Credentials
            </CandyButton>

            <CandyButton variant="secondary" size="sm" onClick={handleClear}>
              Clear
            </CandyButton>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-700 font-medium text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {debugInfo && (
            <div className="mt-6 bg-slate-50 border-2 border-slateDark rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm font-bold text-slateDark flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Meta Token Inspection Report
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${debugInfo.is_valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {debugInfo.is_valid ? 'VALID LIVE TOKEN' : 'INVALID TOKEN'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">App Name:</span>
                  <span className="font-bold">{debugInfo.application}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Type:</span>
                  <span className="font-bold">{debugInfo.type} TOKEN</span>
                </div>
              </div>

              <div>
                <h4 className="font-heading text-xs font-bold text-slateDark mb-2 uppercase tracking-wide">
                  Scope Audit Checklist:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {REQUIRED_SCOPES.map(s => {
                    const isGranted = scopeAudit?.granted.includes(s.name);
                    return (
                      <div
                        key={s.name}
                        className={`p-2 rounded-lg border flex items-center justify-between ${
                          isGranted ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                        }`}
                      >
                        <div>
                          <span className="font-bold block font-mono">{s.name}</span>
                          <span className="text-[10px] text-slate-500">{s.description}</span>
                        </div>
                        {isGranted ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
