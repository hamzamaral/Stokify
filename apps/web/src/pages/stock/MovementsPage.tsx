import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MovementsTable } from '@/components/common/MovementsTable';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadFile, getErrorMessage } from '@/lib/api';
import { useWarehouses } from '@/lib/queries';
import type { MovementType } from '@/types/api';

export function MovementsPage() {
  const { hasRole } = useAuth();
  const { data: warehouses = [] } = useWarehouses();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MovementType | ''>('');
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedSearch = useDebounce(search);

  const exportCsv = () => {
    const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
    downloadFile(`/reports/export/movements${qs ? `?${qs}` : ''}`, 'stok-hareketleri.csv').catch(
      (e) => toast.error(getErrorMessage(e)),
    );
  };

  return (
    <>
      <PageHeader
        title="Hareket Geçmişi"
        description="Tüm stok giriş, çıkış, transfer ve sayım kayıtları"
        actions={
          hasRole('MANAGER') && (
            <Button variant="outline" onClick={exportCsv}>
              <Download /> CSV
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ürün, SKU veya referans no..."
          />
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as MovementType | '')}
            className="lg:w-40"
          >
            <option value="">Tüm türler</option>
            <option value="IN">Giriş</option>
            <option value="OUT">Çıkış</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Sayım</option>
          </Select>
          <Select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="lg:w-48"
          >
            <option value="">Tüm depolar</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Başlangıç tarihi"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Bitiş tarihi"
            />
          </div>
        </div>
        <MovementsTable
          search={debouncedSearch}
          type={type}
          warehouseId={warehouseId}
          from={from}
          to={to}
        />
      </Card>
    </>
  );
}
