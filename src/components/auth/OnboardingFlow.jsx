import React from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, CheckCircle, Sparkles, Loader2 } from 'lucide-react';

const OnboardingFlow = ({
  onboardingPage,
  setOnboardingPage,
  tempName,
  setTempName,
  tempSubs,
  handleOnboardingToggle,
  completeOnboarding,
  isSubmitting,
  loginError,
  PROMOTIONS,
  BrandLogo,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 animate-fadeIn">
      {onboardingPage === 1 && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fadeIn">
          <h1 className="text-2xl font-black text-white italic uppercase mb-2">Who are you?</h1>
          <p className="text-slate-400 mb-6 text-sm">Choose a display name for the leaderboards.</p>
          <input 
            type="text" 
            autoFocus
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-bold mb-4 focus:border-red-600 outline-none"
            placeholder="Manager Name"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
          />
          <button 
            onClick={() => tempName.trim() && setOnboardingPage(2)}
            disabled={!tempName.trim()}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              tempName.trim() 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            Next Step <ArrowRight size={18} />
          </button>
        </div>
      )}

      {onboardingPage === 2 && (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full h-full animate-fadeIn">
          <div className="mb-6">
            <button 
              onClick={() => setOnboardingPage(1)} 
              className="text-slate-500 hover:text-white text-xs font-bold uppercase mb-4"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-black text-white italic uppercase mb-2">Your Territory</h1>
            <p className="text-slate-400 text-sm">Select promotions to follow.</p>
            {loginError && (
              <div className="mt-4 bg-red-900/30 text-red-400 p-3 rounded-lg text-xs border border-red-900/50">
                {loginError}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-hide">
            {PROMOTIONS.map(p => {
              const isSelected = tempSubs.includes(p.id);
              return (
                <div 
                  key={p.id} 
                  onClick={() => handleOnboardingToggle(p.id)} 
                  className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-slate-900 border-red-500/50 ring-1 ring-red-500/20' 
                      : 'bg-slate-900/50 border-slate-800 opacity-60'
                  }`}
                >
                  <div className={`w-10 h-10 p-1 rounded-lg border bg-slate-800 ${p.border}`}>
                    <BrandLogo id={p.id} />
                  </div>
                  <span className="flex-1 font-bold text-white">{p.name}</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected 
                      ? 'bg-red-600 border-red-600 text-white' 
                      : 'border-slate-600'
                  }`}>
                    {isSelected && <CheckCircle size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={completeOnboarding} 
            disabled={tempSubs.length === 0 || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              tempSubs.length > 0 
                ? 'bg-white text-black hover:bg-slate-200 shadow-xl' 
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles size={18} className="text-red-600" />}
            {isSubmitting ? "Starting..." : "Start Career"}
          </button>
        </div>
      )}
    </div>
  );
};

OnboardingFlow.propTypes = {
  onboardingPage: PropTypes.number.isRequired,
  setOnboardingPage: PropTypes.func.isRequired,
  tempName: PropTypes.string.isRequired,
  setTempName: PropTypes.func.isRequired,
  tempSubs: PropTypes.arrayOf(PropTypes.string).isRequired,
  handleOnboardingToggle: PropTypes.func.isRequired,
  completeOnboarding: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  loginError: PropTypes.string,
  PROMOTIONS: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      border: PropTypes.string,
    })
  ).isRequired,
  BrandLogo: PropTypes.elementType.isRequired,
};

export default React.memo(OnboardingFlow);
