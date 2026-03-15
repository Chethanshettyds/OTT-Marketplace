import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';

interface Order {
  _id: string;
  orderNumber: string;
  productSnapshot: { name: string; platform: string; logo: string; duration: string };
  amount: number;
  status: string;
  createdAt: string;
}

interface OrderHistoryTableProps {
  orders: Order[];
  loading?: boolean;
}

const statusSeverity: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  delivered: 'success',
  processing: 'info',
  pending: 'warning',
  refunded: 'danger',
  cancelled: 'danger',
};

export default function OrderHistoryTable({ orders, loading }: OrderHistoryTableProps) {
  const statusTemplate = (row: Order) => (
    <Tag value={row.status} severity={statusSeverity[row.status] || 'info'} />
  );

  const productTemplate = (row: Order) => (
    <div className="flex items-center gap-2">
      <span className="text-white font-medium text-sm">{row.productSnapshot?.name}</span>
    </div>
  );

  const amountTemplate = (row: Order) => (
    <span className="text-indigo-400 font-bold">${row.amount?.toFixed(2)}</span>
  );

  const dateTemplate = (row: Order) => (
    <span className="text-white/50 text-sm">
      {new Date(row.createdAt).toLocaleDateString()}
    </span>
  );

  return (
    <DataTable
      value={orders}
      loading={loading}
      paginator
      rows={10}
      rowsPerPageOptions={[5, 10, 25]}
      emptyMessage="No orders found"
      className="text-sm"
      stripedRows
    >
      <Column field="orderNumber" header="Order #" style={{ minWidth: '140px' }} />
      <Column header="Product" body={productTemplate} style={{ minWidth: '200px' }} />
      <Column field="productSnapshot.duration" header="Duration" />
      <Column header="Amount" body={amountTemplate} sortable field="amount" />
      <Column header="Status" body={statusTemplate} sortable field="status" />
      <Column header="Date" body={dateTemplate} sortable field="createdAt" />
    </DataTable>
  );
}
