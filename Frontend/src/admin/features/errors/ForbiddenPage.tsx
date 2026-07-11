import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ForbiddenPage() {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <ExclamationTriangleIcon className="w-12 h-12 text-warning mb-4" />
 <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
 <p className="text-muted-foreground mb-6">
 You don't have permission to view this page.
 </p>
 <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
 </div>
 );
}