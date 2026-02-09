import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, MapPin, CheckCircle, ChevronRight } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';

const EventCard = ({ event, promo, bgImage, isGraded, onClick }) => (
  <div
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
    role="button"
    tabIndex={0}
    aria-label={`View ${event.name} event details`}
    className="group relative bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer rounded-2xl overflow-hidden shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500"
    style={{ height: '200px' }}
  >
    <div className="absolute inset-0">
      <img
        src={bgImage}
        alt={`${event.name} poster`}
        className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
    </div>
    <div className="absolute inset-0 p-5 flex flex-col justify-end">
      <div className="flex justify-between items-end">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="w-10 h-10 p-1 bg-slate-950/80 rounded-lg backdrop-blur-sm border border-slate-800">
              <BrandLogo id={promo.id} />
            </div>
            {isGraded && (
              <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1">
                <CheckCircle size={10} aria-hidden="true" /> Complete
              </div>
            )}
          </div>
          <h4 className="font-black text-2xl text-white leading-none mb-1 italic uppercase shadow-black drop-shadow-md">
            {event.name}
          </h4>
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-1">
              <Calendar size={10} aria-hidden="true" /> {event.date}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-500"></span>
            <span className="flex items-center gap-1">
              <MapPin size={10} aria-hidden="true" /> {event.venue}
            </span>
          </div>
        </div>
        <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm group-hover:bg-red-600 transition-colors">
          <ChevronRight className="text-white" size={20} aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
);

EventCard.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    venue: PropTypes.string.isRequired,
    promoId: PropTypes.string.isRequired,
    matches: PropTypes.array.isRequired,
  }).isRequired,
  promo: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  bgImage: PropTypes.string.isRequired,
  isGraded: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default React.memo(EventCard);
