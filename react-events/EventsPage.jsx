import React, { useState, useEffect } from 'react';
import { EventService } from './EventService';

export default function EventsPage({ onNavigateToDetail, onNavigateToAdmin }) {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [eventsRes, adminCheck] = await Promise.all([
        EventService.getEvents(),
        EventService.isAdmin()
      ]);

      if (eventsRes.error) {
        setError('Failed to fetch events. Please try again.');
      } else {
        setUpcomingEvents(eventsRes.upcoming);
        setPastEvents(eventsRes.past);
      }
      setIsAdmin(adminCheck);
      setLoading(false);
    }
    loadData();
  }, []);

  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getActiveList = () => {
    return activeTab === 'upcoming' ? upcomingEvents : pastEvents;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-crimson/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-crimson animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in text-white selection:bg-crimson selection:text-white">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-900 p-8 md:p-12 mb-12 shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-crimson/15 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-600/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson/10 border border-crimson/30 text-crimson text-xs font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-crimson"></span>
              </span>
              Antigravity Project Module
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight">
              ICC <span className="text-transparent bg-clip-text bg-gradient-to-r from-crimson to-rose-500">Club Events</span>
            </h1>
            <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed">
              Explore hands-on workshops, hackathons, and innovative sessions at the Innovators Creators Club. 
              Find upcoming events or browse our legacy database of past achievements.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={onNavigateToAdmin}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-sm font-bold rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all hover:scale-[1.02] shadow-lg shrink-0"
            >
              <svg className="w-4 h-4 text-crimson" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Manage Events Panel</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 mb-8 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-zinc-950 border border-zinc-900 rounded-2xl w-fit mb-8 shadow-inner">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeTab === 'upcoming'
              ? 'bg-crimson text-white shadow-lg shadow-crimson/15'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span>Upcoming Events</span>
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-zinc-900 text-zinc-500'
          }`}>
            {upcomingEvents.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeTab === 'past'
              ? 'bg-crimson text-white shadow-lg shadow-crimson/15'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span>Past Accomplishments</span>
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'past' ? 'bg-white/20 text-white' : 'bg-zinc-900 text-zinc-500'
          }`}>
            {pastEvents.length}
          </span>
        </button>
      </div>

      {/* Grid List */}
      {getActiveList().length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-zinc-900/20 border border-zinc-900/50">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl flex items-center justify-center text-zinc-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-lg text-white mb-1">No Events Found</h3>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto">There are no {activeTab} events loaded at this time. Stay tuned for updates!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getActiveList().map(event => (
            <div
              key={event.id}
              onClick={() => onNavigateToDetail(event.id)}
              className="group flex flex-col h-full rounded-2xl bg-zinc-900/30 border border-zinc-800/50 overflow-hidden hover:bg-zinc-900/75 hover:border-zinc-700/60 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-crimson/5 cursor-pointer"
            >
              {/* Event Image */}
              <div className="relative aspect-[16/10] overflow-hidden bg-zinc-950">
                {event.banner_url ? (
                  <img
                    src={event.banner_url}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-950 font-heading font-black text-4xl text-zinc-800/40 select-none">
                    ICC EVENT
                  </div>
                )}
                {/* Date overlay badge */}
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-obsidian/85 backdrop-blur-md border border-zinc-800/80 text-[11px] font-bold text-zinc-300 shadow-md">
                  {formatDate(event.event_date)}
                </div>

                {/* Status tag */}
                <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest ${
                  event.status === 'upcoming'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
                }`}>
                  {event.status}
                </div>
              </div>

              {/* Event Body */}
              <div className="flex-1 p-6 flex flex-col">
                <h3 className="font-heading font-bold text-lg text-white mb-2 group-hover:text-crimson transition-colors line-clamp-1">
                  {event.title}
                </h3>
                
                <p className="text-zinc-400 text-xs md:text-sm leading-relaxed line-clamp-3 mb-6">
                  {event.description.replace(/[#*`_]/g, '')} {/* Strip basic markdown preview */}
                </p>

                <div className="mt-auto pt-4 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>{event.action_buttons?.length || 0} Dynamic Links</span>
                  </span>
                  
                  <span className="flex items-center gap-1 text-crimson font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    <span>Details</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
