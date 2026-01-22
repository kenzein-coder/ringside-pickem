import React from 'react';
import PropTypes from 'prop-types';
import { Trophy, Flag, UserPlus } from 'lucide-react';

const LeaderboardView = ({
  leaderboardScope,
  setLeaderboardScope,
  filteredLeaderboard,
  userId,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
        <Trophy className="mx-auto text-yellow-500 mb-2 w-8 h-8 drop-shadow-lg" />
        <h2 className="text-2xl font-black text-white mb-4">Rankings</h2>
        <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
          {['global', 'country', 'region', 'friends'].map(scope => (
            <button 
              key={scope} 
              onClick={() => setLeaderboardScope(scope)} 
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                leaderboardScope === scope 
                  ? 'bg-slate-800 text-white shadow' 
                  : 'text-slate-500'
              }`}
            >
              {scope}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider">
          <span>Manager</span>
          <span>Score</span>
        </div>
        <div className="divide-y divide-slate-800">
          {filteredLeaderboard.map((player, idx) => {
            const isMe = player.id === userId;
            return (
              <div 
                key={player.id} 
                className={`p-4 flex items-center justify-between transition-colors ${
                  isMe ? 'bg-red-900/10' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`font-black font-mono text-sm w-8 text-center ${
                    idx === 0 ? 'text-yellow-400 text-lg' : 
                    idx === 1 ? 'text-slate-300' : 
                    idx === 2 ? 'text-orange-400' : 
                    'text-slate-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isMe ? 'text-red-500' : 'text-white'}`}>
                        {player.displayName}
                      </span>
                      {isMe && (
                        <span className="text-[8px] font-bold bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      {leaderboardScope !== 'global' && (
                        <span className="flex items-center gap-1">
                          <Flag size={8} /> {player.country || 'USA'}
                        </span>
                      )}
                      <span>{player.predictionsCorrect} Wins</span>
                    </div>
                  </div>
                </div>
                <div className="font-mono font-black text-white">{player.totalPoints}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      {leaderboardScope === 'friends' && (
        <div className="text-center">
          <button className="text-xs font-bold text-slate-500 hover:text-white flex items-center justify-center gap-2 mx-auto">
            <UserPlus size={14} /> Invite Friends
          </button>
        </div>
      )}
    </div>
  );
};

LeaderboardView.propTypes = {
  leaderboardScope: PropTypes.oneOf(['global', 'country', 'region', 'friends']).isRequired,
  setLeaderboardScope: PropTypes.func.isRequired,
  filteredLeaderboard: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      displayName: PropTypes.string.isRequired,
      totalPoints: PropTypes.number.isRequired,
      predictionsCorrect: PropTypes.number,
      country: PropTypes.string,
    })
  ).isRequired,
  userId: PropTypes.string,
};

export default React.memo(LeaderboardView);
