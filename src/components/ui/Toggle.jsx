import React from 'react';
import PropTypes from 'prop-types';

const Toggle = ({ enabled, onClick, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={ariaLabel || 'Toggle'}
    onClick={onClick}
    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      enabled ? 'bg-red-600' : 'bg-slate-700'
    }`}
  >
    <div
      className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
        enabled ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

Toggle.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
};

export default React.memo(Toggle);
