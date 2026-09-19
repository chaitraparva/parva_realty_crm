import { CreditCard } from 'lucide-react'

export default function PayrollAdmin() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Payroll Sign-off</h2>
        <p className="text-xs text-muted-foreground">Final approval of payroll records across both offices</p>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
        <CreditCard size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground">No payroll records yet</p>
        <p className="text-xs text-muted-foreground mt-1">Payroll records will appear here once submitted by HR.</p>
      </div>
    </div>
  )
}
