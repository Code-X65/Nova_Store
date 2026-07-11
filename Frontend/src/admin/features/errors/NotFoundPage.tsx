import { Link } from 'react-router-dom';

export default function NotFoundPage() {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <span className="text-6xl font-black text-surface-4 mb-4">404</span>
 <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
 <p className="text-muted-foreground mb-6">
 The page you're looking for doesn't exist or has been moved.
 </p>
 <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
 </div>
 );
}