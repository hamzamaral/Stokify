import { Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

/** Tablo gövdesi için yükleniyor / boş durumlarını tek yerden yönetir. */
export function TableState({
  isLoading,
  isEmpty,
  colSpan,
  emptyText = 'Kayıt bulunamadı',
}: {
  isLoading: boolean;
  isEmpty: boolean;
  colSpan: number;
  emptyText?: string;
}) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <TableRow key={i}>
            <TableCell colSpan={colSpan}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }
  if (isEmpty) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-12 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
          {emptyText}
        </TableCell>
      </TableRow>
    );
  }
  return null;
}
