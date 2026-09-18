import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Button } from '../../components/Button.jsx'
import { Card, CardHeader, CardBody } from '../../components/Card.jsx'
import { Input, Select } from '../../components/Input.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { RETENTION_OPTIONS } from '../../constants/index.js'
import { useApiBaseUrl, uploadFile } from '../../services/api.js'
import { useTenants } from '../../hooks/useTenants.js'
import {
  UploadCloud,
  FileText,
  Check,
  CheckCircle2,
  X,
  Printer,
  Shield,
  Clock,
  Copy,
  ArrowRight,
  ArrowLeft,
  Store,
  Layers,
  Sliders,
  Palette,
} from 'lucide-react'

export default function NewJobPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useApiBaseUrl()
  const { tenants, loading: shopsLoading, error: shopsError, getTenant } = useTenants()
  const [step, setStep] = useState(1)
  const [selectedShop, setSelectedShop] = useLocalStorage('selectedShop', '')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

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
  const [copiedId, setCopiedId] = useState(false)

  const handleFileChange = (selected) => {
    if (!selected) return
    if (selected.size > 10 * 1024 * 1024) {
      alert('File too large (max 10 MB)')
      return
    }
    setFile(selected)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const update = (k, v) => setFormData((p) => ({ ...p, [k]: v }))
  const canProceed = step === 1 ? selectedShop !== '' && file !== null : true
  const selectedTenant = getTenant(selectedShop)

  const handleCopyId = () => {
    if (!jobId) return
    navigator.clipboard.writeText(jobId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

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

  const stepsList = [
    { num: 1, label: 'Shop & Upload' },
    { num: 2, label: 'Print Specs' },
    { num: 3, label: 'Review & Send' },
  ]

  return (
    <Layout title="New Print Job">
      <div className="max-w-3xl mx-auto">
        {/* Stepper Wizard Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-lg mx-auto relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 dark:bg-slate-800 -z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 transition-all duration-300 -z-0"
              style={{ width: `${((step - 1) / (stepsList.length - 1)) * 100}%` }}
            />
            {stepsList.map((s) => {
              const isDone = s.num < step
              const isCurrent = s.num === step
              return (
                <div key={s.num} className="flex flex-col items-center gap-2 relative z-10 bg-slate-50 dark:bg-slate-950 px-2">
                  <button
                    type="button"
                    onClick={() => s.num < step && setStep(s.num)}
                    disabled={s.num > step}
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isDone
                        ? 'bg-indigo-600 text-white shadow-sm cursor-pointer'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : s.num}
                  </button>
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : isDone
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* STEP 1: SHOP & FILE UPLOAD */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Shop Picker */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Select Destination Print Shop
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Your document will be encrypted for and sent exclusively to this shop.
                    </p>
                  </div>
                  {selectedShop && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold">
                      Selected
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {shopsLoading && (
                  <p className="text-sm text-slate-500 animate-pulse">Loading available print shops...</p>
                )}
                {shopsError && (
                  <p className="text-sm text-rose-500">Error loading shops: {shopsError}</p>
                )}

                {!shopsLoading && tenants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tenants.map((shop) => {
                      const isSelected = selectedShop === shop.id
                      return (
                        <div
                          key={shop.id}
                          onClick={() => setSelectedShop(shop.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex items-start justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              {shop.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {shop.code}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            </div>
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
                )}
              </CardBody>
            </Card>

            {/* Drag & Drop File Upload Zone */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Upload Document
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Supported formats: PDF, DOCX, TXT, Images (Max: 10 MB).
                </p>
              </CardHeader>
              <CardBody>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                />

                {!file ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                        : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Click to choose a file or drag & drop here
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      File will be held temporarily in memory and destroyed post-print
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB · Ready to configure
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                size="lg"
                icon={ArrowRight}
                className="w-full sm:w-auto"
              >
                Configure Print Settings
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: PRINT CONFIGURATION */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Print Options & Formatting
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your exact print layout and hardware instructions.
                </p>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Copies Stepper */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                      Number of Copies
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => update('copies', Math.max(1, formData.copies - 1))}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-700 dark:text-slate-200"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.copies}
                        onChange={(e) => update('copies', parseInt(e.target.value) || 1)}
                        className="w-20 text-center py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => update('copies', formData.copies + 1)}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-700 dark:text-slate-200"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Pages / Range */}
                  <div>
                    <Input
                      label="Pages / Range"
                      name="pages"
                      placeholder="e.g. 1-5, 8, all"
                      value={formData.pages}
                      onChange={(e) => update('pages', e.target.value)}
                      required
                    />
                    <div className="flex gap-1.5 mt-2">
                      {['1', '1-3', 'all'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => update('pages', val)}
                          className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors ${
                            formData.pages === val
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {val === 'all' ? 'All' : `Page ${val}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Mode Selector Cards */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Color Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => update('color', 'bw')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        formData.color === 'bw'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        B&W
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Black & White</p>
                        <p className="text-[11px] text-slate-500">Fast & economical</p>
                      </div>
                    </div>

                    <div
                      onClick={() => update('color', 'color')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        formData.color === 'color'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 via-amber-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Full Color</p>
                        <p className="text-[11px] text-slate-500">Rich vivid prints</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paper Size & Orientation Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Paper Size"
                    name="paperSize"
                    value={formData.paperSize}
                    options={[
                      { value: 'A4', label: 'A4 (Standard 210 × 297 mm)' },
                      { value: 'A3', label: 'A3 (Large Format 297 × 420 mm)' },
                    ]}
                    onChange={(e) => update('paperSize', e.target.value)}
                  />

                  <Select
                    label="Orientation"
                    name="orientation"
                    value={formData.orientation}
                    options={[
                      { value: 'portrait', label: 'Portrait (Vertical)' },
                      { value: 'landscape', label: 'Landscape (Horizontal)' },
                    ]}
                    onChange={(e) => update('orientation', e.target.value)}
                  />
                </div>

                {/* Duplex Toggle Card */}
                <div
                  onClick={() => update('duplex', !formData.duplex)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    formData.duplex
                      ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Duplex Printing</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Print on both sides of the sheet</p>
                    </div>
                  </div>
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 duration-200 ${
                      formData.duplex ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Retention Selector */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Privacy Retention Policy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  How long should the shop keep the file buffer before permanent destruction?
                </p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {RETENTION_OPTIONS.map((opt) => {
                    const isSelected = formData.retentionMinutes === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update('retentionMinutes', opt.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Accelerated demo timers enabled: files purge rapidly after print.</span>
                </p>
              </CardBody>
            </Card>

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)} icon={ArrowLeft}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} size="lg" icon={ArrowRight}>
                Review & Confirm
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & SUBMIT */}
        {step === 3 && (
          <div className="space-y-6">
            {submitState === 'success' && jobId ? (
              <Card className="border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 shadow-md">
                <CardBody className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
                    Print Job Dispatched!
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
                    Your document has been sent to <strong className="text-slate-900 dark:text-white">{selectedTenant?.name}</strong>. It will be printed shortly and purged per your retention schedule.
                  </p>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-8">
                    <span className="text-xs text-slate-500">Job ID:</span>
                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{jobId}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Copy Job ID"
                    >
                      {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => navigate('/jobs')} size="lg" icon={Printer}>
                      Track in My Jobs
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/')}>
                      Back to Home
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <>
                {/* Print Ticket Style Card */}
                <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-slate-900 dark:text-white">Print Ticket Order</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                      PRE-FLIGHT CHECK
                    </span>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Print Shop</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {selectedTenant?.name || '—'}{' '}
                          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">({selectedTenant?.code})</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Document</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">
                          {file?.name || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase">Copies</span>
                        <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">{formData.copies}</p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase">Pages</span>
                        <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">{formData.pages}</p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase">Color</span>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {formData.color === 'color' ? 'Full Color' : 'B&W'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase">Format</span>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {formData.paperSize} · {formData.duplex ? '2-Sided' : '1-Sided'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-300">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Retention Auto-Purge:</span>
                      </div>
                      <span className="font-bold">{formData.retentionMinutes} minutes after printing</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(2)} icon={ArrowLeft}>
                    Back
                  </Button>
                  <Button
                    onClick={submit}
                    loading={submitState === 'submitting'}
                    disabled={!selectedShop || !file}
                    size="lg"
                    icon={Printer}
                  >
                    Submit Print Job
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

