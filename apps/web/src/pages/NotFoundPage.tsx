import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-sm text-muted-foreground">
        Aradığınız sayfa taşınmış veya silinmiş olabilir.
      </p>
      <Button asChild>
        <Link to="/">Dashboard'a dön</Link>
      </Button>
    </div>
  );
}
