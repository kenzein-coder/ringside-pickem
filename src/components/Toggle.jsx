import React from 'react';

export default function Toggle({ enabled, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${enabled ? 'bg-red-600' : 'bg-slate-700'}`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </div>
  );
}
