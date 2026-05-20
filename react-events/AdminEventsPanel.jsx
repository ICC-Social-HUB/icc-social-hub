import React, { useState, useEffect } from 'react';
import { EventService } from './EventService';

export default function AdminEventsPanel({ onNavigateBack }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [bannerUrl, setBannerUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [actionButtons, setActionButtons] = useState([]);

  // File upload state helpers
  const [bannerFile, setBannerFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Dynamic button fields helper states
  const [newBtnLabel, setNewBtnLabel] = useState('');
  const [newBtnUrl, setNewBtnUrl] = useState('');
  const [newBtnStyle, setNewBtnStyle] = useState('primary');

  useEffect(() => {
    async function checkAuthAndLoad() {
      setLoading(true);
      const adminCheck = await EventService.isAdmin();
      if (!adminCheck) {
        setAuthorized(false);
        setError('Access Denied: You do not have administrator permissions.');
        setLoading(false);
        return;
      }
      setAuthorized(true);
      await loadEventsList();
    }
    checkAuthAndLoad();
  }, []);

  async function loadEventsList() {
    const res = await EventService.getEvents();
    if (res.error) {
      setError('Failed to load events database.');
    } else {
      setEvents([...res.upcoming, ...res.past]);
    }
    setLoading(false);
  }

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEditClick = (event) => {
    setIsEditing(true);
    setEditingEventId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    
    // Format date string to local ISO format for datetime-local input
    const localDate = new Date(event.event_date);
    const timezoneOffset = localDate.getTimezoneOffset() * 60000; // in ms
    const localISOTime = new Date(localDate - timezoneOffset).toISOString().slice(0, 16);
    setEventDate(localISOTime);
    
    setStatus(event.status);
    setBannerUrl(event.banner_url || '');
    setGalleryUrls(event.gallery_urls || []);
    setActionButtons(event.action_buttons || []);
    setBannerFile(null);
    setGalleryFiles([]);
    window.scrollTo(0, 0);
  };

  const handleAddClick = () => {
    setIsEditing(true);
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setEventDate('');
    setStatus('upcoming');
    setBannerUrl('');
    setGalleryUrls([]);
    setActionButtons([]);
    setBannerFile(null);
    setGalleryFiles([]);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditingEventId(null);
  };

  // Dynamic Button List Mutations
  const addActionButton = () => {
    if (!newBtnLabel.trim() || !newBtnUrl.trim()) {
      showNotification('Button Label and Target URL are required fields.', 'error');
      return;
    }
    const newButton = {
      label: newBtnLabel.trim(),
      url: newBtnUrl.trim(),
      style: newBtnStyle
    };
    setActionButtons([...actionButtons, newButton]);
    setNewBtnLabel('');
    setNewBtnUrl('');
    setNewBtnStyle('primary');
  };

  const removeActionButton = (index) => {
    const updated = [...actionButtons];
    updated.splice(index, 1);
    setActionButtons(updated);
  };

  // Image Upload handler
  const triggerImageUploads = async () => {
    setUploading(true);
    let uploadedBannerUrl = bannerUrl;
    const uploadedGalleryUrls = [...galleryUrls];

    try {
      // 1. Upload Banner image file if selected
      if (bannerFile) {
        const uploadRes = await EventService.uploadEventImage(bannerFile, 'banners');
        if (uploadRes.error) throw uploadRes.error;
        uploadedBannerUrl = uploadRes.publicUrl;
      }

      // 2. Upload Gallery files if selected
      if (galleryFiles.length > 0) {
        for (let i = 0; i < galleryFiles.length; i++) {
          const uploadRes = await EventService.uploadEventImage(galleryFiles[i], 'gallery');
          if (uploadRes.error) throw uploadRes.error;
          uploadedGalleryUrls.push(uploadRes.publicUrl);
        }
      }

      return { banner: uploadedBannerUrl, gallery: uploadedGalleryUrls, success: true };
    } catch (err) {
      console.error(err);
      showNotification('Image upload failed. Please verify files are correct.', 'error');
      setUploading(false);
      return { banner: bannerUrl, gallery: galleryUrls, success: false };
    }
  };

  // Handle entire form Submit (Create / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !eventDate) {
      showNotification('Title, Description, and Event Date/Time are required.', 'error');
      return;
    }

    setUploading(true);
    // 1. Handle file uploads first
    const uploadAssets = await triggerImageUploads();
    if (!uploadAssets.success) {
      setUploading(false);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      event_date: new Date(eventDate).toISOString(),
      status,
      banner_url: uploadAssets.banner,
      gallery_urls: uploadAssets.gallery,
      action_buttons: actionButtons,
      updated_at: new Date().toISOString()
    };

    let result;
    if (editingEventId) {
      result = await EventService.updateEvent(editingEventId, payload);
    } else {
      result = await EventService.createEvent(payload);
    }

    setUploading(false);

    if (result.error) {
      showNotification(`Submit failed: ${result.error.message}`, 'error');
    } else {
      showNotification(editingEventId ? 'Event updated successfully.' : 'New Event created successfully.');
      setIsEditing(false);
      setEditingEventId(null);
      setLoading(true);
      await loadEventsList();
    }
  };

  // Handle event delete click
  const handleDeleteClick = async (event) => {
    if (!window.confirm(`⚠️ CRITICAL: Are you sure you want to permanently delete the event "${event.title}"? This will also purge its storage images.`)) {
      return;
    }

    setLoading(true);
    const res = await EventService.deleteEvent(event);
    if (res.error) {
      showNotification(`Delete failed: ${res.error.message}`, 'error');
      setLoading(false);
    } else {
      showNotification('Event permanently deleted.');
      await loadEventsList();
    }
  };

  const removeGalleryImage = (index) => {
    const updated = [...galleryUrls];
    updated.splice(index, 1);
    setGalleryUrls(updated);
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

  if (!authorized) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-20 text-center text-white">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-950/20 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold font-heading mb-2">Access Denied</h2>
        <p className="text-zinc-500 text-sm mb-6">{error}</p>
        <button
          onClick={onNavigateBack}
          className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
        >
          Return to Events
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 animate-fade-in text-white selection:bg-crimson selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-[999] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border animate-slide-in ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
            : 'bg-red-950/90 border-red-500/30 text-red-400'
        }`}>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header banner */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4 pb-6 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Admin Events Dashboard</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Antigravity Management Module</p>
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-5 py-3 bg-crimson hover:bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] shadow-lg shadow-crimson/15"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            <span>Add Event Entry</span>
          </button>
        )}
      </div>

      {isEditing ? (
        /* EDIT / CREATE EVENT ENTRY VIEW FORM */
        <div className="glass-card rounded-2xl p-6 md:p-8 bg-zinc-900/30 border border-zinc-800/60 shadow-2xl animate-scale-up">
          <h2 className="text-lg font-heading font-bold mb-6 text-crimson pb-3 border-b border-zinc-950">
            {editingEventId ? 'Edit Event Details' : 'Create New Event Details'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Innovators Hackathon v4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white focus:border-crimson outline-none transition-colors"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Timeline Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white focus:border-crimson outline-none transition-colors"
                >
                  <option value="upcoming">Upcoming Event (Accepting Registrations)</option>
                  <option value="past">Past Event (Showcase Legacy details)</option>
                </select>
              </div>

              {/* Date time-local */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white focus:border-crimson outline-none transition-colors"
                />
              </div>

              {/* Banner Upload File */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Upload Main Banner Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBannerFile(e.target.files[0])}
                  className="w-full text-xs text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-300 file:hover:bg-zinc-800 file:cursor-pointer bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl"
                />
                {bannerUrl && !bannerFile && (
                  <p className="text-[10px] text-emerald-400 mt-2">Current Active: {bannerUrl.split('/').pop()}</p>
                )}
              </div>
            </div>

            {/* Rich Text / Description Area */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Description (Markdown/Rich Text Support)</label>
              <textarea
                required
                rows="6"
                placeholder="Describe the schedule, requirements, syllabus details, eligibility and outline for the event..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white focus:border-crimson outline-none transition-colors resize-y font-mono"
              />
            </div>

            {/* Gallery Images Section */}
            <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-900">
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Image Showcase Gallery</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setGalleryFiles(Array.from(e.target.files))}
                className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-zinc-900 file:text-zinc-300 file:hover:bg-zinc-800 file:cursor-pointer"
              />
              
              {galleryUrls.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {galleryUrls.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-12 rounded-lg overflow-hidden border border-zinc-800 group">
                      <img src={url} alt="Showcase" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION BUTTON BUILDER (DYNAMIC FIELDS) */}
            <div className="p-5 bg-zinc-950/80 rounded-xl border border-zinc-900 space-y-4">
              <h3 className="text-xs font-heading font-extrabold text-white uppercase tracking-wider">Dynamic Call-To-Action (CTA) Links</h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Add one or more buttons to appear on the detailed page view (e.g., Register forms, legacy slideshow URL, learn documents, feedback links).
              </p>

              {actionButtons.length > 0 && (
                <div className="space-y-2 max-w-xl">
                  {actionButtons.map((btn, index) => (
                    <div key={index} className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-850">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          btn.style === 'primary' ? 'bg-crimson/10 text-crimson' : 'bg-zinc-800 text-zinc-400'
                        }`}>{btn.style}</span>
                        <span className="text-xs font-bold">{btn.label}</span>
                        <span className="text-[10px] text-zinc-500 font-mono line-clamp-1">({btn.url})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeActionButton(index)}
                        className="text-xs text-red-500 hover:text-red-400 font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-900/60">
                <input
                  type="text"
                  placeholder="e.g. Register Now"
                  value={newBtnLabel}
                  onChange={(e) => setNewBtnLabel(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs text-white outline-none focus:border-crimson"
                />
                <input
                  type="url"
                  placeholder="e.g. https://forms.gle/..."
                  value={newBtnUrl}
                  onChange={(e) => setNewBtnUrl(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs text-white outline-none focus:border-crimson"
                />
                <div className="flex gap-2">
                  <select
                    value={newBtnStyle}
                    onChange={(e) => setNewBtnStyle(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs text-white outline-none focus:border-crimson"
                  >
                    <option value="primary">Crimson Pill</option>
                    <option value="secondary">Glass Pill</option>
                    <option value="danger">Gold Pill</option>
                  </select>
                  <button
                    type="button"
                    onClick={addActionButton}
                    className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold rounded-xl border border-zinc-800 text-crimson"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* FORM FOOTER CONTROLS */}
            <div className="flex items-center gap-3 pt-4 border-t border-zinc-950">
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-3.5 bg-crimson hover:bg-rose-600 disabled:bg-zinc-900 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all hover:scale-[1.02] shadow-lg shadow-crimson/15 flex-1 md:flex-none"
              >
                {uploading ? 'Processing Data Assets...' : editingEventId ? 'Commit Changes' : 'Publish Entry'}
              </button>
              <button
                type="button"
                onClick={handleCancelClick}
                className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* EVENT ENTRIES LIST */
        <div className="glass-card rounded-2xl overflow-hidden bg-zinc-900/30 border border-zinc-800/60 shadow-2xl">
          <div className="px-6 py-4 border-b border-zinc-950">
            <h2 className="text-sm font-bold font-heading">Event Database Listing ({events.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-950 text-zinc-500 uppercase tracking-widest font-extrabold bg-zinc-950/20">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Event Date</th>
                  <th className="px-6 py-4">Timeline</th>
                  <th className="px-6 py-4">Links</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/30">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-zinc-950/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-7 rounded bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0">
                          {event.banner_url && (
                            <img src={event.banner_url} alt="Cover" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="font-bold text-white text-sm line-clamp-1">{event.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono">
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        event.status === 'upcoming'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-500">
                      {event.action_buttons?.length || 0} Links
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEditClick(event)}
                        className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg mr-2 font-bold hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(event)}
                        className="px-3.5 py-1.5 bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
