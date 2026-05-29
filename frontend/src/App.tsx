import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router';
import { LanguageProvider } from './contexts/LanguageContext.js';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/public/HomePage.js';
import { ArticlesPage } from './pages/public/ArticlesPage.js';
import { ArticleDetailPage } from './pages/public/ArticleDetailPage.js';
import { MomentsPage } from './pages/public/MomentsPage.js';
import { ResourcesPage } from './pages/public/ResourcesPage.js';
import { PageDetailPage } from './pages/public/PageDetailPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
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
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
