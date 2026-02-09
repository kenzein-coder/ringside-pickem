import React from 'react';
import PropTypes from 'prop-types';
import { Trophy, Shield, Loader2 } from 'lucide-react';

const LoginView = ({ 
  loginError, 
  isLoggingIn, 
  onGuestLogin 
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 animate-fadeIn relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2/3 bg-gradient-to-b from-red-900/20 to-slate-950 z-0"></div>
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-900/50 mb-4 transform -rotate-3">
            <Trophy className="text-white w-12 h-12" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
              PRO<span className="text-red-600">PICK&apos;EM</span>
            </h1>
            <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">
              Predict winners. Climb ranks. Become a legend.
            </p>
          </div>
        </div>
        <div className="space-y-4 mb-8">
          {loginError && (
            <div 
              role="alert"
              className="bg-red-900/30 text-red-400 p-3 rounded-lg text-xs text-center border border-red-900/50 mb-4"
            >
              {loginError}
            </div>
          )}
          <button 
            onClick={onGuestLogin}
            disabled={isLoggingIn}
            aria-label="Continue as guest"
            className="w-full bg-white hover:bg-slate-200 text-slate-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Shield size={20} aria-hidden="true" />
            )}
            {isLoggingIn ? "Connecting..." : "Continue as Guest"}
          </button>
        </div>
      </div>
    </div>
  );
};

LoginView.propTypes = {
  loginError: PropTypes.string,
  isLoggingIn: PropTypes.bool.isRequired,
  onGuestLogin: PropTypes.func.isRequired,
};

LoginView.defaultProps = {
  loginError: null,
};

export default LoginView;
