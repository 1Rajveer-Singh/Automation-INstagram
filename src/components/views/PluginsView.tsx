import React, { useState } from 'react';
import { ApiConfig } from '../../types/instagram';
import { debugToken } from '../../services/instagramApi';
import { saveEncryptedToken, saveEnvCredentials, loadEnvCredentials, parseCloudinaryUrl } from '../../services/security';
import { useActivity } from '../../context/ActivityContext';
import { HardInput } from '../common/HardInput';
import { CandyButton } from '../common/CandyButton';
import { GeminiIcon, OpenRouterIcon, InstagramBrandIcon } from '../common/BrandIcons';
import { 
  Plug, 
  X, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  CheckCircle2,
  Sliders,
  UserCheck,
  KeyRound,
  ExternalLink,
  Lock,
  Cloud,
  Upload,
  Link as LinkIcon
} from 'lucide-react';

interface PluginsViewProps {
  config: ApiConfig;
  onSaveConfig: (newConfig: Partial<ApiConfig>) => void;
  userId?: string;
}

type PluginTab = 'ai' | 'tools';
type ModalType = 'gemini' | 'openrouter' | 'instagram' | 'cloudinary' | null;

export const PluginsView: React.FC<PluginsViewProps> = ({ config, onSaveConfig, userId }) => {
  const [activeTab, setActiveTab] = useState<PluginTab>('ai');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Form states
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey || '');
  const [openRouterApiKey, setOpenRouterApiKey] = useState(config.openRouterApiKey || '');
  const [appId, setAppId] = useState(config.appId || '');
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [igUserId, setIgUserId] = useState(config.selectedIgUserId || '');

  // Cloudinary states
  const initialEnv = loadEnvCredentials(userId);
  const [cloudinaryUrl, setCloudinaryUrl] = useState(config.cloudinaryUrl || initialEnv.cloudinaryUrl || '');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(config.cloudinaryCloudName || initialEnv.cloudinaryCloudName || '');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState(config.cloudinaryApiKey || initialEnv.cloudinaryApiKey || '');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState(config.cloudinaryApiSecret || initialEnv.cloudinaryApiSecret || '');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState(config.cloudinaryUploadPreset || initialEnv.cloudinaryUploadPreset || '');

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const { addActivity } = useActivity();

  React.useEffect(() => {
    setGeminiApiKey(config.geminiApiKey || '');
    setOpenRouterApiKey(config.openRouterApiKey || '');
    setAppId(config.appId || '');
    setAccessToken(config.accessToken || '');
    setIgUserId(config.selectedIgUserId || '');

    const currentEnv = loadEnvCredentials(userId);
    setCloudinaryUrl(config.cloudinaryUrl || currentEnv.cloudinaryUrl || '');
    setCloudinaryCloudName(config.cloudinaryCloudName || currentEnv.cloudinaryCloudName || '');
    setCloudinaryApiKey(config.cloudinaryApiKey || currentEnv.cloudinaryApiKey || '');
    setCloudinaryApiSecret(config.cloudinaryApiSecret || currentEnv.cloudinaryApiSecret || '');
    setCloudinaryUploadPreset(config.cloudinaryUploadPreset || currentEnv.cloudinaryUploadPreset || '');
  }, [config, userId]);

  const handleSaveGemini = () => {
    saveEnvCredentials({ geminiApiKey }, userId);
    onSaveConfig({ geminiApiKey });
    addActivity('Gemini 3.5 Flash API Key updated & AES-256 encrypted in user DB', 'success');
    setActiveModal(null);
  };

  const handleSaveOpenRouter = () => {
    saveEnvCredentials({ openRouterApiKey }, userId);
    onSaveConfig({ openRouterApiKey });
    addActivity('OpenRouter Failover API Key updated & AES-256 encrypted in user DB', 'success');
    setActiveModal(null);
  };

  const handleSaveInstagram = () => {
    saveEncryptedToken(appId, accessToken, userId);
    saveEnvCredentials({ appId, accessToken, selectedIgUserId: igUserId }, userId);
    onSaveConfig({
      appId,
      accessToken,
      selectedIgUserId: igUserId,
    });
    addActivity('Instagram Graph API Credentials updated & AES-256 encrypted in user DB', 'success');
    setActiveModal(null);
  };

  const handleSaveCloudinary = () => {
    // If URL pasted, parse it automatically
    let parsedCloud = cloudinaryCloudName.trim();
    let parsedKey = cloudinaryApiKey.trim();
    let parsedSecret = cloudinaryApiSecret.trim();
    const urlTrimmed = cloudinaryUrl.trim();
    const presetTrimmed = cloudinaryUploadPreset.trim();

    if (urlTrimmed.startsWith('cloudinary://')) {
      const parsed = parseCloudinaryUrl(urlTrimmed);
      if (parsed.cloudName) parsedCloud = parsed.cloudName;
      if (parsed.apiKey) parsedKey = parsed.apiKey;
      if (parsed.apiSecret) parsedSecret = parsed.apiSecret;
    }

    const payload = {
      cloudinaryUrl: urlTrimmed,
      cloudinaryCloudName: parsedCloud,
      cloudinaryApiKey: parsedKey,
      cloudinaryApiSecret: parsedSecret,
      cloudinaryUploadPreset: presetTrimmed,
    };

    saveEnvCredentials(payload, userId);
    onSaveConfig(payload);

    setCloudinaryUrl(urlTrimmed);
    setCloudinaryCloudName(parsedCloud);
    setCloudinaryApiKey(parsedKey);
    setCloudinaryApiSecret(parsedSecret);
    setCloudinaryUploadPreset(presetTrimmed);

    addActivity('Cloudinary CDN Credentials saved & synced to Supabase database', 'success');
    setActiveModal(null);
  };

  const handleResetCloudinary = () => {
    const emptyPayload = {
      cloudinaryUrl: '',
      cloudinaryCloudName: '',
      cloudinaryApiKey: '',
      cloudinaryApiSecret: '',
      cloudinaryUploadPreset: '',
    };

    saveEnvCredentials(emptyPayload, userId);
    onSaveConfig(emptyPayload);

    setCloudinaryUrl('');
    setCloudinaryCloudName('');
    setCloudinaryApiKey('');
    setCloudinaryApiSecret('');
    setCloudinaryUploadPreset('');

    addActivity('Cloudinary credentials reset & cleared for this account', 'info');
    setActiveModal(null);
  };

  const handleInspect = async () => {
    if (!accessToken) return;
    setIsInspecting(true);
    try {
      const info = await debugToken(appId, accessToken);
      addActivity(`Token Inspection: App ${info.app_id} - ${info.is_valid ? 'VALID LIVE TOKEN' : 'INVALID'}`, info.is_valid ? 'success' : 'error');
    } catch (e: any) {
      addActivity(`Token Inspection Notice: ${e.message}`, 'error');
    } finally {
      setIsInspecting(false);
    }
  };

  const isGeminiConfigured = Boolean(geminiApiKey && geminiApiKey.trim().length > 0);
  const isOpenRouterConfigured = Boolean(openRouterApiKey && openRouterApiKey.trim().length > 0);
  const isInstagramConfigured = Boolean(accessToken && accessToken.trim().length > 0);
  const isCloudinaryConfigured = Boolean(cloudinaryCloudName || cloudinaryUrl);

  return (
    <div className="space-y-6">

      {/* Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slateDark/10">
        <div>
          <h1 className="font-heading text-2xl font-black text-slateDark flex items-center gap-2">
            <Plug className="text-violetBrand" /> Plugins & Integrations
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Configure external AI LLMs, Meta Graph API v22.0 tokens, and Cloudinary Media CDN storage.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border-2 border-slateDark shadow-pop-sm">
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'ai'
                ? 'bg-violetBrand text-white shadow-pop-sm border-2 border-slateDark'
                : 'text-slate-600 hover:text-slateDark'
            }`}
          >
            <GeminiIcon size={16} />
            <span>AI Section</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'tools'
                ? 'bg-pinkPop text-slateDark shadow-pop-sm border-2 border-slateDark'
                : 'text-slate-600 hover:text-slateDark'
            }`}
          >
            <InstagramBrandIcon size={16} />
            <span>Tool Integration</span>
          </button>
        </div>
      </div>


      {/* TAB 1: AI SECTION */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gemini AI Card */}
          <div
            onClick={() => setActiveModal('gemini')}
            className="cursor-pointer bg-white border-2 border-slateDark rounded-2xl p-6 shadow-pop-violet hover:-translate-y-1 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 border-2 border-slateDark rounded-2xl shrink-0 group-hover:scale-105 transition-transform shadow-pop-sm">
                <GeminiIcon size={36} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-slateDark flex items-center gap-2">
                  Gemini AI
                </h3>
                <p className="text-xs text-slate-500 font-medium">gemini-3.5-flash-lite (Primary Model)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-slateDark ${
                isGeminiConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {isGeminiConfigured ? 'Active' : 'Configure'}
              </span>
            </div>
          </div>

          {/* OpenRouter AI Card */}
          <div
            onClick={() => setActiveModal('openrouter')}
            className="cursor-pointer bg-white border-2 border-slateDark rounded-2xl p-6 shadow-pop hover:-translate-y-1 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 border-2 border-slateDark rounded-2xl shrink-0 group-hover:scale-105 transition-transform shadow-pop-sm">
                <OpenRouterIcon size={36} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-slateDark flex items-center gap-2">
                  OpenRouter AI
                </h3>
                <p className="text-xs text-slate-500 font-medium">Auto Failover Fallback Provider</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-slateDark ${
                isOpenRouterConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {isOpenRouterConfigured ? 'Active' : 'Configure'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TOOLS SECTION */}
      {activeTab === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Instagram Graph API Card */}
          <div
            onClick={() => setActiveModal('instagram')}
            className="cursor-pointer bg-white border-2 border-slateDark rounded-2xl p-6 shadow-pop-pink hover:-translate-y-1 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 border-2 border-slateDark rounded-2xl shrink-0 group-hover:scale-105 transition-transform shadow-pop-sm">
                <InstagramBrandIcon size={36} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-slateDark">Instagram Graph API</h3>
                <p className="text-xs text-slate-500 font-medium">Meta Graph API v22.0</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-slateDark ${
                isInstagramConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {isInstagramConfigured ? 'Connected' : 'Configure'}
              </span>
            </div>
          </div>

          {/* Cloudinary CDN Card */}
          <div
            onClick={() => setActiveModal('cloudinary')}
            className="cursor-pointer bg-white border-2 border-slateDark rounded-2xl p-6 shadow-pop-mint hover:-translate-y-1 transition-all duration-200 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-50 border-2 border-slateDark rounded-2xl shrink-0 group-hover:scale-105 transition-transform shadow-pop-sm text-sky-600">
                <Cloud size={36} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-slateDark flex items-center gap-2">
                  Cloudinary Media CDN
                </h3>
                <p className="text-xs text-slate-500 font-medium">HTTPS Video & Image Storage Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-slateDark ${
                isCloudinaryConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {isCloudinaryConfigured ? 'Configured' : 'Configure'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOW FOR CREDENTIALS */}
      {activeModal && (
        <div className="fixed inset-0 bg-slateDark/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border-4 border-slateDark rounded-3xl p-6 sm:p-8 w-full max-w-3xl max-h-[88vh] shadow-pop-lg relative flex flex-col justify-between overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 bg-white border-2 border-slateDark rounded-full text-slateDark hover:bg-slate-100 transition-colors shadow-pop-sm z-10"
            >
              <X size={18} />
            </button>

            {/* GEMINI MODAL */}
            {activeModal === 'gemini' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-violet-100 border-2 border-slateDark rounded-2xl shadow-pop-sm">
                    <GeminiIcon size={32} />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-black text-slateDark">Gemini AI Configuration</h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      Power intelligent caption generation, hashtag discovery, and viral hooks with Google Gemini.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-4 space-y-4">
                  <HardInput
                    label="Gemini API Key (BYOK)"
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Get a key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-violetBrand underline font-bold">Google AI Studio</a>. Stored encrypted per Clerk user account.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slateDark/10">
                  <CandyButton variant="secondary" onClick={() => setActiveModal(null)}>Cancel</CandyButton>
                  <CandyButton variant="primary" onClick={handleSaveGemini}>Save & Encrypt Key</CandyButton>
                </div>
              </div>
            )}

            {/* OPENROUTER MODAL */}
            {activeModal === 'openrouter' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 border-2 border-slateDark rounded-2xl shadow-pop-sm">
                    <OpenRouterIcon size={32} />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-black text-slateDark">OpenRouter AI Configuration</h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      Provide fallback access to DeepSeek, Claude, and Llama LLMs via OpenRouter.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-4 space-y-4">
                  <HardInput
                    label="OpenRouter API Key"
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={openRouterApiKey}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Create keys at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-violetBrand underline font-bold">OpenRouter.ai</a>.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slateDark/10">
                  <CandyButton variant="secondary" onClick={() => setActiveModal(null)}>Cancel</CandyButton>
                  <CandyButton variant="primary" onClick={handleSaveOpenRouter}>Save Settings</CandyButton>
                </div>
              </div>
            )}

            {/* INSTAGRAM MODAL */}
            {activeModal === 'instagram' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-pink-100 border-2 border-slateDark rounded-2xl shadow-pop-sm">
                    <InstagramBrandIcon size={32} />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-black text-slateDark">Instagram Graph API v22.0</h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      Configure official Meta Graph API access for direct post scheduling & comment automation.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-4 space-y-4">
                  <HardInput
                    label="Meta App ID"
                    placeholder="1234567890..."
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                  />
                  <HardInput
                    label="Instagram User ID (Graph Scoped)"
                    placeholder="178414..."
                    value={igUserId}
                    onChange={(e) => setIgUserId(e.target.value)}
                  />
                  <HardInput
                    label="User Access Token (Long-Lived)"
                    type="password"
                    placeholder="EAAG..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-slateDark/10">
                  <CandyButton variant="secondary" onClick={handleInspect} disabled={isInspecting}>
                    {isInspecting ? 'Inspecting Token...' : 'Inspect Token'}
                  </CandyButton>
                  <div className="flex items-center gap-2">
                    <CandyButton variant="secondary" onClick={() => setActiveModal(null)}>Cancel</CandyButton>
                    <CandyButton variant="primary" onClick={handleSaveInstagram}>Save Credentials</CandyButton>
                  </div>
                </div>
              </div>
            )}

            {/* CLOUDINARY MODAL */}
            {activeModal === 'cloudinary' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-100 border-2 border-slateDark rounded-2xl shadow-pop-sm text-sky-600">
                    <Cloud size={32} />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-black text-slateDark">Cloudinary Media CDN</h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      Host videos and images on an official HTTPS CDN required by Meta Graph API Media Containers.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-4 space-y-4">
                  <HardInput
                    label="Cloudinary Connection URL (Paste & Auto-Parse)"
                    placeholder="cloudinary://key:secret@cloudname"
                    value={cloudinaryUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCloudinaryUrl(val);
                      if (val.startsWith('cloudinary://')) {
                        const parsed = parseCloudinaryUrl(val);
                        if (parsed.cloudName) setCloudinaryCloudName(parsed.cloudName);
                        if (parsed.apiKey) setCloudinaryApiKey(parsed.apiKey);
                        if (parsed.apiSecret) setCloudinaryApiSecret(parsed.apiSecret);
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <HardInput
                      label="Cloud Name"
                      placeholder="my-cloud-name"
                      value={cloudinaryCloudName}
                      onChange={(e) => setCloudinaryCloudName(e.target.value)}
                    />
                    <HardInput
                      label="Upload Preset (Unsigned)"
                      placeholder="ml_default or unsigned_preset"
                      value={cloudinaryUploadPreset}
                      onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <HardInput
                      label="API Key"
                      placeholder="1234567890"
                      value={cloudinaryApiKey}
                      onChange={(e) => setCloudinaryApiKey(e.target.value)}
                    />
                    <HardInput
                      label="API Secret"
                      type="password"
                      placeholder="••••••••••••"
                      value={cloudinaryApiSecret}
                      onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Get free Cloudinary credentials at <a href="https://cloudinary.com/console" target="_blank" rel="noreferrer" className="text-sky-600 underline font-bold">Cloudinary Console</a>. Encrypted & stored per user.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-slateDark/10">
                  <CandyButton
                    variant="secondary"
                    onClick={handleResetCloudinary}
                    className="text-rose-600 hover:bg-rose-50 border-rose-300"
                  >
                    Reset CDN Credentials
                  </CandyButton>
                  <div className="flex items-center gap-2">
                    <CandyButton variant="secondary" onClick={() => setActiveModal(null)}>Cancel</CandyButton>
                    <CandyButton variant="primary" onClick={handleSaveCloudinary}>Save & Encrypt CDN</CandyButton>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
