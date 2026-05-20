import React, { useState, useEffect } from 'react';
import { EventService } from './EventService';

export default function EventDetail({ eventId, onNavigateBack }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    async function loadEvent() {
      setLoading(true);
      const res = await EventService.getEventById(eventId);
      if (res.error || !res.event) {
        setError('Event not found or failed to load.');
      } else {
        setEvent(res.event);
        setActiveImage(res.event.banner_url);
      }
      setLoading(false);
    }
    loadEvent();
  }, [eventId]);

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getButtonStyle = (styleName) => {
    switch (styleName) {
      case 'primary':
        return 'bg-crimson hover:bg-rose-600 text-white shadow-lg shadow-crimson/20 hover:scale-[1.02]';
      case 'secondary':
        return 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:scale-[1.02]';
      case 'danger':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/10 hover:scale-[1.02]';
      default:
        return 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:scale-[1.02]';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-crimson/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-crimson animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-20 text-center text-white">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-950/20 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold font-heading mb-2">Notice</h2>
        <p className="text-zinc-500 text-sm mb-6">{error || 'Event details unavailable.'}</p>
        <button
          onClick={onNavigateBack}
          className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
        >
          Return to Events
        </button>
      </div>
    );
  }

  const hasGallery = event.gallery_urls && event.gallery_urls.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 animate-fade-in text-white selection:bg-crimson selection:text-white">
      {/* Back navigation header */}
      <button
        onClick={onNavigateBack}
        className="group inline-flex items-center gap-2 mb-6 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back to Events Grid</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media Presentation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-900 aspect-[16/10] shadow-2xl">
            {activeImage ? (
              <img
                src={activeImage}
                alt={event.title}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-950 font-heading font-black text-4xl text-zinc-800/40 select-none">
                NO IMAGE
              </div>
            )}
            <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest ${
              event.status === 'upcoming'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
            }`}>
              {event.status}
            </div>
          </div>

          {/* Gallery Thumbnails */}
          {hasGallery && (
            <div className="grid grid-cols-5 gap-2.5">
              <button
                onClick={() => setActiveImage(event.banner_url)}
                className={`relative aspect-[16/10] rounded-xl overflow-hidden bg-zinc-950 border ${
                  activeImage === event.banner_url ? 'border-crimson ring-2 ring-crimson/20' : 'border-zinc-800'
                }`}
              >
                <img src={event.banner_url} alt="Banner" className="w-full h-full object-cover" />
              </button>

              {event.gallery_urls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(url)}
                  className={`relative aspect-[16/10] rounded-xl overflow-hidden bg-zinc-950 border ${
                    activeImage === url ? 'border-crimson ring-2 ring-crimson/20' : 'border-zinc-800'
                  }`}
                >
                  <img src={url} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Event Details & Action Box */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-2xl p-6 md:p-8 bg-zinc-900/30 border border-zinc-800/60 shadow-2xl">
            <h1 className="text-2xl md:text-3xl font-heading font-bold mb-4 text-white leading-tight">
              {event.title}
            </h1>

            {/* Time Stamp Card */}
            <div className="flex items-start gap-3 p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl mb-6">
              <div className="p-2 bg-crimson/10 rounded-lg text-crimson">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Scheduled Date/Time</p>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed mt-0.5">{formatDate(event.event_date)}</p>
              </div>
            </div>

            {/* Render customizable action buttons configured by Admin */}
            {event.action_buttons && event.action_buttons.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">Available Actions</p>
                {event.action_buttons.map((btn, idx) => (
                  <a
                    key={idx}
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${getButtonStyle(
                      btn.style
                    )}`}
                  >
                    <span>{btn.label}</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 text-center text-xs text-zinc-500">
                No interactive URLs configured for this event.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full text descriptions below */}
      <div className="mt-12 border-t border-zinc-800/50 pt-8 max-w-3xl">
        <h3 className="font-heading font-bold text-lg text-white mb-4">Event Description</h3>
        <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed space-y-4">
          {/* Renders basic rich description paragraph lines cleanly */}
          {event.description.split('\n\n').map((para, i) => (
            <p key={i} className="whitespace-pre-line text-sm md:text-base text-zinc-400">
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
