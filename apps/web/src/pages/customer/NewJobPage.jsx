import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Button } from '../../components/Button.jsx'
import { Card, CardHeader, CardBody } from '../../components/Card.jsx'
import { Input, Select } from '../../components/Input.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { RETENTION_OPTIONS } from '../../constants/index.js'
import { useApiBaseUrl, uploadFile } from '../../services/api.js'
import { useTenants } from '../../hooks/useTenants.js'

export default function NewJobPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useApiBaseUrl()
  const { tenants, loading: shopsLoading, error: shopsError, getTenant } = useTenants()
  const [step, setStep] = useState(1)
  const [selectedShop, setSelectedShop] = useLocalStorage('selectedShop', '')
  const [file, setFile] = useState(null)
  const [formData, setFormData] = useState({
    copies: 1,
    pages: '1',
    color: 'bw',
    paperSize: 'A4',
    duplex: false,
    orientation: 'portrait',
    retentionMinutes: 30,
  })
  const [submitState, setSubmitState] = useState('idle')
  const [jobId, setJobId] = useState(null)

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f && f.size > 10 * 1024 * 1024) { alert('File too large (max 10 MB)'); return }
    setFile(f)
  }
  const update = (k, v) => setFormData((p) => ({ ...p, [k]: v }))
  const canProceed = step === 1 ? selectedShop !== '' && file !== null : true
  const selectedTenant = getTenant(selectedShop)

  const submit = async () => {
    if (!selectedShop || !file) return
    setSubmitState('submitting')
    try {
      const data = await uploadFile(apiBaseUrl, '/api/jobs', file, {
        tenantId: selectedShop,
        printSettings: JSON.stringify(formData),
      })
      setJobId(data.job?.jobId || data.jobId)
      setSubmitState('success')
    } catch (e) {
      console.error(e)
      alert(`Could not create job: ${e.message}`)
      setSubmitState('idle')
    }
  }

  return (
    <Layout title="New Print Job">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {step === 1 && 'Step 1: Choose a print shop & upload'}
          {step === 2 && 'Step 2: Configure your print settings'}
          {step === 3 && 'Step 3: Review & submit'}
        </h2>

        {step === 1 && (
          <div className="space-y-6">
            <Select label="Select Print Shop" name="shop" value={selectedShop}
              options={tenants.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
              onChange={(e) => setSelectedShop(e.target.value)} required
              error={!selectedShop ? 'Please select a shop' : ''} />
            {shopsLoading && <p className="text-xs text-gray-500 dark:text-gray-400">Loading print shops…</p>}
            {shopsError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">Could not load print shops: {shopsError}</p>}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Document <span className="text-red-500 ml-0.5">*</span></label>
              <input type="file" onChange={handleFile}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 dark:hover:file:bg-indigo-900/50 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2" />
              {file && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)</p>}
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)} disabled={!canProceed} fullWidth>Continue</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card><CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Copies" type="number" name="copies" min={1} max={100} value={formData.copies}
                  onChange={(e) => update('copies', parseInt(e.target.value) || 1)} required />
                <Input label="Pages / Range" type="text" name="pages" placeholder="e.g. 1-3, 5, all" value={formData.pages}
                  onChange={(e) => update('pages', e.target.value)} required />
                <Select label="Color" name="color" value={formData.color}
                  options={[{ value: 'bw', label: 'Black & White' }, { value: 'color', label: 'Color' }]}
                  onChange={(e) => update('color', e.target.value)} />
                <Select label="Paper Size" name="paperSize" value={formData.paperSize}
                  options={[{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }]}
                  onChange={(e) => update('paperSize', e.target.value)} />
                <Select label="Orientation" name="orientation" value={formData.orientation}
                  options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
                  onChange={(e) => update('orientation', e.target.value)} />
                <div className="flex items-center gap-3 pt-5">
                  <input id="duplex" type="checkbox" checked={formData.duplex}
                    onChange={(e) => update('duplex', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                  <label htmlFor="duplex" className="text-sm font-medium text-gray-700 dark:text-gray-300">Duplex (double-sided)</label>
                </div>
              </div>
            </CardBody></Card>
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900 dark:text-white">Retention Period</h3><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your document will be removed automatically after this time following printing.</p></CardHeader>
              <CardBody>
                <Select label="How long should your document be kept?" name="retentionMinutes" value={formData.retentionMinutes}
                  options={RETENTION_OPTIONS} onChange={(e) => update('retentionMinutes', parseInt(e.target.value))} />
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500"><strong>Demo mode:</strong> Retention times are accelerated for demonstration.</p>
              </CardBody>
            </Card>
            <div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Continue</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900 dark:text-white">Job Summary</h3></CardHeader>
              <CardBody className="space-y-3 text-left">
                <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Print Shop</p><p className="font-medium text-gray-900 dark:text-white">{selectedTenant?.name || '—'} <span className="text-sm text-gray-500">({selectedTenant?.code})</span></p></div>
                <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Document</p><p className="font-medium text-gray-900 dark:text-white">{file?.name || '—'}</p></div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Copies</span><span className="font-medium text-gray-900 dark:text-white">{formData.copies}</span>
                  <span className="text-gray-500 dark:text-gray-400">Pages</span><span className="font-medium text-gray-900 dark:text-white">{formData.pages}</span>
                  <span className="text-gray-500 dark:text-gray-400">Color</span><span className="font-medium text-gray-900 dark:text-white">{formData.color === 'bw' ? 'B&W' : 'Color'}</span>
                  <span className="text-gray-500 dark:text-gray-400">Paper</span><span className="font-medium text-gray-900 dark:text-white">{formData.paperSize}</span>
                  <span className="text-gray-500 dark:text-gray-400">Duplex</span><span className="font-medium text-gray-900 dark:text-white">{formData.duplex ? 'Yes' : 'No'}</span>
                  <span className="text-gray-500 dark:text-gray-400">Orientation</span><span className="font-medium text-gray-900 dark:text-white">{formData.orientation}</span>
                  <span className="text-gray-500 dark:text-gray-400">Retention</span><span className="font-medium text-gray-900 dark:text-white">{formData.retentionMinutes} min</span>
                </div>
              </CardBody>
            </Card>
            {submitState === 'success' && jobId && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardBody className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Job created!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Your Job ID: <code className="bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded text-sm">{jobId}</code></p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center"><Button variant="secondary" onClick={() => navigate('/jobs')}>View my jobs</Button><Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button></div>
                </CardBody>
              </Card>
            )}
            {submitState !== 'success' && (
              <div className="flex justify-between"><Button variant="secondary" onClick={() => setStep(2)}>Back</Button><Button onClick={submit} loading={submitState === 'submitting'} disabled={!selectedShop || !file}>Submit print job</Button></div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
