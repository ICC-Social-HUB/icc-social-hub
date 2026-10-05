/* ============================================
   ICC Social Hub — Download App View
   ============================================ */
const DownloadView = (() => {
    function render() {
        return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800/50 p-8 md:p-12">
                <!-- Decorative Background Elements -->
                <div class="absolute top-0 right-0 w-64 h-64 bg-crimson/10 blur-[100px] -z-10"></div>
                <div class="absolute bottom-0 left-0 w-64 h-64 bg-crimson/5 blur-[80px] -z-10"></div>

                <div class="grid md:grid-cols-2 gap-12 items-center">
                    <div class="space-y-6 text-center md:text-left">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson/10 border border-crimson/20 text-crimson text-xs font-bold uppercase tracking-wider">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-crimson"></span>
                            </span>
                            Latest Version Available
                        </div>
                        
                        <h1 class="text-4xl md:text-5xl font-heading font-bold leading-tight">
                            Experience ICC <br/>
                            <span class="text-transparent bg-clip-text bg-gradient-to-r from-crimson to-rose-500">On Your Mobile</span>
                        </h1>
                        
                        <p class="text-zinc-400 text-lg leading-relaxed">
                            Get the full Innovation Social Hub experience with real-time notifications, 
                            smoother animations, and offline access. Join the community of innovators 
                            anytime, anywhere.
                        </p>

                        <div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <a id="apk-download-btn" href="assets/icc-social-hub.apk" download="icc-social-hub.apk" target="_blank" rel="noopener noreferrer" class="group relative flex items-center justify-center gap-3 px-8 py-4 bg-crimson hover:bg-rose-600 text-white rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-crimson/20">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.523 15.3414C17.3014 15.3414 17.1127 15.1528 17.1127 14.9312V11.2335C17.1127 11.0118 16.9241 10.8232 16.7025 10.8232H15.0664V5.70138C15.0664 5.47974 14.8778 5.29114 14.6562 5.29114H9.33333C9.11169 5.29114 8.92309 5.47974 8.92309 5.70138V10.8232H7.28704C7.06541 10.8232 6.8768 11.0118 6.8768 11.2335V14.9312C6.8768 15.1528 6.6882 15.3414 6.46657 15.3414C6.24493 15.3414 6.05633 15.1528 6.05633 14.9312V11.2335C6.05633 10.5552 6.60867 10.0029 7.28704 10.0029H8.10261V5.70138C8.10261 5.02301 8.65495 4.47067 9.33333 4.47067H14.6562C15.3345 4.47067 15.8869 5.02301 15.8869 5.70138V10.0029H16.7025C17.3809 10.0029 17.9332 10.5552 17.9332 11.2335V14.9312C17.9332 15.1528 17.7446 15.3414 17.523 15.3414Z"/><path d="M11.9947 19.5293C11.7731 19.5293 11.5845 19.3407 11.5845 19.1191V8.97672C11.5845 8.75508 11.7731 8.56648 11.9947 8.56648C12.2164 8.56648 12.405 8.75508 12.405 8.97672V19.1191C12.405 19.3407 12.2164 19.5293 11.9947 19.5293Z"/><path d="M12 20.3499L7.90261 16.2525C7.74636 16.0963 7.74636 15.8428 7.90261 15.6866C8.05886 15.5303 8.31238 15.5303 8.46863 15.6866L12 19.2179L15.5314 15.6866C15.6876 15.5303 15.9411 15.5303 16.0974 15.6866C16.2536 15.8428 16.2536 16.0963 16.0974 16.2525L12 20.3499Z"/></svg>
                                <span>Download APK</span>
                                <div class="absolute inset-0 rounded-2xl border-2 border-white/20 scale-105 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all"></div>
                            </a>
                        </div>
                        
                        <div class="pt-4 flex flex-wrap justify-center md:justify-start gap-6">
                            <div class="flex items-center gap-2 text-zinc-500">
                                <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                <span class="text-xs font-medium">Safe & Secure</span>
                            </div>
                            <div class="flex items-center gap-2 text-zinc-500">
                                <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                <span id="apk-version-badge" class="text-xs font-medium">Latest Build</span>
                            </div>
                        </div>
                    </div>

                    <div class="relative flex justify-center">
                        <!-- Image Container -->
                        <div class="relative w-full max-w-[320px] aspect-[9/19] rounded-[3rem] overflow-hidden border-[8px] border-zinc-800 shadow-2xl bg-zinc-950">
                            <img src="images/mobile_app_showcase.png" alt="ICC Mobile App" class="w-full h-full object-cover">
                            <!-- Overlay shine -->
                            <div class="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
                        </div>
                        
                    </div>
                </div>
            </div>

            <!-- Features Section -->
            <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 space-y-4">
                    <div class="w-12 h-12 bg-crimson/10 rounded-xl flex items-center justify-center text-crimson">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <h3 class="font-bold text-lg">Blazing Fast</h3>
                    <p class="text-zinc-500 text-sm leading-relaxed">Native performance and optimized assets ensure the app runs smoothly even on older devices.</p>
                </div>
                
                <div class="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 space-y-4">
                    <div class="w-12 h-12 bg-crimson/10 rounded-xl flex items-center justify-center text-crimson">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    </div>
                    <h3 class="font-bold text-lg">Push Notifications</h3>
                    <p class="text-zinc-500 text-sm leading-relaxed">Never miss an update. Get notified instantly about new posts, messages, and team requests.</p>
                </div>

                <div class="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 space-y-4">
                    <div class="w-12 h-12 bg-crimson/10 rounded-xl flex items-center justify-center text-crimson">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    </div>
                    <h3 class="font-bold text-lg">Native UI</h3>
                    <p class="text-zinc-500 text-sm leading-relaxed">An interface designed specifically for mobile users, with gesture support and haptic feedback.</p>
                </div>
            </div>

            <!-- Installation Guide -->
            <div class="mt-16 text-center space-y-8">
                <h2 class="text-2xl font-bold font-heading">How to Install</h2>
                <div class="flex flex-col md:flex-row justify-center gap-8 text-left max-w-2xl mx-auto">
                    <div class="flex gap-4">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 shrink-0">1</div>
                        <div>
                            <p class="font-bold text-sm">Download APK</p>
                            <p class="text-zinc-500 text-xs">Click the download button above.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 shrink-0">2</div>
                        <div>
                            <p class="font-bold text-sm">Allow Unknown Sources</p>
                            <p class="text-zinc-500 text-xs">Enable installation in your browser settings.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 shrink-0">3</div>
                        <div>
                            <p class="font-bold text-sm">Install & Open</p>
                            <p class="text-zinc-500 text-xs">Open the file and follow instructions.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes bounce-slow {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            .animate-bounce-slow {
                animation: bounce-slow 3s ease-in-out infinite;
            }
        </style>
        `;
    }

    async function mount(container) {
        container.innerHTML = render();

        const downloadBtn = container.querySelector('#apk-download-btn');
        const versionBadge = container.querySelector('#apk-version-badge');

        if (downloadBtn) {
            // Append cache buster to ensure the user always gets the freshest build
            const cacheBuster = `?v=${Date.now()}`;
            downloadBtn.href = `assets/icc-social-hub.apk${cacheBuster}`;
        }

        try {
            const res = await fetch('https://api.github.com/repos/Saravanan-space/icc-social-hub/releases/latest');
            if (res.ok) {
                const data = await res.json();
                if (versionBadge && data.published_at) {
                    const pubDate = new Date(data.published_at);
                    const formattedDate = pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    versionBadge.textContent = `Updated ${formattedDate}`;
                }
                const apkAsset = data.assets && data.assets.find(a => a.name.endsWith('.apk'));
                if (apkAsset && downloadBtn) {
                    downloadBtn.href = `${apkAsset.browser_download_url}?v=${Date.now()}`;
                }
            }
        } catch (err) {
            console.warn('Could not fetch latest GitHub release details:', err);
        }
    }

    return { mount };
})();
