import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Determine which app to load based on the path
const isAdmin = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/accept-invite') || window.location.hostname.startsWith('admin');

async function mount() {
  const rootElement = document.getElementById('root')!;
  
  if (isAdmin) {
    // Dynamically import Admin App
    const { default: AdminApp } = await import('@/admin/App');
    import('@/admin/admin.css');
    
    createRoot(rootElement).render(
      <StrictMode>
        <AdminApp />
      </StrictMode>
    );
  } else {
    // Dynamically import Storefront App
    const { default: StorefrontApp } = await import('@/storefront/App');
    import('@/storefront/index.css');
    
    createRoot(rootElement).render(
      <StrictMode>
        <StorefrontApp />
      </StrictMode>
    );
  }
}

mount();
