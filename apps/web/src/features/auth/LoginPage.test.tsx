import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { LoginPage } from './LoginPage';

const post = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, post: (...args: unknown[]) => post(...args), get: vi.fn() },
  };
});

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => post.mockReset());

  it('geçersiz e-postada doğrulama mesajı gösterir ve istek atmaz', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'gecersiz' } });
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByText('Geçerli bir e-posta girin')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('demo hesap butonu bilgileri doldurur ve giriş isteği gönderir', async () => {
    post.mockResolvedValue({
      data: {
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1', fullName: 'Ayşe', role: 'ADMIN' },
      },
    });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('button', { name: /giriş yap/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@stokify.com',
        password: 'Admin123!',
      }),
    );
    expect(localStorage.getItem('stokify.accessToken')).toBe('a');
  });
});
