import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router';
import { LanguageProvider } from './contexts/LanguageContext.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { Layout } from './components/Layout.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { HomePage } from './pages/public/HomePage.js';
import { ArticlesPage } from './pages/public/ArticlesPage.js';
import { ArticleDetailPage } from './pages/public/ArticleDetailPage.js';
import { MomentsPage } from './pages/public/MomentsPage.js';
import { ResourcesPage } from './pages/public/ResourcesPage.js';
import { PageDetailPage } from './pages/public/PageDetailPage.js';
import { LoginPage } from './pages/admin/LoginPage.js';
import { AdminLayout } from './admin/components/AdminLayout.js';
import { DashboardPage } from './pages/admin/DashboardPage.js';
import { ArticleListPage } from './pages/admin/ArticleListPage.js';
import { ArticleEditorPage } from './pages/admin/ArticleEditorPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="articles" element={<ArticlesPage />} />
                <Route path="articles/:slug" element={<ArticleDetailPage />} />
                <Route path="moments" element={<MomentsPage />} />
                <Route path="resources" element={<ResourcesPage />} />
                <Route path=":slug" element={<PageDetailPage />} />
              </Route>
              <Route path="admin/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="admin" element={<DashboardPage />} />
                  <Route path="admin/articles" element={<ArticleListPage />} />
                  <Route path="admin/articles/new" element={<ArticleEditorPage />} />
                  <Route path="admin/articles/:id" element={<ArticleEditorPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
