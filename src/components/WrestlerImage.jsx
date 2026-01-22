import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { User } from 'lucide-react';

const WrestlerImage = ({ name, className, imageUrl }) => {
  const [error, setError] = useState(false);
  
  useEffect(() => { 
    setError(false); 
  }, [name]);
  
  if (error || !imageUrl) {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
      <div className={`bg-slate-800 flex items-center justify-center ${className} relative overflow-hidden`}>
        <User className="text-slate-700 w-1/2 h-1/2 absolute opacity-50" />
        <span className="relative z-10 font-black text-4xl text-slate-600">{initials}</span>
      </div>
    );
  }
  
  return (
    <img 
      src={imageUrl} 
      alt={name} 
      className={`object-cover ${className}`} 
      onError={() => setError(true)} 
      referrerPolicy="no-referrer" 
      loading="lazy" 
    />
  );
};

WrestlerImage.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
  imageUrl: PropTypes.string,
};

WrestlerImage.defaultProps = {
  className: '',
  imageUrl: null,
};

export default React.memo(WrestlerImage);
