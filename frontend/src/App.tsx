import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard   from './pages/Dashboard';
import WalletHunter from './pages/WalletHunter';
import Tracker     from './pages/Tracker';
import CopyTrade   from './pages/CopyTrade';
import Analytics   from './pages/Analytics';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/hunter"     element={<WalletHunter />} />
          <Route path="/tracker"    element={<Tracker />} />
          <Route path="/copy-trade" element={<CopyTrade />} />
          <Route path="/analytics"  element={<Analytics />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
