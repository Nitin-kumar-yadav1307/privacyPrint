import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Button } from '../../components/Button.jsx'
import { Card, CardBody } from '../../components/Card.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { useTenants } from '../../hooks/useTenants.js'
import { useApiBaseUrl, shopLogin } from '../../services/api.js'
import { Store, Key, ArrowRight, ShieldCheck, Check, Sparkles, AlertCircle } from 'lucide-react'

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
      await shopLogin(apiBaseUrl, selectedShop, passcode)
      navigate('/shop/dashboard')
    } catch (e) {
      setLoginError(e.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const handleFillDemo = () => {
    setPasscode('privacyprint-demo')
    if (tenants.length > 0 && !selectedShop) {
      setSelectedShop(tenants[0].id)
    }
  }

  return (
    <Layout title="Shop Login" showNav={false}>
      <div className="max-w-md mx-auto py-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-indigo-500/25">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Shop Operator Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authenticate to connect your hardware queue and process incoming print jobs.
          </p>
        </div>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardBody className="p-6 space-y-5">
            {/* Shop Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Select Your Print Shop
              </label>

              {shopsLoading && (
                <p className="text-xs text-slate-400 animate-pulse py-2">Loading shops…</p>
              )}
              {shopsError && (
                <p role="alert" className="text-xs text-rose-500 py-1">
                  Could not load shops: {shopsError}
                </p>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {tenants.map((shop) => {
                  const isSelected = selectedShop === shop.id
                  return (
                    <div
                      key={shop.id}
                      onClick={() => setSelectedShop(shop.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">
                          {shop.name}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {shop.code}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Passcode Field */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Shop Passcode
                </label>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Fill Demo Passcode
                </button>
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter passcode"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Key className="w-4 h-4" />
                </div>
              </div>

              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleLogin}
              loading={loggingIn}
              disabled={!selectedShop || !passcode}
              fullWidth
              size="lg"
              icon={ArrowRight}
            >
              Open Dashboard
            </Button>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Session tokens are signed and isolated per shop tenant.</span>
            </div>
          </CardBody>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back to Customer Home
          </Button>
        </div>
      </div>
    </Layout>
  )
}

