import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router';
import { ThemeProvider } from './contexts/ThemeContext.js';
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
import { MomentListPage } from './pages/admin/MomentListPage.js';
import { MomentEditorPage } from './pages/admin/MomentEditorPage.js';
import { ResourceListPage } from './pages/admin/ResourceListPage.js';
import { ResourceEditorPage } from './pages/admin/ResourceEditorPage.js';
import { PageListPage } from './pages/admin/PageListPage.js';
import { PageEditorPage } from './pages/admin/PageEditorPage.js';
import { CategoryManagerPage } from './pages/admin/CategoryManagerPage.js';
import { TagManagerPage } from './pages/admin/TagManagerPage.js';
import { LanguageManagerPage } from './pages/admin/LanguageManagerPage.js';
import { UIStringsPage } from './pages/admin/UIStringsPage.js';
import { MediaPage } from './pages/admin/MediaPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
                  <Route path="admin/moments" element={<MomentListPage />} />
                  <Route path="admin/moments/new" element={<MomentEditorPage />} />
                  <Route path="admin/moments/:id" element={<MomentEditorPage />} />
                  <Route path="admin/resources" element={<ResourceListPage />} />
                  <Route path="admin/resources/new" element={<ResourceEditorPage />} />
                  <Route path="admin/resources/:id" element={<ResourceEditorPage />} />
                  <Route path="admin/pages" element={<PageListPage />} />
                  <Route path="admin/pages/new" element={<PageEditorPage />} />
                  <Route path="admin/pages/:id" element={<PageEditorPage />} />
                  <Route path="admin/categories" element={<CategoryManagerPage />} />
                  <Route path="admin/tags" element={<TagManagerPage />} />
                  <Route path="admin/languages" element={<LanguageManagerPage />} />
                  <Route path="admin/ui-strings" element={<UIStringsPage />} />
                  <Route path="admin/media" element={<MediaPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
