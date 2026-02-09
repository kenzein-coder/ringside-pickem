import React from 'react';
import PropTypes from 'prop-types';
import { LogOut } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import Toggle from './Toggle.jsx';

const SettingsView = ({
  userProfile,
  user,
  promotions,
  onToggleSubscription,
  onLogout,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-black text-white">Settings</h2>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Account</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-white">{userProfile?.displayName}</div>
            <div className="text-xs text-slate-500">ID: {user?.uid?.substring(0, 6)}...</div>
          </div>
          <button 
            onClick={onLogout}
            aria-label="Sign out of account"
            className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <LogOut size={14} aria-hidden="true" /> Sign Out
          </button>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Promotions</h3>
        <div className="space-y-3" role="group" aria-label="Promotion subscriptions">
          {promotions.map(p => {
            const isEnabled = (userProfile?.subscriptions || []).includes(p.id);
            return (
              <div 
                key={p.id} 
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 p-1 bg-slate-900 rounded border border-slate-800">
                    <BrandLogo id={p.id} />
                  </div>
                  <span className="font-bold text-white">{p.name}</span>
                </div>
                <Toggle 
                  enabled={isEnabled}
                  onClick={() => onToggleSubscription(p.id)}
                  ariaLabel={`Toggle ${p.name} subscription`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

SettingsView.propTypes = {
  userProfile: PropTypes.shape({
    displayName: PropTypes.string,
    subscriptions: PropTypes.arrayOf(PropTypes.string),
  }),
  user: PropTypes.shape({
    uid: PropTypes.string,
  }),
  promotions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  onToggleSubscription: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

SettingsView.defaultProps = {
  userProfile: null,
  user: null,
};

export default SettingsView;
