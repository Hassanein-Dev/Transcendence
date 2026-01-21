export class NotificationSystem {
  private container: HTMLElement;

  constructor() {
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'notifications-container';
    container.className = 'fixed top-20 right-4 z-[9999] space-y-2';
    document.body.appendChild(container);
    return container;
  }

  show(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 5000) {
    const notification = document.createElement('div');
    notification.className = `px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
      type === 'info' ? 'bg-blue-500 border-blue-600' :
      type === 'success' ? 'bg-green-500 border-green-600' :
      type === 'warning' ? 'bg-yellow-500 border-yellow-600' :
      'bg-red-500 border-red-600'
    } border-l-4 text-white max-w-sm animate-slide-in`;
    
    // Build notification content safely
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'text-sm font-medium';
    msgSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-white hover:text-gray-200 ml-4';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    wrapper.appendChild(msgSpan);
    wrapper.appendChild(closeBtn);
    notification.appendChild(wrapper);

    this.container.appendChild(notification);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, duration);
    }

    return notification;
  }

  private removeNotification(notification: HTMLElement) {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }

  destroy() {
    this.container.remove();
  }
}

// Add CSS for animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;
document.head.appendChild(style);