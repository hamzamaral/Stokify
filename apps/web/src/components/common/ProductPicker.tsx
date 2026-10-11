import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { useProductSearch } from '@/lib/queries';
import { cn, formatNumber } from '@/lib/utils';
import type { Product } from '@/types/api';

/** Ürün adı, SKU veya barkod ile arama yapılabilen seçim kutusu. */
export function ProductPicker({
  value,
  onChange,
  invalid,
  id,
}: {
  value?: Product | null;
  onChange: (product: Product | null) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);
  const { data = [], isFetching } = useProductSearch(debounced);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          aria-invalid={invalid}
          autoComplete="off"
          placeholder="Ürün adı, SKU veya barkod ile ara..."
          value={open ? search : value ? `${value.sku} · ${value.name}` : ''}
          onFocus={() => {
            setSearch('');
            setOpen(true);
          }}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-8"
        />
        {isFetching ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ChevronsUpDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {data.length === 0 && !isFetching && (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">Ürün bulunamadı</li>
          )}
          {data.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(product);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0',
                    value?.id === product.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                <span className="flex-1 truncate">{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(product.totalStock)} {product.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
