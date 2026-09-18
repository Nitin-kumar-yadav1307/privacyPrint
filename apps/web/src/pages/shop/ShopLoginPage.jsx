import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Button } from '../../components/Button.jsx'
import { Card, CardBody } from '../../components/Card.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { useTenants } from '../../hooks/useTenants.js'
import { useApiBaseUrl, shopLogin } from '../../services/api.js'

export default function ShopLoginPage() {
  const navigate = useNavigate()
  const [selectedShop, setSelectedShop] = useLocalStorage('shopTenant', '')
  const apiBaseUrl = useApiBaseUrl()
  const [loggingIn, setLoggingIn] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [loginError, setLoginError] = useState('')
  const { tenants, loading: shopsLoading, error: shopsError } = useTenants()

  const handleLogin = async () => {
    if (!selectedShop || !passcode) return
    setLoggingIn(true)
    setLoginError('')
    try {
      // Exchanges the shop selection + demo passcode for a signed,
      // expiring session token (stored by the api service).
      await shopLogin(apiBaseUrl, selectedShop, passcode)
      navigate('/shop/dashboard')
    } catch (e) {
      setLoginError(e.message)
    } finally {
      setLoggingIn(false)
    }
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
                {shopsLoading && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading shops…</p>
                )}
                {shopsError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400 py-2">
                    Could not load shops: {shopsError}
                  </p>
                )}
                {!shopsLoading && !shopsError && tenants.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                    No print shops are available right now.
                  </p>
                )}
                {tenants.map((shop) => (
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Shop passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Demo passcode: privacyprint-demo"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {loginError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {loginError}
                </p>
              )}
            </div>

            <Button
              onClick={handleLogin}
              loading={loggingIn}
              disabled={!selectedShop || !passcode}
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
