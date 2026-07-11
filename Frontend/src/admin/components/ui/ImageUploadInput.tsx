import { useRef, useState } from 'react';
import { CloudArrowUpIcon, ArrowPathIcon, LinkIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';

interface ImageUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  multiple?: boolean;
  onChangeMultiple?: (urls: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ImageUploadInput({ value, onChange, multiple, onChangeMultiple, placeholder, className = '' }: ImageUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (validFiles.length < files.length) {
      toast.error('Some files exceed the 10MB limit and were skipped.');
    }
    if (!validFiles.length) return;

    setIsUploading(true);
    
    try {
      const urls: string[] = [];
      // Upload sequentially to avoid overwhelming the server
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/admin/upload', formData);
        if (data?.data?.url) {
          urls.push(data.data.url);
        }
      }

      if (urls.length > 0) {
        if (multiple && onChangeMultiple) {
          onChangeMultiple(urls);
        } else {
          onChange(urls[0]);
        }
        toast.success(urls.length > 1 ? `${urls.length} images uploaded` : 'Image uploaded successfully');
      } else {
        throw new Error('No URLs returned from server');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      const data = err?.response?.data;
      const msg = typeof data?.error === 'object' ? data?.error?.message : (data?.error || data?.message || 'Failed to upload image(s)');
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${mode === 'upload' ? 'bg-[var(--neu-accent)]/10 text-[var(--neu-accent)]' : 'text-[var(--neu-text)] hover:text-white hover:bg-white/5'}`}
        >
          <PhotoIcon className="w-3.5 h-3.5" />
          Upload Image
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${mode === 'url' ? 'bg-[var(--neu-accent)]/10 text-[var(--neu-accent)]' : 'text-[var(--neu-text)] hover:text-white hover:bg-white/5'}`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Paste URL
        </button>
      </div>

      {mode === 'url' ? (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--neu-accent)] focus:ring-1 focus:ring-[var(--neu-accent)] transition-all"
            placeholder={placeholder || 'https://...'}
          />
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*"
            multiple={multiple}
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          {value ? (
            <div className="relative group rounded-xl border border-[var(--panel-border)] overflow-hidden bg-[var(--neu-bg)] flex justify-center items-center">
              <img src={value} alt="Preview" className="max-h-48 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[var(--neu-accent)] text-white rounded-lg text-sm font-bold shadow-lg"
                >
                  Change Image
                </button>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="p-2 bg-red-500/20 text-red-500 hover:bg-red-500/40 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 bg-surface-2 hover:bg-white/5 border border-dashed border-white/20 rounded-xl text-sm font-medium text-[var(--neu-text)] transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <ArrowPathIcon className="w-6 h-6 animate-spin text-[var(--neu-accent)]" />
              ) : (
                <CloudArrowUpIcon className="w-6 h-6 text-[var(--neu-text)]" />
              )}
              {isUploading ? 'Uploading...' : 'Click to select an image'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
