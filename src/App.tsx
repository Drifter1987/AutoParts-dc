import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import './styles/global.css';

// Keep the initial shell small; each route loads its page on demand.
const HomePage = lazy(() => import('./pages/HomePage'));
const VINDecoderPage = lazy(() => import('./pages/VINDecoderPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const ModelYearPage = lazy(() => import('./pages/ModelYearPage'));
const AssemblyPage = lazy(() => import('./pages/AssemblyPage'));
const PartPage = lazy(() => import('./pages/PartPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const GaragePage = lazy(() => import('./pages/GaragePage'));
const RecallCenterPage = lazy(() => import('./pages/RecallCenterPage'));
const FleetPage = lazy(() => import('./pages/FleetPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/vin" element={<VINDecoderPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/catalog/:brandSlug" element={<BrandPage />} />
          <Route path="/catalog/:brandSlug/:modelSlug/:year" element={<ModelYearPage />} />
          <Route path="/catalog/:brandSlug/:modelSlug/:year/:assemblySlug" element={<AssemblyPage />} />
          <Route path="/catalog/:brandSlug/:modelSlug/:year/:assemblySlug/:partSlug" element={<PartPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/garage" element={<GaragePage />} />
          <Route path="/recall-center" element={<RecallCenterPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
