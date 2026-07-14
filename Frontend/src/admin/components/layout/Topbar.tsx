import { useState, useEffect, useRef } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { NotificationBell } from './NotificationBell';
import { NotificationToasts } from '@/admin/components/Toast/NotificationToast';
import { UserMenu } from './UserMenu';
import { useAdminSession } from '@/admin/hooks/useAdminSession';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import { Link } from 'react-router-dom';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ sidebarCollapsed, onToggleSidebar }: TopbarProps) {
  const { session } = useAdminSession();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['admin-search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return null;
      const { data } = await api.get('/admin/search', { params: { q: debouncedQuery } });
      return data.data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const showDropdown = isFocused && query.length >= 2;

  const hasResults = searchResults && (
    (searchResults.products?.length > 0) ||
    (searchResults.orders?.length > 0) ||
    (searchResults.customers?.length > 0) ||
    (searchResults.staff?.length > 0) ||
    (searchResults.categories?.length > 0) ||
    (searchResults.brands?.length > 0) ||
    (searchResults.coupons?.length > 0)
  );

  return (
    <header className="h-[80px] flex items-center justify-between px-8 bg-black z-20 relative">
      {/* Left: Search Bar */}
      <div className="flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2.5 bg-[#111111] rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-nova-500 transition-colors"
            placeholder="Search anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
          />

          {/* Search Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl max-h-[70vh] overflow-y-auto z-50">
              {isLoading && (
                <div className="p-4 text-sm text-gray-400 text-center">Searching...</div>
              )}
              
              {!isLoading && !hasResults && debouncedQuery.length >= 2 && (
                <div className="p-4 text-sm text-gray-400 text-center">No results found for "{debouncedQuery}"</div>
              )}

              {!isLoading && searchResults && (
                <div className="py-2">
                  {searchResults.products?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Products</div>
                      {searchResults.products.map((p: any) => (
                        <Link 
                          key={p.id} 
                          to={`/catalog/products/${p.id}`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{p.name}</div>
                          <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.orders?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Orders</div>
                      {searchResults.orders.map((o: any) => (
                        <Link 
                          key={o.id} 
                          to={`/orders/${o.id}`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">Order {o.order_number}</div>
                          <div className="text-xs text-gray-500">{o.email}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.customers?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Customers</div>
                      {searchResults.customers.map((c: any) => (
                        <Link 
                          key={c.id} 
                          to={`/customers/${c.id}`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{c.first_name} {c.last_name}</div>
                          <div className="text-xs text-gray-500">{c.email}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.staff?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Staff</div>
                      {searchResults.staff.map((s: any) => (
                        <Link 
                          key={s.id} 
                          to={`/staff`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{s.first_name} {s.last_name} <span className="text-xs text-nova-500 ml-2">({s.role})</span></div>
                          <div className="text-xs text-gray-500">{s.email}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.categories?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Categories</div>
                      {searchResults.categories.map((c: any) => (
                        <Link 
                          key={c.id} 
                          to={`/catalog/categories`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{c.name}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.brands?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Brands</div>
                      {searchResults.brands.map((b: any) => (
                        <Link 
                          key={b.id} 
                          to={`/catalog/brands`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{b.name}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.coupons?.length > 0 && (
                    <div className="mb-2">
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111] sticky top-0">Coupons</div>
                      {searchResults.coupons.map((c: any) => (
                        <Link 
                          key={c.id} 
                          to={`/coupons`} 
                          onClick={() => setIsFocused(false)}
                          className="block px-4 py-2 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <div className="text-sm text-white font-medium">{c.code}</div>
                          <div className="text-xs text-gray-500 capitalize">{c.discount_type} - {c.discount_value}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: bell + menu */}
      <div className="flex items-center gap-4">
        <NotificationBell />
        <NotificationToasts />
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-[#111111] transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed
            ? <Bars3Icon className="w-6 h-6" />
            : <XMarkIcon className="w-6 h-6" />
          }
        </button>
      </div>
    </header>
  );
}