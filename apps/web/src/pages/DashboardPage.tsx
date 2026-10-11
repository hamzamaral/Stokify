import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Package,
  PackageX,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { cn, formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/utils';
import type { Dashboard } from '@/types/api';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  to,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof Package;
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
  to?: string;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    destructive: 'bg-destructive/15 text-destructive',
  }[tone];

  const content = (
    <Card className={cn('h-full transition-shadow', to && 'hover:shadow-md')}>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2.5', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.dashboard, days],
    queryFn: async () =>
      (await api.get<Dashboard>('/reports/dashboard', { params: { days } })).data,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const { summary } = data;
  const totalIn = data.movementTrend.reduce((s, d) => s + d.in, 0);
  const totalOut = data.movementTrend.reduce((s, d) => s + d.out, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Stok durumunun ve depo hareketlerinin genel görünümü"
        actions={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Toplam Stok Değeri"
          value={formatCompactCurrency(summary.stockValue)}
          hint={`Satış değeri: ${formatCompactCurrency(summary.potentialRevenue)}`}
          icon={Wallet}
        />
        <StatCard
          title="Ürün Sayısı"
          value={formatNumber(summary.productCount)}
          hint={`${formatNumber(summary.totalQuantity)} birim stokta`}
          icon={Package}
          tone="success"
          to="/products"
        />
        <StatCard
          title="Kritik / Tükenen"
          value={`${summary.lowStockCount} / ${summary.outOfStockCount}`}
          hint="Minimum seviyenin altındaki ürünler"
          icon={summary.outOfStockCount ? PackageX : AlertTriangle}
          tone="warning"
          to="/products?stockStatus=low"
        />
        <StatCard
          title="Bekleyen Siparişler"
          value={formatNumber(summary.pendingPurchaseOrders)}
          hint={`${formatNumber(summary.movementCount)} hareket (son ${days} gün)`}
          icon={ClipboardList}
          tone="destructive"
          to="/purchase-orders"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Stok Hareketleri</CardTitle>
              <CardDescription>Günlük giriş ve çıkış miktarları</CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-success">
                <ArrowDownRight className="h-4 w-4" />
                {formatNumber(totalIn)}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <ArrowUpRight className="h-4 w-4" />
                {formatNumber(totalOut)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.movementTrend} margin={{ left: -16, right: 8 }}>
                <defs>
                  <linearGradient id="inGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(8, 10) + '.' + d.slice(5, 7)}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="in"
                  name="Giriş"
                  stroke="#22c55e"
                  fill="url(#inGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  name="Çıkış"
                  stroke="#ef4444"
                  fill="url(#outGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori Dağılımı</CardTitle>
            <CardDescription>Stok değerine göre</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryDistribution}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {data.categoryDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>En Çok Çıkış Yapılan Ürünler</CardTitle>
            <CardDescription>Son {days} gün</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="quantity" name="Çıkış" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Kritik Stok Uyarıları</CardTitle>
              <CardDescription>Minimum seviyenin altındaki ürünler</CardDescription>
            </div>
            <Link to="/products?stockStatus=low" className="text-sm text-primary hover:underline">
              Tümü
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.criticalProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${p.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </div>
                  <div className="w-28">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          p.totalStock === 0 ? 'bg-destructive' : 'bg-warning',
                        )}
                        style={{
                          width: `${Math.min(100, (p.totalStock / p.minStockLevel) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                      {p.totalStock} / {p.minStockLevel} {p.unit}
                    </p>
                  </div>
                  <Badge variant={p.totalStock === 0 ? 'destructive' : 'warning'}>
                    {p.totalStock === 0 ? 'Tükendi' : `-${p.shortage}`}
                  </Badge>
                </li>
              ))}
              {data.criticalProducts.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Kritik seviyede ürün yok
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
