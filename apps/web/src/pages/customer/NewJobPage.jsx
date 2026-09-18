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
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 -z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-950 dark:bg-zinc-100 transition-all duration-300 -z-0"
              style={{ width: `${((step - 1) / (stepsList.length - 1)) * 100}%` }}
            />
            {stepsList.map((s) => {
              const isDone = s.num < step
              const isCurrent = s.num === step
              return (
                <div key={s.num} className="flex flex-col items-center gap-2 relative z-10 bg-[#fafafa] dark:bg-black px-2">
                  <button
                    type="button"
                    onClick={() => s.num < step && setStep(s.num)}
                    disabled={s.num > step}
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isDone
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs cursor-pointer'
                        : isCurrent
                        ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 ring-4 ring-zinc-950/10 dark:ring-zinc-100/20 shadow-xs'
                        : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : s.num}
                  </button>
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? 'text-zinc-950 dark:text-zinc-100 font-bold'
                        : isDone
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : 'text-zinc-400'
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
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                      Select Destination Print Shop
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Your document will be encrypted for and sent exclusively to this shop.
                    </p>
                  </div>
                  {selectedShop && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold border border-zinc-200 dark:border-zinc-700">
                      Selected
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {shopsLoading && (
                  <p className="text-sm text-zinc-500 animate-pulse">Loading available print shops...</p>
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
                              ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/60 shadow-xs ring-1 ring-zinc-950/10 dark:ring-zinc-100/20'
                              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#0c0c0e]'
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                              {shop.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {shop.code}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                                Active
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-100 dark:border-zinc-100 text-white dark:text-zinc-950'
                                : 'border-zinc-300 dark:border-zinc-700'
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
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  Upload Document
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
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
                        ? 'border-zinc-950 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-900/60 scale-[1.01]'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/40'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Click to choose a file or drag & drop here
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      File will be held temporarily in memory and destroyed post-print
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {file.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {(file.size / 1024).toFixed(1)} KB · Ready to configure
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
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
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  Print Options & Formatting
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Select your exact print layout and hardware instructions.
                </p>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Copies Stepper */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                      Number of Copies
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => update('copies', Math.max(1, formData.copies - 1))}
                        className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-lg font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all text-zinc-700 dark:text-zinc-200"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.copies}
                        onChange={(e) => update('copies', parseInt(e.target.value) || 1)}
                        className="w-20 text-center py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => update('copies', formData.copies + 1)}
                        className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-lg font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all text-zinc-700 dark:text-zinc-200"
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
                              ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                    Color Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => update('color', 'bw')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        formData.color === 'bw'
                          ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/60 ring-1 ring-zinc-950/10 dark:ring-zinc-100/20'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                        B&W
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">Black & White</p>
                        <p className="text-[11px] text-zinc-500">Fast & economical</p>
                      </div>
                    </div>

                    <div
                      onClick={() => update('color', 'color')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        formData.color === 'color'
                          ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/60 ring-1 ring-zinc-950/10 dark:ring-zinc-100/20'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">Full Color</p>
                        <p className="text-[11px] text-zinc-500">Rich vivid prints</p>
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
                      ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/50'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Duplex Printing</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Print on both sides of the sheet</p>
                    </div>
                  </div>
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 duration-200 ${
                      formData.duplex ? 'bg-zinc-950 dark:bg-zinc-100 justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full shadow-md transform transition-transform ${formData.duplex ? 'bg-white dark:bg-zinc-950' : 'bg-white'}`} />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Retention Selector */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  Privacy Retention Policy
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
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
                            ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 bg-white dark:bg-zinc-900'
                        }`}
                      >
                        <span className="block text-sm">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
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
              <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] shadow-md">
                <CardBody className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 flex items-center justify-center mx-auto mb-4 shadow-xs border border-zinc-200 dark:border-zinc-700">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-2">
                    Print Job Dispatched!
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-6">
                    Your document has been sent to <strong className="text-zinc-900 dark:text-white">{selectedTenant?.name}</strong>. It will be printed shortly and purged per your retention schedule.
                  </p>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-8">
                    <span className="text-xs text-zinc-500">Job ID:</span>
                    <span className="font-mono text-sm font-bold text-zinc-950 dark:text-zinc-100">{jobId}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
                <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Printer className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                      <span className="font-bold text-zinc-900 dark:text-white">Print Ticket Order</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                      PRE-FLIGHT CHECK
                    </span>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Print Shop</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">
                          {selectedTenant?.name || '—'}{' '}
                          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">({selectedTenant?.code})</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Document</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-xs">
                          {file?.name || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase">Copies</span>
                        <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{formData.copies}</p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase">Pages</span>
                        <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{formData.pages}</p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase">Color</span>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white">
                          {formData.color === 'color' ? 'Full Color' : 'B&W'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase">Format</span>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white">
                          {formData.paperSize} · {formData.duplex ? '2-Sided' : '1-Sided'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-800 dark:text-zinc-200">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
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

