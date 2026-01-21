export class AvatarUpload {
    private modal: HTMLElement;
    private fileInput: HTMLInputElement;
    private preview: HTMLImageElement;
    private selectedFile: File | null = null;
    private onUploadCallback?: (avatarUrl: string) => void;

    constructor() {
        this.modal = this.createModal();
        this.fileInput = this.modal.querySelector('#avatarFileInput') as HTMLInputElement;
        this.preview = this.modal.querySelector('#avatarPreview') as HTMLImageElement;
        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }

    private createModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.id = 'avatarUploadModal';
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center hidden z-[9998] p-4';

        modal.innerHTML = `
      <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            📸 Upload Avatar
          </h3>
          <button id="closeAvatarModal" class="text-gray-400 hover:text-white text-2xl transition-colors">&times;</button>
        </div>
        
        <div class="space-y-6">
          <!-- File Input -->
          <div class="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-purple-500 transition-colors cursor-pointer" id="dropZone">
            <input type="file" id="avatarFileInput" accept="image/*" class="hidden" />
            <div class="text-5xl mb-4">📷</div>
            <p class="text-gray-300 mb-2">Click to upload or drag and drop</p>
            <p class="text-sm text-gray-500">PNG, JPG, GIF up to 5MB</p>
          </div>
          
          <!-- Preview -->
          <div id="previewContainer" class="hidden">
            <div class="text-sm text-gray-400 mb-2">Preview:</div>
            <div class="flex justify-center">
              <div class="relative">
                <img id="avatarPreview" src="" class="w-40 h-40 rounded-full object-cover border-4 border-purple-500" />
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex gap-3">
            <button id="uploadAvatarBtn" class="flex-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Upload
            </button>
            <button id="cancelAvatarUpload" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl border border-gray-600 transition-all duration-300">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;

        return modal;
    }

    private setupEventListeners(): void {
        const dropZone = this.modal.querySelector('#dropZone') as HTMLElement;
        const closeBtn = this.modal.querySelector('#closeAvatarModal') as HTMLButtonElement;
        const cancelBtn = this.modal.querySelector('#cancelAvatarUpload') as HTMLButtonElement;
        const uploadBtn = this.modal.querySelector('#uploadAvatarBtn') as HTMLButtonElement;
        const previewContainer = this.modal.querySelector('#previewContainer') as HTMLElement;

        // Click to select file
        dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File selection
        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-purple-500');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-purple-500');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-purple-500');
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFileSelect(file);
            }
        });

        // Upload button
        uploadBtn.addEventListener('click', async () => {
            if (this.selectedFile) {
                await this.uploadAvatar();
            }
        });

        // Close buttons
        closeBtn.addEventListener('click', () => this.close());
        cancelBtn.addEventListener('click', () => this.close());

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    private handleFileSelect(file: File): void {

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('File too large. Maximum size is 5MB', 'error');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }
        this.selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.preview.src = e.target?.result as string;
            const previewContainer = this.modal.querySelector('#previewContainer') as HTMLElement;
            previewContainer.classList.remove('hidden');

            const uploadBtn = this.modal.querySelector('#uploadAvatarBtn') as HTMLButtonElement;
            uploadBtn.disabled = false;
        };
        reader.onerror = (error) => {
            this.showNotification('Failed to read image file', 'error');
        };
        reader.readAsDataURL(file);
    }

    private async uploadAvatar(): Promise<void> {
        if (!this.selectedFile) return;

        const uploadBtn = this.modal.querySelector('#uploadAvatarBtn') as HTMLButtonElement;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            // Convert to base64
            const base64 = await this.fileToBase64(this.selectedFile);

            // Call the callback with the base64 data
            if (this.onUploadCallback) {
                await this.onUploadCallback(base64);
            }

            // Don't show notification here - the callback handles it
            this.close();
        } catch (error) {
            this.showNotification('Failed to upload avatar', 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        // Get or create the shared notifications container
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            container.className = 'fixed top-20 right-4 z-[9999] space-y-2';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 max-w-sm animate-slide-in ${
            type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
            type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' :
            'bg-gradient-to-r from-blue-500 to-purple-600'
        }`;

        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center space-x-3';
        const icon = document.createElement('span');
        icon.className = 'text-xl';
        icon.textContent = (type === 'success' ? '✨' : type === 'error' ? '❌' : 'ℹ️');
        const msgSpan = document.createElement('span');
        msgSpan.className = 'font-semibold text-white';
        msgSpan.textContent = message;
        wrapper.appendChild(icon);
        wrapper.appendChild(msgSpan);
        notification.appendChild(wrapper);

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    open(callback?: (avatarUrl: string) => void): void {
        this.onUploadCallback = callback;
        this.modal.classList.remove('hidden');
        this.reset();
    }

    close(): void {
        this.modal.classList.add('hidden');
        this.reset();
    }

    private reset(): void {
        this.selectedFile = null;
        this.fileInput.value = '';
        this.preview.src = '';
        const previewContainer = this.modal.querySelector('#previewContainer') as HTMLElement;
        previewContainer.classList.add('hidden');
        const uploadBtn = this.modal.querySelector('#uploadAvatarBtn') as HTMLButtonElement;
        uploadBtn.disabled = true;
    }

    destroy(): void {
        this.modal.remove();
    }
}
