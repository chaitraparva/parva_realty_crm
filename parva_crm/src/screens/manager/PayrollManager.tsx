import { CreditCard } from 'lucide-react'

export default function PayrollManager() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Payroll Approval</h2>
        <p className="text-xs text-muted-foreground">Review and approve team payroll records</p>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
        <CreditCard size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground">No payroll records yet</p>
        <p className="text-xs text-muted-foreground mt-1">Payroll records will appear here once processed by HR.</p>
      </div>
    </div>
  )
}
