import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Building2, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { Select }  from '@/components/ui/Select'
import { Alert }   from '@/components/ui/Alert'
import { businessApi } from '@/api/business'
import { useAuthStore } from '@/stores/authStore'
import { clsx }    from 'clsx'
import toast from 'react-hot-toast'

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  name:          z.string().min(2, 'Business name is required'),
  legal_name:    z.string().optional(),
  business_type: z.string().min(1, 'Select a business type'),
  email:         z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone:         z.string().optional(),
  country:       z.string().min(1, 'Select a country'),
  currency:      z.string().min(1, 'Select a currency'),
  timezone:      z.string().min(1, 'Select a timezone'),
  language:      z.string().default('en'),
  address_line1: z.string().optional(),
  address_city:  z.string().optional(),
  address_state: z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ─── Steps config ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: 'Basic Info',    description: 'Name and type' },
  { id: 2, title: 'Contact',       description: 'Email and phone' },
  { id: 3, title: 'Location',      description: 'Country and address' },
  { id: 4, title: 'Localisation',  description: 'Currency and timezone' },
]

const businessTypeOptions = [
  { value: 'retail',         label: 'Retail Store' },
  { value: 'restaurant',     label: 'Restaurant / Food' },
  { value: 'wholesale',      label: 'Wholesale / Distribution' },
  { value: 'service',        label: 'Service Business' },
  { value: 'manufacturing',  label: 'Manufacturing' },
  { value: 'ecommerce',      label: 'E-Commerce' },
  { value: 'other',          label: 'Other' },
]

const countryOptions = [
  { value: 'BD', label: 'Bangladesh' },
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'UAE' },
]

const currencyOptions = [
  { value: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' },
]

const timezoneOptions = [
  { value: 'Asia/Dhaka',        label: 'Asia/Dhaka (UTC+6)' },
  { value: 'Asia/Kolkata',      label: 'Asia/Kolkata (UTC+5:30)' },
  { value: 'America/New_York',  label: 'America/New_York (UTC-5)' },
  { value: 'Europe/London',     label: 'Europe/London (UTC+0)' },
  { value: 'Australia/Sydney',  label: 'Australia/Sydney (UTC+11)' },
  { value: 'Asia/Singapore',    label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Dubai',        label: 'Asia/Dubai (UTC+4)' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export function BusinessCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const { setBusiness } = useAuthStore()

  const {
    register, handleSubmit, trigger, formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { language: 'en' } })

  const mutation = useMutation({
    mutationFn: (data: FormData) => businessApi.create({
      name:          data.name,
      legal_name:    data.legal_name,
      business_type: data.business_type,
      email:         data.email || undefined,
      phone:         data.phone,
      country:       data.country,
      currency:      data.currency,
      timezone:      data.timezone,
      language:      data.language,
      address: {
        line1: data.address_line1,
        city:  data.address_city,
        state: data.address_state,
      },
    }),
    onSuccess: (res) => {
      setBusiness(res.data)
      toast.success('Business created!')
      navigate('/app/dashboard')
    },
  })

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: ['name', 'business_type'],
    2: ['email', 'phone'],
    3: ['country', 'address_line1', 'address_city', 'address_state'],
    4: ['currency', 'timezone'],
  }

  const handleNext = async () => {
    const valid = await trigger(stepFields[step])
    if (valid) setStep((s) => s + 1)
  }

  const onSubmit = (data: FormData) => mutation.mutate(data)

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create a Business</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in the details below to set up your business.</p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
              step > s.id  ? 'bg-primary-600 text-white' :
              step === s.id ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
              'bg-gray-100 text-gray-400'
            )}>
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className={clsx('text-xs font-medium truncate', step >= s.id ? 'text-primary-700' : 'text-gray-400')}>
                {s.title}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx('h-0.5 flex-1 rounded', step > s.id ? 'bg-primary-600' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {mutation.error && (
        <Alert variant="error" className="mb-5">
          {(mutation.error as Error).message || 'Failed to create business. Please try again.'}
        </Alert>
      )}

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary-50 p-2">
            <Building2 className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{STEPS[step - 1].title}</h2>
            <p className="text-xs text-gray-500">{STEPS[step - 1].description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1 — Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Business Name"
                placeholder="e.g. Acme Retail Ltd."
                error={errors.name?.message}
                required
                {...register('name')}
              />
              <Input
                label="Legal / Registered Name"
                placeholder="Official registered name (optional)"
                error={errors.legal_name?.message}
                hint="Leave blank if same as business name"
                {...register('legal_name')}
              />
              <Select
                label="Business Type"
                options={businessTypeOptions}
                placeholder="Select type…"
                error={errors.business_type?.message}
                required
                {...register('business_type')}
              />
            </div>
          )}

          {/* Step 2 — Contact */}
          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Business Email"
                type="email"
                placeholder="info@yourbusiness.com"
                error={errors.email?.message}
                hint="Used for notifications and receipts"
                {...register('email')}
              />
              <Input
                label="Phone Number"
                type="tel"
                placeholder="+880 1xxx xxx xxx"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>
          )}

          {/* Step 3 — Location */}
          {step === 3 && (
            <div className="space-y-4">
              <Select
                label="Country"
                options={countryOptions}
                placeholder="Select country…"
                error={errors.country?.message}
                required
                {...register('country')}
              />
              <Input
                label="Address Line 1"
                placeholder="Street address"
                error={errors.address_line1?.message}
                {...register('address_line1')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  placeholder="Dhaka"
                  error={errors.address_city?.message}
                  {...register('address_city')}
                />
                <Input
                  label="State / Division"
                  placeholder="Dhaka Division"
                  error={errors.address_state?.message}
                  {...register('address_state')}
                />
              </div>
            </div>
          )}

          {/* Step 4 — Localisation */}
          {step === 4 && (
            <div className="space-y-4">
              <Select
                label="Currency"
                options={currencyOptions}
                placeholder="Select currency…"
                error={errors.currency?.message}
                required
                {...register('currency')}
              />
              <Select
                label="Timezone"
                options={timezoneOptions}
                placeholder="Select timezone…"
                error={errors.timezone?.message}
                required
                {...register('timezone')}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < STEPS.length ? (
              <Button type="button" iconRight={<ChevronRight className="h-4 w-4" />} onClick={handleNext}>
                Continue
              </Button>
            ) : (
              <Button type="submit" loading={mutation.isPending}>
                Create Business
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Step counter */}
      <p className="mt-4 text-center text-xs text-gray-400">
        Step {step} of {STEPS.length}
      </p>
    </div>
  )
}
