import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from './Button';

interface NotFoundProps {
  title?: string;
  message?: string;
}

export function NotFound({
  title = 'Inspection not found',
  message = "This inspection isn't on this device. It may have been deleted or started on another phone.",
}: NotFoundProps) {
  const navigate = useNavigate();
  return (
    <main className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
      <FileQuestion size={48} className="text-text-secondary" aria-hidden="true" />
      <h1 className="text-xl font-bold font-display text-text-primary">{title}</h1>
      <p className="text-sm text-text-secondary max-w-sm">{message}</p>
      <div className="flex gap-2 mt-2">
        <Button variant="secondary" onClick={() => navigate('/history')}>History</Button>
        <Button onClick={() => navigate('/')}>Home</Button>
      </div>
    </main>
  );
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-secondary font-display" role="status">
      {label}
    </div>
  );
}

export function SessionGate({ status }: { status: 'loading' | 'notfound' | 'forbidden' | 'error' }) {
  if (status === 'loading') return <LoadingScreen label="Loading inspection…" />;
  if (status === 'forbidden') {
    return <NotFound title="Not your inspection" message="This inspection belongs to another soldier signed in on this device." />;
  }
  if (status === 'error') {
    return <NotFound title="Couldn't open inspection" message="Something went wrong loading this inspection. Your data is still saved on this device." />;
  }
  return <NotFound />;
}
