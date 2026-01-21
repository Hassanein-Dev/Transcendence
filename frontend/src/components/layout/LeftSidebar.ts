export class LeftSidebarComponent {
    private element: HTMLElement | null = null;
    private isVisible: boolean = true;

    constructor() {
        this.render();
    }

    async render() {
        // Remove existing if any
        const existing = document.getElementById('left-sidebar');
        if (existing) existing.remove();

        this.element = document.createElement('div');
        this.element.id = 'left-sidebar';
        this.element.className = `fixed left-0 top-16 bottom-0 w-72 bg-gradient-to-br from-gray-800/90 to-gray-900/80 backdrop-blur-lg border-r border-gray-700/50 z-40 transition-all duration-300 overflow-y-auto`;
        this.element.style.margin = '0';
        this.element.style.padding = '0';
        this.element.style.boxSizing = 'border-box';
        this.element.style.display = window.innerWidth >= 1280 ? 'block' : 'none';

        // Update display on resize
        window.addEventListener('resize', () => {
            if (this.element) {
                this.element.style.display = window.innerWidth >= 1280 ? 'block' : 'none';
            }
        });


        // News & Events Content
        const container = document.createElement('div');
        container.className = 'h-full flex flex-col p-6 overflow-y-auto';

        // Header
        const header = document.createElement('div');
        header.className = 'flex items-center space-x-3 mb-8';
        const hIcon = document.createElement('span'); hIcon.className = 'text-2xl'; hIcon.textContent = '📰';
        const hTitle = document.createElement('h2'); hTitle.className = 'text-xl font-bold text-white'; hTitle.textContent = 'News feed';
        header.appendChild(hIcon); header.appendChild(hTitle);
        container.appendChild(header);

        try {
            // Fetch news
            const response = await fetch('/api/news');
            const newsItems = await response.json();

            // Filter items
            const events = newsItems.filter((i: any) => ['event', 'tournament'].includes(i.type));
            const news = newsItems.filter((i: any) => !['event', 'tournament'].includes(i.type));

            // Section: Upcoming Events
            const eventsSec = document.createElement('div');
            eventsSec.className = 'mb-8';
            const eTitle = document.createElement('h3'); eTitle.className = 'text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4'; eTitle.textContent = 'Upcoming Events';
            eventsSec.appendChild(eTitle);

            if (events.length > 0) {
                events.forEach((ev: any) => {
                    const card = document.createElement('div');
                    card.className = 'bg-gray-800/50 rounded-xl p-3 mb-3 border border-gray-700/50 hover:bg-gray-700/50 transition-colors cursor-pointer group';

                    const row = document.createElement('div'); row.className = 'flex items-center space-x-3';
                    const iconSign = ev.type === 'tournament' ? '⚔️' : '🏆';
                    const icon = document.createElement('span'); icon.className = `text-xl text-yellow-400`; icon.textContent = iconSign;

                    const info = document.createElement('div');
                    const title = document.createElement('div'); title.className = 'text-sm font-medium text-gray-200 group-hover:text-white'; title.textContent = ev.title;

                    const date = document.createElement('div'); date.className = 'text-xs text-gray-400 mt-1 font-mono';
                    if (ev.event_date) {
                        const d = new Date(ev.event_date);
                        date.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    } else {
                        date.textContent = 'Coming soon';
                    }

                    info.appendChild(title); info.appendChild(date);
                    row.appendChild(icon); row.appendChild(info);
                    card.appendChild(row);
                    eventsSec.appendChild(card);
                });
            } else {
                const empty = document.createElement('p'); empty.className = 'text-sm text-gray-500 italic'; empty.textContent = 'No upcoming events';
                eventsSec.appendChild(empty);
            }
            container.appendChild(eventsSec);

            // Section: Latest News
            const newsSec = document.createElement('div');
            const nTitle = document.createElement('h3'); nTitle.className = 'text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4'; nTitle.textContent = 'Latest News';
            newsSec.appendChild(nTitle);

            if (news.length > 0) {
                const iconMap: any = { 'update': '🚀', 'feature': '✨', 'maintenance': '🛠️', 'news': '📰' };
                news.forEach((n: any) => {
                    const item = document.createElement('div');
                    item.className = 'mb-4 pb-4 border-b border-gray-700/30 last:border-0';

                    const t = document.createElement('div'); t.className = 'text-sm font-medium text-gray-300 hover:text-blue-300 cursor-pointer transition-colors';
                    const ic = iconMap[n.type] || '📰';
                    t.textContent = `${ic} ${n.title}`;

                    const d = document.createElement('div'); d.className = 'text-xs text-gray-500 mt-1'; d.textContent = n.content;

                    // Format relative time (basic)
                    // Format relative time
                    const tm = document.createElement('div'); tm.className = 'text-[10px] text-gray-600 mt-1';

                    const now = new Date();
                    // Assume DB UTC string "YYYY-MM-DD HH:MM:SS" -> Treat as UTC
                    const dbDate = new Date(n.created_at + 'Z');
                    // Fallback if 'Z' makes it invalid (e.g. if already ISO)
                    const date = isNaN(dbDate.getTime()) ? new Date(n.created_at) : dbDate;

                    const diffMs = now.getTime() - date.getTime();
                    const diffSec = Math.floor(diffMs / 1000);
                    const diffMin = Math.floor(diffSec / 60);
                    const diffHr = Math.floor(diffMin / 60);
                    const diffDay = Math.floor(diffHr / 24);

                    if (diffSec < 60) {
                        tm.textContent = 'Just now';
                    } else if (diffMin < 60) {
                        tm.textContent = `${diffMin}m ago`;
                    } else if (diffHr < 24) {
                        tm.textContent = `${diffHr}h ago`;
                    } else {
                        tm.textContent = diffDay === 0 ? 'Today' : `${diffDay}d ago`;
                    }

                    item.appendChild(t); item.appendChild(d); item.appendChild(tm);
                    newsSec.appendChild(item);
                });
            } else {
                const empty = document.createElement('p'); empty.className = 'text-sm text-gray-500 italic'; empty.textContent = 'No news available';
                newsSec.appendChild(empty);
            }
            container.appendChild(newsSec);

        } catch (error) {
            const err = document.createElement('p'); err.className = 'text-red-400 text-sm'; err.textContent = 'Failed to load news feed';
            container.appendChild(err);
        }

        this.element.appendChild(container);

        // Append to body (fixed positioning, not part of flex layout)
        document.body.appendChild(this.element);
    }

    toggle(visible: boolean) {
        this.isVisible = visible;
        if (this.element) {
            if (visible) {
                this.element.classList.remove('-translate-x-full');
                this.element.classList.add('translate-x-0');
            } else {
                this.element.classList.remove('translate-x-0');
                this.element.classList.add('-translate-x-full');
            }
        }
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
