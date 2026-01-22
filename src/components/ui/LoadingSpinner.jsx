import React from 'react';
import PropTypes from 'prop-types';
import { Activity } from 'lucide-react';

const LoadingSpinner = ({ size = 24, className = '' }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <Activity className="animate-spin text-red-600" size={size} />
  </div>
);

LoadingSpinner.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

export default LoadingSpinner;
