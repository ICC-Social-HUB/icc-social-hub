import React, { useState } from 'react';
import EventsPage from './EventsPage';
import EventDetail from './EventDetail';
import AdminEventsPanel from './AdminEventsPanel';

/**
 * ========================================================
 * ICC EVENTS MODULE WRAPPER
 * Orchestrates navigation state between the public grid,
 * dynamic details page, and the admin panel dashboard.
 * ========================================================
 */
export default function EventsAppDemo() {
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'admin'
  const [selectedEventId, setSelectedEventId] = useState(null);

  const navigateToDetail = (eventId) => {
    setSelectedEventId(eventId);
    setView('detail');
  };

  const navigateToAdmin = () => {
    setView('admin');
  };

  const navigateBack = () => {
    setSelectedEventId(null);
    setView('list');
  };

  return (
    <div className="min-h-screen bg-black/90 py-6">
      {view === 'list' && (
        <EventsPage 
          onNavigateToDetail={navigateToDetail}
          onNavigateToAdmin={navigateToAdmin}
        />
      )}

      {view === 'detail' && (
        <EventDetail 
          eventId={selectedEventId}
          onNavigateBack={navigateBack}
        />
      )}

      {view === 'admin' && (
        <AdminEventsPanel 
          onNavigateBack={navigateBack}
        />
      )}
    </div>
  );
}
