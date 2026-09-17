import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Button } from '../../components/Button.jsx'
import { Card, CardBody } from '../../components/Card.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

const SHOPS = [
  { id: 'TENANT-001', name: 'QuickPrint Mumbai', code: 'SHOP-MUM-001' },
  { id: 'TENANT-002', name: 'Express Prints Bangalore', code: 'SHOP-BLR-001' },
  { id: 'TENANT-003', name: 'PrintHub Delhi', code: 'SHOP-DEL-001' },
]

export default function ShopLoginPage() {
  const navigate = useNavigate()
  const [selectedShop, setSelectedShop] = useLocalStorage('shopTenant', '')
  const [loggingIn, setLoggingIn] = useState(false)

  const handleLogin = async () => {
    if (!selectedShop) return
    setLoggingIn(true)
    // Simulate a brief "authentication" delay
    await new Promise((r) => setTimeout(r, 600))
    setLoggingIn(false)
    navigate('/shop/dashboard')
  }

  return (
    <Layout title="Shop Login" showNav={false}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Shop Dashboard Login
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Select your print shop to access your dashboard.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select your shop
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {SHOPS.map((shop) => (
                  <label
                    key={shop.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedShop === shop.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shop"
                      value={shop.id}
                      checked={selectedShop === shop.id}
                      onChange={(e) => setSelectedShop(e.target.value)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {shop.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {shop.code}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleLogin}
              loading={loggingIn}
              disabled={!selectedShop}
              fullWidth
              size="lg"
            >
              {loggingIn ? 'Signing in...' : 'Open Dashboard'}
            </Button>

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              This is a demo. In production, shops authenticate via a proper
              identity provider.
            </p>
          </CardBody>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back to home
          </Button>
        </div>
      </div>
    </Layout>
  )
}
