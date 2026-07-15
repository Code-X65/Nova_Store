import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { searchProducts, createPosSale, type ProductSearchResult, type Order } from './api/pos';
import { DataTable } from '@/shared/ui/DataTable';
import { createColumnHelper } from '@tanstack/react-table';

interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

function money(n: number) {
  return `₦${Number(n || 0).toFixed(2)}`;
}

const cartColumnHelper = createColumnHelper<CartLine>();

export default function POSTerminal() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_card' | 'pos_transfer'>('cash');
  const [lastSale, setLastSale] = useState<Order | null>(null);

  const runSearch = async (term: string) => {
    setQuery(term);
    if (term.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await searchProducts(term.trim()));
    } catch {
      toast.error('Product search failed');
    } finally {
      setSearching(false);
    }
  };

  const addToCart = (p: ProductSearchResult) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.sale_price || p.price, quantity: 1 }];
    });
    setResults([]);
    setQuery('');
  };

  const updateQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId));
    } else {
      setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
    }
  };

  const cartColumns = [
    cartColumnHelper.accessor('name', {
      header: 'Item',
      cell: (info) => <span className="text-white">{info.getValue()}</span>,
    }),
    cartColumnHelper.accessor('quantity', {
      header: 'Qty',
      cell: (info) => (
        <input
          type="number"
          min={1}
          value={info.getValue()}
          onChange={(e) => updateQty(info.row.original.productId, Number(e.target.value))}
          className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-center"
        />
      ),
    }),
    cartColumnHelper.accessor('unitPrice', {
      header: 'Price',
      cell: (info) => <span className="text-gray-400 text-right block">{money(info.getValue())}</span>,
    }),
    cartColumnHelper.display({
      id: 'lineTotal',
      header: 'Total',
      cell: (info) => (
        <span className="text-white font-medium text-right block">
          {money(info.row.original.unitPrice * info.row.original.quantity)}
        </span>
      ),
    }),
    cartColumnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <button
          onClick={(e) => { e.stopPropagation(); updateQty(info.row.original.productId, 0); }}
          className="text-gray-500 hover:text-red-400"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      ),
    }),
  ];

  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const saleMutation = useMutation({
    mutationFn: () => createPosSale({
      customerEmail: customerEmail || undefined,
      paymentMethod,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    }),
    onSuccess: (order) => {
      toast.success(`Sale #${order.order_number} recorded`);
      setLastSale(order);
      setCart([]);
      setCustomerEmail('');
      qc.invalidateQueries({ queryKey: ['admin-pos-sales'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to record sale'),
  });

  if (lastSale) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-16">
        <div className="text-emerald-400 text-5xl">✓</div>
        <h1 className="text-2xl font-bold text-white">Sale Recorded</h1>
        <p className="text-gray-400">Order #{lastSale.order_number} — {money(lastSale.total_amount)}</p>
        <button onClick={() => setLastSale(null)} className="btn-primary">New Sale</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold text-white">POS Terminal</h1>

        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-black border border-white/10 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.sku} · Stock: {p.stock_quantity}</div>
                  </div>
                  <span className="text-sm text-nova-400">{money(p.sale_price || p.price)}</span>
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-gray-500 mt-1">Searching…</p>}
        </div>

        <div className="bg-black rounded-xl border border-white/10 overflow-hidden">
          {cart.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Search and add products to start a sale.</div>
          ) : (
            <DataTable columns={cartColumns} data={cart} disablePagination />
          )}
        </div>
      </div>

      <div className="bg-black rounded-xl border border-white/10 p-6 space-y-4 h-fit">
        <h2 className="text-lg font-bold text-white">Checkout</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Customer Email (optional)</label>
          <input
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="cash">Cash</option>
            <option value="pos_card">Card (POS terminal)</option>
            <option value="pos_transfer">Bank Transfer</option>
          </select>
        </div>

        <div className="border-t border-white/10 pt-4 flex items-center justify-between">
          <span className="text-gray-400">Total</span>
          <span className="text-xl font-bold text-white">{money(total)}</span>
        </div>

        <button
          onClick={() => saleMutation.mutate()}
          disabled={cart.length === 0 || saleMutation.isPending}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saleMutation.isPending ? 'Recording…' : 'Complete Sale'}
        </button>
      </div>
    </div>
  );
}
