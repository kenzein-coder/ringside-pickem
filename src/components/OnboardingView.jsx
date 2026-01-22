import React from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';

const OnboardingView = ({
  onboardingPage,
  tempName,
  tempSubs,
  promotions,
  isSubmitting,
  loginError,
  onNameChange,
  onNextPage,
  onBackPage,
  onTogglePromotion,
  onComplete,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 animate-fadeIn">
      {onboardingPage === 1 && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fadeIn">
          <h1 className="text-2xl font-black text-white italic uppercase mb-2">
            Who are you?
          </h1>
          <p className="text-slate-400 mb-6 text-sm">
            Choose a display name for the leaderboards.
          </p>
          
          {loginError && (
            <div 
              role="alert"
              className="bg-red-900/30 text-red-400 p-3 rounded-lg text-xs text-center border border-red-900/50 mb-4"
            >
              {loginError}
            </div>
          )}
          
          <input 
            type="text" 
            autoFocus
            aria-label="Display name"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-bold mb-4 focus:border-red-600 outline-none focus:ring-2 focus:ring-red-500/50"
            placeholder="Manager Name"
            value={tempName}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tempName.trim()) {
                onNextPage();
              }
            }}
          />
          <button 
            onClick={onNextPage}
            disabled={!tempName.trim()}
            aria-label="Continue to promotion selection"
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
              tempName.trim() 
                ? 'bg-red-600 text-white shadow-lg hover:bg-red-700' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Next Step <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {onboardingPage === 2 && (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full h-full animate-fadeIn">
          <div className="mb-6">
            <button 
              onClick={onBackPage}
              aria-label="Go back to name input"
              className="text-slate-500 hover:text-white text-xs font-bold uppercase mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-black text-white italic uppercase mb-2">
              Your Territory
            </h1>
            <p className="text-slate-400 text-sm">
              Select promotions to follow.
            </p>
          </div>
          
          {loginError && (
            <div 
              role="alert"
              className="bg-red-900/30 text-red-400 p-3 rounded-lg text-xs text-center border border-red-900/50 mb-4"
            >
              {loginError}
            </div>
          )}
          
          <div 
            className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-hide"
            role="group"
            aria-label="Promotion selection"
          >
            {promotions.map(p => {
              const isSelected = tempSubs.includes(p.id);
              return (
                <div 
                  key={p.id} 
                  onClick={() => onTogglePromotion(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTogglePromotion(p.id);
                    }
                  }}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`${p.name} promotion`}
                  tabIndex={0}
                  className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    isSelected 
                      ? 'bg-slate-900 border-red-500/50 ring-1 ring-red-500/20' 
                      : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className={`w-10 h-10 p-1 rounded-lg border bg-slate-800 ${p.border}`}>
                    <BrandLogo id={p.id} />
                  </div>
                  <span className="flex-1 font-bold text-white">{p.name}</span>
                  <div 
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected 
                        ? 'bg-red-600 border-red-600 text-white' 
                        : 'border-slate-600'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <CheckCircle size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={onComplete} 
            disabled={tempSubs.length === 0 || isSubmitting}
            aria-label="Complete onboarding and start using app"
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
              tempSubs.length > 0 && !isSubmitting
                ? 'bg-white text-black hover:bg-slate-200 shadow-xl' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles size={18} className="text-red-600" aria-hidden="true" />
                Start Career
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

OnboardingView.propTypes = {
  onboardingPage: PropTypes.number.isRequired,
  tempName: PropTypes.string.isRequired,
  tempSubs: PropTypes.arrayOf(PropTypes.string).isRequired,
  promotions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      border: PropTypes.string,
    })
  ).isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  loginError: PropTypes.string,
  onNameChange: PropTypes.func.isRequired,
  onNextPage: PropTypes.func.isRequired,
  onBackPage: PropTypes.func.isRequired,
  onTogglePromotion: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
};

OnboardingView.defaultProps = {
  loginError: null,
};

export default OnboardingView;
