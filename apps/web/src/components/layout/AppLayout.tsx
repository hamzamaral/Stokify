import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ShieldCheck,
  Sun,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROLE_LABEL } from '@/components/common/StatusBadges';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';

type NavItem = { to: string; label: string; icon: typeof Package; roles?: Role[] };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Genel',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Stok',
    items: [
      { to: '/products', label: 'Ürünler', icon: Package },
      { to: '/stock/operations', label: 'Stok İşlemleri', icon: ArrowLeftRight },
      { to: '/stock/movements', label: 'Hareket Geçmişi', icon: History },
      { to: '/purchase-orders', label: 'Satın Alma', icon: ClipboardList },
    ],
  },
  {
    title: 'Tanımlar',
    items: [
      { to: '/categories', label: 'Kategoriler', icon: FolderTree },
      { to: '/suppliers', label: 'Tedarikçiler', icon: Truck },
      { to: '/warehouses', label: 'Depolar', icon: Warehouse },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { to: '/users', label: 'Kullanıcılar', icon: Users, roles: ['ADMIN'] },
      { to: '/audit-logs', label: 'Denetim Kayıtları', icon: ShieldCheck, roles: ['ADMIN'] },
    ],
  },
];

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user?.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Stokify</span>
      </div>
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => !i.roles || hasRole(...i.roles));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-4"
              onClick={() => setMobileOpen(false)}
              aria-label="Menüyü kapat"
            >
              <X />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü aç"
          >
            <Menu />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Temayı değiştir">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-accent">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials}
                </span>
                <span className="hidden text-left text-sm sm:block">
                  <span className="block font-medium leading-tight">{user?.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {user && ROLE_LABEL[user.role]}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block">{user?.fullName}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void logout()} className="text-destructive">
                <LogOut />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
