import { StoreAccessGate } from '@/components/admin/StoreAccessGate/StoreAccessGate';
import { CounterSalePanel } from '@/components/admin/CounterSalePanel/CounterSalePanel';

export default function AdminCounterSalePage() {
  return (
    <StoreAccessGate>
      <CounterSalePanel />
    </StoreAccessGate>
  );
}
