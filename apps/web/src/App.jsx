import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import HomePage from './pages/HomePage.jsx'
import NewJobPage from './pages/customer/NewJobPage.jsx'
import JobsPage from './pages/customer/JobsPage.jsx'
import ShopLoginPage from './pages/shop/ShopLoginPage.jsx'
import ShopDashboardPage from './pages/shop/ShopDashboardPage.jsx'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/customer/new" element={<NewJobPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/shop" element={<ShopLoginPage />} />
          <Route path="/shop/dashboard" element={<ShopDashboardPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
