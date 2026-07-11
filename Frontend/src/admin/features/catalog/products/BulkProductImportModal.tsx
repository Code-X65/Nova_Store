import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/admin/lib/api';
import toast from 'react-hot-toast';
import { XMarkIcon, ArrowUpTrayIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

interface BulkProductImportModalProps {
 isOpen: boolean;
 onClose: () => void;
}

export function BulkProductImportModal({ isOpen, onClose }: BulkProductImportModalProps) {
 const qc = useQueryClient();
 const [jsonInput, setJsonInput] = useState('');

 const importMutation = useMutation({
 mutationFn: async (data: any[]) => {
 const response = await api.post('/products/bulk', data);
 return response.data;
 },
 onSuccess: (data) => {
 toast.success(`Successfully imported ${data.data?.length || 0} products.`);
 qc.invalidateQueries({ queryKey: ['products'] });
 setJsonInput('');
 onClose();
 },
 onError: (error: any) => {
 toast.error(error.response?.data?.message || 'Failed to import products');
 }
 });

 const handleImport = () => {
 try {
 const parsedData = JSON.parse(jsonInput);
 if (!Array.isArray(parsedData)) {
 toast.error('Input must be a JSON array of products.');
 return;
 }
 importMutation.mutate(parsedData);
 } catch (e) {
 toast.error('Invalid JSON format.');
 }
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const fileExt = file.name.split('.').pop()?.toLowerCase();
 
 if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
 const reader = new FileReader();
 reader.onload = (event) => {
 try {
 const data = new Uint8Array(event.target?.result as ArrayBuffer);
 const workbook = XLSX.read(data, { type: 'array' });
 const firstSheetName = workbook.SheetNames[0];
 const worksheet = workbook.Sheets[firstSheetName];
 const jsonData = XLSX.utils.sheet_to_json(worksheet);
 setJsonInput(JSON.stringify(jsonData, null, 2));
 } catch (error) {
 toast.error('Failed to parse Excel/CSV file.');
 console.error(error);
 }
 };
 reader.readAsArrayBuffer(file);
 } else {
 // Handle JSON
 const reader = new FileReader();
 reader.onload = (event) => {
 const content = event.target?.result as string;
 setJsonInput(content);
 };
 reader.readAsText(file);
 }
 
 // reset input so the same file can be selected again
 e.target.value = '';
 };

 const downloadTemplate = () => {
 const templateData = [
 {
 name: 'Sample Wireless Mouse',
 sku: 'WM-1000',
 price: 29.99,
 cost_price: 15.00,
 stock_quantity: 100,
 category_id: 'ENTER_CATEGORY_UUID',
 brand_id: 'ENTER_BRAND_UUID',
 description: 'A high quality wireless mouse',
 status: 'published'
 }
 ];

 const ws = XLSX.utils.json_to_sheet(templateData);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, 'Products');
 XLSX.writeFile(wb, 'product_import_template.xlsx');
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
 <div className="relative w-full max-w-2xl bg-[var(--neu-bg)] border border-[var(--panel-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
 
 {/* Header */}
 <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--neu-bg)]">
 <div>
 <h2 className="text-lg font-bold text-white">Bulk Import Products</h2>
 <p className="text-sm text-[var(--neu-text)] mt-0.5">Upload an Excel (.xlsx), CSV, or JSON file.</p>
 </div>
 <div className="flex items-center gap-3">
 <button 
 onClick={downloadTemplate}
 className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-[var(--neu-accent)]/10 text-[var(--neu-accent)] hover:bg-[var(--neu-accent)]/20 rounded-lg transition-colors border border-[var(--neu-accent)]/20"
 >
 <ArrowDownTrayIcon className="w-4 h-4" /> Template
 </button>
 <button onClick={onClose} className="p-2 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors">
 <XMarkIcon className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Body */}
 <div className="p-6 overflow-y-auto flex-1">
 <div className="mb-4">
 <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[var(--panel-border)] rounded-xl hover:border-[var(--neu-accent)] hover:bg-[var(--neu-accent)]/5 transition-colors cursor-pointer group">
 <div className="flex flex-col items-center gap-2 text-[var(--neu-text)] group-hover:text-white">
 <ArrowUpTrayIcon className="w-8 h-8" />
 <span className="text-sm font-medium">Click to select a .xlsx, .csv, or .json file</span>
 </div>
 <input type="file" accept=".xlsx,.xls,.csv,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFileChange} className="hidden" />
 </label>
 </div>

 <div className="relative">
 <div className="absolute inset-x-0 -top-3 flex justify-center">
 <span className="bg-[var(--neu-bg)] px-2 text-xs font-bold text-[var(--neu-text)] uppercase tracking-widest">
 OR PASTE JSON
 </span>
 </div>
 <div className="border-t border-[var(--panel-border)] mb-4"></div>
 </div>

 <div>
 <label className="flex items-center gap-2 text-xs font-bold text-[var(--neu-text)] uppercase tracking-wider mb-2">
 <DocumentTextIcon className="w-4 h-4" /> JSON Payload Preview
 </label>
 <textarea
 value={jsonInput}
 onChange={(e) => setJsonInput(e.target.value)}
 placeholder={'[\n {\n"name":"Product 1",\n"sku":"PROD-1",\n"price": 19.99,\n"category_id":"..."\n }\n]'}
 className="w-full h-64 bg-black/40 border border-[var(--panel-border)] rounded-xl p-4 text-sm text-green-400 font-mono focus:border-[var(--neu-accent)] focus:ring-1 focus:ring-[var(--neu-accent)] resize-none"
 spellCheck={false}
 />
 </div>
 </div>

 {/* Footer */}
 <div className="px-6 py-4 border-t border-[var(--panel-border)] bg-[var(--neu-bg)] flex justify-end gap-3">
 <button onClick={onClose} className="btn-secondary">
 Cancel
 </button>
 <button 
 onClick={handleImport}
 disabled={!jsonInput.trim() || importMutation.isPending}
 className="btn-primary"
 >
 {importMutation.isPending ? 'Importing...' : 'Run Import'}
 </button>
 </div>

 </div>
 </div>
 );
}
