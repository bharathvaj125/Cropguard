import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <Link className="btn" to="/app">
            Go to the dashboard
          </Link>
        }
      >
        The page you are looking for does not exist or has moved.
      </EmptyState>
    </div>
  );
}
