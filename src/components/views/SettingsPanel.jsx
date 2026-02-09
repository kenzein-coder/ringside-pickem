import React from 'react';
import PropTypes from 'prop-types';
import { LogOut } from 'lucide-react';
import Toggle from '../ui/Toggle';

const SettingsPanel = ({
  user,
  userProfile,
  displayName,
  setDisplayName,
  newEmail,
  setNewEmail,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  accountError,
  accountSuccess,
  handleLogout,
  handleUpdateDisplayName,
  handleChangeEmail,
  handleChangePassword,
  handleToggleSub,
  setViewState,
  setAuthMode,
  PROMOTIONS,
  BrandLogo,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <h2 className="text-2xl font-black text-white">Settings</h2>
      
      {/* Account Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Account</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-white">{userProfile?.displayName || user?.displayName || 'Guest User'}</div>
              <div className="text-xs text-slate-500">
                {user?.email || 'Anonymous account'}
              </div>
              <div className="text-xs text-slate-600">ID: {user?.uid?.substring(0,8)}...</div>
            </div>
            <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
          
          {accountError && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-xs border border-red-900/50">
              {accountError}
            </div>
          )}
          
          {accountSuccess && (
            <div className="bg-green-900/30 text-green-400 p-3 rounded-lg text-xs border border-green-900/50">
              {accountSuccess}
            </div>
          )}
        </div>
      </div>

      {/* Update Display Name */}
      {user && !user.isAnonymous && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Display Name</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Display Name"
              value={displayName || userProfile?.displayName || user?.displayName || ''}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
            <button
              onClick={handleUpdateDisplayName}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
            >
              Update Display Name
            </button>
          </div>
        </div>
      )}

      {/* Change Email */}
      {user && !user.isAnonymous && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Change Email</h3>
          <div className="space-y-3">
            <div className="text-xs text-slate-500 mb-2">Current: {user.email}</div>
            <input
              type="email"
              placeholder="New Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
            <button
              onClick={handleChangeEmail}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
            >
              Update Email
            </button>
          </div>
        </div>
      )}

      {/* Change Password */}
      {user && !user.isAnonymous && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Change Password</h3>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChangePassword()}
              className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
            <button
              onClick={handleChangePassword}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
            >
              Update Password
            </button>
          </div>
        </div>
      )}

      {/* Guest Account Upgrade Notice */}
      {user && user.isAnonymous && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Upgrade to Account</h3>
          <p className="text-xs text-slate-500 mb-3">
            Create an account to save your predictions and settings permanently.
          </p>
          <button
            onClick={() => {
              handleLogout();
              setViewState('login');
              setAuthMode('signup');
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
          >
            Create Account
          </button>
        </div>
      )}

      {/* Promotions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Promotions</h3>
        <div className="space-y-3">
          {PROMOTIONS.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 p-1 bg-slate-900 rounded border border-slate-800">
                  <BrandLogo id={p.id} />
                </div>
                <span className="font-bold">{p.name}</span>
              </div>
              <Toggle 
                enabled={(userProfile?.subscriptions || []).includes(p.id)} 
                onClick={() => handleToggleSub(p.id)}
                ariaLabel={`Toggle ${p.name}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

SettingsPanel.propTypes = {
  user: PropTypes.object,
  userProfile: PropTypes.object,
  displayName: PropTypes.string,
  setDisplayName: PropTypes.func.isRequired,
  newEmail: PropTypes.string.isRequired,
  setNewEmail: PropTypes.func.isRequired,
  newPassword: PropTypes.string.isRequired,
  setNewPassword: PropTypes.func.isRequired,
  confirmNewPassword: PropTypes.string.isRequired,
  setConfirmNewPassword: PropTypes.func.isRequired,
  accountError: PropTypes.string,
  accountSuccess: PropTypes.string,
  handleLogout: PropTypes.func.isRequired,
  handleUpdateDisplayName: PropTypes.func.isRequired,
  handleChangeEmail: PropTypes.func.isRequired,
  handleChangePassword: PropTypes.func.isRequired,
  handleToggleSub: PropTypes.func.isRequired,
  setViewState: PropTypes.func.isRequired,
  setAuthMode: PropTypes.func.isRequired,
  PROMOTIONS: PropTypes.array.isRequired,
  BrandLogo: PropTypes.elementType.isRequired,
};

export default React.memo(SettingsPanel);
